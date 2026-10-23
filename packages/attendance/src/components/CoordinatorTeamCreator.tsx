import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from 'react'
import { ArrowLeft, CloudUpload, Plus, Trash2 } from 'lucide-react'
import {
  createTeamDocument,
  defaultTrainingPeriod,
  getCurrentSeason
} from '../domain/defaults'
import { formatAthleteName } from '../domain/athleteList'
import type { Athlete, TeamDocument } from '../domain/types'
import { AthleteListPaste } from './AthleteListPaste'
import { WeekdayPicker } from './WeekdayPicker'
import { TrainingPeriodFields } from './TrainingPeriodFields'

interface CoordinatorTeamCreatorProps {
  onCreate: (document: TeamDocument) => Promise<void>
  onCancel: () => void
  embedded?: boolean
  catalog?: { organizationName: string; startYear: number; athletes: Athlete[]; teams: { id: string; name: string; athleteIds: string[]; coachName: string }[] }
}

export function CoordinatorTeamCreator({
  onCreate,
  onCancel,
  catalog,
  embedded = false
}: CoordinatorTeamCreatorProps) {
  const currentSeason = useMemo(() => getCurrentSeason(), [])
  const [organizationName, setOrganizationName] = useState(catalog?.organizationName ?? '')
  const [teamName, setTeamName] = useState('')
  const [coachName, setCoachName] = useState('')
  const [startYear, setStartYear] = useState(catalog?.startYear ?? currentSeason.startYear)
  const [weekdays, setWeekdays] = useState<number[]>([])
  const initialTrainingPeriod = useMemo(
    () => defaultTrainingPeriod(catalog?.startYear ?? currentSeason.startYear),
    [currentSeason.startYear]
  )
  const [trainingStartDate, setTrainingStartDate] = useState(initialTrainingPeriod.startDate)
  const [trainingEndDate, setTrainingEndDate] = useState(initialTrainingPeriod.endDate)
  const [athletes, setAthletes] = useState<string[]>([''])
  const [existingTeamId, setExistingTeamId] = useState('')
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([])
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
    if (
      weekdays.length &&
      (!trainingStartDate || !trainingEndDate || trainingStartDate > trainingEndDate)
    ) {
      setMessage('Inserisci un intervallo valido per il calendario degli allenamenti.')
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const created = createTeamDocument({
          organizationName,
          teamName,
          coachName,
          startYear,
          weekdays,
          trainingStartDate,
          trainingEndDate,
          athleteNames: catalog ? [] : athletes
        })
      if (catalog) {
        created.teamId = existingTeamId || crypto.randomUUID()
        created.athletes = catalog.athletes.filter(athlete => selectedAthletes.includes(athlete.id))
      }
      await onCreate(created)
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
            {catalog ? 'Scegli una squadra esistente oppure creane una nuova, definisci il calendario e seleziona la rosa dalle anagrafiche della società.' : 'Il registro verrà caricato nella cartella Nextcloud configurata. Subito dopo potrai assegnare gli accessi agli allenatori e alle giocatrici.'}
          </p>
        </div>

        <div className="form-grid two-columns">
          <label className="field">
            <span>Società</span>
            <input
              value={organizationName}
              readOnly={Boolean(catalog)}
              onChange={(event) => setOrganizationName(event.target.value)}
              required
            />
          </label>
          {catalog && <label className="field"><span>Squadra esistente</span>
            <select value={existingTeamId} onChange={event => {
              const team = catalog.teams.find(team => team.id === event.target.value)
              setExistingTeamId(event.target.value); setTeamName(team?.name ?? ''); setCoachName(team?.coachName ?? '')
              setSelectedAthletes(team?.athleteIds ?? [])
            }}><option value="">Crea una nuova squadra</option>
              {catalog.teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select></label>}
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
              readOnly={Boolean(catalog)}
              onChange={(event) => setCoachName(event.target.value)}
              required={!catalog}
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
                readOnly={Boolean(catalog)}
                onChange={(event) => {
                  const nextStartYear = Number(event.target.value)
                  const period = defaultTrainingPeriod(nextStartYear)
                  setStartYear(nextStartYear)
                  setTrainingStartDate(period.startDate)
                  setTrainingEndDate(period.endDate)
                }}
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
          <TrainingPeriodFields
            startYear={startYear}
            startDate={trainingStartDate}
            endDate={trainingEndDate}
            onStartDateChange={setTrainingStartDate}
            onEndDateChange={setTrainingEndDate}
          />
          <small>Il calendario potrà essere modificato soltanto dal coordinatore.</small>
        </div>

        <fieldset className="fieldset">
          <legend>Rosa iniziale</legend>
          {catalog ? <div className="host-roster-picker">
            {catalog.athletes.map(athlete => <label key={athlete.id}>
              <input type="checkbox" checked={selectedAthletes.includes(athlete.id)} onChange={event => setSelectedAthletes(current => event.target.checked ? [...current, athlete.id] : current.filter(id => id !== athlete.id))} /> {athlete.name}
            </label>)}
            {!catalog.athletes.length && <p>Aggiungi le atlete alle anagrafiche della società per comporre la rosa.</p>}
          </div> : <>
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
          </>}
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
