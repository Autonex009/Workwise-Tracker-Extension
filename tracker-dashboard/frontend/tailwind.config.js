/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'] },
      colors: {
        brand: {
          admin: '#4f46e5',     // Indigo 600
          adminDark: '#0f172a', // Slate 900
          pm: '#1d4ed8',        // Blue 700
        },
      },
      keyframes: {
        'fade-in': { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in': { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
      },
      animation: { 'fade-in': 'fade-in 0.15s ease-out', 'scale-in': 'scale-in 0.18s ease-out' },
    },
  },
  plugins: [],
}
