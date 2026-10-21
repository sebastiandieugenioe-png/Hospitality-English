/* Native auth adapter + firebase.js routing (plugin and Firebase JS mocked). */
const mockPlatform = { native: true, platform: "ios" };
jest.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: () => mockPlatform.native,
    getPlatform: () => mockPlatform.platform,
  },
}));

const mockPlugin = { signInWithGoogle: jest.fn(), signInWithApple: jest.fn(), signOut: jest.fn() };
jest.mock("@capacitor-firebase/authentication", () => ({ FirebaseAuthentication: mockPlugin }));

const mockAuth = { currentUser: null, config: { apiKey: "test-api-key" } };
const mockFb = {
  getAuth: jest.fn(() => mockAuth),
  initializeAuth: jest.fn(() => mockAuth),
  indexedDBLocalPersistence: "idb",
  linkWithCredential: jest.fn(async (u, c) => ({ user: { uid: u.uid, cred: c } })),
  signInWithCredential: jest.fn(async (a, c) => ({ user: { uid: "existing", cred: c } })),
  reauthenticateWithCredential: jest.fn(async () => ({})),
  linkWithPopup: jest.fn(async (u) => ({ user: u })),
  signInWithPopup: jest.fn(async () => ({ user: { uid: "popup" } })),
  reauthenticateWithPopup: jest.fn(),
  revokeAccessToken: jest.fn(),
  signOut: jest.fn(async () => {}),
  signInAnonymously: jest.fn(),
  onAuthStateChanged: jest.fn(),
  deleteUser: jest.fn(),
};
jest.mock("firebase/app", () => ({ initializeApp: () => ({}), getApps: () => [] }));
jest.mock("firebase/auth", () => {
  class OAuthProvider {
    constructor(id) { this.providerId = id; }
    addScope() {}
    credential(o) { return { providerId: this.providerId, ...o }; }
  }
  OAuthProvider.credentialFromError = jest.fn(() => null);
  OAuthProvider.credentialFromResult = jest.fn();
  class GoogleAuthProvider {}
  GoogleAuthProvider.credential = jest.fn((idToken) => ({ providerId: "google.com", idToken }));
  return { ...mockFb, OAuthProvider, GoogleAuthProvider };
});

const load = () => {
  let mods;
  jest.isolateModules(() => {
    mods = { fb: require("@/lib/firebase"), na: require("@/lib/nativeAuth"), fa: require("firebase/auth") };
  });
  return mods;
};

const anon = () => ({ uid: "anon-1", isAnonymous: true, getIdToken: jest.fn(async () => "fb-id-token") });
const real = () => ({ uid: "user-1", isAnonymous: false, getIdToken: jest.fn(async () => "fb-id-token") });
const appleOk = { credential: { idToken: "apple-id", nonce: "raw-nonce", authorizationCode: "fresh-code" } };

// CRA enables resetMocks, so default implementations are (re)applied here.
beforeEach(() => {
  mockFb.getAuth.mockImplementation(() => mockAuth);
  mockFb.initializeAuth.mockImplementation(() => mockAuth);
  mockFb.linkWithCredential.mockImplementation(async (u, c) => ({ user: { uid: u.uid, cred: c } }));
  mockFb.signInWithCredential.mockImplementation(async (a, c) => ({ user: { uid: "existing", cred: c } }));
  mockFb.reauthenticateWithCredential.mockImplementation(async () => ({}));
  mockFb.linkWithPopup.mockImplementation(async (u) => ({ user: u }));
  mockFb.signInWithPopup.mockImplementation(async () => ({ user: { uid: "popup" } }));
  mockFb.signOut.mockImplementation(async () => {});
  const fa = require("firebase/auth");
  fa.GoogleAuthProvider.credential.mockImplementation((idToken) => ({ providerId: "google.com", idToken }));
  fa.OAuthProvider.credentialFromError.mockImplementation(() => null);
  mockPlatform.native = true; mockPlatform.platform = "ios";
  mockAuth.currentUser = null;
  global.fetch = jest.fn(async () => ({ ok: true }));
});

describe("Google native", () => {
  test("returns idToken with skipNativeAuth", async () => {
    const { na } = load();
    mockPlugin.signInWithGoogle.mockResolvedValue({ credential: { idToken: "g-id" } });
    await expect(na.nativeGoogleIdToken()).resolves.toBe("g-id");
    expect(mockPlugin.signInWithGoogle).toHaveBeenCalledWith({ skipNativeAuth: true });
  });
  test("cancel normalised to auth/user-cancelled (no raw error)", async () => {
    const { na } = load();
    mockPlugin.signInWithGoogle.mockRejectedValue(new Error("The user canceled the sign-in flow."));
    await expect(na.nativeGoogleIdToken()).rejects.toMatchObject({ code: "auth/user-cancelled", message: "native_auth_failed" });
  });
  test("missing token rejected", async () => {
    const { na } = load();
    mockPlugin.signInWithGoogle.mockResolvedValue({ credential: {} });
    await expect(na.nativeGoogleIdToken()).rejects.toMatchObject({ code: "auth/native-credential-missing" });
  });
  test("guest -> linkWithCredential with GoogleAuthProvider credential", async () => {
    const { fb, fa } = load();
    mockAuth.currentUser = anon();
    const r = await fb.connectGoogleCredential("g-id");
    expect(fa.GoogleAuthProvider.credential).toHaveBeenCalledWith("g-id");
    expect(mockFb.linkWithCredential).toHaveBeenCalled();
    expect(r.mode).toBe("linked");
  });
  test("non-anonymous -> signInWithCredential", async () => {
    const { fb } = load();
    mockAuth.currentUser = real();
    const r = await fb.connectGoogleCredential("g-id");
    expect(mockFb.signInWithCredential).toHaveBeenCalled();
    expect(mockFb.linkWithCredential).not.toHaveBeenCalled();
    expect(r.mode).toBe("signin");
  });
  test("reauth -> reauthenticateWithCredential on JS currentUser", async () => {
    const { fb } = load();
    const u = real(); mockAuth.currentUser = u;
    await fb.reauthWithGoogleCredential("g-id");
    expect(mockFb.reauthenticateWithCredential).toHaveBeenCalledWith(u, { providerId: "google.com", idToken: "g-id" });
  });
});

describe("Apple native (iOS)", () => {
  test("credential built with idToken + raw nonce", async () => {
    const { na } = load();
    mockPlugin.signInWithApple.mockResolvedValue(appleOk);
    const { credential, authorizationCode } = await na.nativeAppleCredential();
    expect(credential).toEqual({ providerId: "apple.com", idToken: "apple-id", rawNonce: "raw-nonce" });
    expect(authorizationCode).toBe("fresh-code");
    expect(mockPlugin.signInWithApple.mock.calls[0][0].skipNativeAuth).toBe(true);
  });
  test("missing nonce rejected", async () => {
    const { na } = load();
    mockPlugin.signInWithApple.mockResolvedValue({ credential: { idToken: "x" } });
    await expect(na.nativeAppleCredential()).rejects.toMatchObject({ code: "auth/native-credential-missing" });
  });
  test("guest -> linkWithCredential, no popup", async () => {
    const { fb } = load();
    mockAuth.currentUser = anon();
    mockPlugin.signInWithApple.mockResolvedValue(appleOk);
    const r = await fb.connectAppleProvider();
    expect(r.mode).toBe("linked");
    expect(mockFb.linkWithCredential.mock.calls[0][1]).toMatchObject({ providerId: "apple.com", rawNonce: "raw-nonce" });
    expect(mockFb.linkWithPopup).not.toHaveBeenCalled();
    expect(mockFb.signInWithPopup).not.toHaveBeenCalled();
  });
  test("normal login -> signInWithCredential", async () => {
    const { fb } = load();
    mockAuth.currentUser = real();
    mockPlugin.signInWithApple.mockResolvedValue(appleOk);
    expect((await fb.connectAppleProvider()).mode).toBe("signin");
    expect(mockFb.linkWithCredential).not.toHaveBeenCalled();
  });
  test("credential-already-in-use -> sign in to existing (no merge/delete)", async () => {
    const { fb, fa } = load();
    mockAuth.currentUser = anon();
    mockPlugin.signInWithApple.mockResolvedValue(appleOk);
    mockFb.linkWithCredential.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "auth/credential-already-in-use" }));
    fa.OAuthProvider.credentialFromError.mockReturnValueOnce({ providerId: "apple.com", fromError: true });
    const r = await fb.connectAppleProvider();
    expect(r.mode).toBe("signin");
    expect(mockFb.signInWithCredential.mock.calls[0][1]).toEqual({ providerId: "apple.com", fromError: true });
    expect(mockFb.deleteUser).not.toHaveBeenCalled();
  });
  test("other link errors propagate (guest untouched)", async () => {
    const { fb } = load();
    mockAuth.currentUser = anon();
    mockPlugin.signInWithApple.mockResolvedValue(appleOk);
    mockFb.linkWithCredential.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "auth/provider-already-linked" }));
    await expect(fb.connectAppleProvider()).rejects.toMatchObject({ code: "auth/provider-already-linked" });
    expect(mockFb.signInWithCredential).not.toHaveBeenCalled();
  });
  test("deletion: fresh Apple -> reauth -> revoke CODE via Identity Toolkit, in order", async () => {
    const { fb } = load();
    const u = real(); mockAuth.currentUser = u;
    const order = [];
    mockPlugin.signInWithApple.mockImplementation(async () => { order.push("apple"); return appleOk; });
    mockFb.reauthenticateWithCredential.mockImplementationOnce(async () => { order.push("reauth"); });
    global.fetch = jest.fn(async () => { order.push("revoke"); return { ok: true }; });
    await fb.reauthAndRevokeApple();
    expect(order).toEqual(["apple", "reauth", "revoke"]);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe("https://identitytoolkit.googleapis.com/v2/accounts:revokeToken?key=test-api-key");
    expect(JSON.parse(init.body)).toEqual({ providerId: "apple.com", tokenType: "CODE", token: "fresh-code", idToken: "fb-id-token" });
    expect(mockFb.revokeAccessToken).not.toHaveBeenCalled();
    expect(mockFb.reauthenticateWithPopup).not.toHaveBeenCalled();
  });
  test("deletion: missing authorization code aborts before reauth", async () => {
    const { fb } = load();
    mockAuth.currentUser = real();
    mockPlugin.signInWithApple.mockResolvedValue({ credential: { idToken: "a", nonce: "n" } });
    await expect(fb.reauthAndRevokeApple()).rejects.toMatchObject({ code: "APPLE_REVOKE_TOKEN_MISSING" });
    expect(mockFb.reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
  test("deletion: revoke failure throws APPLE_REVOKE_FAILED", async () => {
    const { fb } = load();
    mockAuth.currentUser = real();
    mockPlugin.signInWithApple.mockResolvedValue(appleOk);
    global.fetch = jest.fn(async () => ({ ok: false, status: 400 }));
    await expect(fb.reauthAndRevokeApple()).rejects.toMatchObject({ code: "APPLE_REVOKE_FAILED" });
  });
  test("deletion: cancel throws cancelled (nothing revoked)", async () => {
    const { fb } = load();
    mockAuth.currentUser = real();
    mockPlugin.signInWithApple.mockRejectedValue(new Error("AuthorizationError error 1001"));
    await expect(fb.reauthAndRevokeApple()).rejects.toMatchObject({ code: "auth/user-cancelled" });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("session + platform", () => {
  test("native uses initializeAuth(indexedDB) once; web uses getAuth", () => {
    const { fb } = load();
    fb.fbAuth(); fb.fbAuth();
    expect(mockFb.initializeAuth).toHaveBeenCalledTimes(1);
    expect(mockFb.initializeAuth.mock.calls[0][1]).toEqual({ persistence: "idb" });
    expect(mockFb.getAuth).not.toHaveBeenCalled();
    mockPlatform.native = false;
    load().fb.fbAuth();
    expect(mockFb.getAuth).toHaveBeenCalled();
  });
  test("backend token comes from Firebase JS currentUser", async () => {
    const { fb } = load();
    mockAuth.currentUser = real();
    await expect(fb.getIdToken()).resolves.toBe("fb-id-token");
  });
  test("native sign-out clears Firebase JS + native provider state", async () => {
    const { fb } = load();
    await fb.firebaseSignOut();
    expect(mockFb.signOut).toHaveBeenCalled();
    expect(mockPlugin.signOut).toHaveBeenCalled();
  });
  test("APPLE_ENABLED: iOS native true, Android native false, web true", () => {
    mockPlatform.platform = "ios"; expect(load().fb.APPLE_ENABLED).toBe(true);
    mockPlatform.platform = "android"; expect(load().fb.APPLE_ENABLED).toBe(false);
    mockPlatform.native = false; mockPlatform.platform = "web"; expect(load().fb.APPLE_ENABLED).toBe(true);
  });
});

describe("web unchanged", () => {
  beforeEach(() => { mockPlatform.native = false; mockPlatform.platform = "web"; });
  test("Apple uses popup, plugin never called", async () => {
    const { fb } = load();
    mockAuth.currentUser = anon();
    await fb.connectAppleProvider();
    expect(mockFb.linkWithPopup).toHaveBeenCalled();
    expect(mockPlugin.signInWithApple).not.toHaveBeenCalled();
  });
  test("Apple deletion uses popup + revokeAccessToken, no REST call", async () => {
    const { fb, fa } = load();
    mockAuth.currentUser = real();
    mockFb.reauthenticateWithPopup.mockResolvedValue({});
    fa.OAuthProvider.credentialFromResult.mockReturnValue({ accessToken: "at" });
    await fb.reauthAndRevokeApple();
    expect(mockFb.revokeAccessToken).toHaveBeenCalledWith(mockAuth, "at");
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockPlugin.signInWithApple).not.toHaveBeenCalled();
  });
  test("web sign-out does not touch the native plugin", async () => {
    const { fb } = load();
    await fb.firebaseSignOut();
    expect(mockPlugin.signOut).not.toHaveBeenCalled();
  });
});
