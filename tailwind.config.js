/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0F172A',
        surface: '#1F1E27',
        pitch: { DEFAULT: '#22C55E', dark: '#15803D' },
        trophy: '#F59E0B',
        indigo: '#6366F1',
        danger: '#DC2626',
      },
      fontFamily: {
        head: ['"Barlow Condensed"', 'sans-serif'],
        body: ['Barlow', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
