/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        darkBg: '#0B1120',
        darkCard: '#111827',
        darkHover: '#1E293B',
        darkPrimary: '#6366F1',
        darkText: '#F8FAFC',
        darkSecondary: '#94A3B8',
      },
    },
  },
  plugins: [],
}
