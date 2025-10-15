import { cn } from '../../lib/utils'
import { ButtonHTMLAttributes } from 'react'

interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md'
  loading?: boolean
}

export function PrimaryButton({ 
  children, 
  className, 
  size = 'md',
  loading = false,
  disabled,
  ...props 
}: PrimaryButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(
        "group relative px-5 rounded-xl font-medium text-white",
        "bg-[var(--brand-600)] hover:bg-[var(--brand-500)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]",
        "transition-all duration-mid ease-smooth",
        "disabled:bg-[var(--disabled)] disabled:cursor-not-allowed disabled:opacity-60",
        "flex items-center justify-center gap-2",
        size === 'md' && "h-11",
        size === 'sm' && "h-10",
        className
      )}
    >
      <span className={cn(
        "absolute inset-0 rounded-xl pointer-events-none opacity-0",
        "group-hover:opacity-100 transition-opacity duration-mid",
        "shadow-[0_0_24px_4px_rgba(37,99,235,0.25)]",
        (disabled || loading) && "hidden"
      )} />
      {loading ? (
        <>
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {children}
        </>
      ) : children}
    </button>
  )
}
