import React, { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Clock3, Edit3, MapPin, Plus, Save, Trash2, Users, BriefcaseMedical, CircleHelp, LoaderCircle } from 'lucide-react';
import { api, json } from '../api';
import { AdminModal, EmptyState, ErrorPanel, SectionLoading, StatusPill } from './AdminUI';
import { ImageWithFallback } from '../components/clinic/ClinicComponents';

const emptyBranch = {
  name: '', area: '', address: '', city: '', phone: '', whatsapp: '', email: '', mapUrl: '', image: '', description: '',
  facilitiesText: '', doctorIds: [], serviceIds: [], openingTime: '09:00', closingTime: '18:00', slotMinutes: 30,
  workingDays: [1, 2, 3, 4, 5, 6], hoursLabel: 'Monday – Saturday · 9:00 AM – 6:00 PM', active: true, featured: false, sortOrder: 0
};

export function AdminBranches({ refreshKey, notify, department = 'dental' }) {
  const [rows, setRows] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyBranch);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError('');
    try {
      const [branchRows, doctorRows, serviceRows] = await Promise.all([
        api('/admin/branches'), api('/admin/doctors'), api('/admin/services')
      ]);
      if (![branchRows, doctorRows, serviceRows].every(Array.isArray)) throw new Error('Branch, clinician or service data is not in the expected format.');
      setRows(branchRows);
      setDoctors(doctorRows);
      setServices(serviceRows);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [refreshKey, department]);

  const openCreate = () => { setEditingId(null); setForm({ ...emptyBranch }); setModal(true); };
  const openEdit = row => {
    setEditingId(row._id);
    setForm({
      ...emptyBranch, ...row,
      facilitiesText: (row.facilities || []).join(', '),
      doctorIds: (row.doctorIds || []).map(item => String(item._id || item)),
      serviceIds: (row.serviceIds || []).map(item => String(item._id || item))
    });
    setModal(true);
  };
  const save = async event => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        facilities: String(form.facilitiesText || '').split(',').map(value => value.trim()).filter(Boolean),
        doctorIds: form.doctorIds || [], serviceIds: form.serviceIds || [],
        slotMinutes: Number(form.slotMinutes || 30), sortOrder: Number(form.sortOrder || 0)
      };
      delete payload.facilitiesText;
      const result = await api(editingId ? `/admin/branches/${editingId}` : '/admin/branches', {
        method: editingId ? 'PATCH' : 'POST', body: json(payload)
      });
      setModal(false); await load(); notify(`Branch ${editingId ? 'updated' : 'created'} successfully.`);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };
  const remove = async row => {
    if (!window.confirm(`Hide ${row.name} from the public website? Existing appointment records will be retained.`)) return;
    try { await api(`/admin/branches/${row._id}`, { method: 'DELETE' }); await load(); notify('Branch hidden from the public website.'); }
    catch (e) { setError(e.message); }
  };
  const updateMulti = (key, event) => setForm(prev => ({ ...prev, [key]: Array.from(event.target.selectedOptions, option => option.value) }));
  const toggleDay = day => setForm(prev => ({ ...prev, workingDays: prev.workingDays.includes(day) ? prev.workingDays.filter(value => value !== day) : [...prev.workingDays, day] }));

  if (!rows && !error) return <SectionLoading/>;
  if (!rows && error) return <ErrorPanel error={error}/>;
  return <div className="admin-branches-page">
    <div className="admin-page-intro"><div><span className="admin-eyebrow">LOCATIONS & OPERATIONS</span><h2>Clinic branches</h2><p>Manage each location, its facilities, doctors, services and appointment hours. Published branches appear on the relevant public website and booking form.</p></div><button className="admin-button primary" onClick={openCreate}><Plus size={16}/> Add branch</button></div>
    {error && <div className="inline-admin-error"><CircleHelp size={15}/>{error}</div>}
    <div className="admin-branch-grid">
      {rows.map(row => <article className="admin-panel admin-branch-card" key={row._id}>
        <div className="admin-branch-image">{row.image ? <ImageWithFallback src={row.image} alt={row.name}/> : <div><MapPin size={28}/><span>R DENTAL CLINIC</span></div>}<div className="admin-branch-actions"><button className="admin-icon-button" onClick={() => openEdit(row)} title="Edit branch"><Edit3 size={15}/></button><button className="admin-icon-button danger" onClick={() => remove(row)} title="Hide branch"><Trash2 size={15}/></button></div></div>
        <div className="admin-branch-content"><div className="admin-branch-title"><div><span className="collection-eyebrow">{row.area}{row.city ? ` · ${row.city}` : ''}</span><h3>{row.name}</h3></div><StatusPill status={row.active ? 'confirmed' : 'cancelled'}/></div>
          <p>{row.description || row.address}</p><div className="admin-branch-detail"><MapPin size={14}/>{row.address}</div><div className="admin-branch-detail"><Clock3 size={14}/>{row.hoursLabel || `${row.openingTime} – ${row.closingTime}`}</div>
          <div className="admin-branch-metrics"><span><Users size={14}/>{row.doctorIds?.length || 0} clinicians</span><span><BriefcaseMedical size={14}/>{row.serviceIds?.length || 0} services</span></div>
          {row.facilities?.length > 0 && <div className="admin-branch-tags">{row.facilities.slice(0, 6).map(item => <span key={item}>{item}</span>)}</div>}
        </div>
      </article>)}
    </div>
    {rows.length === 0 && <EmptyState icon={MapPin} title="No branches added yet" description="Add your first clinic location. Patients will be able to select it during appointment booking." action="Add first branch" onAction={openCreate}/>}
    {modal && <AdminModal wide title={editingId ? 'Edit branch' : 'Add clinic branch'} subtitle="These details appear on the public location cards and are used by the appointment availability system." onClose={() => setModal(false)}>
      <form className="admin-edit-form" onSubmit={save}>
        <div className="admin-edit-grid">
          <label className="field"><span>Branch name *</span><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
          <label className="field"><span>Area / locality *</span><input required value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}/></label>
          <label className="field field-full"><span>Full address *</span><textarea required rows="2" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}/></label>
          <label className="field"><span>City</span><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}/></label>
          <label className="field"><span>Branch phone</span><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}/></label>
          <label className="field"><span>Branch WhatsApp</span><input value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })}/></label>
          <label className="field"><span>Branch email</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label>
          <label className="field field-full"><span>Google Maps / directions URL</span><input type="url" value={form.mapUrl} onChange={e => setForm({ ...form, mapUrl: e.target.value })}/></label>
          <label className="field field-full"><span>Branch image URL (HTTPS)</span><input type="url" value={form.image} onChange={e => setForm({ ...form, image: e.target.value })}/></label>
          <label className="field field-full"><span>Branch description</span><textarea rows="3" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></label>
          <label className="field field-full"><span>Facilities · comma separated</span><textarea rows="2" value={form.facilitiesText} onChange={e => setForm({ ...form, facilitiesText: e.target.value })} placeholder="Digital X-ray, wheelchair access, parking…"/></label>
          <label className="field"><span>Opening time</span><input type="time" required value={form.openingTime} onChange={e => setForm({ ...form, openingTime: e.target.value })}/></label>
          <label className="field"><span>Closing time</span><input type="time" required value={form.closingTime} onChange={e => setForm({ ...form, closingTime: e.target.value })}/></label>
          <label className="field"><span>Slot duration (minutes)</span><input type="number" min="15" max="120" value={form.slotMinutes} onChange={e => setForm({ ...form, slotMinutes: e.target.value })}/></label>
          <label className="field"><span>Public opening-hours label</span><input value={form.hoursLabel} onChange={e => setForm({ ...form, hoursLabel: e.target.value })}/></label>
          <label className="field field-full"><span>Doctors / clinicians assigned to this branch</span><select multiple size="5" value={form.doctorIds} onChange={e => updateMulti('doctorIds', e)}>{doctors.map(doctor => <option key={doctor._id} value={doctor._id}>{doctor.name} · {doctor.role}</option>)}</select><small>Hold Ctrl to select multiple clinicians. Leave empty if all department clinicians can be assigned.</small></label>
          <label className="field field-full"><span>Treatments / services available at this branch</span><select multiple size="5" value={form.serviceIds} onChange={e => updateMulti('serviceIds', e)}>{services.map(service => <option key={service._id} value={service._id}>{service.name}</option>)}</select><small>Hold Ctrl to select multiple services. Leave empty if all department services are available.</small></label>
          <div className="field field-full"><span>Working days</span><div className="working-days-picker">{[['Mon',1],['Tue',2],['Wed',3],['Thu',4],['Fri',5],['Sat',6],['Sun',0]].map(([label, day]) => <label className={form.workingDays.includes(day) ? 'working-day checked' : 'working-day'} key={day}><input type="checkbox" checked={form.workingDays.includes(day)} onChange={() => toggleDay(day)}/><span>{label}</span></label>)}</div></div>
          <label className="field field-checkbox"><input type="checkbox" checked={Boolean(form.featured)} onChange={e => setForm({ ...form, featured: e.target.checked })}/><span>Feature this location</span></label>
          <label className="field field-checkbox"><input type="checkbox" checked={Boolean(form.active)} onChange={e => setForm({ ...form, active: e.target.checked })}/><span>Visible on the public website / booking form</span></label>
        </div>
        {error && <div className="form-error"><CircleHelp size={15}/>{error}</div>}
        <div className="admin-modal-footer"><button type="button" className="admin-button secondary" onClick={() => setModal(false)}>Cancel</button><button className="admin-button primary" disabled={saving}>{saving ? <LoaderCircle size={15} className="spin"/> : <Save size={15}/>} Save branch</button></div>
      </form>
    </AdminModal>}
  </div>;
}
