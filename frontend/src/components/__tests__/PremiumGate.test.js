/* Implementation 9: Premium entry/paywall/subscription flows (RevenueCat + auth mocked). */
import { act } from "react";
import { createRoot } from "react-dom/client";

const mockApp = {};
const mockBilling = {};
const mockToast = { error: jest.fn() };
const mockNative = { native: false };
const mockApi = { refreshEntitlement: jest.fn(async () => ({})) };
jest.mock("@/context/AppContext", () => ({ useApp: () => mockApp }));
jest.mock("@/context/BillingContext", () => ({ useBilling: () => mockBilling }));
jest.mock("react-router-dom", () => ({ useNavigate: () => () => {}, Link: ({ children }) => <a>{children}</a> }), { virtual: true });
jest.mock("sonner", () => ({ toast: mockToast }));
jest.mock("@/lib/firebase", () => ({ renderGisButton: async () => {}, GOOGLE_CLIENT_ID: "", APPLE_ENABLED: true }));
jest.mock("@/lib/platform", () => ({ isNative: () => mockNative.native }));
jest.mock("@/lib/nativeAuth", () => ({ nativeGoogleIdToken: async () => "x" }));
jest.mock("@/lib/revenuecat", () => ({ rcDiag: () => {} }));
jest.mock("@/lib/api", () => mockApi);

const { PremiumProvider, usePremium, purchaseErrorMessage } = require("@/components/PremiumGate");
const Subscription = require("@/pages/Subscription").default;

global.IS_REACT_ACT_ENVIRONMENT = true;
const t = (k, p) => (p ? `${k}:${JSON.stringify(p)}` : k);
const pkg = (id, micros) => ({ identifier: id, webBillingProduct: { identifier: id, price: { formattedPrice: `€${micros / 1e6}`, amountMicros: micros, currency: "EUR" } } });
const offering = { annual: pkg("annual", 50e6), monthly: pkg("monthly", 6e6) };

let root, el, api;
const Trigger = () => { api = usePremium(); return null; };
const setBilling = (o) => Object.assign(mockBilling, {
  status: "ready", ready: true, premium: false, customerInfo: null,
  isPremium() { return this.premium; }, currentOffering: () => offering,
  purchase: jest.fn(), refresh: jest.fn(), restore: jest.fn(), ...o,
});
const render = async (ui) => { await act(async () => { root.render(ui); }); await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const provider = () => <PremiumProvider><Trigger /></PremiumProvider>;
const q = (id) => el.querySelector(`[data-testid="${id}"]`);
const click = async (id) => { await act(async () => { q(id).click(); }); await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

beforeEach(() => {
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
  Object.assign(mockApp, { t, language: "en", isAuthenticated: true, connectGoogle: jest.fn(), connectApple: jest.fn() });
  mockNative.native = false;
  mockToast.error = jest.fn();
  mockApi.refreshEntitlement = jest.fn(async () => ({}));
  setBilling({});
});
afterEach(() => { act(() => root.unmount()); el.remove(); });

describe("entry points while access is unresolved", () => {
  test("loading -> pending sheet (no toast, no paywall), then paywall for Free", async () => {
    setBilling({ status: "loading", ready: false });
    await render(provider());
    await act(async () => api.requestPremium());
    expect(q("premium-pending")).not.toBeNull();
    expect(q("premium-paywall")).toBeNull();
    expect(mockToast.error).not.toHaveBeenCalled();
    setBilling({ status: "ready" });
    await render(provider());
    expect(q("premium-pending")).toBeNull();
    expect(q("premium-paywall")).not.toBeNull();
  });
  test("loading -> resolves Premium -> resume runs, no paywall", async () => {
    const resume = jest.fn();
    setBilling({ status: "loading", ready: false });
    await render(provider());
    await act(async () => api.requestPremium({ resume }));
    setBilling({ status: "ready", premium: true });
    await render(provider());
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(q("premium-paywall")).toBeNull();
  });
  test("loading -> error -> closes with calm toast", async () => {
    setBilling({ status: "loading", ready: false });
    await render(provider());
    await act(async () => api.requestPremium());
    setBilling({ status: "error", ready: false });
    await render(provider());
    expect(q("premium-pending")).toBeNull();
    expect(mockToast.error).toHaveBeenCalledWith("paywall.unavailable");
  });
  test("guest -> account gate; after sign-in waits for identity, then existing Premium resumes", async () => {
    const resume = jest.fn();
    mockApp.isAuthenticated = false;
    await render(provider());
    await act(async () => api.requestPremium({ resume }));
    expect(q("premium-account-gate")).not.toBeNull();
    mockApp.isAuthenticated = true;
    setBilling({ status: "loading", ready: false });
    await render(provider());
    expect(q("premium-pending")).not.toBeNull();
    expect(q("premium-paywall")).toBeNull();
    setBilling({ status: "ready", premium: true });
    await render(provider());
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(q("premium-paywall")).toBeNull();
  });
  test("already Premium -> resume immediately (locked content opens)", async () => {
    const resume = jest.fn();
    setBilling({ premium: true });
    await render(provider());
    await act(async () => api.requestPremium({ resume }));
    expect(resume).toHaveBeenCalledTimes(1);
    expect(q("premium-paywall")).toBeNull();
  });
});

describe("paywall", () => {
  const open = async () => { await render(provider()); await act(async () => api.requestPremium({ resume: jest.fn() })); };
  test("explicit Subscribe CTA, prices, renewal note, legal links, annual not deceptive", async () => {
    await open();
    expect(q("paywall-continue").textContent).toContain("paywall.subscribe");
    expect(q("paywall-plan-annual-price").textContent).toBe("€50");
    expect(q("paywall-plan-monthly-price").textContent).toBe("€6");
    expect(q("paywall-renewal-note").textContent).toBe("paywall.renewalNote");
    expect(q("paywall-terms-link").getAttribute("href")).toBe("/terms");
    expect(q("paywall-privacy-link").getAttribute("href")).toBe("/privacy");
    expect(el.textContent).not.toMatch(/restore/i);
  });
  test("purchase success -> entitlement refreshed -> success -> continue resumes once", async () => {
    const resume = jest.fn();
    mockBilling.purchase.mockResolvedValue({ premium: true });
    await render(provider());
    await act(async () => api.requestPremium({ resume }));
    await click("paywall-continue");
    expect(mockApi.refreshEntitlement).toHaveBeenCalledTimes(1);
    expect(q("paywall-success")).not.toBeNull();
    await click("paywall-success-continue");
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    expect(resume).toHaveBeenCalledTimes(1);
    expect(q("premium-paywall")).toBeNull();
  });
  test("user cancel -> back to idle, no error", async () => {
    mockBilling.purchase.mockRejectedValue({ errorCode: 1 });
    await open();
    await click("paywall-continue");
    expect(q("paywall-error")).toBeNull();
    expect(q("paywall-continue").disabled).toBe(false);
  });
  test.each([
    [{ errorCode: 10 }, "account.errNetwork"],
    [{ errorCode: 20 }, "paywall.errPending"],
    [{ errorCode: 2 }, "paywall.errStore"],
    [{ errorCode: 0, message: "boom" }, "paywall.errPurchase"],
  ])("error %o -> %s (no raw technical text)", async (e, key) => {
    mockBilling.purchase.mockRejectedValue(e);
    await open();
    await click("paywall-continue");
    expect(q("paywall-error").textContent).toBe(key);
  });
  test("already purchased -> account re-sync -> success", async () => {
    mockBilling.purchase.mockRejectedValue({ errorCode: 6 });
    mockBilling.refresh.mockResolvedValue(true);
    await open();
    await click("paywall-continue");
    expect(q("paywall-success")).not.toBeNull();
  });
  test("purchase without confirmed entitlement -> confirm error (no fake success)", async () => {
    mockBilling.purchase.mockResolvedValue({ premium: false });
    await open();
    await click("paywall-continue");
    expect(q("paywall-error").textContent).toBe("paywall.errConfirm");
    expect(q("paywall-success")).toBeNull();
  });
  test("purchaseErrorMessage maps network by message", () => {
    expect(purchaseErrorMessage({ message: "Network request failed" }, t)).toBe("account.errNetwork");
  });
});

describe("subscription page", () => {
  const sub = () => <PremiumProvider><Subscription /></PremiumProvider>;
  test("unresolved -> loading (never Free first)", async () => {
    setBilling({ status: "loading", ready: false });
    await render(sub());
    expect(q("subscription-loading")).not.toBeNull();
    expect(q("subscription-free")).toBeNull();
  });
  test("web, signed in: neutral 'refresh status' (not restore); none found message", async () => {
    mockBilling.refresh.mockResolvedValue(false);
    await render(sub());
    expect(q("subscription-check-status-btn").textContent).toContain("subscription.checkStatus");
    expect(el.textContent).not.toMatch(/restore/i);
    await click("subscription-check-status-btn");
    expect(q("subscription-check-msg").textContent).toBe("subscription.noPremiumFound");
    expect(mockApi.refreshEntitlement).not.toHaveBeenCalled();
  });
  test("refresh status finds Premium -> backend entitlement refreshed", async () => {
    mockBilling.refresh.mockResolvedValue(true);
    await render(sub());
    await click("subscription-check-status-btn");
    expect(mockApi.refreshEntitlement).toHaveBeenCalledTimes(1);
    expect(q("subscription-check-msg")).toBeNull();
  });
  test("refresh status error -> recoverable alert", async () => {
    mockBilling.refresh.mockRejectedValue(new Error("x"));
    await render(sub());
    await click("subscription-check-status-btn");
    expect(q("subscription-check-msg").getAttribute("role")).toBe("alert");
    expect(q("subscription-check-btn")).toBeNull();
    expect(q("subscription-check-status-btn").disabled).toBe(false);
  });
  test("hidden for guests and in native apps", async () => {
    mockApp.isAuthenticated = false;
    await render(sub());
    expect(q("subscription-check-status-btn")).toBeNull();
    mockApp.isAuthenticated = true; mockNative.native = true;
    await render(sub());
    expect(q("subscription-check-status-btn")).toBeNull();
  });
  test("billing error -> unavailable note, upgrade disabled", async () => {
    setBilling({ status: "error", ready: false });
    await render(sub());
    expect(q("subscription-unavailable")).not.toBeNull();
    expect(q("subscription-upgrade-btn").disabled).toBe(true);
  });
});

describe("native billing (iOS/Android)", () => {
  const nativePkg = (id, micros) => ({ identifier: id, nativePackage: {}, nativeProduct: { identifier: id, price: { formattedPrice: `${micros / 1e6} €`, amountMicros: micros, currency: "EUR" } } });
  beforeEach(() => { mockNative.native = true; });
  const openPaywall = async () => { await render(provider()); await act(async () => api.requestPremium({ resume: jest.fn() })); };

  test("paywall shows native prices + secondary Restore under Subscribe", async () => {
    setBilling({ currentOffering: () => ({ annual: nativePkg("a", 39.99e6), monthly: nativePkg("m", 4.99e6) }) });
    await openPaywall();
    expect(q("paywall-plan-annual-price").textContent).toBe("39.99 €");
    expect(q("paywall-restore-btn").textContent).toContain("paywall.restore");
    expect(q("paywall-continue").textContent).toContain("paywall.subscribe");
  });
  test("paywall restore success -> backend refresh -> success view", async () => {
    mockBilling.restore.mockResolvedValue(true);
    await openPaywall();
    await click("paywall-restore-btn");
    expect(mockBilling.restore).toHaveBeenCalledTimes(1);
    expect(mockApi.refreshEntitlement).toHaveBeenCalledTimes(1);
    expect(q("paywall-success")).not.toBeNull();
  });
  test("paywall restore nothing found -> neutral info, paywall stays", async () => {
    mockBilling.restore.mockResolvedValue(false);
    await openPaywall();
    await click("paywall-restore-btn");
    expect(q("paywall-info").textContent).toBe("paywall.restoreNone");
    expect(q("paywall-error")).toBeNull();
  });
  test("paywall restore network error -> calm error", async () => {
    mockBilling.restore.mockRejectedValue({ errorCode: 10 });
    await openPaywall();
    await click("paywall-restore-btn");
    expect(q("paywall-error").textContent).toBe("account.errNetwork");
  });
  test("signed-in restore from Subscription runs immediately", async () => {
    mockBilling.restore.mockResolvedValue(true);
    await render(<PremiumProvider><Subscription /></PremiumProvider>);
    expect(q("subscription-check-status-btn")).toBeNull();
    await click("subscription-restore-btn");
    expect(mockBilling.restore).toHaveBeenCalledTimes(1);
    expect(q("paywall-success")).not.toBeNull();
  });
  test("guest restore -> restore sign-in gate -> after login + identity resolved, restore runs automatically", async () => {
    mockApp.isAuthenticated = false;
    mockBilling.restore.mockResolvedValue(false);
    await render(<PremiumProvider><Subscription /></PremiumProvider>);
    await click("subscription-restore-btn");
    expect(q("premium-account-gate").textContent).toContain("auth.gateRestoreTitle");
    expect(mockBilling.restore).not.toHaveBeenCalled();
    mockApp.isAuthenticated = true;
    setBilling({ status: "loading", ready: false });
    await render(<PremiumProvider><Subscription /></PremiumProvider>);
    expect(mockBilling.restore).not.toHaveBeenCalled(); // waits for users.id identity sync
    setBilling({ status: "ready" });
    mockBilling.restore.mockResolvedValue(false);
    await render(<PremiumProvider><Subscription /></PremiumProvider>);
    expect(mockBilling.restore).toHaveBeenCalledTimes(1);
    expect(q("restore-none").textContent).toBe("paywall.restoreNone");
  });
  test("guest subscribe -> sign-in -> continues into paywall (not restore)", async () => {
    mockApp.isAuthenticated = false;
    await render(provider());
    await act(async () => api.requestPremium());
    expect(q("premium-account-gate").textContent).toContain("auth.gateTitle");
    mockApp.isAuthenticated = true;
    await render(provider());
    expect(q("premium-paywall")).not.toBeNull();
    expect(mockBilling.restore).not.toHaveBeenCalled();
  });
  test("restore cancelled by user -> neutral, no error", async () => {
    mockBilling.restore.mockRejectedValue({ errorCode: 1 });
    await render(provider());
    await act(async () => api.requestRestore());
    expect(q("restore-error")).toBeNull();
    expect(q("restore-none")).not.toBeNull();
  });
  test("restore error -> retry available", async () => {
    mockBilling.restore.mockRejectedValueOnce({ errorCode: 0 }).mockResolvedValueOnce(true);
    await render(provider());
    await act(async () => api.requestRestore());
    expect(q("restore-error").textContent).toBe("paywall.restoreFailed");
    await click("restore-retry-btn");
    expect(q("paywall-success")).not.toBeNull();
  });
});

describe("web keeps no native restore", () => {
  test("paywall + Subscription have no restore; requestRestore is a no-op", async () => {
    await render(provider());
    await act(async () => api.requestRestore());
    expect(q("premium-restore")).toBeNull();
    await act(async () => api.requestPremium());
    expect(q("paywall-restore-btn")).toBeNull();
  });
});
