import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_INTERVAL_MS = 30 * 60 * 1000

export function AppUpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const feedbackTimer = useRef<number | undefined>(undefined)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW: (_workerUrl, nextRegistration) => {
      setRegistration(nextRegistration)
    },
    onRegisterError: (error) => {
      console.warn('Controllo aggiornamenti PWA non disponibile.', error)
    }
  })

  const showFeedback = useCallback((message: string) => {
    window.clearTimeout(feedbackTimer.current)
    setFeedback(message)
    feedbackTimer.current = window.setTimeout(() => setFeedback(''), 4_000)
  }, [])

  const checkRegistration = useCallback(
    async (nextRegistration: ServiceWorkerRegistration, visibleFeedback: boolean) => {
      if (nextRegistration.waiting) {
        setNeedRefresh(true)
        return
      }
      if (!navigator.onLine) {
        if (visibleFeedback) showFeedback('Sei offline: controllo non disponibile.')
        return
      }

      if (visibleFeedback) setChecking(true)
      try {
        await nextRegistration.update()
        if (nextRegistration.waiting) {
          setNeedRefresh(true)
        } else if (nextRegistration.installing && visibleFeedback) {
          showFeedback('Nuova versione in preparazione…')
        } else if (visibleFeedback) {
          showFeedback('Controllo completato: stai usando l’ultima versione.')
        }
      } catch (error) {
        console.warn('Impossibile controllare gli aggiornamenti.', error)
        if (visibleFeedback) showFeedback('Controllo aggiornamenti non riuscito.')
      } finally {
        if (visibleFeedback) setChecking(false)
      }
    },
    [setNeedRefresh, showFeedback]
  )

  useEffect(() => {
    if (!registration) return

    const checkSilently = () => {
      if (window.document.visibilityState === 'visible') {
        void checkRegistration(registration, false)
      }
    }
    const interval = window.setInterval(checkSilently, UPDATE_INTERVAL_MS)
    window.addEventListener('online', checkSilently)
    window.document.addEventListener('visibilitychange', checkSilently)
    checkSilently()

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('online', checkSilently)
      window.document.removeEventListener('visibilitychange', checkSilently)
    }
  }, [checkRegistration, registration])

  useEffect(
    () => () => {
      window.clearTimeout(feedbackTimer.current)
    },
    []
  )

  const installUpdate = async () => {
    setUpdating(true)
    try {
      await updateServiceWorker(true)
    } catch (error) {
      console.error('Aggiornamento PWA non riuscito.', error)
      setUpdating(false)
      showFeedback('Aggiornamento non riuscito. Riprova tra poco.')
    }
  }

  if (needRefresh) {
    return (
      <aside className="app-update-banner" role="alert" aria-live="assertive">
        <div>
          <strong>Nuova versione disponibile</strong>
          <span>Aggiorna l’app per usare le ultime correzioni.</span>
        </div>
        <button
          className="button light compact"
          type="button"
          disabled={updating}
          onClick={() => void installUpdate()}
        >
          {updating ? <RefreshCw className="spin" size={17} /> : <Download size={17} />}
          {updating ? 'Aggiorno…' : 'Aggiorna ora'}
        </button>
      </aside>
    )
  }

  return (
    <div className="app-update-control">
      {feedback && <span role="status">{feedback}</span>}
      <button
        className="button secondary compact"
        type="button"
        disabled={checking || !registration}
        onClick={() => registration && void checkRegistration(registration, true)}
      >
        <RefreshCw className={checking ? 'spin' : undefined} size={16} />
        {checking ? 'Controllo…' : 'Controlla aggiornamenti'}
      </button>
    </div>
  )
}
