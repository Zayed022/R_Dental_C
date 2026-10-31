import React, { useEffect, useState } from 'react';
import { CalendarDays, CircleHelp, Clock3, MessageCircle, Plus, Search, ShieldCheck, UserPlus, Phone, MapPin, LoaderCircle } from 'lucide-react';
import { api, json, dateLabel, timeLabel } from '../api';
import { AdminModal, EmptyState, ErrorPanel, SectionLoading, StatusPill } from './AdminUI';

const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const timeLocal = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

export function AdminPatients({ refreshKey, notify, department = 'dental' }) {
  const [rows, setRows] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [branches, setBranches] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', dateOfBirth: '', gender: '', notes: '', treatment: '', doctor: '', branch: '',
    appointmentDate: todayLocal(), appointmentTime: timeLocal(), nextFollowUpDate: '', nextFollowUpTime: '',
    patientMessage: '', whatsappConsent: false
  });

  const load = async (query = search) => {
    setError('');
    try {
      const [patientRows, doctorRows, serviceRows, branchRows] = await Promise.all([
        api(`/admin/patients${query ? `?search=${encodeURIComponent(query)}` : ''}`),
        api('/admin/doctors'), api('/admin/services'), api('/admin/branches')
      ]);
      if (![patientRows, doctorRows, serviceRows, branchRows].every(Array.isArray)) throw new Error('Patient management returned an unexpected response.');
      setRows(patientRows); setDoctors(doctorRows); setServices(serviceRows); setBranches(branchRows.filter(item => item.active !== false));
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(''); }, [refreshKey, department]);
  useEffect(() => {
    const timer = setTimeout(() => load(search), 260);
    return () => clearTimeout(timer);
  }, [search]);

  const selectedBranch = branches.find(branch => branch._id === form.branch) || null;
  const visibleServices = selectedBranch?.serviceIds?.length ? services.filter(service => selectedBranch.serviceIds.some(linked => String(linked._id || linked) === service._id)) : services;
  const visibleDoctors = selectedBranch?.doctorIds?.length ? doctors.filter(doctor => selectedBranch.doctorIds.some(linked => String(linked._id || linked) === doctor._id)) : doctors;

  const updateWhatsAppConsent = async patient => {
    const nextConsent = !patient.whatsappConsent;
    if (nextConsent && !window.confirm(`Confirm that ${patient.name} has explicitly agreed to receive appointment and treatment updates from the clinic on WhatsApp.`)) return;
    if (!nextConsent && !window.confirm(`Revoke WhatsApp message permission for ${patient.name}?`)) return;
    try {
      await api(`/admin/patients/${patient._id}`, { method: 'PATCH', body: json({ whatsappConsent: nextConsent }) });
      await load(search);
      notify(nextConsent ? 'Patient WhatsApp opt-in recorded.' : 'Patient WhatsApp permission revoked.');
    } catch (e) { setError(e.message); }
  };

  const resetForm = () => setForm({
    name: '', phone: '', email: '', dateOfBirth: '', gender: '', notes: '', treatment: '', doctor: '', branch: '',
    appointmentDate: todayLocal(), appointmentTime: timeLocal(), nextFollowUpDate: '', nextFollowUpTime: '',
    patientMessage: '', whatsappConsent: false
  });
  const submitWalkIn = async event => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const result = await api('/admin/patients/walk-in', { method: 'POST', body: json({ ...form, doctor: form.doctor || null, branch: form.branch || null }) });
      setModal(false); resetForm(); await load('');
      notify(`Walk-in patient ${result.patient?.name || form.name} added and visit recorded.`);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (!rows && !error) return <SectionLoading/>;
  if (!rows && error) return <ErrorPanel error={error}/>;
  return <div className="admin-patients-page">
    <div className="admin-page-intro"><div><span className="admin-eyebrow">PATIENT RELATIONSHIPS</span><h2>Patient directory</h2><p>Website bookings and walk-in patients are kept together by department. Each patient profile shows their recent visit history.</p></div><button className="admin-button primary" onClick={() => { resetForm(); setModal(true); }}><UserPlus size={16}/> Add walk-in patient</button></div>
    {error && <div className="inline-admin-error"><CircleHelp size={15}/>{error}</div>}
    <div className="collection-toolbar"><div className="admin-search"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone or email…"/></div><span className="collection-count">{rows.length} patients</span></div>
    <div className="admin-patient-list">
      {rows.map(patient => <article className="admin-panel admin-patient-card" key={patient._id}>
        <div className="admin-patient-heading"><span className="patient-avatar">{(patient.name || 'P').slice(0, 1).toUpperCase()}</span><div className="admin-patient-main"><h3>{patient.name}</h3><span><Phone size={13}/>{patient.phone}</span>{patient.email && <span>{patient.email}</span>}</div><div className="admin-patient-badges"><span className="patient-source-badge">{patient.source === 'walk_in' ? 'Walk-in' : 'Website / clinic'}</span><StatusPill status={patient.whatsappConsent ? 'confirmed' : 'pending'}/><button className="admin-button secondary patient-consent-action" type="button" onClick={() => updateWhatsAppConsent(patient)}><MessageCircle size={13}/>{patient.whatsappConsent ? 'Revoke WhatsApp' : 'Record WhatsApp opt-in'}</button></div></div>
        <div className="admin-patient-stats"><span><strong>{patient.visitCount || 0}</strong> recorded visits</span><span><strong>{patient.lastVisitAt ? new Date(patient.lastVisitAt).toLocaleDateString('en-IN') : '—'}</strong> last visit</span><span><strong>{patient.whatsappConsent ? 'Opted in' : 'Not opted in'}</strong> WhatsApp updates</span></div>
        {patient.notes && <p className="admin-patient-notes">{patient.notes}</p>}
        <div className="admin-patient-visits"><strong>Recent visit history</strong>{patient.recentVisits?.length ? patient.recentVisits.map(visit => <div className="admin-patient-visit" key={visit._id}><span>{dateLabel(visit.appointmentDate)} · {timeLabel(visit.appointmentTime)}</span><span>{visit.treatment?.name || 'Visit'}{visit.doctor?.name ? ` · ${visit.doctor.name}` : ''}{visit.branch?.name ? ` · ${visit.branch.name}` : ''}</span><StatusPill status={visit.status}/><small>{visit.journeyStage?.replaceAll('_', ' ') || visit.source}</small></div>) : <p>No visit records yet.</p>}</div>
      </article>)}
      {rows.length === 0 && <EmptyState icon={UserPlus} title="No patients found" description="Patients are added automatically when they book online. You can also add patients who arrive directly at the clinic." action="Add walk-in patient" onAction={() => setModal(true)}/>}
    </div>
    {modal && <AdminModal wide title="Add walk-in patient" subtitle="Record a patient who arrived at the clinic without booking through the website. This creates a patient profile and a first-visit record." onClose={() => setModal(false)}>
      <form className="admin-edit-form" onSubmit={submitWalkIn}>
        <div className="admin-edit-grid">
          <label className="field"><span>Patient full name *</span><input required maxLength="120" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
          <label className="field"><span>Phone number *</span><input required type="tel" maxLength="35" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></label>
          <label className="field"><span>Email (optional)</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label>
          <label className="field"><span>Date of birth (optional)</span><input type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })}/></label>
          <label className="field"><span>Gender (optional)</span><select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}><option value="">Not specified</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></label>
          <label className="field"><span>Branch</span><select required={branches.length > 0} value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value, doctor: '', treatment: '' })}><option value="">{branches.length ? 'Choose branch' : 'No branches configured'}</option>{branches.map(branch => <option key={branch._id} value={branch._id}>{branch.name} · {branch.area}</option>)}</select>{selectedBranch && <small>{selectedBranch.address} · {selectedBranch.hoursLabel || `${selectedBranch.openingTime}–${selectedBranch.closingTime}`}</small>}</label>
          <label className="field"><span>Treatment / service *</span><select required value={form.treatment} onChange={e => setForm({ ...form, treatment: e.target.value })}><option value="">Choose service</option>{visibleServices.map(service => <option key={service._id} value={service._id}>{service.name}</option>)}</select></label>
          <label className="field"><span>Assigned clinician</span><select value={form.doctor} onChange={e => setForm({ ...form, doctor: e.target.value })}><option value="">Unassigned / no preference</option>{visibleDoctors.map(doctor => <option key={doctor._id} value={doctor._id}>{doctor.name}</option>)}</select></label>
          <label className="field"><span>Visit date *</span><input required type="date" value={form.appointmentDate} onChange={e => setForm({ ...form, appointmentDate: e.target.value })}/></label>
          <label className="field"><span>Visit time *</span><input required type="time" value={form.appointmentTime} onChange={e => setForm({ ...form, appointmentTime: e.target.value })}/></label>
          <label className="field"><span>Next follow-up date</span><input type="date" min={form.appointmentDate || todayLocal()} value={form.nextFollowUpDate} onChange={e => setForm({ ...form, nextFollowUpDate: e.target.value })}/></label>
          <label className="field"><span>Next follow-up time</span><input type="time" value={form.nextFollowUpTime} onChange={e => setForm({ ...form, nextFollowUpTime: e.target.value })}/></label>
          <label className="field field-full"><span>Clinical / internal notes</span><textarea rows="3" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Record only relevant care and scheduling notes. Avoid unnecessary sensitive details."/></label>
          <label className="field field-full"><span>Visit note (optional)</span><textarea rows="2" value={form.patientMessage} onChange={e => setForm({ ...form, patientMessage: e.target.value })} placeholder="Reason for visit or patient question…"/></label>
          <label className="field field-checkbox field-full"><input type="checkbox" checked={form.whatsappConsent} onChange={e => setForm({ ...form, whatsappConsent: e.target.checked })}/><span>Patient explicitly agreed to receive appointment reminders and treatment follow-ups from R Dental Clinic on WhatsApp.</span></label>
        </div>
        <p className="admin-form-note"><ShieldCheck size={15}/> If WhatsApp consent is not recorded, patient-initiated follow-up messages remain disabled for this profile.</p>
        {error && <div className="form-error"><CircleHelp size={15}/>{error}</div>}
        <div className="admin-modal-footer"><button type="button" className="admin-button secondary" onClick={() => setModal(false)}>Cancel</button><button className="admin-button primary" disabled={saving}>{saving ? <LoaderCircle size={15} className="spin"/> : <Plus size={15}/>} Save patient & visit</button></div>
      </form>
    </AdminModal>}
  </div>;
}
