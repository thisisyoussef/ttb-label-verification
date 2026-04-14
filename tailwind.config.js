/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/client/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f9f9f8',
        surface: '#f9f9f8',
        'surface-bright': '#f9f9f8',
        'surface-dim': '#d4dcda',
        'surface-container-lowest': '#ffffff',
        'surface-container-low': '#f2f4f3',
        'surface-container': '#ebeeed',
        'surface-container-high': '#e5e9e8',
        'surface-container-highest': '#dee4e2',
        'on-background': '#2d3433',
        'on-surface': '#2d3433',
        'on-surface-variant': '#5a6060',
        outline: '#767c7b',
        'outline-variant': '#adb3b2',
        primary: '#546067',
        'primary-dim': '#48545b',
        'on-primary': '#f0f9ff',
        'primary-container': '#d7e4ec',
        'on-primary-container': '#47545a',
        secondary: '#49636f',
        'on-secondary': '#f2faff',
        'secondary-container': '#cbe7f5',
        'on-secondary-container': '#3c5561',
        tertiary: '#1c6d25',
        'tertiary-dim': '#096119',
        'on-tertiary': '#eaffe2',
        'tertiary-container': '#9df197',
        'on-tertiary-container': '#005c15',
        error: '#9f403d',
        'on-error': '#fff7f6',
        'error-container': '#fe8983',
        'on-error-container': '#752121',
        caution: '#8e5f0a',
        'on-caution': '#ffffff',
        'caution-container': '#ffe0b3',
        'on-caution-container': '#4d3700'
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        full: '0.75rem'
      },
      fontFamily: {
        headline: ['"Public Sans"', 'system-ui', 'sans-serif'],
        body: ['"Work Sans"', 'system-ui', 'sans-serif'],
        label: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace']
      },
      boxShadow: {
        ambient: '0px 4px 20px rgba(45, 52, 51, 0.06)'
      }
    }
  },
  plugins: [require('@tailwindcss/forms'), require('@tailwindcss/container-queries')]
};
