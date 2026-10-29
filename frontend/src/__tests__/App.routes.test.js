/* Legacy /category retirement: old saved URLs redirect to the current Learn experience. */
import { TextEncoder, TextDecoder } from "util";
Object.assign(global, { TextEncoder, TextDecoder });
const { act } = require("react");
const { createRoot } = require("react-dom/client");

jest.mock("@/App.css", () => ({}), { virtual: true });
jest.mock("@/components/ui/sonner", () => ({ Toaster: () => null }));
jest.mock("@/context/AppContext", () => ({ AppProvider: ({ children }) => <>{children}</> }));
jest.mock("@/context/BillingContext", () => ({ BillingProvider: ({ children }) => <>{children}</> }));
jest.mock("@/components/PremiumGate", () => ({ PremiumProvider: ({ children }) => <>{children}</> }));
jest.mock("@/pages/Support", () => ({ Support: () => <div data-testid="page-Support" />, Feedback: () => <div /> }));
jest.mock("@/pages/Landing", () => () => <div data-testid="page-Landing" />);
jest.mock("@/pages/Onboarding", () => () => <div data-testid="page-Onboarding" />);
jest.mock("@/pages/Home", () => () => <div data-testid="page-Home" />);
jest.mock("@/pages/Learn", () => () => <div data-testid="page-Learn" />);
jest.mock("@/pages/Skill", () => () => <div data-testid="page-Skill" />);
jest.mock("@/pages/Progress", () => () => <div data-testid="page-Progress" />);
jest.mock("@/pages/Practice", () => () => <div data-testid="page-Practice" />);
jest.mock("@/pages/Lesson", () => () => <div data-testid="page-Lesson" />);
jest.mock("@/pages/Assessment", () => () => <div data-testid="page-Assessment" />);
jest.mock("@/pages/EmergencyPhrases", () => () => <div data-testid="page-EmergencyPhrases" />);
jest.mock("@/pages/TonightsShift", () => () => <div data-testid="page-TonightsShift" />);
jest.mock("@/pages/JobInterview", () => () => <div data-testid="page-JobInterview" />);
jest.mock("@/pages/FirstWeek", () => () => <div data-testid="page-FirstWeek" />);
jest.mock("@/pages/ListeningPractice", () => () => <div data-testid="page-ListeningPractice" />);
jest.mock("@/pages/SpeakingPractice", () => () => <div data-testid="page-SpeakingPractice" />);
jest.mock("@/pages/Account", () => () => <div data-testid="page-Account" />);
jest.mock("@/pages/More", () => () => <div data-testid="page-More" />);
jest.mock("@/pages/Profile", () => () => <div data-testid="page-Profile" />);
jest.mock("@/pages/LearningPreferences", () => () => <div data-testid="page-LearningPreferences" />);
jest.mock("@/pages/Language", () => () => <div data-testid="page-Language" />);
jest.mock("@/pages/Subscription", () => () => <div data-testid="page-Subscription" />);
jest.mock("@/pages/Legal", () => () => <div data-testid="page-Legal" />);

const App = require("@/App").default;
global.IS_REACT_ACT_ENVIRONMENT = true;

let el, root;
const visit = async (path) => {
  window.history.replaceState(null, "", path);
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
  await act(async () => { root.render(<App />); });
};
afterEach(() => { act(() => root.unmount()); el.remove(); });

test.each(["/category/restaurant", "/category/bar", "/category/unknown-slug", "/category"])("%s -> /learn (replace, no legacy UI)", async (path) => {
  const before = window.history.length;
  await visit(path);
  expect(window.location.pathname).toBe("/learn");
  expect(el.querySelector('[data-testid="page-Learn"]')).not.toBeNull();
  expect(window.history.length).toBe(before); // replace: Back does not bounce into a redirect loop
});

test("/learn and other routes are untouched", async () => {
  await visit("/learn");
  expect(window.location.pathname).toBe("/learn");
  act(() => root.unmount()); el.remove();
  await visit("/lesson/taking-a-drinks-order");
  expect(el.querySelector('[data-testid="page-Lesson"]')).not.toBeNull();
});
