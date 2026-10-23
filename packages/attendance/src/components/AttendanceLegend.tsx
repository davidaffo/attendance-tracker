import type { AttendanceStatus } from '../domain/types'

interface AttendanceLegendProps {
  statuses: AttendanceStatus[]
}

export function AttendanceLegend({ statuses }: AttendanceLegendProps) {
  return (
    <div className="legend" aria-label="Legenda presenze">
      {statuses.map((status) => (
        <span key={status.id}>
          <i style={{ background: status.color }} aria-hidden="true" />
          <strong>{status.code}</strong> {status.label}
        </span>
      ))}
      <span>
        <i className="early-departure-dot" aria-hidden="true" />
        <strong>U</strong> Uscita anticipata
      </span>
    </div>
  )
}
