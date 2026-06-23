/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f0f2f8",
        surface: "#ffffff",
        border: "#e5e8f0",
        border2: "#d1d5db",
        text: "#0f172a",
        muted: "#64748b",
        accent: "#4338ca",
        accent2: "#ede9fe",
        success: "#16a34a",
        warn: "#d97706",
        danger: "#dc2626",
        info: "#0891b2",
        sidebar: "#ffffff",
        "sidebar-text": "#64748b",
        "sidebar-active": "#4338ca",
        "sidebar-border": "#e5e8f0",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: {
        DEFAULT: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "20px",
        "3xl": "24px",
      },
      boxShadow: {
        card: "0 1px 4px rgba(67,56,202,.06), 0 1px 2px rgba(0,0,0,.04)",
        "card-md": "0 4px 16px rgba(67,56,202,.10), 0 2px 6px rgba(0,0,0,.05)",
        "card-lg": "0 8px 32px rgba(67,56,202,.12), 0 4px 12px rgba(0,0,0,.06)",
        sidebar: "4px 0 24px rgba(0,0,0,.08)",
      },
    },
  },
  plugins: [],
};
