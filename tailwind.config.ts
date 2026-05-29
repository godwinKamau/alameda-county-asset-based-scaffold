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
          DEFAULT: "#457B9D",
          dark: "#1D3557",
          soft: "#DCE8F5",
        },
        accent: {
          orange: "#F99132",
          yellow: "#F9CB32",
          green: "#3ECD88",
        },
        muted: {
          DEFAULT: "#ACACAC",
        },
        error: {
          DEFAULT: "#CE1821",
        },
      },
      boxShadow: {
        card: "0 4px 24px -4px rgba(29, 53, 87, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
