import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // CHRONO — violet "Biccord" palette
        chrono: {
          "bg-from": "#0b0716",
          "bg-to": "#140d28",
          neon: "#8b5cf6", // violet accent
          mint: "#c084fc", // soft purple
          fuchsia: "#d946ef", // magenta highlight
          muted: "#7c728f", // muted lavender-grey text
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "ui-sans-serif", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(139,92,246,0.18), 0 10px 30px rgba(0,0,0,0.5)",
        "neon-strong":
          "0 0 0 1px rgba(139,92,246,0.5), 0 16px 50px rgba(139,92,246,0.22)",
        glass: "inset 0 1px 0 0 rgba(255,255,255,0.07)",
      },
      keyframes: {
        "pulse-neon": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "pulse-neon": "pulse-neon 2.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
