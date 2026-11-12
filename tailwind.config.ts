import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      // Each color is a theme variable (see app/globals.css), so dark mode swaps the palette in one place.
      colors: {
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        paper: "rgb(var(--paper) / <alpha-value>)",
        panel: "rgb(var(--panel) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        sage: "rgb(var(--sage) / <alpha-value>)",
        moss: "rgb(var(--moss) / <alpha-value>)",
        coral: "rgb(var(--coral) / <alpha-value>)",
        gold: "rgb(var(--gold) / <alpha-value>)",
        "gold-ink": "rgb(var(--gold-ink) / <alpha-value>)",
        blue: "rgb(var(--blue) / <alpha-value>)"
      },
      boxShadow: {
        soft: "0 16px 42px rgb(var(--shadow) / 0.10)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
