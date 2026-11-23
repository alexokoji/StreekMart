// StreekMart mobile design tokens (redesign).
//
// Direction: an editorial fashion marketplace. Warm "bone" backgrounds, ink
// text, violet as the single primary action colour and gold reserved for
// trust and deals (verified badges, delivery codes, countdowns, cart badge).
// Product imagery carries the colour; the interface stays quiet.
//
// Every screen reads colours through the Theme object, so changing a value
// here re-skins the whole app. Key names are unchanged from v2.

export type ColorScheme = "light" | "dark";

export const palette = {
  bone: "#F6F3ED",
  boneDeep: "#EDE8DE",
  white: "#FFFFFF",
  ink: "#17121F",
  ink2: "#2B2338",
  muted: "#5E5870",
  faint: "#8E88A0",
  line: "#E6E1D8",
  violet50: "#F5F3FF",
  violet100: "#EEE8FB",
  violet200: "#DDD6FE",
  violet400: "#A78BFA",
  violet500: "#8B5CF6",
  violet600: "#7C3AED",
  violet700: "#6D28D9",
  violet900: "#4C1D95",
  violet950: "#2B1760",
  fuchsia400: "#E879F9",
  fuchsia500: "#D946EF",
  gold: "#F2C14E",
  goldSoft: "#FFF1CC",
  goldInk: "#7A5200",
  emerald: "#177A4B",
  emeraldSoft: "#E3F5EA",
  emeraldInk: "#0B6B37",
  brick: "#C2392F",
  brickSoft: "#FBE7E5",
  brickInk: "#8E2219",
  // Dark mode surfaces
  night: "#14101F",
  night2: "#1D1730",
  night3: "#2A2240",
  nightLine: "#352C4D",
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
  // New in the redesign
  ink: string;      // solid dark surface (tab bar, hero panels)
  inkText: string;  // text on `ink`
  gold: string;     // trust + deals
  goldSoft: string;
};

export const lightTheme: Theme = {
  scheme: "light",
  bg: palette.bone,
  bgElevated: palette.white,
  card: palette.white,
  border: palette.line,
  text: palette.ink,
  textMuted: palette.muted,
  textFaint: palette.faint,
  accent: palette.violet700,
  accentSoft: palette.violet100,
  cta: palette.violet600,
  ctaPressed: palette.violet700,
  ctaText: palette.white,
  promo: palette.violet950,
  premium: palette.gold,
  success: { fg: palette.emeraldInk, bg: palette.emeraldSoft },
  warning: { fg: palette.goldInk, bg: palette.goldSoft },
  danger: { fg: palette.brickInk, bg: palette.brickSoft },
  auroraGradient: [palette.violet950, palette.violet700, palette.violet600, palette.gold],
  shadow: "rgba(23, 18, 31, 0.14)",
  statusBarStyle: "dark",
  ink: palette.ink,
  inkText: palette.white,
  gold: palette.gold,
  goldSoft: palette.goldSoft,
};

export const darkTheme: Theme = {
  scheme: "dark",
  bg: palette.night,
  bgElevated: palette.night2,
  card: palette.night2,
  border: palette.nightLine,
  text: palette.bone,
  textMuted: "#B7B0C8",
  textFaint: "#8E88A0",
  accent: palette.violet400,
  accentSoft: palette.violet950,
  cta: palette.violet600,
  ctaPressed: palette.violet700,
  ctaText: palette.white,
  promo: palette.violet400,
  premium: palette.gold,
  success: { fg: "#86EFAC", bg: "rgba(23, 122, 75, 0.25)" },
  warning: { fg: palette.gold, bg: "rgba(242, 193, 78, 0.16)" },
  danger: { fg: "#FDA4AF", bg: "rgba(194, 57, 47, 0.25)" },
  auroraGradient: [palette.night, palette.violet900, palette.violet700, palette.gold],
  shadow: "rgba(0, 0, 0, 0.55)",
  statusBarStyle: "light",
  ink: palette.night3,
  inkText: palette.bone,
  gold: palette.gold,
  goldSoft: "rgba(242, 193, 78, 0.16)",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 36 };
// Softer, rounder shapes: icon tiles 14, cards 22, hero panels 30, pills full.
export const radius = { sm: 12, md: 16, lg: 22, xl: 30, pill: 999 };

// Fonts: Manrope for the interface, Instrument Serif for titles and section
// heads. React Native ignores fontWeight once a custom fontFamily is set, so
// each weight points at its own build. App.tsx loads the families and patches
// Text so raw `fontWeight: "700"` styles still resolve to the right file.
export const fontFamily = {
  regular: "Manrope_400Regular",
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
  black: "Manrope_800ExtraBold",
  serif: "InstrumentSerif_400Regular",
} as const;

export function nunitoFamilyFor(weight: number | string | undefined): string {
  return fontFamilyFor(weight);
}

export function fontFamilyFor(weight: number | string | undefined): string {
  if (weight == null) return fontFamily.regular;
  const n = typeof weight === "string" ? Number(weight) : weight;
  if (Number.isNaN(n)) return fontFamily.regular;
  if (n >= 800) return fontFamily.extrabold;
  if (n >= 700) return fontFamily.bold;
  if (n >= 600) return fontFamily.semibold;
  if (n >= 500) return fontFamily.medium;
  return fontFamily.regular;
}

export const type = {
  // Serif display + titles. Instrument Serif has a single (regular) weight.
  display: { fontSize: 36, lineHeight: 38, fontFamily: fontFamily.serif },
  h1: { fontSize: 28, lineHeight: 31, fontFamily: fontFamily.serif },
  h2: { fontSize: 22, lineHeight: 26, fontFamily: fontFamily.serif },
  // Interface text.
  bodyLg: { fontSize: 16, fontFamily: fontFamily.regular, fontWeight: "400" as const },
  body: { fontSize: 14, fontFamily: fontFamily.regular, fontWeight: "400" as const },
  bodyStrong: { fontSize: 14, fontFamily: fontFamily.bold, fontWeight: "700" as const },
  small: { fontSize: 12, fontFamily: fontFamily.medium, fontWeight: "500" as const },
  micro: { fontSize: 11, letterSpacing: 0.8, fontFamily: fontFamily.extrabold, fontWeight: "800" as const },
  price: { fontSize: 16, fontFamily: fontFamily.extrabold, fontWeight: "800" as const },
};
