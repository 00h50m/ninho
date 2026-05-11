/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg:       '#161614',
          surface:  '#1e1e1c',
          surface2: '#252523',
          border:   '#2e2e2c',
          border2:  '#3a3a38',
          text:     '#f0ede8',
          muted:    '#a0a09a',
          subtle:   '#666',
          faint:    '#444',
          green:    '#5dcaa5',
          'green-bg': '#0f2a1e',
          'green-border': '#1d5a3a',
          amber:    '#ef9f27',
          'amber-bg': '#2a1a08',
          coral:    '#d85a30',
          'coral-bg': '#2a0e08',
          purple:   '#9f8fee',
          'purple-bg': '#1a1040',
          warm:     '#c4a882',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '16px',
      }
    },
  },
  plugins: [],
}
