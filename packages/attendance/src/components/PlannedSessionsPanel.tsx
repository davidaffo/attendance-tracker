import { CalendarCheck, CalendarClock, Plus, X } from 'lucide-react'
import { plannedTrainingSummary } from '../domain/document'
import type { TeamDocument } from '../domain/types'

interface PlannedSessionsPanelProps {
  document: TeamDocument
  onAdd?: (date: string) => void
  onIgnore?: (date: string) => Promise<void>
  compact?: boolean
}

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  weekday: 'long',
  day: 'numeric',
  month: 'long'
})

function localDate(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T12:00:00`))
}

export function PlannedSessionsPanel({
  document,
  onAdd,
  onIgnore,
  compact = false
}: PlannedSessionsPanelProps) {
  const summary = plannedTrainingSummary(document, localDate())
  const hasSchedule = Boolean(document.trainingWeekdays?.length)

  if (!hasSchedule) return null
  if (!document.trainingStartDate || !document.trainingEndDate) {
    if (compact) return null
    return (
      <section className="panel planned-sessions-panel">
        <div className="planned-today">
          <CalendarClock size={22} />
          <div>
            <strong>Completa il periodo degli allenamenti</strong>
            <p>Gli avvisi restano disattivati finché non sono indicate data di inizio e fine.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={`panel planned-sessions-panel${compact ? ' compact' : ''}`}>
      <div className="planned-today">
        {summary.todayPlanned ? <CalendarClock size={22} /> : <CalendarCheck size={22} />}
        <div>
          <strong>
            {summary.todayPlanned
              ? summary.todayRecorded
                ? 'Allenamento di oggi registrato'
                : 'Allenamento previsto oggi'
              : 'Nessun allenamento previsto oggi'}
          </strong>
          {summary.todayPlanned && !summary.todayRecorded && onAdd && (
            <button className="button primary compact" type="button" onClick={() => onAdd(summary.today)}>
              <Plus size={15} />
              Apri sessione
            </button>
          )}
        </div>
      </div>

      {summary.missingDates.length > 0 && (
        <div className="missing-sessions">
          <div className="missing-sessions-heading">
            <strong>Allenamenti passati non registrati</strong>
            <span>{summary.missingDates.length}</span>
          </div>
          {(!compact || onIgnore || onAdd) && <div className="missing-session-list">
            {(compact ? summary.missingDates.slice(0, 3) : summary.missingDates).map((date) => (
              <div className="missing-session-row" key={date}>
                <span className="capitalize">{formatDate(date)}</span>
                <div>
                  {onIgnore && (
                    <button
                      className="icon-button quiet"
                      type="button"
                      title="Ignora questa data"
                      aria-label={`Ignora allenamento previsto di ${formatDate(date)}`}
                      onClick={() => void onIgnore(date)}
                    >
                      <X size={17} />
                    </button>
                  )}
                  {onAdd && (
                    <button className="button secondary compact" type="button" onClick={() => onAdd(date)}>
                      <Plus size={15} />
                      Apri sessione
                    </button>
                  )}
                </div>
              </div>
            ))}
            {compact && summary.missingDates.length > 3 && (
              <small className="missing-session-more">
                Altri {summary.missingDates.length - 3} avvisi nella scheda squadra
              </small>
            )}
          </div>}
        </div>
      )}
    </section>
  )
}
