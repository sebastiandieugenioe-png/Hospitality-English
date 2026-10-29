/* Native RevenueCat adapter (purchases-capacitor mocked) + revenuecat.js platform dispatch. */
const mockPlatform = { native: true, platform: "ios" };
jest.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mockPlatform.native, getPlatform: () => mockPlatform.platform },
}));
const mockP = {};
jest.mock("@revenuecat/purchases-capacitor", () => ({ Purchases: mockP }));
const mockWeb = { configure: jest.fn(), getSharedInstance: jest.fn() };
jest.mock("@revenuecat/purchases-js", () => ({ Purchases: mockWeb }));

const load = (env = {}) => {
  let m;
  const old = { ...process.env };
  Object.assign(process.env, env);
  jest.isolateModules(() => { m = { rc: require("@/lib/revenuecat"), na: require("@/lib/revenuecatNative") }; });
  process.env = old;
  return m;
};
const KEYS = { REACT_APP_REVENUECAT_IOS_API_KEY: "appl_test", REACT_APP_REVENUECAT_ANDROID_API_KEY: "goog_test" };

beforeEach(() => {
  mockPlatform.native = true; mockPlatform.platform = "ios";
  Object.assign(mockP, {
    configure: jest.fn(async () => {}),
    getAppUserID: jest.fn(async () => ({ appUserID: "$RCAnonymousID:x" })),
    logIn: jest.fn(async () => ({})),
    logOut: jest.fn(async () => ({})),
    isAnonymous: jest.fn(async () => ({ isAnonymous: true })),
    getOfferings: jest.fn(async () => ({ current: null, all: { hospitality_default: {
      identifier: "hospitality_default",
      monthly: { identifier: "$rc_monthly", product: { identifier: "m", priceString: "4,99 €", price: 4.99, currencyCode: "EUR" } },
      annual: { identifier: "$rc_annual", product: { identifier: "a", priceString: "39,99 €", price: 39.99, currencyCode: "EUR" } },
    } } })),
    getCustomerInfo: jest.fn(async () => ({ customerInfo: { entitlements: { active: {} } } })),
    purchasePackage: jest.fn(async () => ({ customerInfo: { entitlements: { active: { hospitality_premium: {} } } } })),
    restorePurchases: jest.fn(async () => ({ customerInfo: { entitlements: { active: { hospitality_premium: {} } } } })),
  });
});

test("platform key selection; missing key = not configured (fail closed to Free)", () => {
  expect(load(KEYS).rc.isRevenueCatConfigured()).toBe(true);
  mockPlatform.platform = "android";
  expect(load(KEYS).na.nativeApiKey()).toBe("goog_test");
  expect(load({ REACT_APP_REVENUECAT_IOS_API_KEY: "", REACT_APP_REVENUECAT_ANDROID_API_KEY: "" }).rc.isRevenueCatConfigured()).toBe(false);
});

test("configure once with users.id; anonymous when no account", async () => {
  const { rc } = load(KEYS);
  await rc.configureRevenueCat("user-1");
  await rc.configureRevenueCat("user-1");
  expect(mockP.configure).toHaveBeenCalledTimes(1);
  expect(mockP.configure).toHaveBeenCalledWith({ apiKey: "appl_test", appUserID: "user-1" });
  const fresh = load(KEYS);
  await fresh.rc.configureRevenueCat(null);
  expect(mockP.configure).toHaveBeenLastCalledWith({ apiKey: "appl_test" });
  expect(mockWeb.configure).not.toHaveBeenCalled();
});

test("identity: login -> logIn(users.id); same id -> no-op; logout -> logOut only if identified", async () => {
  const { rc } = load(KEYS);
  await rc.switchRevenueCatIdentity("user-2");
  expect(mockP.logIn).toHaveBeenCalledWith({ appUserID: "user-2" });
  mockP.getAppUserID.mockResolvedValue({ appUserID: "user-2" });
  await rc.switchRevenueCatIdentity("user-2");
  expect(mockP.logIn).toHaveBeenCalledTimes(1);
  await rc.switchRevenueCatIdentity(null);
  expect(mockP.logOut).not.toHaveBeenCalled(); // already anonymous
  mockP.isAnonymous.mockResolvedValue({ isAnonymous: false });
  await rc.switchRevenueCatIdentity(null);
  expect(mockP.logOut).toHaveBeenCalledTimes(1);
});

test("offerings normalised to the shared price shape", async () => {
  const { rc } = load(KEYS);
  const o = await rc.fetchOfferings();
  const m = o.all.hospitality_default.monthly;
  expect(m.nativeProduct).toEqual({ identifier: "m", price: { formattedPrice: "4,99 €", amountMicros: 4990000, currency: "EUR" } });
  expect(m.nativePackage.identifier).toBe("$rc_monthly");
});

test("purchase passes the original native package; restore uses native restorePurchases", async () => {
  const { rc } = load(KEYS);
  const o = await rc.fetchOfferings();
  const info = await rc.purchaseRevenueCatPackage(o.all.hospitality_default.annual);
  expect(mockP.purchasePackage.mock.calls[0][0].aPackage.identifier).toBe("$rc_annual");
  expect(info.entitlements.active.hospitality_premium).toBeTruthy();
  await rc.restoreRevenueCatPurchases();
  expect(mockP.restorePurchases).toHaveBeenCalledTimes(1);
});

test.each([
  [{ code: "1", userCancelled: true }, 1],
  [{ userCancelled: true }, 1],
  [{ code: "10" }, 10],
  [{ code: "35" }, 10],
  [{ code: "20" }, 20],
  [{ code: "6" }, 6],
  [{ code: "2" }, 2],
  [{ message: "weird" }, 0],
])("native error %o -> errorCode %d (no raw message kept)", async (e, code) => {
  const { rc } = load(KEYS);
  mockP.purchasePackage.mockRejectedValue(e);
  await expect(rc.purchaseRevenueCatPackage({})).rejects.toMatchObject({ errorCode: code, message: "native_billing_error" });
});

test("web: restore unsupported and native plugin never touched", async () => {
  mockPlatform.native = false; mockPlatform.platform = "web";
  const { rc } = load({ REACT_APP_REVENUECAT_API_KEY: "test_x" });
  await expect(rc.restoreRevenueCatPurchases()).rejects.toThrow("RESTORE_UNSUPPORTED_ON_WEB");
  expect(rc.isRevenueCatConfigured()).toBe(true);
  expect(mockP.configure).not.toHaveBeenCalled();
});
