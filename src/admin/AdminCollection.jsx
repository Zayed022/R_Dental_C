import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Clock3, HeartHandshake, Instagram, MapPin, Menu, MessageCircle, Minus, Plus, Quote, ShieldCheck, Sparkles, Star,
  Smile, Stethoscope, Phone, Play, X, CircleCheck, ArrowUp, LoaderCircle, LayoutDashboard, CalendarCheck, Users,
  BriefcaseMedical, Images, Clapperboard, CircleHelp, Settings as SettingsIcon, LogOut, Search, Filter, MoreHorizontal,
  Pencil, Trash2, Eye, EyeOff, Upload, ExternalLink, Save, Activity, ClipboardList, FileText, Mail, Clock, Video,
  Image as ImageIcon, CheckCheck, UserRound, CalendarClock, Menu as MenuIcon, LockKeyhole, PlusCircle, Send
} from 'lucide-react';
import { api, json, money, dateLabel, timeLabel, waNumber } from '../api';
import { DEFAULT_SETTINGS, SKIN_DEFAULT_SETTINGS } from '../data/clinicDefaults';
import { ImageWithFallback, SectionEyebrow } from '../components/clinic/ClinicComponents';
import { StatusPill, SectionLoading, ErrorPanel, EmptyState, AdminModal } from './AdminUI';

const collectionConfig = {
  doctors: { title: 'Dentist profiles', singular: 'dentist', plural: 'dentists', endpoint: '/admin/doctors', icon: Users, description: 'Keep clinician biographies, qualifications and specialties current across the website.', fields: [
    ['name', 'Full name', 'text', true], ['role', 'Professional title', 'text', true], ['qualifications', 'Qualifications', 'text'], ['phone', 'Direct phone number', 'tel'], ['whatsapp', 'WhatsApp number · country code included', 'tel'], ['whatsappNotificationsEnabled', 'Clinician has agreed to receive WhatsApp booking alerts', 'checkbox'], ['experienceYears', 'Years of experience', 'number'], ['image', 'Portrait image URL', 'url'], ['specialities', 'Specialties · comma separated', 'text'], ['languages', 'Languages · comma separated', 'text'], ['availability', 'Clinic availability', 'text'], ['bio', 'Biography', 'textarea'], ['philosophy', 'Care philosophy quote', 'textarea'], ['featured', 'Feature on homepage', 'checkbox'], ['active', 'Visible on website', 'checkbox']
  ] },
  services: { title: 'Treatments & services', singular: 'treatment', plural: 'treatments', endpoint: '/admin/services', icon: BriefcaseMedical, description: 'Manage treatment descriptions, indicative pricing, duration and patient-friendly details.', fields: [
    ['name', 'Treatment name', 'text', true], ['category', 'Category', 'text'], ['shortDescription', 'Short description', 'textarea', true], ['description', 'Full treatment details', 'textarea'], ['durationMinutes', 'Typical duration · minutes', 'number'], ['priceFrom', 'Indicative starting price · INR', 'number'], ['sessions', 'Typical number of sessions', 'text'], ['recovery', 'Recovery / aftercare note', 'text'], ['features', 'What’s included · comma separated', 'text'], ['image', 'Card image URL', 'url'], ['featured', 'Feature on homepage', 'checkbox'], ['active', 'Visible on website', 'checkbox']
  ] },
  faqs: { title: 'Frequently asked questions', singular: 'FAQ', plural: 'FAQs', endpoint: '/admin/faqs', icon: CircleHelp, description: 'Answer common patient questions before they need to call the clinic.', fields: [ ['question', 'Question', 'textarea', true], ['answer', 'Answer', 'textarea', true], ['active', 'Visible on website', 'checkbox'] ] },
  reviews: { title: 'Patient reviews', singular: 'review', plural: 'reviews', endpoint: '/admin/reviews', icon: Quote, description: 'Publish only genuine patient comments for which the clinic has appropriate permission.', fields: [ ['patientName', 'Patient display name', 'text', true], ['treatmentLabel', 'Treatment / context label', 'text'], ['rating', 'Rating · 1 to 5', 'number'], ['quote', 'Review text', 'textarea', true], ['published', 'Published on website', 'checkbox'] ] }
};
function normaliseAdminRow(kind, row) {
  if (!row) return {};
  const copy = { ...row };
  if (kind === 'doctors') { copy.specialities = (row.specialities || []).join(', '); copy.languages = (row.languages || []).join(', '); copy.whatsappNotificationsEnabled = Boolean(row.whatsappNotificationsEnabled); }
  if (kind === 'services') copy.features = (row.features || []).join(', ');
  return copy;
}
function payloadForCollection(kind, form) {
  const payload = { ...form };
  if (kind === 'doctors') { payload.specialities = String(form.specialities || '').split(',').map(s => s.trim()).filter(Boolean); payload.languages = String(form.languages || '').split(',').map(s => s.trim()).filter(Boolean); payload.experienceYears = Number(form.experienceYears || 0); }
  if (kind === 'services') { payload.features = String(form.features || '').split(',').map(s => s.trim()).filter(Boolean); payload.durationMinutes = Number(form.durationMinutes || 30); payload.priceFrom = Number(form.priceFrom || 0); }
  if (kind === 'reviews') { payload.rating = Number(form.rating || 5); }
  return payload;
}
export function AdminCollection({ kind, refreshKey, notify, department = 'dental' }) {
  const baseConfig = collectionConfig[kind];
  const config = kind === 'doctors' && department === 'skin' ? { ...baseConfig, title: 'Dermatologist profiles', singular: 'dermatologist', plural: 'dermatologists' } : kind === 'services' && department === 'skin' ? { ...baseConfig, title: 'Skin & Hair services', singular: 'service', plural: 'services' } : baseConfig; const [rows, setRows] = useState(null); const [error, setError] = useState(''); const [modal, setModal] = useState(null); const [form, setForm] = useState({}); const [saving, setSaving] = useState(false); const [search, setSearch] = useState('');
  const load = async () => {
    setError("");
  
    try {
      const result = await api(config.endpoint);
  
      if (!Array.isArray(result)) {
        throw new Error(
          `The ${config.plural} API returned an unexpected response. ` +
          "Check Vercel API routing and function logs."
        );
      }
  
      setRows(result);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, [refreshKey, kind]);
  const openForm = row => { setModal(row ? 'edit' : 'create'); setForm(row ? normaliseAdminRow(kind, row) : (kind === 'doctors' ? { name: '', role: department === 'skin' ? 'Consultant Dermatologist' : 'Consultant Dentist', phone: '', whatsapp: '', whatsappNotificationsEnabled: false, specialities: '', languages: 'English, Hindi', active: true, featured: false, experienceYears: 0 } : kind === 'services' ? { name: '', category: department === 'skin' ? 'Dermatology consultation' : 'General dentistry', shortDescription: '', durationMinutes: 30, priceFrom: 0, features: '', active: true, featured: false } : kind === 'faqs' ? { question: '', answer: '', active: true } : { patientName: '', quote: '', treatmentLabel: 'Patient experience', rating: 5, published: false })); setError(''); };
  const save = async e => { e.preventDefault(); setSaving(true); setError(''); try { const payload = payloadForCollection(kind, form); const endpoint = modal === 'edit' ? `${config.endpoint}/${form._id}` : config.endpoint; const row = await api(endpoint, { method: modal === 'edit' ? 'PATCH' : 'POST', body: json(payload) }); setRows(prev => modal === 'edit' ? prev.map(item => item._id === row._id ? row : item) : [row, ...prev]); setModal(null); notify(`${config.singular[0].toUpperCase() + config.singular.slice(1)} ${modal === 'edit' ? 'updated' : 'created'}.`); } catch (e) { setError(e.message); } finally { setSaving(false); } };
  const remove = async row => { const label = row.name || row.question || row.patientName || config.singular; if (!window.confirm(`Remove “${label}” from the website?`)) return; try { await api(`${config.endpoint}/${row._id}`, { method: 'DELETE' }); await load(); notify(`${config.singular} removed.`); } catch (e) { setError(e.message); } };
  const visible = (rows || []).filter(row => JSON.stringify([row.name, row.role, row.question, row.patientName, row.category, row.shortDescription, row.quote]).toLowerCase().includes(search.toLowerCase()));
  if (!rows && !error) return <SectionLoading/>;
  return <div className="admin-collection-page"><div className="admin-page-intro"><div><span className="admin-eyebrow">WEBSITE CONTENT</span><h2>{config.title}</h2><p>{config.description}</p></div><button className="admin-button primary" onClick={() => openForm(null)}><Plus size={16}/> Add {config.singular}</button></div>{error && <div className="inline-admin-error"><CircleHelp size={15}/>{error}</div>}<div className="collection-toolbar"><div className="admin-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={`Search ${config.plural}…`}/></div><span className="collection-count">{visible.length} {config.plural}</span></div><div className={`admin-collection-grid collection-${kind}`}>{visible.map(row => <article className="collection-card" key={row._id}><div className="collection-card-top">{kind === 'doctors' ? <div className="collection-doctor-image"><ImageWithFallback src={row.image} alt={row.name}/></div> : kind === 'services' ? <div className="collection-service-image"><ImageWithFallback src={row.image} alt={row.name}/></div> : <span className="collection-default-icon"><config.icon size={22}/></span>}<div className="collection-card-actions"><button className="admin-icon-button" title="Edit" onClick={() => openForm(row)}><Pencil size={15}/></button><button className="admin-icon-button danger" title="Remove" onClick={() => remove(row)}><Trash2 size={15}/></button></div></div><div className="collection-card-body">{kind === 'doctors' && <><span className="collection-eyebrow">{row.role}</span><h3>{row.name}</h3><p>{row.qualifications || row.bio}</p><div className="collection-tags">{(row.specialities || []).slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div><div className="collection-meta"><span>{row.experienceYears} yrs experience</span>{row.whatsappNotificationsEnabled && <span className="doctor-alert-enabled">WhatsApp alerts on</span>}<StatusPill status={row.active ? 'confirmed' : 'cancelled'}/></div></>}{kind === 'services' && <><span className="collection-eyebrow">{row.category}</span><h3>{row.name}</h3><p>{row.shortDescription}</p><div className="collection-meta"><span>{row.durationMinutes} min · {money(row.priceFrom)}</span><StatusPill status={row.active ? 'confirmed' : 'cancelled'}/></div></>}{kind === 'faqs' && <><span className="collection-eyebrow">PATIENT INFORMATION</span><h3>{row.question}</h3><p>{row.answer}</p><div className="collection-meta"><StatusPill status={row.active ? 'confirmed' : 'cancelled'}/></div></>}{kind === 'reviews' && <><span className="review-stars">{'★'.repeat(row.rating || 5)}</span><p className="collection-review-quote">“{row.quote}”</p><h3>{row.patientName}</h3><div className="collection-meta"><span>{row.treatmentLabel}</span><StatusPill status={row.published ? 'confirmed' : 'pending'}/></div></>}</div></article>)}{visible.length === 0 && <EmptyState icon={config.icon} title={`No ${config.plural} found`} description="Add a new item or change your search." action={`Add ${config.singular}`} onAction={() => openForm(null)}/>}</div>{modal && <AdminModal title={`${modal === 'edit' ? 'Edit' : 'Add'} ${config.singular}`} subtitle={config.description} onClose={() => setModal(null)}><form className="admin-edit-form" onSubmit={save}><div className="admin-edit-grid">{config.fields.map(([key, label, type, required]) => <label key={key} className={`field ${type === 'textarea' ? 'field-full' : ''} ${type === 'checkbox' ? 'field-checkbox' : ''}`}><span>{label}{required && <b> *</b>}</span>{type === 'textarea' ? <textarea rows="3" required={required} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })}/> : type === 'checkbox' ? <input type="checkbox" checked={Boolean(form[key])} onChange={e => setForm({ ...form, [key]: e.target.checked })}/> : <input type={type} required={required} min={type === 'number' ? 0 : undefined} max={key === 'rating' ? 5 : undefined} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: type === 'number' ? e.target.value : e.target.value })}/>}</label>)}</div>{error && <div className="form-error"><CircleHelp size={15}/>{error}</div>}<div className="admin-modal-footer"><button type="button" className="admin-button secondary" onClick={() => setModal(null)}>Cancel</button><button className="admin-button primary" disabled={saving}>{saving ? <LoaderCircle size={15} className="spin"/> : <Save size={15}/>} {saving ? 'Saving…' : 'Save changes'}</button></div></form></AdminModal>}</div>;
}
