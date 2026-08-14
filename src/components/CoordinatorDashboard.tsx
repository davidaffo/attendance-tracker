import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Cloud,
  FolderOpen,
  RefreshCw,
  ShieldCheck,
  Users
} from 'lucide-react'
import { totalsForDocument } from '../domain/document'
import type {
  CoordinatorTeamCache,
  SyncConfig,
  TeamSummary
} from '../domain/types'
import {
  parseSelectedFiles,
  pickAndScanDirectory,
  scanDirectoryHandle
} from '../services/localFiles'
import { listRemoteTeamDocuments } from '../services/webdav'
import {
  loadCoordinatorDirectoryHandle,
  loadCoordinatorTeamCache,
  storeCoordinatorTeamCache,
  storeCoordinatorDirectoryHandle
} from '../storage/database'
import { percentageScaleColor } from '../domain/percentageColorScale'
import { detailsFromNextcloudFolderLink } from '../domain/syncConfig'
import { MonthlyRegister } from './MonthlyRegister'
import { ResetAppDataButton } from './ResetAppDataButton'

interface CoordinatorDashboardProps {
  onChooseMode: () => void
  selectedTeamId?: string
  onNavigate: (path: string) => void
  config?: SyncConfig
  onSaveConfig: (config: SyncConfig) => Promise<void>
  onPersistConnectionDetails: (config: SyncConfig) => Promise<void>
  onRequestPassword: (username: string) => Promise<string | undefined>
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

export function CoordinatorDashboard({
  onChooseMode,
  selectedTeamId,
  onNavigate,
  config,
  onSaveConfig,
  onPersistConnectionDetails,
  onRequestPassword,
  onResetAllData
}: CoordinatorDashboardProps) {
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [cloudConfigOpen, setCloudConfigOpen] = useState(!config)
  const [draft, setDraft] = useState<SyncConfig>(config ?? defaultConfig)
  const [folderLink, setFolderLink] = useState(config?.folderLink ?? '')
  const [rememberedHandle, setRememberedHandle] = useState<FileSystemDirectoryHandle>()
  const inputRef = useRef<HTMLInputElement>(null)
  const loadedOnce = useRef(false)
  const freshTeamsLoaded = useRef(false)

  const rememberTeams = async (
    found: TeamSummary[],
    source: CoordinatorTeamCache['source'],
    sourceLabel: string
  ) => {
    freshTeamsLoaded.current = true
    setTeams(found)
    await storeCoordinatorTeamCache({
      teams: found,
      loadedAt: new Date().toISOString(),
      source,
      sourceLabel
    })
  }

  const updateUsername = (username: string) => {
    const next = { ...draft, username }
    setDraft(next)
    void onPersistConnectionDetails({ ...next, appPassword: '' })
  }

  const connectionFromFolderLink = (connection: SyncConfig): SyncConfig => {
    const normalizedLink = folderLink.trim()
    return {
      ...connection,
      ...detailsFromNextcloudFolderLink(normalizedLink),
      folderLink: normalizedLink
    }
  }

  const loadCloud = async (connection = draft) => {
    setLoading(true)
    setMessage('')
    try {
      let readyConnection = connection
      if (!readyConnection.appPassword) {
        const password = await onRequestPassword(readyConnection.username)
        if (!password) {
          setMessage('Caricamento da Nextcloud non eseguito.')
          return
        }
        readyConnection = { ...readyConnection, appPassword: password }
        setDraft(readyConnection)
        await onSaveConfig(readyConnection)
      }
      const found = await listRemoteTeamDocuments(readyConnection)
      await rememberTeams(found, 'nextcloud', 'Nextcloud')
      setMessage(
        found.length
          ? `${found.length} squadre caricate da Nextcloud.`
          : `Nessun file .attendance.json trovato in ${readyConnection.remoteFolder}.`
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Nextcloud non è raggiungibile.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    loadCoordinatorTeamCache().then((cache) => {
      if (!active || !cache || freshTeamsLoaded.current) return
      setTeams(cache.teams)
      setMessage(cachedDataMessage(cache))
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!config) return
    setDraft((current) =>
      current.baseUrl === config.baseUrl &&
      current.username === config.username &&
      current.remoteFolder === config.remoteFolder
        ? { ...current, appPassword: config.appPassword || current.appPassword }
        : config
    )
    if (config.appPassword && !loadedOnce.current) {
      loadedOnce.current = true
      void loadCloud(config)
    }
  }, [config])

  useEffect(() => {
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
    setMessage('')
    try {
      const connection = connectionFromFolderLink(draft)
      setDraft(connection)
      loadedOnce.current = true
      await onSaveConfig(connection)
      await loadCloud(connection)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connessione non riuscita.')
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
    const found = await parseSelectedFiles(event.target.files)
    await rememberTeams(found, 'files', 'selezione manuale')
    setMessage(
      found.length
        ? `${found.length} squadre caricate dalla cartella locale.`
        : 'Nessun file .attendance.json valido trovato.'
    )
    setLoading(false)
  }

  const selectedTeam = teams.find((team) => team.document.teamId === selectedTeamId)
  const totalSessions = teams.reduce((sum, team) => sum + team.document.sessions.length, 0)
  const totalAthletes = teams.reduce(
    (sum, team) => sum + team.document.athletes.filter((athlete) => athlete.active).length,
    0
  )
  const statusCodes = [
    ...new Set(teams.flatMap((team) => team.document.statuses.map((status) => status.code)))
  ]

  return (
    <div className="coordinator-page">
      <header className="coordinator-header">
        <div className="brand-lockup">
          <div className="brand-mark small">
            <Check size={20} strokeWidth={3} />
          </div>
          <div>
            <strong>Registro Presenze</strong>
            <span>Coordinatore / giocatrice</span>
          </div>
        </div>
        <div className="coordinator-header-actions">
          <ResetAppDataButton
            onReset={onResetAllData}
            className="button ghost dark-ghost reset-dark"
          />
          <button className="button ghost dark-ghost" onClick={onChooseMode}>
            <ArrowLeft size={17} />
            Cambia modalità
          </button>
        </div>
      </header>

      {selectedTeam ? (
        <main className="coordinator-main coordinator-detail">
          <button className="button ghost report-back" onClick={() => onNavigate('/coordinatore')}>
            <ArrowLeft size={17} />
            Tutte le squadre
          </button>
          <section className="coordinator-report-shell">
            <MonthlyRegister document={selectedTeam.document} />
          </section>
        </main>
      ) : (
        <main className="coordinator-main">
          <section className="coordinator-hero">
            <div>
              <h1>Registri accessibili</h1>
              <p>
                Consulta in sola lettura le squadre autorizzate per il tuo account Nextcloud,
                oppure carica i registri da una cartella locale.
              </p>
            </div>
            <div className="coordinator-load-actions">
              <button
                className="button light folder-button"
                onClick={() => void loadCloud()}
                disabled={loading || !draft.baseUrl || !draft.username}
              >
                {loading ? <RefreshCw className="spin" size={19} /> : <Cloud size={20} />}
                {teams.length ? 'Aggiorna da Nextcloud' : 'Carica da Nextcloud'}
              </button>
              <button className="button dark-secondary" onClick={loadFolder} disabled={loading}>
                <FolderOpen size={19} />
                {rememberedHandle ? rememberedHandle.name : 'Cartella locale'}
              </button>
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
            <summary>Collegamento Nextcloud in sola lettura</summary>
            <form className="form-grid" onSubmit={connectCloud} autoComplete="on">
              <div className="form-grid coordinator-config-grid">
                <label className="field">
                  <span>Link della cartella Nextcloud</span>
                  <input
                    type="url"
                    value={folderLink}
                    placeholder="https://…/apps/files/files/…?dir=/Volley/Stagioni/…"
                    onChange={(event) => setFolderLink(event.target.value)}
                    required
                  />
                  <small>
                    Apri la cartella nell’app File di Nextcloud e copia l’indirizzo completo.
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
                    L’app non la salva. Il browser può proporti di ricordarla e compilarla.
                  </small>
                </label>
              </div>
              <button className="button primary" type="submit" disabled={loading}>
                <Cloud size={17} />
                Salva e carica i registri
              </button>
            </form>
          </details>

          {message && <div className="coordinator-message">{message}</div>}

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
              <span>Riepiloghi in sola lettura</span>
            </article>
          </section>

          <section className="coordinator-section">
            <div className="section-heading">
              <div>
                <h2>Riepilogo squadre</h2>
              </div>
            </div>

            {teams.length === 0 ? (
              <div className="empty-coordinator">
                <Cloud size={38} />
                <h2>Nessun dato caricato</h2>
                <p>
                  Configura il tuo account e carica i registri autorizzati da Nextcloud, oppure
                  scegli la cartella locale attendance-tracker.
                </p>
              </div>
            ) : (
              <>
                <div className="coordinator-table-wrap">
                  <table className="coordinator-summary-table">
                    <thead>
                      <tr>
                        <th>Squadra</th>
                        <th>Stagione</th>
                        <th>Atlete</th>
                        <th>Allenamenti</th>
                        {statusCodes.map((code) => (
                          <th key={code}>{code}</th>
                        ))}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {teams.map(({ source, document }) => {
                        const totals = totalsForDocument(document)
                        const possibleAttendances =
                          totals.sessions * document.athletes.length
                        return (
                          <tr key={source}>
                            <th>
                              <strong>{document.teamName}</strong>
                              <span>{document.coachName}</span>
                            </th>
                            <td>
                              {document.season.startYear}–{String(document.season.endYear).slice(-2)}
                            </td>
                            <td>{document.athletes.filter((athlete) => athlete.active).length}</td>
                            <td>{totals.sessions}</td>
                            {statusCodes.map((code) => {
                              const status = document.statuses.find(
                                (candidate) => candidate.code === code
                              )
                              const count = status ? totals.byStatus[status.id] ?? 0 : 0
                              const percentage =
                                status && possibleAttendances
                                  ? (count / possibleAttendances) * 100
                                  : 0
                              const scaleColor = status
                                ? percentageScaleColor(status, percentage)
                                : undefined
                              return (
                                <td
                                  className={scaleColor ? 'color-scale-cell' : undefined}
                                  key={code}
                                  style={scaleColor ? { backgroundColor: scaleColor } : undefined}
                                >
                                  {status ? (
                                    <strong>{Math.round(percentage)}%</strong>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                              )
                            })}
                            <td>
                              <button
                                className="icon-button quiet"
                                onClick={() =>
                                  onNavigate(
                                    `/coordinatore/squadra/${encodeURIComponent(document.teamId)}`
                                  )
                                }
                                aria-label={`Apri riepilogo ${document.teamName}`}
                              >
                                <ChevronRight size={18} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="team-summary-grid">
                  {teams.map(({ source, document }) => {
                    const totals = totalsForDocument(document)
                    const athletes = document.athletes.filter((athlete) => athlete.active).length
                    const possibleAttendances =
                      totals.sessions * document.athletes.length
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
                              `/coordinatore/squadra/${encodeURIComponent(document.teamId)}`
                            )
                          }
                        >
                          Apri riepilogo completo
                          <ChevronRight size={17} />
                        </button>
                      </article>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        </main>
      )}
    </div>
  )
}
