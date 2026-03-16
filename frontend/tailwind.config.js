/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        fpl: {
          green: "#00ff87",
          purple: "#37003c",
          "purple-light": "#4a0060",
        },
        dark: {
          900: "#0a0a14",
          800: "#10101e",
          700: "#161628",
          600: "#1e1e32",
          500: "#2a2a42",
          400: "#3a3a54",
        },
      },
    },
  },
  plugins: [],
};
