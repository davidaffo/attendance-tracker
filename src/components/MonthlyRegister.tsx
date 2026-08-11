import { useMemo, useState } from 'react'
import { CalendarDays, CalendarRange, Plus, Users } from 'lucide-react'
import type { TeamDocument, TrainingSession } from '../domain/types'
import {
  athleteTotals,
  athletesForReport,
  completedAttendancesForAthletes,
  sessionsInMonth
} from '../domain/document'
import { percentageScaleColor } from '../domain/percentageColorScale'

interface MonthlyRegisterProps {
  document: TeamDocument
  onEditSession?: (session: TrainingSession) => void
  onNewSession?: () => void
}

interface SeasonMonth {
  key: string
  year: number
  monthIndex: number
  label: string
  shortLabel: string
}

const monthLong = new Intl.DateTimeFormat('it-IT', { month: 'long' })
const monthShort = new Intl.DateTimeFormat('it-IT', { month: 'short' })

function getSeasonMonths(startYear: number): SeasonMonth[] {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(startYear, 7 + index, 1)
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      year: date.getFullYear(),
      monthIndex: date.getMonth(),
      label: monthLong.format(date),
      shortLabel: monthShort.format(date).replace('.', '')
    }
  })
}

export function MonthlyRegister({
  document,
  onEditSession,
  onNewSession
}: MonthlyRegisterProps) {
  const months = useMemo(() => getSeasonMonths(document.season.startYear), [document.season.startYear])
  const [selectedPeriod, setSelectedPeriod] = useState('season')
  const selectedMonth = months.find((month) => month.key === selectedPeriod)
  const sessions = selectedMonth
    ? sessionsInMonth(document, selectedMonth.year, selectedMonth.monthIndex).sort((a, b) =>
        a.date.localeCompare(b.date)
      )
    : [...document.sessions].sort((a, b) => a.date.localeCompare(b.date))
  const athletes = athletesForReport(document)
  const completedAttendances = sessions.reduce(
    (sum, session) => sum + completedAttendancesForAthletes(session, athletes),
    0
  )
  const possibleAttendances = sessions.length * athletes.length
  const completionRate = possibleAttendances
    ? Math.round((completedAttendances / possibleAttendances) * 100)
    : 0

  return (
    <div className="page-content register-page">
      <div className="page-title-row">
        <div>
          <h1>
            Stagione {document.season.startYear}–{document.season.endYear}
          </h1>
        </div>
        {onNewSession && (
          <button className="button primary" onClick={onNewSession}>
            <Plus size={17} />
            Nuovo allenamento
          </button>
        )}
      </div>

      <nav className="season-navigation" aria-label="Periodo del registro">
        <button
          className={selectedPeriod === 'season' ? 'active' : ''}
          onClick={() => setSelectedPeriod('season')}
        >
          <span>Stagione</span>
          <strong>{document.sessions.length}</strong>
        </button>
        {months.map((month) => {
          const count = sessionsInMonth(document, month.year, month.monthIndex).length
          return (
            <button
              key={month.key}
              className={selectedPeriod === month.key ? 'active' : ''}
              onClick={() => setSelectedPeriod(month.key)}
              title={month.label}
            >
              <span>{month.shortLabel}</span>
              <strong>{count}</strong>
            </button>
          )
        })}
      </nav>

      <section className="register-period-heading">
        <div>
          <h2 className="capitalize">
            {selectedMonth ? selectedMonth.label : 'Intera stagione'}
          </h2>
        </div>
        <div className="period-metrics">
          <span>
            <CalendarDays size={16} />
            <strong>{sessions.length}</strong> allenamenti
          </span>
          <span>
            <Users size={16} />
            <strong>{athletes.length}</strong> atlete
          </span>
          <span>
            <strong>{completionRate}%</strong> compilato
          </span>
        </div>
      </section>

      <div className="legend">
        {document.statuses.map((status) => (
          <span key={status.id}>
            <i style={{ background: status.color }} />
            <strong>{status.code}</strong> {status.label}
          </span>
        ))}
      </div>

      {selectedMonth ? (
        <MonthMatrix
          document={document}
          sessions={sessions}
          athletes={athletes}
          onEditSession={onEditSession}
        />
      ) : (
        <SeasonOverview
          document={document}
          months={months}
          athletes={athletes}
          onSelectMonth={setSelectedPeriod}
        />
      )}
    </div>
  )
}

interface MatrixProps {
  document: TeamDocument
  sessions: TrainingSession[]
  athletes: TeamDocument['athletes']
  onEditSession?: (session: TrainingSession) => void
}

function MonthMatrix({ document, sessions, athletes, onEditSession }: MatrixProps) {
  if (sessions.length === 0) {
    return (
      <div className="panel empty-state large-empty">
        <CalendarRange size={34} />
        <h2>Nessun allenamento nel mese</h2>
        <p>Registra una sessione oppure scegli un altro mese della stagione.</p>
      </div>
    )
  }

  return (
    <div className="matrix-wrap panel">
      <table className="attendance-matrix">
        <thead>
          <tr>
            <th className="sticky-name">Atleta</th>
            {sessions.map((session) => (
              <th key={session.id}>
                {onEditSession ? (
                  <button onClick={() => onEditSession(session)} title="Modifica sessione">
                    {session.date.slice(-2)}
                  </button>
                ) : (
                  <span>{session.date.slice(-2)}</span>
                )}
              </th>
            ))}
            {document.statuses.map((status) => (
              <th className="total-head" key={status.id}>
                <span>{status.code}</span>
                <small>n · %</small>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {athletes.map((athlete) => {
            const totals = athleteTotals(document, athlete.id, sessions)
            return (
              <tr key={athlete.id}>
                <th className="sticky-name">
                  {athlete.name}{athlete.active ? '' : ' (archiviata)'}
                </th>
                {sessions.map((session) => {
                  const status = document.statuses.find(
                    (candidate) => candidate.id === session.attendances[athlete.id]
                  )
                  return (
                    <td key={session.id}>
                      {status ? (
                        <span
                          className="matrix-status"
                          style={{ background: status.color }}
                          title={status.label}
                        >
                          {status.code}
                        </span>
                      ) : (
                        <span className="matrix-empty">—</span>
                      )}
                    </td>
                  )
                })}
                {document.statuses.map((status) => {
                  const percentage = sessions.length
                    ? (totals[status.id] / sessions.length) * 100
                    : 0
                  const scaleColor = percentageScaleColor(status, percentage)
                  return (
                    <td
                      className={`total-cell${scaleColor ? ' color-scale-cell' : ''}`}
                      key={status.id}
                      style={scaleColor ? { backgroundColor: scaleColor } : undefined}
                    >
                      <strong>{totals[status.id]}</strong>
                      <span>{Math.round(percentage)}%</span>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

interface SeasonOverviewProps {
  document: TeamDocument
  months: SeasonMonth[]
  athletes: TeamDocument['athletes']
  onSelectMonth: (key: string) => void
}

function SeasonOverview({
  document,
  months,
  athletes,
  onSelectMonth
}: SeasonOverviewProps) {
  return (
    <>
      <div className="season-month-grid">
        {months.map((month) => {
          const count = sessionsInMonth(document, month.year, month.monthIndex).length
          return (
            <button key={month.key} onClick={() => onSelectMonth(month.key)}>
              <span className="capitalize">{month.label}</span>
              <strong>{count}</strong>
              <small>{count === 1 ? 'allenamento' : 'allenamenti'}</small>
            </button>
          )
        })}
      </div>

      <div className="matrix-wrap panel season-summary">
        <table className="attendance-matrix">
          <thead>
            <tr>
              <th className="sticky-name">Atleta</th>
              {document.statuses.map((status) => (
                <th className="season-status-head" key={status.id}>
                  <span style={{ background: status.color }}>{status.code}</span>
                  {status.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {athletes.map((athlete) => {
              const totals = athleteTotals(document, athlete.id)
              return (
                <tr key={athlete.id}>
                  <th className="sticky-name">
                    {athlete.name}{athlete.active ? '' : ' (archiviata)'}
                  </th>
                  {document.statuses.map((status) => {
                    const count = totals[status.id]
                    const percentage = document.sessions.length
                      ? (count / document.sessions.length) * 100
                      : 0
                    const scaleColor = percentageScaleColor(status, percentage)
                    return (
                      <td
                        className={`season-total-cell${scaleColor ? ' color-scale-cell' : ''}`}
                        key={status.id}
                        style={scaleColor ? { backgroundColor: scaleColor } : undefined}
                      >
                        <strong>{count}</strong>
                        <span>{Math.round(percentage)}%</span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
