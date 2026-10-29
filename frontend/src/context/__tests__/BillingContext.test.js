/* BillingContext.resolvedFor: set for the current identity on success AND on RevenueCat failure. */
import { act } from "react";
import { createRoot } from "react-dom/client";

const mockApp = { account: null, authReady: true };
const mockRc = { configured: true, fail: false };
jest.mock("@/context/AppContext", () => ({ useApp: () => mockApp }));
jest.mock("@/lib/revenuecat", () => ({
  isRevenueCatConfigured: () => mockRc.configured,
  configureRevenueCat: () => { if (mockRc.fail) throw new Error("rc down"); },
  switchRevenueCatIdentity: async () => { if (mockRc.fail) throw new Error("rc down"); },
  getRevenueCat: () => ({ getOfferings: async () => ({ all: {} }), getCustomerInfo: async () => ({ entitlements: { active: {} } }) }),
  revenueCatSnapshot: () => ({}), purchaseRevenueCatPackage: async () => null, refreshCustomerInfo: async () => null, rcDiag: () => {},
}));
const { BillingProvider, useBilling } = require("@/context/BillingContext");

global.IS_REACT_ACT_ENVIRONMENT = true;
let snap, root, el;
const Probe = () => { const b = useBilling(); snap = { status: b.status, resolvedFor: b.resolvedFor }; return null; };
const render = async () => {
  await act(async () => { root.render(<BillingProvider><Probe /></BillingProvider>); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
};

beforeEach(() => { el = document.createElement("div"); root = createRoot(el); Object.assign(mockRc, { configured: true, fail: false }); mockApp.account = null; });
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
