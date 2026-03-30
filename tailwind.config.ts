import type { Config } from 'tailwindcss'

/**
 * Tailwind v4: design tokens live in app/globals.css (@theme inline).
 * This file only extends theme for app-specific fluid type scale + scan animation.
 */
const config = {
  theme: {
    extend: {
      fontSize: {
        'fluid-base': 'clamp(0.875rem, 1vw + 0.5rem, 1rem)',
        'fluid-lg': 'clamp(1.125rem, 2vw + 0.5rem, 1.5rem)',
        'fluid-xl': 'clamp(1.5rem, 3vw + 1rem, 2.25rem)',
        'fluid-hero': 'clamp(2rem, 5vw + 1rem, 4rem)',
      },
      keyframes: {
        moveHorizontal: {
          '0%': { transform: 'translateX(-50%) translateY(-10%)' },
          '50%': { transform: 'translateX(50%) translateY(10%)' },
          '100%': { transform: 'translateX(-50%) translateY(-10%)' },
        },
        moveInCircle: {
          '0%': { transform: 'rotate(0deg)' },
          '50%': { transform: 'rotate(180deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        moveVertical: {
          '0%': { transform: 'translateY(-50%)' },
          '50%': { transform: 'translateY(50%)' },
          '100%': { transform: 'translateY(-50%)' },
        },
        scan: {
          '0%, 100%': { opacity: '0.3', transform: 'translateY(-60px)' },
          '50%': { opacity: '1', transform: 'translateY(60px)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        first: 'moveVertical 30s ease infinite',
        second: 'moveInCircle 20s reverse infinite',
        third: 'moveInCircle 40s linear infinite',
        fourth: 'moveHorizontal 40s ease infinite',
        fifth: 'moveInCircle 20s ease infinite',
        scan: 'scan 2s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
} satisfies Config

export default config
