/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#f0f2f8",
        surface: "#ffffff",
        border: "#e4e8f2",
        border2: "#cdd3e0",
        text: "#0f172a",
        muted: "#64748b",
        accent: "#4338ca",
        accent2: "#ede9fe",
        success: "#16a34a",
        warn: "#d97706",
        danger: "#dc2626",
        info: "#0891b2",
        sidebar: "#ffffff",
        "sidebar-text": "#475569",
        "sidebar-active": "#4338ca",
        "sidebar-border": "#e4e8f2",
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
        "4xl": "28px",
      },
      boxShadow: {
        card: "0 1px 3px rgba(67,56,202,.06), 0 1px 2px rgba(0,0,0,.04)",
        "card-md": "0 6px 24px rgba(67,56,202,.12), 0 2px 8px rgba(0,0,0,.06)",
        "card-lg": "0 16px 48px rgba(67,56,202,.16), 0 6px 20px rgba(0,0,0,.08)",
        sidebar: "4px 0 28px rgba(0,0,0,.08)",
        lift: "0 8px 30px rgba(67,56,202,.18), 0 3px 10px rgba(0,0,0,.07)",
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "14px", letterSpacing: "0.06em" }],
      },
    },
  },
  plugins: [],
};
