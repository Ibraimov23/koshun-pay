const config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        accent: {
          50: "#eef7f4",
          100: "#d7eee6",
          200: "#b2ddcd",
          300: "#86c6af",
          400: "#55a98d",
          500: "#2f6b5b",
          600: "#285a4d",
          700: "#224b41",
          800: "#1e3d35",
          900: "#19332d"
        }
      }
    }
  },
  plugins: []
};

export default config;
