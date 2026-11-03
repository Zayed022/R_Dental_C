import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from 'node:crypto';
import { GoogleBusinessConnection, Review } from './models.js';

const BUSINESS_SCOPE = 'https://www.googleapis.com/auth/business.manage';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured in the server environment.`);
  return value;
}

function encryptionKey() {
  const secret = requiredEnv('GOOGLE_TOKEN_ENCRYPTION_KEY');
  // Derive a fixed 32-byte AES key from the configured high-entropy secret.
  return createHash('sha256').update(secret).digest();
}

export function encryptGoogleRefreshToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(part => part.toString('base64')).join('.');
}

export function decryptGoogleRefreshToken(value) {
  if (!value) throw new Error('Google Business Profile is not connected. Reconnect the Google account.');
  const [ivPart, tagPart, encryptedPart] = String(value).split('.');
  if (!ivPart || !tagPart || !encryptedPart) throw new Error('Stored Google connection is invalid. Reconnect the Google account.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

export function buildGoogleAuthorizationUrl(state, redirectUri) {
  const params = new URLSearchParams({
    client_id: requiredEnv('GOOGLE_CLIENT_ID'),
    redirect_uri: redirectUri || requiredEnv('GOOGLE_OAUTH_REDIRECT_URI'),
    response_type: 'code',
    scope: BUSINESS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function parseGoogleResponse(response, label) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || data?.error_description || `${label} failed (HTTP ${response.status}).`;
    const error = new Error(message);
    error.status = response.status === 401 || response.status === 403 ? 502 : 400;
    throw error;
  }
  return data;
}

export async function exchangeGoogleAuthorizationCode(code, redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: requiredEnv('GOOGLE_CLIENT_ID'),
    client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
    redirect_uri: redirectUri || requiredEnv('GOOGLE_OAUTH_REDIRECT_URI'),
    grant_type: 'authorization_code'
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  return parseGoogleResponse(response, 'Google OAuth token exchange');
}

export async function getGoogleAccessToken(connection) {
  const refreshToken = decryptGoogleRefreshToken(connection.refreshTokenEncrypted);
  const body = new URLSearchParams({
    client_id: requiredEnv('GOOGLE_CLIENT_ID'),
    client_secret: requiredEnv('GOOGLE_CLIENT_SECRET'),
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const token = await parseGoogleResponse(response, 'Google access-token refresh');

  // Google may rotate refresh tokens. Persist a rotated token securely when returned.
  if (token.refresh_token) {
    connection.refreshTokenEncrypted = encryptGoogleRefreshToken(token.refresh_token);
    await connection.save();
  }
  return token.access_token;
}

async function googleGet(url, accessToken, label) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json'
    }
  });
  return parseGoogleResponse(response, label);
}

export async function listGoogleAccounts(connection) {
  const accessToken = await getGoogleAccessToken(connection);
  const accounts = [];
  let pageToken = '';
  let pages = 0;
  do {
    const url = new URL('https://mybusinessaccountmanagement.googleapis.com/v1/accounts');
    url.searchParams.set('pageSize', '20');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const result = await googleGet(url, accessToken, 'Google Business Profile account listing');
    accounts.push(...(result.accounts || []));
    pageToken = result.nextPageToken || '';
    pages += 1;
  } while (pageToken && pages < 5);
  return accounts.map(account => ({
    name: account.name,
    title: account.accountName || account.name,
    type: account.type || ''
  }));
}

export async function listGoogleLocations(connection, accountName) {
  if (!/^accounts\/[A-Za-z0-9_-]+$/.test(String(accountName || ''))) {
    const error = new Error('Choose a valid Google Business Profile account.');
    error.status = 400;
    throw error;
  }
  const accessToken = await getGoogleAccessToken(connection);
  const locations = [];
  let pageToken = '';
  let pages = 0;
  do {
    const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`);
    url.searchParams.set('readMask', 'name,title,storeCode,websiteUri');
    url.searchParams.set('pageSize', '100');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const result = await googleGet(url, accessToken, 'Google Business Profile location listing');
    locations.push(...(result.locations || []));
    pageToken = result.nextPageToken || '';
    pages += 1;
  } while (pageToken && pages < 10);
  return locations.map(location => ({
    name: location.name,
    title: location.title || location.storeCode || location.name,
    websiteUri: location.websiteUri || ''
  }));
}

function googleRating(value) {
  const map = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  return map[String(value || '').toUpperCase()] || 5;
}

function validGooglePhoto(value) {
  if (!value) return '';
  try {
    const normalized = String(value).startsWith('//') ? `https:${value}` : String(value);
    return new URL(normalized).protocol === 'https:' ? normalized : '';
  } catch {
    return '';
  }
}

export async function syncGoogleReviews(connection, googleProfileUrl = '') {
  if (!connection?.accountName || !connection?.locationName) {
    const error = new Error('Select the verified Google Business Profile location before syncing reviews.');
    error.status = 400;
    throw error;
  }

  const accessToken = await getGoogleAccessToken(connection);
  const parent = `${connection.accountName}/${connection.locationName}`;
  const reviews = [];
  let pageToken = '';
  let pageCount = 0;
  let totalReviewCount = 0;
  let averageRating = 0;

  do {
    const url = new URL(`https://mybusiness.googleapis.com/v4/${parent}/reviews`);
    url.searchParams.set('pageSize', '50');
    url.searchParams.set('orderBy', 'updateTime desc');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const result = await googleGet(url, accessToken, 'Google Business Profile reviews sync');
    reviews.push(...(result.reviews || []));
    pageToken = result.nextPageToken || '';
    pageCount += 1;
    if (Number.isFinite(Number(result.totalReviewCount))) totalReviewCount = Number(result.totalReviewCount);
    if (Number.isFinite(Number(result.averageRating))) averageRating = Number(result.averageRating);
  } while (pageToken && pageCount < 30);

  const operations = reviews.map(review => {
    const googleReviewId = review.reviewId || String(review.name || '').split('/').pop();
    if (!googleReviewId) return null;
    const ownerReply = review.reviewReply?.comment || '';
    const reviewer = review.reviewer || {};
    const values = {
      source: 'google',
      department: 'dental',
      googleReviewId,
      patientName: reviewer.isAnonymous ? 'Google reviewer' : (reviewer.displayName || 'Google reviewer'),
      reviewerPhotoUrl: validGooglePhoto(reviewer.profilePhotoUrl),
      quote: String(review.comment || ''),
      rating: googleRating(review.starRating),
      treatmentLabel: 'Google review',
      reviewDate: review.createTime ? new Date(review.createTime) : null,
      ownerReply: String(ownerReply),
      ownerReplyDate: review.reviewReply?.updateTime ? new Date(review.reviewReply.updateTime) : null,
      googleProfileUrl,
      googleReviewResource: String(review.name || '').slice(0, 500),
      lastGoogleSyncAt: new Date()
    };
    return {
      updateOne: {
        filter: { department: 'dental', googleReviewId },
        update: {
          $set: values,
          $setOnInsert: { published: true }
        },
        upsert: true
      }
    };
  }).filter(Boolean);

  let bulkResult = { upsertedCount: 0, modifiedCount: 0 };
  if (operations.length) {
    bulkResult = await Review.bulkWrite(operations, { ordered: false });
  }

  connection.lastSyncedAt = new Date();
  connection.lastSyncError = '';
  connection.totalReviewCount = totalReviewCount || reviews.length;
  connection.averageRating = averageRating || (reviews.length
    ? reviews.reduce((sum, review) => sum + googleRating(review.starRating), 0) / reviews.length
    : 0);
  await connection.save();

  return {
    fetched: reviews.length,
    imported: bulkResult.upsertedCount || 0,
    updated: bulkResult.modifiedCount || 0,
    totalReviewCount: connection.totalReviewCount,
    averageRating: connection.averageRating,
    pages: pageCount,
    syncedAt: connection.lastSyncedAt
  };
}


/**
 * Revoke the Google OAuth refresh token when the clinic disconnects.
 * Google review content is also removed once its temporary cache window expires.
 */
export async function revokeGoogleAuthorization(connection) {
  if (!connection?.refreshTokenEncrypted) return false;
  const refreshToken = decryptGoogleRefreshToken(connection.refreshTokenEncrypted);
  const response = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: refreshToken })
  });
  if (!response.ok) {
    const error = new Error(`Google token revocation failed (HTTP ${response.status}).`);
    error.status = 502;
    throw error;
  }
  return true;
}

/**
 * Google Business Profile API policies permit only temporary storage of API
 * content. Keep reviews for 28 days after the most recent successful sync.
 * A TTL index on Review.lastGoogleSyncAt provides database-level expiry; this
 * helper also removes stale rows and clears stale aggregate/location labels.
 */
export async function expireStaleGoogleReviewCache(now = new Date()) {
  const cutoff = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const [deleted, cleared] = await Promise.all([
    Review.deleteMany({
      source: 'google',
      lastGoogleSyncAt: { $lt: cutoff }
    }),
    GoogleBusinessConnection.updateMany(
      { department: 'dental', lastSyncedAt: { $lt: cutoff } },
      { $set: {
        averageRating: 0,
        totalReviewCount: 0,
        lastSyncedAt: null,
        accountTitle: '',
        locationTitle: ''
      } }
    )
  ]);
  return {
    deletedReviewCount: Number(deleted.deletedCount || 0),
    clearedSummaryCount: Number(cleared.modifiedCount || 0)
  };
}
