import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CalendarRange,
  Check,
  ClipboardCheck,
  Cloud,
  CloudOff,
  LoaderCircle,
  Settings,
  ShieldCheck,
  Users
} from 'lucide-react'
import { AttendanceEditor } from './components/AttendanceEditor'
import { CoachOnboarding } from './components/CoachOnboarding'
import { CoordinatorDashboard } from './components/CoordinatorDashboard'
import { Dashboard } from './components/Dashboard'
import { MonthlyRegister } from './components/MonthlyRegister'
import { PasswordPrompt } from './components/PasswordPrompt'
import { SetupCoach } from './components/SetupCoach'
import { SyncSettings } from './components/SyncSettings'
import { TeamSettings } from './components/TeamSettings'
import {
  COACH_ONBOARDING_VERSION,
  isFirstCoachUse
} from './domain/defaults'
import { deleteSession, saveSession } from './domain/document'
import {
  metaForManualSync,
  metaForRestoredBackup
} from './domain/syncConfig'
import type {
  AppMode,
  LocalSyncMeta,
  SyncConfig,
  SyncIndicator,
  TeamDocument,
  TrainingSession
} from './domain/types'
import { synchronizeDocument } from './services/webdav'
import {
  clearLocalData,
  loadAppMode,
  loadCoachOnboardingVersion,
  loadCoordinatorSyncConfig,
  loadDocument,
  loadSyncConfig,
  loadSyncMeta,
  removeLegacyEncryptedCredentials,
  storeAppMode,
  storeCoachOnboardingVersion,
  storeCoordinatorSyncConfig,
  storeDocument,
  storeSyncConfig,
  storeSyncMeta
} from './storage/database'

type CoachView = 'home' | 'register' | 'team' | 'settings'
type SyncOutcome =
  | { status: 'synced' | 'skipped' | 'cancelled' }
  | { status: 'error'; message: string }

const navigation = [
  { id: 'home' as const, path: '/allenatore', label: 'Oggi', icon: ClipboardCheck },
  {
    id: 'register' as const,
    path: '/allenatore/registro',
    label: 'Registro',
    icon: CalendarRange
  },
  { id: 'team' as const, path: '/allenatore/squadra', label: 'Squadra', icon: Users },
  {
    id: 'settings' as const,
    path: '/allenatore/impostazioni',
    label: 'Impostazioni',
    icon: Settings
  }
]

function normalizePath(path: string): string {
  if (path === '/') return path
  return path.replace(/\/+$/, '')
}

function currentRoutePath(): string {
  const hashPath = window.location.hash.startsWith('#/')
    ? window.location.hash.slice(1)
    : '/'
  return normalizePath(hashPath)
}

function routeHref(path: string): string {
  return `${import.meta.env.BASE_URL}#${normalizePath(path)}`
}

function isCoachSyncRoute(path: string): boolean {
  return (
    path.startsWith('/allenatore') &&
    path !== '/allenatore/configurazione-guidata'
  )
}

function coachViewForPath(path: string): CoachView {
  return navigation.find((item) => item.path === path)?.id ?? 'home'
}

function syncLabel(indicator: SyncIndicator): string {
  switch (indicator) {
    case 'syncing':
      return 'Sincronizzo'
    case 'synced':
      return 'Sincronizzato'
    case 'pending':
      return 'Da sincronizzare'
    case 'conflict':
      return 'Conflitto'
    case 'error':
      return 'Errore cloud'
    default:
      return 'Solo dispositivo'
  }
}

function Welcome({ onSelect }: { onSelect: (mode: AppMode) => void }) {
  return (
    <main className="welcome-page">
      <div className="welcome-content">
        <div className="brand-mark welcome-mark">
          <Check size={34} strokeWidth={3} />
        </div>
        <h1>Registro presenze</h1>
        <p>Seleziona la modalità per questo dispositivo.</p>
        <div className="mode-grid">
          <button className="mode-card" onClick={() => onSelect('coach')}>
            <ClipboardCheck size={26} />
            <strong>Allenatore</strong>
            <span>Inserimento e modifica delle presenze.</span>
          </button>
          <button className="mode-card" onClick={() => onSelect('coordinator')}>
            <ShieldCheck size={26} />
            <strong>Coordinatore</strong>
            <span>Consultazione dei registri delle squadre.</span>
          </button>
        </div>
      </div>
    </main>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState(false)
  const [pathname, setPathname] = useState(currentRoutePath)
  const [document, setDocument] = useState<TeamDocument>()
  const [syncConfig, setSyncConfig] = useState<SyncConfig>()
  const [coordinatorSyncConfig, setCoordinatorSyncConfig] = useState<SyncConfig>()
  const [syncMeta, setSyncMeta] = useState<LocalSyncMeta>({ dirty: false })
  const [syncIndicator, setSyncIndicator] = useState<SyncIndicator>('local')
  const [coachOnboardingVersion, setCoachOnboardingVersion] = useState<number>()
  const [passwordPrompt, setPasswordPrompt] = useState<{
    owner: 'coach' | 'coordinator'
    username: string
  }>()
  const documentRef = useRef<TeamDocument | undefined>(undefined)
  const configRef = useRef<SyncConfig | undefined>(undefined)
  const metaRef = useRef<LocalSyncMeta>({ dirty: false })
  const syncPromiseRef = useRef<Promise<SyncOutcome> | undefined>(undefined)
  const resettingRef = useRef(false)
  const passwordRequestRef = useRef<{
    owner: 'coach' | 'coordinator'
    promise: Promise<string | undefined>
    resolve: (password: string | undefined) => void
  } | undefined>(undefined)

  const navigate = useCallback(
    (path: string, options?: { replace?: boolean; from?: string }) => {
      const nextPath = normalizePath(path)
      const state = options?.from ? { from: options.from } : null
      if (options?.replace) {
        window.history.replaceState(state, '', routeHref(nextPath))
      } else {
        window.history.pushState(state, '', routeHref(nextPath))
      }
      setPathname(nextPath)
      window.scrollTo({ top: 0 })
    },
    []
  )

  useEffect(() => {
    const handleNavigation = () => setPathname(currentRoutePath())
    window.addEventListener('popstate', handleNavigation)
    window.addEventListener('hashchange', handleNavigation)
    return () => {
      window.removeEventListener('popstate', handleNavigation)
      window.removeEventListener('hashchange', handleNavigation)
    }
  }, [])

  const requestPassword = useCallback(
    (owner: 'coach' | 'coordinator', username: string): Promise<string | undefined> => {
      const currentRequest = passwordRequestRef.current
      if (currentRequest) return currentRequest.promise

      let resolveRequest!: (password: string | undefined) => void
      const promise = new Promise<string | undefined>((resolve) => {
        resolveRequest = resolve
      })
      passwordRequestRef.current = {
        owner,
        promise,
        resolve: resolveRequest
      }
      setPasswordPrompt({ owner, username })
      return promise
    },
    []
  )

  const finishPasswordRequest = (password?: string) => {
    const request = passwordRequestRef.current
    if (!request) return
    passwordRequestRef.current = undefined
    setPasswordPrompt(undefined)
    request.resolve(password)
  }

  const applyDocument = (next: TeamDocument | undefined) => {
    documentRef.current = next
    setDocument(next)
  }

  const applyConfig = (next: SyncConfig | undefined) => {
    configRef.current = next
    setSyncConfig(next)
  }

  const applyMeta = (next: LocalSyncMeta) => {
    metaRef.current = next
    setSyncMeta(next)
  }

  const performSync = useCallback(
    (
      currentDocument = documentRef.current,
      currentMeta = metaRef.current,
      currentConfig = configRef.current
    ): Promise<SyncOutcome> => {
      if (!currentDocument || !currentConfig) {
        return Promise.resolve({ status: 'skipped' })
      }
      if (currentMeta.restorePending) {
        setSyncIndicator('pending')
        return Promise.resolve({ status: 'skipped' })
      }
      if (!navigator.onLine) {
        setSyncIndicator(currentMeta.dirty ? 'pending' : 'local')
        return Promise.resolve({ status: 'skipped' })
      }
      if (syncPromiseRef.current) return syncPromiseRef.current

      const operation = (async (): Promise<SyncOutcome> => {
        try {
          let readyConfig = currentConfig
          if (!readyConfig.appPassword) {
            setSyncIndicator(currentMeta.dirty ? 'pending' : 'local')
            const password = await requestPassword('coach', readyConfig.username)
            if (!password) return { status: 'cancelled' }
            readyConfig = { ...readyConfig, appPassword: password }
            applyConfig(readyConfig)
          }

          setSyncIndicator('syncing')
          const result = await synchronizeDocument(
            currentDocument,
            currentMeta,
            readyConfig
          )
          if (resettingRef.current) return { status: 'skipped' }
          await Promise.all([storeDocument(result.document), storeSyncMeta(result.meta)])
          applyDocument(result.document)
          applyMeta(result.meta)
          setSyncIndicator('synced')
          return { status: 'synced' }
        } catch (error) {
          if (resettingRef.current) return { status: 'skipped' }
          const message =
            error instanceof Error ? error.message : 'Sincronizzazione non riuscita.'
          if (
            message.includes('Credenziali non valide') ||
            message.includes('account non può leggere')
          ) {
            const current = configRef.current
            if (current) applyConfig({ ...current, appPassword: '' })
          }
          const nextMeta = { ...currentMeta, dirty: true, lastError: message }
          await storeSyncMeta(nextMeta)
          applyMeta(nextMeta)
          setSyncIndicator(
            message.toLocaleLowerCase().includes('conflitto') ? 'conflict' : 'error'
          )
          return { status: 'error', message }
        }
      })()

      syncPromiseRef.current = operation
      void operation.finally(() => {
        if (syncPromiseRef.current === operation) {
          syncPromiseRef.current = undefined
        }
      })
      return operation
    },
    [requestPassword]
  )

  useEffect(() => {
    let active = true
    Promise.all([
      loadAppMode(),
      loadDocument(),
      loadSyncConfig(),
      loadCoordinatorSyncConfig(),
      loadSyncMeta(),
      loadCoachOnboardingVersion(),
      removeLegacyEncryptedCredentials()
    ]).then(
      ([
        storedMode,
        storedDocument,
        storedConfig,
        storedCoordinatorConfig,
        storedMeta,
        storedOnboardingVersion
      ]) => {
        if (!active) return
        applyDocument(storedDocument)
        applyConfig(storedConfig)
        setCoordinatorSyncConfig(storedCoordinatorConfig)
        if (!storedOnboardingVersion && storedDocument) {
          void storeCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
          setCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
        } else {
          setCoachOnboardingVersion(storedOnboardingVersion)
        }
        applyMeta(storedMeta)
        setSyncIndicator(
          !storedConfig
            ? 'local'
            : storedMeta.dirty
              ? 'pending'
              : storedMeta.lastSyncedAt
                ? 'synced'
                : 'local'
        )
        if (currentRoutePath() === '/' && storedMode) {
          const initialPath = storedMode === 'coach' ? '/allenatore' : '/coordinatore'
          window.history.replaceState(null, '', routeHref(initialPath))
          setPathname(initialPath)
        }
        setLoading(false)
        const shouldSyncCoach =
          isCoachSyncRoute(currentRoutePath()) ||
          (currentRoutePath() === '/' && storedMode === 'coach')
        if (storedDocument && storedConfig && navigator.onLine && shouldSyncCoach) {
          void performSync(storedDocument, storedMeta, storedConfig)
        }
      },
      (error) => {
        console.error('Impossibile leggere i dati locali.', error)
        if (!active) return
        setLoadingError(true)
        setLoading(false)
      }
    )
    return () => {
      active = false
    }
  }, [performSync])

  useEffect(() => {
    const syncWhenAvailable = () => {
      if (isCoachSyncRoute(currentRoutePath())) void performSync()
    }
    const syncWhenVisible = () => {
      if (
        window.document.visibilityState === 'visible' &&
        isCoachSyncRoute(currentRoutePath())
      ) {
        void performSync()
      }
    }
    window.addEventListener('online', syncWhenAvailable)
    window.document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      window.removeEventListener('online', syncWhenAvailable)
      window.document.removeEventListener('visibilitychange', syncWhenVisible)
    }
  }, [performSync])

  const chooseMode = async (nextMode: AppMode) => {
    await storeAppMode(nextMode)
    navigate(nextMode === 'coach' ? '/allenatore' : '/coordinatore')
  }

  const commitDocument = async (next: TeamDocument, syncNow = true) => {
    const nextMeta = { ...metaRef.current, dirty: true, lastError: undefined }
    await Promise.all([storeDocument(next), storeSyncMeta(nextMeta)])
    applyDocument(next)
    applyMeta(nextMeta)
    setSyncIndicator(configRef.current ? 'pending' : 'local')
    if (syncNow && configRef.current && navigator.onLine) {
      void performSync(next, nextMeta, configRef.current)
    }
  }

  const completeSetup = async (next: TeamDocument) => {
    await storeCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
    setCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
    await commitDocument(next, false)
    navigate('/allenatore', { replace: true })
  }

  const completeCoachOnboarding = async (
    next: TeamDocument,
    nextSyncConfig?: SyncConfig
  ) => {
    const reopening = Boolean(document)
    await commitDocument(next, false)
    if (nextSyncConfig) {
      await storeSyncConfig(nextSyncConfig)
      applyConfig(nextSyncConfig)
      if (navigator.onLine) {
        void performSync(next, metaRef.current, nextSyncConfig)
      }
    } else if (configRef.current && navigator.onLine) {
      void performSync(next, metaRef.current, configRef.current)
    }
    await storeCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
    setCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
    navigate(reopening ? '/allenatore/impostazioni' : '/allenatore', {
      replace: true
    })
  }

  const skipCoachOnboarding = async () => {
    await storeCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
    setCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
    navigate(document ? '/allenatore/impostazioni' : '/allenatore', {
      replace: true
    })
  }

  const resetAllLocalData = async () => {
    resettingRef.current = true
    await clearLocalData()
    window.history.replaceState(null, '', routeHref('/'))
    window.location.reload()
  }

  const restoreCoachBackup = async (restoredDocument: TeamDocument) => {
    if (syncPromiseRef.current) await syncPromiseRef.current
    const wasEmpty = !documentRef.current
    const restoredMeta = metaForRestoredBackup()
    await Promise.all([
      storeDocument(restoredDocument),
      storeSyncMeta(restoredMeta),
      storeCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
    ])
    applyDocument(restoredDocument)
    applyMeta(restoredMeta)
    setCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
    setSyncIndicator(configRef.current ? 'pending' : 'local')
    if (wasEmpty) navigate('/allenatore', { replace: true })
  }

  const syncCoachManually = async () => {
    let currentMeta = metaRef.current
    if (currentMeta.restorePending) {
      currentMeta = metaForManualSync(currentMeta)
      await storeSyncMeta(currentMeta)
      applyMeta(currentMeta)
    }
    await performSync(documentRef.current, currentMeta, configRef.current)
  }

  const handleSessionSave = async (
    input: Pick<TrainingSession, 'id' | 'date' | 'attendances'>
  ) => {
    if (!document) return
    const otherOnDate = document.sessions.find(
      (session) => session.date === input.date && session.id !== input.id
    )
    if (otherOnDate) throw new Error('Esiste già un allenamento in questa data.')
    await commitDocument(saveSession(document, input, document.coachName))
  }

  const handleSessionDelete = async (sessionId: string) => {
    if (!document) return
    await commitDocument(deleteSession(document, sessionId, document.coachName))
  }

  const saveConfig = async (config: SyncConfig) => {
    await storeSyncConfig(config)
    applyConfig(config)
    if (documentRef.current) {
      if (syncPromiseRef.current) await syncPromiseRef.current
      applyConfig(config)
      let currentMeta = metaRef.current
      if (currentMeta.restorePending) {
        currentMeta = metaForManualSync(currentMeta)
        await storeSyncMeta(currentMeta)
        applyMeta(currentMeta)
      }
      const outcome = await performSync(
        documentRef.current,
        currentMeta,
        config
      )
      if (outcome.status === 'error') throw new Error(outcome.message)
    }
  }

  const persistCoachConnectionDetails = async (config: SyncConfig) => {
    await storeSyncConfig(config)
    applyConfig({ ...config, appPassword: '' })
  }

  const persistCoordinatorConnectionDetails = async (config: SyncConfig) => {
    await storeCoordinatorSyncConfig(config)
    setCoordinatorSyncConfig({ ...config, appPassword: '' })
  }

  const renderPage = (page: ReactNode) => (
    <>
      {page}
      {passwordPrompt && (
        <PasswordPrompt
          key={`${passwordPrompt.owner}-${passwordPrompt.username}`}
          username={passwordPrompt.username}
          onSubmit={(password) => finishPasswordRequest(password)}
          onCancel={() => finishPasswordRequest()}
        />
      )}
    </>
  )

  if (loading) {
    return (
      <div className="loading-page">
        <LoaderCircle className="spin" size={32} />
        <span>Apro il registro…</span>
      </div>
    )
  }

  if (loadingError) {
    return (
      <main className="error-page" role="alert">
        <div className="error-card">
          <h1>Impossibile leggere i dati locali</h1>
          <p>Ricarica la pagina. I dati presenti sul dispositivo non verranno cancellati.</p>
          <button className="button primary" onClick={() => window.location.reload()}>
            Ricarica
          </button>
        </div>
      </main>
    )
  }

  if (pathname === '/') return renderPage(<Welcome onSelect={chooseMode} />)

  const coordinatorTeamMatch = pathname.match(/^\/coordinatore\/squadra\/([^/]+)$/)
  if (pathname === '/coordinatore' || coordinatorTeamMatch) {
    return renderPage(
      <CoordinatorDashboard
        onChooseMode={() => navigate('/')}
        selectedTeamId={
          coordinatorTeamMatch ? decodeURIComponent(coordinatorTeamMatch[1]) : undefined
        }
        onNavigate={navigate}
        config={coordinatorSyncConfig}
        onSaveConfig={async (config) => {
          await storeCoordinatorSyncConfig(config)
          setCoordinatorSyncConfig(config)
        }}
        onPersistConnectionDetails={persistCoordinatorConnectionDetails}
        onRequestPassword={(username) => requestPassword('coordinator', username)}
        onResetAllData={resetAllLocalData}
      />
    )
  }

  if (!pathname.startsWith('/allenatore')) {
    return renderPage(
      <main className="welcome-page">
        <div className="welcome-content">
          <h1>Pagina non trovata</h1>
          <button className="button primary" onClick={() => navigate('/', { replace: true })}>
            Torna all’inizio
          </button>
        </div>
      </main>
    )
  }

  const showCoachOnboarding =
    pathname === '/allenatore/configurazione-guidata' ||
    isFirstCoachUse(coachOnboardingVersion, Boolean(document))

  if (showCoachOnboarding) {
    return renderPage(
      <CoachOnboarding
        document={document}
        syncConfig={syncConfig}
        onComplete={completeCoachOnboarding}
        onSkip={skipCoachOnboarding}
        onRestoreBackup={restoreCoachBackup}
      />
    )
  }

  if (!document) {
    return renderPage(
      <SetupCoach
        onComplete={completeSetup}
        onSwitchMode={() => void chooseMode('coordinator')}
        onRestoreBackup={restoreCoachBackup}
      />
    )
  }

  const editorMatch = pathname.match(/^\/allenatore\/sessione\/([^/]+)$/)
  if (editorMatch) {
    const sessionSegment = decodeURIComponent(editorMatch[1])
    const initialSession =
      sessionSegment === 'nuova'
        ? undefined
        : document.sessions.find((session) => session.id === sessionSegment)

    if (sessionSegment !== 'nuova' && !initialSession) {
      return renderPage(
        <main className="welcome-page">
          <div className="welcome-content">
            <h1>Allenamento non trovato</h1>
            <button
              className="button primary"
              onClick={() => navigate('/allenatore/registro', { replace: true })}
            >
              Apri il registro
            </button>
          </div>
        </main>
      )
    }

    const closeEditor = () => {
      const from = window.history.state?.from
      if (typeof from === 'string' && from.startsWith('/allenatore')) {
        window.history.back()
      } else {
        navigate('/allenatore/registro', { replace: true })
      }
    }

    return renderPage(
      <AttendanceEditor
        document={document}
        initialSession={initialSession}
        onSave={handleSessionSave}
        onDelete={handleSessionDelete}
        onClose={closeEditor}
      />
    )
  }

  const view = coachViewForPath(pathname)

  const SyncIcon =
    syncIndicator === 'syncing' ? LoaderCircle : syncIndicator === 'pending' ? CloudOff : Cloud

  return renderPage(
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark small">
            <Check size={20} strokeWidth={3} />
          </div>
          <div>
            <strong>Registro Presenze</strong>
            <span>{document.organizationName}</span>
          </div>
        </div>
        <nav>
          {navigation.map((item) => (
            <a
              key={item.id}
              href={routeHref(item.path)}
              className={view === item.id ? 'active' : ''}
              onClick={(event) => {
                event.preventDefault()
                navigate(item.path)
              }}
            >
              <item.icon size={19} />
              {item.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-team">
          <span>Squadra attiva</span>
          <strong>{document.teamName}</strong>
          <small>
            {document.season.startYear}–{document.season.endYear}
          </small>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div>
            <span>{document.organizationName}</span>
            <strong>{document.teamName}</strong>
          </div>
          <button
            className={`sync-chip ${syncIndicator}`}
            onClick={() => navigate('/allenatore/impostazioni')}
            title={syncMeta.lastError}
          >
            <SyncIcon className={syncIndicator === 'syncing' ? 'spin' : ''} size={15} />
            {syncLabel(syncIndicator)}
          </button>
        </header>

        <main className="main-view">
          {view === 'home' && (
            <Dashboard
              document={document}
              onNewSession={() =>
                navigate('/allenatore/sessione/nuova', { from: pathname })
              }
              onEditSession={(session) =>
                navigate(`/allenatore/sessione/${encodeURIComponent(session.id)}`, {
                  from: pathname
                })
              }
            />
          )}
          {view === 'register' && (
            <MonthlyRegister
              document={document}
              onEditSession={(session) =>
                navigate(`/allenatore/sessione/${encodeURIComponent(session.id)}`, {
                  from: pathname
                })
              }
              onNewSession={() =>
                navigate('/allenatore/sessione/nuova', { from: pathname })
              }
            />
          )}
          {view === 'team' && <TeamSettings document={document} onUpdate={commitDocument} />}
          {view === 'settings' && (
            <SyncSettings
              document={document}
              config={syncConfig}
              meta={syncMeta}
              indicator={syncIndicator}
              onSaveConfig={saveConfig}
              onPersistConnectionDetails={persistCoachConnectionDetails}
              onSync={syncCoachManually}
              onRestoreBackup={restoreCoachBackup}
              onChooseMode={() => navigate('/')}
              onOpenOnboarding={() =>
                navigate('/allenatore/configurazione-guidata')
              }
              onResetAllData={resetAllLocalData}
            />
          )}
        </main>

        <nav className="bottom-nav">
          {navigation.map((item) => (
            <a
              key={item.id}
              href={routeHref(item.path)}
              className={view === item.id ? 'active' : ''}
              onClick={(event) => {
                event.preventDefault()
                navigate(item.path)
              }}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
