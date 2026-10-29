/* Race tests: dedicated practice session vs unresolved / changing premium access. */
import { StrictMode, act } from "react";
import { createRoot } from "react-dom/client";

const mockApp = {};
const mockBilling = {};
jest.mock("@/context/AppContext", () => ({ useApp: () => mockApp }));
jest.mock("@/context/BillingContext", () => ({ useBilling: () => mockBilling }));
jest.mock("react-router-dom", () => ({ useNavigate: () => () => {} }), { virtual: true });
jest.mock("framer-motion", () => ({ motion: { div: ({ children }) => <div>{children}</div> }, AnimatePresence: ({ children }) => <>{children}</> }));
jest.mock("@/components/focus/FocusUI", () => ({ FocusLayout: ({ children }) => <div>{children}</div> }));
jest.mock("@/components/focus/PracticeUI", () => ({
  SessionIntro: ({ testId, onStart }) => <button data-testid={testId} onClick={onStart}>start</button>,
  SessionCompletion: ({ testId, onAgain }) => <button data-testid={testId} onClick={onAgain}>again</button>,
}));
jest.mock("@/components/ui/alert-dialog", () => {
  const P = ({ children }) => <>{children}</>;
  return { AlertDialog: () => null, AlertDialogAction: P, AlertDialogCancel: P, AlertDialogContent: P, AlertDialogDescription: P, AlertDialogFooter: P, AlertDialogHeader: P, AlertDialogTitle: P };
});

const { PracticeSessionPage } = require("@/components/focus/PracticeSessionPage");

global.IS_REACT_ACT_ENVIRONMENT = true;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

const FREE = [{ id: "f1" }, { id: "f2" }];
const FULL = [{ id: "f1" }, { id: "f2" }, { id: "p1" }];
const Exercise = ({ item, language, onContinue }) => (
  <div data-testid="exercise" data-item={item.id} data-lang={language}><button data-testid="next" onClick={onContinue}>n</button></div>
);

let container, root, getPool, getMeta;
const setAccess = ({ status = "ready", premium = false, resolvedFor = null, account = null, authReady = true }) => {
  Object.assign(mockBilling, { status, resolvedFor, isPremium: () => premium });
  Object.assign(mockApp, { account, authReady });
};
const page = () => (
  <PracticeSessionPage kind="lp" getMeta={getMeta} getPool={getPool} Exercise={Exercise} icon={() => null}
    introTitle={() => "t"} introSub="s" introMeta={() => "m"} completionTitle="c" completionStat={() => "x"} isSuccess={() => true} />
);
const render = async (strict = false) => { await act(async () => { root.render(strict ? <StrictMode>{page()}</StrictMode> : page()); }); await flush(); };
const q = (id) => container.querySelector(`[data-testid="${id}"]`);
const click = async (id) => { await act(async () => { q(id).click(); }); await flush(); };

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  window.scrollTo = () => {};
  getMeta = jest.fn(async () => ({ ui: {} }));
  getPool = jest.fn(async (gid, { free_only }) => ({ items: free_only ? FREE : FULL }));
  Object.assign(mockApp, { language: "es", ensureGuest: async () => "g1", loading: false, onboardingCompleted: true, t: (k) => k });
});
afterEach(() => { act(() => root.unmount()); container.remove(); });

test.each([["uninitialized"], ["loading"]])("no session while billing is %s", async (status) => {
  setAccess({ status, resolvedFor: undefined });
  await render();
  expect(getPool).not.toHaveBeenCalled();
  expect(getMeta).not.toHaveBeenCalled();
  expect(q("lp-intro")).toBeNull();
  expect(container.textContent).toContain("common.loading");
});

test("no session before auth is ready", async () => {
  setAccess({ authReady: false });
  await render();
  expect(getPool).not.toHaveBeenCalled();
});

test("no session while 'ready' still belongs to the previous identity (login switch)", async () => {
  setAccess({ status: "ready", premium: false, resolvedFor: null, account: { id: "u1" } });
  await render();
  expect(getPool).not.toHaveBeenCalled();
  setAccess({ status: "ready", premium: true, resolvedFor: "u1", account: { id: "u1" } });
  await render();
  expect(getPool).toHaveBeenCalledTimes(1);
  expect(getPool.mock.calls[0][1]).toEqual({ free_only: false });
});

test("free user -> free_only=true", async () => {
  setAccess({ premium: false });
  await render();
  expect(getPool).toHaveBeenCalledTimes(1);
  expect(getPool.mock.calls[0][1]).toEqual({ free_only: true });
  expect(q("lp-intro")).not.toBeNull();
});

test("billing error (outage) -> resolved as free", async () => {
  setAccess({ status: "error", premium: false });
  await render();
  expect(getPool.mock.calls[0][1]).toEqual({ free_only: true });
});

test("premium user -> free_only=false (full pool)", async () => {
  setAccess({ premium: true, resolvedFor: "u1", account: { id: "u1" } });
  await render();
  expect(getPool.mock.calls[0][1]).toEqual({ free_only: false });
});

test("StrictMode + re-renders create exactly one session", async () => {
  setAccess({ premium: false });
  await render(true);
  await render(true);
  await render(true);
  expect(getPool).toHaveBeenCalledTimes(1);
  expect(getMeta).toHaveBeenCalledTimes(1);
});

test("active session is immutable: entitlement refresh + language change mid-session", async () => {
  setAccess({ premium: false });
  await render();
  await click("lp-intro");
  expect(q("exercise").dataset.item).toBe("f1");
  // entitlement refresh: loading -> ready premium, and language change
  setAccess({ status: "loading", premium: false });
  await render();
  setAccess({ status: "ready", premium: true });
  mockApp.language = "de";
  await render();
  expect(getPool).toHaveBeenCalledTimes(1);
  expect(q("exercise").dataset.item).toBe("f1");
  expect(q("exercise").dataset.lang).toBe("es");
  await click("next");
  expect(q("exercise").dataset.item).toBe("f2");
  await click("next");
  expect(q("lp-complete")).not.toBeNull(); // 2 free items only, no expansion
});

test("practice again uses the latest resolved access + language", async () => {
  setAccess({ premium: false });
  await render();
  await click("lp-intro"); await click("next"); await click("next");
  setAccess({ premium: true });
  mockApp.language = "de";
  await render();
  await click("lp-complete");
  expect(getPool).toHaveBeenCalledTimes(2);
  expect(getPool.mock.calls[1][1]).toEqual({ free_only: false });
  expect(q("exercise").dataset.item).toBe("f1");
  expect(q("exercise").dataset.lang).toBe("de");
});

test("practice again waits while access is unresolved (no temporary free session)", async () => {
  setAccess({ premium: false });
  await render();
  await click("lp-intro"); await click("next"); await click("next");
  setAccess({ status: "loading", premium: false });
  await render();
  await click("lp-complete");
  expect(getPool).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("common.loading");
  setAccess({ status: "ready", premium: true });
  await render();
  expect(getPool).toHaveBeenCalledTimes(2);
  expect(getPool.mock.calls[1][1]).toEqual({ free_only: false });
});
