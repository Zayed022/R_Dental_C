# R Dental Clinic — Dental + Skin & Hair Platform

A React/Vite clinic website and patient-management workspace using Express, Mongoose and MongoDB Atlas. The app deploys to one Vercel project: the website is served as static assets and `/api/*` is handled by a Vercel Function in the same project. No separate Render backend is required.

## What changed in this update

- The existing Dental homepage, section content, booking flow, imagery, animation and colour system are retained. The only new control on the Dental homepage is the clearly labelled **Skin & Hair** department switch beside the existing booking controls.
- A separate `/skin-hair` patient experience has been added with a light-blue, deep-navy and teal palette based on the R Dental logo.
- Both departments use the same authenticated `/admin` workspace. A department switch in the admin header separates all appointment, doctor, service, gallery/video, FAQ, review, dashboard and clinic-setting views.
- The frontend is split into feature files under `src/pages`, `src/admin`, `src/components`, `src/hooks` and `src/data`; `src/main.jsx` is now only the application entry/router.
- MongoDB documents now carry a `department` field (`dental` or `skin`). Existing records without that field are treated as Dental, so the update does not require deleting or recreating current clinic records.
- Each department has its own settings record. Dental keeps the existing `main` settings key; Skin & Hair uses the `skin` key.
- The patient journey can be tracked as New request, First visit, Follow-up 1, Follow-up 2, Final/review visit or Treatment completed. Staff can send approved WhatsApp templates through Meta Cloud API and inspect provider delivery status, or use a prefilled manual WhatsApp draft when Cloud API is not configured.
- The admin dashboard now includes a 7-day appointment activity view, filtered to the selected department.

## Department URLs

| URL | Purpose |
|---|---|
| `/` | Existing Dental website |
| `/skin-hair` | Skin & Hair website |
| `/admin` | Shared administrator login and workspace |

The website switch works both ways: Dental → Skin & Hair and Skin & Hair → Dental. The admin is shared; selecting a department changes the data being managed without creating a second login.

## Data and admin management

### Dental

Existing dentists, treatments, appointments, media, FAQs, reviews and settings remain in the Dental department. Records without a department value are included in Dental queries for backward compatibility.

### Skin & Hair

The database seed adds separate Skin & Hair settings, FAQs and a general Skin & Hair consultation service. Additional example service cards are inserted as **inactive drafts**, not publicly advertised treatments. The actual dermatologist profile is intentionally not fabricated: add the clinician's approved name, qualifications, registration details, experience, photograph, specialities and availability through Admin → Skin & Hair → Dermatologists.

Before enabling any procedure-specific service, have the dermatologist confirm that the clinic provides it, the correct description, suitability criteria, risks, aftercare, pricing and expected duration. The included stock photography is illustrative and should be replaced with the clinic's own licensed, approved photos before launch. Patient reviews and identifiable photos/videos should only be published with appropriate patient consent.

### Admin features

- Dashboard statistics and a seven-day appointment activity chart.
- Appointment inbox, patient contact details, date/time, service and assigned clinician. Skin & Hair booking also captures how the patient discovered the clinic (Google, social media, referral, walk-in, etc.).
- Appointment status: Pending, Confirmed, Completed or Cancelled.
- Patient journey stage: New request, First visit, Follow-up 1, Follow-up 2, Final/review visit or Treatment completed.
- Rescheduling, clinician/service assignment, internal notes and slot availability checks.
- WhatsApp booking confirmation attempts to opted-in patients and selected clinicians who have a WhatsApp number and have enabled booking alerts; visit-stage and completion messages; per-message audit and delivery status.
- Create, update, hide and remove clinician profiles and service records.
- Upload gallery images/videos or add externally hosted HTTPS media URLs.
- Manage FAQs, patient reviews and department-specific clinic settings.
- Edit public-page copy, hours, contact details and patient communication templates.

**WhatsApp behavior:** when Meta WhatsApp Cloud API credentials, approved templates and webhook configuration are present, the backend sends booking and visit-stage template messages. Patient-initiated clinic messages are only attempted when the patient has explicitly opted in; selected clinician alerts require a clinician WhatsApp number and the clinician's booking-alert setting to be enabled. If Cloud API is not configured, visit-stage actions open a prefilled `wa.me` draft for staff to review and send manually. The website never claims that opening a draft sends a message. Meta's API acceptance is not proof of delivery; `sent`, `delivered`, `read` and `failed` updates are recorded from provider webhooks. Future follow-ups are not dispatched by an unattended timer: the admin shows due/overdue items and staff review and send the appropriate stage.

## Local setup (Windows PowerShell)

### Requirements

- Node.js 20.19+ (Node 22 LTS recommended) or a compatible newer LTS release.
- npm.
- A MongoDB Atlas cluster and database user.

### 1. Create your environment file

The download contains `.env.example`, not a populated `.env`. This is intentional: database passwords and JWT secrets must not be packaged into a shared ZIP or committed to Git.

```powershell
Copy-Item .env.example .env
notepad .env
```

Set at least:

```dotenv
MONGODB_URI=mongodb+srv://DB_USERNAME:DB_PASSWORD@YOUR_CLUSTER.mongodb.net/aurelia_dental?retryWrites=true&w=majority
ADMIN_EMAIL=admin@yourclinic.in
ADMIN_PASSWORD=replace-with-a-unique-password-of-at-least-12-characters
JWT_SECRET=replace-with-a-random-secret-of-at-least-32-characters
COOKIE_NAME=r_dental_admin
CLINIC_TIME_ZONE=Asia/Kolkata
```

Also set the actual clinic contact values (`CLINIC_PHONE`, `CLINIC_WHATSAPP`, `CLINIC_EMAIL`, `CLINIC_ADDRESS`, `CLINIC_CITY`). Encode reserved characters in the MongoDB password before placing it in the URI. Never put `MONGODB_URI`, `JWT_SECRET`, or administrator credentials in a `VITE_` variable.

### 2. Install and run

```powershell
npm install
npm run dev
```

`npm run dev` verifies the MongoDB connection and setup before starting the Express API and Vite. Open:

- Dental website: `http://localhost:5173/`
- Skin & Hair: `http://localhost:5173/skin-hair`
- Admin: `http://localhost:5173/admin`
- API health: `http://localhost:4000/api/health`

The first successful database setup seeds the new Skin & Hair settings and starter content using the `seed-v2` bootstrap lock. It does not overwrite existing clinic records. Do not clear your production database to apply this update.

### Optional commands

```powershell
npm run db:check
npm run seed
npm run admin:reset
npm run build
```

## Vercel deployment (single project)

1. Commit the updated project (but **not** `.env`, `node_modules`, or local uploads) to your existing GitHub repository.
2. Import or redeploy that repository in the same Vercel project.
3. Keep the Vite build command (`npm run build`) and output directory (`dist`). Keep the included `vercel.json` API gateway/rewrite configuration.
4. Set these Vercel Production Environment Variables:
   - `MONGODB_URI`
   - `ADMIN_EMAIL`
   - `ADMIN_PASSWORD`
   - `JWT_SECRET`
   - `COOKIE_NAME`
   - `CLINIC_TIME_ZONE`
   - `CLINIC_PHONE`, `CLINIC_WHATSAPP`, `CLINIC_EMAIL`, `CLINIC_ADDRESS`, `CLINIC_CITY`
5. Confirm MongoDB Atlas Network Access permits your Vercel deployment's database connections.
6. Deploy, then verify `/api/health`, `/`, `/skin-hair`, `/admin`, and both appointment flows.
7. In `/admin`, switch to Skin & Hair and add the real dermatologist profile, confirm the service menu, upload approved images/reels and update the department's settings.

Vercel Functions have a request-body limit; direct media uploads are capped in the server code. For larger video files, use the existing **Add hosted URL** option with a direct HTTPS media URL, or later add a dedicated media CDN without changing appointment records.

## Frontend structure

```text
src/
├── main.jsx
├── api.js
├── styles.css
├── skin.css
├── data/
│   └── clinicDefaults.js
├── hooks/
│   └── useClinicData.js
├── components/
│   └── clinic/
│       └── ClinicComponents.jsx
├── pages/
│   ├── dental/
│   │   └── DentalPage.jsx
│   └── skin/
│       └── SkinHairPage.jsx
└── admin/
    ├── AdminApp.jsx
    ├── AdminLogin.jsx
    ├── AdminOverview.jsx
    ├── AdminAppointments.jsx
    ├── AdminCollection.jsx
    ├── AdminMedia.jsx
    ├── AdminSettings.jsx
    └── AdminUI.jsx
```

Server files remain in `server/` and continue to use the existing MongoDB Atlas connection and GridFS media storage.

## Production checklist

- Back up the MongoDB database before deploying the schema extension.
- Set production secrets in Vercel, not in source files.
- Add the real dermatologist profile and verify professional qualifications and registration details before publication.
- Review each service and its clinical copy with the relevant clinician; activate only services the clinic actually offers.
- Replace illustrative stock imagery with the clinic's approved photography and video.
- Test booking for each department, including availability, time-zone handling, admin rescheduling and patient communication.
- Configure the Meta WhatsApp Business Platform, approve the four Utility templates, verify the webhook and test a consenting patient plus a clinician who has enabled alerts.
- Verify website privacy notice, terms, contact information, backups, monitoring and access to the administrator account.

## Validation note

The backend JavaScript passes Node syntax checks and frontend module paths/import exports were statically checked. A full Vite production build could not be completed in the packaging environment because npm could not reach the registry to reinstall platform-specific optional dependencies (`EAI_AGAIN`). Run `npm install` and `npm run build` in your local Windows environment before deploying. No claim is made that a live MongoDB/Vercel deployment was tested from this environment.


## Dental brand theme update

The public Dental experience uses a logo-aligned navy and teal palette in `src/dental-theme.css`. All overrides are scoped under `.site-shell`; Skin & Hair remains styled independently in `src/skin.css`. See `DENTAL-LOGO-THEME-UPDATE.md` for the change scope.


## Branch, patient and WhatsApp operations

- Dynamic branch cards are managed from Admin → Branches. Each branch can have its own address, facilities, opening hours, clinicians and available services. Patients choose a branch during booking; availability is checked against that branch.
- Admin → Patients supports manual walk-in patient entry and stores visit records alongside website bookings.
- Appointment records support a treatment journey (new request, first visit, follow-ups 1 and 2, final/review visit, completed), next follow-up date/time, visit history and WhatsApp message audit records.
- WhatsApp automation uses Meta WhatsApp Business Cloud API. The patient must explicitly opt in at booking; each selected clinician must have a WhatsApp number and have booking alerts enabled in their admin profile. If a clinician is not selected, there is no individual doctor alert recipient. Clinician alerts are opt-in and disabled by default until the clinic records agreement.
- Configure the WhatsApp environment variables and approved Meta message templates using [WHATSAPP-BUSINESS-SETUP.md](./WHATSAPP-BUSINESS-SETUP.md). `accepted` means Meta accepted the API request; delivery/sent/read states are updated through the webhook. Booking confirmation automation is attempted at booking. Follow-up/completion automation is triggered by the receptionist using the stage action. If Cloud API is not configured, that stage action opens a prefilled WhatsApp draft for staff to review and send manually.
- Configure the real Google Business Profile review URL in each department's Clinic Settings before marking a treatment completed and sending the final review-request message.
- See [OPERATIONS-V2-ADDITIONS.md](./OPERATIONS-V2-ADDITIONS.md) for admin instructions.
