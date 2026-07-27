/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./core/**/*.{ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Warm, friendly palette — marka çalışması yapılınca gözden geçirilecek.
        bg: {
          primary: "#FFFBF7",
          secondary: "#FFF4EC",
          tertiary: "#FDEADF",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          hover: "#FFF7F2",
          active: "#FFEDE4",
          elevated: "#FFFFFF",
        },
        brand: {
          DEFAULT: "#F97362", // coral
          light: "#FF9585",
          dark: "#E0523F",
        },
        accent: {
          DEFAULT: "#2FB8A6", // teal — eşleşme/olumlu aksiyon
          light: "#5ED3C3",
          dark: "#1E9384",
        },
        text: {
          primary: "#1F1A17",
          secondary: "#6B5D55",
          tertiary: "#9A8B82",
          muted: "#C4B7AE",
        },
        border: {
          DEFAULT: "#F0E2D8",
          light: "#F8EEE7",
          focus: "#F97362",
        },
        success: { DEFAULT: "#2FB8A6", light: "#5ED3C3" },
        warning: { DEFAULT: "#F5A524", light: "#FBBF4C" },
        danger: { DEFAULT: "#E5484D", light: "#F26F73" },
      },
      fontFamily: {
        sans: ["Inter_400Regular"],
        medium: ["Inter_600SemiBold"],
        bold: ["Inter_700Bold"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        "2xl": "24px",
        full: "9999px",
      },
    },
  },
  plugins: [],
};
