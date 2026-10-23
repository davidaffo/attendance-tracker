import { describe, expect, it } from 'vitest'
import { createTeamDocument } from '../../packages/attendance/src/domain/defaults'
import { isTeamDocument, mergeDocuments, saveSession } from '../../packages/attendance/src/domain/document'

describe('shared calendar identity', () => {
  it('keeps standalone date uniqueness and supports distinct API event IDs on one day', () => {
    const initial = createTeamDocument({ teamName: 'Test', organizationName: 'Club', coachName: 'Coach', startYear: 2026, athleteNames: ['Anna'] })
    const first = saveSession(initial, { id: 'morning', date: '2026-10-23', attendances: {} }, 'Coach')
    const second = saveSession(first, { id: 'evening', date: '2026-10-23', attendances: {} }, 'Coach')
    expect(isTeamDocument(second)).toBe(false)
    expect(isTeamDocument({ ...second, sessionIdentity: 'id' })).toBe(true)
    const merged = mergeDocuments({ ...first, sessionIdentity: 'id' }, { ...second, sessionIdentity: 'id' })
    expect(merged.sessions.map(s => s.id).sort()).toEqual(['evening', 'morning'])
  })
})
