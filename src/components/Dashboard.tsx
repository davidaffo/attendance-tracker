import { CalendarDays, ChevronRight, Plus, Users } from 'lucide-react'
import type { TeamDocument, TrainingSession } from '../domain/types'
import {
  athleteTotals,
  completedAttendancesForAthletes,
  sessionsInMonth
} from '../domain/document'

interface DashboardProps {
  document: TeamDocument
  onNewSession: () => void
  onEditSession: (session: TrainingSession) => void
}

const monthFormatter = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' })
const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: '2-digit',
  month: 'short'
})

export function Dashboard({ document, onNewSession, onEditSession }: DashboardProps) {
  const now = new Date()
  const monthSessions = sessionsInMonth(document, now.getFullYear(), now.getMonth())
  const recent = [...document.sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4)
  const activeAthletes = document.athletes.filter((athlete) => athlete.active)
  const presentId = document.statuses.find((status) => status.code === 'P')?.id
  const presentCount = presentId
    ? activeAthletes.reduce(
        (total, athlete) => total + (athleteTotals(document, athlete.id, monthSessions)[presentId] ?? 0),
        0
      )
    : 0
  const possible = activeAthletes.length * monthSessions.length
  const presenceRate = possible ? Math.round((presentCount / possible) * 100) : 0

  return (
    <div className="page-content dashboard">
      <section className="hero-card">
        <div>
          <h1>Oggi</h1>
        </div>
        <button className="button light" onClick={onNewSession}>
          <Plus size={19} />
          Nuova sessione
        </button>
      </section>

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
          <span className="metric-code">P</span>
          <strong>{presenceRate}%</strong>
          <span>Presenze del mese</span>
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
                  <span className="session-date">
                    {dateFormatter.format(new Date(`${session.date}T12:00:00`))}
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
