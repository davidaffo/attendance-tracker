import { Copy } from 'lucide-react'

interface NextcloudQuickAccessButtonProps {
  link?: string
  onCopied: () => void
  className?: string
  disabled?: boolean
}

export function NextcloudQuickAccessButton({
  link,
  onCopied,
  className = 'button secondary',
  disabled = false
}: NextcloudQuickAccessButtonProps) {
  const copyLink = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      onCopied()
    } catch {
      window.prompt('Copia il link rapido per allenatori e giocatrici:', link)
    }
  }

  return (
    <button
      className={className}
      type="button"
      onClick={() => void copyLink()}
      disabled={disabled || !link}
      title={link ? 'Copia il link di configurazione' : 'Configura prima Nextcloud'}
    >
      <Copy size={16} />
      Copia link accesso
    </button>
  )
}
