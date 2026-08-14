import { Check } from 'lucide-react'

interface AppBrandProps {
  subtitle: string
}

export function AppBrand({ subtitle }: AppBrandProps) {
  return (
    <div className="brand-lockup">
      <div className="brand-mark small" aria-hidden="true">
        <Check size={20} strokeWidth={3} />
      </div>
      <div>
        <strong>Registro Presenze</strong>
        <span>{subtitle}</span>
      </div>
    </div>
  )
}
