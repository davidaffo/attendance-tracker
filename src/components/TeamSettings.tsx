import { useMemo, useState } from 'react'
import { Archive, Plus, RotateCcw, Save } from 'lucide-react'
import { WEEKDAYS } from '../domain/defaults'
import type { TeamDocument } from '../domain/types'

interface TeamSettingsProps {
  document: TeamDocument
  onUpdate: (document: TeamDocument) => Promise<void>
}

export function TeamSettings({ document, onUpdate }: TeamSettingsProps) {
  const [draft, setDraft] = useState(document)
  const [newAthlete, setNewAthlete] = useState('')
  const [saving, setSaving] = useState(false)
  const activeAthletes = useMemo(
    () => [...draft.athletes].filter((athlete) => athlete.active).sort((a, b) => a.order - b.order),
    [draft.athletes]
  )
  const archivedAthletes = draft.athletes.filter((athlete) => !athlete.active)

  const update = <K extends keyof TeamDocument>(key: K, value: TeamDocument[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const addAthlete = () => {
    const name = newAthlete.trim()
    if (!name) return
    setDraft((current) => ({
      ...current,
      athletes: [
        ...current.athletes,
        {
          id: crypto.randomUUID(),
          name,
          order: current.athletes.length,
          active: true,
          createdAt: new Date().toISOString()
        }
      ]
    }))
    setNewAthlete('')
  }

  const archiveAthlete = (athleteId: string) => {
    const now = new Date().toISOString()
    setDraft((current) => ({
      ...current,
      athletes: current.athletes.map((athlete) =>
        athlete.id === athleteId ? { ...athlete, active: false, archivedAt: now } : athlete
      )
    }))
  }

  const restoreAthlete = (athleteId: string) => {
    setDraft((current) => ({
      ...current,
      athletes: current.athletes.map((athlete) => {
        if (athlete.id !== athleteId) return athlete
        const { archivedAt: _, ...rest } = athlete
        return { ...rest, active: true }
      })
    }))
  }

  const save = async () => {
    setSaving(true)
    try {
      const now = new Date().toISOString()
      const updated = {
        ...draft,
        revision: document.revision + 1,
        updatedAt: now,
        updatedBy: draft.coachName
      }
      await onUpdate(updated)
      setDraft(updated)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <h1>Squadra e rosa</h1>
        </div>
        <button className="button primary" onClick={save} disabled={saving}>
          <Save size={17} />
          {saving ? 'Salvo…' : 'Salva modifiche'}
        </button>
      </div>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Squadra</h2>
          </div>
        </div>
        <div className="form-grid two-columns">
          <label className="field">
            <span>Società</span>
            <input
              value={draft.organizationName}
              onChange={(event) => update('organizationName', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Squadra</span>
            <input
              value={draft.teamName}
              onChange={(event) => update('teamName', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Allenatore</span>
            <input
              value={draft.coachName}
              onChange={(event) => update('coachName', event.target.value)}
            />
          </label>
          <label className="field">
            <span>Anno di inizio stagione</span>
            <div className="season-input">
              <input
                type="number"
                min="2000"
                max="2100"
                inputMode="numeric"
                value={draft.season.startYear}
                onChange={(event) => {
                  const startYear = Number(event.target.value)
                  update('season', { startYear, endYear: startYear + 1 })
                }}
              />
              <span aria-hidden="true">–</span>
              <output>{draft.season.endYear}</output>
            </div>
          </label>
        </div>

        <div className="field block-field">
          <span>Giorni abituali</span>
          <div className="weekday-grid">
            {WEEKDAYS.map((day) => {
              const selected = draft.trainingWeekdays.includes(day.value)
              return (
                <button
                  className={`weekday-button ${selected ? 'selected' : ''}`}
                  key={day.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    update(
                      'trainingWeekdays',
                      selected
                        ? draft.trainingWeekdays.filter((value) => value !== day.value)
                        : [...draft.trainingWeekdays, day.value]
                    )
                  }
                >
                  {day.short}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Rosa ({activeAthletes.length})</h2>
          </div>
        </div>
        <div className="roster-list">
          {activeAthletes.map((athlete, index) => (
            <div className="roster-row" key={athlete.id}>
              <span className="row-number">{index + 1}</span>
              <input
                value={athlete.name}
                aria-label={`Nome atleta ${index + 1}`}
                onChange={(event) =>
                  update(
                    'athletes',
                    draft.athletes.map((candidate) =>
                      candidate.id === athlete.id
                        ? { ...candidate, name: event.target.value }
                        : candidate
                    )
                  )
                }
              />
              <button
                className="icon-button quiet"
                onClick={() => archiveAthlete(athlete.id)}
                title="Archivia atleta"
                aria-label={`Archivia ${athlete.name}`}
              >
                <Archive size={17} />
              </button>
            </div>
          ))}
          <div className="roster-row add-row">
            <span className="row-number">+</span>
            <input
              value={newAthlete}
              placeholder="Nuova atleta"
              onChange={(event) => setNewAthlete(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  addAthlete()
                }
              }}
            />
            <button className="icon-button accent" onClick={addAthlete} aria-label="Aggiungi atleta">
              <Plus size={18} />
            </button>
          </div>
        </div>

        {archivedAthletes.length > 0 && (
          <details className="archived">
            <summary>Atlete archiviate ({archivedAthletes.length})</summary>
            {archivedAthletes.map((athlete) => (
              <div className="roster-row" key={athlete.id}>
                <span className="row-number">—</span>
                <span className="archived-name">{athlete.name}</span>
                <button
                  className="icon-button quiet"
                  onClick={() => restoreAthlete(athlete.id)}
                  aria-label={`Ripristina ${athlete.name}`}
                >
                  <RotateCcw size={17} />
                </button>
              </div>
            ))}
          </details>
        )}
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Stati di presenza</h2>
          </div>
        </div>
        <div className="status-settings">
          {draft.statuses.map((status, index) => (
            <div className="status-setting-row" key={status.id}>
              <input
                className="color-input"
                type="color"
                value={status.color}
                aria-label={`Colore ${status.code}`}
                onChange={(event) =>
                  update(
                    'statuses',
                    draft.statuses.map((candidate) =>
                      candidate.id === status.id
                        ? { ...candidate, color: event.target.value }
                        : candidate
                    )
                  )
                }
              />
              <input
                className="code-input"
                maxLength={2}
                value={status.code}
                aria-label={`Codice stato ${index + 1}`}
                onChange={(event) =>
                  update(
                    'statuses',
                    draft.statuses.map((candidate) =>
                      candidate.id === status.id
                        ? { ...candidate, code: event.target.value.toUpperCase() }
                        : candidate
                    )
                  )
                }
              />
              <input
                value={status.label}
                aria-label={`Descrizione stato ${status.code}`}
                onChange={(event) =>
                  update(
                    'statuses',
                    draft.statuses.map((candidate) =>
                      candidate.id === status.id
                        ? { ...candidate, label: event.target.value }
                        : candidate
                    )
                  )
                }
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
