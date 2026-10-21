// Canonical English Privacy Policy, written from the technical data audit
// (see /app/docs/PRIVACY_DATA_INVENTORY.md). Keep both in sync.
export const privacyPolicy = {
  title: "Privacy Policy",
  updated: "Draft — June 2026. Effective date: OWNER_ACTION_REQUIRED",
  intro: [
    "This Privacy Policy explains what personal data Inglés para Hostelería (\"Hospitality English\", \"the app\", \"we\") processes, why, and what choices you have. It applies to the web app and to the mobile apps that use the same service.",
  ],
  sections: [
    {
      h: "1. Who is responsible",
      p: [
        "The service is operated by: OWNER_ACTION_REQUIRED (legal name of the operator).",
        "Address: OWNER_ACTION_REQUIRED.",
        "Privacy contact: OWNER_ACTION_REQUIRED (privacy/support email).",
      ],
    },
    {
      h: "2. Using the app without an account",
      p: [
        "You can use the app without creating an account. When you open the app we create a guest profile so your progress can be saved. The guest profile is identified by a random ID stored on your device and by an anonymous sign-in ID from our authentication provider (Firebase). It is not linked to your name or email, but it is still data about how you use the app, so we treat it as personal data.",
        "Guest data is kept on our servers. If you later sign in with Google or Apple, your guest profile and progress are linked to your new account.",
      ],
    },
    {
      h: "3. Data we process",
      list: [
        "Account data (only if you sign in with Google or Apple): email address and display name provided by the sign-in provider, the sign-in method used, an internal account ID, and account timestamps (created, updated, last sign-in).",
        "Profile and preferences: interface language, your role (e.g. bartender or waiter), type of workplace, the country where you want to work, your goal, your employment situation and, if set, your English level.",
        "Learning activity: lessons started and completed, answers and scores, review (spaced repetition) items, assessment results, Tonight's Shift, Job Interview and First Week progress, and Listening practice answers.",
        "Speaking practice: your voice recording (processed temporarily, see section 5), the text transcript of what you said, the evaluation and feedback produced, and the recording duration.",
        "Subscription status: whether you have Premium, which plan, and related purchase records managed by RevenueCat (see section 6). We do not receive or store full payment card details.",
        "Feedback you send: the category and message you write, plus the app version and the screen you were on.",
        "Account events: records of sign-in and account linking (event type, sign-in method, internal IDs and time).",
        "Data stored on your device: a guest ID, your language choice, an onboarding draft, a RevenueCat anonymous ID and scroll position, kept in your browser's local storage so the app works.",
        "Technical connection data (such as IP address) that our hosting and font providers receive when your device connects.",
      ],
    },
    {
      h: "4. Why we use your data",
      list: [
        "To provide the service: save your progress, show your lessons and practice, and keep your account working across devices (performance of a contract).",
        "To personalise recommendations based on your role, workplace, country and goal (performance of a contract).",
        "To evaluate your Speaking answers and give feedback (performance of a contract).",
        "To manage Premium access and subscriptions (performance of a contract).",
        "To keep the service secure, prevent abuse and record account changes (legitimate interests).",
        "To read your feedback and improve the app (legitimate interests).",
      ],
      p: ["We do not sell your personal data and we do not use it for advertising."],
    },
    {
      h: "5. Speaking practice and your voice",
      p: [
        "When you record a Speaking answer, the audio is sent to our server and forwarded to ElevenLabs for speech-to-text transcription. Our server keeps the audio only in memory while it is transcribed and then discards it; we do not save your recording.",
        "The resulting transcript (text only, without your name or email) is sent to OpenAI to evaluate your answer. We store the transcript and the evaluation with your learning progress so you can see your results.",
        "ElevenLabs and OpenAI process this data on our behalf as service providers. Their own retention of the data they receive is governed by their terms and settings, which we do not control in this app.",
        "Listening audio in the app is pre-recorded content and does not use your data.",
      ],
    },
    {
      h: "6. Sign-in and subscriptions",
      p: [
        "Sign-in is provided by Firebase Authentication (Google), with Google Sign-In and Sign in with Apple. These providers process your sign-in data under their own privacy policies.",
        "Subscriptions are managed through RevenueCat, which records your purchases and entitlement against your internal account ID (an anonymous ID is used before you sign in). Payments are processed by RevenueCat's checkout or, in the mobile apps, by the Apple App Store or Google Play. We do not receive your full card details.",
      ],
    },
    {
      h: "7. Analytics",
      p: [
        "The app does not use analytics, advertising or session-recording tools, and does not track you across other apps or websites. Our hosting platform's analytics tool is enabled only in our internal preview environment, which is not used by app users.",
      ],
    },
    {
      h: "8. Service providers",
      list: [
        "Google (Firebase Authentication, Google Sign-In, Google Fonts): authentication; fonts are loaded from Google's servers, which receive your IP address.",
        "Apple (Sign in with Apple): authentication.",
        "RevenueCat: subscription and entitlement management.",
        "ElevenLabs: speech-to-text for Speaking practice (audio).",
        "OpenAI: evaluation of Speaking transcripts (text).",
        "Emergent and its infrastructure providers: hosting of the app, backend and database.",
      ],
      p: ["Some of these providers may process data outside your country, including outside the European Economic Area. Where required, such transfers rely on the safeguards offered by the provider (for example, standard contractual clauses). OWNER_ACTION_REQUIRED: confirm transfer safeguards with each provider."],
    },
    {
      h: "9. How long we keep data",
      list: [
        "Account, profile and learning data: until you delete your account.",
        "Guest data without an account: kept on our servers; there is currently no automatic expiry. You can ask us to delete it (section 10).",
        "Raw Speaking audio: not stored by us; discarded after transcription.",
        "Account event records (sign-in and linking): until you delete your account.",
        "Subscription records held by RevenueCat and the app stores: kept by them under their own policies and legal obligations (for example, tax records).",
      ],
    },
    {
      h: "10. Deleting your account and data",
      p: [
        "You can delete your account in the app: More → Account → Delete account. This permanently deletes your account, your profile, your learning data (including Speaking transcripts and evaluations), feedback linked to your profile, your account event records, and your sign-in record in Firebase. If you signed in with Apple, we also revoke the app's access to your Apple ID.",
        "Not deleted by this action: purchase records held by RevenueCat or the app stores.",
        "You can also do this from any web browser, or request deletion if you cannot sign in, as explained at /account-deletion.",
      ],
    },
    {
      h: "11. Your rights",
      p: [
        "Depending on where you live (for example under the EU/UK GDPR), you may have the right to access your data, correct it, delete it, restrict or object to its processing, and receive a copy in a portable format. You can change your profile and language in the app and delete your account at any time. For other requests contact us at OWNER_ACTION_REQUIRED. You also have the right to complain to your local data protection authority.",
      ],
    },
    {
      h: "12. Children",
      p: ["The app is designed for adults working or preparing to work in hospitality. Minimum age: OWNER_ACTION_REQUIRED."],
    },
    {
      h: "13. Security",
      p: ["We use reasonable technical and organisational measures to protect your data, such as authenticated access to account features and restricting server-side secrets. No online service can be completely secure."],
    },
    {
      h: "14. Changes",
      p: ["We may update this policy. We will change the date above and, for significant changes, inform you in the app."],
    },
  ],
};
