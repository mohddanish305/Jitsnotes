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
        // Brand palette
        brand: {
          DEFAULT: '#2C3480',
          hover: '#3D4CC4',
          subtle: '#2C34801A',
        },
        interactive: {
          DEFAULT: '#3D4CC4',
          hover: '#2C3480',
        },
        // Light mode surfaces & text
        surface: {
          DEFAULT: '#FFFFFF',
          secondary: '#F7F8FA',
          border: '#E5E5E5',
          text: '#000000',
          'text-secondary': '#555555',
          'text-muted': '#858B99',
        },
        // Dark mode layered surfaces & text
        dark: {
          bg: '#0B0D12',
          header: '#10131A',
          card: '#14171F',
          elevated: '#1A1E28',
          input: '#171B24',
          border: '#292E3A',
          text: '#FFFFFF',
          'text-secondary': '#B8BDCA',
          'text-muted': '#858B99',
        },
      },
      maxWidth: {
        content: '1280px',
      },
    },
  },
  plugins: [],
}
