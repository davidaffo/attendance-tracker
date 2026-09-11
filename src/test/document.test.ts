import { describe, expect, it } from 'vitest'
import {
  COACH_ONBOARDING_VERSION,
  createTeamDocument,
  defaultTrainingPeriod,
  isFirstCoachUse
} from '../domain/defaults'
import {
  athleteScoreForSession,
  athleteTotals,
  athletesForReport,
  completedAttendancesForAthletes,
  earlyDepartureCountForAthlete,
  ignorePlannedTrainingDate,
  isTeamDocument,
  mergeDocuments,
  parseTeamDocument,
  plannedTrainingSummary,
  saveSession,
  saveSessionScore,
  scoreRanking,
  scoreTeamTotal,
  serializeTeamDocument
} from '../domain/document'

describe('documento squadra', () => {
  it('propone il periodo predefinito dall’ultima settimana completa di agosto', () => {
    expect(defaultTrainingPeriod(2026)).toEqual({
      startDate: '2026-08-24',
      endDate: '2027-06-30'
    })
    expect(defaultTrainingPeriod(2027).startDate).toBe('2027-08-23')
    expect(defaultTrainingPeriod(2028)).toEqual({
      startDate: '2028-08-21',
      endDate: '2029-06-30'
    })
    expect(defaultTrainingPeriod(2030)).toEqual({
      startDate: '2030-08-19',
      endDate: '2031-06-30'
    })
  })

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

  it('rifiuta presenze che fanno riferimento ad atlete o stati inesistenti', () => {
    const document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      athleteNames: ['Anna']
    })
    document.sessions.push({
      id: 'session-1',
      date: '2026-09-01',
      attendances: { 'atleta-inesistente': 'stato-inesistente' },
      createdAt: document.updatedAt,
      updatedAt: document.updatedAt
    })

    expect(isTeamDocument(document)).toBe(false)
  })

  it('mantiene le atlete archiviate nei riepiloghi ma non nei conteggi operativi', () => {
    const document = createTeamDocument({
      teamName: 'U18',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      athleteNames: ['Anna', 'Bea']
    })
    document.athletes[1] = {
      ...document.athletes[1],
      active: false,
      archivedAt: '2027-03-01T18:00:00.000Z'
    }
    const session = {
      id: 'session-1',
      date: '2027-02-28',
      attendances: {
        [document.athletes[0].id]: 'present',
        [document.athletes[1].id]: 'present'
      },
      createdAt: document.updatedAt,
      updatedAt: document.updatedAt
    }

    expect(athletesForReport(document)).toHaveLength(2)
    expect(completedAttendancesForAthletes(session, document.athletes.filter((a) => a.active))).toBe(1)
  })

  it('calcola i totali partendo dalle sessioni', () => {
    const document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
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

  it('mantiene l’uscita anticipata separata dallo stato e ne calcola la percentuale', () => {
    const document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      athleteNames: ['Anna']
    })
    const athlete = document.athletes[0]
    const updated = saveSession(
      document,
      {
        id: 'session-1',
        date: '2026-09-01',
        attendances: { [athlete.id]: 'present' },
        earlyDepartures: [athlete.id]
      },
      'Mario'
    )

    expect(athleteTotals(updated, athlete.id).present).toBe(1)
    expect(earlyDepartureCountForAthlete(updated, athlete.id)).toBe(1)
    expect(isTeamDocument(updated)).toBe(true)
  })

  it('calcola i punteggi dalla squadra con correzioni individuali e zero alle assenti', () => {
    let document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      athleteNames: ['Anna', 'Bianca', 'Carla']
    })
    const [anna, bianca, carla] = document.athletes
    document = saveSession(document, {
      id: 'session-1',
      date: '2026-09-07',
      attendances: {
        [anna.id]: 'present',
        [bianca.id]: 'late',
        [carla.id]: 'absent'
      }
    }, 'Mario')
    document = saveSessionScore(document, 'session-1', {
      teamPoints: { a: [10, 5], b: [8, 4] },
      assignments: { [anna.id]: 'a', [bianca.id]: 'b', [carla.id]: 'a' },
      adjustments: { [bianca.id]: -2, [carla.id]: 100 }
    }, 'Mario')

    const session = document.sessions[0]
    expect(scoreTeamTotal(session.score, 'a')).toBe(15)
    expect(athleteScoreForSession(document, session, anna.id)).toBe(15)
    expect(athleteScoreForSession(document, session, bianca.id)).toBe(10)
    expect(athleteScoreForSession(document, session, carla.id)).toBe(0)
    expect(scoreRanking(document, '2026-09').map((entry) => entry.points)).toEqual([15, 10, 0])
    expect(isTeamDocument(document)).toBe(true)
  })

  it('salva e valida più di due squadre nei punteggi', () => {
    let document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      athleteNames: ['Anna']
    })
    const athlete = document.athletes[0]
    document = saveSession(document, {
      id: 'session-1',
      date: '2026-09-07',
      attendances: { [athlete.id]: 'present' }
    }, 'Mario')
    document = saveSessionScore(document, 'session-1', {
      teamPoints: { a: [], b: [], c: [21] },
      assignments: { [athlete.id]: 'c' },
      adjustments: {}
    }, 'Mario')

    expect(document.sessions[0].score?.teamPoints.c).toEqual([21])
    expect(athleteScoreForSession(document, document.sessions[0], athlete.id)).toBe(21)
    expect(isTeamDocument(document)).toBe(true)
  })

  it('assegna punti individuali anche senza una squadra', () => {
    let document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      athleteNames: ['Anna']
    })
    const athlete = document.athletes[0]
    document = saveSession(document, {
      id: 'session-1',
      date: '2026-09-07',
      attendances: { [athlete.id]: 'present' }
    }, 'Mario')
    document = saveSessionScore(document, 'session-1', {
      teamPoints: { a: [], b: [] },
      assignments: {},
      adjustments: { [athlete.id]: 7 }
    }, 'Mario')

    expect(athleteScoreForSession(document, document.sessions[0], athlete.id)).toBe(7)
    expect(scoreRanking(document)[0]).toMatchObject({ points: 7, scoredSessions: 1 })
  })

  it('conserva i punteggi quando vengono corrette le presenze della sessione', () => {
    let document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      athleteNames: ['Anna']
    })
    const athlete = document.athletes[0]
    document = saveSession(document, {
      id: 'session-1',
      date: '2026-09-07',
      attendances: { [athlete.id]: 'present' }
    }, 'Mario')
    document = saveSessionScore(document, 'session-1', {
      teamPoints: { a: [12], b: [] },
      assignments: { [athlete.id]: 'a' },
      adjustments: {}
    }, 'Mario')
    document = saveSession(document, {
      id: 'session-1',
      date: '2026-09-07',
      attendances: { [athlete.id]: 'late' }
    }, 'Mario')

    expect(document.sessions[0].score?.teamPoints.a).toEqual([12])
  })

  it('unisce una correzione delle presenze remota con i punteggi inseriti localmente', () => {
    let base = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      athleteNames: ['Anna']
    })
    const athlete = base.athletes[0]
    base = saveSession(base, {
      id: 'session-1',
      date: '2026-09-07',
      attendances: { [athlete.id]: 'present' }
    }, 'Mario')
    base.sessions[0].attendanceUpdatedAt = '2026-09-07T20:00:00.000Z'
    base.sessions[0].updatedAt = '2026-09-07T20:00:00.000Z'

    const local = saveSessionScore(base, 'session-1', {
      teamPoints: { a: [15], b: [] },
      assignments: { [athlete.id]: 'a' },
      adjustments: {}
    }, 'Mario')
    local.sessions[0].score!.updatedAt = '2026-09-07T20:20:00.000Z'
    local.sessions[0].updatedAt = '2026-09-07T20:20:00.000Z'

    const remote = structuredClone(base)
    remote.sessions[0].attendances[athlete.id] = 'late'
    remote.sessions[0].attendanceUpdatedAt = '2026-09-07T20:10:00.000Z'
    remote.sessions[0].updatedAt = '2026-09-07T20:10:00.000Z'

    const merged = mergeDocuments(local, remote)

    expect(merged.sessions[0].attendances[athlete.id]).toBe('late')
    expect(merged.sessions[0].score?.teamPoints.a).toEqual([15])
  })

  it('individua gli allenamenti previsti non registrati e consente di ignorarli', () => {
    let document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      weekdays: [1, 3, 4],
      trainingStartDate: '2026-08-01',
      trainingEndDate: '2027-07-31',
      athleteNames: ['Anna']
    })
    document = saveSession(
      document,
      { id: 'session-1', date: '2026-08-03', attendances: {} },
      'Mario'
    )
    document = ignorePlannedTrainingDate(document, '2026-08-05', 'Mario')

    expect(plannedTrainingSummary(document, '2026-08-13')).toEqual({
      today: '2026-08-13',
      todayPlanned: true,
      todayRecorded: false,
      missingDates: ['2026-08-12', '2026-08-10', '2026-08-06']
    })

    document = saveSession(
      document,
      { id: 'session-2', date: '2026-08-05', attendances: {} },
      'Mario'
    )
    expect(document.ignoredTrainingDates).not.toContain('2026-08-05')
  })

  it('continua ad accettare i registri creati senza calendario settimanale', () => {
    const document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      athleteNames: ['Anna']
    })
    delete document.trainingWeekdays
    delete document.ignoredTrainingDates

    expect(isTeamDocument(document)).toBe(true)
    expect(plannedTrainingSummary(document, '2026-09-01').missingDates).toEqual([])
  })

  it('non genera avvisi retroattivi nei vecchi registri privi di intervallo', () => {
    const document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      weekdays: [1, 3],
      athleteNames: ['Anna']
    })

    expect(plannedTrainingSummary(document, '2026-12-01')).toEqual({
      today: '2026-12-01',
      todayPlanned: false,
      todayRecorded: false,
      missingDates: []
    })
  })

  it('limita gli avvisi alle date di inizio e fine configurate', () => {
    const document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      weekdays: [1],
      trainingStartDate: '2026-09-07',
      trainingEndDate: '2026-09-14',
      athleteNames: ['Anna']
    })

    expect(plannedTrainingSummary(document, '2026-09-21').missingDates).toEqual([
      '2026-09-14',
      '2026-09-07'
    ])
    expect(plannedTrainingSummary(document, '2026-09-21').todayPlanned).toBe(false)
  })

  it('unisce sessioni diverse senza perderle', () => {
    const base = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
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

  it('propaga all’allenatore le date previste ignorate dal coordinatore', () => {
    const base = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      weekdays: [1],
      trainingStartDate: '2026-08-01',
      trainingEndDate: '2027-07-31',
      athleteNames: ['Anna']
    })
    const coordinator = ignorePlannedTrainingDate(base, '2026-08-03', 'Coordinatore')
    const mergedForCoach = mergeDocuments(base, coordinator)

    expect(mergedForCoach.ignoredTrainingDates).toContain('2026-08-03')
    expect(plannedTrainingSummary(mergedForCoach, '2026-08-04').missingDates).toEqual([])
  })

  it('non crea due allenamenti nella stessa data durante un merge', () => {
    const base = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
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
