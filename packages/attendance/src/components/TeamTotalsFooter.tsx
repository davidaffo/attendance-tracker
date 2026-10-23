import type { CSSProperties } from 'react'
import type { TeamDocument, TrainingSession } from '../domain/types'
import { completedAttendancesForAthletes } from '../domain/document'
import { percentageScaleColor } from '../domain/percentageColorScale'

interface TeamTotalsFooterProps {
  document: TeamDocument
  sessions: TrainingSession[]
  athletes: TeamDocument['athletes']
  showSessions?: boolean
}

export function TeamTotalsFooter({ document, sessions, athletes, showSessions = false }: TeamTotalsFooterProps) {
  const sessionTotals = sessions.map((session) => ({
    byStatus: Object.fromEntries(document.statuses.map((status) => [
      status.id,
      athletes.filter((athlete) => session.attendances[athlete.id] === status.id).length
    ])),
    earlyDepartures: athletes.filter((athlete) => session.earlyDepartures?.includes(athlete.id)).length
  }))
  const possibleAttendances = sessions.length * athletes.length
  const teamEarlyDepartures = sessionTotals.reduce((sum, totals) => sum + totals.earlyDepartures, 0)

  const totalCellClass = showSessions ? 'total-cell' : 'season-total-cell'

  return (
    <tfoot className="team-totals-footer">
      <tr>
        <th className="sticky-name" scope="row">Totale squadra</th>
        {showSessions && sessions.map((session, index) => (
          <td key={session.id}>
            <div className="session-team-totals">
              {document.statuses.filter((status) => sessionTotals[index].byStatus[status.id] > 0).map((status) => (
                <span key={status.id} aria-label={`${status.label}: ${sessionTotals[index].byStatus[status.id]}`}>
                  <i style={{ background: status.color }} aria-hidden="true">{status.code}</i>
                  <strong>{sessionTotals[index].byStatus[status.id]}</strong>
                </span>
              ))}
              {sessionTotals[index].earlyDepartures > 0 && (
                <span aria-label={`Uscite anticipate: ${sessionTotals[index].earlyDepartures}`}>
                  <i className="early-departure-badge" aria-hidden="true">U</i>
                  <strong>{sessionTotals[index].earlyDepartures}</strong>
                </span>
              )}
              {!completedAttendancesForAthletes(session, athletes) && !sessionTotals[index].earlyDepartures && (
                <span className="matrix-empty">—</span>
              )}
            </div>
          </td>
        ))}
        {document.statuses.map((status) => {
          const count = sessionTotals.reduce((sum, totals) => sum + totals.byStatus[status.id], 0)
          const percentage = possibleAttendances ? count / possibleAttendances * 100 : 0
          const scaleColor = percentageScaleColor(status, percentage)
          return (
            <td
              key={status.id}
              className={`${totalCellClass}${scaleColor ? ' color-scale-cell' : ''}`}
              style={scaleColor ? { '--percentage-scale-color': scaleColor } as CSSProperties : undefined}
            >
              <strong>{Math.round(percentage)}%</strong>
              <span>{count}</span>
            </td>
          )
        })}
        <td className={`${totalCellClass} early-departure-total`}>
          <strong>{possibleAttendances ? Math.round(teamEarlyDepartures / possibleAttendances * 100) : 0}%</strong>
          <span>{teamEarlyDepartures}</span>
        </td>
      </tr>
    </tfoot>
  )
}
