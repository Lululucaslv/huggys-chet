import { cn } from '../../lib/utils'

interface LoadingSkeletonProps {
  className?: string
  variant?: 'text' | 'card' | 'avatar' | 'button'
}

export function LoadingSkeleton({ className, variant = 'text' }: LoadingSkeletonProps) {
  const baseClasses = "animate-pulse bg-[var(--line)]"
  
  const variantClasses = {
    text: "h-4 rounded",
    card: "h-32 rounded-card",
    avatar: "h-10 w-10 rounded-full",
    button: "h-11 rounded-xl",
  }

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        className
      )}
      aria-label="Loading..."
    />
  )
}

export function SkeletonGroup({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <LoadingSkeleton key={i} variant="text" />
      ))}
    </div>
  )
}
