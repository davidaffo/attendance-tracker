import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { AppUpdatePrompt, AppUpdateProvider } from './components/AppUpdatePrompt'
import { initializeTheme } from './domain/theme'
import './styles/app.css'

initializeTheme()

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
