/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./**/*.{html,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        background: "var(--bg-dark)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "#ffffff",
        },
        card: {
          DEFAULT: "var(--bg-card)",
          foreground: "var(--text-primary)",
        },
      },
    },
  },
  plugins: [],
}
