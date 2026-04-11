/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors
        primary: '#3B82F6',
        danger: '#EF4444',
        warning: '#F59E0B',
        success: '#10B981',
        info: '#06B6D4',
        // Semantic colors
        accident: '#EF4444',
        violation: '#F59E0B',
        vehicle: '#3B82F6',
      }
    },
  },
  plugins: [],
}
