# R Dental — Google Reviews Incremental Patch

This archive is **not a replacement project**. It contains only the files added or changed for Google Business Profile review synchronization and the public review carousel.

## Apply to your existing repository

1. Back up the current repository (and MongoDB Atlas) before deploying.
2. Extract this archive into the root of the existing `aurelia-dental-studio` repository folder, preserving the folder paths.
3. Allow the listed changed files to overwrite their current versions and add the listed new files.
4. Do **not** replace or commit your real `.env` file. Only `.env.example` is included.
5. Run `npm run build`, then commit and push these changes to the branch already connected to your existing Vercel project.
6. Add the five Google variables listed in `GOOGLE-REVIEWS-SETUP.md` to the existing Vercel project's Production environment variables, then redeploy.

No new npm dependencies are required. No new GitHub repository or Vercel project is created.

## Files changed

- `.env.example` — documents server-only Google OAuth/token/cron variables.
- `vercel.json` — adds the daily review sync cron.
- `server/index.js` — Google OAuth callback, admin connect/sync/disconnect routes, public review API, website review moderation flow, daily sync endpoint and cache expiry.
- `server/models.js` — Google review fields, connection model, unique review-ID index and 28-day TTL cache index.
- `src/pages/dental/DentalPage.jsx` — replaces the previous Dental reviews block with the carousel component.
- `src/admin/AdminApp.jsx` — adds the Google Reviews admin tab.
- `src/admin/AdminCollection.jsx` — shows Google source/reply and permits hide/show without editing imported Google text.
- `src/styles.css` — styles the public carousel, website review form and Google Reviews admin screen.

## New files

- `server/googleBusinessProfile.js` — Google OAuth, encrypted refresh-token handling, account/location lookup, paginated review sync, cache expiry and OAuth revocation.
- `src/admin/AdminGoogleReviews.jsx` — connect the client-owned Google Business Profile, select the verified location and sync.
- `src/components/clinic/GoogleReviewsSection.jsx` — six-review carousel and moderated website review form.
- `GOOGLE-REVIEWS-SETUP.md` — detailed Google Cloud, OAuth, Vercel environment and test instructions.

## Important Google requirements

- The dentist/client should own the Google Cloud project and OAuth client used for their Business Profile API access. The dentist or an authorised manager signs in manually through OAuth.
- Google Business Profile API access is not public. The client must request access and enable the relevant APIs.
- The patch temporarily caches Google review content for **28 days from the last successful sync**, then expires it. This is intentionally within Google's stated 30-day maximum for limited temporary storage. Do not remove or lengthen the TTL.
- Website-submitted reviews are separate, unpublished until approved, and are never labelled as Google reviews.
- Vercel Hobby supports daily Cron only. The included schedule is daily. Pro can run more frequently if needed.
