import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // brand-* is the legacy alias kept for older components.
        // It now mirrors the violet scale so old btn-primary / focus rings
        // pick up the new identity without code churn.
        brand: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
        },
        // Primary identity — violet.
        violet: {
          50: "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        // Hot accent for mixes (price tags, promos, hovers).
        fuchsia: {
          50: "#fdf4ff",
          100: "#fae8ff",
          200: "#f5d0fe",
          300: "#f0abfc",
          400: "#e879f9",
          500: "#d946ef",
          600: "#c026d3",
          700: "#a21caf",
          800: "#86198f",
          900: "#701a75",
        },
        // Champagne gold for premium / verified moments.
        gold: {
          50: "#fbf6e6",
          100: "#f3e6b8",
          200: "#e9d089",
          300: "#dcb858",
          400: "#cf9f32",
          500: "#b9881e",
          600: "#956b16",
          700: "#714f10",
          800: "#4d350a",
          900: "#2a1c05",
        },
        // Neutral structure — slightly warmer than pure neutral.
        ink: {
          50: "#f7f7f8",
          100: "#e4e4e8",
          200: "#cccccf",
          300: "#a3a3a8",
          400: "#737378",
          500: "#525258",
          600: "#404048",
          700: "#262630",
          800: "#171720",
          900: "#0a0a14",
        },
        emerald: {
          accent: "#0b6e4f",
        },
        burgundy: {
          DEFAULT: "#6b1a2a",
          50: "#fbeef0",
          500: "#8b1d33",
          700: "#6b1a2a",
        },
      },
      fontFamily: {
        // Both families load via next/font/google in app/layout.tsx and are
        // exposed as CSS variables, so component classes stay framework-clean.
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      backgroundImage: {
        // Reusable signature gradients.
        "g-aurora": "linear-gradient(120deg,#4c1d95 0%,#7c3aed 35%,#d946ef 70%,#cf9f32 100%)",
        "g-nightline": "linear-gradient(180deg,#0a0a14 0%,#2e1065 100%)",
        "g-violet-fuchsia": "linear-gradient(135deg,#7c3aed 0%,#d946ef 100%)",
        "g-gold-soft": "linear-gradient(135deg,#fbf6e6 0%,#f3e6b8 100%)",
      },
      boxShadow: {
        soft: "0 12px 40px -16px rgba(76,29,149,0.25)",
        glow: "0 0 0 1px rgba(124,58,237,0.18), 0 12px 40px -12px rgba(124,58,237,0.35)",
      },
      screens: {
        "3xl": "1800px",
      },
    },
  },
  plugins: [],
};

export default config;
