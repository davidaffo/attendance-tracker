import { MonitorCog, Moon, Sun } from 'lucide-react'
import { useState } from 'react'
import {
  loadThemePreference,
  storeThemePreference,
  type ThemePreference
} from '../domain/theme'

interface ThemeSelectorProps {
  compact?: boolean
}

export function ThemeSelector({ compact = false }: ThemeSelectorProps) {
  const [preference, setPreference] = useState(loadThemePreference)
  const Icon = preference === 'dark' ? Moon : preference === 'light' ? Sun : MonitorCog
  const labels: Record<ThemePreference, string> = {
    system: 'Dispositivo',
    light: 'Chiaro',
    dark: 'Scuro'
  }

  const changeTheme = (next: ThemePreference) => {
    setPreference(next)
    storeThemePreference(next)
  }

  if (compact) {
    const next: ThemePreference = preference === 'system'
      ? 'light'
      : preference === 'light'
        ? 'dark'
        : 'system'
    return (
      <button
        className="theme-selector compact"
        type="button"
        onClick={() => changeTheme(next)}
        aria-label={`Tema: ${labels[preference]}. Passa a ${labels[next]}`}
        title={`Tema: ${labels[preference]}`}
      >
        <Icon size={17} aria-hidden="true" />
        <span>{labels[preference]}</span>
      </button>
    )
  }

  return (
    <label className="theme-selector">
      <Icon size={17} aria-hidden="true" />
      <span>Tema</span>
      <select
        value={preference}
        onChange={(event) => changeTheme(event.target.value as ThemePreference)}
        aria-label="Tema dell’app"
      >
        <option value="system">Dispositivo</option>
        <option value="light">Chiaro</option>
        <option value="dark">Scuro</option>
      </select>
    </label>
  )
}
