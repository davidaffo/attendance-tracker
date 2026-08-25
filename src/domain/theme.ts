export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'registro-presenze-theme'

export function loadThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system'
  }
}

export function resolvedTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyTheme(preference: ThemePreference): void {
  const theme = resolvedTheme(preference)
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.themePreference = preference
  document.documentElement.style.colorScheme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#101714' : '#173f35')
}

export function storeThemePreference(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    // Il tema resta comunque applicato per la sessione corrente.
  }
  applyTheme(preference)
}

export function initializeTheme(): void {
  applyTheme(loadThemePreference())
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const preference = loadThemePreference()
    if (preference === 'system') applyTheme(preference)
  })
}
