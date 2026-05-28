/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Deep Professional Palette
        brand: {
          dark: '#0B0F1A',     // Primary background
          card: '#161B2E',     // Card background
          border: '#2D344B',   // Border color
          accent: '#3B82F6',   // Electric Blue
          success: '#10B981',  // Emerald Green
          danger: '#EF4444',   // Alert Red
          warning: '#F59E0B',  // Amber Warning
        }
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      }
    },
  },
  plugins: [],
}
