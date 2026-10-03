// Temporary Google auth diagnostics — PREVIEW ONLY.
// Captures operation + error.code/name + sanitized message (+ http status for
// backend calls). Never captures tokens, credentials, email, uid or guest_id.

export const IS_PREVIEW =
  typeof window !== "undefined" &&
  /(^|\.)preview\.emergentagent\.com$/.test(window.location.hostname);

let _last = null;
let _lastJwt = null;
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
    jwt: _lastJwt,
    ts: Date.now(),
  };
  _subs.forEach((cb) => { try { cb(_last); } catch {} });
}

// Safe base64url decode (payload only; never logged).
function b64urlDecode(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  return atob(s);
}

// Inspect a Google ID token locally and record ONLY PASS/FAIL booleans.
// Claim values (aud, iss, exp, email, sub...) are never stored or emitted.
export function inspectGoogleIdToken(token, expectedAud) {
  const flags = { format: false, issuer: false, audience: false, notExpired: false };
  try {
    const parts = String(token || "").split(".");
    flags.format = parts.length === 3;
    if (flags.format) {
      const payload = JSON.parse(b64urlDecode(parts[1]));
      const iss = payload.iss;
      flags.issuer = iss === "accounts.google.com" || iss === "https://accounts.google.com";
      flags.audience = !!expectedAud && payload.aud === expectedAud;
      const now = Math.floor(Date.now() / 1000);
      flags.notExpired = typeof payload.exp === "number" && payload.exp > now;
    }
  } catch { /* keep flags false */ }
  _lastJwt = flags;
  reportAuthDebug("JWT_INSPECT", { code: "ok" });
  return flags;
}

export function subscribeAuthDebug(cb) {
  _subs.add(cb);
  if (_last) cb(_last);
  return () => _subs.delete(cb);
}
