import type { AttendanceStatus } from '../domain/types'

export function AttendanceOutcome({ confirmed, status, earlyDeparture = false }: {
  confirmed: boolean
  status?: AttendanceStatus
  earlyDeparture?: boolean
}) {
  return <small className="attendance-outcome">
    {confirmed ? '✓ Partecipazione confermata' : 'Partecipazione non confermata'}
    {' · '}{status ? `Presenza rilevata: ${status.label}` : 'Presenza da rilevare'}
    {earlyDeparture && ' · Uscita anticipata'}
  </small>
}
