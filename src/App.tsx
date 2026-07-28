import { useCallback, useEffect, useRef, useState } from 'react'
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
import { CoordinatorDashboard } from './components/CoordinatorDashboard'
import { Dashboard } from './components/Dashboard'
import { MonthlyRegister } from './components/MonthlyRegister'
import { SetupCoach } from './components/SetupCoach'
import { SyncSettings } from './components/SyncSettings'
import { TeamSettings } from './components/TeamSettings'
import { deleteSession, saveSession } from './domain/document'
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
  loadAppMode,
  loadDocument,
  loadSyncConfig,
  loadSyncMeta,
  storeAppMode,
  storeDocument,
  storeSyncConfig,
  storeSyncMeta
} from './storage/database'

type CoachView = 'home' | 'register' | 'team' | 'settings'

const navigation = [
  { id: 'home' as const, label: 'Oggi', icon: ClipboardCheck },
  { id: 'register' as const, label: 'Registro', icon: CalendarRange },
  { id: 'team' as const, label: 'Squadra', icon: Users },
  { id: 'settings' as const, label: 'Impostazioni', icon: Settings }
]

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
        <div className="eyebrow">Registro Presenze</div>
        <h1>Un registro semplice.<br />Niente di più.</h1>
        <p>
          Scegli come vuoi usare questa installazione. Potrai cambiare modalità in qualsiasi
          momento.
        </p>
        <div className="mode-grid">
          <button className="mode-card" onClick={() => onSelect('coach')}>
            <ClipboardCheck size={26} />
            <strong>Sono un allenatore</strong>
            <span>Registro le presenze della mia squadra.</span>
          </button>
          <button className="mode-card" onClick={() => onSelect('coordinator')}>
            <ShieldCheck size={26} />
            <strong>Sono il coordinatore</strong>
            <span>Leggo i file di tutte le squadre dal PC.</span>
          </button>
        </div>
      </div>
    </main>
  )
}

export default function App() {
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<AppMode>()
  const [document, setDocument] = useState<TeamDocument>()
  const [syncConfig, setSyncConfig] = useState<SyncConfig>()
  const [syncMeta, setSyncMeta] = useState<LocalSyncMeta>({ dirty: false })
  const [syncIndicator, setSyncIndicator] = useState<SyncIndicator>('local')
  const [view, setView] = useState<CoachView>('home')
  const [editingSession, setEditingSession] = useState<TrainingSession | 'new'>()
  const documentRef = useRef<TeamDocument | undefined>(undefined)
  const configRef = useRef<SyncConfig | undefined>(undefined)
  const metaRef = useRef<LocalSyncMeta>({ dirty: false })
  const syncingRef = useRef(false)

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
    async (
      currentDocument = documentRef.current,
      currentMeta = metaRef.current,
      currentConfig = configRef.current
    ) => {
      if (!currentDocument || !currentConfig || syncingRef.current) return
      if (!navigator.onLine) {
        setSyncIndicator(currentMeta.dirty ? 'pending' : 'local')
        return
      }

      syncingRef.current = true
      setSyncIndicator('syncing')
      try {
        const result = await synchronizeDocument(currentDocument, currentMeta, currentConfig)
        await Promise.all([storeDocument(result.document), storeSyncMeta(result.meta)])
        applyDocument(result.document)
        applyMeta(result.meta)
        setSyncIndicator('synced')
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sincronizzazione non riuscita.'
        const nextMeta = { ...currentMeta, dirty: true, lastError: message }
        await storeSyncMeta(nextMeta)
        applyMeta(nextMeta)
        setSyncIndicator(message.includes('conflitto') ? 'conflict' : 'error')
      } finally {
        syncingRef.current = false
      }
    },
    []
  )

  useEffect(() => {
    let active = true
    Promise.all([loadAppMode(), loadDocument(), loadSyncConfig(), loadSyncMeta()]).then(
      ([storedMode, storedDocument, storedConfig, storedMeta]) => {
        if (!active) return
        setMode(storedMode)
        applyDocument(storedDocument)
        applyConfig(storedConfig)
        applyMeta(storedMeta)
        setSyncIndicator(storedMeta.dirty ? 'pending' : storedMeta.lastSyncedAt ? 'synced' : 'local')
        setLoading(false)
        if (storedDocument && storedConfig && navigator.onLine) {
          void performSync(storedDocument, storedMeta, storedConfig)
        }
      }
    )
    return () => {
      active = false
    }
  }, [performSync])

  useEffect(() => {
    const syncWhenAvailable = () => void performSync()
    const syncWhenVisible = () => {
      if (window.document.visibilityState === 'visible') void performSync()
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
    setMode(nextMode)
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
    await commitDocument(next, false)
    setView('home')
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
      void performSync(documentRef.current, metaRef.current, config)
    }
  }

  if (loading) {
    return (
      <div className="loading-page">
        <LoaderCircle className="spin" size={32} />
        <span>Apro il registro…</span>
      </div>
    )
  }

  if (!mode) return <Welcome onSelect={chooseMode} />

  if (mode === 'coordinator') {
    return <CoordinatorDashboard onCoachMode={() => void chooseMode('coach')} />
  }

  if (!document) {
    return (
      <SetupCoach
        onComplete={completeSetup}
        onSwitchMode={() => void chooseMode('coordinator')}
      />
    )
  }

  if (editingSession) {
    return (
      <AttendanceEditor
        document={document}
        initialSession={editingSession === 'new' ? undefined : editingSession}
        onSave={handleSessionSave}
        onDelete={handleSessionDelete}
        onClose={() => setEditingSession(undefined)}
      />
    )
  }

  const SyncIcon =
    syncIndicator === 'syncing' ? LoaderCircle : syncIndicator === 'pending' ? CloudOff : Cloud

  return (
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
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => setView(item.id)}
            >
              <item.icon size={19} />
              {item.label}
            </button>
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
            onClick={() => setView('settings')}
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
              onNewSession={() => setEditingSession('new')}
              onEditSession={setEditingSession}
            />
          )}
          {view === 'register' && (
            <MonthlyRegister
              document={document}
              onEditSession={setEditingSession}
              onNewSession={() => setEditingSession('new')}
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
              onSync={() => performSync()}
              onCoordinatorMode={() => void chooseMode('coordinator')}
            />
          )}
        </main>

        <nav className="bottom-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => setView(item.id)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
