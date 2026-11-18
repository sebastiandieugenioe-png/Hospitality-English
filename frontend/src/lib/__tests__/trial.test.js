/* Free-trial detection used by the paywall (web purchases-js + native purchases-capacitor). */
import { parseTrialDuration, nativeFreeTrialIso, trialOf, trialLabelKey } from "@/lib/trial";

test("ISO durations -> days or months; invalid -> null", () => {
  expect(parseTrialDuration("P7D")).toEqual({ count: 7, unit: "day" });
  expect(parseTrialDuration("P1W")).toEqual({ count: 7, unit: "day" });
  expect(parseTrialDuration("P1M")).toEqual({ count: 1, unit: "month" });
  expect(parseTrialDuration("P0D")).toBeNull();
  expect(parseTrialDuration(null)).toBeNull();
  expect(parseTrialDuration("7 days")).toBeNull();
});

test("native: free intro (iOS) or free phase (Android); paid intro is not a trial", () => {
  expect(nativeFreeTrialIso({ introPrice: { price: 0, periodUnit: "DAY", periodNumberOfUnits: 7 } })).toBe("P7D");
  expect(nativeFreeTrialIso({ introPrice: { price: 0, period: "P1W" } })).toBe("P1W");
  expect(nativeFreeTrialIso({ introPrice: { price: 1.99, period: "P1M" } })).toBeNull();
  expect(nativeFreeTrialIso({ defaultOption: { freePhase: { billingPeriod: { iso8601: "P3D" } } } })).toBe("P3D");
  expect(nativeFreeTrialIso({})).toBeNull();
});

test("trialOf reads web and native packages", () => {
  expect(trialOf({ webBillingProduct: { freeTrialPhase: { periodDuration: "P7D" } } })).toEqual({ count: 7, unit: "day" });
  expect(trialOf({ webBillingProduct: { freeTrialPhase: null } })).toBeNull();
  expect(trialOf({ nativeProduct: { freeTrialIso: "P2W" } })).toEqual({ count: 14, unit: "day" });
  expect(trialOf(null)).toBeNull();
});

test("label keys", () => {
  expect(trialLabelKey({ count: 7, unit: "day" }, "paywall.trial")).toBe("paywall.trialDays");
  expect(trialLabelKey({ count: 1, unit: "month" }, "paywall.trial")).toBe("paywall.trialMonth");
  expect(trialLabelKey({ count: 3, unit: "month" }, "paywall.trial")).toBe("paywall.trialMonths");
  expect(trialLabelKey(null, "paywall.trial")).toBeNull();
});
