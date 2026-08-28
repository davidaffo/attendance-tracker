import serieD from '../../resources/nextcloud-demo-2026-2027/serie-d-aurora__2026-2027.attendance.json'
import under12 from '../../resources/nextcloud-demo-2026-2027/under-12-blu__2026-2027.attendance.json'
import under14 from '../../resources/nextcloud-demo-2026-2027/under-14-rossa__2026-2027.attendance.json'
import under16 from '../../resources/nextcloud-demo-2026-2027/under-16-verde__2026-2027.attendance.json'
import under18 from '../../resources/nextcloud-demo-2026-2027/under-18-gialla__2026-2027.attendance.json'
import { isTeamDocument } from '../domain/document'
import type { TeamDocument, TeamSummary } from '../domain/types'

const rawDocuments: unknown[] = [serieD, under12, under14, under16, under18]

function demoDocuments(): TeamDocument[] {
  if (!rawDocuments.every(isTeamDocument)) {
    throw new Error('I registri demo inclusi nel progetto non sono validi.')
  }
  return structuredClone(rawDocuments as TeamDocument[])
}

export function developmentCoachDocument(): TeamDocument {
  const documents = demoDocuments()
  return documents.find((document) => document.teamId === 'under-14-rossa') ?? documents[0]
}

export function developmentTeamSummaries(): TeamSummary[] {
  return demoDocuments()
    .map((document) => ({
      source: `demo/${document.teamId}.attendance.json`,
      document
    }))
    .sort((a, b) => a.document.teamName.localeCompare(b.document.teamName, 'it'))
}
