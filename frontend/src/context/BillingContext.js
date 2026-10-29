// Central billing state (profession-aware). Follows EnglishToWork's identity:
// anonymous for guests, users.id once authenticated. Phase 1 = read-only.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { PROFESSION_BILLING_CONFIG, billingConfigFor } from "@/lib/billingConfig";
import {
  isRevenueCatConfigured, configureRevenueCat, getRevenueCat,
  switchRevenueCatIdentity, revenueCatSnapshot,
  purchaseRevenueCatPackage, refreshCustomerInfo, rcDiag,
} from "@/lib/revenuecat";

const BillingContext = createContext(null);

export function BillingProvider({ children }) {
  const { account, authReady } = useApp();
  const [status, setStatus] = useState("uninitialized"); // uninitialized|loading|ready|error
  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  // Identity (users.id or null for guest) the current customerInfo/status belongs to.
  const [resolvedFor, setResolvedFor] = useState(undefined);
  const configuredRef = useRef(false);

  const loadState = async () => {
    const rc = getRevenueCat();
    const [offs, info] = await Promise.all([rc.getOfferings(), rc.getCustomerInfo()]);
    setOfferings(offs);
    setCustomerInfo(info);
  };

  // React to identity changes (guest -> account -> logout). Never blocks the app.
  useEffect(() => {
    if (!authReady) return;
    if (!isRevenueCatConfigured()) { setStatus("error"); setResolvedFor(account?.id || null); return; }
    let cancelled = false;
    const desiredId = account?.id || null; // outside try: also used by catch
    (async () => {
      setStatus((s) => (s === "ready" ? s : "loading"));
      try {
        if (!configuredRef.current) {
          configureRevenueCat(desiredId); // init once (anonymous if no account)
          configuredRef.current = true;
        } else {
          await switchRevenueCatIdentity(desiredId);
        }
        await loadState();
        if (!cancelled) { setStatus("ready"); setResolvedFor(desiredId); }
      } catch (e) {
        if (!cancelled) { setStatus("error"); setResolvedFor(desiredId); } // outage: keep free content accessible
      }
    })();
    return () => { cancelled = true; };
  }, [authReady, account?.id]);

  const currentOffering = (professionId) => {
    const cfg = billingConfigFor(professionId);
    if (!cfg || !offerings) return null;
    return offerings.all?.[cfg.offeringId] || null;
  };

  // Entitlement is ALWAYS derived from live RevenueCat CustomerInfo, never localStorage.
  const isPremium = (professionId) => {
    const cfg = billingConfigFor(professionId);
    if (!cfg || !customerInfo) return false;
    return Boolean(customerInfo.entitlements?.active?.[cfg.entitlementId]);
  };

  const getProfessionAccess = (professionId) => {
    const cfg = billingConfigFor(professionId);
    return {
      professionId,
      entitlementId: cfg?.entitlementId || null,
      offeringId: cfg?.offeringId || null,
      premium: isPremium(professionId),
    };
  };

  const refresh = async () => {
    try { await loadState(); setStatus("ready"); }
    catch { setStatus("error"); }
  };

  // Purchase a package (Test Store). purchaseResult.customerInfo is the PRIMARY
  // confirmation. If the entitlement is not yet reflected (Test Store propagation
  // lag), retry getCustomerInfo a few times with short delays before giving up —
  // a slow/failed secondary read must NOT mark a real success as failed.
  const purchase = async (rcPackage, professionId = "hospitality") => {
    const cfg = billingConfigFor(professionId);
    const entId = cfg?.entitlementId;
    const hasEnt = (ci) => Boolean(ci?.entitlements?.active?.[entId]);

    let info = await purchaseRevenueCatPackage(rcPackage); // primary confirmation
    let active = hasEnt(info);
    rcDiag("PURCHASE_RESOLVED", { stage: "after_purchase", entitlementActive: active });

    for (let i = 0; !active && i < 3; i++) {
      await new Promise((r) => setTimeout(r, 700));
      try {
        const refreshed = await refreshCustomerInfo();
        if (refreshed) { info = refreshed; active = hasEnt(refreshed); }
      } catch (e) { rcDiag("REFRESH_FAILED", { attempt: i + 1 }); }
    }

    if (info) setCustomerInfo(info);
    if (!active) rcDiag("ENTITLEMENT_MISSING_AFTER_SUCCESS", { entitlement: entId });
    return { customerInfo: info, premium: active };
  };

  const value = useMemo(() => ({
    status,
    ready: status === "ready",
    resolvedFor,
    customerInfo,
    offerings,
    isPremium,
    getProfessionAccess,
    currentOffering,
    refresh,
    purchase,
  }), [status, resolvedFor, customerInfo, offerings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Test Store env only: expose a read-only snapshot for integration self-tests.
  useEffect(() => {
    if ((process.env.REACT_APP_REVENUECAT_ENV || "") !== "test") return;
    const snap = { status, ready: status === "ready", env: "test" };
    try { Object.assign(snap, revenueCatSnapshot()); } catch { /* not configured yet */ }
    const off = currentOffering("hospitality");
    snap.offeringIds = offerings ? Object.keys(offerings.all || {}) : [];
    snap.hospitalityOffering = off ? off.identifier : null;
    const monthly = off?.monthly || null;
    const annual = off?.annual || null;
    const pid = (p) => (p ? ((p.rcBillingProduct || p.webBillingProduct)?.identifier || p.identifier || null) : null);
    snap.monthlyPresent = !!monthly;
    snap.annualPresent = !!annual;
    snap.monthlyProductId = pid(monthly);
    snap.annualProductId = pid(annual);
    snap.isPremiumHospitality = isPremium("hospitality");
    snap.professionAware = !!PROFESSION_BILLING_CONFIG.hospitality;
    const pkgPrice = (p) => { const pr = p ? ((p.webBillingProduct || p.rcBillingProduct)?.price) : null; return pr ? pr.formattedPrice : null; };
    snap.monthlyPrice = pkgPrice(off?.monthly);
    snap.annualPrice = pkgPrice(off?.annual);
    window.__BILLING__ = snap;
  }, [status, offerings, customerInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used within BillingProvider");
  return ctx;
}
