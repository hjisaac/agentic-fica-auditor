/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0d0e12",
        card: "rgba(30, 41, 59, 0.4)",
        primary: "#3b82f6",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
    },
  },
  plugins: [],
}
