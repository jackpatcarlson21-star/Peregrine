/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        radar: {
          green: '#00FF41',
          dim:   '#00AA2A',
          dark:  '#001A08',
        },
        storm: {
          yellow: '#FFD700',
          orange: '#FF6600',
          red:    '#FF1111',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
