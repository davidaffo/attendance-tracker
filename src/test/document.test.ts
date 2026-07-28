import { describe, expect, it } from 'vitest'
import {
  COACH_ONBOARDING_VERSION,
  createTeamDocument,
  isFirstCoachUse
} from '../domain/defaults'
import {
  athleteTotals,
  isTeamDocument,
  mergeDocuments,
  parseTeamDocument,
  saveSession,
  serializeTeamDocument
} from '../domain/document'

describe('documento squadra', () => {
  it('mostra la guida solo alla prima apertura senza registro', () => {
    expect(isFirstCoachUse(undefined, false)).toBe(true)
    expect(isFirstCoachUse(COACH_ONBOARDING_VERSION, false)).toBe(false)
    expect(isFirstCoachUse(undefined, true)).toBe(false)
  })

  it('crea un documento valido e serializzabile', () => {
    const document = createTeamDocument({
      teamName: 'Under 14',
      organizationName: 'Volley Club',
      coachName: 'Mario Rossi',
      startYear: 2026,
      weekdays: [1, 3],
      athleteNames: ['Anna', 'Bea']
    })

    expect(isTeamDocument(document)).toBe(true)
    expect(parseTeamDocument(serializeTeamDocument(document))).toEqual(document)
  })

  it('rifiuta un JSON che non è un backup valido della squadra', () => {
    expect(() =>
      parseTeamDocument(JSON.stringify({ teamName: 'U14', sessions: [] }))
    ).toThrow('Il file non rispetta lo schema')
  })

  it('calcola i totali partendo dalle sessioni', () => {
    const document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      weekdays: [],
      athleteNames: ['Anna']
    })
    const athlete = document.athletes[0]
    const updated = saveSession(
      document,
      {
        id: 'session-1',
        date: '2026-09-01',
        attendances: { [athlete.id]: 'present' }
      },
      'Mario'
    )

    expect(athleteTotals(updated, athlete.id).present).toBe(1)
  })

  it('unisce sessioni diverse senza perderle', () => {
    const base = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      weekdays: [],
      athleteNames: ['Anna']
    })
    const local = saveSession(
      base,
      { id: 'local', date: '2026-09-01', attendances: {} },
      'Mario'
    )
    const remote = saveSession(
      base,
      { id: 'remote', date: '2026-09-02', attendances: {} },
      'Mario'
    )

    expect(mergeDocuments(local, remote).sessions).toHaveLength(2)
  })

  it('non crea due allenamenti nella stessa data durante un merge', () => {
    const base = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      weekdays: [],
      athleteNames: ['Anna']
    })
    const first = saveSession(
      base,
      { id: 'device-a', date: '2026-09-01', attendances: {} },
      'Mario'
    )
    const second = saveSession(
      base,
      { id: 'device-b', date: '2026-09-01', attendances: {} },
      'Mario'
    )

    expect(mergeDocuments(first, second).sessions).toHaveLength(1)
  })
})
