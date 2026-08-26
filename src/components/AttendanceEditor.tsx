import { useMemo, useState } from 'react'
import { ArrowLeft, Eraser, Save, Trash2, UserCheck, UserX } from 'lucide-react'
import type { TeamDocument, TrainingSession } from '../domain/types'
import { compareAthletesByName } from '../domain/document'

interface AttendanceEditorProps {
  document: TeamDocument
  initialSession?: TrainingSession
  onSave: (input: Pick<TrainingSession, 'id' | 'date' | 'attendances'>) => Promise<void>
  onDelete?: (sessionId: string) => Promise<void>
  onClose: () => void
}

function localDate(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function AttendanceEditor({
  document,
  initialSession,
  onSave,
  onDelete,
  onClose
}: AttendanceEditorProps) {
  const athletes = useMemo(
    () => document.athletes.filter((athlete) => athlete.active).sort(compareAthletesByName),
    [document.athletes]
  )
  const [date, setDate] = useState(initialSession?.date ?? localDate())
  const [attendances, setAttendances] = useState<Record<string, string>>(
    initialSession?.attendances ?? {}
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const completed = athletes.filter((athlete) => attendances[athlete.id]).length

  const presentStatus = document.statuses.find((status) => status.code === 'P')
  const absentStatus = document.statuses.find((status) => status.code === 'A')

  const markAll = (statusId: string) => {
    setAttendances((current) => ({
      ...current,
      ...Object.fromEntries(athletes.map((athlete) => [athlete.id, statusId]))
    }))
  }

  const clearAll = () => {
    setAttendances((current) => {
      const next = { ...current }
      for (const athlete of athletes) delete next[athlete.id]
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave({
        id: initialSession?.id ?? crypto.randomUUID(),
        date,
        attendances
      })
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Non è stato possibile salvare.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!initialSession || !onDelete) return
    if (!window.confirm('Eliminare questo allenamento? I conteggi verranno aggiornati.')) return
    await onDelete(initialSession.id)
    onClose()
  }

  return (
    <div className="editor-page">
      <header className="editor-header">
        <button className="icon-button" onClick={onClose} aria-label="Indietro">
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1>{initialSession ? 'Modifica allenamento' : 'Nuovo allenamento'}</h1>
        </div>
        <button className="button primary compact" onClick={save} disabled={saving}>
          <Save size={17} />
          <span>{saving ? 'Salvo…' : 'Salva'}</span>
        </button>
      </header>

      <section className="editor-toolbar">
        <label className="field date-field">
          <span>Data</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <div className="completion">
          <strong>
            {completed}/{athletes.length}
          </strong>
          <span>compilate</span>
        </div>
        <div className="editor-bulk-actions">
          <button
            className="button secondary"
            type="button"
            disabled={!presentStatus}
            onClick={() => presentStatus && markAll(presentStatus.id)}
          >
            <UserCheck size={17} />
            Tutte presenti
          </button>
          <button
            className="button secondary"
            type="button"
            disabled={!absentStatus}
            onClick={() => absentStatus && markAll(absentStatus.id)}
          >
            <UserX size={17} />
            Tutte assenti
          </button>
          <button className="button secondary" type="button" onClick={clearAll}>
            <Eraser size={17} />
            Azzera stati
          </button>
        </div>
      </section>

      <section className="attendance-list" aria-label="Presenze atlete">
        {athletes.length === 0 ? (
          <div className="empty-state compact-empty">
            <h2>La rosa è vuota</h2>
            <p>Aggiungi almeno un’atleta dalla schermata Squadra.</p>
          </div>
        ) : (
          athletes.map((athlete, index) => (
            <div className="attendance-row" key={athlete.id}>
              <div className="athlete-name">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{athlete.name}</strong>
              </div>
              <div className="status-options">
                {document.statuses.map((status) => {
                  const selected = attendances[athlete.id] === status.id
                  return (
                    <button
                      key={status.id}
                      type="button"
                      className={`status-button ${selected ? 'selected' : ''}`}
                      style={{ '--status-color': status.color } as React.CSSProperties}
                      aria-label={`${athlete.name}: ${status.label}`}
                      aria-pressed={selected}
                      title={status.label}
                      onClick={() =>
                        setAttendances((current) => {
                          if (selected) {
                            const next = { ...current }
                            delete next[athlete.id]
                            return next
                          }
                          return { ...current, [athlete.id]: status.id }
                        })
                      }
                    >
                      {status.code}
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </section>

      {error && <p className="editor-error">{error}</p>}

      {initialSession && (
        <button className="button danger text-danger" type="button" onClick={remove}>
          <Trash2 size={17} />
          Elimina allenamento
        </button>
      )}
    </div>
  )
}
