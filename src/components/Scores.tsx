import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Save,
  Trophy,
  Users,
  X
} from 'lucide-react'
import type { ScoreTeam, SessionScore, TeamDocument, TrainingSession } from '../domain/types'
import {
  athleteScoreForSession,
  athletesForReport,
  scoreRanking,
  scoreTeamTotal
} from '../domain/document'
import { matchAthleteByName, parseTeamAssignments } from '../domain/scoreImport'

interface ScoresProps {
  document: TeamDocument
  initialSessionId?: string
  onSave: (
    sessionId: string,
    score: Pick<SessionScore, 'teamPoints' | 'assignments' | 'adjustments'>
  ) => Promise<void>
}

const dateFormatter = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  year: 'numeric'
})
const monthFormatter = new Intl.DateTimeFormat('it-IT', {
  month: 'long',
  year: 'numeric'
})

function formatDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T12:00:00`))
}

function seasonMonths(document: TeamDocument): Array<{ value: string; label: string }> {
  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(document.season.startYear, 7 + index, 1)
    return {
      value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      label: monthFormatter.format(date)
    }
  })
}

function emptyScore(): Pick<SessionScore, 'teamPoints' | 'assignments' | 'adjustments'> {
  return { teamPoints: { a: [], b: [] }, assignments: {}, adjustments: {} }
}

export function Scores({ document, initialSessionId, onSave }: ScoresProps) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | undefined>(
    initialSessionId
  )
  const months = useMemo(() => seasonMonths(document), [document.season.startYear])
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(() => {
    const now = new Date()
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const index = months.findIndex((month) => month.value === currentMonth)
    return index >= 0 ? index : 0
  })
  const selectedSession = document.sessions.find((session) => session.id === selectedSessionId)
  const selectedMonth = months[selectedMonthIndex]
  const monthlyRanking = scoreRanking(document, selectedMonth?.value)
  const seasonRanking = scoreRanking(document)
  const athletesById = new Map(document.athletes.map((athlete) => [athlete.id, athlete]))
  const scoredSessions = document.sessions.filter((session) => session.score).length

  if (selectedSession) {
    return (
      <ScoreEditor
        document={document}
        session={selectedSession}
        onBack={() => setSelectedSessionId(undefined)}
        onSave={async (score) => {
          await onSave(selectedSession.id, score)
          setSelectedSessionId(undefined)
        }}
      />
    )
  }

  return (
    <div className="page-content scores-page">
      <div className="page-title-row scores-title-row">
        <div>
          <h1>Punteggi</h1>
          <p>Classifiche calcolate sugli allenamenti già presenti nel registro.</p>
        </div>
        <div className="scores-summary"><Trophy size={20} /> {scoredSessions}/{document.sessions.length} compilati</div>
      </div>

      <div className="score-rankings-grid">
        <section className="panel score-ranking-panel">
          <div className="panel-heading score-ranking-heading">
            <div>
              <span className="eyebrow">Classifica mensile</span>
              <h2 className="capitalize">{selectedMonth?.label}</h2>
            </div>
            <div className="score-month-controls">
              <button
                className="icon-button quiet"
                type="button"
                disabled={selectedMonthIndex === 0}
                aria-label="Mese precedente"
                onClick={() => setSelectedMonthIndex((index) => Math.max(0, index - 1))}
              ><ChevronLeft size={18} /></button>
              <button
                className="icon-button quiet"
                type="button"
                disabled={selectedMonthIndex === months.length - 1}
                aria-label="Mese successivo"
                onClick={() => setSelectedMonthIndex((index) => Math.min(months.length - 1, index + 1))}
              ><ChevronRight size={18} /></button>
            </div>
          </div>
          <RankingList ranking={monthlyRanking} athletesById={athletesById} />
        </section>

        <section className="panel score-ranking-panel">
          <div className="panel-heading score-ranking-heading">
            <div>
              <span className="eyebrow">Classifica generale</span>
              <h2>Stagione {document.season.startYear}–{document.season.endYear}</h2>
            </div>
          </div>
          <RankingList ranking={seasonRanking} athletesById={athletesById} />
        </section>
      </div>

      <section className="panel score-sessions-panel">
        <div className="panel-heading">
          <div>
            <h2>Allenamenti</h2>
            <p className="section-copy">Apri una sessione esistente per inserire i punteggi.</p>
          </div>
        </div>
        {document.sessions.length === 0 ? (
          <div className="empty-state">
            <Trophy size={30} />
            <h3>Nessun allenamento registrato</h3>
            <p>I punteggi potranno essere inseriti dopo aver creato una sessione.</p>
          </div>
        ) : (
          <div className="score-session-list">
            {[...document.sessions].sort((a, b) => b.date.localeCompare(a.date)).map((session) => (
              <button
                className="score-session-row"
                type="button"
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
              >
                <span>{formatDate(session.date)}</span>
                <small>{session.score ? 'Punteggio inserito' : 'Da compilare'}</small>
                {session.score && (
                  <b>A {scoreTeamTotal(session.score, 'a')} · B {scoreTeamTotal(session.score, 'b')}</b>
                )}
                <ChevronRight size={18} />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function RankingList({
  ranking,
  athletesById
}: {
  ranking: ReturnType<typeof scoreRanking>
  athletesById: Map<string, TeamDocument['athletes'][number]>
}) {
  return (
    <div className="score-ranking-list">
      {ranking.map((entry, index) => (
        <div className="score-ranking-row" key={entry.athleteId}>
          <span className={`score-position${index < 3 ? ` place-${index + 1}` : ''}`}>
            {index + 1}
          </span>
          <strong>{athletesById.get(entry.athleteId)?.name}</strong>
          <small>{entry.scoredSessions} allenamenti</small>
          <b>{entry.points} pt</b>
        </div>
      ))}
    </div>
  )
}

function ScoreEditor({
  document,
  session,
  onBack,
  onSave
}: {
  document: TeamDocument
  session: TrainingSession
  onBack: () => void
  onSave: (score: Pick<SessionScore, 'teamPoints' | 'assignments' | 'adjustments'>) => Promise<void>
}) {
  const [draft, setDraft] = useState(() => session.score ?? emptyScore())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [quickNames, setQuickNames] = useState<Record<ScoreTeam, string>>({ a: '', b: '' })
  const [partialInputs, setPartialInputs] = useState<Record<ScoreTeam, string>>({ a: '', b: '' })
  const [pasteText, setPasteText] = useState('')
  const [assignmentMessage, setAssignmentMessage] = useState('')
  const [draggedAthleteId, setDraggedAthleteId] = useState<string>()
  useEffect(() => setDraft(session.score ?? emptyScore()), [session.id, session.score])
  const athletes = useMemo(
    () => athletesForReport(document).filter(
      (athlete) => athlete.active || athlete.id in session.attendances
    ),
    [document, session.attendances]
  )
  const absentStatusId = document.statuses.find(
    (status) => status.code.toLocaleUpperCase() === 'A'
  )?.id

  const setTeamPoints = (team: ScoreTeam, points: number[]) => {
    setDraft((current) => ({
      ...current,
      teamPoints: { ...current.teamPoints, [team]: points }
    }))
  }

  const addPartial = (team: ScoreTeam) => {
    const rawValue = partialInputs[team].trim().replace(',', '.')
    if (!rawValue) return
    const points = Number(rawValue)
    if (!Number.isFinite(points)) return
    setTeamPoints(team, [...draft.teamPoints[team], points])
    setPartialInputs((current) => ({ ...current, [team]: '' }))
  }

  const assign = (athleteId: string, team: ScoreTeam | '') => {
    setDraft((current) => {
      const assignments = { ...current.assignments }
      if (team) assignments[athleteId] = team
      else delete assignments[athleteId]
      return { ...current, assignments }
    })
  }

  const assignByName = (query: string, team: ScoreTeam): boolean => {
    const match = matchAthleteByName(athletes, query)
    if (!match.athlete) {
      setAssignmentMessage(
        match.ambiguous
          ? `“${query}” corrisponde a più atlete: inserisci nome e cognome.`
          : `Atleta “${query}” non trovata.`
      )
      return false
    }
    if (session.attendances[match.athlete.id] === absentStatusId) {
      setAssignmentMessage(`${match.athlete.name} è assente e rimane a zero punti.`)
      return false
    }
    assign(match.athlete.id, team)
    setQuickNames((current) => ({ ...current, [team]: '' }))
    setAssignmentMessage(`${match.athlete.name} inserita nella Squadra ${team.toUpperCase()}.`)
    return true
  }

  const applyPastedAssignments = () => {
    const parsed = parseTeamAssignments(pasteText)
    const assignments = { ...draft.assignments }
    const problems: string[] = []
    let assigned = 0
    for (const team of ['a', 'b'] as const) {
      for (const query of parsed[team]) {
        const match = matchAthleteByName(athletes, query)
        if (!match.athlete) {
          problems.push(match.ambiguous ? `${query} (ambiguo)` : `${query} (non trovato)`)
          continue
        }
        if (session.attendances[match.athlete.id] === absentStatusId) {
          problems.push(`${match.athlete.name} (assente)`)
          continue
        }
        assignments[match.athlete.id] = team
        assigned += 1
      }
    }
    setDraft((current) => ({ ...current, assignments }))
    setAssignmentMessage(
      `${assigned} ${assigned === 1 ? 'atleta assegnata' : 'atlete assegnate'}` +
      (problems.length ? `. Non inserite: ${problems.join(', ')}.` : '.')
    )
    if (assigned) setPasteText('')
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await onSave({
        teamPoints: draft.teamPoints,
        assignments: Object.fromEntries(
          Object.entries(draft.assignments).filter(
            ([athleteId]) => session.attendances[athleteId] !== absentStatusId
          )
        ),
        adjustments: draft.adjustments
      })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Salvataggio non riuscito.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-content score-editor-page">
      <div className="score-editor-header">
        <button className="button ghost" type="button" onClick={onBack}>
          <ArrowLeft size={17} /> Punteggi
        </button>
        <div><h1>{formatDate(session.date)}</h1></div>
        <button className="button primary" type="button" disabled={saving} onClick={() => void save()}>
          <Save size={17} /> {saving ? 'Salvo…' : 'Salva punteggi'}
        </button>
      </div>

      <section className="score-teams-grid">
        {(['a', 'b'] as const).map((team) => (
          <div
            className={`panel score-team-card team-${team}${draggedAthleteId ? ' drag-active' : ''}`}
            key={team}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              const athleteId = event.dataTransfer.getData('text/athlete-id') || draggedAthleteId
              if (athleteId && session.attendances[athleteId] !== absentStatusId) {
                assign(athleteId, team)
              }
              setDraggedAthleteId(undefined)
            }}
          >
            <div className="score-team-heading">
              <div><Users size={19} /><h2>Squadra {team.toUpperCase()}</h2></div>
              <strong>{scoreTeamTotal(draft as SessionScore, team)} pt</strong>
            </div>
            <label className="score-quick-add">
              <span>Aggiungi rapidamente</span>
              <input
                list={`score-athletes-${team}`}
                value={quickNames[team]}
                placeholder="Nome o cognome, poi Invio"
                onChange={(event) => {
                  const value = event.target.value
                  setQuickNames((current) => ({ ...current, [team]: value }))
                  const selectedSuggestion = athletes.some(
                    (athlete) => athlete.name.localeCompare(
                      value,
                      'it-IT',
                      { sensitivity: 'base' }
                    ) === 0
                  )
                  if (selectedSuggestion) assignByName(value, team)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  assignByName(quickNames[team], team)
                }}
              />
              <datalist id={`score-athletes-${team}`}>
                {athletes.map((athlete) => <option key={athlete.id} value={athlete.name} />)}
              </datalist>
            </label>
            <div className="score-team-members" aria-label={`Atlete Squadra ${team.toUpperCase()}`}>
              {athletes.filter((athlete) =>
                draft.assignments[athlete.id] === team &&
                session.attendances[athlete.id] !== absentStatusId
              ).map((athlete) => (
                <span
                  className="score-team-member"
                  key={athlete.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/athlete-id', athlete.id)
                    event.dataTransfer.effectAllowed = 'move'
                    setDraggedAthleteId(athlete.id)
                  }}
                  onDragEnd={() => setDraggedAthleteId(undefined)}
                >
                  {athlete.name}
                  <button
                    type="button"
                    aria-label={`Rimuovi ${athlete.name} dalla Squadra ${team.toUpperCase()}`}
                    onClick={() => assign(athlete.id, '')}
                  ><X size={13} /></button>
                </span>
              ))}
              {!athletes.some((athlete) =>
                draft.assignments[athlete.id] === team &&
                session.attendances[athlete.id] !== absentStatusId
              ) && <small>Nessuna atleta assegnata</small>}
            </div>
            <div className="score-partials">
              <label className="score-partial-entry">
                <span>Nuovo parziale</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={partialInputs[team]}
                  placeholder="0"
                  aria-label={`Nuovo parziale Squadra ${team.toUpperCase()}`}
                  onChange={(event) => setPartialInputs((current) => ({
                    ...current,
                    [team]: event.target.value
                  }))}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    addPartial(team)
                  }}
                />
                <small>Premi Invio</small>
              </label>
              <div className="score-partial-toasts" aria-label={`Parziali Squadra ${team.toUpperCase()}`}>
                {draft.teamPoints[team].map((points, index) => (
                  <span className="score-partial-toast" key={index}>
                    <b>{points}</b>
                    <button
                      type="button"
                      aria-label={`Elimina parziale ${points}`}
                      onClick={() => setTeamPoints(
                        team,
                        draft.teamPoints[team].filter((_, candidate) => candidate !== index)
                      )}
                    ><X size={13} /></button>
                  </span>
                ))}
                {!draft.teamPoints[team].length && <small>Nessun parziale</small>}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="panel score-bulk-assignment">
        <div>
          <h2>Incolla le due squadre</h2>
          <p>
            Prima riga Squadra A, seconda riga Squadra B. Separa i nomi con virgole,
            punto e virgola o tab. Sono accettate anche tabelle Markdown con colonne A/B.
          </p>
        </div>
        <textarea
          value={pasteText}
          rows={4}
          placeholder={'Anna Rossi, Bianca Verdi\nCarla Bianchi, Daniela Neri'}
          onChange={(event) => setPasteText(event.target.value)}
        />
        <button
          className="button secondary"
          type="button"
          disabled={!pasteText.trim()}
          onClick={applyPastedAssignments}
        >
          <Users size={17} /> Assegna le atlete
        </button>
      </section>

      {assignmentMessage && (
        <p className="score-assignment-message" role="status">{assignmentMessage}</p>
      )}

      <section className="panel score-athletes-panel">
        <div className="panel-heading"><div><h2>Punteggi individuali</h2></div></div>
        <div className="score-athlete-list">
          {athletes.map((athlete) => {
            const absent = session.attendances[athlete.id] === absentStatusId
            const previewSession: TrainingSession = { ...session, score: draft as SessionScore }
            const points = absent ? 0 : athleteScoreForSession(document, previewSession, athlete.id)
            return (
              <div className={`score-athlete-row${absent ? ' absent' : ''}`} key={athlete.id}>
                <strong>{athlete.name}</strong>
                <label>
                  <span>Squadra</span>
                  <select
                    disabled={absent}
                    value={absent ? '' : draft.assignments[athlete.id] ?? ''}
                    onChange={(event) => assign(athlete.id, event.target.value as ScoreTeam | '')}
                  >
                    <option value="">—</option>
                    <option value="a">A</option>
                    <option value="b">B</option>
                  </select>
                </label>
                <label>
                  <span>Correzione</span>
                  <input
                    type="number"
                    step="1"
                    disabled={absent || !draft.assignments[athlete.id]}
                    value={draft.adjustments[athlete.id] ?? 0}
                    onChange={(event) => setDraft((current) => ({
                      ...current,
                      adjustments: {
                        ...current.adjustments,
                        [athlete.id]: Number(event.target.value)
                      }
                    }))}
                  />
                </label>
                <b>{points} pt</b>
                {absent && <small>Assente: punteggio zero</small>}
              </div>
            )
          })}
        </div>
      </section>
      {error && <p className="form-message">{error}</p>}
      <button
        className="button primary mobile-save-fab"
        type="button"
        disabled={saving}
        onClick={() => void save()}
        aria-label="Salva punteggi"
      ><Save size={22} /></button>
    </div>
  )
}
