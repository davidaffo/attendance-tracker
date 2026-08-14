import { useState, type FormEvent } from 'react'
import { ArrowLeft, Check, ChevronRight, Cloud, LoaderCircle } from 'lucide-react'
import type { SyncConfig, TeamSummary } from '../domain/types'
import { detailsFromNextcloudLink } from '../domain/syncConfig'
import { discoverRemoteTeamDocuments } from '../services/webdav'

interface SharedTeamSetupProps {
  initialConfig?: SyncConfig
  initialNextcloudLink?: string
  onOpen: (team: TeamSummary, config: SyncConfig) => Promise<void>
  onBack: () => void
}

const emptyConfig: SyncConfig = {
  baseUrl: '',
  username: '',
  appPassword: '',
  remoteFolder: ''
}

export function SharedTeamSetup({
  initialConfig,
  initialNextcloudLink,
  onOpen,
  onBack
}: SharedTeamSetupProps) {
  const initialLink =
    initialNextcloudLink ?? initialConfig?.folderLink ?? initialConfig?.baseUrl ?? ''
  const [link, setLink] = useState(initialLink)
  const [draft, setDraft] = useState<SyncConfig>(() => {
    const current = initialConfig ?? emptyConfig
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
  })
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [readyConfig, setReadyConfig] = useState<SyncConfig>()
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const configForTeam = (team: TeamSummary, config: SyncConfig): SyncConfig => ({
    ...config,
    remoteFolder: team.remoteFolder ?? config.remoteFolder
  })

  const connect = async (event: FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    try {
      const normalizedLink = link.trim()
      const config = {
        ...draft,
        ...detailsFromNextcloudLink(normalizedLink),
        folderLink: normalizedLink
      }
      const found = await discoverRemoteTeamDocuments(config)
      setDraft(config)
      setReadyConfig(config)
      setTeams(found)
      if (found.length === 0) {
        setMessage('Nessun registro condiviso è accessibile con questo account.')
      } else if (found.length === 1) {
        await onOpen(found[0], configForTeam(found[0], config))
      } else {
        setMessage('Sono disponibili più registri. Scegli la squadra da aprire.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connessione non riuscita.')
    } finally {
      setLoading(false)
    }
  }

  const openTeam = async (team: TeamSummary) => {
    if (!readyConfig) return
    setLoading(true)
    setMessage('')
    try {
      await onOpen(team, configForTeam(team, readyConfig))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Apertura non riuscita.')
      setLoading(false)
    }
  }

  return (
    <main className="setup-page">
      <div className="setup-brand">
        <div className="brand-mark" aria-hidden="true">
          <Check size={28} strokeWidth={3} />
        </div>
        <span>Registro Presenze</span>
      </div>

      <section className="setup-card shared-team-setup">
        <div>
          <span className="eyebrow">Squadra preparata dal coordinatore</span>
          <h1>Apri il registro condiviso</h1>
          <p className="section-copy">
            Inserisci il server Nextcloud o il link della cartella condivisa. Squadra, stagione e
            rosa verranno lette direttamente dal registro.
          </p>
        </div>

        <form className="form-grid" onSubmit={connect} autoComplete="on">
          <label className="field">
            <span>Indirizzo o link Nextcloud</span>
            <input
              type="url"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://cloud.example.it"
              readOnly={Boolean(initialNextcloudLink)}
              required
            />
            {initialNextcloudLink && (
              <small>Precompilato dal link ricevuto dal coordinatore.</small>
            )}
          </label>
          <div className="form-grid two-columns">
            <label className="field">
              <span>Nome utente</span>
              <input
                name="username"
                autoComplete="username"
                value={draft.username}
                onChange={(event) => setDraft({ ...draft, username: event.target.value })}
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
                Resta soltanto nella sessione di questa scheda e verrà richiesta di
                nuovo dopo la chiusura.
              </small>
            </label>
          </div>
          <button className="button primary" type="submit" disabled={loading}>
            {loading ? <LoaderCircle className="spin" size={17} /> : <Cloud size={17} />}
            {loading ? 'Cerco i registri…' : 'Cerca registri condivisi'}
          </button>
        </form>

        {message && <p className="form-message">{message}</p>}

        {teams.length > 1 && (
          <div className="shared-team-list">
            {teams.map((team) => (
              <button
                type="button"
                key={team.source}
                onClick={() => void openTeam(team)}
                disabled={loading}
              >
                <span>
                  <strong>{team.document.teamName}</strong>
                  <small>
                    {team.document.organizationName} · {team.document.season.startYear}–
                    {team.document.season.endYear}
                  </small>
                </span>
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        )}

        <button className="button ghost" type="button" onClick={onBack} disabled={loading}>
          <ArrowLeft size={17} />
          Indietro
        </button>
      </section>
    </main>
  )
}
