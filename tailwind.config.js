/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#F4F3EE",
        paperDim: "#EBE9E2",
        ink: "#1B1D1F",
        muted: "#6E6A61",
        line: "#D9D6CC",
        forest: "#1F6F54",
        forestDeep: "#164F3C",
        rust: "#A8452F",
        gold: "#B8862E",
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-plex-sans)", "sans-serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
      },
      borderRadius: {
        sm: "3px",
        DEFAULT: "4px",
        md: "6px",
      },
    },
  },
  plugins: [],
};
