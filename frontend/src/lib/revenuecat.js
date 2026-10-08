// RevenueCat Web SDK service (Test Store, PUBLIC key only).
// Phase 1: init once, identity (anonymous / users.id), read offerings + entitlements.
// No purchases, no paywall, no restore. A RevenueCat outage must never break the app.
import { Purchases } from "@revenuecat/purchases-js";

const RC_ANON_KEY = "rc_anonymous_app_user_id";
const API_KEY = (process.env.REACT_APP_REVENUECAT_API_KEY || "").trim();

export function isRevenueCatConfigured() {
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

export function revenueCatSnapshot() {
  const rc = getRevenueCat();
  return { appUserId: rc.getAppUserId(), anonymous: rc.isAnonymous() };
}

// Purchase a package via the Test Store. Returns the resulting CustomerInfo.
// Throws PurchasesError; UserCancelledError (errorCode 1) signals cancellation.
export async function purchaseRevenueCatPackage(rcPackage) {
  const rc = getRevenueCat();
  const res = await rc.purchase({ rcPackage });
  return res.customerInfo;
}

export async function refreshCustomerInfo() {
  const rc = getRevenueCat();
  return rc.getCustomerInfo();
}
