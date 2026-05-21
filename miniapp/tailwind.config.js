/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#050814",
        card: "#0d1324",
        "card-soft": "#111827",
        text: "#ffffff",
        muted: "#9ca3af",
        primary: "#6d5dfc",
        "primary-2": "#8b5cf6",
        blue: "#3b82f6"
      },
      boxShadow: {
        glow: "0 20px 60px rgba(109,93,252,0.25)"
      }
    }
  },
  plugins: []
};
