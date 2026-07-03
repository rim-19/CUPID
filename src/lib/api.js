/* Thin client over the backend REST API. Same-origin so the session cookie set
   by the server rides along automatically. Every call returns parsed JSON and
   throws an Error (with .status and .data) on a non-2xx response, so callers can
   show the server's message. Safe to import during SSR: nothing here runs until
   a method is actually called (which only happens in the browser). */

const BASE = '/api';
const SAFE = { GET: true, HEAD: true };

/* Read the (non-httpOnly) CSRF cookie the server set, to echo it back in a
   header on state-changing requests. SSR-safe: no document, no token. */
function csrfToken() {
  if (typeof document === 'undefined') return '';
  const m = document.cookie.match(/(?:^|;\s*)cupid_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!SAFE[method]) headers['X-CSRF-Token'] = csrfToken();
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Request failed (' + res.status + ').');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* Multipart upload (e.g. ebook files). The browser sets the multipart
   Content-Type/boundary itself, so we only attach the CSRF header. */
async function upload(path, formData) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken() },
    body: formData,
    credentials: 'same-origin',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Upload failed (' + res.status + ').');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  del: (path, body) => request(path, { method: 'DELETE', body }),
  upload,
};
