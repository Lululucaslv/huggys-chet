/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			card: 'var(--radius-card)',
  			input: 'var(--radius-input)',
  			tag: 'var(--radius-tag)',
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			brand: {
  				700: 'var(--brand-700)',
  				600: 'var(--brand-600)',
  				500: 'var(--brand-500)',
  				400: 'var(--brand-400)',
  			},
  			accent: {
  				500: 'var(--accent-500)',
  				400: 'var(--accent-400)',
  			},
  			semantic: {
  				success: 'var(--success-600)',
  				'success-bg': 'var(--success-bg)',
  				warn: 'var(--warn-600)',
  				'warn-bg': 'var(--warn-bg)',
  				danger: 'var(--danger-600)',
  				'danger-bg': 'var(--danger-bg)',
  				info: 'var(--info-600)',
  				'info-bg': 'var(--info-bg)',
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		spacing: {
  			'gap': 'var(--gap)',
  			'gap-card': 'var(--gap-card)',
  		},
  		transitionTimingFunction: {
  			smooth: 'var(--ease)',
  		},
  		transitionDuration: {
  			fast: 'var(--dur-fast)',
  			mid: 'var(--dur-mid)',
  			slow: 'var(--dur-slow)',
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

