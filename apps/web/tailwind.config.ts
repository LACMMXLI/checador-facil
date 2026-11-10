import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#f1f0ff', 100: '#e4e2ff', 200: '#cdc9ff', 300: '#aaa3ff', 400: '#8677fb', 500: '#6c53f4', 600: '#5b38e8', 700: '#4c2bcc', 800: '#3f26a5', 900: '#352383', 950: '#1f1450' },
        ink: { 50: '#f6f7fb', 100: '#eceef5', 200: '#d9dce8', 300: '#b8bdd1', 400: '#8a91ad', 500: '#646b89', 600: '#4b5170', 700: '#3a3f58', 800: '#272a3d', 900: '#171927', 950: '#0d0e18' },
        mint: { 50: '#ecfdf5', 100: '#d1fae5', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857' },
      },
      fontFamily: { sans: ['var(--font-body)', 'system-ui', 'sans-serif'], display: ['var(--font-display)', 'system-ui', 'sans-serif'] },
      boxShadow: { soft: '0 1px 2px rgba(23,25,39,.04), 0 8px 24px -8px rgba(23,25,39,.12)', glow: '0 10px 40px -10px rgba(91,56,232,.55)' },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(14px)' }, to: { opacity: '1', transform: 'none' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '70%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)', opacity: '1' } },
      },
      animation: { 'fade-up': 'fade-up .6s ease-out both', float: 'float 6s ease-in-out infinite', pop: 'pop .45s ease-out both' },
    },
  },
  plugins: [],
};
export default config;
