/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0284c7', // MedTransfer Primary Blue
          600: '#0369a1',
          700: '#075985',
          800: '#0c4a6e',
          900: '#082f49',
        },
        clinical: {
          emergency: '#ef4444',
          critical: '#f97316',
          warning: '#eab308',
          success: '#10b981',
          teal: '#0d9488',
        }
      }
    },
  },
  plugins: [],
}
