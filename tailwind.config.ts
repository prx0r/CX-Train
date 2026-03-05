import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        connexion: {
          primary: "#0f172a",
          accent: "#3b82f6",
          success: "#22c55e",
          warning: "#f59e0b",
          danger: "#ef4444",
          muted: "#64748b",
        },
      },
    },
  },
  plugins: [],
};
export default config;
