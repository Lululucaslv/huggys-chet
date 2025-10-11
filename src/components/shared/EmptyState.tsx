import { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'
import { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ 
  icon: Icon, 
  title, 
  description, 
  action,
  className 
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 px-4 text-center", className)}>
      <Icon className="h-12 w-12 text-[var(--muted)] mb-4" strokeWidth={1.5} />
      <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[var(--muted)] mb-6 max-w-sm">
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
