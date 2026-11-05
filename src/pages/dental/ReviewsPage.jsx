import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Clock3, Phone } from 'lucide-react';
import { api } from '../../api';
import { DEFAULT_SETTINGS } from '../../data/clinicDefaults';
import { GoogleReviewsSection } from '../../components/clinic/GoogleReviewsSection';
import './reviews-page.css';

/**
 * Dedicated, QR-friendly reviews destination.
 * Reuses the same public review data, moderation workflow and submission API
 * as the homepage section. No duplicate review store or separate form logic.
 */
export function ReviewsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewsUnavailable, setReviewsUnavailable] = useState(false);

  useEffect(() => {
    let active = true;

    Promise.allSettled([
      api('/settings?department=dental'),
      api('/reviews?department=dental')
    ]).then(([settingsResult, reviewsResult]) => {
      if (!active) return;

      if (settingsResult.status === 'fulfilled' && settingsResult.value && typeof settingsResult.value === 'object') {
        setSettings({ ...DEFAULT_SETTINGS, ...settingsResult.value });
      }

      if (reviewsResult.status === 'fulfilled' && Array.isArray(reviewsResult.value)) {
        setReviews(reviewsResult.value);
      } else {
        setReviewsUnavailable(true);
      }

      setLoading(false);
    });

    return () => { active = false; };
  }, []);

  const phone = String(settings.phone || DEFAULT_SETTINGS.phone || '').trim();
  const phoneHref = phone.replace(/[^\d+]/g, '');
  const hours = settings.hoursLabel || DEFAULT_SETTINGS.hoursLabel;

  return (
    <div className="reviews-standalone-page">
      <header className="reviews-standalone-header">
        <a className="reviews-standalone-brand" href="/" aria-label="R Dental Clinic home">
          <img src="/images/logo.png" alt="R Dental Clinic" />
          <span><strong>R Dental Clinic</strong><small>THOUGHTFUL DENTAL CARE</small></span>
        </a>
        <div className="reviews-standalone-header-actions">
          {phone && (
            <a className="reviews-standalone-phone" href={`tel:${phoneHref}`}>
              <Phone size={15} /> <span>{phone}</span>
            </a>
          )}
          <a className="reviews-standalone-home-link" href="/">
            <ArrowLeft size={15} /> <span>Back to website</span>
          </a>
        </div>
      </header>

      <main className="reviews-standalone-main">
        <div className="reviews-standalone-kicker">
          <span className="reviews-standalone-kicker-line" />
          R DENTAL CLINIC · PATIENT EXPERIENCES
        </div>
        <div className="reviews-standalone-title-row">
          <div>
            <h1>Reviews from our patients</h1>
            <p>Read shared experiences, explore replies from our clinic team, and tell us about your own visit.</p>
          </div>
          {hours && <div className="reviews-standalone-hours"><Clock3 size={16}/><span>{hours}</span></div>}
        </div>

        {reviewsUnavailable && (
          <div className="reviews-standalone-notice" role="status">
            Reviews are temporarily unavailable. You can still try submitting your experience below.
          </div>
        )}

        {loading ? (
          <div className="reviews-standalone-loading" role="status" aria-live="polite">
            <span className="reviews-standalone-spinner" /> Loading patient reviews…
          </div>
        ) : (
          <GoogleReviewsSection reviews={reviews} settings={settings} />
        )}
      </main>

      <footer className="reviews-standalone-footer">
        <a className="reviews-standalone-footer-brand" href="/">R Dental Clinic</a>
        <span>Thank you for sharing your experience with our team.</span>
        <a href="/" className="reviews-standalone-footer-link">Visit the main website <ArrowUpRight size={14}/></a>
      </footer>
    </div>
  );
}
