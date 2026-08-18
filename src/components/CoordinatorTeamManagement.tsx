import {
  ArrowLeft,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Archive,
  Plus,
  RefreshCw,
  Trash2,
  Users
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { AppMode, TeamDocument, TeamSummary } from '../domain/types'
import { CoordinatorTeamCreator } from './CoordinatorTeamCreator'
import { NextcloudQuickAccessButtons } from './NextcloudQuickAccessButton'

interface CoordinatorTeamManagementProps {
  teams: TeamSummary[]
  loading: boolean
  message?: string
  onBack: () => void
  onCreate: (document: TeamDocument) => Promise<void>
  onDelete: (team: TeamSummary) => Promise<void>
  onRefresh: () => void
  onBackup: () => Promise<void>
  canBackup: boolean
  quickAccessLinks: Partial<Record<AppMode, string>>
  onQuickAccessCopied: (mode: AppMode) => void
  renderTeamControls: (team: TeamSummary) => ReactNode
}

export function CoordinatorTeamManagement({
  teams,
  loading,
  message,
  onBack,
  onCreate,
  onDelete,
  onRefresh,
  onBackup,
  canBackup,
  quickAccessLinks,
  onQuickAccessCopied,
  renderTeamControls
}: CoordinatorTeamManagementProps) {
  const [creating, setCreating] = useState(false)
  const [expandedTeam, setExpandedTeam] = useState<string>()

  return (
    <main className="coordinator-main team-management-main">
      <button className="button ghost report-back" type="button" onClick={onBack}>
        <ArrowLeft size={17} />
        Torna ai riepiloghi
      </button>

      <section className="team-management-hero">
        <div>
          <span className="eyebrow">Coordinatore</span>
          <h1>Pannello di controllo</h1>
          <p>Crea, espandi e amministra qui tutti i registri gestiti su Nextcloud.</p>
        </div>
        <div className="team-management-actions">
          <NextcloudQuickAccessButtons
            links={quickAccessLinks}
            onCopied={onQuickAccessCopied}
          />
          <button
            className="button primary"
            type="button"
            onClick={() => setCreating((current) => !current)}
            disabled={loading}
            aria-expanded={creating}
          >
            {creating ? <ChevronUp size={18} /> : <Plus size={18} />}
            {creating ? 'Chiudi inserimento' : 'Aggiungi squadra'}
          </button>
          <button className="button secondary" type="button" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={loading ? 'spin' : undefined} size={17} />
            Aggiorna
          </button>
          <button
            className="button secondary"
            type="button"
            onClick={() => void onBackup()}
            disabled={loading || !canBackup}
            title={!canBackup ? 'Carica prima i registri da Nextcloud' : undefined}
          >
            <Archive size={17} />
            Backup registri
          </button>
        </div>
      </section>

      {message && <div className="team-management-message">{message}</div>}

      {creating && (
        <CoordinatorTeamCreator
          embedded
          onCreate={async (document) => {
            await onCreate(document)
            setCreating(false)
            setExpandedTeam(document.teamId)
          }}
          onCancel={() => setCreating(false)}
        />
      )}

      <section className="team-management-list" aria-label="Squadre gestite">
        <div className="team-management-list-heading">
          <h2>Squadre ({teams.length})</h2>
          <span>I file eliminati possono essere recuperati dal cestino Nextcloud, se attivo.</span>
        </div>

        {teams.length === 0 ? (
          <div className="team-management-empty">
            <Users size={34} />
            <h3>Nessuna squadra</h3>
            <p>Crea il primo registro oppure aggiorna i dati da Nextcloud.</p>
          </div>
        ) : (
          <div className="team-management-rows">
            {teams.map((team) => {
              const { document } = team
              const remoteTeam = team.remoteFolder !== undefined
              const teamKey = `${team.source}-${document.teamId}`
              const expanded = expandedTeam === teamKey || expandedTeam === document.teamId
              return (
                <article className={`team-management-row ${expanded ? 'expanded' : ''}`} key={teamKey}>
                  <div className="team-management-team">
                    <span className="team-management-icon"><Users size={19} /></span>
                    <div>
                      <strong>{document.teamName}</strong>
                      <small>{document.organizationName} · {document.coachName}</small>
                    </div>
                  </div>
                  <span className="team-management-stat">
                    <CalendarRange size={15} />
                    {document.season.startYear}–{document.season.endYear}
                  </span>
                  <span className="team-management-stat">
                    <Users size={15} />
                    {document.athletes.filter((athlete) => athlete.active).length} atlete
                  </span>
                  <div className="team-management-row-actions">
                    <button
                      className="button secondary compact"
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setExpandedTeam(expanded ? undefined : teamKey)}
                    >
                      {expanded ? 'Chiudi' : 'Gestisci'}
                      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <button
                      className="icon-button danger-quiet"
                      type="button"
                      disabled={loading || !remoteTeam}
                      title={remoteTeam ? 'Elimina registro' : 'Disponibile soltanto per registri Nextcloud'}
                      aria-label={`Elimina ${document.teamName}`}
                      onClick={() => void onDelete(team)}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  {expanded && (
                    <div className="team-management-inline-controls">
                      {renderTeamControls(team)}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
