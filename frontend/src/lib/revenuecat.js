// RevenueCat service (PUBLIC keys only). Web = purchases-js; iOS/Android delegate to
// revenuecatNative.js. A RevenueCat outage must never break the app.
import { Purchases } from "@revenuecat/purchases-js";
import { isNative } from "@/lib/platform";
import * as native from "@/lib/revenuecatNative";

const RC_ANON_KEY = "rc_anonymous_app_user_id";
const API_KEY = (process.env.REACT_APP_REVENUECAT_API_KEY || "").trim();

export function isRevenueCatConfigured() {
  if (isNative()) return !!native.nativeApiKey();
  return !!API_KEY; // Test Store public key present (starts with "test_")
}

function getOrCreateAnonymousId() {
  const existing = localStorage.getItem(RC_ANON_KEY);
  if (existing) return existing;
  const id = Purchases.generateRevenueCatAnonymousAppUserId();
  localStorage.setItem(RC_ANON_KEY, id);
  return id;
}

let instance = null;

// Configure exactly once per browser runtime.
// appUserId falsy -> anonymous RevenueCat customer. When identified, the id MUST be
// our internal backend users.id (never Firebase UID, email or guest_id).
export function configureRevenueCat(appUserId) {
  if (isNative()) return native.configureNative(appUserId);
  if (instance) return instance;
  if (!API_KEY) throw new Error("REVENUECAT_CONFIG_MISSING");
  const id = (appUserId && String(appUserId).trim()) || getOrCreateAnonymousId();
  instance = Purchases.configure({ apiKey: API_KEY, appUserId: id });
  return instance;
}

export function getRevenueCat() {
  return Purchases.getSharedInstance();
}

// Identity switch following EnglishToWork's central identity.
// desiredId truthy  -> logIn(users.id)      (guest -> account)
// desiredId falsy   -> fresh anonymous customer (logout)
export async function switchRevenueCatIdentity(desiredId) {
  if (isNative()) return native.switchNativeIdentity(desiredId);
  const rc = getRevenueCat();
  const current = rc.getAppUserId();
  if (desiredId) {
    const id = String(desiredId).trim();
    if (current === id) return rc.getCustomerInfo();
    return rc.changeUser(id);
  }
  if (rc.isAnonymous()) return rc.getCustomerInfo();
  const anon = Purchases.generateRevenueCatAnonymousAppUserId();
  localStorage.setItem(RC_ANON_KEY, anon);
  return rc.changeUser(anon);
}

export async function fetchOfferings() {
  if (isNative()) return native.nativeOfferings();
  return getRevenueCat().getOfferings();
}

export function revenueCatSnapshot() {
  if (isNative()) return { platform: "native" };
  const rc = getRevenueCat();
  return { appUserId: rc.getAppUserId(), anonymous: rc.isAnonymous() };
}

// Purchase a package via the Test Store. Returns the resulting CustomerInfo
// (the PRIMARY confirmation of entitlement). Throws PurchasesError; UserCancelled
// (errorCode 1) signals cancellation.
export async function purchaseRevenueCatPackage(rcPackage) {
  if (isNative()) return native.nativePurchase(rcPackage);
  const rc = getRevenueCat();
  const res = await rc.purchase({ rcPackage });
  return res.customerInfo;
}

export async function refreshCustomerInfo() {
  if (isNative()) return native.nativeCustomerInfo();
  const rc = getRevenueCat();
  return rc.getCustomerInfo();
}

// Native store restore only (web has no store to restore from).
export async function restoreRevenueCatPurchases() {
  if (!isNative()) throw new Error("RESTORE_UNSUPPORTED_ON_WEB");
  return native.nativeRestore();
}

// Current App User ID kind for safe diagnostics (never logs the raw id).
export function appUserIdKind() {
  if (isNative()) return "native";
  try {
    const rc = getRevenueCat();
    return rc.isAnonymous() ? "anonymous" : "internal-user";
  } catch { return "unconfigured"; }
}

// Safe diagnostic logger (Test env only). Never logs API keys, tokens or raw ids.
export function rcDiag(stage, extra = {}) {
  if ((process.env.REACT_APP_REVENUECAT_ENV || "") !== "test") return;
  try { console.log("[RC_DIAG]", stage, { appUser: appUserIdKind(), ...extra }); }
  catch { /* noop */ }
}
