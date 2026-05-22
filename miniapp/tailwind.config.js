/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-soft": "var(--bg-soft)",
        card: "var(--card)",
        "card-soft": "var(--card-soft)",
        border: "var(--border)",
        text: "var(--text)",
        "text-soft": "var(--text-soft)",
        muted: "var(--muted)",
        "muted-light": "var(--muted-light)",
        primary: "var(--primary)",
        "primary-hover": "var(--primary-hover)",
        "primary-soft": "var(--primary-soft)",
        purple: "var(--purple)",
        blue: "var(--blue)",
        green: "var(--green)",
        orange: "var(--orange)",
        yellow: "var(--yellow)",
        red: "var(--red)"
      },
      boxShadow: {
        card: "var(--shadow-card)",
        hover: "var(--shadow-hover)"
      }
    }
  },
  plugins: []
};
