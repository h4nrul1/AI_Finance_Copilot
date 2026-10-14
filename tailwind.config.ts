import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        muted: "#647077",
        paper: "#f6f7f2",
        panel: "#ffffff",
        line: "#dfe4dc",
        sage: "#5f7f63",
        moss: "#335946",
        coral: "#d66f5d",
        gold: "#c49b45",
        blue: "#40798c"
      },
      boxShadow: {
        soft: "0 16px 42px rgba(31, 45, 36, 0.10)"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
