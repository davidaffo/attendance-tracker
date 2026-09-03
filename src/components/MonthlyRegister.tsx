import { useMemo, useState } from 'react'
import { CalendarDays, CalendarRange, Plus, Users } from 'lucide-react'
import type { TeamDocument, TrainingSession } from '../domain/types'
import {
  athleteTotals,
  athletesForReport,
  completedAttendancesForAthletes,
  earlyDepartureCountForAthlete,
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
const weekdayShort = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  timeZone: 'UTC'
})

function weekdayForSession(date: string): string {
  return weekdayShort.format(new Date(`${date}T00:00:00.000Z`)).replace('.', '')
}

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
            {document.teamName} · Stagione {document.season.startYear}–{document.season.endYear}
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
        <span>
          <i className="early-departure-dot" />
          <strong>U</strong> Uscita anticipata
        </span>
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
    <>
      <MobileAthleteSummary document={document} sessions={sessions} athletes={athletes} />
      <div className="mobile-matrix-heading">
        <strong>Dettaglio allenamenti</strong>
        <span>Scorri lateralmente per vedere tutte le date</span>
      </div>
      <div className="matrix-wrap panel">
        <table className="attendance-matrix">
          <thead>
            <tr>
              <th className="sticky-name">Atleta</th>
              {sessions.map((session) => (
                <th key={session.id}>
                  {onEditSession ? (
                    <button onClick={() => onEditSession(session)} title="Modifica sessione">
                      <small>{weekdayForSession(session.date)}</small>
                      <strong>{session.date.slice(-2)}</strong>
                    </button>
                  ) : (
                    <span className="session-day-heading">
                      <small>{weekdayForSession(session.date)}</small>
                      <strong>{session.date.slice(-2)}</strong>
                    </span>
                  )}
                </th>
              ))}
              {document.statuses.map((status) => (
                <th className="total-head" key={status.id}>
                  <span>{status.code}</span>
                  <small>n · %</small>
                </th>
              ))}
              <th className="total-head early-departure-head">
                <span>U</span>
                <small>n · %</small>
              </th>
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
                        {session.earlyDepartures?.includes(athlete.id) && (
                          <span className="matrix-early-departure" title="Uscita anticipata">U</span>
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
                  <td className="total-cell early-departure-total">
                    <strong>{earlyDepartureCountForAthlete(document, athlete.id, sessions)}</strong>
                    <span>
                      {sessions.length
                        ? Math.round(
                            (earlyDepartureCountForAthlete(document, athlete.id, sessions) /
                              sessions.length) * 100
                          )
                        : 0}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
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
              <th className="season-status-head early-departure-head">
                <span>U</span>
                Uscita anticipata
              </th>
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
                  <td className="season-total-cell early-departure-total">
                    <strong>{earlyDepartureCountForAthlete(document, athlete.id)}</strong>
                    <span>
                      {document.sessions.length
                        ? Math.round(
                            (earlyDepartureCountForAthlete(document, athlete.id) /
                              document.sessions.length) * 100
                          )
                        : 0}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <MobileAthleteSummary document={document} sessions={document.sessions} athletes={athletes} />
    </>
  )
}

function MobileAthleteSummary({ document, sessions, athletes }: MatrixProps) {
  return (
    <section className="mobile-athlete-summary" aria-labelledby="athlete-summary-title">
      <div className="mobile-summary-heading">
        <h3 id="athlete-summary-title">Riepilogo atlete</h3>
        <span>{sessions.length} {sessions.length === 1 ? 'allenamento' : 'allenamenti'}</span>
      </div>
      <div className="mobile-summary-list">
        {athletes.map((athlete) => {
          const totals = athleteTotals(document, athlete.id, sessions)
          return (
            <article className="mobile-summary-card" key={athlete.id}>
              <strong>{athlete.name}</strong>
              {!athlete.active && <small>Archiviata</small>}
              <div>
                {document.statuses.map((status) => {
                  const percentage = sessions.length
                    ? Math.round((totals[status.id] / sessions.length) * 100)
                    : 0
                  return (
                    <span className="mobile-status-total" key={status.id}>
                      <i style={{ background: status.color }}>{status.code}</i>
                      <b>{totals[status.id]}</b>
                      <small>{percentage}%</small>
                    </span>
                  )
                })}
                <span className="mobile-status-total early-departure-total">
                  <i>U</i>
                  <b>{earlyDepartureCountForAthlete(document, athlete.id, sessions)}</b>
                  <small>
                    {sessions.length
                      ? Math.round(
                          (earlyDepartureCountForAthlete(document, athlete.id, sessions) /
                            sessions.length) * 100
                        )
                      : 0}%
                  </small>
                </span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
