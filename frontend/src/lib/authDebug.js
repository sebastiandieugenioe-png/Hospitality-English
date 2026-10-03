// Temporary Google auth diagnostics — PREVIEW ONLY.
// Captures operation + error.code/name + sanitized message (+ http status for
// backend calls). Never captures tokens, credentials, email, uid or guest_id.

export const IS_PREVIEW =
  typeof window !== "undefined" &&
  /(^|\.)preview\.emergentagent\.com$/.test(window.location.hostname);

let _last = null;
const _subs = new Set();

// Drop anything that looks like a token / JWT / email / long id.
function sanitize(msg) {
  if (!msg) return "";
  const s = String(msg);
  if (/@/.test(s)) return "";                 // email
  if (/eyJ[A-Za-z0-9_-]{8,}/.test(s)) return ""; // JWT
  if (/[A-Za-z0-9_-]{32,}/.test(s)) return "";   // token-like / uid / guest_id
  return s.slice(0, 160);
}

export function reportAuthDebug(operation, info = {}) {
  if (!IS_PREVIEW) return;
  _last = {
    operation,
    code: info.code != null ? info.code : null,
    name: info.name != null ? info.name : null,
    message: sanitize(info.message),
    http_status: info.http_status !== undefined ? info.http_status : null,
    ts: Date.now(),
  };
  _subs.forEach((cb) => { try { cb(_last); } catch {} });
}

export function subscribeAuthDebug(cb) {
  _subs.add(cb);
  if (_last) cb(_last);
  return () => _subs.delete(cb);
}
