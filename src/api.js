let activeDepartment = 'dental';

export function setApiDepartment(department) {
  activeDepartment = department === 'skin' ? 'skin' : 'dental';
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isForm = options.body instanceof FormData;

  if (
    options.body &&
    !isForm &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  let response;

  try {
    const requestUrl = new URL(path, window.location.origin);
    if (!requestUrl.searchParams.has('department')) {
      requestUrl.searchParams.set('department', activeDepartment);
    }
    response = await fetch(`/api${requestUrl.pathname}${requestUrl.search}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error(
      "The clinic API is unreachable. Please check the deployment and API logs."
    );
  }

  const contentType =
    response.headers.get("content-type") || "";

  // Every API endpoint in this application should return JSON.
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      `Invalid API response for /api${path}. ` +
      `Expected JSON but received ${contentType || "an unknown content type"} ` +
      `(HTTP ${response.status}). Check Vercel routing and function logs.`
    );
  }

  let body;

  try {
    body = await response.json();
  } catch {
    throw new Error(
      `The API returned invalid JSON for /api${path}.`
    );
  }

  if (!response.ok) {
    throw new Error(
      typeof body === "object" && body?.error
        ? body.error
        : `API request failed with HTTP ${response.status}.`
    );
  }

  return body;
}
export const json = data => JSON.stringify(data);
export const money = value => value ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value) : 'On assessment';
export const dateLabel = value => {
  if (!value) return '—';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};
export const timeLabel = value => {
  if (!value) return '—';
  const [h, m] = value.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const waNumber = value => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return digits;
};
