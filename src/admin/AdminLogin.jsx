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

export function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('admin@rdental.demo');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const submit = async e => { e.preventDefault(); setLoading(true); setError(''); try { const result = await api('/auth/login', { method: 'POST', body: json({ email, password }) }); onLogin(result.admin); } catch (err) { setError(err.message); } finally { setLoading(false); } };
  return <div className="admin-login-page"><div className="login-side-visual"><div className="login-visual-overlay"/><a className="login-home-link" href="/"><ArrowUpRight size={15}/> Public website</a><div className="login-visual-copy"><span className="login-eyebrow"><span/> YOUR CLINIC, THOUGHTFULLY MANAGED</span><h2>Good care.<br/><em>Good operations.</em></h2><p>Appointments, people and content — in one calm workspace built around your practice.</p><span className="login-visual-bottom">R DENTAL CLINIC <span>·</span> PRACTICE MANAGEMENT</span></div></div><div className="login-form-side"><a className="admin-brand login-brand" href="/"><img src="/images/logo.png" alt="R Dental Clinic" className="admin-brand-logo"/><span><strong>R DENTAL</strong><small>CLINIC ADMIN</small></span></a><form className="login-form" onSubmit={submit}><SectionEyebrow>WELCOME BACK</SectionEyebrow><h1>Sign in to your<br/>workspace.</h1><p>Manage your clinic’s appointments, team and treatment information.</p>{error && <div className="form-error"><CircleHelp size={16}/>{error}</div>}<label className="field"><span>Admin email</span><input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)}/></label><label className="field"><span>Password</span><span className="password-input"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></span></label><button className="button button-dark login-submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={17}/> Signing in…</> : <>Enter workspace <ArrowUpRight size={16}/></>}</button><div className="login-secure-note"><LockKeyhole size={14}/> Secure, administrator-only access</div></form><div className="login-footer">Need help accessing the workspace? Contact your system administrator.</div></div></div>;
}
