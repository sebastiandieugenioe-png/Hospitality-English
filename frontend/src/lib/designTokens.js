// Central design tokens for EnglishToWork (reused across professions).
// Source of truth for the new visual base. Keep in sync with tailwind brand classes.
export const designTokens = {
  color: {
    background: "#F7F5F0",
    surface: "#FFFFFF",
    surfaceSoft: "#EEF3EF",
    primary: "#173D31",
    primaryPressed: "#102E25",
    textPrimary: "#222824",
    textMuted: "#6B736E",
    border: "#DEE2DE",
    success: "#34785B",
    error: "#C7654E",
  },
  radius: { card: "16px", button: "15px", pill: "9999px" },
  spacing: { xs: 4, sm: 8, md: 12, base: 16, lg: 20, xl: 24, xxl: 32, xxxl: 40, huge: 48 },
  screenPaddingX: 20,
  typography: {
    // family: serif for identity/headings, sans for functional UI.
    display: { size: 34, weight: 700, family: "serif" },
    h1: { size: 30, weight: 700, family: "serif" },
    h2: { size: 26, weight: 600, family: "serif" },
    h3: { size: 21, weight: 600, family: "serif" },
    bodyLarge: { size: 18, weight: 400, family: "sans" },
    body: { size: 16, weight: 400, family: "sans" },
    bodySmall: { size: 14, weight: 400, family: "sans" },
    caption: { size: 13, weight: 500, family: "sans" },
    button: { size: 16, weight: 600, family: "sans" },
    navigation: { size: 11, weight: 600, family: "sans" },
  },
};

export default designTokens;
