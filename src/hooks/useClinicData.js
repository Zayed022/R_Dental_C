import { useEffect, useState } from 'react';
import { api } from '../api';
import { DEFAULT_SETTINGS, FALLBACK_SERVICES, FALLBACK_DOCTORS, DEFAULT_FAQS, FALLBACK_REVIEWS } from '../data/clinicDefaults';

export function useClinicData(options = {}) {
  const settingsFallback = options.settings || DEFAULT_SETTINGS;
  const servicesFallback = options.services || (options.department === 'skin' ? [] : FALLBACK_SERVICES);
  const doctorsFallback = options.doctors || (options.department === 'skin' ? [] : FALLBACK_DOCTORS);
  const faqsFallback = options.faqs || (options.department === 'skin' ? [] : DEFAULT_FAQS);
  const reviewsFallback = options.reviews || FALLBACK_REVIEWS;
  const [settings, setSettings] = useState(settingsFallback);
  const [services, setServices] = useState(servicesFallback);
  const [doctors, setDoctors] = useState(doctorsFallback);
  const [media, setMedia] = useState([]);
  const [faqs, setFaqs] = useState(faqsFallback);
  const [reviews, setReviews] = useState(reviewsFallback);
  const [branches, setBranches] = useState([]);
  const [apiDown, setApiDown] = useState(false);

  const refresh = async () => {
    const endpoints = [
      ['/settings', setSettings, settingsFallback],
      ['/services', setServices, servicesFallback],
      ['/doctors', setDoctors, doctorsFallback],
      ['/branches', setBranches, []],
      ['/media', setMedia, []],
      ['/faqs', setFaqs, faqsFallback],
      ['/reviews', setReviews, reviewsFallback],
    ];
    let anyFailed = false;
    await Promise.all(endpoints.map(async ([url, setter, fallback]) => {
      try {
        const result = await api(url);
        if (url === '/settings') {
          if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('The clinic settings API returned invalid data.');
          setter({ ...settingsFallback, ...result });
        } else {
          if (!Array.isArray(result)) throw new Error(`/api${url} must return a JSON array.`);
          setter(result);
        }
      } catch (error) {
        anyFailed = true;
        setter(fallback);
        console.error(`[clinic data] /api${url}:`, error);
      }
    }));
    setApiDown(anyFailed);
  };

  useEffect(() => { refresh(); }, []);
  return { settings, services, doctors, branches, media, faqs, reviews, apiDown, refresh, setSettings, setServices, setDoctors, setBranches, setMedia, setFaqs, setReviews };
}
