// StreekMart mobile theme tokens.
//
// Palette mirrors the web tailwind.config.ts so the app and site look
// like they came from the same brand. Primary identity is violet
// (matches the btn-primary and brand chips on the site); fuchsia + gold
// are the accent + premium colors; burgundy is danger.

export type ColorScheme = "light" | "dark";

export const palette = {
  violet50: "#f5f3ff",
  violet100: "#ede9fe",
  violet200: "#ddd6fe",
  violet400: "#a78bfa",
  violet500: "#8b5cf6",
  violet600: "#7c3aed",
  violet700: "#6d28d9",
  violet900: "#4c1d95",
  violet950: "#2e1065",
  fuchsia400: "#e879f9",
  fuchsia500: "#d946ef",
  fuchsia600: "#c026d3",
  gold200: "#e9d089",
  gold400: "#cf9f32",
  gold500: "#b9881e",
  burgundy: "#6b1a2a",
  burgundy500: "#8b1d33",
  white: "#ffffff",
  ink50: "#f7f7f8",
  ink100: "#e4e4e8",
  ink200: "#cccccf",
  ink300: "#a3a3a8",
  ink400: "#737378",
  ink500: "#525258",
  ink600: "#404048",
  ink700: "#262630",
  ink800: "#171720",
  ink900: "#0a0a14",
  successBg: "#dcfce7",
  successFg: "#0a7434",
  warningBg: "#fff7d8",
  warningFg: "#92590b",
};

export type Theme = {
  scheme: ColorScheme;
  bg: string;
  bgElevated: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  accentSoft: string;
  cta: string;
  ctaPressed: string;
  ctaText: string;
  promo: string;
  premium: string;
  success: { fg: string; bg: string };
  warning: { fg: string; bg: string };
  danger: { fg: string; bg: string };
  auroraGradient: [string, string, string, string];
  shadow: string;
  statusBarStyle: "dark" | "light";
};

export const lightTheme: Theme = {
  scheme: "light",
  bg: palette.ink50,
  bgElevated: palette.white,
  card: palette.white,
  border: palette.ink100,
  text: palette.ink900,
  textMuted: palette.ink500,
  textFaint: palette.ink300,
  accent: palette.violet600,
  accentSoft: palette.violet100,
  cta: palette.violet600,
  ctaPressed: palette.violet700,
  ctaText: palette.white,
  promo: palette.fuchsia500,
  premium: palette.gold400,
  success: { fg: palette.successFg, bg: palette.successBg },
  warning: { fg: palette.warningFg, bg: palette.warningBg },
  danger: { fg: palette.burgundy, bg: "#fbeef0" },
  auroraGradient: [palette.violet900, palette.violet600, palette.fuchsia500, palette.gold400],
  shadow: "rgba(76, 29, 149, 0.12)",
  statusBarStyle: "dark",
};

export const darkTheme: Theme = {
  scheme: "dark",
  bg: palette.ink900,
  bgElevated: palette.ink800,
  card: palette.ink700,
  border: palette.ink600,
  text: palette.white,
  textMuted: palette.ink300,
  textFaint: palette.ink500,
  accent: palette.violet400,
  accentSoft: palette.violet950,
  cta: palette.violet600,
  ctaPressed: palette.violet700,
  ctaText: palette.white,
  promo: palette.fuchsia400,
  premium: palette.gold200,
  success: { fg: "#86efac", bg: "rgba(10, 116, 52, 0.20)" },
  warning: { fg: palette.gold200, bg: "rgba(146, 89, 11, 0.20)" },
  danger: { fg: "#fda4af", bg: "rgba(107, 26, 42, 0.30)" },
  auroraGradient: [palette.violet950, palette.violet700, palette.fuchsia600, palette.gold500],
  shadow: "rgba(0, 0, 0, 0.55)",
  statusBarStyle: "light",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 };

// Brand font — Nunito. Trebuchet MS isn't available on iOS/Android by
// default, so we use Nunito (humanist sans, similar character, free via
// Google Fonts). React Native ignores fontWeight when a custom
// fontFamily is set, so each variant points at the specific weight
// build. App.tsx loads the family and monkey-patches Text so even raw
// `<Text style={{ fontWeight: "700" }}>` resolves to Nunito_700Bold.
export const fontFamily = {
  regular: "Nunito_400Regular",
  medium: "Nunito_500Medium",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extrabold: "Nunito_800ExtraBold",
  black: "Nunito_900Black",
} as const;

// Map a fontWeight value to its specific family name so the bold
// glyphs actually render bold. Exported because App.tsx's Text render
// override uses the same mapping.
export function nunitoFamilyFor(weight: number | string | undefined): string {
  if (weight == null) return fontFamily.regular;
  const n = typeof weight === "string" ? Number(weight) : weight;
  if (Number.isNaN(n)) return fontFamily.regular;
  if (n >= 900) return fontFamily.black;
  if (n >= 800) return fontFamily.extrabold;
  if (n >= 700) return fontFamily.bold;
  if (n >= 600) return fontFamily.semibold;
  if (n >= 500) return fontFamily.medium;
  return fontFamily.regular;
}

export const type = {
  display: { fontSize: 28, fontFamily: fontFamily.extrabold, fontWeight: "800" as const },
  h1: { fontSize: 22, fontFamily: fontFamily.bold, fontWeight: "700" as const },
  h2: { fontSize: 18, fontFamily: fontFamily.bold, fontWeight: "700" as const },
  bodyLg: { fontSize: 16, fontFamily: fontFamily.regular, fontWeight: "400" as const },
  body: { fontSize: 14, fontFamily: fontFamily.regular, fontWeight: "400" as const },
  bodyStrong: { fontSize: 14, fontFamily: fontFamily.semibold, fontWeight: "600" as const },
  small: { fontSize: 12, fontFamily: fontFamily.regular, fontWeight: "400" as const },
  micro: { fontSize: 10, fontFamily: fontFamily.semibold, fontWeight: "600" as const },
};