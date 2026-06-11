// StreekMart mobile theme tokens.
//
// Palette blends AliExpress / Jumia warmth (oranges + coral CTAs) with
// StreekMart's violet brand accent. Dark mode is a near-true-black so
// product imagery pops and battery cost on OLED panels stays low.
//
// Tokens are exposed through useTheme() — never import this file directly
// from a screen so the consuming component re-renders on theme switches.

export type ColorScheme = "light" | "dark";

export const palette = {
  // Brand violet — retained from the storefront so the web<->app brand
  // feels continuous. Used for tertiary accents only; CTAs are coral.
  violet: "#7c3aed",
  violetSoft: "#a78bfa",

  // Coral primary CTA. AliExpress-inspired, friendlier than red.
  coral: "#ff5b3c",
  coralDeep: "#e63b1f",

  // Gold — used for verified / premium chips.
  gold: "#cf9f32",

  // Neutrals (light)
  white: "#ffffff",
  ink50: "#f7f7f9",
  ink100: "#eeeef2",
  ink200: "#dcdce3",
  ink300: "#b9b9c4",
  ink500: "#7c7c8a",
  ink700: "#3f3f49",
  ink900: "#161620",

  // Neutrals (dark)
  black: "#0b0b10",
  dark900: "#13131b",
  dark800: "#1c1c26",
  dark700: "#252531",
  dark600: "#33333f",
  dark300: "#888896",

  // Semantic
  successBg: "#dcfce7",
  successFg: "#0a7434",
  warningBg: "#fff7d8",
  warningFg: "#92590b",
  dangerBg: "#fee2e2",
  dangerFg: "#9b0b22",
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
  success: { fg: string; bg: string };
  warning: { fg: string; bg: string };
  danger: { fg: string; bg: string };
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
  accent: palette.violet,
  accentSoft: palette.violetSoft,
  cta: palette.coral,
  ctaPressed: palette.coralDeep,
  ctaText: palette.white,
  success: { fg: palette.successFg, bg: palette.successBg },
  warning: { fg: palette.warningFg, bg: palette.warningBg },
  danger: { fg: palette.dangerFg, bg: palette.dangerBg },
  shadow: "rgba(20, 20, 30, 0.08)",
  statusBarStyle: "dark",
};

export const darkTheme: Theme = {
  scheme: "dark",
  bg: palette.black,
  bgElevated: palette.dark900,
  card: palette.dark800,
  border: palette.dark700,
  text: palette.white,
  textMuted: palette.dark300,
  textFaint: palette.dark600,
  accent: palette.violetSoft,
  accentSoft: palette.violet,
  cta: palette.coral,
  ctaPressed: palette.coralDeep,
  ctaText: palette.white,
  success: { fg: palette.successBg, bg: "rgba(10, 116, 52, 0.18)" },
  warning: { fg: palette.warningBg, bg: "rgba(146, 89, 11, 0.22)" },
  danger: { fg: palette.dangerBg, bg: "rgba(155, 11, 34, 0.22)" },
  shadow: "rgba(0, 0, 0, 0.45)",
  statusBarStyle: "light",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 36,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const type = {
  display: { fontSize: 28, fontWeight: "800" as const },
  h1: { fontSize: 22, fontWeight: "700" as const },
  h2: { fontSize: 18, fontWeight: "700" as const },
  bodyLg: { fontSize: 16, fontWeight: "400" as const },
  body: { fontSize: 14, fontWeight: "400" as const },
  bodyStrong: { fontSize: 14, fontWeight: "600" as const },
  small: { fontSize: 12, fontWeight: "400" as const },
  micro: { fontSize: 10, fontWeight: "600" as const },
};
