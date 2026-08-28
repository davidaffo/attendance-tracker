import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AppUpdatePrompt, AppUpdateProvider } from './components/AppUpdatePrompt'
import { initializeTheme } from './domain/theme'
import './styles/app.css'

initializeTheme()

async function startApp() {
  if (import.meta.env.DEV && import.meta.env.VITE_DEV_DEMO_DATA !== 'false') {
    try {
      const { seedDevelopmentData } = await import('./dev/seedDevelopmentData')
      await seedDevelopmentData()
    } catch (error) {
      console.warn('Impossibile inizializzare i registri demo.', error)
    }
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppErrorBoundary>
        <AppUpdateProvider>
          <App />
          <AppUpdatePrompt />
        </AppUpdateProvider>
      </AppErrorBoundary>
    </StrictMode>
  )
}

void startApp()
