import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const doctorSchema = new Schema({
  department: { type: String, enum: ['dental', 'skin'], default: 'dental', index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  role: { type: String, default: 'Consultant Dentist', trim: true, maxlength: 120 },
  phone: { type: String, default: '', trim: true, maxlength: 35 },
  whatsapp: { type: String, default: '', trim: true, maxlength: 35 },
  whatsappNotificationsEnabled: { type: Boolean, default: false },
  branchIds: [{ type: Schema.Types.ObjectId, ref: 'Branch' }],
  specialities: [{ type: String, trim: true, maxlength: 70 }],
  qualifications: { type: String, default: '', maxlength: 250 },
  experienceYears: { type: Number, min: 0, max: 80, default: 0 },
  image: { type: String, default: '' },
  bio: { type: String, default: '', maxlength: 1800 },
  philosophy: { type: String, default: '', maxlength: 500 },
  languages: [{ type: String, trim: true, maxlength: 60 }],
  availability: { type: String, default: 'By appointment', maxlength: 180 },
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });
doctorSchema.index({ department: 1, active: 1, featured: -1, sortOrder: 1 });

const treatmentSchema = new Schema({
  department: { type: String, enum: ['dental', 'skin'], default: 'dental', index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, default: 'General dentistry', maxlength: 80 },
  shortDescription: { type: String, required: true, maxlength: 260 },
  description: { type: String, default: '', maxlength: 1600 },
  durationMinutes: { type: Number, min: 10, max: 600, default: 30 },
  priceFrom: { type: Number, min: 0, default: 0 },
  sessions: { type: String, default: 'As advised after consultation', maxlength: 180 },
  recovery: { type: String, default: 'Your dentist will guide you', maxlength: 180 },
  features: [{ type: String, maxlength: 140 }],
  image: { type: String, default: '' },
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });
treatmentSchema.index({ department: 1, active: 1, featured: -1, sortOrder: 1 });

const branchSchema = new Schema({
  department: { type: String, enum: ['dental', 'skin'], default: 'dental', index: true },
  name: { type: String, required: true, trim: true, maxlength: 140 },
  slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
  area: { type: String, required: true, trim: true, maxlength: 120 },
  address: { type: String, required: true, trim: true, maxlength: 420 },
  city: { type: String, default: '', trim: true, maxlength: 120 },
  phone: { type: String, default: '', trim: true, maxlength: 35 },
  whatsapp: { type: String, default: '', trim: true, maxlength: 35 },
  email: { type: String, default: '', trim: true, lowercase: true, maxlength: 180 },
  mapUrl: { type: String, default: '', maxlength: 1000 },
  image: { type: String, default: '' },
  description: { type: String, default: '', maxlength: 700 },
  facilities: [{ type: String, trim: true, maxlength: 100 }],
  doctorIds: [{ type: Schema.Types.ObjectId, ref: 'Doctor' }],
  serviceIds: [{ type: Schema.Types.ObjectId, ref: 'Treatment' }],
  openingTime: { type: String, default: '09:00', match: /^\d{2}:\d{2}$/ },
  closingTime: { type: String, default: '18:00', match: /^\d{2}:\d{2}$/ },
  slotMinutes: { type: Number, min: 15, max: 120, default: 30 },
  workingDays: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
  hoursLabel: { type: String, default: 'Monday – Saturday · 9:00 AM – 6:00 PM', maxlength: 180 },
  active: { type: Boolean, default: true },
  featured: { type: Boolean, default: false },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });
branchSchema.index({ department: 1, slug: 1 }, { unique: true });
branchSchema.index({ department: 1, active: 1, featured: -1, sortOrder: 1 });

const patientSchema = new Schema({
  department: { type: String, enum: ['dental', 'skin'], default: 'dental', index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 35 },
  normalizedPhone: { type: String, required: true, trim: true, maxlength: 20 },
  email: { type: String, default: '', trim: true, lowercase: true, maxlength: 180 },
  dateOfBirth: { type: String, default: '', match: /^(?:\d{4}-\d{2}-\d{2})?$/ },
  gender: { type: String, default: '', enum: ['', 'female', 'male', 'other', 'prefer_not_to_say'] },
  notes: { type: String, default: '', maxlength: 1800 },
  source: { type: String, enum: ['website', 'walk_in', 'phone', 'referral', 'other'], default: 'website' },
  whatsappConsent: { type: Boolean, default: false },
  whatsappConsentAt: { type: Date, default: null },
  lastVisitAt: { type: Date, default: null },
  visitCount: { type: Number, min: 0, default: 0 }
}, { timestamps: true, versionKey: false });
patientSchema.index({ department: 1, normalizedPhone: 1 }, { unique: true });
patientSchema.index({ department: 1, updatedAt: -1 });

const whatsappLogSchema = new Schema({
  department: { type: String, enum: ['dental', 'skin'], default: 'dental', index: true },
  appointment: { type: Schema.Types.ObjectId, ref: 'Appointment', default: null, index: true },
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', default: null },
  recipient: { type: String, required: true, maxlength: 35 },
  recipientRole: { type: String, enum: ['patient', 'doctor', 'branch'], required: true },
  event: { type: String, enum: ['booking_confirmation', 'appointment_alert', 'journey_update', 'treatment_completed', 'manual'], required: true },
  templateName: { type: String, default: '', maxlength: 120 },
  status: { type: String, enum: ['accepted', 'sent', 'delivered', 'read', 'failed', 'skipped_no_consent', 'skipped_unconfigured', 'skipped_no_number'], default: 'failed', index: true },
  providerMessageId: { type: String, default: '', maxlength: 180 },
  error: { type: String, default: '', maxlength: 1000 },
  sentAt: { type: Date, default: null },
  metadata: { type: Schema.Types.Mixed, default: {} }
}, { timestamps: true, versionKey: false });
whatsappLogSchema.index({ department: 1, createdAt: -1 });

const journeyEventSchema = new Schema({
  stage: { type: String, enum: ['new_request', 'first_visit', 'follow_up_1', 'follow_up_2', 'final_visit', 'completed'], required: true },
  note: { type: String, default: '', maxlength: 500 },
  followUpDate: { type: String, default: '', match: /^(?:\d{4}-\d{2}-\d{2})?$/ },
  followUpTime: { type: String, default: '', match: /^(?:\d{2}:\d{2})?$/ },
  whatsappStatus: { type: String, default: '', maxlength: 40 },
  updatedBy: { type: String, default: 'system', maxlength: 180 },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const appointmentSchema = new Schema({
  department: { type: String, enum: ['dental', 'skin'], default: 'dental', index: true },
  patient: { type: Schema.Types.ObjectId, ref: 'Patient', default: null, index: true },
  patientName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, default: '', trim: true, lowercase: true, maxlength: 180 },
  phone: { type: String, required: true, trim: true, maxlength: 35 },
  treatment: { type: Schema.Types.ObjectId, ref: 'Treatment', required: true },
  doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', default: null },
  branch: { type: Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
  branchName: { type: String, default: '', maxlength: 140 },
  branchAddress: { type: String, default: '', maxlength: 420 },
  whatsappConsent: { type: Boolean, default: false },
  whatsappConsentAt: { type: Date, default: null },
  appointmentDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  appointmentTime: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
  patientMessage: { type: String, default: '', maxlength: 1200 },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending' },
  journeyStage: { type: String, enum: ['new_request', 'first_visit', 'follow_up_1', 'follow_up_2', 'final_visit', 'completed'], default: 'new_request' },
  nextFollowUpDate: { type: String, default: '', match: /^(?:\d{4}-\d{2}-\d{2})?$/ },
  nextFollowUpTime: { type: String, default: '', match: /^(?:\d{2}:\d{2})?$/ },
  journeyStageUpdatedAt: { type: Date, default: null },
  journeyHistory: { type: [journeyEventSchema], default: [] },
  recordedVisitStages: [{ type: String, enum: ['first_visit', 'follow_up_1', 'follow_up_2', 'final_visit'] }],
  adminNotes: { type: String, default: '', maxlength: 1200 },
  source: { type: String, enum: ['website', 'admin', 'walk_in'], default: 'website' },
  referralSource: { type: String, default: '', trim: true, maxlength: 80 }
}, { timestamps: true, versionKey: false });
appointmentSchema.index({ department: 1, appointmentDate: 1, appointmentTime: 1, doctor: 1, branch: 1, status: 1 });
appointmentSchema.index({ department: 1, patient: 1, createdAt: -1 });
appointmentSchema.index({ department: 1, nextFollowUpDate: 1, journeyStage: 1 });
appointmentSchema.index({ createdAt: -1 });

const mediaSchema = new Schema({
  department: { type: String, enum: ['dental', 'skin'], default: 'dental', index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  type: { type: String, enum: ['image', 'video'], required: true },
  description: { type: String, default: '', maxlength: 600 },
  url: { type: String, default: '' },
  thumbnailUrl: { type: String, default: '' },
  fileId: { type: Schema.Types.ObjectId, default: null },
  mimeType: { type: String, default: '' },
  size: { type: Number, default: 0 },
  featured: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });
mediaSchema.index({ department: 1, active: 1, type: 1, featured: -1, sortOrder: 1 });

const faqSchema = new Schema({
  department: { type: String, enum: ['dental', 'skin'], default: 'dental', index: true },
  question: { type: String, required: true, trim: true, maxlength: 240 },
  answer: { type: String, required: true, trim: true, maxlength: 1800 },
  active: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });
faqSchema.index({ department: 1, active: 1, sortOrder: 1 });

const reviewSchema = new Schema({
  department: { type: String, enum: ['dental', 'skin'], default: 'dental', index: true },
  patientName: { type: String, required: true, trim: true, maxlength: 120 },
  quote: { type: String, required: true, trim: true, maxlength: 800 },
  treatmentLabel: { type: String, default: 'Patient experience', maxlength: 120 },
  rating: { type: Number, min: 1, max: 5, default: 5 },
  published: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }
}, { timestamps: true, versionKey: false });
reviewSchema.index({ department: 1, published: 1, sortOrder: 1 });

const settingsSchema = new Schema({
  key: { type: String, default: 'main', unique: true },
  department: { type: String, enum: ['dental', 'skin'], default: 'dental', index: true },
  clinicName: { type: String, default: 'Aurelia Dental Studio', maxlength: 120 },
  shortName: { type: String, default: 'AURELIA', maxlength: 40 },
  tagline: { type: String, default: 'A more thoughtful kind of dentistry.', maxlength: 180 },
  heroTitle: { type: String, default: 'A little more care. A lot more confidence.', maxlength: 180 },
  heroDescription: { type: String, default: 'Modern dentistry, thoughtful people, and a calmer experience — from your first hello to your healthiest smile.', maxlength: 500 },
  heroImage: { type: String, default: '' },
  phone: { type: String, default: '+91 98765 43210', maxlength: 40 },
  whatsapp: { type: String, default: '919876543210', maxlength: 35 },
  email: { type: String, default: 'hello@aurelia.dental', maxlength: 180 },
  address: { type: String, default: 'Add clinic address in Admin Settings', maxlength: 320 },
  city: { type: String, default: 'Your City, India', maxlength: 120 },
  openingTime: { type: String, default: '09:00', match: /^\d{2}:\d{2}$/ },
  closingTime: { type: String, default: '18:00', match: /^\d{2}:\d{2}$/ },
  slotMinutes: { type: Number, min: 15, max: 120, default: 30 },
  workingDays: { type: [Number], default: [1, 2, 3, 4, 5, 6] },
  hoursLabel: { type: String, default: 'Monday – Saturday · 9:00 AM – 6:00 PM', maxlength: 180 },
  mapUrl: { type: String, default: '', maxlength: 1000 },
  instagram: { type: String, default: '', maxlength: 300 },
  facebook: { type: String, default: '', maxlength: 300 },
  aboutTitle: { type: String, default: 'Care that starts with listening.', maxlength: 180 },
  aboutDescription: { type: String, default: 'We believe good dentistry is about more than a healthy smile. It is about feeling heard, understanding your options, and knowing you are in thoughtful hands.', maxlength: 1000 },
  googleReviewUrl: { type: String, default: '', maxlength: 1000 },
  whatsappTemplateFirstVisit: { type: String, default: 'Hello {patientName}, thank you for visiting {clinicName}. We hope your {serviceName} consultation went well. Please contact us if you have any questions.', maxlength: 1200 },
  whatsappTemplateFollowUp1: { type: String, default: 'Hello {patientName}, this is {clinicName}. We are checking in after your recent visit for {serviceName}. Please let us know how you are doing or if you need any assistance.', maxlength: 1200 },
  whatsappTemplateFollowUp2: { type: String, default: 'Hello {patientName}, we are following up regarding your care plan at {clinicName}. Please let us know if you would like help arranging your next visit.', maxlength: 1200 },
  whatsappTemplateFinalVisit: { type: String, default: 'Hello {patientName}, a reminder from {clinicName} about your final/review visit for {serviceName}. Please reply here if you need to adjust your appointment.', maxlength: 1200 },
  whatsappTemplateCompleted: { type: String, default: 'Hello {patientName}, thank you for choosing {clinicName} for your care. We appreciate your trust. Please get in touch if you need further assistance.', maxlength: 1200 },
  servicesHeading: { type: String, default: 'Care that begins with understanding.', maxlength: 180 },
  servicesDescription: { type: String, default: 'Explore the consultation options currently published by the clinic.', maxlength: 700 },
  galleryHeading: { type: String, default: 'A closer look at our care.', maxlength: 180 },
  galleryDescription: { type: String, default: 'Clinic images, educational videos and clinician introductions are published by the team.', maxlength: 700 },
  faqHeading: { type: String, default: 'Questions are always welcome.', maxlength: 180 },
  faqDescription: { type: String, default: 'A few things patients often ask before a consultation.', maxlength: 700 },
  careStep1Title: { type: String, default: 'Listen & understand', maxlength: 120 },
  careStep1Description: { type: String, default: 'We discuss your concern, goals, relevant history and expectations.', maxlength: 400 },
  careStep2Title: { type: String, default: 'Assess & explain', maxlength: 120 },
  careStep2Description: { type: String, default: 'Your clinician explains findings, options, limitations, risks and costs.', maxlength: 400 },
  careStep3Title: { type: String, default: 'Plan & follow up', maxlength: 120 },
  careStep3Description: { type: String, default: 'You receive a care plan and guidance on review visits or aftercare.', maxlength: 400 }
}, { timestamps: true, versionKey: false });

const adminSchema = new Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin'], default: 'admin' },
  active: { type: Boolean, default: true },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

export const Doctor = model('Doctor', doctorSchema);
export const Treatment = model('Treatment', treatmentSchema);
export const Appointment = model('Appointment', appointmentSchema);
export const Branch = model('Branch', branchSchema);
export const Patient = model('Patient', patientSchema);
export const WhatsAppLog = model('WhatsAppLog', whatsappLogSchema);
export const Media = model('Media', mediaSchema);
export const Faq = model('Faq', faqSchema);
export const Review = model('Review', reviewSchema);
export const ClinicSettings = model('ClinicSettings', settingsSchema);
export const Admin = model('Admin', adminSchema);
