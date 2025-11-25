/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,html}",
    "./pages/**/*.{js,ts,jsx,tsx,html}",
    "./components/**/*.{js,ts,jsx,tsx,html}",
  ],
  theme: {
    extend: {
      colors: {
        zeff: {
          50:  '#f3f8ff',
          100: '#e6f0ff',
          200: '#bfdfff',
          300: '#99cfff',
          400: '#6aa6ff', // primary accent (used as --accent)
          500: '#3b82f6', // stronger primary
          600: '#1e6ce0',
          700: '#1550b0',
          800: '#0f3a80',
          900: '#061f45',
          bg:   '#0b1020',   // page background
          card: '#121a33',   // card surface
          text: '#e6e9f2',   // primary text
          muted:'#9aa3b2',   // muted text
          accent2:'#7ad1ff', // secondary accent (lighter)
          ratingFrom:'#fbbf24',
          ratingTo:'#f59e0b',
          danger:'#ff6b6b',
          glassBorder: 'rgba(255,255,255,0.08)'
        }
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial'],
      },
      borderRadius: {
        'md-lg': '12px',
        'xl-20': '20px',
      },
      boxShadow: {
        'zeff-sm': '0 6px 18px rgba(2,6,23,0.45)',
        'zeff-lg': '0 10px 30px rgba(0,0,0,0.35)',
        'zeff-glow': '0 8px 32px rgba(59,130,246,0.12)',
      },
      backdropBlur: {
        sm: '4px',
        md: '8px',
        lg: '12px',
      },
      ringColor: {
        zeff: '#6aa6ff',
      },
      gradientColorStops: theme => ({
        ...theme('colors'),
        'zeff-primary-from': '#3b82f6',
        'zeff-primary-to': '#06b6d4',
        'zeff-secondary-from': '#10b981',
        'zeff-secondary-to': '#059669',
        'zeff-rating-from': '#fbbf24',
        'zeff-rating-to': '#f59e0b',
      }),
      backgroundImage: {
        'zeff-radial': 'radial-gradient(1200px 800px at 20% -10%, #1b2650 0, transparent 60%)',
        'glass-gradient': 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
      },
      transitionTimingFunction: {
        'zeff-smooth': 'cubic-bezier(.2,.9,.2,1)'
      },
      opacity: {
        'glass-veil': '0.06'
      }
    }
  },
  plugins: [],
}

