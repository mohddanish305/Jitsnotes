/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        // Charcoal & Burgundy Brand Palette (Apple + Linear + Notion academic design)
        charcoal: {
          DEFAULT: '#151515',
          deep: '#0B0B0B',
          muted: '#2A2A2A',
        },
        burgundy: {
          DEFAULT: '#8F1D32',
          light: '#A21F3D',
          dark: '#74152A',
          blush: '#F8E9EC',
          soft: '#FCF4F5',
          subtle: '#FFF8F9',
        },
        brand: {
          DEFAULT: '#8F1D32',
          hover: '#74152A',
          soft: '#FCF4F5',
          'soft-dark': '#1F1215',
          charcoal: '#151515',
        },
        // Light mode neutrals
        fog: '#F7F7F7',
        coal: '#151515',
        neutral: {
          primary: '#151515',
          secondary: '#666666',
          muted: '#999999',
          border: '#EDEDED',
          'border-strong': '#E5E5E5',
          hover: '#FAFAFA',
          active: '#F7F7F7',
        },
        // Semantic Functional Colors
        functional: {
          success: '#16A34A',
          warning: '#D97706',
          error: '#DC2626',
        },
        // Dark mode intentional layered palette matching JITS Notes design
        dark: {
          bg: '#0B0B0B',
          primary: '#151515',
          secondary: '#1B1B1B',
          elevated: '#1F1F1F',
          border: '#292929',
          'border-strong': '#333333',
          text: '#FFFFFF',
          'text-secondary': '#B5B5B5',
          'text-muted': '#858585',
          hover: '#1F1F1F',
          active: '#242424',
          blush: '#241217',
        },
      },
      boxShadow: {
        subtle: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        'subtle-dark': '0 1px 3px 0 rgba(0, 0, 0, 0.4)',
      },
      maxWidth: {
        content: '1300px',
      },
    },
  },
  plugins: [],
}
