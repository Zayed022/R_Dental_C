import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, MessageSquareText, Pause, Play, Send, Star, X } from 'lucide-react';
import { api, json } from '../../api';
import { SectionEyebrow } from './ClinicComponents';


function reviewDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function ReviewCard({ review, index, profileUrl }) {
  const isGoogle = review.source === 'google';
  const name = review.patientName || 'Patient';
  const date = reviewDate(review.reviewDate || review.createdAt);
  return (
    <article className="google-review-card">
      <div className="google-review-card-head">
        <span className={`google-review-source ${isGoogle ? 'google' : 'website'}`}>
          {isGoogle ? <><span className="google-review-g">G</span> Google review</> : <><MessageSquareText size={12}/> Patient review</>}
        </span>
        
      </div>
      <div className="google-review-stars" aria-label={`${review.rating || 5} out of 5 stars`}>
        {Array.from({ length: 5 }).map((_, i) => <span key={i} className={i < Number(review.rating || 5) ? 'filled' : ''}>★</span>)}
      </div>
      <p className="google-review-quote">
        {review.quote ? `“${review.quote}”` : 'This patient left a star rating without a written comment.'}
      </p>
      <div className="google-review-author">
        {review.reviewerPhotoUrl
          ? <img src={review.reviewerPhotoUrl} alt="" loading="lazy" referrerPolicy="no-referrer"/>
          : <span className="google-review-avatar">{name.trim().charAt(0).toUpperCase() || 'P'}</span>}
        <div><strong>{name}</strong><small>{review.treatmentLabel || (isGoogle ? 'Google patient review' : 'Patient experience')}</small></div>
        {isGoogle && profileUrl && <a href={profileUrl} target="_blank" rel="noreferrer" aria-label="View Google Business Profile"><ExternalLink size={14}/></a>}
      </div>
      {review.ownerReply && (
        <div className="google-review-owner-reply">
          <strong>Reply from the clinic</strong>
          <p>{review.ownerReply}</p>
          
        </div>
      )}
    </article>
  );
}

export function GoogleReviewsSection({ reviews = [], settings = {} }) {
  const [page, setPage] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(3);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [summary, setSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patientName: '', rating: 5, quote: '', consent: false, websiteUrl: '' });
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const touchStartX = useRef(null);

  const allReviews = useMemo(() => (Array.isArray(reviews) ? reviews : []).filter(item => item && item.published !== false), [reviews]);
  const pages = Math.max(1, Math.ceil(allReviews.length / cardsPerView));
  const visibleReviews = allReviews.slice(page * cardsPerView, (page + 1) * cardsPerView);
  const googleReviewCount = summary?.totalReviewCount || allReviews.filter(item => item.source === 'google').length;
  const averageRating = summary?.averageRating || 0;

  useEffect(() => {
    const updateCardsPerView = () => {
      const width = window.innerWidth;
      setCardsPerView(width <= 600 ? 1 : width <= 900 ? 2 : 3);
    };
    updateCardsPerView();
    window.addEventListener('resize', updateCardsPerView, { passive: true });
    return () => window.removeEventListener('resize', updateCardsPerView);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotionPreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updateMotionPreference();
    mediaQuery.addEventListener?.('change', updateMotionPreference);
    return () => mediaQuery.removeEventListener?.('change', updateMotionPreference);
  }, []);

  useEffect(() => {
    api('/reviews/summary?department=dental')
      .then(setSummary)
      .catch(error => console.warn('[Google reviews] Summary unavailable:', error.message));
  }, []);

  useEffect(() => {
    if (page >= pages) setPage(Math.max(0, pages - 1));
  }, [page, pages]);

  const changePage = step => {
    setDirection(step);
    setPage(current => pages > 1 ? (current + step + pages) % pages : 0);
  };

  useEffect(() => {
    if (pages <= 1 || isPaused || isInteracting || showForm || prefersReducedMotion) return undefined;
    const interval = window.setInterval(() => {
      setDirection(1);
      setPage(current => (current + 1) % pages);
    }, 9000);
    return () => window.clearInterval(interval);
  }, [pages, isPaused, isInteracting, showForm, prefersReducedMotion]);
  const handleTouchEnd = event => {
    if (touchStartX.current === null) return;
    const delta = event.changedTouches?.[0]?.clientX - touchStartX.current;
    if (Math.abs(delta) > 55) changePage(delta < 0 ? 1 : -1);
    touchStartX.current = null;
    setIsInteracting(false);
  };

  const submitReview = async event => {
    event.preventDefault();
    setFormError('');
    setFormMessage('');
    setSending(true);
    try {
      const result = await api('/reviews?department=dental', {
        method: 'POST',
        body: json(form)
      });
      setFormMessage(result.message || 'Thank you. Your review has been submitted for moderation.');
      setForm({ patientName: '', rating: 5, quote: '', consent: false, websiteUrl: '' });
      setShowForm(false);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="reviews-section google-reviews-section" id="reviews">
      <div className="container">
        <div className="google-reviews-heading">
          <div className="google-reviews-intro">
            <SectionEyebrow>KIND WORDS, SHARED WITH PERMISSION</SectionEyebrow>
            <h2>Experiences that speak<br/><em>for themselves.</em></h2>
            <p>Read original feedback shared by patients on Google and through our website, including replies from the clinic team where available.</p>
          </div>
          <div className="google-review-summary">
            <div className="google-review-summary-score">
              <strong>{averageRating ? averageRating.toFixed(1) : '—'}</strong>
              <span>★★★★★</span>
            </div>
            <div>
              <b>{googleReviewCount ? `${googleReviewCount} Google reviews` : 'Patient experiences'}</b>
              <small>{googleReviewCount ? 'Rating and review count from the connected Business Profile' : 'Reviews will appear here as they are approved or synced'}</small>
              {settings.googleReviewUrl && <a href={settings.googleReviewUrl} target="_blank" rel="noreferrer">View our Google profile <ExternalLink size={13}/></a>}
            </div>
          </div>
        </div>

        {visibleReviews.length ? (
          <>
            <div
              className="google-reviews-carousel"
              role="region"
              aria-roledescription="carousel"
              aria-label="Patient reviews"
              onMouseEnter={() => setIsInteracting(true)}
              onMouseLeave={() => setIsInteracting(false)}
              onFocusCapture={() => setIsInteracting(true)}
              onBlurCapture={event => {
                if (!event.currentTarget.contains(event.relatedTarget)) setIsInteracting(false);
              }}
              onTouchStart={event => {
                touchStartX.current = event.touches?.[0]?.clientX ?? null;
                setIsInteracting(true);
              }}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={() => {
                touchStartX.current = null;
                setIsInteracting(false);
              }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={page}
                  className="google-review-grid"
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`Reviews ${page + 1} of ${pages}`}
                  initial={{ opacity: 0, x: prefersReducedMotion ? 0 : direction > 0 ? 36 : -36 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: prefersReducedMotion ? 0 : direction > 0 ? -36 : 36 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.38, ease: [0.22, 1, 0.36, 1] }}
                >
                  {visibleReviews.map((review, index) => (
                    <ReviewCard key={review._id || review.googleReviewId || `${page}-${index}`} review={review} index={index} profileUrl={settings.googleReviewUrl}/>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="google-review-pagination">
              <span>Showing {page * cardsPerView + 1}–{Math.min((page + 1) * cardsPerView, allReviews.length)} of {allReviews.length} published reviews</span>
              <div className="google-review-controls">
                <button type="button" onClick={() => changePage(-1)} disabled={pages <= 1} aria-label="Previous reviews"><ArrowLeft size={17}/></button>
                <strong>{page + 1} <small>/ {pages}</small></strong>
                <button type="button" onClick={() => changePage(1)} disabled={pages <= 1} aria-label="Next reviews"><ArrowRight size={17}/></button>
                
              </div>
              <small className="google-review-swipe-hint">
                {prefersReducedMotion ? 'Swipe or use the arrows · Motion is reduced by your device setting' : 'Swipe or use the arrows · Auto-advances every 9 seconds'}
              </small>
            </div>
          </>
        ) : (
          <div className="google-reviews-empty">
            <MessageSquareText size={25}/>
            <div><strong>Patient experiences will appear here.</strong><p>Google reviews will be imported after the clinic connects its verified Business Profile. Website reviews appear after moderation.</p></div>
          </div>
        )}

        <div className="google-review-actions">
          <div><strong>Visited R Dental?</strong><span>Share an honest account of your experience. Website submissions are reviewed before publication.</span></div>
          <div className="google-review-action-buttons">
            {settings.googleReviewUrl && <a className="button button-outline" href={settings.googleReviewUrl} target="_blank" rel="noreferrer">Review us on Google <ExternalLink size={15}/></a>}
            <button className="button button-dark" type="button" onClick={() => { setShowForm(value => !value); setFormError(''); setFormMessage(''); }}>
              {showForm ? <><X size={15}/> Close form</> : <>Share your experience <ArrowRight size={15}/></>}
            </button>
          </div>
        </div>

        {formMessage && <div className="google-review-form-success"><CheckCircle2 size={17}/>{formMessage}</div>}
        {showForm && (
          <form className="google-review-submit-form" onSubmit={submitReview}>
            <div className="google-review-form-heading"><div><span>YOUR EXPERIENCE</span><h3>Share an honest review.</h3><p>Please avoid including private medical or personal information.</p></div></div>
            {formError && <div className="form-error">{formError}</div>}
            <div className="google-review-form-grid">
              <label className="field"><span>Name to display <b>*</b></span><input required maxLength={80} value={form.patientName} onChange={event => setForm({ ...form, patientName: event.target.value })} placeholder="Your name"/></label>
              <div className="field"><span>Your rating <b>*</b></span><div className="google-review-rating-input" role="group" aria-label="Choose a rating">{[1,2,3,4,5].map(value => <button key={value} type="button" className={value <= form.rating ? 'selected' : ''} onClick={() => setForm({ ...form, rating: value })} aria-label={`${value} star${value === 1 ? '' : 's'}`}><Star size={22} fill="currentColor"/></button>)}</div></div>
              <label className="field field-full"><span>Your review <b>*</b></span><textarea required rows="4" maxLength={2000} value={form.quote} onChange={event => setForm({ ...form, quote: event.target.value })} placeholder="Tell us about your experience…"/></label>
              <label className="google-review-honeypot" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={form.websiteUrl} onChange={event => setForm({ ...form, websiteUrl: event.target.value })}/></label>
            </div>
            <label className="google-review-consent"><input type="checkbox" checked={form.consent} onChange={event => setForm({ ...form, consent: event.target.checked })}/><span>I agree that the clinic may display this review on its website after moderation.</span></label>
            <div className="google-review-form-footer"><small>Submitting here does not post to Google. To leave a Google review, use the Google button above.</small><button type="submit" className="button button-dark" disabled={sending}>{sending ? 'Submitting…' : <>Submit review <Send size={15}/></>}</button></div>
          </form>
        )}
      </div>
    </section>
  );
}
