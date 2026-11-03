# Google Business Profile Reviews — Existing R Dental V2 Repository Patch

This is an incremental patch for the existing `Dental_v2` repository. It does not replace the project, repository, Vercel project, public-site themes, Skin & Hair site, MongoDB database, appointment system or WhatsApp integration.

## Files in this patch

Updated:
- `server/index.js`
- `server/models.js`
- `src/pages/dental/DentalPage.jsx`
- `src/admin/AdminApp.jsx`
- `src/admin/AdminCollection.jsx`
- `src/styles.css`
- `.env.example`
- `vercel.json`

New:
- `server/googleBusinessProfile.js`
- `src/admin/AdminGoogleReviews.jsx`
- `src/components/clinic/GoogleReviewsSection.jsx`
- `GOOGLE-REVIEWS-SETUP.md`

Do not replace `.env` with `.env.example`. Keep your current local `.env` and add only the new Google variables. Do not commit `.env`.

## What it adds

1. Google OAuth connection from `/admin` for an authorised Business Profile owner/manager.
2. Account and verified-location selection.
3. Paginated Google review import (50 per page), including reviewer display name, original comment, rating, creation date and the clinic's original reply.
4. Stable Google review IDs to prevent duplicate records on repeated syncs.
5. Read-only treatment of Google source records in admin; authorised staff can hide/show imported reviews on the website without changing the Google listing.
6. Public Dental reviews carousel with six cards per page, previous/next controls and touch swipe.
7. Website review submission form. Submissions are stored as unpublished and require admin moderation. They are labelled as website reviews, not Google reviews.
8. Daily Vercel Cron refresh plus a manual **Sync all Google reviews** control in admin.
9. Encrypted Google refresh-token storage in MongoDB using AES-256-GCM. The browser never receives the refresh token.
10. Temporary Google content cache: Google-sourced reviews expire after 28 days from their most recent successful sync. A MongoDB TTL index enforces expiry, and stale summary data is cleared. This is designed to stay within Google's 30-calendar-day maximum for limited, temporary storage.
11. Disconnect attempts to revoke the Google OAuth refresh token and always removes the local token; if remote revocation fails, use Google's Account permissions page to remove access as well.

## Google Cloud setup

The dentist or an authorised manager must participate in this one-time setup.

1. The dentist/client should own the Google Cloud project used for this integration. Because this is an agency-built site, do not route the client's automated Business Profile API use through a shared agency-owned Business Profile API project. The client or their authorised manager must sign in manually through OAuth.
2. In that client-owned Google Cloud project, request/confirm Google Business Profile API access. GBP API access is not public and is not guaranteed simply by creating OAuth credentials. Google may require the Application for Basic API Access to be approved.
3. Enable the Google Business Profile APIs required for account listing, location listing and reviews:
   - My Business Account Management API
   - My Business Business Information API
   - Google My Business / Business Profile Reviews API (the reviews endpoint remains under the Business Profile v4 review resource)
4. Configure the OAuth consent screen and create an OAuth Client ID with application type **Web application**. Keep the OAuth client ID/secret in the existing Vercel project's server-only environment variables.
5. Add the exact authorised redirect URI:
   `https://YOUR-PRODUCTION-DOMAIN/api/google-reviews/callback`
   Replace `YOUR-PRODUCTION-DOMAIN` with the production domain used by the existing Vercel project. It must match `GOOGLE_OAUTH_REDIRECT_URI` exactly.
6. The dentist/manager must use a Google account that has permission to manage the verified R Dental Business Profile location.

OAuth requests use the scope:
`https://www.googleapis.com/auth/business.manage`

## Vercel environment variables

Add these in the existing Vercel project under **Settings → Environment Variables**, Production:

- `GOOGLE_CLIENT_ID` — OAuth Web Client ID
- `GOOGLE_CLIENT_SECRET` — OAuth Web Client Secret
- `GOOGLE_OAUTH_REDIRECT_URI` — `https://YOUR-PRODUCTION-DOMAIN/api/google-reviews/callback`
- `GOOGLE_TOKEN_ENCRYPTION_KEY` — a high-entropy random secret (at least 32 characters)
- `CRON_SECRET` — a separate high-entropy random secret (at least 16 characters)

Generate secrets locally in PowerShell, for example:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Generate a different value for `GOOGLE_TOKEN_ENCRYPTION_KEY` and `CRON_SECRET`. Do not send the values in chat, put them in React/Vite variables, or commit them to Git.

The project also needs valid existing production variables such as `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## Connect and import

1. Deploy the patch to the existing repository; the existing Vercel project will build it automatically.
2. Sign in at `https://YOUR-PRODUCTION-DOMAIN/admin`.
3. Switch the admin department to **Dental**.
4. Open **Google Reviews** in the admin sidebar.
5. Click **Connect Google** and sign in as the dentist or authorised Business Profile manager.
6. Click **Load accounts**, choose the account that owns R Dental, then click **Load locations**.
7. Select the exact verified R Dental location that currently has the 67–68 reviews and save it.
8. Click **Sync all Google reviews**.
9. Verify the imported count in the Google Reviews tab and then open the public Dental homepage.

A 68-review profile should be retrieved over two Google API pages (up to 50 reviews per page). The code fetches all available pages up to a safety cap, not just the first page.

## Ongoing refresh

- The included Vercel Cron calls `/api/cron/google-reviews` once per day. A successful sync refreshes the temporary cache expiry for every review returned by Google.
- Manual sync is available at any time from Admin → Google Reviews.
- Vercel Hobby accounts are limited to one Cron execution per day. On Vercel Pro, the schedule can be changed in `vercel.json` to hourly (`0 * * * *`) if more frequent refresh is required.
- This is scheduled refresh, not instant push notification. A review may take until the next scheduled run to appear unless a staff member clicks Sync.

The cron endpoint is protected by `CRON_SECRET`. Do not remove that check.

## Website reviews

The public Dental reviews section now offers:
- A link to open the official Google review page (using the existing `googleReviewUrl` Clinic Setting).
- A separate website review form.
- A consent checkbox for displaying a submitted review publicly.
- A moderation queue in Admin → Reviews.

Website-submitted reviews are saved as `source: website` and `published: false`. The admin must approve them before they appear. The system does not claim that a website review is a Google review.

Google reviews are fetched from Google and their owner replies are displayed unchanged. Google reviews are read-only in the local admin. Hiding one only affects this website; it does not change the Google Business Profile. Google-sourced review content is kept in MongoDB only as a limited temporary cache, securely, for up to 28 days from its latest successful sync; it then expires automatically. If the integration is disconnected or sync stops for long enough, the cached Google reviews and aggregate summary will expire and stop appearing.

## Testing checklist

After deployment and Google authorization:
1. `/api/health` reports the existing MongoDB connection as healthy.
2. Admin → Google Reviews shows the account connected.
3. Account/location selection shows the correct verified R Dental listing.
4. Sync reports a fetched count matching the available Google reviews.
5. MongoDB does not receive duplicates after running Sync twice.
6. Imported cards show the original Google comment and clinic reply when present.
7. The carousel paginates six reviews at a time and supports touch swiping.
8. Website review form creates an unpublished record.
9. Admin → Reviews can approve that submission.
10. `/api/cron/google-reviews` rejects requests without the correct Bearer `CRON_SECRET`.
11. Google-sourced review cache records have a TTL index and are removed after 28 days without a successful refresh.
12. The dentist can disconnect the integration; the local token is deleted and Google authorization is revoked where Google confirms the request.

If Google API access has not been approved for the Cloud project, the OAuth login may succeed but the accounts/locations/reviews API calls can still return an access or permission error. That is a Google project approval/configuration issue, not a Vercel deployment issue.
