import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Clock3, HeartHandshake, Instagram, MapPin, Menu, MessageCircle, Minus, Plus, Quote, ShieldCheck, Sparkles, Star,
  Smile, Stethoscope, Phone, Play, X, CircleCheck, ArrowUp, LoaderCircle, LayoutDashboard, CalendarCheck, Users,
  BriefcaseMedical, Images, Clapperboard, CircleHelp, Settings as SettingsIcon, LogOut, Search, Filter, MoreHorizontal, UserPlus,
  Pencil, Trash2, Eye, EyeOff, Upload, ExternalLink, Save, Activity, ClipboardList, FileText, Mail, Clock, Video,
  Image as ImageIcon, CheckCheck, UserRound, CalendarClock, Menu as MenuIcon, LockKeyhole, PlusCircle, Send
} from 'lucide-react';
import { api, setApiDepartment } from '../api';
import { AdminLogin } from './AdminLogin';
import { AdminOverview } from './AdminOverview';
import { AdminAppointments } from './AdminAppointments';
import { AdminCollection } from './AdminCollection';
import { AdminMedia } from './AdminMedia';
import { AdminSettings } from './AdminSettings';
import { AdminBranches } from './AdminBranches';
import { AdminPatients } from './AdminPatients';

const adminTabs = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'appointments', label: 'Appointments', icon: CalendarCheck },
  { id: 'patients', label: 'Patients', icon: UserPlus }, { id: 'branches', label: 'Branches', icon: MapPin },
  { id: 'doctors', label: 'Dentists', icon: Users }, { id: 'services', label: 'Treatments', icon: BriefcaseMedical },
  { id: 'media', label: 'Gallery & videos', icon: Images }, { id: 'faqs', label: 'FAQs', icon: CircleHelp },
  { id: 'reviews', label: 'Reviews', icon: Quote }, { id: 'settings', label: 'Clinic settings', icon: SettingsIcon }
];
export function AdminApp() {
  const [admin, setAdmin] = useState(null);
  const [department, setDepartment] = useState('dental');
  setApiDepartment(department);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { api('/auth/me').then(r => setAdmin(r.admin)).catch(() => setAdmin(null)).finally(() => setAuthChecked(true)); }, []);
  const refresh = () => setRefreshKey(v => v + 1);
  const switchDepartment = next => { setApiDepartment(next); setDepartment(next); setRefreshKey(v => v + 1); setTab('overview'); setSidebarOpen(false); };
  const visibleTabs = adminTabs.map(item => item.id === 'doctors' ? { ...item, label: department === 'skin' ? 'Dermatologists' : 'Dentists' } : item.id === 'services' ? { ...item, label: department === 'skin' ? 'Skin & Hair services' : 'Treatments' } : item);
  const notice = message => { setToast(message); setTimeout(() => setToast(''), 3600); };
  const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setAdmin(null); };
  if (!authChecked) return <div className="admin-loading"><LoaderCircle className="spin" size={26}/><span>Opening your workspace…</span></div>;
  if (!admin) return <AdminLogin onLogin={setAdmin}/>;
  return <div className="admin-app">
    <aside className={`admin-sidebar ${sidebarOpen ? 'admin-sidebar-open' : ''}`}><div className="admin-sidebar-top"><a className="admin-brand" href="/"><img src="/images/logo.png" alt="R Dental Clinic" className="admin-brand-logo"/><span><strong>R DENTAL</strong><small>CLINIC ADMIN</small></span></a><button className="admin-mobile-close" onClick={() => setSidebarOpen(false)}><X size={19}/></button></div><div className="admin-clinic-card"><span className="clinic-live-dot"/><div><strong>Clinic workspace</strong><small>Content & patient requests</small></div><MoreHorizontal size={17}/></div><nav className="admin-nav">{visibleTabs.map(item => <button key={item.id} className={tab === item.id ? 'admin-nav-item active' : 'admin-nav-item'} onClick={() => { setTab(item.id); setSidebarOpen(false); setError(''); }}><item.icon size={17}/><span>{item.label}</span>{item.id === 'appointments' && <span className="nav-new-dot"/>}</button>)}</nav><div className="admin-sidebar-bottom"><a href="/" className="admin-back-to-site"><ExternalLink size={16}/> View public website</a><div className="admin-user"><span className="admin-avatar">{admin.email.slice(0, 1).toUpperCase()}</span><div><strong>{admin.email}</strong><small>Administrator</small></div><button onClick={logout} aria-label="Sign out"><LogOut size={17}/></button></div></div></aside>
    {sidebarOpen && <button className="admin-sidebar-overlay" aria-label="Close menu" onClick={() => setSidebarOpen(false)}/>}
    <main className="admin-main"><header className="admin-topbar"><div className="admin-topbar-left"><button className="admin-mobile-menu" onClick={() => setSidebarOpen(true)}><MenuIcon size={21}/></button><div><span className="admin-breadcrumb">WORKSPACE <ChevronRight size={12}/> {visibleTabs.find(item => item.id === tab)?.label.toUpperCase()}</span><h1>{visibleTabs.find(item => item.id === tab)?.label}</h1></div></div><div className="admin-topbar-actions"><div className="admin-department-toggle" role="group" aria-label="Choose clinic department"><button type="button" className={department === 'dental' ? 'active' : ''} onClick={() => switchDepartment('dental')}>Dental</button><button type="button" className={department === 'skin' ? 'active' : ''} onClick={() => switchDepartment('skin')}>Skin & Hair</button></div><span className="admin-clock"><span/> System operational</span><a href="/" target="_blank" rel="noreferrer" className="admin-view-site">View website <ArrowUpRight size={15}/></a></div></header>
      <div className="admin-content"><AnimatePresence mode="wait"><motion.div key={`${tab}-${refreshKey}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: .22 }}>
        {tab === 'overview' && <AdminOverview onTab={setTab} refreshKey={refreshKey} department={department}/>}
        {tab === 'appointments' && <AdminAppointments refreshKey={refreshKey} notify={notice} department={department}/>}
        {tab === 'patients' && <AdminPatients refreshKey={refreshKey} notify={notice} department={department}/> }
        {tab === 'branches' && <AdminBranches refreshKey={refreshKey} notify={notice} department={department}/> }
        {tab === 'doctors' && <AdminCollection kind="doctors" refreshKey={refreshKey} notify={notice} department={department}/>}
        {tab === 'services' && <AdminCollection kind="services" refreshKey={refreshKey} notify={notice} department={department}/>}
        {tab === 'media' && <AdminMedia refreshKey={refreshKey} notify={notice} department={department}/>}
        {tab === 'faqs' && <AdminCollection kind="faqs" refreshKey={refreshKey} notify={notice} department={department}/>}
        {tab === 'reviews' && <AdminCollection kind="reviews" refreshKey={refreshKey} notify={notice} department={department}/>}
        {tab === 'settings' && <AdminSettings refreshKey={refreshKey} notify={notice} department={department}/>}
      </motion.div></AnimatePresence></div>
    </main>{toast && <div className="admin-toast"><CheckCircle2 size={17}/>{toast}</div>}
  </div>;
}
