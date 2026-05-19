/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./pages/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "Segoe UI", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "Times New Roman", "serif"]
      },
      colors: {
        studio: {
          900: "#070b14",
          800: "#0f1729",
          700: "#172139",
          600: "#243354",
          400: "#63b3ff",
          300: "#8ec5ff"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(99,179,255,0.2), 0 12px 40px rgba(6,10,24,0.5)",
        "soft-card": "0 2px 28px -8px rgba(15,23,42,0.085), 0 2px 10px -4px rgba(15,23,42,0.045)",
        "elevated-sm": "0 1px 3px rgba(15,23,42,0.06), 0 8px 28px -10px rgba(14,165,233,0.22)"
      }
    }
  },
  plugins: []
};
