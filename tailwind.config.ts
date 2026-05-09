import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-dm-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-cormorant)", "Georgia", "serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
      colors: {
        navy: {
          DEFAULT: "#1C3687",
          50: "#e8ecf8",
          100: "#d3dbf1",
          500: "#2a4cc0",
          700: "#1C3687",
          800: "#0f1e4e",
          900: "#0c1e50",
          950: "#050d24",
        },
        edred: {
          DEFAULT: "#ED1B2F",
          50: "#fff0f1",
          600: "#b8101f",
        },
        gold: {
          DEFAULT: "#C8952A",
          50: "#fef3dc",
        },
        edgreen: {
          DEFAULT: "#00a878",
          50: "#e0f7f2",
        },
        edorange: {
          DEFAULT: "#e07b1a",
          50: "#fff4e5",
        },
        edpurple: {
          DEFAULT: "#7c3aed",
          50: "#f3efff",
        },
        edteal: {
          DEFAULT: "#0891b2",
          50: "#e0f7fa",
        },
        bg: {
          DEFAULT: "#f0f3fb",
          alt: "#e8edf7",
        },
        ink: {
          DEFAULT: "#11192d",
          muted: "#3a4d70",
          subtle: "#7888aa",
        },
      },
      borderRadius: {
        DEFAULT: "14px",
      },
      boxShadow: {
        soft: "0 2px 16px rgba(28,54,135,0.07)",
        card: "0 8px 40px rgba(28,54,135,0.14)",
        deep: "0 24px 72px rgba(28,54,135,0.18)",
      },
      animation: {
        "fade-up": "fadeUp 0.26s ease-out",
        blink: "blink 2s infinite",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        blink: {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.25" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
