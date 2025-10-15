import { cn } from '../../lib/utils'
import { ButtonHTMLAttributes } from 'react'

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'sm' | 'md'
  variant?: 'ghost' | 'outline'
}

export function SecondaryButton({ 
  children, 
  className, 
  size = 'md',
  variant = 'ghost',
  disabled,
  ...props 
}: SecondaryButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled}
      className={cn(
        "px-5 rounded-xl font-medium",
        "text-[var(--brand-600)]",
        "transition-all duration-mid ease-smooth",
        "disabled:text-[var(--disabled)] disabled:cursor-not-allowed disabled:opacity-60",
        "flex items-center justify-center gap-2",
        variant === 'ghost' && "hover:bg-[var(--brand-400)]/10",
        variant === 'outline' && "border border-[var(--brand-600)] hover:bg-[var(--brand-400)]/10",
        "focus:outline-none focus:ring-2 focus:ring-[var(--brand-400)]",
        size === 'md' && "h-11",
        size === 'sm' && "h-10",
        className
      )}
    >
      {children}
    </button>
  )
}
