import {
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent
} from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Cloud,
  ListChecks,
  Plus,
  Trash2
} from 'lucide-react'
import {
  createTeamDocument,
  getCurrentSeason,
  WEEKDAYS
} from '../domain/defaults'
import type { SyncConfig, TeamDocument } from '../domain/types'
import { formatAthleteName } from '../domain/athleteList'
import { testWebDavConnection } from '../services/webdav'
import { RestoreBackupButton } from './RestoreBackupButton'
import { AthleteListPaste } from './AthleteListPaste'

interface AthleteDraft {
  key: string
  id?: string
  name: string
}

interface CoachOnboardingProps {
  document?: TeamDocument
  syncConfig?: SyncConfig
  onComplete: (document: TeamDocument, syncConfig?: SyncConfig) => Promise<void>
  onSkip: () => Promise<void>
  onRestoreBackup: (document: TeamDocument) => Promise<void>
}

const LAST_STEP = 4

export function CoachOnboarding({
  document,
  syncConfig,
  onComplete,
  onSkip,
  onRestoreBackup
}: CoachOnboardingProps) {
  const currentSeason = useMemo(() => getCurrentSeason(), [])
  const [step, setStep] = useState(0)
  const [organizationName, setOrganizationName] = useState(
    document?.organizationName ?? ''
  )
  const [teamName, setTeamName] = useState(document?.teamName ?? '')
  const [coachName, setCoachName] = useState(document?.coachName ?? '')
  const [startYear, setStartYear] = useState(
    document?.season.startYear ?? currentSeason.startYear
  )
  const [weekdays, setWeekdays] = useState<number[]>(
    document?.trainingWeekdays ?? []
  )
  const [athletes, setAthletes] = useState<AthleteDraft[]>(
    document
      ? document.athletes
          .filter((athlete) => athlete.active)
          .sort((a, b) => a.order - b.order)
          .map((athlete) => ({
            key: athlete.id,
            id: athlete.id,
            name: athlete.name
          }))
      : [{ key: crypto.randomUUID(), name: '' }]
  )
  const [cloud, setCloud] = useState<SyncConfig>(
    syncConfig ?? {
      baseUrl: '',
      username: '',
      appPassword: '',
      remoteFolder: 'attendance-tracker'
    }
  )
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const athleteInputs = useRef<Array<HTMLInputElement | null>>([])

  const identityComplete = Boolean(
    organizationName.trim() && teamName.trim() && coachName.trim()
  )

  const addAthleteRow = () => {
    setAthletes((current) => [
      ...current,
      { key: crypto.randomUUID(), name: '' }
    ])
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
    if (!athletes[index]?.name.trim()) return

    addAthleteRow()
    requestAnimationFrame(() => athleteInputs.current[index + 1]?.focus())
  }

  const buildDocument = (): TeamDocument => {
    const athleteNames = athletes.map((athlete) => formatAthleteName(athlete.name)).filter(Boolean)
    if (!document) {
      return createTeamDocument({
        teamName,
        organizationName,
        coachName,
        startYear,
        weekdays,
        athleteNames
      })
    }

    const now = new Date().toISOString()
    const activeIds = new Set(
      athletes.flatMap((athlete) =>
        athlete.id && athlete.name.trim() ? [athlete.id] : []
      )
    )
    const archived = document.athletes.map((athlete) => {
      if (!athlete.active || activeIds.has(athlete.id)) return athlete
      return { ...athlete, active: false, archivedAt: now }
    })
    const active = athletes
      .filter((athlete) => athlete.name.trim())
      .map((athlete, order) => {
        const existing = athlete.id
          ? document.athletes.find((candidate) => candidate.id === athlete.id)
          : undefined
        return {
          id: existing?.id ?? crypto.randomUUID(),
          name: formatAthleteName(athlete.name),
          order,
          active: true,
          createdAt: existing?.createdAt ?? now
        }
      })
    const activeIdSet = new Set(active.map((athlete) => athlete.id))

    return {
      ...document,
      organizationName: organizationName.trim(),
      teamName: teamName.trim(),
      coachName: coachName.trim(),
      season: { startYear, endYear: startYear + 1 },
      trainingWeekdays: [...weekdays].sort(),
      athletes: [
        ...active,
        ...archived.filter((athlete) => !activeIdSet.has(athlete.id))
      ],
      revision: document.revision + 1,
      updatedAt: now,
      updatedBy: coachName.trim()
    }
  }

  const next = (event: FormEvent) => {
    event.preventDefault()
    if (step === 1 && !identityComplete) return
    if (step === LAST_STEP) {
      void finish(true)
      return
    }
    if (step < LAST_STEP) setStep((current) => current + 1)
  }

  const finish = async (withCloud: boolean) => {
    if (!identityComplete) {
      setStep(1)
      return
    }
    setSubmitting(true)
    setMessage('')
    try {
      const nextDocument = buildDocument()
      if (withCloud) {
        await testWebDavConnection(cloud)
        await onComplete(nextDocument, cloud)
      } else {
        await onComplete(nextDocument)
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Configurazione non riuscita.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-shell">
        <header className="onboarding-header">
          <div className="setup-brand">
            <div className="brand-mark" aria-hidden="true">
              <Check size={26} strokeWidth={3} />
            </div>
            <span>Registro Presenze</span>
          </div>
          <button className="button ghost" type="button" onClick={() => void onSkip()}>
            Salta la guida
          </button>
        </header>

        <div className="onboarding-progress" aria-label={`Passaggio ${step + 1} di 5`}>
          {Array.from({ length: 5 }, (_, index) => (
            <i key={index} className={index <= step ? 'active' : ''} />
          ))}
        </div>

        <form className="onboarding-card" onSubmit={next} autoComplete="on">
          {step === 0 && (
            <section className="onboarding-intro">
              <div className="onboarding-icon">
                <ListChecks size={30} />
              </div>
              <h1>Configurazione allenatore</h1>
              <p className="lead">
                Inserisci squadra, giorni di allenamento e rosa. Il collegamento a Nextcloud è
                facoltativo.
              </p>
              <div className="onboarding-restore">
                <span>Hai già una copia di sicurezza?</span>
                <RestoreBackupButton
                  currentDocument={document}
                  onRestore={onRestoreBackup}
                  label="Ripristina il backup"
                />
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <div className="eyebrow">Passaggio 1 di 4</div>
              <h1>Squadra e stagione</h1>
              <div className="form-grid two-columns">
                <label className="field">
                  <span>Società</span>
                  <input
                    autoFocus
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
            </section>
          )}

          {step === 2 && (
            <section>
              <div className="eyebrow">Passaggio 2 di 4</div>
              <h1>Giorni di allenamento</h1>
              <div className="weekday-grid onboarding-weekdays">
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
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <div className="eyebrow">Passaggio 3 di 4</div>
              <h1>Rosa</h1>
              <div className="athlete-inputs onboarding-athletes">
                {athletes.map((athlete, index) => (
                  <div className="athlete-input-row" key={athlete.key}>
                    <span className="row-number">{index + 1}</span>
                    <input
                      ref={(element) => {
                        athleteInputs.current[index] = element
                      }}
                      autoFocus={index === 0}
                      value={athlete.name}
                      onChange={(event) =>
                        setAthletes((current) =>
                          current.map((candidate) =>
                            candidate.key === athlete.key
                              ? { ...candidate, name: event.target.value }
                              : candidate
                          )
                        )
                      }
                      onBlur={() =>
                        setAthletes((current) =>
                          current.map((candidate) =>
                            candidate.key === athlete.key
                              ? { ...candidate, name: formatAthleteName(candidate.name) }
                              : candidate
                          )
                        )
                      }
                      onKeyDown={(event) => handleAthleteEnter(event, index)}
                      placeholder="Nome giocatrice"
                    />
                    <button
                      className="icon-button quiet"
                      type="button"
                      onClick={() =>
                        setAthletes((current) =>
                          current.filter((candidate) => candidate.key !== athlete.key)
                        )
                      }
                      aria-label={`Rimuovi giocatrice ${index + 1}`}
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
                Aggiungi giocatrice
              </button>
              <AthleteListPaste
                existingNames={athletes.map((athlete) => athlete.name)}
                onAdd={(names) =>
                  setAthletes((current) => [
                    ...current.filter((athlete) => athlete.name.trim()),
                    ...names.map((name) => ({ key: crypto.randomUUID(), name }))
                  ])
                }
              />
            </section>
          )}

          {step === 4 && (
            <section>
              <div className="eyebrow">Passaggio 4 di 4</div>
              <h1>Nextcloud</h1>
              <p className="lead">
                Serve per salvare il registro nella cartella della squadra. Puoi farlo anche
                dopo dalle Impostazioni.
              </p>
              <div className="cloud-guide">
                <Cloud size={22} />
                Usa la password applicativa fornita dalla società, non la password principale.
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Indirizzo Nextcloud</span>
                  <input
                    type="url"
                    value={cloud.baseUrl}
                    onChange={(event) => setCloud({ ...cloud, baseUrl: event.target.value })}
                    placeholder="https://nx12345.your-storageshare.de"
                  />
                </label>
                <div className="form-grid two-columns">
                  <label className="field">
                    <span>Nome utente</span>
                    <input
                      name="username"
                      autoComplete="username"
                      value={cloud.username}
                      onChange={(event) => setCloud({ ...cloud, username: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Password applicativa</span>
                    <input
                      type="password"
                      name="password"
                      autoComplete="current-password"
                      value={cloud.appPassword}
                      onChange={(event) =>
                        setCloud({ ...cloud, appPassword: event.target.value })
                      }
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Cartella remota</span>
                  <input
                    value={cloud.remoteFolder}
                    onChange={(event) =>
                      setCloud({ ...cloud, remoteFolder: event.target.value })
                    }
                  />
                </label>
              </div>
              {message && <p className="form-message">{message}</p>}
            </section>
          )}

          <footer className="onboarding-actions">
            {step > 0 && (
              <button
                className="button secondary"
                type="button"
                onClick={() => setStep((current) => current - 1)}
              >
                <ArrowLeft size={17} />
                Indietro
              </button>
            )}
            <div />
            {step < LAST_STEP ? (
              <button
                className="button primary"
                type="submit"
                disabled={step === 1 && !identityComplete}
              >
                {step === 0 ? 'Inizia' : 'Continua'}
                <ArrowRight size={17} />
              </button>
            ) : (
              <>
                <button
                  className="button secondary"
                  type="button"
                  disabled={submitting}
                  onClick={() => void finish(false)}
                >
                  Configura Nextcloud più tardi
                </button>
                <button
                  className="button primary"
                  type="submit"
                  disabled={
                    submitting ||
                    !cloud.baseUrl ||
                    !cloud.username ||
                    !cloud.appPassword ||
                    !cloud.remoteFolder
                  }
                >
                  {submitting ? 'Verifica…' : 'Verifica e termina'}
                  <Check size={17} />
                </button>
              </>
            )}
          </footer>
        </form>
      </div>
    </main>
  )
}
