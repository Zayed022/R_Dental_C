import 'dotenv/config';
import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { Doctor, Treatment, Media, Faq, Review, ClinicSettings, Admin } from './models.js';

export async function seedDatabase() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@rdental.demo').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
  const existingAdmin = await Admin.findOne({ email: adminEmail });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    await Admin.create({ email: adminEmail, passwordHash });
    console.log(`[seed] Created local admin account: ${adminEmail}`);
  }

  await ClinicSettings.updateOne({ key: 'main' }, { $setOnInsert: {
    key: 'main',
    department: 'dental',
    clinicName: 'Aurelia Dental Studio',
    shortName: 'AURELIA',
    tagline: 'A more thoughtful kind of dentistry.',
    heroTitle: 'A little more care. A lot more confidence.',
    heroDescription: 'Modern dentistry, thoughtful people, and a calmer experience — from your first hello to your healthiest smile.',
    heroImage: '/images/aurelia-hero.webp',
    phone: process.env.CLINIC_PHONE || '+91 98765 43210',
    whatsapp: process.env.CLINIC_WHATSAPP || '919876543210',
    email: process.env.CLINIC_EMAIL || 'hello@aurelia.dental',
    address: process.env.CLINIC_ADDRESS || 'Add clinic address in Admin Settings',
    city: process.env.CLINIC_CITY || 'Your City, India',
    openingTime: '09:00', closingTime: '18:00', slotMinutes: 30, workingDays: [1, 2, 3, 4, 5, 6],
    hoursLabel: 'Monday – Saturday · 9:00 AM – 6:00 PM',
    aboutTitle: 'Care that starts with listening.',
    aboutDescription: 'We believe good dentistry is about more than a healthy smile. It is about feeling heard, understanding your options, and knowing you are in thoughtful hands.'
  } }, { upsert: true });

  // Separate Skin & Hair brand settings. Existing `main` settings continue to power Dental.
  await ClinicSettings.updateOne({ key: 'skin' }, { $setOnInsert: {
    key: 'skin',
    department: 'skin',
    clinicName: 'R Dental · Skin & Hair',
    shortName: 'R DENTAL',
    tagline: 'Thoughtful dermatology. Personal care.',
    heroTitle: 'Healthy skin begins with understanding.',
    heroDescription: 'A considered approach to skin and hair health, guided by clinical assessment, clear explanations and care that is personal to you.',
    heroImage: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1800&q=90',
    phone: process.env.CLINIC_PHONE || '+91 98765 43210',
    whatsapp: process.env.CLINIC_WHATSAPP || '919876543210',
    email: process.env.CLINIC_EMAIL || 'hello@aurelia.dental',
    address: process.env.CLINIC_ADDRESS || 'Add clinic address in Admin Settings',
    city: process.env.CLINIC_CITY || 'Your City, India',
    openingTime: '09:00', closingTime: '18:00', slotMinutes: 30, workingDays: [1, 2, 3, 4, 5, 6],
    hoursLabel: 'Monday – Saturday · 9:00 AM – 6:00 PM',
    aboutTitle: 'Care that starts with listening.',
    aboutDescription: 'Skin and hair concerns are personal. We begin by listening, understanding your goals and discussing clinically appropriate options before any treatment is recommended.'
  } }, { upsert: true });

  if (await Doctor.countDocuments() === 0) {
    await Doctor.insertMany([
      { name: 'Dr. Ananya Mehta', role: 'Lead Dentist · Cosmetic & Restorative', specialities: ['Smile design', 'Restorative dentistry'], qualifications: 'BDS, MDS · Aesthetic Dentistry', experienceYears: 12, image: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=900&q=88', bio: 'Ananya brings a calm, collaborative approach to dentistry, helping every patient understand their options and feel in control of their care.', philosophy: 'The best treatment plan is the one we create together.', languages: ['English', 'Hindi', 'Marathi'], availability: 'Monday – Saturday', featured: true, sortOrder: 1 },
      { name: 'Dr. Kabir Sethi', role: 'Consultant · Implant & Surgical Dentistry', specialities: ['Dental implants', 'Oral surgery'], qualifications: 'BDS, MDS · Oral & Maxillofacial Surgery', experienceYears: 10, image: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=900&q=88', bio: 'Kabir focuses on clear explanations, thoughtful planning and precise treatment for patients exploring restorative and surgical options.', philosophy: 'Confidence comes from knowing what to expect.', languages: ['English', 'Hindi'], availability: 'Tuesday – Saturday', featured: true, sortOrder: 2 },
      { name: 'Dr. Mira Fernandes', role: 'Consultant · Family & Preventive Care', specialities: ['Family dentistry', 'Preventive care'], qualifications: 'BDS · Family & Preventive Dentistry', experienceYears: 8, image: 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=900&q=88', bio: 'Mira enjoys helping children and adults build easy, sustainable habits for long-term oral health, in a friendly and pressure-free setting.', philosophy: 'Small, consistent care makes a meaningful difference.', languages: ['English', 'Hindi', 'Konkani'], availability: 'Monday – Friday', featured: true, sortOrder: 3 }
    ]);
  }

  if (await Treatment.countDocuments() === 0) {
    await Treatment.insertMany([
      { name: 'Smile design & veneers', category: 'Aesthetic dentistry', shortDescription: 'A considered approach to shape, balance and brightness — designed around your natural smile.', description: 'We begin with a conversation and a detailed assessment, then explore appropriate options with you. Every plan is individual and depends on clinical suitability.', durationMinutes: 60, priceFrom: 2500, sessions: 'Consultation plus treatment visits as planned', recovery: 'Depends on the treatment selected', features: ['Personalised smile assessment', 'Digital planning where appropriate', 'Clear options before treatment'], image: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1000&q=88', featured: true, sortOrder: 1 },
      { name: 'Dental implants', category: 'Restorative dentistry', shortDescription: 'A carefully planned option for replacing missing teeth and restoring everyday function.', description: 'Your dentist will assess oral health, bone support and your goals before recommending any implant treatment. Timelines vary depending on individual needs.', durationMinutes: 75, priceFrom: 18000, sessions: 'Multiple visits over a personalised timeline', recovery: 'Your dentist will explain recovery and aftercare', features: ['3D imaging when indicated', 'Individual treatment plan', 'Follow-up and maintenance guidance'], image: 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=1000&q=88', featured: true, sortOrder: 2 },
      { name: 'Clear aligner consultation', category: 'Orthodontics', shortDescription: 'Explore discreet teeth-straightening options with a clinician-led assessment.', description: 'A consultation helps determine whether aligners are suitable. If they are, your dentist will outline the expected stages and follow-up schedule.', durationMinutes: 45, priceFrom: 1500, sessions: 'Consultation followed by planned review visits', recovery: 'Usually no downtime; suitability varies', features: ['Bite and alignment assessment', 'Clear discussion of alternatives', 'Personalised review plan'], image: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=1000&q=88', featured: true, sortOrder: 3 },
      { name: 'Professional cleaning', category: 'Preventive care', shortDescription: 'A refreshing clean to help maintain gum health and keep your smile feeling its best.', description: 'A dental professional assesses your teeth and gums, removes deposits where appropriate, and shares practical home-care guidance.', durationMinutes: 40, priceFrom: 1200, sessions: 'Usually one visit; frequency is individual', recovery: 'You may notice temporary sensitivity', features: ['Gum health review', 'Scaling and polishing as indicated', 'Personalised oral-hygiene advice'], image: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1000&q=88', featured: true, sortOrder: 4 },
      { name: 'Root canal treatment', category: 'Restorative dentistry', shortDescription: 'Relieve dental discomfort with careful diagnosis and a treatment plan for the affected tooth.', description: 'After examination and necessary imaging, the dentist will explain whether root canal treatment is appropriate and what restoration may follow.', durationMinutes: 60, priceFrom: 3500, sessions: 'One or more visits depending on complexity', recovery: 'Aftercare instructions will be provided', features: ['Diagnosis and imaging as needed', 'Step-by-step explanation', 'Restoration and follow-up plan'], image: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1000&q=88', featured: false, sortOrder: 5 },
      { name: 'Children’s dentistry', category: 'Family dentistry', shortDescription: 'Gentle, age-appropriate appointments that help little smiles feel comfortable and cared for.', description: 'We work at a child-friendly pace, explain each step in simple language, and help parents understand prevention and next steps.', durationMinutes: 30, priceFrom: 900, sessions: 'As recommended for the child’s needs', recovery: 'Most routine visits need no downtime', features: ['Comfort-first introduction', 'Parent guidance', 'Preventive care and growth monitoring'], image: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1000&q=88', featured: false, sortOrder: 6 }
    ]);
  }

  if (await Faq.countDocuments() === 0) {
    await Faq.insertMany([
      { question: 'I feel nervous about visiting a dentist. Can you help?', answer: 'Absolutely. Tell us what worries you when you book. Your dentist can talk through each step, discuss comfort options and move at a pace that works for you.', sortOrder: 1 },
      { question: 'How much will my treatment cost?', answer: 'The amount depends on your assessment and the treatment that is clinically appropriate. We share the plan and estimated costs with you before you decide how to proceed.', sortOrder: 2 },
      { question: 'Can I choose a particular dentist?', answer: 'Yes. Select your preferred dentist in the booking form. If you are unsure, choose “No preference” and our team can help match you with the right clinician.', sortOrder: 3 },
      { question: 'What should I bring to my first appointment?', answer: 'Please bring any relevant dental records or recent X-rays, a list of current medicines, and details of any allergies or medical conditions you would like your dentist to know about.', sortOrder: 4 },
      { question: 'Can I reschedule an appointment?', answer: 'Of course. Contact the clinic through WhatsApp or by phone as early as possible, and our team will help find a suitable alternative.', sortOrder: 5 },
      { question: 'Do you accept walk-ins?', answer: 'Appointments are recommended so we can give you the right amount of time. For urgent concerns, call or message the clinic before travelling.', sortOrder: 6 }
    ]);
  }

  // Safe starter content for the Skin & Hair department. Only the consultation is published;
  // procedure-specific examples remain hidden until the dermatologist confirms the clinic menu.
  if (await Treatment.countDocuments({ department: 'skin' }) === 0) {
    await Treatment.insertMany([
      { department: 'skin', name: 'Skin & Hair Consultation', category: 'Dermatology consultation', shortDescription: 'A one-to-one consultation to discuss your skin or hair concern and understand appropriate next steps.', description: 'Your dermatologist will review your concern, relevant history and goals, then explain suitable options. Any treatment recommendation depends on an in-person clinical assessment.', durationMinutes: 30, priceFrom: 0, sessions: 'As advised after consultation', recovery: 'Depends on any treatment recommended', features: ['Personal concern assessment', 'Discussion of appropriate options', 'Individual care guidance'], image: 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?auto=format&fit=crop&w=1200&q=88', featured: true, active: true, sortOrder: 1 },
      { department: 'skin', name: 'Acne & Acne Marks', category: 'Skin consultation', shortDescription: 'Assessment of acne concerns, marks and treatment options.', description: 'A clinician-led assessment is needed to understand the type and severity of acne before a care plan is selected.', durationMinutes: 30, priceFrom: 0, sessions: 'To be confirmed after assessment', recovery: 'Depends on the care plan', features: ['Skin assessment', 'Discussion of options'], image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1200&q=88', featured: false, active: false, sortOrder: 2 },
      { department: 'skin', name: 'Pigmentation & Uneven Tone', category: 'Skin consultation', shortDescription: 'Clinical assessment of pigmentation and uneven skin tone.', description: 'The cause of pigmentation should be assessed before any treatment is recommended. The clinician will discuss realistic options and limitations.', durationMinutes: 30, priceFrom: 0, sessions: 'To be confirmed after assessment', recovery: 'Depends on the care plan', features: ['Concern assessment', 'Individualised recommendations'], image: 'https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=1200&q=88', featured: false, active: false, sortOrder: 3 },
      { department: 'skin', name: 'Hair & Scalp Consultation', category: 'Hair health', shortDescription: 'Assessment of hair fall or scalp concerns and appropriate next steps.', description: 'Hair and scalp concerns can have different causes. An assessment helps determine whether investigations or treatment options are appropriate.', durationMinutes: 30, priceFrom: 0, sessions: 'To be confirmed after assessment', recovery: 'Depends on the care plan', features: ['Hair and scalp history', 'Clinical assessment', 'Care guidance'], image: 'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=1200&q=88', featured: false, active: false, sortOrder: 4 },
      { department: 'skin', name: 'Laser Treatment Assessment', category: 'Laser consultation', shortDescription: 'A consultation to assess suitability and explain risks, benefits and alternatives before any laser procedure.', description: 'Suitability depends on skin type, medical history, treatment area and the device used. A clinician must assess each patient before treatment.', durationMinutes: 30, priceFrom: 0, sessions: 'To be confirmed after assessment', recovery: 'Depends on the procedure', features: ['Suitability assessment', 'Discussion of risks and aftercare'], image: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=88', featured: false, active: false, sortOrder: 5 }
    ]);
  }

  if (await Faq.countDocuments({ department: 'skin' }) === 0) {
    await Faq.insertMany([
      { department: 'skin', question: 'Do I need a consultation before a skin or hair treatment?', answer: 'Yes. A clinician should assess your concern, medical history and suitability before recommending a treatment. The consultation is also the right time to discuss risks, alternatives and expected outcomes.', active: true, sortOrder: 1 },
      { department: 'skin', question: 'Can I book for hair fall or scalp concerns?', answer: 'You can request a Hair & Scalp Consultation. The dermatologist will discuss your history and decide whether an examination or further investigation is appropriate.', active: true, sortOrder: 2 },
      { department: 'skin', question: 'Are treatment results guaranteed?', answer: 'No medical or aesthetic treatment can guarantee a particular result. Outcomes vary between individuals and depend on the diagnosis, treatment plan and response to care.', active: true, sortOrder: 3 },
      { department: 'skin', question: 'How do I know which service to choose?', answer: 'Choose Skin & Hair Consultation if you are unsure. The dermatologist can help identify the concern and explain appropriate options after assessment.', active: true, sortOrder: 4 }
    ]);
  }

  // Reviews are intentionally not fabricated or seeded. Add only genuine, consented patient feedback in /admin.

  if (await Media.countDocuments() === 0) {
    await Media.insertMany([
      { title: 'A calmer space to care for your smile', type: 'image', description: 'A glimpse of a considered, modern dental environment.', url: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=1400&q=88', featured: true, sortOrder: 1 },
      { title: 'Thoughtful care, built around people', type: 'image', description: 'A welcoming treatment and consultation space.', url: 'https://images.unsplash.com/photo-1606811971618-4486d14f3f99?auto=format&fit=crop&w=1400&q=88', featured: false, sortOrder: 2 },
      { title: 'The details matter', type: 'image', description: 'A clean, well-prepared environment for clinical care.', url: 'https://images.unsplash.com/photo-1609840114035-3c981b782dfe?auto=format&fit=crop&w=1400&q=88', featured: false, sortOrder: 3 }
    ]);
  }

  console.log('[seed] Starter content is ready. Demo content should be replaced with client-approved details before launch.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const uri = process.env.MONGODB_URI;
  if (!uri) { console.error('Missing MONGODB_URI in .env'); process.exit(1); }
  mongoose.connect(uri, { serverSelectionTimeoutMS: 10000, family: 4 })
    .then(seedDatabase)
    .then(() => mongoose.disconnect())
    .catch(async error => { console.error(error.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
}
