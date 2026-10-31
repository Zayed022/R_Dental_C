import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, CircleHelp, ClipboardList, LoaderCircle, X } from 'lucide-react';

export function StatusPill({ status }) { return <span className={`status-pill status-${status || 'pending'}`}><span/>{status || 'pending'}</span>; }
export function SectionLoading() { return <div className="admin-section-loading"><LoaderCircle className="spin" size={24}/><span>Loading your clinic data…</span></div>; }
export function ErrorPanel({ error }) { return <div className="admin-error-panel"><Activity size={24}/><h3>We couldn’t load this section.</h3><p>{error}</p><span>Check the API terminal for database or server errors, then try again.</span></div>; }
export function EmptyState({ icon: Icon = ClipboardList, title, description, action, onAction }) { return <div className="admin-empty"><span className="admin-empty-icon"><Icon size={24}/></span><h3>{title}</h3><p>{description}</p>{action && <button className="admin-button secondary" onClick={onAction}>{action}</button>}</div>; }
export function AdminModal({ title, subtitle, children, onClose, wide = false }) {
  useEffect(() => { const handler = e => e.key === 'Escape' && onClose(); window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [onClose]);
  return <motion.div className="admin-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={e => e.target === e.currentTarget && onClose()}><motion.div className={`admin-modal ${wide ? 'admin-modal-wide' : ''}`} initial={{ opacity: 0, y: 12, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}><div className="admin-modal-head"><div><span className="admin-eyebrow">CONTENT MANAGEMENT</span><h3>{title}</h3><p>{subtitle}</p></div><button className="admin-icon-button" onClick={onClose}><X size={18}/></button></div>{children}</motion.div></motion.div>;
}
