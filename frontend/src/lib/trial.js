// Free-trial detection for paywall packages (web: purchases-js, native: purchases-capacitor).
// Returns a normalized { count, unit: "day" | "month" } or null. Weeks become days.
// Only FREE phases count; paid intro prices are ignored.

export function parseTrialDuration(iso) {
  if (typeof iso !== "string") return null;
  const m = /^P(\d+)([DWMY])$/.exec(iso.trim().toUpperCase());
  if (!m) return null;
  const n = Number(m[1]);
  if (!n) return null;
  if (m[2] === "D") return { count: n, unit: "day" };
  if (m[2] === "W") return { count: n * 7, unit: "day" };
  if (m[2] === "M") return { count: n, unit: "month" };
  return { count: n * 12, unit: "month" };
}

const UNIT_LETTER = { DAY: "D", WEEK: "W", MONTH: "M", YEAR: "Y" };

// Native StoreProduct -> ISO duration of its free trial, or null.
// iOS: introPrice with price 0. Android: defaultOption.freePhase.
export function nativeFreeTrialIso(product) {
  if (!product) return null;
  const intro = product.introPrice;
  if (intro && Number(intro.price) === 0) {
    if (intro.period) return intro.period;
    const letter = UNIT_LETTER[String(intro.periodUnit || "").toUpperCase()];
    const n = Number(intro.periodNumberOfUnits);
    if (letter && n > 0) return `P${n}${letter}`;
  }
  const free = product.defaultOption && product.defaultOption.freePhase;
  if (free && free.billingPeriod && free.billingPeriod.iso8601) return free.billingPeriod.iso8601;
  return null;
}

export function trialOf(pkg) {
  if (!pkg) return null;
  const web = pkg.webBillingProduct || pkg.rcBillingProduct;
  if (web && web.freeTrialPhase) return parseTrialDuration(web.freeTrialPhase.periodDuration);
  if (pkg.nativeProduct && pkg.nativeProduct.freeTrialIso) return parseTrialDuration(pkg.nativeProduct.freeTrialIso);
  return null;
}

// i18n key for the trial label: <base>Days | <base>Month (exactly 1) | <base>Months.
export function trialLabelKey(trial, base) {
  if (!trial) return null;
  if (trial.unit === "month") return `${base}${trial.count === 1 ? "Month" : "Months"}`;
  return `${base}Days`;
}
