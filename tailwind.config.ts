import type { Config } from 'tailwindcss';

/**
 * Colors are defined as CSS variables (space-separated "R G B" triplets) so the
 * whole app can be re-skinned at runtime by setting `data-theme` on <html>.
 * The class names (text-navy, bg-brand, …) never change — only what the tokens
 * resolve to. See src/app/globals.css for the per-theme palettes.
 */
const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1200px' } },
    extend: {
      colors: {
        navy: {
          DEFAULT: rgb('--c-navy'),
          50: rgb('--c-navy-50'),
          100: rgb('--c-navy-100'),
          200: rgb('--c-navy-200'),
          300: rgb('--c-navy-300'),
          400: rgb('--c-navy-400'),
          500: rgb('--c-navy-500'),
          600: rgb('--c-navy-600'),
          700: rgb('--c-navy-700'),
          800: rgb('--c-navy-800'),
          900: rgb('--c-navy-900'),
        },
        brand: {
          DEFAULT: rgb('--c-brand'),
          soft: rgb('--c-brand-soft'),
          muted: rgb('--c-brand-muted'),
        },
        success: { DEFAULT: rgb('--c-success'), soft: rgb('--c-success-soft') },
        attention: { DEFAULT: rgb('--c-attention'), soft: rgb('--c-attention-soft') },
        danger: { DEFAULT: rgb('--c-danger'), soft: rgb('--c-danger-soft') },
        border: rgb('--c-border'),
        input: rgb('--c-input'),
        ring: rgb('--c-ring'),
        background: rgb('--c-background'),
        foreground: rgb('--c-foreground'),
        card: { DEFAULT: rgb('--c-card'), foreground: rgb('--c-card-foreground') },
        muted: { DEFAULT: rgb('--c-muted'), foreground: rgb('--c-muted-foreground') },
        accent: { DEFAULT: rgb('--c-accent'), foreground: rgb('--c-accent-foreground') },
      },
      borderRadius: {
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.75rem',
        card: 'var(--radius-card, 1.5rem)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,30,54,0.04), 0 6px 20px rgba(10,30,54,0.06)',
        'card-hover': '0 2px 4px rgba(10,30,54,0.06), 0 12px 32px rgba(10,30,54,0.10)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { 'fade-in': 'fade-in 0.25s ease-out' },
    },
  },
  plugins: [],
};

export default config;
