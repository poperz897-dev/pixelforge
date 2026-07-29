/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Pulled straight from PixelUniverse's own palette so the UI chrome
        // and the background read as one material instead of two layers.
        void: '#05060f',
        deep: '#0d1130',
        panel: 'rgba(18, 21, 46, 0.72)',
        'panel-border': 'rgba(115, 239, 247, 0.16)',
        starcyan: '#73eff7',
        starviolet: '#c4b5fd',
        gold: '#ffcd75',
      },
      fontFamily: {
        // Body copy stays maximally readable; the pixel face is reserved
        // for page titles only (see .font-pixel usage) so it never fights
        // legibility at small sizes.
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        pixel: ['"Press Start 2P"', 'monospace'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(115, 239, 247, 0.5), 0 0 22px -2px rgba(115, 239, 247, 0.55)',
        'glow-gold': '0 0 0 1px rgba(255, 205, 117, 0.5), 0 0 22px -2px rgba(255, 205, 117, 0.5)',
      },
      keyframes: {
        'pixel-blink': {
          '0%, 49%': { opacity: 1 },
          '50%, 100%': { opacity: 0.25 },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'pop-in': {
          '0%': { opacity: 0, transform: 'scale(0.92) translateY(6px)' },
          '100%': { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
        materialize: {
          '0%': { opacity: 0, transform: 'scale(0.4)' },
          '60%': { opacity: 1, transform: 'scale(1.15)' },
          '100%': { opacity: 1, transform: 'scale(1)' },
        },
      },
      animation: {
        'pixel-blink': 'pixel-blink 1.1s steps(2, jump-none) infinite',
        float: 'float 3.2s steps(12) infinite',
        'pop-in': 'pop-in 0.22s ease-out',
        materialize: 'materialize 0.5s steps(6) both',
      },
    },
  },
  plugins: [],
};
