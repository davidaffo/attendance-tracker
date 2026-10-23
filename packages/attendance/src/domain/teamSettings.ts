import type { TeamDocument } from './types'

export function prepareRosterDocument(
  original: TeamDocument,
  athletes: TeamDocument['athletes']
): TeamDocument {
  return {
    ...original,
    athletes,
    revision: original.revision + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: original.coachName
  }
}

// Keep unfinished settings edits when an automatic roster save refreshes the document.
export function refreshTeamSettingsDraft(
  draft: TeamDocument,
  previous: TeamDocument,
  saved: TeamDocument
): TeamDocument {
  if (draft.teamId !== saved.teamId) return saved
  const changes = Object.fromEntries(
    Object.entries(draft).filter(([key, value]) =>
      !['revision', 'updatedAt', 'updatedBy'].includes(key) &&
      JSON.stringify(value) !== JSON.stringify(previous[key as keyof TeamDocument])
    )
  )
  return { ...saved, ...changes }
}
