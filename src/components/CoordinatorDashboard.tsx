import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  ArrowLeft,
  ChevronRight,
  Cloud,
  FolderOpen,
  Link2,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Users
} from 'lucide-react'
import { totalsForDocument } from '../domain/document'
import type {
  AppMode,
  CoordinatorTeamCache,
  SyncConfig,
  TeamDocument,
  TeamSummary
} from '../domain/types'
import {
  parseSelectedFiles,
  pickAndScanDirectory,
  scanDirectoryHandle
} from '../services/localFiles'
import {
  createRemoteTeamDocument,
  backupRemoteTeamDocuments,
  deleteRemoteTeamDocument,
  discoverAttendanceTrackerFolders,
  discoverRemoteTeamDocuments,
  updateRemoteTeamDocument,
  verifyRemoteFolderWritable
} from '../services/webdav'
import {
  loadCoordinatorDirectoryHandle,
  loadCoordinatorTeamCache,
  storeCoordinatorTeamCache,
  storeCoordinatorDirectoryHandle
} from '../storage/database'
import { percentageScaleColor } from '../domain/percentageColorScale'
import {
  coordinatorDetailsFromNextcloudLink,
  detailsFromNextcloudLink,
  nextcloudQuickAccessUrl
} from '../domain/syncConfig'
import { MonthlyRegister } from './MonthlyRegister'
import { AppBrand } from './AppBrand'
import { AppModeControls } from './AppModeControls'
import { CoordinatorTeamCreator } from './CoordinatorTeamCreator'
import { NextcloudSharingPanel } from './NextcloudSharingPanel'
import { CoordinatorTeamManagement } from './CoordinatorTeamManagement'
import { NextcloudQuickAccessButtons } from './NextcloudQuickAccessButton'
import { TeamSettings } from './TeamSettings'

interface CoordinatorDashboardProps {
  accessMode: 'coordinator' | 'viewer'
  onChooseMode: () => void
  initialNextcloudLink?: string
  selectedTeamId?: string
  creatingTeam?: boolean
  managingTeams?: boolean
  onNavigate: (path: string) => void
  config?: SyncConfig
  onSaveConfig: (config: SyncConfig) => Promise<void>
  onPersistConnectionDetails: (config: SyncConfig) => Promise<void>
  onRequestPassword: (config: SyncConfig) => Promise<string | undefined>
  onAuthenticated: (config: SyncConfig) => void
  onForgetPassword: () => void
  onResetAllData: () => Promise<void>
}

const defaultConfig: SyncConfig = {
  baseUrl: '',
  username: '',
  appPassword: '',
  remoteFolder: 'attendance-tracker'
}

function cachedDataMessage(cache: CoordinatorTeamCache): string {
  const loadedAt = new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(new Date(cache.loadedAt))
  return `${cache.teams.length} squadre ripristinate da ${cache.sourceLabel} · aggiornate ${loadedAt}.`
}

function connectionKey(config: SyncConfig): string {
  return [
    config.baseUrl.trim().replace(/\/+$/, ''),
    config.username.trim(),
    config.remoteFolder.trim().replace(/^\/+|\/+$/g, '')
  ].join('|')
}

function cacheMatchesConfig(
  cache: CoordinatorTeamCache,
  config: SyncConfig | undefined,
  accessMode: 'coordinator' | 'viewer'
): boolean {
  if ((cache.owner ?? 'coordinator') !== accessMode) return false
  if (cache.source !== 'nextcloud') return true
  return Boolean(config && cache.connectionKey === connectionKey(config))
}

export function CoordinatorDashboard({
  accessMode,
  onChooseMode,
  initialNextcloudLink,
  selectedTeamId,
  creatingTeam,
  managingTeams,
  onNavigate,
  config,
  onSaveConfig,
  onPersistConnectionDetails,
  onRequestPassword,
  onAuthenticated,
  onForgetPassword,
  onResetAllData
}: CoordinatorDashboardProps) {
  const isViewer = accessMode === 'viewer'
  const basePath = isViewer ? '/consultazione' : '/coordinatore'
  const initialLink = initialNextcloudLink ?? config?.folderLink ?? ''
  const initialConfig = (() => {
    const current = config ?? {
      ...defaultConfig,
      remoteFolder: isViewer ? '' : defaultConfig.remoteFolder
    }
    if (!initialNextcloudLink) return current
    try {
      return {
        ...current,
        ...detailsFromNextcloudLink(initialNextcloudLink),
        appPassword: '',
        folderLink: initialNextcloudLink
      }
    } catch {
      return { ...current, appPassword: '', folderLink: initialNextcloudLink }
    }
  })()
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [cloudConfigOpen, setCloudConfigOpen] = useState(
    Boolean(initialNextcloudLink) || !config
  )
  const [draft, setDraft] = useState<SyncConfig>(initialConfig)
  const [folderLink, setFolderLink] = useState(initialLink)
  const [folderCandidates, setFolderCandidates] = useState<string[]>([])
  const [pendingConnection, setPendingConnection] = useState<SyncConfig>()
  const [rememberedHandle, setRememberedHandle] = useState<FileSystemDirectoryHandle>()
  const inputRef = useRef<HTMLInputElement>(null)
  const loadedOnce = useRef(false)
  const freshTeamsLoaded = useRef(false)
  const wasManagingTeams = useRef(false)

  const quickAccessLinks: Partial<Record<AppMode, string>> = (() => {
    const link = folderLink.trim() || draft.baseUrl.trim()
    if (!link) return {}
    try {
      const nextcloudBaseUrl = detailsFromNextcloudLink(link).baseUrl
      const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
      return {
        viewer: nextcloudQuickAccessUrl(appBaseUrl, nextcloudBaseUrl, 'viewer'),
        coach: nextcloudQuickAccessUrl(appBaseUrl, nextcloudBaseUrl, 'coach'),
        coordinator: nextcloudQuickAccessUrl(appBaseUrl, nextcloudBaseUrl, 'coordinator')
      }
    } catch {
      return {}
    }
  })()

  const quickAccessCopied = (mode: AppMode) => {
    const recipient = mode === 'coach'
      ? 'all’allenatore'
      : mode === 'viewer'
        ? 'alla giocatrice'
        : 'al coordinatore'
    setMessage(`Link rapido copiato. Puoi inviarlo ${recipient}.`)
  }

  const rememberTeams = async (
    found: TeamSummary[],
    source: CoordinatorTeamCache['source'],
    sourceLabel: string,
    connection?: SyncConfig
  ) => {
    freshTeamsLoaded.current = true
    setTeams(found)
    await storeCoordinatorTeamCache({
      teams: found,
      loadedAt: new Date().toISOString(),
      source,
      sourceLabel,
      owner: accessMode,
      ...(connection ? { connectionKey: connectionKey(connection) } : {})
    })
  }

  const updateUsername = (username: string) => {
    if (username !== draft.username) {
      setTeams([])
      setMessage('Account modificato: carica i registri autorizzati per il nuovo utente.')
    }
    const next = { ...draft, username }
    setDraft(next)
    void onPersistConnectionDetails({ ...next, appPassword: '' })
  }

  const connectionFromNextcloudLink = (connection: SyncConfig): SyncConfig => {
    const normalizedLink = folderLink.trim()
    return {
      ...connection,
      ...detailsFromNextcloudLink(normalizedLink),
      folderLink: normalizedLink
    }
  }

  const verifyAndLoadConnection = async (connection: SyncConfig) => {
    setDraft(connection)
    await verifyRemoteFolderWritable(connection)
    setFolderCandidates([])
    setPendingConnection(undefined)
    loadedOnce.current = true
    await onSaveConfig(connection)
    await loadCloud(connection, true, true)
  }

  const loadCloud = async (
    connection = draft,
    openSingle = true,
    writableVerified = false
  ) => {
    setLoading(true)
    setMessage('')
    try {
      let readyConnection = connection
      if (!readyConnection.appPassword) {
        const password = await onRequestPassword(readyConnection)
        if (!password) {
          setMessage('Caricamento da Nextcloud non eseguito.')
          return
        }
        readyConnection = { ...readyConnection, appPassword: password }
        setDraft(readyConnection)
        await onSaveConfig(readyConnection)
      }
      const found = await discoverRemoteTeamDocuments(readyConnection)
      onAuthenticated(readyConnection)
      await rememberTeams(found, 'nextcloud', 'Nextcloud', readyConnection)
      const loadMessage = found.length === 1
          ? `${found[0].document.teamName} caricata da Nextcloud.`
          : found.length > 1
            ? `${found.length} squadre caricate da Nextcloud.`
            : readyConnection.remoteFolder
              ? `Nessun file .attendance.json trovato in ${readyConnection.remoteFolder}.`
              : 'Nessun registro .attendance.json accessibile con questo account.'
      setMessage(
        writableVerified
          ? `Cartella ${readyConnection.remoteFolder} pronta e scrivibile. ${loadMessage}`
          : loadMessage
      )
      if (found.length === 1 && openSingle) {
        onNavigate(
          `${basePath}/squadra/${encodeURIComponent(found[0].document.teamId)}`
        )
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ''
      if (
        errorMessage.includes('Credenziali non valide') ||
        errorMessage.includes('Password applicativa non valida')
      ) {
        onForgetPassword()
        const passwordlessConnection = { ...connection, appPassword: '' }
        setDraft(passwordlessConnection)
        await onSaveConfig(passwordlessConnection)
      }
      setMessage(error instanceof Error ? error.message : 'Nextcloud non è raggiungibile.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    loadCoordinatorTeamCache().then(async (cache) => {
      if (!active || freshTeamsLoaded.current) return
      if (cache && cacheMatchesConfig(cache, config, accessMode)) {
        setTeams(cache.teams)
        setMessage(cachedDataMessage(cache))
        return
      }
      if (import.meta.env.DEV && import.meta.env.VITE_DEV_DEMO_DATA !== 'false') {
        const { developmentTeamSummaries } = await import('../dev/developmentData')
        if (!active || freshTeamsLoaded.current) return
        const demoTeams = developmentTeamSummaries()
        setTeams(demoTeams)
        setMessage(`${demoTeams.length} squadre demo caricate per lo sviluppo.`)
      }
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const openedManagement = Boolean(managingTeams && !wasManagingTeams.current)
    wasManagingTeams.current = Boolean(managingTeams)
    if (!config) return
    if (!initialNextcloudLink) {
      setDraft((current) =>
        current.baseUrl === config.baseUrl &&
        current.username === config.username &&
        current.remoteFolder === config.remoteFolder
          ? { ...current, appPassword: config.appPassword || current.appPassword }
          : config
      )
    }
    if (
      config.baseUrl &&
      config.username &&
      navigator.onLine &&
      !initialNextcloudLink &&
      !creatingTeam &&
      (!loadedOnce.current || openedManagement)
    ) {
      loadedOnce.current = true
      void loadCloud(config, !managingTeams)
    }
  }, [config, creatingTeam, managingTeams])

  useEffect(() => {
    if (isViewer) return
    let active = true
    Promise.all([
      loadCoordinatorDirectoryHandle(),
      loadCoordinatorTeamCache()
    ]).then(async ([handle, cache]) => {
      if (!active || !handle) return
      setRememberedHandle(handle)
      if (cache && cache.source !== 'directory') return
      const permission = await handle.queryPermission({ mode: 'read' })
      if (permission === 'granted' && !config?.appPassword) {
        const found = await scanDirectoryHandle(handle)
        if (!active) return
        await rememberTeams(found, 'directory', `cartella ${handle.name}`)
        setMessage(`${found.length} squadre caricate dalla cartella ${handle.name}.`)
      } else if (!config?.appPassword) {
        setMessage(`Cartella ${handle.name} ricordata: conferma l’accesso per aggiornarla.`)
      }
    })
    return () => {
      active = false
    }
  }, [])

  const connectCloud = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const baseConnection = connectionFromNextcloudLink(draft)
      if (isViewer) {
        setDraft(baseConnection)
        loadedOnce.current = true
        await onSaveConfig(baseConnection)
        await loadCloud(baseConnection)
        return
      }
      const linkedFolder = baseConnection.remoteFolder.split('/').filter(Boolean)
      if (linkedFolder.at(-1)?.toLocaleLowerCase() === 'attendance-tracker') {
        await verifyAndLoadConnection(baseConnection)
        return
      }

      const found = await discoverAttendanceTrackerFolders(baseConnection)
      const expectedConnection = {
        ...baseConnection,
        ...coordinatorDetailsFromNextcloudLink(folderLink.trim())
      }
      if (found.includes(expectedConnection.remoteFolder)) {
        await verifyAndLoadConnection(expectedConnection)
        return
      }
      if (found.length > 1) {
        setPendingConnection(baseConnection)
        setFolderCandidates(found)
        setMessage('Sono state trovate più cartelle attendance-tracker. Scegli quale usare.')
        setLoading(false)
        return
      }

      const connection = found.length === 1
        ? { ...baseConnection, remoteFolder: found[0] }
        : expectedConnection
      await verifyAndLoadConnection(connection)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connessione non riuscita.')
      setLoading(false)
    }
  }

  const chooseRemoteFolder = async (remoteFolder: string) => {
    if (!pendingConnection) return
    setLoading(true)
    setMessage('')
    try {
      await verifyAndLoadConnection({ ...pendingConnection, remoteFolder })
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connessione non riuscita.')
      setLoading(false)
    }
  }

  const createTeam = async (document: TeamDocument, openAfterCreate = true) => {
    let readyConnection = {
      ...draft,
      remoteFolder: draft.remoteFolder || 'attendance-tracker'
    }
    if (!readyConnection.baseUrl || !readyConnection.username) {
      throw new Error('Configura prima il collegamento Nextcloud del coordinatore.')
    }
    if (!readyConnection.appPassword) {
      const password = await onRequestPassword(readyConnection)
      if (!password) throw new Error('Creazione annullata: password non inserita.')
      readyConnection = { ...readyConnection, appPassword: password }
      setDraft(readyConnection)
    }
    await verifyRemoteFolderWritable(readyConnection)
    await onSaveConfig(readyConnection)
    await createRemoteTeamDocument(document, readyConnection)
    await loadCloud(readyConnection, false)
    setMessage(
      `${document.teamName} creata. Ora puoi assegnare gli accessi direttamente dall’app.`
    )
    if (openAfterCreate) {
      onNavigate(`${basePath}/squadra/${encodeURIComponent(document.teamId)}`)
    }
  }

  const deleteTeam = async (team: TeamSummary) => {
    if (team.remoteFolder === undefined) return
    if (!window.confirm(
      `Eliminare il registro di ${team.document.teamName} da Nextcloud? Anche le condivisioni del file verranno rimosse.`
    )) return

    setLoading(true)
    setMessage('')
    try {
      let readyConnection = { ...draft, remoteFolder: team.remoteFolder }
      if (!readyConnection.appPassword) {
        const password = await onRequestPassword(readyConnection)
        if (!password) return
        readyConnection = { ...readyConnection, appPassword: password }
        setDraft(readyConnection)
        await onSaveConfig(readyConnection)
      }
      await deleteRemoteTeamDocument(team.document, readyConnection)
      const remainingTeams = teams.filter(
        (candidate) =>
          candidate.document.teamId !== team.document.teamId ||
          candidate.source !== team.source
      )
      await rememberTeams(remainingTeams, 'nextcloud', 'Nextcloud', readyConnection)
      setMessage(`${team.document.teamName} eliminata da Nextcloud.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Eliminazione non riuscita.')
    } finally {
      setLoading(false)
    }
  }

  const backupTeams = async () => {
    if (teams.length === 0 || teams.some((team) => team.remoteFolder === undefined)) {
      setMessage('Carica prima i registri da Nextcloud per creare il backup.')
      return
    }

    setLoading(true)
    setMessage('')
    try {
      let readyConnection = { ...draft }
      if (!readyConnection.baseUrl || !readyConnection.username) {
        throw new Error('Configura prima il collegamento Nextcloud del coordinatore.')
      }
      if (!readyConnection.appPassword) {
        const password = await onRequestPassword(readyConnection)
        if (!password) return
        readyConnection = { ...readyConnection, appPassword: password }
        setDraft(readyConnection)
        await onSaveConfig(readyConnection)
      }
      const result = await backupRemoteTeamDocuments(teams, readyConnection)
      setMessage(`${result.count} registri salvati in ${result.folder}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Backup non riuscito.')
    } finally {
      setLoading(false)
    }
  }

  const updateTeam = async (team: TeamSummary, document: TeamDocument) => {
    if (team.remoteFolder === undefined) {
      throw new Error('La modifica è disponibile soltanto per registri Nextcloud.')
    }

    setLoading(true)
    setMessage('')
    try {
      let readyConnection = { ...draft, remoteFolder: team.remoteFolder }
      if (!readyConnection.baseUrl || !readyConnection.username) {
        throw new Error('Configura prima il collegamento Nextcloud del coordinatore.')
      }
      if (!readyConnection.appPassword) {
        const password = await onRequestPassword(readyConnection)
        if (!password) return
        readyConnection = { ...readyConnection, appPassword: password }
        setDraft(readyConnection)
        await onSaveConfig(readyConnection)
      }

      const updated = await updateRemoteTeamDocument(document, readyConnection)
      const nextTeams = teams.map((candidate) =>
        candidate.source === team.source && candidate.document.teamId === team.document.teamId
          ? { ...candidate, document: updated }
          : candidate
      )
      await rememberTeams(nextTeams, 'nextcloud', 'Nextcloud', readyConnection)
      setMessage(`${updated.teamName}: modifiche salvate.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Modifica non riuscita.')
      throw error
    } finally {
      setLoading(false)
    }
  }

  const loadFolder = async () => {
    setLoading(true)
    setMessage('')
    try {
      if (rememberedHandle) {
        const permission = await rememberedHandle.requestPermission({ mode: 'read' })
        if (permission !== 'granted') {
          setMessage('Accesso alla cartella locale non consentito.')
          return
        }
        const found = await scanDirectoryHandle(rememberedHandle)
        await rememberTeams(
          found,
          'directory',
          `cartella ${rememberedHandle.name}`
        )
        setMessage(`${found.length} squadre caricate dalla cartella ${rememberedHandle.name}.`)
        return
      }

      const result = await pickAndScanDirectory()
      const found = result.teams
      setRememberedHandle(result.handle)
      await storeCoordinatorDirectoryHandle(result.handle)
      await rememberTeams(found, 'directory', `cartella ${result.handle.name}`)
      setMessage(
        found.length
          ? `${found.length} squadre caricate dalla cartella ${result.handle.name}.`
          : 'Nessun file .attendance.json trovato nella cartella.'
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage(error instanceof Error ? error.message : 'Cartella non leggibile.')
      inputRef.current?.click()
    } finally {
      setLoading(false)
    }
  }

  const loadFallback = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return
    setLoading(true)
    try {
      const found = await parseSelectedFiles(event.target.files)
      await rememberTeams(found, 'files', 'selezione manuale')
      setMessage(
        found.length
          ? `${found.length} squadre caricate dalla cartella locale.`
          : 'Nessun file .attendance.json valido trovato.'
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'File non leggibili.')
    } finally {
      setLoading(false)
    }
  }

  const selectedTeam = teams.find((team) => team.document.teamId === selectedTeamId)
  const totalSessions = teams.reduce((sum, team) => sum + team.document.sessions.length, 0)
  const totalAthletes = teams.reduce(
    (sum, team) => sum + team.document.athletes.filter((athlete) => athlete.active).length,
    0
  )
  return (
    <div className="coordinator-page" aria-busy={loading}>
      {loading && (
        <div className="coordinator-loading" role="status" aria-live="polite">
          <RefreshCw className="spin" size={22} />
          <div>
            <strong>
              {isViewer ? 'Carico i registri condivisi…' : 'Aggiorno i registri…'}
            </strong>
            <span>Nextcloud potrebbe impiegare qualche secondo.</span>
            <div className="loading-progress" aria-hidden="true">
              <i />
            </div>
          </div>
        </div>
      )}
      <header className="coordinator-header">
        <AppBrand subtitle={isViewer ? 'Giocatrice · sola lettura' : 'Coordinatore'} />
        <AppModeControls
          variant="dark"
          onChooseMode={onChooseMode}
          onReset={onResetAllData}
        />
      </header>

      {creatingTeam ? (
        <CoordinatorTeamCreator
          onCreate={createTeam}
          onCancel={() => onNavigate('/coordinatore/gestione-squadre')}
        />
      ) : managingTeams && !isViewer ? (
        <CoordinatorTeamManagement
          teams={teams}
          loading={loading}
          message={message}
          onBack={() => onNavigate(basePath)}
          onCreate={(document) => createTeam(document, false)}
          onDelete={deleteTeam}
          onRefresh={() => void loadCloud(draft, false)}
          onBackup={backupTeams}
          canBackup={teams.length > 0 && teams.every((team) => team.remoteFolder !== undefined)}
          quickAccessLinks={quickAccessLinks}
          onQuickAccessCopied={quickAccessCopied}
          renderTeamControls={(team) => (
            <>
              {team.remoteFolder !== undefined && (
                <NextcloudSharingPanel
                  document={team.document}
                  config={{ ...draft, remoteFolder: team.remoteFolder }}
                  onEnsureConfig={async () => {
                    let readyConnection = {
                      ...draft,
                      remoteFolder: team.remoteFolder ?? draft.remoteFolder
                    }
                    if (!readyConnection.baseUrl || !readyConnection.username) {
                      return undefined
                    }
                    if (!readyConnection.appPassword) {
                      const password = await onRequestPassword(readyConnection)
                      if (!password) return undefined
                      readyConnection = { ...readyConnection, appPassword: password }
                      setDraft(readyConnection)
                      await onSaveConfig(readyConnection)
                    }
                    return readyConnection
                  }}
                />
              )}
              {team.remoteFolder !== undefined && (
                <TeamSettings
                  document={team.document}
                  onUpdate={(updated) => updateTeam(team, updated)}
                />
              )}
              <section className="coordinator-report-shell team-management-report">
                <MonthlyRegister document={team.document} />
              </section>
            </>
          )}
        />
      ) : selectedTeam ? (
        <main className="coordinator-main coordinator-detail">
          <button
            className="button ghost report-back"
            onClick={() =>
              onNavigate(isViewer ? basePath : '/coordinatore/gestione-squadre')
            }
          >
            <ArrowLeft size={17} />
            Torna ai registri
          </button>
          {message && <div className="coordinator-message">{message}</div>}
          {!isViewer && selectedTeam.remoteFolder !== undefined && (
            <NextcloudSharingPanel
              document={selectedTeam.document}
              config={{ ...draft, remoteFolder: selectedTeam.remoteFolder }}
              onEnsureConfig={async () => {
                let readyConnection = {
                  ...draft,
                  remoteFolder: selectedTeam.remoteFolder ?? draft.remoteFolder
                }
                if (!readyConnection.baseUrl || !readyConnection.username) return undefined
                if (!readyConnection.appPassword) {
                  const password = await onRequestPassword(readyConnection)
                  if (!password) return undefined
                  readyConnection = { ...readyConnection, appPassword: password }
                  setDraft(readyConnection)
                  await onSaveConfig(readyConnection)
                }
                return readyConnection
              }}
            />
          )}
          {!isViewer && selectedTeam.remoteFolder !== undefined && (
            <TeamSettings
              document={selectedTeam.document}
              onUpdate={(updated) => updateTeam(selectedTeam, updated)}
            />
          )}
          <section className="coordinator-report-shell">
            <MonthlyRegister document={selectedTeam.document} />
          </section>
        </main>
      ) : (
        <main className="coordinator-main">
          <section className="coordinator-hero">
            <div>
              <h1>{isViewer ? 'I registri condivisi' : 'Registri accessibili'}</h1>
              <p>
                {isViewer
                  ? 'Consulta in sola lettura i file di squadra condivisi con il tuo account Nextcloud.'
                  : 'Crea i registri delle squadre e consulta quelli autorizzati per il tuo account Nextcloud, oppure caricali da una cartella locale.'}
              </p>
            </div>
            <div className="coordinator-load-actions">
              {!isViewer && <button
                className="button light folder-button"
                onClick={() => {
                  if (!draft.baseUrl || !draft.username) {
                    setCloudConfigOpen(true)
                    setMessage('Configura Nextcloud prima di aprire il pannello di controllo.')
                    return
                  }
                  onNavigate('/coordinatore/gestione-squadre')
                }}
                disabled={loading}
              >
                <ShieldCheck size={20} />
                Pannello di controllo
              </button>}
              <button
                className="button light folder-button"
                onClick={() => void loadCloud()}
                disabled={loading || !draft.baseUrl || !draft.username}
              >
                {loading ? <RefreshCw className="spin" size={19} /> : <Cloud size={20} />}
                {teams.length ? 'Aggiorna da Nextcloud' : 'Carica da Nextcloud'}
              </button>
              {!isViewer && (
                <NextcloudQuickAccessButtons
                  links={quickAccessLinks}
                  onCopied={quickAccessCopied}
                  className="coordinator-quick-access-actions"
                  buttonClassName="button dark-secondary folder-button"
                  disabled={loading}
                />
              )}
              {!isViewer && <button className="button dark-secondary" onClick={loadFolder} disabled={loading}>
                <FolderOpen size={19} />
                {rememberedHandle ? rememberedHandle.name : 'Cartella locale'}
              </button>}
            </div>
            <input
              ref={inputRef}
              className="visually-hidden"
              type="file"
              multiple
              onChange={loadFallback}
              {...({
                webkitdirectory: '',
                directory: ''
              } as React.InputHTMLAttributes<HTMLInputElement>)}
            />
          </section>

          <details
            className="coordinator-cloud-config"
            open={cloudConfigOpen}
            onToggle={(event) => setCloudConfigOpen(event.currentTarget.open)}
          >
            <summary>
              {isViewer ? 'Collegamento Nextcloud' : 'Collegamento Nextcloud e link rapido'}
            </summary>
            <form className="form-grid" onSubmit={connectCloud} autoComplete="on">
              <div className="form-grid coordinator-config-grid">
                <label className="field">
                  <span>Link Nextcloud</span>
                  <input
                    type="url"
                    value={folderLink}
                    placeholder="Link del file, della cartella o del server Nextcloud"
                    onChange={(event) => {
                      if (event.target.value !== folderLink) {
                        setTeams([])
                        setFolderCandidates([])
                        setPendingConnection(undefined)
                        setMessage('Link modificato: carica nuovamente i registri autorizzati.')
                      }
                      setFolderLink(event.target.value)
                    }}
                    required
                  />
                  <small>
                    {isViewer ? (
                      <>Incolla l’indirizzo del server o il link ricevuto. L’app cerca soltanto i file <code>*.attendance.json</code> leggibili dal tuo account.</>
                    ) : (
                      <>Incolla l’indirizzo del server oppure il link di una cartella. L’app cerca <code>attendance-tracker</code> anche nelle sottocartelle; se non esiste, la crea nel percorso indicato e verifica i permessi di scrittura.</>
                    )}
                  </small>
                </label>
                <label className="field">
                  <span>Nome utente Nextcloud</span>
                  <input
                    name="username"
                    autoComplete="username"
                    value={draft.username}
                    onChange={(event) => updateUsername(event.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span>Password applicativa</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    value={draft.appPassword}
                    onChange={(event) => setDraft({ ...draft, appPassword: event.target.value })}
                    required
                  />
                  <small>
                    Resta soltanto nella sessione di questa scheda e non viene scritta
                    in IndexedDB. Verrà richiesta di nuovo dopo la chiusura.
                  </small>
                </label>
              </div>
              <button className="button primary" type="submit" disabled={loading}>
                {loading ? <RefreshCw className="spin" size={17} /> : <Cloud size={17} />}
                {isViewer ? 'Carica i registri condivisi' : 'Verifica e carica i registri'}
              </button>
            </form>
            {!isViewer && <div className="nextcloud-quick-access">
              <div>
                <strong>
                  <Link2 size={16} /> Link rapidi per ruolo
                </strong>
                <span>
                  Ogni pulsante apre direttamente la modalità indicata e compila l’indirizzo
                  Nextcloud. Username e password non vengono inseriti nei link.
                </span>
              </div>
              <NextcloudQuickAccessButtons
                links={quickAccessLinks}
                onCopied={quickAccessCopied}
                buttonClassName="button dark-secondary compact"
                disabled={loading}
              />
            </div>}
          </details>

          {message && <div className="coordinator-message">{message}</div>}

          {!isViewer && folderCandidates.length > 1 && (
            <section className="coordinator-folder-choice" aria-label="Cartella da utilizzare">
              {folderCandidates.map((remoteFolder) => (
                <button
                  className="button dark-secondary"
                  type="button"
                  key={remoteFolder}
                  disabled={loading}
                  onClick={() => void chooseRemoteFolder(remoteFolder)}
                >
                  <FolderOpen size={17} />
                  {remoteFolder}
                </button>
              ))}
            </section>
          )}

          <section className="coordinator-metrics">
            <article>
              <span>Squadre</span>
              <strong>{teams.length}</strong>
            </article>
            <article>
              <span>Atlete attive</span>
              <strong>{totalAthletes}</strong>
            </article>
            <article>
              <span>Allenamenti</span>
              <strong>{totalSessions}</strong>
            </article>
            <article className="privacy-metric">
              <ShieldCheck size={22} />
              <span>{isViewer ? 'Consultazione in sola lettura' : 'Registri sincronizzati'}</span>
            </article>
          </section>

          <section className="coordinator-section">
            <div className="section-heading">
              <div>
                <h2>Squadre</h2>
              </div>
            </div>

            {teams.length === 0 ? (
              <div className="empty-coordinator">
                <Cloud size={38} />
                <h2>Nessun dato caricato</h2>
                <p>
                  {isViewer
                    ? 'Collega il tuo account Nextcloud per caricare i file di squadra che ti sono stati condivisi.'
                    : 'Configura il tuo account e carica i registri autorizzati da Nextcloud, oppure scegli la cartella locale attendance-tracker.'}
                </p>
              </div>
            ) : (
              <div className="team-summary-grid">
                {teams.map(({ source, document }) => {
                  const totals = totalsForDocument(document)
                  const athletes = document.athletes.filter((athlete) => athlete.active).length
                  const possibleAttendances = totals.sessions * document.athletes.length
                  return (
                    <article className="team-summary-card" key={source}>
                        <div className="team-card-heading">
                          <div>
                            <span>{document.organizationName}</span>
                            <h3>{document.teamName}</h3>
                          </div>
                          <span className="season-pill">
                            {document.season.startYear}–{String(document.season.endYear).slice(-2)}
                          </span>
                        </div>
                        <div className="team-card-metrics">
                          <span>
                            <UserRound size={16} /> {document.coachName}
                          </span>
                          <span>
                            <Users size={16} /> {athletes} atlete
                          </span>
                          <span>{totals.sessions} allenamenti</span>
                        </div>
                        <div className="team-status-totals">
                          {document.statuses.map((status) => {
                            const count = totals.byStatus[status.id] ?? 0
                            const percentage = possibleAttendances
                              ? (count / possibleAttendances) * 100
                              : 0
                            const scaleColor = percentageScaleColor(status, percentage)
                            return (
                              <span
                                className={scaleColor ? 'color-scale-cell' : undefined}
                                key={status.id}
                                title={`${status.label}: ${Math.round(percentage)}%`}
                                style={scaleColor ? { backgroundColor: scaleColor } : undefined}
                              >
                                <i style={{ background: status.color }}>{status.code}</i>
                                <b>{Math.round(percentage)}%</b>
                              </span>
                            )
                          })}
                        </div>
                        <button
                          className="button team-report-button"
                          onClick={() =>
                            onNavigate(
                              `${basePath}/squadra/${encodeURIComponent(document.teamId)}`
                            )
                          }
                        >
                          Apri squadra
                          <ChevronRight size={17} />
                        </button>
                    </article>
                  )
                })}
              </div>
            )}
          </section>
        </main>
      )}
    </div>
  )
}
