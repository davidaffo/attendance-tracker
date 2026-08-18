import type {
  Athlete,
  AttendanceStatus,
  TeamDocument,
  TeamTotals,
  TrainingSession
} from './types'
import { ATTENDANCE_SCHEMA_VERSION } from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === 'string'

function isStatus(value: unknown): value is AttendanceStatus {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.code) &&
    isString(value.label) &&
    isString(value.color)
  )
}

function isAthlete(value: unknown): value is Athlete {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isString(value.name) &&
    typeof value.order === 'number' &&
    typeof value.active === 'boolean' &&
    isString(value.createdAt) &&
    (value.archivedAt === undefined || isString(value.archivedAt))
  )
}

function isSession(value: unknown): value is TrainingSession {
  return (
    isRecord(value) &&
    isString(value.id) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.date)) &&
    isRecord(value.attendances) &&
    Object.values(value.attendances).every(isString) &&
    isString(value.createdAt) &&
    isString(value.updatedAt) &&
    (value.updatedBy === undefined || isString(value.updatedBy))
  )
}

export function isTeamDocument(value: unknown): value is TeamDocument {
  if (!isRecord(value) || value.schemaVersion !== ATTENDANCE_SCHEMA_VERSION) return false
  if (!isRecord(value.season)) return false

  const hasValidShape =
    isString(value.teamId) &&
    isString(value.teamName) &&
    isString(value.organizationName) &&
    isString(value.coachName) &&
    typeof value.season.startYear === 'number' &&
    typeof value.season.endYear === 'number' &&
    typeof value.revision === 'number' &&
    isString(value.updatedAt) &&
    isString(value.updatedBy) &&
    Array.isArray(value.statuses) &&
    value.statuses.every(isStatus) &&
    Array.isArray(value.athletes) &&
    value.athletes.every(isAthlete) &&
    Array.isArray(value.sessions) &&
    value.sessions.every(isSession)

  if (!hasValidShape) return false

  const document = value as unknown as TeamDocument
  const statusIds = new Set(document.statuses.map((status) => status.id))
  const statusCodes = new Set(document.statuses.map((status) => status.code))
  const athleteIds = new Set(document.athletes.map((athlete) => athlete.id))
  const sessionIds = new Set(document.sessions.map((session) => session.id))
  const sessionDates = new Set(document.sessions.map((session) => session.date))

  if (
    statusIds.size !== document.statuses.length ||
    statusCodes.size !== document.statuses.length ||
    athleteIds.size !== document.athletes.length ||
    sessionIds.size !== document.sessions.length ||
    sessionDates.size !== document.sessions.length
  ) return false

  return document.sessions.every((session) =>
    Object.entries(session.attendances).every(
      ([athleteId, statusId]) => athleteIds.has(athleteId) && statusIds.has(statusId)
    )
  )
}

export function parseTeamDocument(text: string): TeamDocument {
  const value: unknown = JSON.parse(text)
  if (!isTeamDocument(value)) {
    throw new Error('Il file non rispetta lo schema del Registro Presenze.')
  }
  return value
}

export function serializeTeamDocument(document: TeamDocument): string {
  return `${JSON.stringify(document, null, 2)}\n`
}

export function saveSession(
  document: TeamDocument,
  input: Pick<TrainingSession, 'id' | 'date' | 'attendances'>,
  updatedBy: string
): TeamDocument {
  const now = new Date().toISOString()
  const existing = document.sessions.find((session) => session.id === input.id)
  const session: TrainingSession = {
    ...input,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    updatedBy
  }

  const sessions = existing
    ? document.sessions.map((candidate) => (candidate.id === session.id ? session : candidate))
    : [...document.sessions, session]

  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: now,
    updatedBy,
    sessions: sessions.sort((a, b) => a.date.localeCompare(b.date))
  }
}

export function deleteSession(
  document: TeamDocument,
  sessionId: string,
  updatedBy: string
): TeamDocument {
  const now = new Date().toISOString()
  return {
    ...document,
    revision: document.revision + 1,
    updatedAt: now,
    updatedBy,
    sessions: document.sessions.filter((session) => session.id !== sessionId)
  }
}

export function mergeDocuments(local: TeamDocument, remote: TeamDocument): TeamDocument {
  if (local.teamId !== remote.teamId) {
    throw new Error('Il file remoto appartiene a una squadra diversa.')
  }

  const sessions = new Map<string, TrainingSession>()
  for (const session of remote.sessions) sessions.set(session.id, session)
  for (const session of local.sessions) {
    const remoteSession = sessions.get(session.id)
    if (!remoteSession || session.updatedAt > remoteSession.updatedAt) {
      sessions.set(session.id, session)
    }
  }

  const sessionsByDate = new Map<string, TrainingSession>()
  for (const session of sessions.values()) {
    const sameDate = sessionsByDate.get(session.date)
    if (!sameDate || session.updatedAt > sameDate.updatedAt) {
      sessionsByDate.set(session.date, session)
    }
  }

  const newerDocument = local.updatedAt >= remote.updatedAt ? local : remote
  return {
    ...newerDocument,
    revision: Math.max(local.revision, remote.revision) + 1,
    updatedAt: new Date().toISOString(),
    sessions: [...sessionsByDate.values()].sort((a, b) => a.date.localeCompare(b.date))
  }
}

export function totalsForDocument(document: TeamDocument): TeamTotals {
  const byStatus = Object.fromEntries(document.statuses.map((status) => [status.id, 0]))
  for (const session of document.sessions) {
    for (const statusId of Object.values(session.attendances)) {
      byStatus[statusId] = (byStatus[statusId] ?? 0) + 1
    }
  }
  return { sessions: document.sessions.length, byStatus }
}

export function athleteTotals(
  document: TeamDocument,
  athleteId: string,
  sessions = document.sessions
): Record<string, number> {
  const totals = Object.fromEntries(document.statuses.map((status) => [status.id, 0]))
  for (const session of sessions) {
    const statusId = session.attendances[athleteId]
    if (statusId) totals[statusId] = (totals[statusId] ?? 0) + 1
  }
  return totals
}

export function sessionsInMonth(
  document: TeamDocument,
  year: number,
  monthIndex: number
): TrainingSession[] {
  const prefix = `${year}-${String(monthIndex + 1).padStart(2, '0')}-`
  return document.sessions.filter((session) => session.date.startsWith(prefix))
}

export function athletesForReport(document: TeamDocument): Athlete[] {
  return [...document.athletes].sort(compareAthletesByName)
}

export function compareAthletesByName(a: Athlete, b: Athlete): number {
  return a.name.localeCompare(b.name, 'it-IT', { sensitivity: 'base' }) ||
    a.id.localeCompare(b.id)
}

export function completedAttendancesForAthletes(
  session: TrainingSession,
  athletes: Athlete[]
): number {
  const athleteIds = new Set(athletes.map((athlete) => athlete.id))
  return Object.keys(session.attendances).filter((athleteId) => athleteIds.has(athleteId)).length
}
