import { useEffect, useMemo, useRef, useState } from 'react'
import { Archive, Plus, RotateCcw, Save } from 'lucide-react'
import type { Athlete, TeamDocument } from '../domain/types'
import { compareAthletesByName } from '../domain/document'
import { formatAthleteName } from '../domain/athleteList'
import { AthleteListPaste } from './AthleteListPaste'
import { WeekdayPicker } from './WeekdayPicker'
import { TrainingPeriodFields } from './TrainingPeriodFields'
import { defaultTrainingPeriod } from '../domain/defaults'
import { prepareRosterDocument, refreshTeamSettingsDraft } from '../domain/teamSettings'

interface TeamSettingsProps {
  document: TeamDocument
  onUpdate: (document: TeamDocument) => Promise<void>
  managedByCoordinator?: boolean
  onDraftChange?: (document: TeamDocument, dirty: boolean) => void
  comparisonDocument?: TeamDocument
  catalog?: { athletes: Athlete[]; coaches: { id: string; name: string; selected: boolean }[]; onAssignCoach: (id: string, assigned: boolean) => Promise<void> }
  readOnly?: boolean
}

function withScheduleDefaults(value: TeamDocument, enabled: boolean): TeamDocument {
  if (
    !enabled ||
    (value.trainingStartDate && value.trainingEndDate)
  ) {
    return value
  }
  const period = defaultTrainingPeriod(value.season.startYear)
  return {
    ...value,
    trainingStartDate: period.startDate,
    trainingEndDate: period.endDate
  }
}

export function prepareTeamSettingsDocument(
  draft: TeamDocument,
  original: TeamDocument,
  managedByCoordinator: boolean
): TeamDocument {
  const seasonStart = `${draft.season.startYear}-08-01`
  const seasonEnd = `${draft.season.endYear}-07-31`
  if (
    !managedByCoordinator &&
    (!draft.trainingStartDate ||
      !draft.trainingEndDate ||
      draft.trainingStartDate > draft.trainingEndDate ||
      draft.trainingStartDate < seasonStart ||
      draft.trainingEndDate > seasonEnd)
  ) {
    throw new Error('Inserisci un intervallo valido per il calendario degli allenamenti.')
  }
  const now = new Date().toISOString()
  const selectedWeekdays = new Set(draft.trainingWeekdays ?? [])
  const ignoredTrainingDates = managedByCoordinator
    ? draft.ignoredTrainingDates
    : (draft.ignoredTrainingDates ?? []).filter((date) =>
        Boolean(
          draft.trainingStartDate &&
          draft.trainingEndDate &&
          date >= draft.trainingStartDate &&
          date <= draft.trainingEndDate &&
          selectedWeekdays.has(new Date(`${date}T00:00:00.000Z`).getUTCDay())
        )
      )
  return {
    ...draft,
    ignoredTrainingDates,
    revision: original.revision + 1,
    updatedAt: now,
    updatedBy: draft.coachName
  }
}

export function TeamSettings({
  document,
  onUpdate,
  managedByCoordinator = false,
  onDraftChange,
  catalog,
  readOnly = false,
  comparisonDocument = document
}: TeamSettingsProps) {
  const [draft, setDraft] = useState(() =>
    withScheduleDefaults(document, !managedByCoordinator)
  )
  const [newAthlete, setNewAthlete] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const savingRef = useRef(false)
  const previousDocumentRef = useRef(withScheduleDefaults(comparisonDocument, !managedByCoordinator))
  const onDraftChangeRef = useRef(onDraftChange)
  useEffect(() => {
    onDraftChangeRef.current = onDraftChange
  }, [onDraftChange])
  useEffect(() => {
    const saved = withScheduleDefaults(comparisonDocument, !managedByCoordinator)
    const previous = previousDocumentRef.current
    previousDocumentRef.current = saved
    setDraft((current) => refreshTeamSettingsDraft(current, previous, saved))
  }, [comparisonDocument.teamId, comparisonDocument.revision, comparisonDocument.updatedAt, managedByCoordinator])
  useEffect(() => {
    const comparableDocument = withScheduleDefaults(
      comparisonDocument,
      !managedByCoordinator
    )
    onDraftChangeRef.current?.(
      draft,
      JSON.stringify(draft) !== JSON.stringify(comparableDocument)
    )
  }, [draft, comparisonDocument, managedByCoordinator])
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

  const saveRoster = async (athletes: TeamDocument['athletes']) => {
    if (savingRef.current) return false
    if (JSON.stringify(athletes) === JSON.stringify(comparisonDocument.athletes)) return true
    savingRef.current = true
    setSaving(true)
    setMessage('')
    try {
      const updated = prepareRosterDocument(comparisonDocument, athletes)
      await onUpdate(updated)
      setDraft((current) => ({
        ...current,
        athletes: updated.athletes,
        revision: updated.revision,
        updatedAt: updated.updatedAt,
        updatedBy: updated.updatedBy
      }))
      return true
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Salvataggio della rosa non riuscito.')
      return false
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const addAthlete = async () => {
    if (catalog) {
      const athlete = catalog.athletes.find(athlete => athlete.id === newAthlete)
      if (athlete && await saveRoster([...draft.athletes.filter(a => a.id !== athlete.id), { ...athlete, active: true }])) setNewAthlete('')
      return
    }
    const name = formatAthleteName(newAthlete)
    if (!name) return
    const saved = await saveRoster([
      ...draft.athletes,
      {
        id: crypto.randomUUID(),
        name,
        order: draft.athletes.length,
        active: true,
        createdAt: new Date().toISOString()
      }
    ])
    if (saved) setNewAthlete('')
  }

  const addAthletes = (names: string[]) => {
    const now = new Date().toISOString()
    return saveRoster([
      ...draft.athletes,
      ...names.map((name, index) => ({
        id: crypto.randomUUID(),
        name: formatAthleteName(name),
        order: draft.athletes.length + index,
        active: true,
        createdAt: now
      }))
    ])
  }

  const archiveAthlete = (athleteId: string) => {
    const now = new Date().toISOString()
    return saveRoster(draft.athletes.map((athlete) =>
      athlete.id === athleteId ? { ...athlete, active: false, archivedAt: now } : athlete
    ))
  }

  const restoreAthlete = (athleteId: string) => {
    return saveRoster(draft.athletes.map((athlete) => {
      if (athlete.id !== athleteId) return athlete
      const { archivedAt: _, ...rest } = athlete
      return { ...rest, active: true }
    }))
  }

  const save = async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setMessage('')
    try {
      const updated = prepareTeamSettingsDocument(draft, document, managedByCoordinator)
      await onUpdate(updated)
      setDraft(updated)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Salvataggio non riuscito.')
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <h1>Squadra e rosa</h1>
        </div>
      </div>

      <fieldset className="register-settings-fields" disabled={readOnly}>
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
              readOnly={Boolean(catalog)}
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
              readOnly={Boolean(catalog)}
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
                readOnly={Boolean(catalog)}
                onChange={(event) => {
                  const startYear = Number(event.target.value)
                  const period = defaultTrainingPeriod(startYear)
                  setDraft((current) => ({
                    ...current,
                    season: { startYear, endYear: startYear + 1 },
                    trainingStartDate: period.startDate,
                    trainingEndDate: period.endDate
                  }))
                }}
              />
              <span aria-hidden="true">–</span>
              <output>{draft.season.endYear}</output>
            </div>
          </label>
        </div>
        )}

      </section>

      {catalog && !managedByCoordinator && <section className="panel settings-panel">
        <h2>Allenatori della squadra</h2>
        <div className="host-roster-picker">{catalog.coaches.map(coach => <label key={coach.id}>
          <input type="checkbox" checked={coach.selected} onChange={event => {
            setMessage(''); void catalog.onAssignCoach(coach.id, event.target.checked).catch(error => setMessage(error instanceof Error ? error.message : 'Assegnazione non riuscita.'))
          }} /> {coach.name}
        </label>)}</div>
      </section>}
      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Giorni di allenamento</h2>
            <p className="section-copy">
              {managedByCoordinator
                ? 'Il calendario settimanale è gestito dal coordinatore.'
                : 'Serve per segnalare gli allenamenti previsti e quelli non ancora registrati.'}
            </p>
          </div>
          {!managedByCoordinator && (
            <button className="button primary" type="button" onClick={save} disabled={saving}>
              <Save size={17} />
              {saving ? 'Salvo…' : 'Salva modifiche'}
            </button>
          )}
        </div>
        <WeekdayPicker
          value={draft.trainingWeekdays ?? []}
          disabled={managedByCoordinator}
          onChange={(weekdays) => {
            setDraft((current) => {
              if (!weekdays.length || (current.trainingStartDate && current.trainingEndDate)) {
                return { ...current, trainingWeekdays: weekdays }
              }
              const period = defaultTrainingPeriod(current.season.startYear)
              return {
                ...current,
                trainingWeekdays: weekdays,
                trainingStartDate: period.startDate,
                trainingEndDate: period.endDate
              }
            })
          }}
        />
        <TrainingPeriodFields
          startYear={draft.season.startYear}
          startDate={draft.trainingStartDate ?? ''}
          endDate={draft.trainingEndDate ?? ''}
          disabled={managedByCoordinator}
          onStartDateChange={(date) => update('trainingStartDate', date)}
          onEndDateChange={(date) => update('trainingEndDate', date)}
        />
        <small className="field-help">
          Gli avvisi vengono calcolati soltanto fra queste due date.
        </small>
      </section>

      {message && <p className="form-message">{message}</p>}

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Rosa ({activeAthletes.length})</h2>
            <p className="section-copy">Le modifiche alla rosa vengono salvate automaticamente.</p>
          </div>
        </div>
        <fieldset className="roster-fields" disabled={saving}>
          <div className="roster-list">
            {activeAthletes.map((athlete, index) => (
              <div className="roster-row" key={athlete.id}>
                <span className="row-number">{index + 1}</span>
                <input
                  value={athlete.name}
                  readOnly={Boolean(catalog)}
                  aria-label={`Nome atleta ${index + 1}`}
                  onBlur={() => void saveRoster(draft.athletes)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur()
                  }}
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
              {catalog ? <select aria-label="Atleta da aggiungere alla rosa" value={newAthlete} onChange={event => setNewAthlete(event.target.value)}>
                <option value="">Seleziona un’atleta dalle anagrafiche</option>
                {catalog.athletes.filter(athlete => !activeAthletes.some(active => active.id === athlete.id)).map(athlete => <option key={athlete.id} value={athlete.id}>{athlete.name}</option>)}
              </select> : <input
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
              }
              <button className="icon-button accent" onClick={addAthlete} aria-label="Aggiungi atleta">
                <Plus size={18} />
              </button>
            </div>
          </div>

          {!catalog && <AthleteListPaste
            existingNames={draft.athletes.map((athlete) => athlete.name)}
            onAdd={addAthletes}
          />}

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
        </fieldset>
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
      </fieldset>
    </div>
  )
}
