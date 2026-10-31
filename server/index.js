import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Admin, Appointment, Branch, ClinicSettings, Doctor, Faq, Media, Patient, Review, Treatment, WhatsAppLog } from './models.js';
import { seedDatabase } from './seed.js';

const { GridFSBucket, ObjectId } = mongoose.mongo;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
export const app = express();
const PORT = Number(process.env.PORT || 4000);
const IS_VERCEL = process.env.VERCEL === '1' || process.env.VERCEL === 'true';
const COOKIE_NAME = process.env.COOKIE_NAME || 'aurelia_admin';
const JWT_SECRET = process.env.JWT_SECRET || 'local-development-only-change-before-deploying';
// Vercel Functions cap request bodies at 4.5 MB. Keep multipart direct uploads below that;
// larger videos should be added via Admin → Add hosted URL. Local development supports larger files.
const MAX_UPLOAD_MB = IS_VERCEL
  ? Math.max(1, Math.min(3, Number(process.env.MAX_UPLOAD_MB || 3)))
  : Math.max(5, Math.min(150, Number(process.env.MAX_UPLOAD_MB || 100)));
const uploadTempDir = IS_VERCEL ? path.join('/tmp', 'aurelia-dental-uploads') : path.join(rootDir, '.tmp_uploads');
fs.mkdirSync(uploadTempDir, { recursive: true });
let gridFS;
let initializationPromise = null;
const seedOwner = `${process.pid}-${Math.random().toString(36).slice(2)}`;

const rateOptions = { windowMs: 15 * 60 * 1000, limit: 80, standardHeaders: 'draft-8', legacyHeaders: false };
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
    styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
    mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
    connectSrc: ["'self'"], frameSrc: ["'self'", 'https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
    objectSrc: ["'none'"], upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
  } }
}));
app.use(compression());
app.use(express.json({ limit: '2mb', verify: (req, _res, buffer) => { req.rawBody = Buffer.from(buffer); } }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(cookieParser());

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const authLimiter = rateLimit({ ...rateOptions, limit: 8, message: { error: 'Too many login attempts. Please try again in 15 minutes.' } });
const bookingLimiter = rateLimit({ ...rateOptions, limit: 20, message: { error: 'Too many requests. Please wait and try again.' } });
const generalLimiter = rateLimit({ ...rateOptions, limit: 300 });
app.use('/api', generalLimiter);

function safeText(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}
function isObjectId(value) { return typeof value === 'string' && mongoose.isValidObjectId(value); }
function getDepartment(value) { return value === 'skin' ? 'skin' : 'dental'; }
function departmentFilter(department, extra = {}) {
  const base = getDepartment(department) === 'skin'
    ? { department: 'skin' }
    : { $or: [{ department: 'dental' }, { department: { $exists: false } }] };
  return Object.keys(extra).length ? { $and: [base, extra] } : base;
}
function getSettings(department = 'dental') {
  const dep = getDepartment(department);
  return ClinicSettings.findOne({ key: dep === 'skin' ? 'skin' : 'main' }).lean();
}
function tokenFor(admin) { return jwt.sign({ sub: admin._id.toString(), role: admin.role, email: admin.email }, JWT_SECRET, { expiresIn: '8h', issuer: 'aurelia-dental' }); }
function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000, path: '/' });
}
const requireAdmin = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Please sign in to access the admin workspace.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'aurelia-dental' });
    const admin = await Admin.findById(payload.sub).select('_id email role active').lean();
    if (!admin?.active) return res.status(401).json({ error: 'Admin account is unavailable. Sign in again.' });
    req.admin = admin;
    next();
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  }
});
function validateRequired(value, label, max = 200) {
  const out = safeText(value, max);
  if (!out) { const error = new Error(`${label} is required.`); error.status = 400; throw error; }
  return out;
}
function safeHttpsUrl(value, label = 'URL', allowMediaPath = false) {
  const out = safeText(value, 1000);
  if (!out) return '';
  if (allowMediaPath && (/^\/api\/media\/file\/[a-f0-9]{24}$/i.test(out) || /^\/images\/[a-z0-9_.-]+$/i.test(out))) return out;
  try { const parsed = new URL(out); if (parsed.protocol === 'https:') return out; } catch {}
  const error = new Error(`${label} must be a valid HTTPS URL.`); error.status = 400; throw error;
}
function phoneDigits(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
}
function mediaPublic(doc) {
  const m = doc.toObject ? doc.toObject() : doc;
  const department = getDepartment(m.department);
  return { ...m, url: m.fileId ? `/api/media/file/${m.fileId}?department=${department}` : m.url, _id: m._id.toString() };
}
function dateInIndia() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: process.env.CLINIC_TIME_ZONE || 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function timeToMinutes(value) { const [h, m] = String(value || '').split(':').map(Number); return h * 60 + m; }
function buildTimeSlots(settings, date) {
  const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
  const workingDays = Array.isArray(settings?.workingDays) ? settings.workingDays.map(Number) : [1, 2, 3, 4, 5, 6];
  if (!workingDays.includes(dayOfWeek)) return [];
  const open = timeToMinutes(settings?.openingTime || '09:00');
  const close = timeToMinutes(settings?.closingTime || '18:00');
  const step = Math.max(15, Math.min(120, Number(settings?.slotMinutes || 30)));
  let slots = [];
  for (let t = open; t + step <= close; t += step) slots.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  if (date === dateInIndia()) {
    const nowParts = new Intl.DateTimeFormat('en-GB', { timeZone: process.env.CLINIC_TIME_ZONE || 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()).split(':').map(Number);
    const now = nowParts[0] * 60 + nowParts[1];
    slots = slots.filter(slot => timeToMinutes(slot) > now + 15);
  }
  return slots;
}
async function findTakenSlots(date, doctorId, excludeId = null, department = 'dental', branchId = null) {
  const conditions = { appointmentDate: date, status: { $in: ['pending', 'confirmed'] } };
  if (excludeId) conditions._id = { $ne: excludeId };
  if (doctorId) {
    // A clinician cannot be double-booked across two branches at the same time.
    conditions.$or = [{ doctor: doctorId }, { doctor: null, ...(branchId ? { branch: branchId } : {}) }];
  } else if (branchId) {
    conditions.branch = branchId;
  }
  const query = departmentFilter(department, conditions);
  const rows = await Appointment.find(query).select('appointmentTime').lean();
  return new Set(rows.map(row => row.appointmentTime));
}
function slugify(value) {
  return safeText(value, 140).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 140);
}
function normalizeBranch(input, existing = {}, department = 'dental') {
  const name = validateRequired(input.name ?? existing.name, 'Branch name', 140);
  const area = validateRequired(input.area ?? existing.area, 'Branch area', 120);
  const facilities = Array.isArray(input.facilities) ? input.facilities.map(v => safeText(v, 100)).filter(Boolean).slice(0, 20) : (existing.facilities || []);
  const doctorIds = Array.isArray(input.doctorIds) ? input.doctorIds.filter(isObjectId) : (existing.doctorIds || []);
  const serviceIds = Array.isArray(input.serviceIds) ? input.serviceIds.filter(isObjectId) : (existing.serviceIds || []);
  const workingDays = Array.isArray(input.workingDays) ? [...new Set(input.workingDays.map(Number).filter(v => Number.isInteger(v) && v >= 0 && v <= 6))] : (existing.workingDays || [1,2,3,4,5,6]);
  const openingTime = safeText(input.openingTime ?? existing.openingTime ?? '09:00', 5);
  const closingTime = safeText(input.closingTime ?? existing.closingTime ?? '18:00', 5);
  if (!/^\d{2}:\d{2}$/.test(openingTime) || !/^\d{2}:\d{2}$/.test(closingTime)) { const error = new Error('Branch opening and closing times must use HH:MM.'); error.status = 400; throw error; }
  return {
    department: getDepartment(department), name, slug: slugify(input.slug || existing.slug || `${name}-${area}`), area,
    address: validateRequired(input.address ?? existing.address, 'Branch address', 420),
    city: safeText(input.city ?? existing.city, 120), phone: safeText(input.phone ?? existing.phone, 35),
    whatsapp: safeText(input.whatsapp ?? existing.whatsapp, 35), email: safeText(input.email ?? existing.email, 180).toLowerCase(),
    mapUrl: safeHttpsUrl(input.mapUrl ?? existing.mapUrl, 'Branch map URL'),
    image: safeHttpsUrl(input.image ?? existing.image, 'Branch image URL', true),
    description: safeText(input.description ?? existing.description, 700), facilities, doctorIds, serviceIds,
    openingTime, closingTime, slotMinutes: Math.max(15, Math.min(120, Number(input.slotMinutes ?? existing.slotMinutes ?? 30))),
    workingDays, hoursLabel: safeText(input.hoursLabel ?? existing.hoursLabel, 180),
    active: input.active !== undefined ? Boolean(input.active) : (existing.active ?? true),
    featured: input.featured !== undefined ? Boolean(input.featured) : Boolean(existing.featured),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : Number(existing.sortOrder || 0)
  };
}
function formatWhatsAppDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}
function formatWhatsAppTime(value) {
  if (!value) return '';
  const [h, m] = value.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}
async function upsertPatient({ department, name, phone, email = '', dateOfBirth = '', gender = '', notes = '', source = 'website', whatsappConsent = false }) {
  const normalizedPhone = phoneDigits(phone);
  if (normalizedPhone.length < 10 || normalizedPhone.length > 15) { const error = new Error('Enter a valid patient phone number with country code.'); error.status = 400; throw error; }
  const consent = Boolean(whatsappConsent);
  return Patient.findOneAndUpdate(
    { department: getDepartment(department), normalizedPhone },
    { $set: {
      name: validateRequired(name, 'Patient name', 120), phone: validateRequired(phone, 'Patient phone', 35),
      email: safeText(email, 180).toLowerCase(), dateOfBirth: safeText(dateOfBirth, 10), gender,
      notes: safeText(notes, 1800), source, whatsappConsent: consent, whatsappConsentAt: consent ? new Date() : null
    }, $setOnInsert: { department: getDepartment(department), normalizedPhone } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
}
async function sendWhatsAppTemplate({ department, appointment, patient, recipient, recipientRole, event, templateName, parameters, requireConsent = false }) {
  const number = phoneDigits(recipient);
  if (!number) {
    return { status: 'skipped_no_number', error: 'No WhatsApp number is configured for this recipient.' };
  }
  if (requireConsent && !(patient ? patient.whatsappConsent === true : appointment?.whatsappConsent === true)) {
    await WhatsAppLog.create({ department, appointment: appointment?._id, patient: patient?._id, recipient: number, recipientRole, event, templateName: templateName || '', status: 'skipped_no_consent', error: 'Patient has not opted in to WhatsApp appointment updates.' });
    return { status: 'skipped_no_consent' };
  }
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const template = templateName || '';
  if (!accessToken || !phoneNumberId || !template) {
    if (template && number) await WhatsAppLog.create({ department, appointment: appointment?._id, patient: patient?._id, recipient: number, recipientRole, event, templateName: template, status: 'skipped_unconfigured', error: 'WhatsApp Cloud API credentials or template are not configured.' });
    return { status: 'skipped_unconfigured', error: 'Configure the WhatsApp Cloud API token, phone number ID and approved template names.' };
  }
  const version = /^v\d+\.\d+$/.test(process.env.WHATSAPP_GRAPH_API_VERSION || '') ? process.env.WHATSAPP_GRAPH_API_VERSION : 'v26.0';
  const log = await WhatsAppLog.create({ department, appointment: appointment?._id, patient: patient?._id, recipient: number, recipientRole, event, templateName: template, status: 'failed' });
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp', to: number, type: 'template',
        template: { name: template, language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en' }, components: [{ type: 'body', parameters: (parameters || []).map(text => ({ type: 'text', text: String(text ?? '').slice(0, 1024) })) }] }
      }),
      signal: AbortSignal.timeout(12000)
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = payload?.error?.message || `WhatsApp API returned HTTP ${response.status}.`;
      await WhatsAppLog.updateOne({ _id: log._id }, { $set: { status: 'failed', error: detail.slice(0, 1000), metadata: { providerCode: payload?.error?.code || null } } });
      return { status: 'failed', error: detail, logId: log._id };
    }
    const providerMessageId = payload?.messages?.[0]?.id || '';
    await WhatsAppLog.updateOne({ _id: log._id }, { $set: { status: 'accepted', providerMessageId, sentAt: new Date(), metadata: { providerResponse: 'accepted' } } });
    return { status: 'accepted', providerMessageId, logId: log._id };
  } catch (error) {
    await WhatsAppLog.updateOne({ _id: log._id }, { $set: { status: 'failed', error: String(error?.message || error).slice(0, 1000) } });
    return { status: 'failed', error: error?.message || 'WhatsApp send failed.', logId: log._id };
  }
}
async function sendBookingNotifications({ appointment, department, settings, doctor }) {
  const branch = appointment.branch;
  const shared = [
    appointment.patientName,
    settings?.clinicName || (department === 'skin' ? 'R Dental Skin & Hair' : 'R Dental Clinic'),
    appointment.treatment?.name || 'appointment',
    doctor?.name || 'our clinician',
    branch?.name || appointment.branchName || 'the clinic',
    formatWhatsAppDate(appointment.appointmentDate),
    formatWhatsAppTime(appointment.appointmentTime)
  ];
  const patientPromise = sendWhatsAppTemplate({
    department, appointment, patient: appointment.patient,
    recipient: appointment.phone, recipientRole: 'patient', event: 'booking_confirmation',
    templateName: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_PATIENT || 'rdental_appointment_patient',
    parameters: shared, requireConsent: true
  });
  const doctorPhone = doctor?.whatsapp || doctor?.phone || '';
  const doctorPromise = doctor && doctor.whatsappNotificationsEnabled === true && doctorPhone ? sendWhatsAppTemplate({
    department, appointment, patient: appointment.patient, recipient: doctorPhone, recipientRole: 'doctor', event: 'appointment_alert',
    templateName: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_DOCTOR || 'rdental_appointment_doctor',
    parameters: [doctor?.name || 'Doctor', appointment.patientName, appointment.phone, appointment.treatment?.name || 'appointment', branch?.name || appointment.branchName || 'the clinic', formatWhatsAppDate(appointment.appointmentDate), formatWhatsAppTime(appointment.appointmentTime)]
  }) : (doctorPhone ? WhatsAppLog.create({ department, appointment: appointment?._id, patient: appointment?.patient, recipient: phoneDigits(doctorPhone), recipientRole: 'doctor', event: 'appointment_alert', templateName: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_DOCTOR || 'rdental_appointment_doctor', status: 'skipped_no_consent', error: 'WhatsApp appointment alerts are disabled for this clinician profile. Enable them in Admin → Doctors.' }).then(() => ({ status: 'skipped_no_consent' })) : Promise.resolve({ status: 'skipped_no_number', error: 'Add the doctor WhatsApp number in the admin doctor profile.' }));
  const [patient, doctorResult] = await Promise.all([patientPromise, doctorPromise]);
  return { patient, doctor: doctorResult };
}
function normalizeDoctor(input, existing = {}, department = 'dental') {
  return {
    department: getDepartment(department),
    name: validateRequired(input.name ?? existing.name, getDepartment(department) === 'skin' ? 'Dermatologist name' : 'Dentist name', 120),
    role: safeText(input.role ?? existing.role ?? 'Consultant Dentist', 120),
    phone: safeText(input.phone ?? existing.phone, 35), whatsapp: safeText(input.whatsapp ?? existing.whatsapp, 35),
    whatsappNotificationsEnabled: input.whatsappNotificationsEnabled !== undefined ? Boolean(input.whatsappNotificationsEnabled) : Boolean(existing.whatsappNotificationsEnabled),
    branchIds: Array.isArray(input.branchIds) ? input.branchIds.filter(isObjectId) : (existing.branchIds || []),
    specialities: Array.isArray(input.specialities) ? input.specialities.map(v => safeText(v, 70)).filter(Boolean).slice(0, 12) : (existing.specialities || []),
    qualifications: safeText(input.qualifications ?? existing.qualifications, 250),
    experienceYears: Math.max(0, Math.min(80, Number(input.experienceYears ?? existing.experienceYears ?? 0))),
    image: safeHttpsUrl(input.image ?? existing.image, department === 'skin' ? 'Dermatologist image URL' : 'Dentist image URL', true),
    bio: safeText(input.bio ?? existing.bio, 1800),
    philosophy: safeText(input.philosophy ?? existing.philosophy, 500),
    languages: Array.isArray(input.languages) ? input.languages.map(v => safeText(v, 60)).filter(Boolean).slice(0, 8) : (existing.languages || []),
    availability: safeText(input.availability ?? existing.availability ?? 'By appointment', 180),
    active: input.active !== undefined ? Boolean(input.active) : (existing.active ?? true),
    featured: input.featured !== undefined ? Boolean(input.featured) : Boolean(existing.featured),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : Number(existing.sortOrder || 0)
  };
}
function normalizeTreatment(input, existing = {}, department = 'dental') {
  return {
    department: getDepartment(department),
    name: validateRequired(input.name ?? existing.name, getDepartment(department) === 'skin' ? 'Service name' : 'Treatment name', 120),
    category: safeText(input.category ?? existing.category ?? 'General dentistry', 80),
    shortDescription: validateRequired(input.shortDescription ?? existing.shortDescription, 'Short description', 260),
    description: safeText(input.description ?? existing.description, 1600),
    durationMinutes: Math.max(10, Math.min(600, Number(input.durationMinutes ?? existing.durationMinutes ?? 30))),
    priceFrom: Math.max(0, Number(input.priceFrom ?? existing.priceFrom ?? 0)),
    sessions: safeText(input.sessions ?? existing.sessions ?? 'As advised after consultation', 180),
    recovery: safeText(input.recovery ?? existing.recovery ?? (getDepartment(department) === 'skin' ? 'Your dermatologist will guide you' : 'Your dentist will guide you'), 180),
    features: Array.isArray(input.features) ? input.features.map(v => safeText(v, 140)).filter(Boolean).slice(0, 12) : (existing.features || []),
    image: safeHttpsUrl(input.image ?? existing.image, 'Treatment image URL', true),
    featured: input.featured !== undefined ? Boolean(input.featured) : Boolean(existing.featured),
    active: input.active !== undefined ? Boolean(input.active) : (existing.active ?? true),
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : Number(existing.sortOrder || 0)
  };
}

// Health endpoint intentionally does not expose connection strings or credentials.
app.get('/api/health', (_req, res) => res.status(200).json({ ok: true, app: 'R Dental Clinic API', database: mongoose.connection.readyState === 1 ? 'mongodb-atlas' : 'disconnected', uptimeSeconds: Math.round(process.uptime()) }));

// Authentication is separate from the protected admin router.
app.post('/api/auth/login', authLimiter, asyncHandler(async (req, res) => {
  const email = safeText(req.body.email, 180).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const admin = await Admin.findOne({ email });
  if (!admin || !admin.active || !(await bcrypt.compare(password, admin.passwordHash))) return res.status(401).json({ error: 'The email or password is not correct.' });
  admin.lastLoginAt = new Date();
  await admin.save();
  setAuthCookie(res, tokenFor(admin));
  res.json({ admin: { email: admin.email, role: admin.role } });
}));
app.get('/api/auth/me', asyncHandler(async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET, { issuer: 'aurelia-dental' });
    const admin = await Admin.findById(payload.sub).select('email role active').lean();
    if (!admin?.active) return res.status(401).json({ error: 'Not signed in.' });
    res.json({ admin: { email: admin.email, role: admin.role } });
  } catch { res.status(401).json({ error: 'Not signed in.' }); }
}));
app.post('/api/auth/logout', (_req, res) => { res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' }); res.json({ ok: true }); });

// Public, read-only CMS endpoints.
app.get('/api/settings', asyncHandler(async (req, res) => { res.json(await getSettings(getDepartment(req.query.department)) || {}); }));
app.get('/api/doctors', asyncHandler(async (req, res) => {
  const rows = await Doctor.find(departmentFilter(getDepartment(req.query.department), { active: true })).select('-phone -whatsapp').sort({ featured: -1, sortOrder: 1, name: 1 }).lean();
  res.json(rows);
}));
app.get('/api/branches', asyncHandler(async (req, res) => {
  const rows = await Branch.find(departmentFilter(getDepartment(req.query.department), { active: true }))
    .sort({ featured: -1, sortOrder: 1, name: 1 })
    .populate('doctorIds', 'name role image qualifications specialities')
    .populate('serviceIds', 'name category')
    .lean();
  res.json(rows);
}));
app.get('/api/services', asyncHandler(async (req, res) => { const rows = await Treatment.find(departmentFilter(getDepartment(req.query.department), { active: true })).sort({ featured: -1, sortOrder: 1, name: 1 }).lean(); res.json(rows); }));
app.get('/api/faqs', asyncHandler(async (req, res) => { res.json(await Faq.find(departmentFilter(getDepartment(req.query.department), { active: true })).sort({ sortOrder: 1, createdAt: 1 }).lean()); }));
app.get('/api/reviews', asyncHandler(async (req, res) => { res.json(await Review.find(departmentFilter(getDepartment(req.query.department), { published: true })).sort({ sortOrder: 1, createdAt: -1 }).limit(12).lean()); }));
app.get('/api/media', asyncHandler(async (req, res) => {
  const q = { active: true };
  if (['image', 'video'].includes(req.query.type)) q.type = req.query.type;
  const rows = await Media.find(departmentFilter(getDepartment(req.query.department), q)).sort({ featured: -1, sortOrder: 1, createdAt: -1 }).limit(40).lean();
  res.json(rows.map(mediaPublic));
}));
app.get('/api/media/file/:id', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid media reference.' });
  if (!gridFS) return res.status(503).json({ error: 'Media storage is not available.' });
  const fileId = new ObjectId(req.params.id);
  const visibleMedia = await Media.exists(departmentFilter(getDepartment(req.query.department), { fileId, active: true }));
  if (!visibleMedia) return res.status(404).json({ error: 'Media file not found.' });
  const files = await mongoose.connection.db.collection('aureliaMedia.files').find({ _id: fileId }).limit(1).toArray();
  const file = files[0];
  if (!file) return res.status(404).json({ error: 'Media file not found.' });
  res.set('Content-Type', file.contentType || 'application/octet-stream');
  res.set('Content-Length', String(file.length));
  res.set('Cache-Control', 'public, max-age=86400');
  res.set('X-Content-Type-Options', 'nosniff');
  const stream = gridFS.openDownloadStream(fileId);
  stream.on('error', err => { if (!res.headersSent) res.status(404).end(); else res.destroy(err); });
  stream.pipe(res);
}));

app.get('/api/availability', asyncHandler(async (req, res) => {
  const department = getDepartment(req.query.department);
  const date = safeText(req.query.date, 10);
  const doctorId = isObjectId(req.query.doctorId) ? req.query.doctorId : null;
  const branchId = isObjectId(req.query.branchId) ? req.query.branchId : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < dateInIndia()) return res.status(400).json({ error: 'Choose a valid date in the future.' });
  const branch = branchId ? await Branch.findOne(departmentFilter(department, { _id: branchId, active: true })).lean() : null;
  if (branchId && !branch) return res.status(400).json({ error: 'Choose an active clinic branch.' });
  const settings = branch || await getSettings(department);
  const all = buildTimeSlots(settings, date);
  const taken = await findTakenSlots(date, doctorId, null, department, branchId);
  res.json({ date, branchId, slots: all.filter(slot => !taken.has(slot)) });
}));

app.post('/api/appointments', bookingLimiter, asyncHandler(async (req, res) => {
  const department = getDepartment(req.query.department || req.body.department);
  const patientName = validateRequired(req.body.patientName, 'Your name', 120);
  const phone = validateRequired(req.body.phone, 'Phone number', 35);
  const email = safeText(req.body.email, 180).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email address, or leave it blank.' });
  const treatmentId = req.body.treatment;
  const doctorId = req.body.doctor && isObjectId(req.body.doctor) ? req.body.doctor : null;
  const branchId = req.body.branch && isObjectId(req.body.branch) ? req.body.branch : null;
  const appointmentDate = safeText(req.body.appointmentDate, 10);
  const appointmentTime = safeText(req.body.appointmentTime, 5);
  const patientMessage = safeText(req.body.patientMessage, 1200);
  const whatsappConsent = req.body.whatsappConsent === true;
  if (!isObjectId(treatmentId)) return res.status(400).json({ error: department === 'skin' ? 'Please select a valid Skin & Hair service.' : 'Please select a valid treatment.' });
  const treatment = await Treatment.findOne(departmentFilter(department, { _id: treatmentId, active: true })).lean();
  if (!treatment) return res.status(400).json({ error: 'This service is no longer available. Please choose another service.' });
  const doctor = doctorId ? await Doctor.findOne(departmentFilter(department, { _id: doctorId, active: true })).lean() : null;
  if (doctorId && !doctor) return res.status(400).json({ error: 'This clinician is no longer available. Please choose another clinician.' });
  const activeBranchCount = await Branch.countDocuments(departmentFilter(department, { active: true }));
  if (activeBranchCount && !branchId) return res.status(400).json({ error: 'Please select your preferred clinic branch.' });
  const branch = branchId ? await Branch.findOne(departmentFilter(department, { _id: branchId, active: true })).lean() : null;
  if (branchId && !branch) return res.status(400).json({ error: 'The selected branch is no longer available. Please choose another branch.' });
  if (branch?.doctorIds?.length && doctorId && !branch.doctorIds.some(id => id.toString() === doctorId)) return res.status(400).json({ error: 'The selected clinician does not practise at this branch.' });
  if (branch?.serviceIds?.length && !branch.serviceIds.some(id => id.toString() === treatmentId)) return res.status(400).json({ error: 'The selected treatment is not available at this branch.' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || appointmentDate < dateInIndia()) return res.status(400).json({ error: 'Please choose today or a future date.' });
  if (!/^\d{2}:\d{2}$/.test(appointmentTime)) return res.status(400).json({ error: 'Please select an available time.' });
  const settings = branch || await getSettings(department);
  if (!buildTimeSlots(settings, appointmentDate).includes(appointmentTime)) return res.status(400).json({ error: 'That appointment time is outside the selected branch hours. Please choose another time.' });
  const taken = await findTakenSlots(appointmentDate, doctorId, null, department, branchId);
  if (taken.has(appointmentTime)) return res.status(409).json({ error: 'That time has just been booked. Please select another available slot.' });

  const patient = await upsertPatient({ department, name: patientName, phone, email, source: 'website', whatsappConsent });
  const appointment = await Appointment.create({
    department, patient: patient._id, patientName, phone, email, treatment: treatment._id, doctor: doctor?._id || null,
    branch: branch?._id || null, branchName: branch?.name || '', branchAddress: branch?.address || '',
    appointmentDate, appointmentTime, patientMessage, whatsappConsent, whatsappConsentAt: whatsappConsent ? new Date() : null,
    source: 'website', referralSource: safeText(req.body.referralSource, 80), status: 'pending', journeyStage: 'new_request',
    journeyHistory: [{ stage: 'new_request', note: 'Appointment request received from the website.', updatedBy: 'website' }]
  });
  const fullAppointment = await Appointment.findById(appointment._id).populate('treatment', 'name durationMinutes priceFrom').populate('doctor', 'name role').populate('branch', 'name area address').populate('patient', 'name phone email whatsappConsent').lean();
  const clinicSettings = await getSettings(department);
  // The appointment is already persisted. A WhatsApp provider/logging outage must not
  // turn a successful booking into an HTTP error that could cause duplicate submissions.
  let notificationResults = {
    patient: { status: 'failed', error: 'Notification attempt did not complete.' },
    doctor: { status: 'failed', error: 'Notification attempt did not complete.' }
  };
  try {
    notificationResults = await sendBookingNotifications({ appointment: fullAppointment, department, settings: clinicSettings, doctor });
  } catch (notificationError) {
    console.error('[whatsapp] Booking notification failed after appointment was saved:', notificationError?.message || notificationError);
    notificationResults = {
      patient: { status: 'failed', error: 'The appointment was saved, but the patient WhatsApp notification could not be completed.' },
      doctor: { status: 'failed', error: 'The appointment was saved, but the clinician WhatsApp notification could not be completed.' }
    };
  }
  res.status(201).json({
    message: 'Your appointment request has been received. The clinic will contact you to confirm it.',
    appointment: fullAppointment,
    notifications: notificationResults
  });
}));

// WhatsApp Cloud API webhooks: verify subscription and record provider delivery states.
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && process.env.WHATSAPP_VERIFY_TOKEN && token === process.env.WHATSAPP_VERIFY_TOKEN) return res.status(200).send(String(challenge || ''));
  return res.sendStatus(403);
});
app.post('/api/whatsapp/webhook', asyncHandler(async (req, res) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (process.env.NODE_ENV === 'production' && !appSecret) return res.status(503).json({ error: 'WhatsApp webhook signature verification is not configured.' });
  if (appSecret) {
    const signature = String(req.headers['x-hub-signature-256'] || '');
    const expected = `sha256=${createHmac('sha256', appSecret).update(req.rawBody || Buffer.alloc(0)).digest('hex')}`;
    const valid = signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!valid) return res.sendStatus(401);
  }
  const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
  for (const entry of entries) for (const change of (entry.changes || [])) {
    const statuses = change?.value?.statuses || [];
    for (const item of statuses) {
      if (!item.id || !['sent', 'delivered', 'read', 'failed'].includes(item.status)) continue;
      const update = { status: item.status };
      if (item.status === 'failed') update.error = JSON.stringify(item.errors || []).slice(0, 1000);
      await WhatsAppLog.updateOne({ providerMessageId: item.id }, { $set: update });
    }
    // Respect inbound opt-out keywords. The inbound messages webhook must be subscribed in Meta.
    const inboundMessages = change?.value?.messages || [];
    for (const message of inboundMessages) {
      const body = message?.text?.body;
      const keyword = safeText(body, 80).toLowerCase().replace(/[.!\s]+/g, ' ').trim();
      if (!message?.from || !['stop', 'stop all', 'unsubscribe', 'cancel', 'end'].includes(keyword)) continue;
      const normalizedPhone = phoneDigits(message.from);
      if (normalizedPhone) {
        const matchedPatients = await Patient.find({ normalizedPhone }).select('_id').lean();
        const patientIds = matchedPatients.map(patient => patient._id);
        if (patientIds.length) {
          await Patient.updateMany({ _id: { $in: patientIds } }, { $set: { whatsappConsent: false, whatsappConsentAt: null } });
          await Appointment.updateMany({ patient: { $in: patientIds } }, { $set: { whatsappConsent: false, whatsappConsentAt: null } });
        }
      }
    }
  }
  res.sendStatus(200);
}));

// Protected operations used by the integrated /admin workspace.
const adminApi = express.Router();
adminApi.use(requireAdmin);
adminApi.get('/dashboard', asyncHandler(async (req, res) => {
  const department = getDepartment(req.query.department);
  const today = dateInIndia();
  const [appointments, pending, confirmed, doctors, services, videos, branches, patients, followUpsDue, upcoming, trendRows] = await Promise.all([
    Appointment.countDocuments(departmentFilter(department)),
    Appointment.countDocuments(departmentFilter(department, { status: 'pending' })),
    Appointment.countDocuments(departmentFilter(department, { status: 'confirmed' })),
    Doctor.countDocuments(departmentFilter(department, { active: true })),
    Treatment.countDocuments(departmentFilter(department, { active: true })),
    Media.countDocuments(departmentFilter(department, { active: true, type: 'video' })),
    Branch.countDocuments(departmentFilter(department, { active: true })),
    Patient.countDocuments(departmentFilter(department)),
    Appointment.countDocuments(departmentFilter(department, { nextFollowUpDate: { $ne: '', $lte: today }, status: { $nin: ['completed', 'cancelled'] } })),
    Appointment.find(departmentFilter(department, { appointmentDate: { $gte: today }, status: { $in: ['pending', 'confirmed'] } })).sort({ appointmentDate: 1, appointmentTime: 1 }).limit(8).populate('treatment', 'name').populate('doctor', 'name').lean(),
    Appointment.aggregate([
      { $match: departmentFilter(department, { createdAt: { $gte: new Date(Date.now() - 6 * 86400000) } }) },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
  ]);
  const trend = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(Date.now() - (6 - index) * 86400000);
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(day);
    return { date, count: trendRows.find(row => row._id === date)?.count || 0 };
  });
  res.json({ department, appointments, pending, confirmed, doctors, services, videos, branches, patients, followUpsDue, upcoming, trend });
}));
adminApi.get('/appointments', asyncHandler(async (req, res) => {
  const department = getDepartment(req.query.department);
  const query = {};
  const workflowFilter = req.query.workflowStage || req.query.status;
  if (workflowFilter === 'pending') query.status = 'pending';
  else if (workflowFilter === 'confirmed') { query.status = 'confirmed'; query.$or = [{ journeyStage: 'new_request' }, { journeyStage: { $exists: false } }]; }
  else if (workflowFilter === 'completed') query.status = 'completed';
  else if (workflowFilter === 'cancelled') query.status = 'cancelled';
  else if (['first_visit', 'follow_up_1', 'follow_up_2', 'final_visit'].includes(workflowFilter)) query.journeyStage = workflowFilter;
  if (req.query.date && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)) query.appointmentDate = req.query.date;
  if (isObjectId(req.query.branchId)) query.branch = req.query.branchId;
  if (req.query.followUpDate && /^\d{4}-\d{2}-\d{2}$/.test(req.query.followUpDate)) query.nextFollowUpDate = req.query.followUpDate;
  const rows = await Appointment.find(departmentFilter(department, query)).sort({ appointmentDate: -1, appointmentTime: 1, createdAt: -1 }).limit(500)
    .populate('treatment', 'name durationMinutes priceFrom').populate('doctor', 'name role whatsapp phone').populate('branch', 'name area address phone whatsapp').populate('patient', 'name phone email whatsappConsent').lean();
  res.json(rows);
}));
adminApi.patch('/appointments/:id', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid appointment.' });
  const department = getDepartment(req.query.department);
  const appointment = await Appointment.findOne(departmentFilter(department, { _id: req.params.id }));
  if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
  const { status, workflowStage, adminNotes, appointmentDate, appointmentTime, doctor, treatment, branch, nextFollowUpDate, nextFollowUpTime } = req.body;
  const schedulingChanged = appointmentDate !== undefined || appointmentTime !== undefined || doctor !== undefined || treatment !== undefined || branch !== undefined;
  const visitStages = ['first_visit', 'follow_up_1', 'follow_up_2', 'final_visit'];
  const allowedWorkflowStages = ['pending', 'confirmed', ...visitStages, 'completed', 'cancelled'];
  const previousJourneyStage = appointment.journeyStage || 'new_request';
  const previousStatus = appointment.status;

  // A single admin workflow control maps booking state and treatment progress
  // onto the existing status + journeyStage fields. It does not send WhatsApp.
  if (workflowStage !== undefined) {
    if (!allowedWorkflowStages.includes(workflowStage)) return res.status(400).json({ error: 'Choose a valid appointment workflow status.' });

    if (workflowStage === 'pending' || workflowStage === 'confirmed') {
      appointment.status = workflowStage;
      appointment.journeyStage = 'new_request';
      appointment.nextFollowUpDate = '';
      appointment.nextFollowUpTime = '';
    } else if (workflowStage === 'cancelled') {
      appointment.status = 'cancelled';
    } else if (workflowStage === 'completed') {
      appointment.status = 'completed';
      appointment.journeyStage = 'completed';
      appointment.nextFollowUpDate = '';
      appointment.nextFollowUpTime = '';
    } else {
      appointment.status = 'confirmed';
      appointment.journeyStage = workflowStage;
    }

    if (appointment.journeyStage !== previousJourneyStage || appointment.status !== previousStatus) {
      appointment.journeyStageUpdatedAt = new Date();
      const workflowLabels = {
        pending: 'Booking marked pending',
        confirmed: 'Appointment confirmed',
        first_visit: 'First visit marked completed',
        follow_up_1: 'Follow-up 1 marked',
        follow_up_2: 'Follow-up 2 marked',
        final_visit: 'Final / review visit marked',
        completed: 'Treatment marked completed',
        cancelled: 'Appointment cancelled'
      };
      appointment.journeyHistory.push({
        stage: appointment.journeyStage || 'new_request',
        note: workflowLabels[workflowStage],
        followUpDate: appointment.nextFollowUpDate || '',
        followUpTime: appointment.nextFollowUpTime || '',
        updatedBy: req.admin?.email || 'admin'
      });
    }

    // Count each clinical visit once, even when the receptionist only changes
    // the workflow dropdown and chooses to send the WhatsApp message separately.
    if (visitStages.includes(workflowStage) && !appointment.recordedVisitStages.includes(workflowStage)) {
      appointment.recordedVisitStages.addToSet(workflowStage);
      if (appointment.patient) {
        await Patient.updateOne({ _id: appointment.patient }, { $inc: { visitCount: 1 }, $set: { lastVisitAt: new Date() } });
      }
    }
  } else if (status !== undefined) {
    if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid appointment status.' });
    appointment.status = status;
    if (status === 'completed' && appointment.journeyStage !== 'completed') {
      appointment.journeyStage = 'completed';
      appointment.journeyStageUpdatedAt = new Date();
      appointment.nextFollowUpDate = '';
      appointment.nextFollowUpTime = '';
      appointment.journeyHistory.push({ stage: 'completed', note: 'Treatment marked completed by admin.', updatedBy: req.admin?.email || 'admin' });
    }
  }
  if (adminNotes !== undefined) appointment.adminNotes = safeText(adminNotes, 1200);
  if (nextFollowUpDate !== undefined) {
    if (nextFollowUpDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUpDate)) return res.status(400).json({ error: 'Follow-up date must use YYYY-MM-DD.' });
    appointment.nextFollowUpDate = safeText(nextFollowUpDate, 10);
  }
  if (nextFollowUpTime !== undefined) {
    if (nextFollowUpTime && !/^\d{2}:\d{2}$/.test(nextFollowUpTime)) return res.status(400).json({ error: 'Follow-up time must use HH:MM.' });
    appointment.nextFollowUpTime = safeText(nextFollowUpTime, 5);
  }
  if (schedulingChanged) {
    const d = safeText(appointmentDate ?? appointment.appointmentDate, 10);
    const t = safeText(appointmentTime ?? appointment.appointmentTime, 5);
    const doc = doctor !== undefined ? (doctor && isObjectId(doctor) ? doctor : null) : (appointment.doctor?.toString() || null);
    const treat = treatment !== undefined ? treatment : appointment.treatment.toString();
    const branchId = branch !== undefined ? (branch && isObjectId(branch) ? branch : null) : (appointment.branch?.toString() || null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || d < dateInIndia()) return res.status(400).json({ error: 'Choose a valid future date.' });
    const activeTreatment = isObjectId(treat) ? await Treatment.exists(departmentFilter(department, { _id: treat, active: true })) : null;
    if (!activeTreatment && treat !== appointment.treatment?.toString()) return res.status(400).json({ error: 'Choose an active treatment/service.' });
    const activeDoctor = doc ? await Doctor.exists(departmentFilter(department, { _id: doc, active: true })) : true;
    if (doc && !activeDoctor && doc !== appointment.doctor?.toString()) return res.status(400).json({ error: 'Choose an active clinician.' });
    const activeBranchCount = await Branch.countDocuments(departmentFilter(department, { active: true }));
    if (activeBranchCount && !branchId) return res.status(400).json({ error: 'Choose a clinic branch before saving this appointment.' });
    const branchDoc = branchId ? await Branch.findOne(departmentFilter(department, { _id: branchId, active: true })).lean() : null;
    if (branchId && !branchDoc) return res.status(400).json({ error: 'Choose an active branch.' });
    const settings = branchDoc || await getSettings(department);
    if (!buildTimeSlots(settings, d).includes(t)) return res.status(400).json({ error: 'Choose a time within the selected branch hours.' });
    if (branchDoc?.doctorIds?.length && doc && !branchDoc.doctorIds.some(id => id.toString() === doc)) return res.status(400).json({ error: 'This clinician is not assigned to the selected branch.' });
    if (branchDoc?.serviceIds?.length && !branchDoc.serviceIds.some(id => id.toString() === treat)) return res.status(400).json({ error: 'This service is not offered at the selected branch.' });
    appointment.appointmentDate = d; appointment.appointmentTime = t; appointment.doctor = doc; appointment.treatment = treat;
    appointment.branch = branchDoc?._id || null; appointment.branchName = branchDoc?.name || ''; appointment.branchAddress = branchDoc?.address || '';
  }
  const reactivatingAppointment = ['pending', 'confirmed'].includes(appointment.status) && !['pending', 'confirmed'].includes(previousStatus);
  const changingOccupiedStatus = status !== undefined && status !== previousStatus && ['pending', 'confirmed'].includes(appointment.status);
  if (['pending', 'confirmed'].includes(appointment.status) && (schedulingChanged || reactivatingAppointment || changingOccupiedStatus)) {
    const taken = await findTakenSlots(appointment.appointmentDate, appointment.doctor?.toString() || null, appointment._id, department, appointment.branch?.toString() || null);
    if (taken.has(appointment.appointmentTime)) return res.status(409).json({ error: 'That slot is already booked. Choose another time or clinician.' });
  }
  await appointment.save();
  res.json(await Appointment.findById(appointment._id).populate('treatment', 'name durationMinutes priceFrom').populate('doctor', 'name role whatsapp phone').populate('branch', 'name area address phone whatsapp').populate('patient', 'name phone email whatsappConsent').lean());
}));

adminApi.post('/appointments/:id/whatsapp', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid appointment.' });
  const department = getDepartment(req.query.department);
  const appointment = await Appointment.findOne(departmentFilter(department, { _id: req.params.id })).populate('treatment', 'name').populate('doctor', 'name').populate('branch', 'name area openingTime closingTime slotMinutes workingDays').populate('patient').lean();
  if (!appointment) return res.status(404).json({ error: 'Appointment not found.' });
  const stage = req.body.stage;
  const allowedStages = ['first_visit', 'follow_up_1', 'follow_up_2', 'final_visit', 'completed'];
  if (!allowedStages.includes(stage)) return res.status(400).json({ error: 'Choose a valid patient journey stage.' });
  const followUpDate = safeText(req.body.followUpDate, 10);
  const followUpTime = safeText(req.body.followUpTime, 5);
  const settings = await getSettings(department);
  if (stage !== 'completed' && (!followUpDate || !followUpTime)) return res.status(400).json({ error: 'Choose the next follow-up date and time before recording this visit stage.' });
  if (followUpDate && (!/^\d{4}-\d{2}-\d{2}$/.test(followUpDate) || followUpDate < dateInIndia())) return res.status(400).json({ error: 'Choose a valid follow-up date.' });
  if (followUpDate && followUpTime && !/^\d{2}:\d{2}$/.test(followUpTime)) return res.status(400).json({ error: 'Follow-up time must use HH:MM.' });
  if (stage === 'completed' && !settings?.googleReviewUrl) return res.status(400).json({ error: 'Add the clinic Google Business Profile review link in Admin → Clinic Settings before sending the treatment-completed message.' });
  if (stage !== 'completed') {
    const branchSchedule = appointment.branch || settings;
    if (!buildTimeSlots(branchSchedule, followUpDate).includes(followUpTime)) return res.status(400).json({ error: "The follow-up time is outside this branch opening hours or the selected day is closed." });
  }
  await Appointment.findByIdAndUpdate(appointment._id, {
    $set: {
      journeyStage: stage,
      journeyStageUpdatedAt: new Date(),
      ...(followUpDate !== undefined ? { nextFollowUpDate: followUpDate } : {}),
      ...(followUpTime !== undefined ? { nextFollowUpTime: followUpTime } : {}),
      ...(stage === 'completed' ? { status: 'completed', nextFollowUpDate: '', nextFollowUpTime: '' } : { status: 'confirmed' })
    }
  });
  const updated = await Appointment.findById(appointment._id).populate('treatment', 'name').populate('doctor', 'name').populate('branch', 'name').populate('patient', 'name phone whatsappConsent').lean();
  const completed = stage === 'completed';
  const stageLabel = ({ first_visit: 'First visit completed', follow_up_1: 'Follow-up 1', follow_up_2: 'Follow-up 2', final_visit: 'Final / review visit', completed: 'Treatment completed' })[stage];
  const date = followUpDate || updated.appointmentDate;
  const time = followUpTime || updated.appointmentTime;
  const params = [
    updated.patientName,
    settings?.clinicName || 'R Dental Clinic',
    updated.treatment?.name || 'your treatment',
    stageLabel,
    formatWhatsAppDate(date),
    formatWhatsAppTime(time),
    updated.branch?.name || updated.branchName || 'the clinic',
    ...(completed ? [settings?.googleReviewUrl || ''] : [])
  ];
  let notification = { status: 'failed', error: 'The appointment stage was saved, but the WhatsApp attempt did not complete.' };
  try {
    notification = await sendWhatsAppTemplate({
      department, appointment: updated, patient: updated.patient,
      recipient: updated.phone, recipientRole: 'patient',
      event: completed ? 'treatment_completed' : 'journey_update',
      templateName: completed ? (process.env.WHATSAPP_TEMPLATE_TREATMENT_COMPLETED || 'rdental_treatment_completed') : (process.env.WHATSAPP_TEMPLATE_VISIT_UPDATE || 'rdental_visit_update'),
      parameters: params, requireConsent: true
    });
  } catch (notificationError) {
    // Appointment stage and follow-up date are already persisted. A provider/logging
    // outage must not make staff think the stage update failed or invite duplicates.
    console.error('[whatsapp] Journey notification failed after stage was saved:', notificationError?.message || notificationError);
    notification = { status: 'failed', error: 'The visit stage was saved, but WhatsApp could not complete the send attempt.' };
  }
  const visitStages = ['first_visit', 'follow_up_1', 'follow_up_2', 'final_visit'];
  if (visitStages.includes(stage)) {
    const claim = await Appointment.updateOne({ _id: appointment._id, recordedVisitStages: { $ne: stage } }, { $addToSet: { recordedVisitStages: stage } });
    if (claim.modifiedCount) await Patient.updateOne({ _id: updated.patient?._id }, { $inc: { visitCount: 1 }, $set: { lastVisitAt: new Date() } });
  }
  await Appointment.findByIdAndUpdate(appointment._id, { $push: { journeyHistory: { stage, note: safeText(req.body.note, 500), followUpDate: completed ? '' : followUpDate, followUpTime: completed ? '' : followUpTime, whatsappStatus: notification.status, updatedBy: req.admin?.email || 'admin' } } });
  const latest = await Appointment.findById(appointment._id).populate('treatment', 'name durationMinutes priceFrom').populate('doctor', 'name role whatsapp phone').populate('branch', 'name area address').populate('patient', 'name phone email whatsappConsent').lean();
  res.json({ appointment: latest, notification });
}));

adminApi.get('/whatsapp/status', (_req, res) => res.json({ configured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID), templates: {
  patientBooking: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_PATIENT || 'rdental_appointment_patient',
  doctorBooking: process.env.WHATSAPP_TEMPLATE_APPOINTMENT_DOCTOR || 'rdental_appointment_doctor',
  visitUpdate: process.env.WHATSAPP_TEMPLATE_VISIT_UPDATE || 'rdental_visit_update',
  treatmentCompleted: process.env.WHATSAPP_TEMPLATE_TREATMENT_COMPLETED || 'rdental_treatment_completed'
} }));
adminApi.get('/whatsapp/logs', asyncHandler(async (req, res) => {
  const query = {};
  if (isObjectId(req.query.appointmentId)) query.appointment = req.query.appointmentId;
  const rows = await WhatsAppLog.find(departmentFilter(getDepartment(req.query.department), query)).sort({ createdAt: -1 }).limit(150).lean();
  res.json(rows);
}));

adminApi.get('/patients', asyncHandler(async (req, res) => {
  const department = getDepartment(req.query.department);
  const search = safeText(req.query.search, 120);
  const query = search ? { $or: [
    { name: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    { phone: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    { email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } }
  ] } : {};
  const rows = await Patient.find(departmentFilter(department, query)).sort({ updatedAt: -1 }).limit(400).lean();
  const ids = rows.map(row => row._id);
  const visits = await Appointment.find({ patient: { $in: ids } }).sort({ appointmentDate: -1, appointmentTime: -1 }).limit(1200).populate('treatment', 'name').populate('doctor', 'name').populate('branch', 'name area').lean();
  const grouped = new Map();
  for (const visit of visits) { const key = visit.patient.toString(); const list = grouped.get(key) || []; if (list.length < 5) list.push(visit); grouped.set(key, list); }
  res.json(rows.map(row => ({ ...row, recentVisits: grouped.get(row._id.toString()) || [] })));
}));
adminApi.patch('/patients/:id', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid patient record.' });
  const department = getDepartment(req.query.department);
  const patient = await Patient.findOne(departmentFilter(department, { _id: req.params.id }));
  if (!patient) return res.status(404).json({ error: 'Patient record not found.' });
  if (req.body.whatsappConsent !== undefined) {
    const consent = Boolean(req.body.whatsappConsent);
    patient.whatsappConsent = consent;
    patient.whatsappConsentAt = consent ? new Date() : null;
    await Appointment.updateMany(
      departmentFilter(department, { patient: patient._id }),
      { $set: { whatsappConsent: consent, whatsappConsentAt: consent ? patient.whatsappConsentAt : null } }
    );
  }
  await patient.save();
  res.json(patient);
}));

adminApi.post('/patients/walk-in', asyncHandler(async (req, res) => {
  const department = getDepartment(req.query.department);
  const name = validateRequired(req.body.name, 'Patient name', 120);
  const phone = validateRequired(req.body.phone, 'Patient phone', 35);
  const treatmentId = req.body.treatment;
  if (!isObjectId(treatmentId)) return res.status(400).json({ error: 'Select a treatment/service for this walk-in patient.' });
  const treatment = await Treatment.findOne(departmentFilter(department, { _id: treatmentId, active: true })).lean();
  if (!treatment) return res.status(400).json({ error: 'Selected treatment/service is not active.' });
  const doctorId = req.body.doctor && isObjectId(req.body.doctor) ? req.body.doctor : null;
  const doctor = doctorId ? await Doctor.findOne(departmentFilter(department, { _id: doctorId, active: true })).lean() : null;
  if (doctorId && !doctor) return res.status(400).json({ error: 'Selected clinician is not active.' });
  const branchId = req.body.branch && isObjectId(req.body.branch) ? req.body.branch : null;
  const activeBranchCount = await Branch.countDocuments(departmentFilter(department, { active: true }));
  if (activeBranchCount && !branchId) return res.status(400).json({ error: 'Choose the branch where this walk-in visit is taking place.' });
  const branch = branchId ? await Branch.findOne(departmentFilter(department, { _id: branchId, active: true })).lean() : null;
  if (branchId && !branch) return res.status(400).json({ error: 'Selected branch is not active.' });
  if (branch?.doctorIds?.length && doctorId && !branch.doctorIds.some(id => id.toString() === doctorId)) return res.status(400).json({ error: 'The selected clinician is not assigned to this branch.' });
  if (branch?.serviceIds?.length && !branch.serviceIds.some(id => id.toString() === treatmentId)) return res.status(400).json({ error: 'The selected service is not offered at this branch.' });
  const patient = await upsertPatient({ department, name, phone, email: req.body.email, dateOfBirth: req.body.dateOfBirth, gender: req.body.gender, notes: req.body.notes, source: 'walk_in', whatsappConsent: req.body.whatsappConsent === true });
  const visitDate = safeText(req.body.appointmentDate, 10) || dateInIndia();
  const timeNow = new Intl.DateTimeFormat('en-GB', { timeZone: process.env.CLINIC_TIME_ZONE || 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date());
  const visitTime = safeText(req.body.appointmentTime, 5) || timeNow;
  const nextFollowUpDate = safeText(req.body.nextFollowUpDate, 10);
  const nextFollowUpTime = safeText(req.body.nextFollowUpTime, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(visitDate) || !/^\d{2}:\d{2}$/.test(visitTime)) return res.status(400).json({ error: 'Enter a valid visit date and time.' });
  if (nextFollowUpDate && (!/^\d{4}-\d{2}-\d{2}$/.test(nextFollowUpDate) || nextFollowUpDate < visitDate)) return res.status(400).json({ error: 'The follow-up date must be on or after the visit date.' });
  if (nextFollowUpTime && !/^\d{2}:\d{2}$/.test(nextFollowUpTime)) return res.status(400).json({ error: 'The follow-up time must use HH:MM.' });
  const appointment = await Appointment.create({
    department, patient: patient._id, patientName: name, phone, email: safeText(req.body.email, 180).toLowerCase(),
    treatment: treatment._id, doctor: doctor?._id || null, branch: branch?._id || null, branchName: branch?.name || '', branchAddress: branch?.address || '',
    appointmentDate: visitDate, appointmentTime: visitTime, patientMessage: safeText(req.body.patientMessage, 1200),
    whatsappConsent: req.body.whatsappConsent === true, whatsappConsentAt: req.body.whatsappConsent === true ? new Date() : null,
    status: 'completed', journeyStage: 'first_visit', journeyStageUpdatedAt: new Date(), nextFollowUpDate, nextFollowUpTime, source: 'walk_in',
    journeyHistory: [{ stage: 'first_visit', note: 'Walk-in visit recorded by clinic staff.', followUpDate: nextFollowUpDate, followUpTime: nextFollowUpTime, updatedBy: req.admin?.email || 'admin' }], recordedVisitStages: ['first_visit']
  });
  await Patient.updateOne({ _id: patient._id }, { $inc: { visitCount: 1 }, $set: { lastVisitAt: new Date() } });
  const full = await Appointment.findById(appointment._id).populate('treatment', 'name').populate('doctor', 'name role').populate('branch', 'name area address').lean();
  res.status(201).json({ patient, appointment: full });
}));

adminApi.get('/branches', asyncHandler(async (req, res) => res.json(await Branch.find(departmentFilter(getDepartment(req.query.department))).sort({ sortOrder: 1, name: 1 }).populate('doctorIds', 'name role').populate('serviceIds', 'name category').lean())));
adminApi.post('/branches', asyncHandler(async (req, res) => {
  const department = getDepartment(req.query.department);
  const branchData = normalizeBranch(req.body, {}, department);
  const doctorCount = branchData.doctorIds.length ? await Doctor.countDocuments(departmentFilter(department, { _id: { $in: branchData.doctorIds } })) : 0;
  const serviceCount = branchData.serviceIds.length ? await Treatment.countDocuments(departmentFilter(department, { _id: { $in: branchData.serviceIds } })) : 0;
  if (doctorCount !== branchData.doctorIds.length || serviceCount !== branchData.serviceIds.length) return res.status(400).json({ error: 'Choose clinicians and services belonging to this department.' });
  const row = await Branch.create(branchData);
  res.status(201).json(await Branch.findById(row._id).populate('doctorIds', 'name role').populate('serviceIds', 'name category').lean());
}));
adminApi.patch('/branches/:id', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid branch.' });
  const department = getDepartment(req.query.department);
  const row = await Branch.findOne(departmentFilter(department, { _id: req.params.id }));
  if (!row) return res.status(404).json({ error: 'Branch not found.' });
  const branchData = normalizeBranch(req.body, row.toObject(), department);
  const doctorCount = branchData.doctorIds.length ? await Doctor.countDocuments(departmentFilter(department, { _id: { $in: branchData.doctorIds } })) : 0;
  const serviceCount = branchData.serviceIds.length ? await Treatment.countDocuments(departmentFilter(department, { _id: { $in: branchData.serviceIds } })) : 0;
  if (doctorCount !== branchData.doctorIds.length || serviceCount !== branchData.serviceIds.length) return res.status(400).json({ error: 'Choose clinicians and services belonging to this department.' });
  Object.assign(row, branchData);
  await row.save();
  res.json(await Branch.findById(row._id).populate('doctorIds', 'name role').populate('serviceIds', 'name category').lean());
}));
adminApi.delete('/branches/:id', asyncHandler(async (req, res) => {
  if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid branch.' });
  const row = await Branch.findOneAndUpdate(departmentFilter(getDepartment(req.query.department), { _id: req.params.id }), { active: false }, { new: true });
  if (!row) return res.status(404).json({ error: 'Branch not found.' });
  res.json({ ok: true });
}));

adminApi.get('/doctors', asyncHandler(async (req, res) => res.json(await Doctor.find(departmentFilter(getDepartment(req.query.department))).sort({ sortOrder: 1, createdAt: -1 }).lean())));
adminApi.post('/doctors', asyncHandler(async (req, res) => { const doc = await Doctor.create(normalizeDoctor(req.body, {}, getDepartment(req.query.department))); res.status(201).json(doc); }));
adminApi.patch('/doctors/:id', asyncHandler(async (req, res) => { if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid dentist.' }); const doc = await Doctor.findOne(departmentFilter(getDepartment(req.query.department), { _id: req.params.id })); if (!doc) return res.status(404).json({ error: 'Clinician not found.' }); Object.assign(doc, normalizeDoctor(req.body, doc.toObject(), getDepartment(req.query.department))); await doc.save(); res.json(doc); }));
adminApi.delete('/doctors/:id', asyncHandler(async (req, res) => { if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid dentist.' }); const doc = await Doctor.findOneAndUpdate(departmentFilter(getDepartment(req.query.department), { _id: req.params.id }), { active: false }, { new: true }); if (!doc) return res.status(404).json({ error: 'Clinician not found.' }); res.json({ ok: true }); }));

adminApi.get('/services', asyncHandler(async (req, res) => res.json(await Treatment.find(departmentFilter(getDepartment(req.query.department))).sort({ sortOrder: 1, createdAt: -1 }).lean())));
adminApi.post('/services', asyncHandler(async (req, res) => { const doc = await Treatment.create(normalizeTreatment(req.body, {}, getDepartment(req.query.department))); res.status(201).json(doc); }));
adminApi.patch('/services/:id', asyncHandler(async (req, res) => { if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid treatment.' }); const doc = await Treatment.findOne(departmentFilter(getDepartment(req.query.department), { _id: req.params.id })); if (!doc) return res.status(404).json({ error: 'Treatment not found.' }); Object.assign(doc, normalizeTreatment(req.body, doc.toObject(), getDepartment(req.query.department))); await doc.save(); res.json(doc); }));
adminApi.delete('/services/:id', asyncHandler(async (req, res) => { if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid treatment.' }); const doc = await Treatment.findOneAndUpdate(departmentFilter(getDepartment(req.query.department), { _id: req.params.id }), { active: false }, { new: true }); if (!doc) return res.status(404).json({ error: 'Treatment not found.' }); res.json({ ok: true }); }));

adminApi.get('/faqs', asyncHandler(async (req, res) => res.json(await Faq.find(departmentFilter(getDepartment(req.query.department))).sort({ sortOrder: 1, createdAt: -1 }).lean())));
adminApi.post('/faqs', asyncHandler(async (req, res) => { const question = validateRequired(req.body.question, 'Question', 240); const answer = validateRequired(req.body.answer, 'Answer', 1800); res.status(201).json(await Faq.create({ department: getDepartment(req.query.department), question, answer, active: req.body.active !== false, sortOrder: Number(req.body.sortOrder || 0) })); }));
adminApi.patch('/faqs/:id', asyncHandler(async (req, res) => { if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid FAQ.' }); const update = {}; if (req.body.question !== undefined) update.question = validateRequired(req.body.question, 'Question', 240); if (req.body.answer !== undefined) update.answer = validateRequired(req.body.answer, 'Answer', 1800); if (req.body.active !== undefined) update.active = Boolean(req.body.active); if (req.body.sortOrder !== undefined) update.sortOrder = Number(req.body.sortOrder || 0); const row = await Faq.findOneAndUpdate(departmentFilter(getDepartment(req.query.department), { _id: req.params.id }), update, { new: true, runValidators: true }); if (!row) return res.status(404).json({ error: 'FAQ not found.' }); res.json(row); }));
adminApi.delete('/faqs/:id', asyncHandler(async (req, res) => { const row = await Faq.findOneAndDelete(departmentFilter(getDepartment(req.query.department), { _id: req.params.id })); if (!row) return res.status(404).json({ error: 'FAQ not found.' }); res.json({ ok: true }); }));

adminApi.get('/reviews', asyncHandler(async (req, res) => res.json(await Review.find(departmentFilter(getDepartment(req.query.department))).sort({ sortOrder: 1, createdAt: -1 }).lean())));
adminApi.post('/reviews', asyncHandler(async (req, res) => { const patientName = validateRequired(req.body.patientName, 'Patient name', 120); const quote = validateRequired(req.body.quote, 'Review', 800); res.status(201).json(await Review.create({ department: getDepartment(req.query.department), patientName, quote, treatmentLabel: safeText(req.body.treatmentLabel, 120), rating: Math.max(1, Math.min(5, Number(req.body.rating || 5))), published: req.body.published !== false, sortOrder: Number(req.body.sortOrder || 0) })); }));
adminApi.patch('/reviews/:id', asyncHandler(async (req, res) => { if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid review.' }); const update = {}; for (const key of ['patientName', 'quote', 'treatmentLabel']) if (req.body[key] !== undefined) update[key] = safeText(req.body[key], key === 'quote' ? 800 : 180); if (req.body.rating !== undefined) update.rating = Math.max(1, Math.min(5, Number(req.body.rating))); if (req.body.published !== undefined) update.published = Boolean(req.body.published); if (req.body.sortOrder !== undefined) update.sortOrder = Number(req.body.sortOrder || 0); const row = await Review.findOneAndUpdate(departmentFilter(getDepartment(req.query.department), { _id: req.params.id }), update, { new: true, runValidators: true }); if (!row) return res.status(404).json({ error: 'Review not found.' }); res.json(row); }));
adminApi.delete('/reviews/:id', asyncHandler(async (req, res) => { const row = await Review.findOneAndDelete(departmentFilter(getDepartment(req.query.department), { _id: req.params.id })); if (!row) return res.status(404).json({ error: 'Review not found.' }); res.json({ ok: true }); }));

adminApi.patch('/settings', asyncHandler(async (req, res) => {
  const allowed = ['clinicName', 'shortName', 'tagline', 'heroTitle', 'heroDescription', 'heroImage', 'phone', 'whatsapp', 'email', 'address', 'city', 'openingTime', 'closingTime', 'slotMinutes', 'workingDays', 'hoursLabel', 'mapUrl', 'instagram', 'facebook', 'aboutTitle', 'aboutDescription', 'googleReviewUrl', 'whatsappTemplateFirstVisit', 'whatsappTemplateFollowUp1', 'whatsappTemplateFollowUp2', 'whatsappTemplateFinalVisit', 'whatsappTemplateCompleted', 'servicesHeading', 'servicesDescription', 'galleryHeading', 'galleryDescription', 'faqHeading', 'faqDescription', 'careStep1Title', 'careStep1Description', 'careStep2Title', 'careStep2Description', 'careStep3Title', 'careStep3Description'];
  const update = {};
  for (const key of allowed) {
    if (req.body[key] === undefined) continue;
    if (['openingTime', 'closingTime'].includes(key) && !/^\d{2}:\d{2}$/.test(String(req.body[key]))) return res.status(400).json({ error: `${key} must use HH:MM format.` });
    if (['heroImage'].includes(key)) update[key] = safeHttpsUrl(req.body[key], 'Hero image URL', true);
    else if (['mapUrl', 'instagram', 'facebook', 'googleReviewUrl'].includes(key)) update[key] = safeHttpsUrl(req.body[key], key);
    else if (key === 'slotMinutes') update[key] = Math.max(15, Math.min(120, Number(req.body[key])));
    else if (key === 'workingDays') update[key] = Array.isArray(req.body[key]) ? [...new Set(req.body[key].map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))] : [1, 2, 3, 4, 5, 6];
    else update[key] = typeof req.body[key] === 'string' ? safeText(req.body[key], 1800) : req.body[key];
  }
  const department = getDepartment(req.query.department);
  const settingsKey = department === 'skin' ? 'skin' : 'main';
  const row = await ClinicSettings.findOneAndUpdate({ key: settingsKey }, { $set: { ...update, department }, $setOnInsert: { key: settingsKey } }, { new: true, upsert: true, runValidators: true });
  res.json(row);
}));

const storage = multer.diskStorage({ destination: uploadTempDir, filename: (_req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${path.extname(file.originalname).toLowerCase()}`) });
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg']);
const uploader = multer({ storage, limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 }, fileFilter: (_req, file, cb) => { if (!allowedMime.has(file.mimetype)) { const error = new Error('Upload a JPG, PNG, WebP, GIF, AVIF, MP4, WebM, MOV or OGG file.'); error.status = 400; return cb(error); } cb(null, true); } });
adminApi.get('/media', asyncHandler(async (req, res) => res.json((await Media.find(departmentFilter(getDepartment(req.query.department))).sort({ sortOrder: 1, createdAt: -1 }).lean()).map(mediaPublic))));
adminApi.post('/media/upload', uploader.single('file'), asyncHandler(async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Choose an image or video to upload.' });
  if (!gridFS) { fs.rmSync(file.path, { force: true }); return res.status(503).json({ error: 'Media storage is not ready.' }); }
  try {
    const isVideo = file.mimetype.startsWith('video/');
    const title = safeText(req.body.title || path.parse(file.originalname).name, 180) || 'Clinic media';
    const uploadStream = gridFS.openUploadStream(path.basename(file.filename), { contentType: file.mimetype, metadata: { title, type: isVideo ? 'video' : 'image', originalName: safeText(file.originalname, 180) } });
    await new Promise((resolve, reject) => {
      const read = fs.createReadStream(file.path);
      read.on('error', reject); uploadStream.on('error', reject); uploadStream.on('finish', resolve); read.pipe(uploadStream);
    });
    const media = await Media.create({ department: getDepartment(req.query.department), title, type: isVideo ? 'video' : 'image', description: safeText(req.body.description, 600), fileId: uploadStream.id, mimeType: file.mimetype, size: file.size, featured: req.body.featured === 'true', active: true, sortOrder: Number(req.body.sortOrder || 0) });
    res.status(201).json(mediaPublic(media));
  } finally { fs.rmSync(file.path, { force: true }); }
}));
adminApi.post('/media/url', asyncHandler(async (req, res) => {
  const title = validateRequired(req.body.title, 'Media title', 180);
  const url = validateRequired(req.body.url, 'Media URL', 1000);
  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).json({ error: 'Enter a valid HTTPS media URL.' }); }
  if (parsed.protocol !== 'https:') return res.status(400).json({ error: 'Media URLs must use HTTPS.' });
  const type = req.body.type === 'video' ? 'video' : 'image';
  const row = await Media.create({ department: getDepartment(req.query.department), title, type, url, thumbnailUrl: safeText(req.body.thumbnailUrl, 700), description: safeText(req.body.description, 600), featured: req.body.featured === true || req.body.featured === 'true', active: true, sortOrder: Number(req.body.sortOrder || 0) });
  res.status(201).json(mediaPublic(row));
}));
adminApi.patch('/media/:id', asyncHandler(async (req, res) => { if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid media item.' }); const row = await Media.findOne(departmentFilter(getDepartment(req.query.department), { _id: req.params.id })); if (!row) return res.status(404).json({ error: 'Media not found.' }); if (req.body.title !== undefined) row.title = validateRequired(req.body.title, 'Title', 180); if (req.body.description !== undefined) row.description = safeText(req.body.description, 600); if (req.body.featured !== undefined) row.featured = Boolean(req.body.featured); if (req.body.active !== undefined) row.active = Boolean(req.body.active); if (req.body.sortOrder !== undefined) row.sortOrder = Number(req.body.sortOrder || 0); await row.save(); res.json(mediaPublic(row)); }));
adminApi.delete('/media/:id', asyncHandler(async (req, res) => { if (!isObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid media item.' }); const row = await Media.findOneAndDelete(departmentFilter(getDepartment(req.query.department), { _id: req.params.id })); if (!row) return res.status(404).json({ error: 'Media not found.' }); if (row.fileId && gridFS) await gridFS.delete(row.fileId).catch(() => {}); res.json({ ok: true }); }));

app.use('/api/admin', adminApi);

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: `That file is too large. The maximum upload size is ${MAX_UPLOAD_MB} MB.` });
  const status = err.status || (err.name === 'ValidationError' ? 400 : err.name === 'CastError' ? 400 : 500);
  if (status >= 500) console.error('[api error]', err.message);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server. Please try again.' : err.message });
});

const distDir = path.join(rootDir, 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir, { maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0, index: false }));
  app.get('/', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  app.get('/{*splat}', (req, res, next) => { if (req.path === '/api' || req.path.startsWith('/api/')) return next(); res.sendFile(path.join(distDir, 'index.html')); });
}

async function seedDatabaseOnce() {
  // A shared lease prevents simultaneous Vercel cold starts from inserting demo content twice.
  const locks = mongoose.connection.db.collection('aurelia_bootstrap_locks');
  const now = new Date();
  try {
    const lock = await locks.findOneAndUpdate(
      { _id: 'seed-v2', expiresAt: { $lte: now } },
      { $set: { owner: seedOwner, status: 'running', expiresAt: new Date(Date.now() + 120_000) } },
      { upsert: true, returnDocument: 'after', includeResultMetadata: false }
    );
    if (lock?.owner === seedOwner) {
      try {
        await seedDatabase();
        await locks.updateOne({ _id: 'seed-v2', owner: seedOwner }, { $set: { status: 'done', expiresAt: new Date('9999-12-31T00:00:00.000Z') } });
        return;
      } catch (error) {
        await locks.updateOne({ _id: 'seed-v2', owner: seedOwner }, { $set: { status: 'failed', expiresAt: new Date() } }).catch(() => {});
        throw error;
      }
    }
  } catch (error) {
    // Concurrent upserts can race on the unique _id. The other invocation owns the lease.
    if (error?.code !== 11000) throw error;
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const existing = await locks.findOne({ _id: 'seed-v2' });
    if (existing?.status === 'done') return;
    if (existing?.expiresAt && existing.expiresAt <= new Date()) return seedDatabaseOnce();
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error('Initial clinic setup is taking longer than expected. Retry the request in a moment.');
}

async function migrateExistingAppointmentsToPatients() {
  const cursor = Appointment.find({ $or: [{ patient: null }, { patient: { $exists: false } }] }).select('_id department patientName phone email source appointmentDate status journeyStage').cursor();
  for await (const appointment of cursor) {
    const department = getDepartment(appointment.department);
    const patient = await upsertPatient({
      department, name: appointment.patientName, phone: appointment.phone, email: appointment.email,
      source: appointment.source === 'walk_in' ? 'walk_in' : 'website', whatsappConsent: false
    });
    const visitStages = ['first_visit', 'follow_up_1', 'follow_up_2', 'final_visit'];
    const isActualVisit = appointment.source === 'walk_in' || appointment.status === 'completed' || visitStages.includes(appointment.journeyStage);
    await Appointment.updateOne({ _id: appointment._id, $or: [{ patient: null }, { patient: { $exists: false } }] }, {
      $set: { patient: patient._id, department, ...(isActualVisit ? { recordedVisitStages: ['first_visit'] } : {}) }
    });
    if (isActualVisit) await Patient.updateOne({ _id: patient._id }, { $inc: { visitCount: 1 }, $set: { lastVisitAt: new Date(`${appointment.appointmentDate || dateInIndia()}T12:00:00`) } });
  }
}

export async function ensureDatabase() {
  if (mongoose.connection.readyState === 1 && app.locals.databaseReady) return;
  if (initializationPromise) return initializationPromise;
  initializationPromise = (async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri || /YOUR_USERNAME|YOUR_PASSWORD|YOUR_CLUSTER/.test(uri)) {
      throw new Error('MONGODB_URI is not configured. Set the MongoDB Atlas connection string in the deployment environment.');
    }
    if (process.env.NODE_ENV === 'production') {
      if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET.includes('replace-this')) throw new Error('Set a random JWT_SECRET of at least 32 characters in production.');
      if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12 || process.env.ADMIN_PASSWORD === 'ChangeMe123!') throw new Error('Set ADMIN_EMAIL and a unique ADMIN_PASSWORD of at least 12 characters in production.');
    }
    try {
      console.log('[startup] Connecting to MongoDB Atlas...');
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 12000, connectTimeoutMS: 12000, maxPoolSize: 10, minPoolSize: 0, maxIdleTimeMS: 45_000, family: 4, autoIndex: process.env.NODE_ENV !== 'production' });
      }
      await mongoose.connection.db.admin().command({ ping: 1 });
      await Promise.all([Doctor, Treatment, Appointment, Branch, Patient, WhatsAppLog, Media, Faq, Review, ClinicSettings, Admin].map(model => model.createIndexes()));
      gridFS = new GridFSBucket(mongoose.connection.db, { bucketName: 'aureliaMedia' });
      await seedDatabaseOnce();
      await migrateExistingAppointmentsToPatients();
      app.locals.databaseReady = true;
      console.log('[startup] MongoDB Atlas connected; clinic content is ready.');
    } catch (err) {
      console.error('[startup] Database initialization failed:', err.message);
      if (err.message.includes('Authentication failed')) console.error('[startup] Check Atlas username/password and URL-encode reserved password characters.');
      if (err.message.includes('IP') || err.name === 'MongoServerSelectionError') console.error('[startup] Check Atlas Network Access, URI and network connectivity.');
      throw err;
    }
  })().then(() => {
    // Keep concurrent cold-start requests sharing this promise, but allow a new
    // initialization attempt if the MongoDB connection is later dropped.
    initializationPromise = null;
  }).catch(error => {
    initializationPromise = null;
    throw error;
  });
  return initializationPromise;
}

async function start() {
  try {
    await ensureDatabase();
    const server = app.listen(PORT, '0.0.0.0', () => console.log(`[startup] API listening at http://localhost:${PORT} (MongoDB Atlas connected)`));
    const graceful = async signal => { console.log(`[shutdown] ${signal}`); server.close(); await mongoose.disconnect(); process.exit(0); };
    process.on('SIGINT', () => graceful('SIGINT'));
    process.on('SIGTERM', () => graceful('SIGTERM'));
  } catch (err) {
    console.error('\n[startup] Aurelia could not start.');
    console.error(err.message);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) start();
