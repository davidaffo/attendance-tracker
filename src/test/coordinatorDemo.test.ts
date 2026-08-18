import { describe, expect, it, vi } from 'vitest'
import serieD from '../../resources/nextcloud-demo-2026-2027/serie-d-aurora__2026-2027.attendance.json'
import under12 from '../../resources/nextcloud-demo-2026-2027/under-12-blu__2026-2027.attendance.json'
import under14 from '../../resources/nextcloud-demo-2026-2027/under-14-rossa__2026-2027.attendance.json'
import under16 from '../../resources/nextcloud-demo-2026-2027/under-16-verde__2026-2027.attendance.json'
import under18 from '../../resources/nextcloud-demo-2026-2027/under-18-gialla__2026-2027.attendance.json'
import { isTeamDocument, parseTeamDocument, sessionsInMonth } from '../domain/document'
import type { TeamDocument } from '../domain/types'
import { parseSelectedFiles } from '../services/localFiles'

const fixtures: unknown[] = [serieD, under12, under14, under16, under18]

describe('stagione dimostrativa del coordinatore', () => {
  it('contiene cinque registri validi e distinti', () => {
    expect(fixtures.every(isTeamDocument)).toBe(true)
    const documents = fixtures as TeamDocument[]
    expect(new Set(documents.map((document) => document.teamId))).toHaveLength(5)
    expect(documents.every((document) => document.organizationName === 'ASD Aurora Volley')).toBe(true)
  })

  it('copre tutti i dodici mesi della stagione 2026–2027', () => {
    for (const document of fixtures as TeamDocument[]) {
      for (let offset = 0; offset < 12; offset += 1) {
        const date = new Date(document.season.startYear, 7 + offset, 1)
        expect(
          sessionsInMonth(document, date.getFullYear(), date.getMonth()).length,
          `${document.teamName}: mese ${offset + 1}`
        ).toBeGreaterThan(0)
      }
    }
  })

  it('ha riferimenti coerenti e conserva lo storico delle atlete archiviate', () => {
    for (const document of fixtures as TeamDocument[]) {
      const athleteIds = new Set(document.athletes.map((athlete) => athlete.id))
      const statusIds = new Set(document.statuses.map((status) => status.id))
      for (const session of document.sessions) {
        for (const [athleteId, statusId] of Object.entries(session.attendances)) {
          expect(athleteIds.has(athleteId)).toBe(true)
          expect(statusIds.has(statusId)).toBe(true)
        }
      }

      for (const athlete of document.athletes.filter((candidate) => !candidate.active)) {
        expect(document.sessions.some((session) => athlete.id in session.attendances)).toBe(true)
        expect(document.sessions.every(
          (session) => !athlete.archivedAt || session.date < athlete.archivedAt.slice(0, 10) || !(athlete.id in session.attendances)
        )).toBe(true)
      }
    }
  })

  it('carica e ordina i file come la selezione locale del coordinatore', async () => {
    const files = [under18, under12, { nonValido: true }, serieD].map((contents, index) => ({
      name: index === 2 ? 'rotto.attendance.json' : `squadra-${index}.attendance.json`,
      webkitRelativePath: `attendance-tracker/squadra-${index}.attendance.json`,
      text: async () => JSON.stringify(contents)
    }))
    const fileList = {
      length: files.length,
      item: (index: number) => files[index] ?? null,
      *[Symbol.iterator]() {
        yield* files
      }
    } as unknown as FileList
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await parseSelectedFiles(fileList)

    expect(result.map((team) => team.document.teamName)).toEqual([
      'Serie D Aurora',
      'Under 12 Blu',
      'Under 18 Gialla'
    ])
    expect(result.every((team) => isTeamDocument(parseTeamDocument(JSON.stringify(team.document))))).toBe(true)
  })
})
