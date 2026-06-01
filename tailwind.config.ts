import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0466c8",
          dark: "#023e7d",
          soft: "#d0e4f9",
        },
        accent: {
          orange: "#F99132",
          yellow: "#F9CB32",
          green: "#3ECD88",
        },
        muted: {
          DEFAULT: "#979dac",
        },
        error: {
          DEFAULT: "#CE1821",
        },
      },
      boxShadow: {
        card: "0 4px 24px -4px rgba(0, 18, 51, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
