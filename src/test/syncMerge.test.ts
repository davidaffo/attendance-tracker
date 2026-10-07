import { describe, expect, it } from 'vitest'
import { createTeamDocument } from '../domain/defaults'
import { saveSession, deleteSession, saveSessionScore } from '../domain/document'
import { mergeDocumentsFromBase } from '../domain/syncMerge'

function fixture() {
  const document = createTeamDocument({ teamName: 'U14', organizationName: 'Volley', coachName: 'Coach', startYear: 2026, athleteNames: ['Anna', 'Maria'] })
  const present = document.statuses[0].id
  const absent = document.statuses[1].id
  const athlete = document.athletes[0].id
  const base = saveSession(document, { id: 'first', date: '2026-10-01', attendances: { [athlete]: present } }, 'Coach')
  return { base, athlete, present, absent }
}

describe('merge dalla copia sincronizzata', () => {
  it('aggiunge un allenamento offline alla copia cloud più recente senza perdere il giorno modificato sul cloud', () => {
    const { base, athlete, present, absent } = fixture()
    const local = saveSession(base, { id: 'offline', date: '2026-10-07', attendances: { [athlete]: present } }, 'Locale')
    const remote = saveSession(base, { id: 'first', date: '2026-10-01', attendances: { [athlete]: absent } }, 'Cloud')
    const result = mergeDocumentsFromBase(local, remote, base)
    expect(result.conflicts).toEqual([])
    expect(result.document.sessions.map(s => s.date)).toEqual(['2026-10-01', '2026-10-07'])
    expect(result.document.sessions[0].attendances[athlete]).toBe(absent)
  })

  it('non ripristina una sessione eliminata su una sola copia', () => {
    const { base, athlete, present } = fixture()
    const local = deleteSession(base, 'first', 'Locale')
    const remote = saveSession(base, { id: 'other', date: '2026-10-07', attendances: { [athlete]: present } }, 'Cloud')
    const result = mergeDocumentsFromBase(local, remote, base)
    expect(result.conflicts).toEqual([])
    expect(result.document.sessions.map(s => s.id)).toEqual(['other'])
  })

  it('segnala cancellazione contro modifica dello stesso allenamento', () => {
    const { base, athlete, absent } = fixture()
    const local = deleteSession(base, 'first', 'Locale')
    const remote = saveSession(base, { id: 'first', date: '2026-10-01', attendances: { [athlete]: absent } }, 'Cloud')
    expect(mergeDocumentsFromBase(local, remote, base).conflicts).toEqual(['sessions.2026-10-01'])
  })

  it('unisce presenze e punteggi modificati separatamente sullo stesso giorno', () => {
    const { base, athlete, absent } = fixture()
    const local = saveSession(base, { id: 'first', date: '2026-10-01', attendances: { [athlete]: absent } }, 'Locale')
    const remote = saveSessionScore(base, 'first', { teamPoints: { A: [25] }, assignments: { [athlete]: 'A' }, adjustments: {} }, 'Cloud')
    const result = mergeDocumentsFromBase(local, remote, base)
    expect(result.conflicts).toEqual([])
    expect(result.document.sessions[0].attendances[athlete]).toBe(absent)
    expect(result.document.sessions[0].score?.teamPoints).toEqual({ A: [25] })
  })

  it('chiede una scelta solo sui dati incompatibili, conservando gli altri giorni', () => {
    const { base, athlete, present, absent } = fixture()
    let local = saveSession(base, { id: 'first', date: '2026-10-01', attendances: { [athlete]: absent } }, 'Locale')
    local = saveSession(local, { id: 'offline', date: '2026-10-07', attendances: { [athlete]: present } }, 'Locale')
    const remote = saveSession(base, { id: 'first', date: '2026-10-01', attendances: {} }, 'Cloud')
    expect(mergeDocumentsFromBase(local, remote, base).conflicts).toEqual([`sessions.2026-10-01.attendances.${athlete}`])
    const resolved = mergeDocumentsFromBase(local, remote, base, 'remote')
    expect(resolved.document.sessions[0].attendances).toEqual({})
    expect(resolved.document.sessions[1].id).toBe('offline')
  })

  it('gestisce lo stesso nuovo giorno creato con identificativi diversi', () => {
    const { base, athlete, present } = fixture()
    const local = saveSession(base, { id: 'local', date: '2026-10-07', attendances: { [athlete]: present } }, 'Locale')
    const remote = saveSession(base, { id: 'remote', date: '2026-10-07', attendances: { [athlete]: present } }, 'Cloud')
    const result = mergeDocumentsFromBase(local, remote, base)
    expect(result.conflicts).toEqual([])
    expect(result.document.sessions).toHaveLength(2)
  })
})
