import type { CSSProperties } from 'react'
import { ChevronRight, ClipboardCheck, UserRound, Users } from 'lucide-react'
import type { TeamSummary } from '../domain/types'
import { totalsForDocument } from '../domain/document'
import { percentageScaleColor } from '../domain/percentageColorScale'
import { PlannedSessionsPanel } from './PlannedSessionsPanel'

export function TeamDirectory({ teams, onOpen, onOpenAsCoach, onNewSession, onIgnore, canEditTeam }: {
  teams: TeamSummary[]
  onOpen: (team: TeamSummary) => void
  canEditTeam?: (team: TeamSummary) => boolean
  onOpenAsCoach?: (team: TeamSummary) => void
  onNewSession?: (team: TeamSummary, date?: string) => void
  onIgnore?: (team: TeamSummary, date: string) => Promise<void>
}) {
  return <div className="team-summary-grid">
    {teams.map(team => {
      const editable = canEditTeam?.(team) ?? true
      const { document } = team
      const totals = totalsForDocument(document)
      const athletes = document.athletes.filter(athlete => athlete.active).length
      const possible = totals.sessions * athletes
      return <article className="team-summary-card" key={team.source}>
        <div className="team-card-heading">
          <div><span>{document.organizationName}</span><h3>{document.teamName}</h3></div>
          <span className="season-pill">{document.season.startYear}–{String(document.season.endYear).slice(-2)}</span>
        </div>
        <div className="team-card-metrics">
          <span><UserRound size={16} /> {document.coachName}</span>
          <span><Users size={16} /> {athletes} atlete</span>
          <span>{totals.sessions} allenamenti</span>
        </div>
        <div className="team-status-totals">
          {document.statuses.map(status => {
            const percentage = possible ? ((totals.byStatus[status.id] ?? 0) / possible) * 100 : 0
            const color = percentageScaleColor(status, percentage)
            return <span key={status.id} title={`${status.label}: ${Math.round(percentage)}%`}
              className={color ? 'color-scale-cell' : undefined}
              style={color ? { '--percentage-scale-color': color } as CSSProperties : undefined}>
              <i style={{ background: status.color }}>{status.code}</i><b>{Math.round(percentage)}%</b>
            </span>
          })}
        </div>
        <PlannedSessionsPanel document={document} compact
          onIgnore={editable && onIgnore ? date => onIgnore(team, date) : undefined}
          onAdd={editable && onNewSession ? date => onNewSession(team, date) : undefined} />
        <div className="team-card-actions">
          <button className="button team-report-button" onClick={() => onOpen(team)}>Apri squadra <ChevronRight size={17} /></button>
          {editable && onOpenAsCoach && <button className="button secondary" type="button" onClick={() => onOpenAsCoach(team)}>
            <ClipboardCheck size={17} /> Entra come allenatore
          </button>}
        </div>
      </article>
    })}
  </div>
}
