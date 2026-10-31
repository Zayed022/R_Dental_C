import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Smile } from 'lucide-react';
import { waNumber } from '../../api';

export function Wordmark({ settings, light = false, homeHref = '/#top', subLabel = 'DENTAL STUDIO' }) {
  return <a className={`wordmark ${light ? 'wordmark-light' : ''}`} href={homeHref} aria-label={`${settings.shortName || 'AURELIA'} homepage`}>
     <img
  src="/images/logo.png"
  alt="R Dental Clinic"
  className="navbar-logo"
/>
    <span className="wordmark-text"><strong>{settings.shortName || 'AURELIA'}</strong><small>{subLabel}</small></span>
  </a>;
}
export function Reveal({ children, className = '', delay = 0, ...props }) {
  return <motion.div className={className} initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.12 }} transition={{ duration: 0.65, delay, ease: [0.22, 1, 0.36, 1] }} {...props}>{children}</motion.div>;
}
export function ImageWithFallback({ src, alt, className = '', ...props }) {
  const [failed, setFailed] = useState(false);
  return failed || !src ? <div className={`image-fallback ${className}`} {...props}><Smile size={36}/></div> : <img src={src} alt={alt || ''} className={className} loading="lazy" onError={() => setFailed(true)} {...props}/>;
}
export function SectionEyebrow({ children }) { return <div className="eyebrow"><span className="eyebrow-line"/>{children}</div>; }
export function SectionHeading({ label, title, description, align = 'left' }) {
  return <div className={`section-heading align-${align}`}><SectionEyebrow>{label}</SectionEyebrow><h2>{title}</h2>{description && <p>{description}</p>}</div>;
}
export function WhatsAppLink({ settings, children, className = '', message = 'Hello, I would like to know more about your dental services.' }) {
  const number = waNumber(settings.whatsapp || settings.phone);
  return <a className={className} href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">{children}</a>;
}
