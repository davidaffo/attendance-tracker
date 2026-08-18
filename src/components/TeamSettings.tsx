import { useEffect, useMemo, useState } from 'react'
import { Archive, Plus, RotateCcw, Save } from 'lucide-react'
import type { TeamDocument } from '../domain/types'
import { compareAthletesByName } from '../domain/document'
import { formatAthleteName } from '../domain/athleteList'
import { AthleteListPaste } from './AthleteListPaste'

interface TeamSettingsProps {
  document: TeamDocument
  onUpdate: (document: TeamDocument) => Promise<void>
  managedByCoordinator?: boolean
}

export function TeamSettings({
  document,
  onUpdate,
  managedByCoordinator = false
}: TeamSettingsProps) {
  const [draft, setDraft] = useState(document)
  const [newAthlete, setNewAthlete] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    setDraft(document)
  }, [document])
  const activeAthletes = useMemo(
    () => [...draft.athletes].filter((athlete) => athlete.active).sort(compareAthletesByName),
    [draft.athletes]
  )
  const archivedAthletes = useMemo(
    () => draft.athletes.filter((athlete) => !athlete.active).sort(compareAthletesByName),
    [draft.athletes]
  )

  const update = <K extends keyof TeamDocument>(key: K, value: TeamDocument[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const addAthlete = () => {
    const name = formatAthleteName(newAthlete)
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

  const addAthletes = (names: string[]) => {
    const now = new Date().toISOString()
    setDraft((current) => ({
      ...current,
      athletes: [
        ...current.athletes,
        ...names.map((name, index) => ({
          id: crypto.randomUUID(),
          name: formatAthleteName(name),
          order: current.athletes.length + index,
          active: true,
          createdAt: now
        }))
      ]
    }))
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
    setMessage('')
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
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Salvataggio non riuscito.')
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
        {managedByCoordinator ? (
          <div className="managed-team-summary">
            <p>
              Identità e stagione sono state definite dal coordinatore e vengono lette dal
              registro condiviso.
            </p>
            <dl className="sync-details">
              <div><dt>Società</dt><dd>{draft.organizationName}</dd></div>
              <div><dt>Squadra</dt><dd>{draft.teamName}</dd></div>
              <div><dt>Allenatore</dt><dd>{draft.coachName}</dd></div>
              <div>
                <dt>Stagione</dt>
                <dd>{draft.season.startYear}–{draft.season.endYear}</dd>
              </div>
            </dl>
          </div>
        ) : (
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
        )}

      </section>

      {message && <p className="form-message">{message}</p>}

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

        <AthleteListPaste
          existingNames={draft.athletes.map((athlete) => athlete.name)}
          onAdd={addAthletes}
        />

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

      {!managedByCoordinator && <section className="panel settings-panel">
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
      </section>}
    </div>
  )
}
