/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f8f9fb",
        surface: "#ffffff",
        border: "#e5e7eb",
        border2: "#d1d5db",
        text: "#111827",
        muted: "#6b7280",
        accent: "#3b5bdb",
        accent2: "#e8ebff",
        success: "#16a34a",
        warn: "#d97706",
        danger: "#dc2626",
        info: "#0891b2",
        sidebar: "#1e293b",
        "sidebar-text": "#94a3b8",
        "sidebar-active": "#3b82f6",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,.08), 0 1px 2px rgba(0,0,0,.04)",
      },
    },
  },
  plugins: [],
};
