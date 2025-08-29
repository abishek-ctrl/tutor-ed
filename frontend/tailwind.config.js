/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          400: '#8b5cf6',
          500: '#7c3aed',
          600: '#6d28d9'
        }
      },
      boxShadow: {
        glass: '0 8px 30px rgba(2,6,23,0.35)'
      }
    }
  },
  plugins: []
}
