import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        display: ["var(--font-display)"],
      },
      colors: {
        /* Legacy brand map → signal system (keeps old class names working) */
        brand: {
          50: "#e6f3f8",
          100: "#cce7f1",
          500: "#0b6e8f",
          600: "#095a75",
          900: "#0b1220",
        },
        ink: {
          DEFAULT: "var(--cm-ink)",
          soft: "var(--cm-ink-soft)",
        },
        canvas: {
          DEFAULT: "var(--cm-canvas)",
          deep: "var(--cm-canvas-deep)",
        },
        signal: {
          DEFAULT: "var(--cm-signal)",
          hover: "var(--cm-signal-hover)",
          muted: "var(--cm-signal-muted)",
          foreground: "var(--cm-signal-foreground)",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
          bg: "var(--cm-success-bg)",
          border: "var(--cm-success-border)",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
          bg: "var(--cm-warning-bg)",
          border: "var(--cm-warning-border)",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
          bg: "var(--cm-info-bg)",
          border: "var(--cm-info-border)",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        sidebar: "var(--shadow-sidebar)",
        glow: "var(--shadow-glow)",
      },
      maxWidth: {
        portal: "var(--layout-max)",
      },
      spacing: {
        sidebar: "var(--sidebar-width)",
      },
      transitionTimingFunction: {
        standard: "var(--ease-standard)",
        emphasized: "var(--ease-emphasized)",
        entrance: "var(--ease-entrance)",
        exit: "var(--ease-exit)",
      },
      transitionDuration: {
        instant: "var(--duration-instant)",
        fast: "var(--duration-fast)",
        normal: "var(--duration-normal)",
        moderate: "var(--duration-moderate)",
        slow: "var(--duration-slow)",
      },
      keyframes: {
        "cm-float": {
          "0%, 100%": { transform: "translate(-50%, -50%) translateY(0)" },
          "50%": { transform: "translate(-50%, -50%) translateY(-10px)" },
        },
        "cm-pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.55" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
      },
      animation: {
        float: "cm-float var(--duration-deliberate) var(--ease-standard) infinite",
        "pulse-ring": "cm-pulse-ring 2s var(--ease-standard) infinite",
      },
    },
  },
  plugins: [animate],
};
