// RevenueCat native (Capacitor iOS/Android) adapter. Public platform SDK keys only.
// The plugin is dynamically imported so the web bundle path never initialises it.
import { getPlatform } from "@/lib/platform";

const KEYS = {
  ios: process.env.REACT_APP_REVENUECAT_IOS_API_KEY,
  android: process.env.REACT_APP_REVENUECAT_ANDROID_API_KEY,
};

let mod = null;
let configured = false;
const plugin = async () => {
  if (!mod) mod = await import("@revenuecat/purchases-capacitor");
  return mod.Purchases;
};

export const nativeApiKey = () => (KEYS[getPlatform()] || "").trim();

// Native store error -> same numeric codes as purchases-js ErrorCode (shared UI mapping).
export function normalizeNativeError(e) {
  const err = new Error("native_billing_error");
  const code = Number(e?.code);
  err.errorCode = e?.userCancelled || code === 1 ? 1 : code === 35 ? 10 : Number.isFinite(code) ? code : 0;
  return err;
}

const call = async (fn) => {
  try { return await fn(await plugin()); } catch (e) { throw normalizeNativeError(e); }
};

// Native package -> adds `nativeProduct` with the same price shape the paywall already reads.
export function normalizePackage(p) {
  if (!p) return null;
  const pr = p.product || {};
  return {
    ...p,
    nativePackage: p,
    nativeProduct: {
      identifier: pr.identifier,
      price: { formattedPrice: pr.priceString, amountMicros: Math.round((pr.price || 0) * 1e6), currency: pr.currencyCode },
    },
  };
}

const normalizeOffering = (o) => (o ? { ...o, monthly: normalizePackage(o.monthly), annual: normalizePackage(o.annual) } : null);

export async function configureNative(appUserId) {
  if (configured) return;
  const apiKey = nativeApiKey();
  if (!apiKey) throw new Error("REVENUECAT_CONFIG_MISSING");
  await call((P) => P.configure({ apiKey, ...(appUserId ? { appUserID: String(appUserId).trim() } : {}) }));
  configured = true;
}

// desiredId = users.id -> logIn; null -> logOut to a fresh anonymous customer (only if identified).
export async function switchNativeIdentity(desiredId) {
  return call(async (P) => {
    if (desiredId) {
      const id = String(desiredId).trim();
      const { appUserID } = await P.getAppUserID();
      if (appUserID !== id) await P.logIn({ appUserID: id });
      return;
    }
    const { isAnonymous } = await P.isAnonymous();
    if (!isAnonymous) await P.logOut();
  });
}

export async function nativeOfferings() {
  const o = await call((P) => P.getOfferings());
  const all = Object.fromEntries(Object.entries(o?.all || {}).map(([k, v]) => [k, normalizeOffering(v)]));
  return { ...o, all, current: normalizeOffering(o?.current) };
}

export const nativeCustomerInfo = () => call(async (P) => (await P.getCustomerInfo()).customerInfo);
export const nativePurchase = (pkg) => call(async (P) => (await P.purchasePackage({ aPackage: pkg.nativePackage || pkg })).customerInfo);
export const nativeRestore = () => call(async (P) => (await P.restorePurchases()).customerInfo);
export const nativeIsAnonymous = () => call(async (P) => (await P.isAnonymous()).isAnonymous);
