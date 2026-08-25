import { ArrowLeft } from 'lucide-react'
import { ResetAppDataButton } from './ResetAppDataButton'
import { ThemeSelector } from './ThemeSelector'

interface AppModeControlsProps {
  onChooseMode: () => void
  onReset: () => Promise<void>
  variant?: 'light' | 'dark'
}

export function AppModeControls({
  onChooseMode,
  onReset,
  variant = 'light'
}: AppModeControlsProps) {
  return (
    <div className={`app-mode-controls ${variant}`}>
      <ThemeSelector compact />
      <ResetAppDataButton onReset={onReset} className="mode-control reset-control" />
      <button
        className="mode-control"
        type="button"
        onClick={onChooseMode}
        aria-label="Cambia modalità"
      >
        <ArrowLeft size={17} />
        <span>Cambia modalità</span>
      </button>
    </div>
  )
}
