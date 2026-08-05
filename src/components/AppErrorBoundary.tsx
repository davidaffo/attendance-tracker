import { Component, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryState {
  failed: boolean
}

export class AppErrorBoundary extends Component<
  { children: ReactNode },
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Errore durante il rendering dell’app.', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children

    return (
      <main className="error-page" role="alert">
        <div className="error-card">
          <h1>Impossibile aprire il registro</h1>
          <p>Ricarica la pagina. I dati già salvati sul dispositivo non verranno cancellati.</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Ricarica
          </button>
        </div>
      </main>
    )
  }
}
