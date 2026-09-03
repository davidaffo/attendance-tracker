import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from 'react'
import { ArrowLeft, CloudUpload, Plus, Trash2 } from 'lucide-react'
import { createTeamDocument, getCurrentSeason } from '../domain/defaults'
import { formatAthleteName } from '../domain/athleteList'
import type { TeamDocument } from '../domain/types'
import { AthleteListPaste } from './AthleteListPaste'
import { WeekdayPicker } from './WeekdayPicker'

interface CoordinatorTeamCreatorProps {
  onCreate: (document: TeamDocument) => Promise<void>
  onCancel: () => void
  embedded?: boolean
}

export function CoordinatorTeamCreator({
  onCreate,
  onCancel,
  embedded = false
}: CoordinatorTeamCreatorProps) {
  const currentSeason = useMemo(() => getCurrentSeason(), [])
  const [organizationName, setOrganizationName] = useState('')
  const [teamName, setTeamName] = useState('')
  const [coachName, setCoachName] = useState('')
  const [startYear, setStartYear] = useState(currentSeason.startYear)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [athletes, setAthletes] = useState<string[]>([''])
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const athleteInputs = useRef<Array<HTMLInputElement | null>>([])

  const addAthleteRow = () => {
    setAthletes((current) => [...current, ''])
  }

  const handleAthleteEnter = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (event.key !== 'Enter') return
    event.preventDefault()

    const nextInput = athleteInputs.current[index + 1]
    if (nextInput) {
      nextInput.focus()
      return
    }
    if (!athletes[index]?.trim()) return

    addAthleteRow()
    requestAnimationFrame(() => athleteInputs.current[index + 1]?.focus())
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setMessage('')
    try {
      await onCreate(
        createTeamDocument({
          organizationName,
          teamName,
          coachName,
          startYear,
          weekdays,
          athleteNames: athletes
        })
      )
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Creazione non riuscita.')
    } finally {
      setSubmitting(false)
    }
  }

  const content = (
    <>
      <button className="button ghost report-back" type="button" onClick={onCancel}>
        <ArrowLeft size={17} />
        {embedded ? 'Chiudi creazione' : 'Torna ai registri'}
      </button>

      <form className="panel coordinator-create-card" onSubmit={submit}>
        <div>
          <span className="eyebrow">Nuovo registro</span>
          <h1>Crea una squadra</h1>
          <p className="section-copy">
            Il registro verrà caricato nella cartella Nextcloud configurata. Subito dopo potrai
            assegnare dall’app l’accesso in modifica agli allenatori e quello in lettura alle
            giocatrici.
          </p>
        </div>

        <div className="form-grid two-columns">
          <label className="field">
            <span>Società</span>
            <input
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Squadra</span>
            <input
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Allenatore</span>
            <input
              value={coachName}
              onChange={(event) => setCoachName(event.target.value)}
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

        <div className="field block-field">
          <span>Giorni di allenamento</span>
          <WeekdayPicker value={weekdays} onChange={setWeekdays} />
          <small>Il calendario potrà essere modificato soltanto dal coordinatore.</small>
        </div>

        <fieldset className="fieldset">
          <legend>Rosa iniziale</legend>
          <div className="athlete-inputs">
            {athletes.map((athlete, index) => (
              <div className="athlete-input-row" key={index}>
                <span className="row-number">{index + 1}</span>
                <input
                  ref={(element) => {
                    athleteInputs.current[index] = element
                  }}
                  value={athlete}
                  onChange={(event) =>
                    setAthletes((current) =>
                      current.map((name, candidateIndex) =>
                        candidateIndex === index ? event.target.value : name
                      )
                    )
                  }
                  onBlur={() =>
                    setAthletes((current) =>
                      current.map((name, candidateIndex) =>
                        candidateIndex === index ? formatAthleteName(name) : name
                      )
                    )
                  }
                  placeholder="Nome atleta"
                  aria-label={`Atleta ${index + 1}`}
                  onKeyDown={(event) => handleAthleteEnter(event, index)}
                />
                <button
                  className="icon-button quiet"
                  type="button"
                  disabled={athletes.length === 1}
                  onClick={() =>
                    setAthletes((current) =>
                      current.filter((_, candidateIndex) => candidateIndex !== index)
                    )
                  }
                  aria-label={`Rimuovi atleta ${index + 1}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="text-button"
            type="button"
            onClick={addAthleteRow}
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

        {message && <p className="form-message">{message}</p>}

        <div className="inline-actions">
          <button className="button primary" type="submit" disabled={submitting}>
            <CloudUpload size={17} />
            {submitting ? 'Creo il registro…' : 'Crea squadra'}
          </button>
          <button className="button ghost" type="button" onClick={onCancel}>
            Annulla
          </button>
        </div>
      </form>
    </>
  )

  return embedded ? (
    <section className="coordinator-create-inline">{content}</section>
  ) : (
    <main className="coordinator-main coordinator-create-main">{content}</main>
  )
}
