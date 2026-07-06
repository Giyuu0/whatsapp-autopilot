/** @type {import('tailwindcss').Config} */
module.exports = {
  // Dark is the default; `dark:` utilities apply when <html data-theme="dark">.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wa: {
          green: "#25D366",
          dark: "#075E54",
          teal: "#128C7E",
          light: "#DCF8C6",
        },
        ink: {
          950: "#0a0f14",
          900: "#0e141b",
          850: "#131b24",
          800: "#18222d",
          700: "#22303c",
          600: "#2a3942",
        },
        // Theme-aware semantic tokens (driven by CSS variables in globals.css).
        // In dark mode these equal the old ink/white values, so dark is
        // unchanged; in light mode they flip. Alpha works via <alpha-value>.
        surface: "rgb(var(--surface) / <alpha-value>)",
        "surface-1": "rgb(var(--surface-1) / <alpha-value>)",
        "surface-2": "rgb(var(--surface-2) / <alpha-value>)",
        "surface-3": "rgb(var(--surface-3) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(37,211,102,0.15), 0 8px 30px -8px rgba(37,211,102,0.25)",
        bubble: "0 1px 1px rgba(0,0,0,0.25), 0 6px 16px -10px rgba(0,0,0,0.5)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        "bubble-in": {
          "0%": { opacity: "0", transform: "translateY(8px) scale(0.96)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out",
        "pulse-ring": "pulse-ring 1.8s cubic-bezier(0.4,0,0.6,1) infinite",
        "bubble-in": "bubble-in 0.28s cubic-bezier(0.22,1,0.36,1)",
        float: "float 5s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
