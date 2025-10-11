import { cn } from '../../lib/utils'
import { HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export function Card({ children, className, hover = true, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card bg-[var(--card)] border border-[var(--line)]",
        "shadow-md p-4 transition-all duration-mid ease-smooth",
        hover && "hover:-translate-y-0.5 hover:shadow-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
