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

const WORKFLOW_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'first_visit', label: 'First visit completed' },
  { value: 'follow_up_1', label: 'Follow-up 1' },
  { value: 'follow_up_2', label: 'Follow-up 2' },
  { value: 'final_visit', label: 'Final / review visit' },
  { value: 'completed', label: 'Treatment completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

function getWorkflowValue(row) {
  if (row.status === 'cancelled') return 'cancelled';
  if (row.status === 'completed' || row.journeyStage === 'completed') return 'completed';
  if (row.journeyStage && row.journeyStage !== 'new_request') return row.journeyStage;
  return row.status === 'confirmed' ? 'confirmed' : 'pending';
}

export function AdminAppointments({ refreshKey, notify, department = 'dental' }) {
  const [rows, setRows] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [workflowSavingId, setWorkflowSavingId] = useState('');
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [followUpFilter, setFollowUpFilter] = useState('');
  const [whatsappLogs, setWhatsappLogs] = useState([]);
  const [editNote, setEditNote] = useState('');
  const [schedule, setSchedule] = useState(null);
  const [slotOptions, setSlotOptions] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpTime, setFollowUpTime] = useState('');
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [clinicSettings, setClinicSettings] = useState(department === 'skin' ? SKIN_DEFAULT_SETTINGS : DEFAULT_SETTINGS);
  const [messageStage, setMessageStage] = useState('first_visit');

  const chooseAppointment = row => {
    setSelected(row);
    setMessageStage(row.journeyStage && row.journeyStage !== 'new_request' ? row.journeyStage : 'first_visit');
    setFollowUpDate(row.nextFollowUpDate || '');
    setFollowUpTime(row.nextFollowUpTime || '');
    setEditNote(row.adminNotes || '');
    setSchedule({
      appointmentDate: row.appointmentDate || '',
      appointmentTime: row.appointmentTime || '',
      doctor: row.doctor?._id || '',
      treatment: row.treatment?._id || '',
      branch: row.branch?._id || ''
    });
    setError('');
  };
  const load = async () => {
    setError('');
    try {
      const query = new URLSearchParams();
      if (statusFilter !== 'all') query.set('workflowStage', statusFilter);
      if (dateFilter) query.set('date', dateFilter);
      if (branchFilter) query.set('branchId', branchFilter);
      if (followUpFilter) query.set('followUpDate', followUpFilter);
      const items = await api(
        `/admin/appointments${query.size ? `?${query.toString()}` : ""}`
      );
      
      if (!Array.isArray(items)) {
        throw new Error(
          "The appointments API returned an unexpected response. " +
          "Check Vercel API routing and function logs."
        );
      }
      
      setRows(items);
      if (selected) {
        const updated = items.find(item => item._id === selected._id);
        if (updated) chooseAppointment(updated);
      }
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [refreshKey, statusFilter, dateFilter, branchFilter, followUpFilter, department]);
  useEffect(() => {
    Promise.all([api('/admin/doctors'), api('/admin/services'), api('/settings'), api('/admin/branches')])
      
    .then(([doctorRows, serviceRows, settings, branchRows]) => {
      if (
        !Array.isArray(doctorRows) ||
        !Array.isArray(serviceRows) ||
        !Array.isArray(branchRows)
      ) {
        throw new Error(
          "The doctors or services API returned an unexpected response. " +
          "Check Vercel API routing."
        );
      }
    
      setDoctors(doctorRows);
      setServices(serviceRows);
      setBranches(branchRows.filter(branch => branch.active !== false));
    
      setClinicSettings({ ...(department === 'skin' ? SKIN_DEFAULT_SETTINGS : DEFAULT_SETTINGS), ...settings });
    })
    .catch(error => setError(error.message));
  }, [refreshKey, department]);
  useEffect(() => {
    if (!selected?._id) { setWhatsappLogs([]); return; }
    let active = true;
    api(`/admin/whatsapp/logs?appointmentId=${encodeURIComponent(selected._id)}`)
      .then(result => { if (active) setWhatsappLogs(Array.isArray(result) ? result : []); })
      .catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [selected?._id, selected?.journeyHistory?.length]);
  useEffect(() => {
    const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (!schedule?.appointmentDate || schedule.appointmentDate < today) { setSlotOptions([]); return; }
    let mounted = true;
    setError('');
    setSlotsLoading(true);
    const params = new URLSearchParams({ date: schedule.appointmentDate });
    if (schedule.doctor) params.set('doctorId', schedule.doctor);
    if (schedule.branch) params.set('branchId', schedule.branch);
    api(`/availability?${params.toString()}`)
      .then(result => { if (mounted) setSlotOptions(result.slots || []); })
      .catch(e => { if (mounted) { setSlotOptions([]); setError(e.message); } })
      .finally(() => { if (mounted) setSlotsLoading(false); });
    return () => { mounted = false; };
  }, [schedule?.appointmentDate, schedule?.doctor, schedule?.branch]);
  const filtered = useMemo(() => (rows || []).filter(row => {
    const q = search.toLowerCase();
    const match = !q || [row.patientName, row.phone, row.email, row.treatment?.name, row.doctor?.name, row.branch?.name, row.journeyStage].some(v => String(v || '').toLowerCase().includes(q));
    return match && (!dateFilter || row.appointmentDate === dateFilter);
  }), [rows, search, dateFilter]);
  const updateWorkflowStatus = async (row, workflowStage, followUp = {}) => {
    if (!row?._id || !workflowStage) return;
    setWorkflowSavingId(row._id);
    setError('');
    try {
      const payload = { workflowStage };
      if (followUp.followUpDate !== undefined) payload.nextFollowUpDate = followUp.followUpDate;
      if (followUp.followUpTime !== undefined) payload.nextFollowUpTime = followUp.followUpTime;
      const changed = await api(`/admin/appointments/${row._id}`, {
        method: 'PATCH',
        body: json(payload)
      });
      setRows(prev => (prev || []).map(item => item._id === row._id ? { ...item, ...changed } : item));
      setSelected(prev => prev?._id === row._id ? { ...prev, ...changed } : prev);
      setMessageStage(changed.journeyStage && changed.journeyStage !== 'new_request' ? changed.journeyStage : 'first_visit');
      setFollowUpDate(changed.nextFollowUpDate || '');
      setFollowUpTime(changed.nextFollowUpTime || '');
      notify(`Appointment status updated: ${WORKFLOW_OPTIONS.find(item => item.value === workflowStage)?.label || workflowStage}.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setWorkflowSavingId('');
    }
  };

  const saveJourneyStage = async () => {
    if (!selected) return;
    await updateWorkflowStatus(selected, messageStage, {
      followUpDate: messageStage === 'completed' ? '' : followUpDate,
      followUpTime: messageStage === 'completed' ? '' : followUpTime
    });
  };

  const saveNotes = async () => {
    if (!selected) return;
    setSaving(true); setError('');
    try {
      const changed = await api(`/admin/appointments/${selected._id}`, { method: 'PATCH', body: json({ adminNotes: editNote }) });
      setRows(prev => (prev || []).map(item => item._id === selected._id ? { ...item, ...changed } : item));
      setSelected({ ...selected, ...changed });
      notify('Internal note saved.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  const saveSchedule = async e => {
    e.preventDefault();
    if (!selected || !schedule) return;
    setSaving(true); setError('');
    try {
      const changed = await api(`/admin/appointments/${selected._id}`, {
        method: 'PATCH',
        body: json({ ...schedule, doctor: schedule.doctor || null, branch: schedule.branch || null })
      });
      setRows(prev => (prev || []).map(item => item._id === selected._id ? { ...item, ...changed } : item));
      chooseAppointment(changed);
      notify('Appointment details updated.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  const openWhatsApp = row => {
    if (!row.whatsappConsent) { setError('This patient has not opted in to WhatsApp updates. Do not start a clinic-initiated WhatsApp message until permission is recorded.'); return; }
    const n = waNumber(row.phone);
    const stage = row.journeyStage && row.journeyStage !== 'new_request' ? row.journeyStage : (selected?._id === row._id ? messageStage : 'new_request');
    const templateKey = ({ first_visit: 'whatsappTemplateFirstVisit', follow_up_1: 'whatsappTemplateFollowUp1', follow_up_2: 'whatsappTemplateFollowUp2', final_visit: 'whatsappTemplateFinalVisit', completed: 'whatsappTemplateCompleted' })[stage];
    const defaultTemplates = {
      new_request: 'Hello {patientName}, we have received your appointment request at {clinicName} for {serviceName} on {date} at {time}. Our team will contact you to confirm.',
      first_visit: 'Hello {patientName}, thank you for visiting {clinicName}. We hope your {serviceName} consultation went well. Please contact us if you have any questions.',
      follow_up_1: 'Hello {patientName}, this is {clinicName}. We are checking in after your recent visit for {serviceName}. Please let us know how you are doing or if you need any assistance.',
      follow_up_2: 'Hello {patientName}, we are following up regarding your care plan at {clinicName}. Please let us know if you would like help arranging your next visit.',
      final_visit: 'Hello {patientName}, a reminder from {clinicName} about your final/review visit for {serviceName}. Please reply here if you need to adjust your appointment.',
      completed: 'Hello {patientName}, thank you for choosing {clinicName} for your care. We appreciate your trust. Please share your experience here: {googleReviewUrl}. We look forward to caring for you again.'
    };
    const template = (templateKey && clinicSettings[templateKey]) || defaultTemplates[stage] || defaultTemplates.new_request;
    const values = { patientName: row.patientName || 'there', clinicName: clinicSettings.clinicName || 'R Dental Clinic', serviceName: row.treatment?.name || 'your appointment', doctorName: row.doctor?.name || 'our clinician', date: dateLabel(row.nextFollowUpDate || row.appointmentDate), time: timeLabel(row.nextFollowUpTime || row.appointmentTime), department: department === 'skin' ? 'Skin & Hair' : 'Dental', googleReviewUrl: clinicSettings.googleReviewUrl || 'our Google Business Profile' };
    const message = template.replace(/\{(patientName|clinicName|serviceName|doctorName|date|time|department|googleReviewUrl)\}/g, (_, key) => values[key] || '');
    if (!n) { setError('This patient phone number cannot be used to create a WhatsApp link.'); return; }
    window.open(`https://wa.me/${n}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };
  const sendJourneyMessage = async () => {
    if (!selected) return;
    if (['first_visit', 'follow_up_1', 'follow_up_2', 'final_visit'].includes(messageStage) && (!followUpDate || !followUpTime)) {
      setError('Choose the next visit date and time before sending a follow-up message.');
      return;
    }
    setSendingWhatsApp(true); setError('');
    try {
      const result = await api(`/admin/appointments/${selected._id}/whatsapp`, {
        method: 'POST',
        body: json({ stage: messageStage, followUpDate, followUpTime, note: editNote })
      });
      const changed = result.appointment;
      setRows(prev => (prev || []).map(item => item._id === selected._id ? { ...item, ...changed } : item));
      setSelected(changed);
      setMessageStage(changed.journeyStage || messageStage);
      if (result.notification?.status === 'accepted') {
        notify('WhatsApp message accepted by Meta. Delivery status will update through the webhook.');
      } else if (result.notification?.status === 'skipped_unconfigured') {
        openWhatsApp(changed);
        setError('WhatsApp Cloud API is not configured. A draft was opened in WhatsApp; review it and press Send manually.');
      } else if (result.notification?.status === 'skipped_no_consent') {
        setError('This patient has not opted in to WhatsApp updates. Do not send a WhatsApp message until consent is recorded.');
      } else if (result.notification?.status === 'failed') {
        setError(`WhatsApp could not accept the message: ${result.notification.error || 'Provider error'}`);
      } else {
        setError(result.notification?.error || `Message status: ${result.notification?.status || 'unknown'}`);
      }
      api(`/admin/whatsapp/logs?appointmentId=${encodeURIComponent(selected._id)}`)
        .then(recentLogs => setWhatsappLogs(Array.isArray(recentLogs) ? recentLogs : []))
        .catch(() => {});
    } catch (e) { setError(e.message); }
    finally { setSendingWhatsApp(false); }
  };
  const keepCurrentSlot = Boolean(selected && schedule && schedule.appointmentDate === selected.appointmentDate && schedule.doctor === (selected.doctor?._id || '') && schedule.branch === (selected.branch?._id || ''));
  const availableScheduleTimes = [...new Set([...(keepCurrentSlot ? [selected.appointmentTime] : []), ...slotOptions])].sort();
  if (!rows && !error) return <SectionLoading/>;
  return <div className="appointments-page">
    <div className="admin-page-intro"><div><span className="admin-eyebrow">PATIENT RELATIONSHIPS</span><h2>Every visit starts here.</h2><p>Review requests, assign a dentist, update appointment details and keep the patient informed.</p></div><div className="appointments-intro-stats"><span><b>{(rows || []).length}</b> requests loaded</span><span className="pending-legend"><i/> Pending review</span></div></div>
    {error && <div className="inline-admin-error"><CircleHelp size={15}/>{error}</div>}
    <div className="admin-panel appointments-panel">
      <div className="appointments-toolbar"><div className="admin-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search patient, treatment, phone…"/></div><div className="appointments-filters"><span className="filter-icon"><Filter size={15}/></span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter by appointment workflow status"><option value="all">All statuses</option>{WORKFLOW_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{branches.length > 0 && <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} aria-label="Filter by branch"><option value="">All branches</option>{branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name}</option>)}</select>}<input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} aria-label="Filter by appointment date"/><input type="date" value={followUpFilter} onChange={e => setFollowUpFilter(e.target.value)} aria-label="Filter by follow-up date" title="Follow-up date"/><button className="admin-icon-button" onClick={load} title="Refresh"><Activity size={16}/></button></div></div>
      <div className="appointments-table-wrap"><table className="admin-table"><thead><tr><th>PATIENT</th><th>SERVICE / CLINICIAN</th><th>DATE & TIME</th><th>STATUS</th><th>CONTACT</th><th/></tr></thead><tbody>
        {filtered.map(row => <tr key={row._id} className={selected?._id === row._id ? 'selected-row' : ''} onClick={() => chooseAppointment(row)}><td><div className="patient-cell"><span className="patient-avatar">{row.patientName.slice(0,1).toUpperCase()}</span><span><strong>{row.patientName}</strong><small>{row.email || row.phone}</small></span></div></td><td><strong>{row.treatment?.name || 'Treatment unavailable'}</strong><small className="table-subtext">{row.doctor?.name || 'No preference'}{row.branch?.name ? ` · ${row.branch.name}` : row.branchName ? ` · ${row.branchName}` : ''}</small><small className="table-subtext">{row.journeyStage?.replaceAll('_', ' ') || 'new request'}{row.nextFollowUpDate ? ` · Follow-up ${dateLabel(row.nextFollowUpDate)}` : ''}</small></td><td><strong>{dateLabel(row.appointmentDate)}</strong><small className="table-subtext">{timeLabel(row.appointmentTime)}</small></td><td><label className="appointment-workflow-editor" onClick={e => e.stopPropagation()}>
          <span className="sr-only">Update status for {row.patientName}</span>
          <select
            aria-label={`Update status for ${row.patientName}`}
            value={getWorkflowValue(row)}
            disabled={workflowSavingId === row._id}
            onChange={e => updateWorkflowStatus(row, e.target.value)}
          >
            {WORKFLOW_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          {workflowSavingId === row._id && <small className="workflow-saving-note">Saving…</small>}
        </label></td><td><button className="whatsapp-mini" title="Message patient on WhatsApp" onClick={e => { e.stopPropagation(); openWhatsApp(row); }}><MessageCircle size={15}/> WhatsApp</button></td><td><button className="admin-icon-button" onClick={e => { e.stopPropagation(); chooseAppointment(row); }}><ArrowUpRight size={16}/></button></td></tr>)}
      </tbody></table>{filtered.length === 0 && <EmptyState icon={CalendarCheck} title="No appointments match" description="Try another status, date or search term. New online requests will appear here."/>}</div>
      <div className="table-footer"><span>Showing {filtered.length} of {rows?.length || 0} appointment requests</span><span>Patient details are visible to administrators only.</span></div>
    </div>
    {selected && schedule && <div className="appointment-detail-panel">
      <div className="detail-panel-head"><div><span className="admin-eyebrow">APPOINTMENT DETAILS</span><h3>{selected.patientName}</h3></div><button className="admin-icon-button" onClick={() => { setSelected(null); setSchedule(null); }} aria-label="Close appointment details"><X size={18}/></button></div>
      <div className="appointment-detail-grid"><div><span>{department === 'skin' ? 'SERVICE' : 'TREATMENT'}</span><strong>{selected.treatment?.name || '—'}</strong></div><div><span>CLINICIAN</span><strong>{selected.doctor?.name || 'No preference'}</strong></div><div><span>DATE</span><strong>{dateLabel(selected.appointmentDate)}</strong></div><div><span>TIME</span><strong>{timeLabel(selected.appointmentTime)}</strong></div><div><span>BRANCH</span><strong>{selected.branch?.name || selected.branchName || 'Not specified'}</strong></div><div><span>WHATSAPP CONSENT</span><strong>{selected.whatsappConsent ? 'Opted in' : 'Not recorded'}</strong></div><div><span>PHONE</span><strong>{selected.phone}</strong></div><div><span>EMAIL</span><strong>{selected.email || 'Not provided'}</strong></div>{selected.referralSource && <div><span>HOW THEY FOUND US</span><strong>{selected.referralSource}</strong></div>}</div>
      {selected.patientMessage && <div className="patient-message-note"><span>PATIENT MESSAGE</span><p>{selected.patientMessage}</p></div>}
      <form className="appointment-reschedule" onSubmit={saveSchedule}>
        <div className="appointment-reschedule-head"><div><span className="admin-eyebrow">SCHEDULING</span><h4>Update appointment details</h4></div><span>Availability checked before saving</span></div>
        <div className="appointment-reschedule-grid">
          <label className="field"><span>{department === 'skin' ? 'Service' : 'Treatment'}</span><select required value={schedule.treatment} onChange={e => setSchedule(prev => ({ ...prev, treatment: e.target.value }))}><option value="">{department === 'skin' ? 'Choose service' : 'Choose treatment'}</option>{services.map(service => <option key={service._id} value={service._id}>{service.name}{service.active === false ? ' (hidden)' : ''}</option>)}</select></label>
          <label className="field"><span>{department === 'skin' ? 'Assigned dermatologist' : 'Assigned dentist'}</span><select value={schedule.doctor} onChange={e => setSchedule(prev => ({ ...prev, doctor: e.target.value, appointmentTime: '' }))}><option value="">No preference / unassigned</option>{doctors.map(doctor => <option key={doctor._id} value={doctor._id}>{doctor.name}{doctor.active === false ? ' (hidden)' : ''}</option>)}</select></label>
          {branches.length > 0 && <label className="field"><span>Clinic branch</span><select required value={schedule.branch} onChange={e => setSchedule(prev => ({ ...prev, branch: e.target.value, doctor: '', appointmentTime: '' }))}><option value="">Choose branch</option>{branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name} · {branch.area}</option>)}</select></label>}
          <label className="field"><span>Date</span><input required type="date" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)} value={schedule.appointmentDate} onChange={e => setSchedule(prev => ({ ...prev, appointmentDate: e.target.value, appointmentTime: '' }))}/></label>
          <label className="field"><span>Available time</span><select required disabled={!schedule.appointmentDate || slotsLoading} value={schedule.appointmentTime} onChange={e => setSchedule(prev => ({ ...prev, appointmentTime: e.target.value }))}><option value="">{slotsLoading ? 'Checking availability…' : availableScheduleTimes.length ? 'Choose a time' : 'No slots available'}</option>{availableScheduleTimes.map(slot => <option value={slot} key={slot}>{timeLabel(slot)}</option>)}</select></label>
        </div>
        <div className="appointment-reschedule-footer"><span><ShieldCheck size={15}/> Changes save to the live booking record.</span><button className="admin-button primary" disabled={saving || slotsLoading || !schedule.appointmentTime}>{saving ? <LoaderCircle size={15} className="spin"/> : <Save size={15}/>} Save appointment details</button></div>
      </form>
      <label className="field admin-notes-field"><span>Internal team note</span><textarea rows="2" value={editNote} onChange={e => setEditNote(e.target.value)} placeholder="Record follow-up or scheduling notes…"/></label>
      <div className="appointment-stage-control appointment-followup-controls">
        <label className="field"><span>Patient journey stage</span><select value={messageStage === 'new_request' ? 'first_visit' : messageStage} onChange={e => { const nextStage = e.target.value; setMessageStage(nextStage); if (nextStage === 'completed') { setFollowUpDate(''); setFollowUpTime(''); } }}><option value="first_visit">First visit completed</option><option value="follow_up_1">Follow-up 1</option><option value="follow_up_2">Follow-up 2</option><option value="final_visit">Final / review visit</option><option value="completed">Treatment completed</option></select></label>
        <label className="field"><span>Next visit / follow-up date</span><input type="date" min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)} value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}/></label>
        <label className="field"><span>Next visit / follow-up time</span><input type="time" value={followUpTime} onChange={e => setFollowUpTime(e.target.value)}/></label>
        <div className="appointment-workflow-actions">
          <button type="button" className="admin-button secondary" onClick={saveJourneyStage} disabled={workflowSavingId === selected._id || saving || (messageStage !== 'completed' && ['first_visit','follow_up_1','follow_up_2','final_visit'].includes(messageStage) && (!followUpDate || !followUpTime))}>
            {workflowSavingId === selected._id ? <LoaderCircle size={15} className="spin"/> : <Save size={15}/>} Save status
          </button>
          <button type="button" className="admin-button whatsapp-action" onClick={sendJourneyMessage} disabled={sendingWhatsApp || saving || (messageStage !== 'completed' && ['first_visit','follow_up_1','follow_up_2','final_visit'].includes(messageStage) && (!followUpDate || !followUpTime))}>
            {sendingWhatsApp ? <LoaderCircle size={15} className="spin"/> : <MessageCircle size={15}/>} {sendingWhatsApp ? 'Sending…' : 'Save & send WhatsApp'}
          </button>
        </div>
      </div>
      <div className="appointment-journey-note"><Clock3 size={14}/><span>Current stage: <strong>{(selected.journeyStage || 'new_request').replaceAll('_', ' ')}</strong>{selected.nextFollowUpDate ? ` · Next follow-up ${dateLabel(selected.nextFollowUpDate)} ${timeLabel(selected.nextFollowUpTime)}` : ''}. WhatsApp messages require patient consent and an approved template.</span></div>
      <section className="appointment-communication-history"><div className="appointment-history-heading"><div><span className="admin-eyebrow">PATIENT CARE TIMELINE</span><h4>Visit & treatment history</h4></div><span>{selected.journeyHistory?.length || 0} updates</span></div>{selected.journeyHistory?.length ? <ol>{[...selected.journeyHistory].reverse().map((event, index) => <li key={`${event.createdAt || index}-${event.stage}`}><span className="appointment-history-dot"/><div><strong>{(event.stage || 'visit update').replaceAll('_', ' ')}</strong><small>{event.createdAt ? new Date(event.createdAt).toLocaleString('en-IN') : 'Recorded'}</small>{event.note && <p>{event.note}</p>}{event.followUpDate && <small>Next visit: {dateLabel(event.followUpDate)} {timeLabel(event.followUpTime)}</small>}</div><StatusPill status={event.whatsappStatus === 'accepted' || event.whatsappStatus === 'delivered' || event.whatsappStatus === 'read' ? 'confirmed' : event.whatsappStatus === 'failed' ? 'cancelled' : 'pending'}/></li>)}</ol> : <p>No visit history has been recorded yet.</p>}</section>
      <section className="appointment-communication-history whatsapp-delivery-history"><div className="appointment-history-heading"><div><span className="admin-eyebrow">MESSAGE AUDIT</span><h4>WhatsApp delivery log</h4></div><span>{whatsappLogs.length} messages</span></div>{whatsappLogs.length ? <ol>{whatsappLogs.map(log => <li key={log._id}><span className="appointment-history-dot"/><div><strong>{(log.event || 'message').replaceAll('_', ' ')} · {log.recipientRole}</strong><small>{log.recipient} · {new Date(log.createdAt).toLocaleString('en-IN')}</small>{log.error && <p>{log.error}</p>}</div><span className={`whatsapp-log-status status-${log.status}`}>{(log.status || 'unknown').replaceAll('_', ' ')}</span></li>)}</ol> : <p>No WhatsApp messages have been attempted for this appointment.</p>}<small className="whatsapp-log-footnote">“Accepted” means Meta accepted the request. Sent, delivered and read statuses are updated only when Meta sends a webhook event.</small></section>
      <div className="appointment-detail-actions">
        <label className="appointment-detail-status-field"><span>Current appointment status</span><select aria-label="Current appointment status" value={getWorkflowValue(selected)} disabled={workflowSavingId === selected._id} onChange={e => updateWorkflowStatus(selected, e.target.value)}>
          {WORKFLOW_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select></label>
        <button className="admin-button secondary" onClick={saveNotes} disabled={saving}><Save size={15}/> Save note</button>
      </div>
    </div>}
  </div>;
}
