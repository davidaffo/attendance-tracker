import { Copy } from 'lucide-react'
import type { AppMode } from '../domain/types'

interface NextcloudQuickAccessButtonsProps {
  links: Partial<Record<AppMode, string>>
  onCopied: (mode: AppMode) => void
  className?: string
  buttonClassName?: string
  disabled?: boolean
}

const roles: { mode: AppMode; label: string }[] = [
  { mode: 'viewer', label: 'Link giocatrice' },
  { mode: 'coach', label: 'Link allenatore' },
  { mode: 'coordinator', label: 'Link coordinatore' }
]

export function NextcloudQuickAccessButtons({
  links,
  onCopied,
  className = '',
  buttonClassName = 'button secondary',
  disabled = false
}: NextcloudQuickAccessButtonsProps) {
  const copyLink = async (mode: AppMode) => {
    const link = links[mode]
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      onCopied(mode)
    } catch {
      const role = roles.find((candidate) => candidate.mode === mode)?.label.toLowerCase()
      window.prompt(`Copia il ${role ?? 'link rapido'}:`, link)
    }
  }

  return (
    <div className={`quick-access-buttons ${className}`.trim()} role="group" aria-label="Link di accesso rapido">
      {roles.map(({ mode, label }) => {
        const link = links[mode]
        return (
          <button
            className={buttonClassName}
            type="button"
            key={mode}
            onClick={() => void copyLink(mode)}
            disabled={disabled || !link}
            title={link ? `Copia il link per ${label.slice(5).toLowerCase()}` : 'Configura prima Nextcloud'}
          >
            <Copy size={16} />
            {label}
          </button>
        )
      })}
    </div>
  )
}
