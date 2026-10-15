/** Colors are CSS variables (space-separated RGB) set by ThemeContext, so every
 *  unlockable theme and dark mode share one set of utility classes. */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

module.exports = {
  content: ["./src/**/*.{js,jsx}", "./public/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
        display: ['"Plus Jakarta Sans"', "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        primary: { DEFAULT: v("primary"), fg: v("primary-fg"), soft: v("primary-soft") },
        accent: v("accent"),
        bg: v("bg"),
        surface: { DEFAULT: v("surface"), 2: v("surface-2") },
        ink: { DEFAULT: v("ink"), muted: v("ink-muted"), faint: v("ink-faint") },
        line: v("line"),
        brand: { DEFAULT: "#76BC21", dark: "#385510", ink: "#121212", charcoal: "#4A4A4A", cream: "#F9F9F9", mint: "#EEF7E3" },
      },
      borderRadius: { xl: "0.875rem", "2xl": "1rem", "3xl": "1.5rem" },
      boxShadow: {
        soft: "0 1px 2px rgb(16 24 16 / 0.04), 0 4px 16px rgb(16 24 16 / 0.06)",
        lift: "0 2px 4px rgb(16 24 16 / 0.06), 0 12px 32px rgb(16 24 16 / 0.12)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: 0, transform: "translateY(12px)" }, "100%": { opacity: 1, transform: "none" } },
        float: { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-6px)" } },
        "slide-card": {
          "0%,15%": { transform: "translate(0,0)" },
          "45%,70%": { transform: "translate(calc(100% + 12px),0)" },
          "100%": { transform: "translate(0,0)" },
        },
        pop: { "0%": { transform: "scale(.6)", opacity: 0 }, "60%": { transform: "scale(1.08)", opacity: 1 }, "100%": { transform: "scale(1)" } },
      },
      animation: {
        "fade-up": "fade-up .6s ease-out both",
        float: "float 4s ease-in-out infinite",
        "slide-card": "slide-card 6s ease-in-out infinite",
        pop: "pop .5s ease-out both",
      },
    },
  },
  plugins: [],
};
