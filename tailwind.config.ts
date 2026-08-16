import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    container: { center: true, padding: '1rem', screens: { '2xl': '1200px' } },
    extend: {
      colors: {
        // Family Hub design language
        navy: {
          DEFAULT: '#0F2A4A',
          50: '#EAF0F7',
          100: '#D6E1EF',
          200: '#AEC3DF',
          300: '#85A5CF',
          400: '#4E77AE',
          500: '#2A527F',
          600: '#1B3E63',
          700: '#0F2A4A',
          800: '#0A1E36',
          900: '#061323',
        },
        brand: {
          DEFAULT: '#2F6FED', // soft blue accent
          soft: '#5B8DF2',
          muted: '#E7EEFD',
        },
        success: { DEFAULT: '#1FA971', soft: '#E5F6EF' },
        attention: { DEFAULT: '#E8880C', soft: '#FDF0DE' },
        danger: { DEFAULT: '#DC2626', soft: '#FCE8E8' },
        border: 'hsl(214 20% 90%)',
        input: 'hsl(214 20% 90%)',
        ring: '#2F6FED',
        background: '#F6F8FB',
        foreground: '#0A1E36',
        card: { DEFAULT: '#FFFFFF', foreground: '#0A1E36' },
        muted: { DEFAULT: '#EEF2F7', foreground: '#5A6b80' },
        accent: { DEFAULT: '#E7EEFD', foreground: '#0F2A4A' },
      },
      borderRadius: {
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.75rem',
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
