/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#000000',
          900: '#0a0a09',
          850: '#11110f',
          800: '#1b1b17',
          750: '#23231d',
          700: '#343329',
          600: '#4c493c',
        },
        cyan: {
          300: '#ebcda0',
          400: '#d9b77c',
          500: '#bd9a60',
          600: '#9e7e49',
          950: '#221a0d',
        },
        teal: {
          300: '#d8d1b2',
          400: '#c2bc9b',
          500: '#aaa17a',
          600: '#827751',
          950: '#1d1b11',
        },
        slate: { 100: '#eeede8', 200: '#dcdad1', 300: '#c2c1b7', 400: '#a1a295', 500: '#828477', 600: '#686a5d', 700: '#45483b', 800: '#26291f' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'glow-cyan': '0 0 25px -5px rgba(217, 183, 124, 0.18)',
        'glow-teal': '0 0 25px -5px rgba(194, 188, 155, 0.15)',
      }
    },
  },
  plugins: [],
}
