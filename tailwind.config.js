/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gold: '#D4A843',
        'gold-dark': '#B8922A',
        'vc-text': '#1A1A1A',
        'vc-muted': '#666666',
        'vc-border': '#E5E5E5',
        'vc-secondary': '#F8F8F8',
        'vc-sidebar': '#1A1A1A',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
