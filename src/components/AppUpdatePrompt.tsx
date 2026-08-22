import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { Download, RefreshCw } from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import {
  activateWaitingServiceWorker,
  clearCachesForScope,
  removeUpdateReloadToken,
  updateReloadUrl
} from '../services/appUpdate'

const UPDATE_INTERVAL_MS = 30 * 60 * 1000

interface AppUpdateContextValue {
  checking: boolean
  feedback: string
  registrationAvailable: boolean
  checkForUpdate: () => Promise<void>
  needRefresh: boolean
  updating: boolean
  installUpdate: () => Promise<void>
}

const AppUpdateContext = createContext<AppUpdateContextValue | undefined>(undefined)

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>()
  const [checking, setChecking] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [feedback, setFeedback] = useState('')
  const feedbackTimer = useRef<number | undefined>(undefined)
  const { needRefresh: [needRefresh, setNeedRefresh] } = useRegisterSW({
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

  useEffect(() => {
    const cleanUrl = removeUpdateReloadToken(window.location.href)
    if (cleanUrl) window.history.replaceState(window.history.state, '', cleanUrl)
  }, [])

  const installUpdate = async () => {
    if (!navigator.onLine) {
      showFeedback('Sei offline: impossibile scaricare la nuova versione.')
      return
    }

    setUpdating(true)
    try {
      const currentRegistration =
        registration ?? await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      const activated = currentRegistration
        ? await activateWaitingServiceWorker(currentRegistration, navigator.serviceWorker)
        : false

      if (activated) {
        window.location.reload()
        return
      }

      // Fallback per browser che non notificano controllerchange: rimuove solo
      // registrazione e cache di questa PWA. IndexedDB e registro restano intatti.
      const appScope =
        currentRegistration?.scope ?? new URL(import.meta.env.BASE_URL, window.location.origin).href
      if ('caches' in window) await clearCachesForScope(appScope, window.caches)
      await currentRegistration?.unregister()
      window.location.replace(updateReloadUrl(window.location.href))
    } catch (error) {
      console.error('Aggiornamento PWA non riuscito.', error)
      setUpdating(false)
      showFeedback('Aggiornamento non riuscito. Riprova tra poco.')
    }
  }

  const checkForUpdate = useCallback(async () => {
    if (!registration) {
      showFeedback('Controllo aggiornamenti non ancora disponibile.')
      return
    }
    await checkRegistration(registration, true)
  }, [checkRegistration, registration, showFeedback])

  return (
    <AppUpdateContext.Provider
      value={{
        checking,
        feedback,
        registrationAvailable: Boolean(registration),
        checkForUpdate,
        needRefresh,
        updating,
        installUpdate
      }}
    >
      {children}
    </AppUpdateContext.Provider>
  )
}

export function useAppUpdate() {
  const context = useContext(AppUpdateContext)
  if (!context) throw new Error('useAppUpdate deve essere usato dentro AppUpdateProvider.')
  return context
}

export function AppUpdatePrompt() {
  const { installUpdate, needRefresh, updating } = useAppUpdate()

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
          onClick={installUpdate}
        >
          {updating ? <RefreshCw className="spin" size={17} /> : <Download size={17} />}
          {updating ? 'Aggiorno…' : 'Aggiorna ora'}
        </button>
      </aside>
    )
  }

  return null
}

export function AppUpdateSettings() {
  const {
    checking,
    checkForUpdate,
    feedback,
    installUpdate,
    needRefresh,
    registrationAvailable,
    updating
  } = useAppUpdate()

  return (
    <section className="panel settings-panel coordinator-switch app-update-settings">
      <div>
        <h2>Aggiornamenti app</h2>
        <p>
          {needRefresh
            ? 'È disponibile una nuova versione dell’app.'
            : 'Il controllo automatico resta attivo. Puoi anche verificare manualmente.'}
        </p>
        {feedback && <span className="settings-feedback" role="status">{feedback}</span>}
      </div>
      <button
        className={`button ${needRefresh ? 'primary' : 'secondary'}`}
        type="button"
        disabled={checking || updating || (!registrationAvailable && !needRefresh)}
        onClick={needRefresh ? installUpdate : checkForUpdate}
      >
        <RefreshCw className={checking || updating ? 'spin' : undefined} size={17} />
        {updating
          ? 'Aggiorno…'
          : checking
            ? 'Controllo…'
            : needRefresh
              ? 'Aggiorna ora'
              : 'Controlla aggiornamenti'}
      </button>
    </section>
  )
}
