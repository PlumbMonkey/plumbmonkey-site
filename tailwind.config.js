/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./styles/**/*.css",
  ],
  theme: {
    extend: {
      colors: {
        // Victorian-gothic palette — replaces the generic zinc/teal look.
        burgundy: {
          50: "#fbeaec",
          100: "#f3cdd3",
          200: "#e3a1ac",
          300: "#cf7484",
          400: "#a8455a",
          500: "#7a2438", // primary accent
          600: "#5e1c2c",
          700: "#471522",
          800: "#330f19",
          900: "#210a10",
          950: "#150609",
        },
        brass: {
          50: "#fbf3e3",
          100: "#f3e0b3",
          200: "#e8c97e",
          300: "#d9ac52",
          400: "#c4923a",
          500: "#a97829", // candlelight accent
          600: "#8a5f20",
          700: "#6b4818",
          800: "#4d3311",
          900: "#31200a",
        },
        moonlit: {
          50: "#eef1f5",
          100: "#d3dae4",
          200: "#aeb9c9",
          300: "#8695ab",
          400: "#61708a",
          500: "#495570",
          600: "#394258",
          700: "#2b3243",
          800: "#1d222f",
          900: "#12151d", // base surface (replaces zinc-900)
          950: "#0a0c11", // base background (replaces zinc-950)
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
    },
  },
  plugins: [],
};