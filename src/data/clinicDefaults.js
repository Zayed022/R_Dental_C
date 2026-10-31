export const DEFAULT_SETTINGS = {
  clinicName: 'R Dental Clinic', shortName: 'R Dental Clinic', tagline: 'A more thoughtful kind of dentistry.',
  heroTitle: 'A little more care. A lot more confidence.',
  heroDescription: 'Modern dentistry, thoughtful people, and a calmer experience — from your first hello to your healthiest smile.',
  heroImage: '/images/aurelia-hero.webp',
  phone: '+91 98765 43210', whatsapp: '919876543210', email: 'hello@aurelia.dental', address: 'Add clinic address in Admin Settings', city: 'Your City, India',
  openingTime: '09:00', closingTime: '18:00', hoursLabel: 'Monday – Saturday · 9:00 AM – 6:00 PM',
  aboutTitle: 'Care that starts with listening.', aboutDescription: 'We believe good dentistry is about more than a healthy smile. It is about feeling heard, understanding your options, and knowing you are in thoughtful hands.',
  googleReviewUrl: ''
};
export const FALLBACK_SERVICES = [
  { _id: 'demo1', name: 'Smile design & veneers', category: 'Aesthetic dentistry', shortDescription: 'A considered approach to shape, balance and brightness — designed around your natural smile.', durationMinutes: 60, priceFrom: 2500, image: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=900&q=88', featured: true },
  { _id: 'demo2', name: 'Dental implants', category: 'Restorative dentistry', shortDescription: 'A carefully planned option for replacing missing teeth and restoring everyday function.', durationMinutes: 75, priceFrom: 18000, image: 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=900&q=88' },
  { _id: 'demo3', name: 'Clear aligner consultation', category: 'Orthodontics', shortDescription: 'Explore discreet teeth-straightening options with a clinician-led assessment.', durationMinutes: 45, priceFrom: 1500, image: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=900&q=88' },
  { _id: 'demo4', name: 'Professional cleaning', category: 'Preventive care', shortDescription: 'A refreshing clean to help maintain gum health and keep your smile feeling its best.', durationMinutes: 40, priceFrom: 1200, image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=900&q=88' }
];
export const FALLBACK_DOCTORS = [
  { _id: 'dr1', name: 'Dr. Ananya Mehta', role: 'Lead Dentist · Cosmetic & Restorative', specialities: ['Smile design', 'Restorative dentistry'], qualifications: 'BDS, MDS · Aesthetic Dentistry', experienceYears: 12, image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=88', bio: 'A calm, collaborative approach to dentistry, helping every patient understand their options and feel in control of their care.', featured: true },
  { _id: 'dr2', name: 'Dr. Kabir Sethi', role: 'Consultant · Implant & Surgical Dentistry', specialities: ['Dental implants', 'Oral surgery'], qualifications: 'BDS, MDS · Oral Surgery', experienceYears: 10, image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=900&q=88', bio: 'Clear explanations, thoughtful planning and precise treatment for patients exploring restorative options.', featured: true },
  { _id: 'dr3', name: 'Dr. Mira Fernandes', role: 'Consultant · Family & Preventive Care', specialities: ['Family dentistry', 'Preventive care'], qualifications: 'BDS · Family Dentistry', experienceYears: 8, image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=900&q=88', bio: 'Helping children and adults build sustainable habits for long-term oral health in a friendly setting.', featured: true }
];
export const DEFAULT_FAQS = [
  { _id: 'f1', question: 'I feel nervous about visiting a dentist. Can you help?', answer: 'Absolutely. Tell us what worries you when you book. Your dentist can talk through each step, discuss comfort options and move at a pace that works for you.' },
  { _id: 'f2', question: 'How much will my treatment cost?', answer: 'The amount depends on your assessment and the treatment that is clinically appropriate. We share the plan and estimated costs with you before you decide how to proceed.' },
  { _id: 'f3', question: 'Can I choose a particular dentist?', answer: 'Yes. Select your preferred dentist in the booking form. If you are unsure, choose “No preference” and our team can help match you with the right clinician.' },
  { _id: 'f4', question: 'Can I reschedule an appointment?', answer: 'Of course. Contact the clinic through WhatsApp or by phone as early as possible, and our team will help find a suitable alternative.' }
];
export const FALLBACK_REVIEWS = [];

export const SKIN_DEFAULT_SETTINGS = {
  clinicName: 'R Dental · Skin & Hair',
  shortName: 'R DENTAL',
  tagline: 'Thoughtful dermatology. Personal care.',
  heroTitle: 'Healthy skin begins with understanding.',
  heroDescription: 'A considered approach to skin and hair health, guided by clinical assessment, clear explanations and care that is personal to you.',
  heroImage: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1800&q=90',
  phone: DEFAULT_SETTINGS.phone,
  whatsapp: DEFAULT_SETTINGS.whatsapp,
  email: DEFAULT_SETTINGS.email,
  address: DEFAULT_SETTINGS.address,
  city: DEFAULT_SETTINGS.city,
  openingTime: DEFAULT_SETTINGS.openingTime,
  closingTime: DEFAULT_SETTINGS.closingTime,
  hoursLabel: DEFAULT_SETTINGS.hoursLabel,
  aboutTitle: 'Care that starts with listening.',
  aboutDescription: 'Skin and hair concerns are personal. We begin by listening, understanding your goals and discussing clinically appropriate options before any treatment is recommended.',
  whatsappTemplateFirstVisit: 'Hello {patientName}, thank you for visiting {clinicName}. We hope your {serviceName} consultation went well. Please contact us if you have any questions.',
  whatsappTemplateFollowUp1: 'Hello {patientName}, this is {clinicName}. We are checking in after your recent visit for {serviceName}. Please let us know how you are doing or if you need any assistance.',
  whatsappTemplateFollowUp2: 'Hello {patientName}, we are following up regarding your care plan at {clinicName}. Please let us know if you would like help arranging your next visit.',
  whatsappTemplateFinalVisit: 'Hello {patientName}, a reminder from {clinicName} about your final/review visit for {serviceName}. Please reply here if you need to adjust your appointment.',
  whatsappTemplateCompleted: 'Hello {patientName}, thank you for choosing {clinicName} for your care. We appreciate your trust. Please get in touch if you need further assistance.',
  servicesHeading: 'Care that begins with understanding.',
  servicesDescription: 'Explore the consultation options currently published by the clinic. Your dermatologist will confirm clinical suitability and the appropriate care plan.',
  galleryHeading: 'A closer look at our care.',
  galleryDescription: 'Clinic images, educational videos and dermatologist introductions are published by the team from the admin workspace.',
  faqHeading: 'Questions are always welcome.',
  faqDescription: 'A few things patients often ask before a Skin & Hair consultation.',
  careStep1Title: 'Listen & understand',
  careStep1Description: 'We discuss your concern, goals, relevant history and expectations.',
  careStep2Title: 'Assess & explain',
  careStep2Description: 'Your clinician explains findings, appropriate options, limitations, risks and costs.',
  careStep3Title: 'Plan & follow up',
  careStep3Description: 'You receive a care plan and guidance on review visits or aftercare where appropriate.'
};
