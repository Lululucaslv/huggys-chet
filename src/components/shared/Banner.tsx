import { cn } from '../../lib/utils'
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from 'lucide-react'

interface BannerProps {
  type: 'info' | 'success' | 'warning' | 'error'
  text: string
  onClose?: () => void
  className?: string
}

export function Banner({ type, text, onClose, className }: BannerProps) {
  const icons = {
    info: Info,
    success: CheckCircle2,
    warning: AlertTriangle,
    error: XCircle,
  }

  const styles = {
    info: 'bg-[var(--info-bg)] text-[var(--info-600)] border-[var(--info-600)]',
    success: 'bg-[var(--success-bg)] text-[var(--success-600)] border-[var(--success-600)]',
    warning: 'bg-[var(--warn-bg)] text-[var(--warn-600)] border-[var(--warn-600)]',
    error: 'bg-[var(--danger-bg)] text-[var(--danger-600)] border-[var(--danger-600)]',
  }

  const Icon = icons[type]

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border",
        styles[type],
        className
      )}
      role="status"
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm flex-1">{text}</p>
      {onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
          aria-label="Close banner"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
