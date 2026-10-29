/* BillingContext.resolvedFor: set for the current identity on success AND on RevenueCat failure. */
import { act } from "react";
import { createRoot } from "react-dom/client";

const mockApp = { account: null, authReady: true };
const mockRc = { configured: true, fail: false, current: null, premiumIds: [], hold: null };
const mockInfo = () => ({ entitlements: { active: mockRc.premiumIds.includes(mockRc.current) ? { hospitality_premium: {} } : {} } });
jest.mock("@/context/AppContext", () => ({ useApp: () => mockApp }));
jest.mock("@/lib/revenuecat", () => ({
  isRevenueCatConfigured: () => mockRc.configured,
  configureRevenueCat: (id) => { if (mockRc.fail) throw new Error("rc down"); mockRc.current = id; },
  switchRevenueCatIdentity: async (id) => { if (mockRc.hold) await mockRc.hold; if (mockRc.fail) throw new Error("rc down"); mockRc.current = id; },
  getRevenueCat: () => ({ getOfferings: async () => ({ all: {} }), getCustomerInfo: async () => mockInfo() }),
  revenueCatSnapshot: () => ({}), purchaseRevenueCatPackage: async () => null, refreshCustomerInfo: async () => mockInfo(), rcDiag: () => {},
}));
const { BillingProvider, useBilling } = require("@/context/BillingContext");

global.IS_REACT_ACT_ENVIRONMENT = true;
let snap, root, el;
let billingApi;
const Probe = () => { const b = useBilling(); billingApi = b; snap = { status: b.status, resolvedFor: b.resolvedFor }; return null; };
const render = async () => {
  await act(async () => { root.render(<BillingProvider><Probe /></BillingProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

beforeEach(() => { el = document.createElement("div"); root = createRoot(el); Object.assign(mockRc, { configured: true, fail: false, current: null, premiumIds: [], hold: null }); mockApp.account = null; });
afterEach(() => act(() => root.unmount()));

test("success -> ready + resolvedFor guest(null)", async () => {
  await render();
  expect(snap).toEqual({ status: "ready", resolvedFor: null });
});

test("RevenueCat failure -> error + resolvedFor set (no crash, free access resolves)", async () => {
  mockRc.fail = true; mockApp.account = { id: "u1" };
  await render();
  expect(snap).toEqual({ status: "error", resolvedFor: "u1" });
});

test("not configured -> error + resolvedFor", async () => {
  mockRc.configured = false;
  await render();
  expect(snap).toEqual({ status: "error", resolvedFor: null });
});

test("identity switch keeps old resolvedFor until the new identity resolves", async () => {
  await render();
  expect(snap.resolvedFor).toBe(null);
  mockApp.account = { id: "u1" };
  await render();
  expect(snap).toEqual({ status: "ready", resolvedFor: "u1" });
});

describe("identity switching never exposes stale access", () => {
  const holdSwitch = () => { let release; mockRc.hold = new Promise((r) => { release = r; }); return () => { mockRc.hold = null; release(); }; };

  test("logout Premium -> Free: no stale Premium while switching", async () => {
    mockRc.premiumIds = ["u1"]; mockApp.account = { id: "u1" };
    await render();
    expect(billingApi.isPremium("hospitality")).toBe(true);
    const release = holdSwitch();
    mockApp.account = null;
    await render();
    expect(snap.status).toBe("loading");
    expect(billingApi.ready).toBe(false);
    expect(billingApi.isPremium("hospitality")).toBe(false);
    await act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); });
    expect(snap).toEqual({ status: "ready", resolvedFor: null });
    expect(billingApi.isPremium("hospitality")).toBe(false);
  });

  test("guest Free -> sign in Premium: loading (not Free-ready) until resolved, then Premium", async () => {
    mockRc.premiumIds = ["u1"];
    await render();
    expect(billingApi.ready).toBe(true);
    const release = holdSwitch();
    mockApp.account = { id: "u1" };
    await render();
    expect(snap.status).toBe("loading");
    expect(billingApi.ready).toBe(false);
    await act(async () => { release(); await new Promise((r) => setTimeout(r, 0)); });
    expect(billingApi.ready).toBe(true);
    expect(billingApi.isPremium("hospitality")).toBe(true);
  });

  test("switching user A (Premium) -> user B (Free)", async () => {
    mockRc.premiumIds = ["a"]; mockApp.account = { id: "a" };
    await render();
    expect(billingApi.isPremium("hospitality")).toBe(true);
    mockApp.account = { id: "b" };
    await render();
    expect(snap.resolvedFor).toBe("b");
    expect(billingApi.isPremium("hospitality")).toBe(false);
  });

  test("refresh() re-reads the account and reports Premium", async () => {
    mockApp.account = { id: "u1" };
    await render();
    expect(billingApi.isPremium("hospitality")).toBe(false);
    mockRc.premiumIds = ["u1"];
    let active;
    await act(async () => { active = await billingApi.refresh("hospitality"); });
    expect(active).toBe(true);
    expect(billingApi.isPremium("hospitality")).toBe(true);
  });
});
