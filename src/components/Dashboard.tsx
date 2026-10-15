import { CalendarDays, ChevronRight, Plus, Users } from 'lucide-react'
import type { TeamDocument, TrainingSession } from '../domain/types'
import {
  athleteTotals,
  completedAttendancesForAthletes,
  earlyDepartureCountForAthlete,
  sessionsInMonth
} from '../domain/document'
import { PlannedSessionsPanel } from './PlannedSessionsPanel'

interface DashboardProps {
  document: TeamDocument
  onNewSession: (date?: string) => void
  onEditSession: (session: TrainingSession) => void
  onIgnorePlannedSession: (date: string) => Promise<void>
}

const monthFormatter = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })
const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: '2-digit',
  month: 'short'
})

export function Dashboard({
  document,
  onNewSession,
  onEditSession,
  onIgnorePlannedSession
}: DashboardProps) {
  const now = new Date()
  const monthSessions = sessionsInMonth(document, now.getFullYear(), now.getMonth())
  const recent = [...document.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const activeAthletes = document.athletes.filter((athlete) => athlete.active)
  const absentId = document.statuses.find((status) => status.code === 'A')?.id
  const absenceCount = absentId
    ? activeAthletes.reduce(
        (total, athlete) => total + (athleteTotals(document, athlete.id, monthSessions)[absentId] ?? 0),
        0
      )
    : 0
  const possible = activeAthletes.length * monthSessions.length
  const absenceRate = possible ? Math.round((absenceCount / possible) * 100) : 0

  return (
    <div className="page-content dashboard">
      <section className="hero-card">
        <div>
          <h1>Panoramica</h1>
        </div>
        <button className="button light" onClick={() => onNewSession()}>
          <Plus size={19} />
          Nuova sessione
        </button>
      </section>

      <PlannedSessionsPanel
        document={document}
        onAdd={onNewSession}
        onIgnore={onIgnorePlannedSession}
      />

      <div className="section-heading">
        <div>
          <h2>{monthFormatter.format(now)}</h2>
        </div>
      </div>

      <section className="metric-grid">
        <article className="metric-card">
          <CalendarDays size={21} />
          <strong>{monthSessions.length}</strong>
          <span>Allenamenti</span>
        </article>
        <article className="metric-card">
          <Users size={21} />
          <strong>{activeAthletes.length}</strong>
          <span>Atlete in rosa</span>
        </article>
        <article className="metric-card accent-metric">
          <span className="metric-code">A</span>
          <strong>{absenceRate}%</strong>
          <span>Assenze del mese</span>
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Allenamenti recenti</h2>
          </div>
        </div>
        {recent.length === 0 ? (
          <div className="empty-state">
            <CalendarDays size={30} />
            <h3>Nessun allenamento</h3>
            <p>Non sono ancora state registrate sessioni.</p>
          </div>
        ) : (
          <div className="session-list">
            {recent.map((session) => {
              const completed = completedAttendancesForAthletes(session, activeAthletes)
              return (
                <button
                  className="session-item"
                  key={session.id}
                  onClick={() => onEditSession(session)}
                >
                  <span className="session-description">
                    <span className="session-date">
                      {dateFormatter.format(new Date(`${session.date}T12:00:00`))}
                    </span>
                    {session.note && <span className="session-note-preview">{session.note}</span>}
                  </span>
                  <span className="session-completion">
                    {completed}/{activeAthletes.length} compilate
                  </span>
                  <ChevronRight size={18} />
                </button>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
