import { describe, expect, it } from 'vitest'
import { createTeamDocument } from '../domain/defaults'
import { prepareRosterDocument, refreshTeamSettingsDraft } from '../domain/teamSettings'

const createDocument = () => createTeamDocument({
  teamName: 'U14',
  organizationName: 'Volley',
  coachName: 'Coach',
  startYear: 2026,
  weekdays: [1, 3],
  athleteNames: ['Anna'],
  trainingStartDate: '2026-09-01',
  trainingEndDate: '2027-06-30'
})

describe('salvataggio automatico della rosa', () => {
  it('salva la rosa mantenendo il calendario e le altre impostazioni già salvate', () => {
    const original = createDocument()
    const draft = { ...original, trainingWeekdays: [2], trainingStartDate: '', teamName: 'U16' }
    const athletes = [...draft.athletes, { ...draft.athletes[0], id: 'bea', name: 'Bea' }]
    const saved = prepareRosterDocument(original, athletes)
    expect(saved.athletes).toEqual(athletes)
    expect(saved.trainingWeekdays).toEqual([1, 3])
    expect(saved.trainingStartDate).toBe('2026-09-01')
    expect(saved.teamName).toBe('U14')
    expect(saved.revision).toBe(original.revision + 1)
  })

  it('mantiene le modifiche al calendario in bozza dopo archiviazione e ripristino', () => {
    const original = createDocument()
    const draft = { ...original, trainingWeekdays: [2], trainingEndDate: '' }
    const archived = prepareRosterDocument(original, original.athletes.map((athlete) => ({
      ...athlete, active: false, archivedAt: new Date().toISOString()
    })))
    const refreshed = refreshTeamSettingsDraft(draft, original, archived)
    expect(refreshed.trainingWeekdays).toEqual([2])
    expect(refreshed.trainingEndDate).toBe('')
    expect(refreshed.athletes[0].active).toBe(false)
    expect(refreshed.revision).toBe(archived.revision)

    const restored = prepareRosterDocument(archived, original.athletes)
    const next = refreshTeamSettingsDraft(refreshed, archived, restored)
    expect(next.athletes[0].active).toBe(true)
    expect(next.trainingWeekdays).toEqual([2])
    expect(next.trainingEndDate).toBe('')
  })

  it('azzera la bozza quando si passa a un’altra squadra', () => {
    const original = createDocument()
    const draft = { ...original, trainingWeekdays: [2] }
    const other = { ...original, teamId: 'u16', teamName: 'U16' }
    expect(refreshTeamSettingsDraft(draft, original, other)).toEqual(other)
  })
})
