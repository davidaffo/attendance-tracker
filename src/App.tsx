import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  CalendarRange,
  Check,
  ClipboardCheck,
  Cloud,
  CloudOff,
  ChevronsUpDown,
  Eye,
  LoaderCircle,
  Settings,
  ShieldCheck,
  Users
} from 'lucide-react'
import { AttendanceEditor } from './components/AttendanceEditor'
import { AppBrand } from './components/AppBrand'
import { AppModeControls } from './components/AppModeControls'
import { CoachOnboarding } from './components/CoachOnboarding'
import { CoachStart } from './components/CoachStart'
import { CoachTeamSwitcher } from './components/CoachTeamSwitcher'
import { CoordinatorDashboard } from './components/CoordinatorDashboard'
import { Dashboard } from './components/Dashboard'
import { MonthlyRegister } from './components/MonthlyRegister'
import { PasswordPrompt } from './components/PasswordPrompt'
import { ResetAppDataButton } from './components/ResetAppDataButton'
import { SharedTeamSetup } from './components/SharedTeamSetup'
import { SyncSettings } from './components/SyncSettings'
import { TeamSettings } from './components/TeamSettings'
import { ThemeSelector } from './components/ThemeSelector'
import {
  COACH_ONBOARDING_VERSION
} from './domain/defaults'
import {
  allowsCoachBackgroundSync,
  hasStoredSetupForMode
} from './domain/accessPolicy'
import { deleteSession, saveSession } from './domain/document'
import {
  metaForManualSync,
  metaForRestoredBackup,
  nextcloudLinkFromRouteHash,
  nextcloudModeFromRouteHash
} from './domain/syncConfig'
import type {
  AppMode,
  CoachDocumentOrigin,
  LocalSyncMeta,
  SyncConfig,
  SyncIndicator,
  TeamDocument,
  TeamSummary,
  TrainingSession
} from './domain/types'
import {
  discoverRemoteTeamDocuments,
  synchronizeDocument,
  testNextcloudCredentials
} from './services/webdav'
import {
  clearSessionPasswords,
  forgetSessionPassword,
  loadSessionPassword,
  rememberSessionPassword,
  type CredentialOwner
} from './services/sessionCredentials'
import {
  clearLocalData,
  loadAppMode,
  loadCoachDocumentOrigin,
  loadCoordinatorSyncConfig,
  loadViewerSyncConfig,
  loadDocument,
  loadSyncConfig,
  loadSyncMeta,
  removeLegacyEncryptedCredentials,
  storeAppMode,
  storeCoachOnboardingVersion,
  storeCoachDocumentOrigin,
  storeCoordinatorSyncConfig,
  storeViewerSyncConfig,
  storeDocument,
  storeSyncConfig,
  storeSyncMeta
} from './storage/database'

type CoachView = 'home' | 'register' | 'team' | 'settings'
type SyncOutcome =
  | { status: 'synced' | 'skipped' | 'cancelled' }
  | { status: 'error'; message: string }

const navigation = [
  { id: 'home' as const, path: '/allenatore', label: 'Panoramica', icon: ClipboardCheck },
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
  const routeWithQuery = window.location.hash.startsWith('#/')
    ? window.location.hash.slice(1)
    : '/'
  return normalizePath(routeWithQuery.split('?')[0])
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

function Welcome({
  onSelect,
  onReset,
  sharedAccess = false
}: {
  onSelect: (mode: AppMode) => void
  onReset: () => Promise<void>
  sharedAccess?: boolean
}) {
  return (
    <main className="welcome-page">
      <div className="welcome-toolbar">
        <ThemeSelector />
        <ResetAppDataButton
          onReset={onReset}
          className="mode-control reset-control welcome-reset"
        />
      </div>
      <div className="welcome-content">
        <div className="brand-mark welcome-mark">
          <Check size={34} strokeWidth={3} />
        </div>
        <h1>{sharedAccess ? 'Apri i registri condivisi' : 'Registro presenze'}</h1>
        <p>
          {sharedAccess
            ? 'Il server Nextcloud è già configurato. Indica come userai questo dispositivo.'
            : 'Seleziona la modalità per questo dispositivo.'}
        </p>
        <div className="mode-grid">
          <button className="mode-card" onClick={() => onSelect('coach')}>
            <ClipboardCheck size={26} />
            <strong>Allenatore</strong>
            <span>Inserimento e modifica delle presenze.</span>
          </button>
          {!sharedAccess && (
            <button className="mode-card" onClick={() => onSelect('coordinator')}>
              <ShieldCheck size={26} />
              <strong>Coordinatore</strong>
              <span>Crea squadre e consulta tutti i registri autorizzati.</span>
            </button>
          )}
          <button className="mode-card" onClick={() => onSelect('viewer')}>
            <Eye size={26} />
            <strong>Giocatrice</strong>
            <span>Consulta in sola lettura uno o più registri condivisi.</span>
          </button>
        </div>
      </div>
    </main>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [loadingError, setLoadingError] = useState(false)
  const [sharedAccessBootstrap, setSharedAccessBootstrap] = useState(false)
  const [pathname, setPathname] = useState(currentRoutePath)
  const [document, setDocument] = useState<TeamDocument>()
  const [syncConfig, setSyncConfig] = useState<SyncConfig>()
  const [coordinatorSyncConfig, setCoordinatorSyncConfig] = useState<SyncConfig>()
  const [viewerSyncConfig, setViewerSyncConfig] = useState<SyncConfig>()
  const [syncMeta, setSyncMeta] = useState<LocalSyncMeta>({ dirty: false })
  const [syncIndicator, setSyncIndicator] = useState<SyncIndicator>('local')
  const [coachDocumentOrigin, setCoachDocumentOrigin] = useState<CoachDocumentOrigin>()
  const [coachTeams, setCoachTeams] = useState<TeamSummary[]>([])
  const [coachTeamsLoading, setCoachTeamsLoading] = useState(false)
  const [coachTeamsError, setCoachTeamsError] = useState<string>()
  const [passwordPrompt, setPasswordPrompt] = useState<{
    owner: CredentialOwner
    config: SyncConfig
  }>()
  const documentRef = useRef<TeamDocument | undefined>(undefined)
  const configRef = useRef<SyncConfig | undefined>(undefined)
  const metaRef = useRef<LocalSyncMeta>({ dirty: false })
  const coachDocumentOriginRef = useRef<CoachDocumentOrigin | undefined>(undefined)
  const syncPromiseRef = useRef<Promise<SyncOutcome> | undefined>(undefined)
  const resettingRef = useRef(false)
  const passwordRequestRef = useRef<{
    owner: CredentialOwner
    promise: Promise<string | undefined>
    resolve: (password: string | undefined) => void
  } | undefined>(undefined)

  const navigate = useCallback(
    (path: string, options?: { replace?: boolean; from?: string }) => {
      const queryIndex = path.indexOf('?')
      const nextPath = normalizePath(queryIndex >= 0 ? path.slice(0, queryIndex) : path)
      const route = queryIndex >= 0 ? `${nextPath}${path.slice(queryIndex)}` : nextPath
      const state = options?.from ? { from: options.from } : null
      if (options?.replace) {
        window.history.replaceState(state, '', routeHref(route))
      } else {
        window.history.pushState(state, '', routeHref(route))
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
    (
      owner: CredentialOwner,
      config: SyncConfig
    ): Promise<string | undefined> => {
      const currentRequest = passwordRequestRef.current
      if (currentRequest) return currentRequest.promise

      const sessionPassword = loadSessionPassword(owner, config)
      if (sessionPassword) return Promise.resolve(sessionPassword)

      let resolveRequest!: (password: string | undefined) => void
      const promise = new Promise<string | undefined>((resolve) => {
        resolveRequest = resolve
      })
      passwordRequestRef.current = {
        owner,
        promise,
        resolve: resolveRequest
      }
      setPasswordPrompt({ owner, config: { ...config, appPassword: '' } })
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

  const applyCoachDocumentOrigin = (next: CoachDocumentOrigin | undefined) => {
    coachDocumentOriginRef.current = next
    setCoachDocumentOrigin(next)
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
            const password = await requestPassword('coach', readyConfig)
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
          rememberSessionPassword('coach', readyConfig)
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
            message.includes('account non può leggere') ||
            message.includes('Password applicativa non valida')
          ) {
            forgetSessionPassword('coach')
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
      loadViewerSyncConfig(),
      loadSyncMeta(),
      loadCoachDocumentOrigin(),
      removeLegacyEncryptedCredentials()
    ]).then(
      ([
        storedMode,
        storedDocument,
        storedConfig,
        storedCoordinatorConfig,
        storedViewerConfig,
        storedMeta,
        storedDocumentOrigin
      ]) => {
        if (!active) return
        applyDocument(storedDocument)
        applyConfig(storedConfig)
        const resolvedDocumentOrigin =
          storedDocumentOrigin ?? (storedDocument ? 'self-managed' : undefined)
        applyCoachDocumentOrigin(resolvedDocumentOrigin)
        setCoordinatorSyncConfig(storedCoordinatorConfig)
        const legacyReadOnlyConfig =
          storedMode === 'coordinator' &&
          !storedViewerConfig &&
          storedCoordinatorConfig &&
          storedCoordinatorConfig.remoteFolder
            .split('/')
            .filter(Boolean)
            .at(-1)?.toLocaleLowerCase() !== 'attendance-tracker'
            ? storedCoordinatorConfig
            : undefined
        const resolvedViewerConfig = storedViewerConfig ?? legacyReadOnlyConfig
        const resolvedMode = legacyReadOnlyConfig ? 'viewer' : storedMode
        setViewerSyncConfig(resolvedViewerConfig)
        if (legacyReadOnlyConfig) {
          void Promise.all([
            storeViewerSyncConfig(legacyReadOnlyConfig),
            storeAppMode('viewer')
          ])
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
        const sharedNextcloudLink = nextcloudLinkFromRouteHash(window.location.hash)
        const requestedMode = nextcloudModeFromRouteHash(window.location.hash)
        const hasStoredSetup = hasStoredSetupForMode(resolvedMode, {
          coachDocument: storedDocument,
          coachConfig: storedConfig,
          coordinatorConfig: storedCoordinatorConfig,
          viewerConfig: resolvedViewerConfig
        })
        if (sharedNextcloudLink && hasStoredSetup && resolvedMode) {
          const initialPath = resolvedMode === 'coach'
            ? '/allenatore'
            : resolvedMode === 'viewer'
              ? '/consultazione'
              : '/coordinatore'
          window.history.replaceState(null, '', routeHref(initialPath))
          setPathname(initialPath)
        } else if (sharedNextcloudLink && !hasStoredSetup) {
          if (requestedMode) {
            setSharedAccessBootstrap(false)
            if (requestedMode !== storedMode) void storeAppMode(requestedMode)
          } else {
            setSharedAccessBootstrap(true)
          }
        } else if (currentRoutePath() === '/' && resolvedMode) {
          const initialPath = resolvedMode === 'coach'
            ? '/allenatore'
            : resolvedMode === 'viewer'
              ? '/consultazione'
              : '/coordinatore'
          window.history.replaceState(null, '', routeHref(initialPath))
          setPathname(initialPath)
        }
        setLoading(false)
        const shouldSyncCoach =
          isCoachSyncRoute(currentRoutePath()) ||
          (currentRoutePath() === '/' && resolvedMode === 'coach')
        if (
          storedDocument &&
          storedConfig &&
          navigator.onLine &&
          shouldSyncCoach &&
          allowsCoachBackgroundSync(resolvedDocumentOrigin)
        ) {
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
      if (
        allowsCoachBackgroundSync(coachDocumentOriginRef.current) &&
        isCoachSyncRoute(currentRoutePath())
      ) {
        void performSync()
      }
    }
    const syncWhenVisible = () => {
      if (
        window.document.visibilityState === 'visible' &&
        allowsCoachBackgroundSync(coachDocumentOriginRef.current) &&
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
    navigate(
      nextMode === 'coach'
        ? '/allenatore'
        : nextMode === 'viewer'
          ? '/consultazione'
          : '/coordinatore'
    )
  }

  const chooseSharedAccessMode = async (nextMode: AppMode) => {
    if (nextMode === 'coordinator') return
    const initialNextcloudLink = nextcloudLinkFromRouteHash(window.location.hash)
    await storeAppMode(nextMode)
    setSharedAccessBootstrap(false)
    const query = new URLSearchParams()
    if (initialNextcloudLink) query.set('nextcloud', initialNextcloudLink)
    const destination = nextMode === 'coach'
      ? '/allenatore/squadra-condivisa'
      : '/consultazione'
    navigate(query.size ? `${destination}?${query.toString()}` : destination)
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
    await storeCoachDocumentOrigin('self-managed')
    applyCoachDocumentOrigin('self-managed')
    navigate(reopening ? '/allenatore/impostazioni' : '/allenatore', {
      replace: true
    })
  }

  const skipCoachOnboarding = async () => {
    await storeCoachOnboardingVersion(COACH_ONBOARDING_VERSION)
    navigate(document ? '/allenatore/impostazioni' : '/allenatore', {
      replace: true
    })
  }

  const resetAllLocalData = async () => {
    resettingRef.current = true
    clearSessionPasswords()
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
      storeCoachOnboardingVersion(COACH_ONBOARDING_VERSION),
      storeCoachDocumentOrigin('self-managed')
    ])
    applyDocument(restoredDocument)
    applyMeta(restoredMeta)
    applyCoachDocumentOrigin('self-managed')
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
    if (coachDocumentOriginRef.current === 'coordinator-managed') return
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

  const persistViewerConnectionDetails = async (config: SyncConfig) => {
    await storeViewerSyncConfig(config)
    setViewerSyncConfig({ ...config, appPassword: '' })
  }

  const openSharedCoachTeam = async (
    team: { document: TeamDocument },
    config: SyncConfig
  ) => {
    const currentDocument = documentRef.current
    if (
      currentDocument &&
      (currentDocument.teamId !== team.document.teamId ||
        currentDocument.season.startYear !== team.document.season.startYear) &&
      metaRef.current.dirty
    ) {
      const outcome = await performSync(
        currentDocument,
        metaRef.current,
        configRef.current
      )
      if (outcome.status !== 'synced' && metaRef.current.dirty) {
        throw new Error(
          'La squadra attuale contiene modifiche non sincronizzate. Sincronizzale prima di cambiare squadra.'
        )
      }
    }
    const result = await synchronizeDocument(team.document, { dirty: false }, config)
    rememberSessionPassword('coach', config)
    await Promise.all([
      storeDocument(result.document),
      storeSyncConfig(config),
      storeSyncMeta(result.meta),
      storeCoachOnboardingVersion(COACH_ONBOARDING_VERSION),
      storeCoachDocumentOrigin('coordinator-managed')
    ])
    applyDocument(result.document)
    applyConfig(config)
    applyMeta(result.meta)
    applyCoachDocumentOrigin('coordinator-managed')
    setSyncIndicator('synced')
    navigate('/allenatore', { replace: true })
  }

  const loadCoachTeamChoices = async () => {
    const currentConfig = configRef.current
    if (!currentConfig) {
      setCoachTeamsError('Collegamento Nextcloud non configurato.')
      return
    }
    setCoachTeamsLoading(true)
    setCoachTeamsError(undefined)
    try {
      let readyConfig = currentConfig
      if (!readyConfig.appPassword) {
        const password = await requestPassword('coach', readyConfig)
        if (!password) return
        readyConfig = { ...readyConfig, appPassword: password }
        applyConfig(readyConfig)
      }
      const found = await discoverRemoteTeamDocuments({
        ...readyConfig,
        remoteFolder: ''
      })
      setCoachTeams(found)
    } catch (error) {
      setCoachTeamsError(
        error instanceof Error ? error.message : 'Impossibile caricare le squadre.'
      )
    } finally {
      setCoachTeamsLoading(false)
    }
  }

  const selectCoachTeam = async (team: TeamSummary) => {
    const currentConfig = configRef.current
    if (!currentConfig) throw new Error('Collegamento Nextcloud non configurato.')
    await openSharedCoachTeam(team, {
      ...currentConfig,
      remoteFolder: team.remoteFolder ?? ''
    })
  }

  const renderPage = (page: ReactNode) => (
    <>
      {page}
      {passwordPrompt && (
        <PasswordPrompt
          key={`${passwordPrompt.owner}-${passwordPrompt.config.username}`}
          username={passwordPrompt.config.username}
          onSubmit={async (password) => {
            const authenticatedConfig = {
              ...passwordPrompt.config,
              appPassword: password
            }
            await testNextcloudCredentials(authenticatedConfig)
            rememberSessionPassword(passwordPrompt.owner, authenticatedConfig)
            finishPasswordRequest(password)
          }}
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

  if (pathname === '/') {
    return renderPage(
      <Welcome onSelect={chooseMode} onReset={resetAllLocalData} />
    )
  }

  const initialNextcloudLink = nextcloudLinkFromRouteHash(window.location.hash)
  const initialNextcloudMode = nextcloudModeFromRouteHash(window.location.hash)

  if (sharedAccessBootstrap && initialNextcloudLink) {
    return renderPage(
      <Welcome
        sharedAccess
        onSelect={chooseSharedAccessMode}
        onReset={resetAllLocalData}
      />
    )
  }

  const coordinatorTeamMatch = pathname.match(/^\/coordinatore\/squadra\/([^/]+)$/)
  const viewerTeamMatch = pathname.match(/^\/consultazione\/squadra\/([^/]+)$/)
  const creatingCoordinatorTeam = pathname === '/coordinatore/nuova-squadra'
  const managingCoordinatorTeams = pathname === '/coordinatore/gestione-squadre'
  const legacyViewerLink =
    pathname === '/coordinatore' &&
    Boolean(initialNextcloudLink) &&
    !initialNextcloudMode
  const dashboardMode =
    pathname.startsWith('/consultazione') || legacyViewerLink
      ? 'viewer'
      : 'coordinator'
  if (
    pathname === '/coordinatore' ||
    coordinatorTeamMatch ||
    creatingCoordinatorTeam ||
    managingCoordinatorTeams ||
    pathname === '/consultazione' ||
    viewerTeamMatch
  ) {
    const viewerMode = dashboardMode === 'viewer'
    return renderPage(
      <CoordinatorDashboard
        key={dashboardMode}
        accessMode={dashboardMode}
        onChooseMode={() => {
          if (
            initialNextcloudLink &&
            !initialNextcloudMode &&
            viewerMode &&
            !viewerSyncConfig
          ) {
            setSharedAccessBootstrap(true)
            navigate(
              `/consultazione?${new URLSearchParams({
                nextcloud: initialNextcloudLink
              }).toString()}`,
              { replace: true }
            )
            return
          }
          navigate('/')
        }}
        initialNextcloudLink={initialNextcloudLink}
        selectedTeamId={
          coordinatorTeamMatch
            ? decodeURIComponent(coordinatorTeamMatch[1])
            : viewerTeamMatch
              ? decodeURIComponent(viewerTeamMatch[1])
              : undefined
        }
        creatingTeam={creatingCoordinatorTeam}
        managingTeams={managingCoordinatorTeams}
        onNavigate={navigate}
        config={viewerMode ? viewerSyncConfig : coordinatorSyncConfig}
        onSaveConfig={async (config) => {
          if (viewerMode) {
            await storeViewerSyncConfig(config)
            setViewerSyncConfig(config)
          } else {
            await storeCoordinatorSyncConfig(config)
            setCoordinatorSyncConfig(config)
          }
        }}
        onPersistConnectionDetails={
          viewerMode
            ? persistViewerConnectionDetails
            : persistCoordinatorConnectionDetails
        }
        onRequestPassword={(config) =>
          requestPassword(viewerMode ? 'viewer' : 'coordinator', config)
        }
        onAuthenticated={(config) =>
          rememberSessionPassword(viewerMode ? 'viewer' : 'coordinator', config)
        }
        onForgetPassword={() =>
          forgetSessionPassword(viewerMode ? 'viewer' : 'coordinator')
        }
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

  if (pathname === '/allenatore/squadra-condivisa') {
    return renderPage(
      <SharedTeamSetup
        initialConfig={syncConfig}
        initialNextcloudLink={initialNextcloudLink}
        onOpen={openSharedCoachTeam}
        onBack={() => {
          if (initialNextcloudLink && !initialNextcloudMode && !document) {
            setSharedAccessBootstrap(true)
            navigate(
              `/consultazione?${new URLSearchParams({
                nextcloud: initialNextcloudLink
              }).toString()}`,
              { replace: true }
            )
            return
          }
          navigate(document ? '/allenatore/impostazioni' : '/allenatore', {
            replace: true
          })
        }}
      />
    )
  }

  const showCoachOnboarding = pathname === '/allenatore/configurazione-guidata'

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
      <CoachStart
        onCreateTeam={() => navigate('/allenatore/configurazione-guidata')}
        onOpenSharedTeam={() => navigate('/allenatore/squadra-condivisa')}
        onChooseMode={() => navigate('/')}
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
        <AppBrand subtitle={document.organizationName} />
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
        {coachDocumentOrigin === 'coordinator-managed' ? (
          <CoachTeamSwitcher
            currentDocument={document}
            teams={coachTeams}
            loading={coachTeamsLoading}
            error={coachTeamsError}
            onLoad={loadCoachTeamChoices}
            onSelect={selectCoachTeam}
          />
        ) : (
          <div className="sidebar-team">
            <span>Squadra attiva</span>
            <strong>{document.teamName}</strong>
            <small>
              {document.season.startYear}–{document.season.endYear}
            </small>
          </div>
        )}
      </aside>

      <div className="main-column">
        <header className="topbar">
          {coachDocumentOrigin === 'coordinator-managed' ? (
            <button
              className="topbar-team topbar-team-switch"
              type="button"
              onClick={() => navigate('/allenatore/squadra-condivisa')}
              aria-label="Cambia squadra"
            >
              <span>{document.organizationName}</span>
              <strong>{document.teamName}</strong>
              <ChevronsUpDown size={16} />
            </button>
          ) : (
            <div className="topbar-team">
              <span>{document.organizationName}</span>
              <strong>{document.teamName}</strong>
            </div>
          )}
          <div className="topbar-actions">
            <AppModeControls
              onChooseMode={() => navigate('/')}
              onReset={resetAllLocalData}
            />
            <button
              className={`sync-chip ${syncIndicator}`}
              onClick={() => navigate('/allenatore/impostazioni')}
              title={syncMeta.lastError}
            >
              <SyncIcon className={syncIndicator === 'syncing' ? 'spin' : ''} size={15} />
              {syncLabel(syncIndicator)}
            </button>
          </div>
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
          {view === 'team' && (
            <TeamSettings
              document={document}
              onUpdate={commitDocument}
              managedByCoordinator={coachDocumentOrigin === 'coordinator-managed'}
            />
          )}
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
              managedByCoordinator={coachDocumentOrigin === 'coordinator-managed'}
              onChooseTeam={() => navigate('/allenatore/squadra-condivisa')}
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
