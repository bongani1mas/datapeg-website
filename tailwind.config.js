/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1E3A8A',   // Deep Indigo
          accent: '#FCD34D',    // Soft Gold
          base: '#F8FAFC',      // Cloud Grey
        },
      },
    },
  },
  plugins: [],
}
