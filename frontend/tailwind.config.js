/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        orbitron: ['Orbitron', 'sans-serif'],
      },
      colors: {
        // Background e Surface
        'zenith-bg': '#0f1117',
        'zenith-card': '#1a1c23',
        'zenith-border': '#2c2f36',

        // Neon accents
        'zenith-accent': '#00ffe0',
        'zenith-magenta': '#b200ff',

        // Typography
        'zenith-text': '#e5e7eb',
        'zenith-subtle': '#9ca3af',
        'zenith-muted': '#6b7280',

        // Status colors (opzionali)
        'zenith-success': '#00ffab',
        'zenith-error': '#ff4d6d',
        'zenith-warning': '#ffc300',
        'zenith-info': '#00bfff',
      },
      boxShadow: {
        // Neon glow for hover/effects
        'neon': '0 0 10px #00ffe044, 0 0 25px #00ffe033',
        'neon-blue': '0 0 10px #00e0ff66, 0 0 20px #00e0ff33',
        'neon-green': '0 0 10px #00ffab66, 0 0 20px #00ffab33',
        'neon-magenta': '0 0 10px #b200ff66, 0 0 20px #b200ff33',
      },
      animation: {
        'pulse-neon': 'pulseNeon 1.8s ease-in-out infinite',
        'fade-in': 'fadeIn 0.6s ease-out both',
      },
      keyframes: {
        pulseNeon: {
          '0%, 100%': {
            boxShadow: '0 0 10px #00ffe066, 0 0 25px #00ffe033',
          },
          '50%': {
            boxShadow: '0 0 20px #00ffe0cc, 0 0 35px #00ffe0aa',
          },
        },
        fadeIn: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [
    // Aggiungi questi plugin se usi moduli form o testo ricco
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
