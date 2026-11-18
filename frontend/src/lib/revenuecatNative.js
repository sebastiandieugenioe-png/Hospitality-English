// RevenueCat native (Capacitor iOS/Android) adapter. Public platform SDK keys only.
// The plugin is dynamically imported so the web bundle path never initialises it.
import { getPlatform } from "@/lib/platform";
import { nativeFreeTrialIso } from "@/lib/trial";

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
  const freeTrialIso = nativeFreeTrialIso(pr);
  return {
    ...p,
    nativePackage: p,
    nativeProduct: {
      identifier: pr.identifier,
      price: { formattedPrice: pr.priceString, amountMicros: Math.round((pr.price || 0) * 1e6), currency: pr.currencyCode },
      ...(freeTrialIso ? { freeTrialIso } : {}),
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
  const current = normalizeOffering(o?.current);
  await applyTrialEligibility([...Object.values(all), current]);
  return { ...o, all, current };
}

const INTRO_ELIGIBLE = 2; // INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE
const packagesOf = (offerings) => offerings.flatMap((o) => (o ? [o.monthly, o.annual] : [])).filter(Boolean);

// iOS lists a product's intro offer even when this Apple ID already used it, so the trial is
// only shown when the store confirms eligibility (fail closed: never promise a trial we can't
// honour). Google Play only returns offers the user is eligible for, so Android needs no check.
export async function applyTrialEligibility(offerings) {
  if (getPlatform() !== "ios") return;
  const withTrial = packagesOf(offerings).filter((p) => p.nativeProduct?.freeTrialIso);
  if (!withTrial.length) return;
  let result = {};
  try {
    const ids = [...new Set(withTrial.map((p) => p.nativeProduct.identifier))];
    result = (await (await plugin()).checkTrialOrIntroductoryPriceEligibility({ productIdentifiers: ids })) || {};
  } catch (e) {
    result = {};
  }
  for (const p of withTrial) {
    if (result[p.nativeProduct.identifier]?.status !== INTRO_ELIGIBLE) delete p.nativeProduct.freeTrialIso;
  }
}

export const nativeCustomerInfo = () => call(async (P) => (await P.getCustomerInfo()).customerInfo);
export const nativePurchase = (pkg) => call(async (P) => (await P.purchasePackage({ aPackage: pkg.nativePackage || pkg })).customerInfo);
export const nativeRestore = () => call(async (P) => (await P.restorePurchases()).customerInfo);
export const nativeIsAnonymous = () => call(async (P) => (await P.isAnonymous()).isAnonymous);
