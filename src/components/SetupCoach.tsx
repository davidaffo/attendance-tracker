import { useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowRight, Check, Plus, Trash2 } from 'lucide-react'
import { getCurrentSeason, WEEKDAYS } from '../domain/defaults'
import type { TeamDocument } from '../domain/types'
import { createTeamDocument } from '../domain/defaults'
import { RestoreBackupButton } from './RestoreBackupButton'
import { AthleteListPaste } from './AthleteListPaste'

interface SetupCoachProps {
  onComplete: (document: TeamDocument) => Promise<void>
  onSwitchMode: () => void
  onRestoreBackup: (document: TeamDocument) => Promise<void>
}

export function SetupCoach({
  onComplete,
  onSwitchMode,
  onRestoreBackup
}: SetupCoachProps) {
  const currentSeason = useMemo(() => getCurrentSeason(), [])
  const [teamName, setTeamName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [coachName, setCoachName] = useState('')
  const [startYear, setStartYear] = useState(currentSeason.startYear)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [athletes, setAthletes] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const athleteInputs = useRef<Array<HTMLInputElement | null>>([])

  const updateAthlete = (index: number, name: string) => {
    setAthletes((current) =>
      current.map((candidate, candidateIndex) => (candidateIndex === index ? name : candidate))
    )
  }

  const handleAthleteEnter = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key !== 'Enter') return
    event.preventDefault()

    const nextInput = athleteInputs.current[index + 1]
    if (nextInput) {
      nextInput.focus()
      return
    }

    if (!athletes[index].trim()) return
    setAthletes((current) => [...current, ''])
    requestAnimationFrame(() => athleteInputs.current[index + 1]?.focus())
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!teamName.trim() || !organizationName.trim() || !coachName.trim()) return
    setSubmitting(true)
    try {
      await onComplete(
        createTeamDocument({
          teamName,
          organizationName,
          coachName,
          startYear,
          weekdays,
          athleteNames: athletes
        })
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="setup-page">
      <div className="setup-brand">
        <div className="brand-mark" aria-hidden="true">
          <Check size={28} strokeWidth={3} />
        </div>
        <span>Registro Presenze</span>
      </div>

      <form className="setup-card" onSubmit={submit}>
        <h1>Configurazione squadra</h1>

        <div className="form-grid two-columns">
          <label className="field">
            <span>Società</span>
            <input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              placeholder="es. Volley Club"
              required
            />
          </label>
          <label className="field">
            <span>Squadra</span>
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder="es. Under 14"
              required
            />
          </label>
          <label className="field">
            <span>Allenatore</span>
            <input
              value={coachName}
              onChange={(event) => setCoachName(event.target.value)}
              placeholder="Nome e cognome"
              required
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
                value={startYear}
                onChange={(event) => setStartYear(Number(event.target.value))}
                required
              />
              <span aria-hidden="true">–</span>
              <output>{Number.isFinite(startYear) ? startYear + 1 : '—'}</output>
            </div>
          </label>
        </div>

        <fieldset className="fieldset">
          <legend>Giorni abituali</legend>
          <div className="weekday-grid">
            {WEEKDAYS.map((day) => {
              const selected = weekdays.includes(day.value)
              return (
                <button
                  className={`weekday-button ${selected ? 'selected' : ''}`}
                  key={day.value}
                  type="button"
                  onClick={() =>
                    setWeekdays((current) =>
                      selected
                        ? current.filter((value) => value !== day.value)
                        : [...current, day.value]
                    )
                  }
                  aria-pressed={selected}
                >
                  {selected && <Check size={14} />}
                  {day.short}
                </button>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Rosa</legend>
          <div className="athlete-inputs">
            {athletes.map((athlete, index) => (
              <div className="athlete-input-row" key={index}>
                <span className="row-number">{index + 1}</span>
                <input
                  ref={(element) => {
                    athleteInputs.current[index] = element
                  }}
                  value={athlete}
                  onChange={(event) => updateAthlete(index, event.target.value)}
                  onKeyDown={(event) => handleAthleteEnter(event, index)}
                  placeholder="Nome atleta"
                  aria-label={`Atleta ${index + 1}`}
                />
                <button
                  type="button"
                  className="icon-button quiet"
                  aria-label={`Rimuovi atleta ${index + 1}`}
                  disabled={athletes.length === 1}
                  onClick={() =>
                    setAthletes((current) =>
                      current.filter((_, candidateIndex) => candidateIndex !== index)
                    )
                  }
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => setAthletes((current) => [...current, ''])}
          >
            <Plus size={17} />
            Aggiungi atleta
          </button>
          <AthleteListPaste
            existingNames={athletes}
            onAdd={(names) =>
              setAthletes((current) => [...current.filter((name) => name.trim()), ...names])
            }
          />
        </fieldset>

        <div className="setup-actions">
          <button className="button primary" type="submit" disabled={submitting}>
            {submitting ? 'Preparazione…' : 'Crea il registro'}
            <ArrowRight size={18} />
          </button>
          <button className="button ghost" type="button" onClick={onSwitchMode}>
            Sono coordinatore / giocatrice
          </button>
        </div>
        <div className="setup-restore">
          <span>Hai già un backup del Registro Presenze?</span>
          <RestoreBackupButton
            onRestore={onRestoreBackup}
            label="Ripristina da JSON"
          />
        </div>
      </form>
    </main>
  )
}
