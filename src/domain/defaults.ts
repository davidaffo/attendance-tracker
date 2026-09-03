import type { AttendanceStatus, TeamDocument } from './types'
import { formatAthleteName } from './athleteList'
import { ATTENDANCE_SCHEMA_VERSION } from './types'

export const COACH_ONBOARDING_VERSION = 1

export function isFirstCoachUse(
  storedVersion: number | undefined,
  hasDocument: boolean
): boolean {
  return !hasDocument && storedVersion !== COACH_ONBOARDING_VERSION
}

export const DEFAULT_STATUSES: AttendanceStatus[] = [
  { id: 'present', code: 'P', label: 'Presente', color: '#2f7d68' },
  { id: 'absent', code: 'A', label: 'Assente', color: '#c94f46' },
  { id: 'late', code: 'R', label: 'Ritardo', color: '#d99835' },
  { id: 'volley', code: 'E', label: 'Impegno pallavolistico', color: '#4d70b7' },
  { id: 'injured', code: 'I', label: 'Infortunio', color: '#7f5aa2' }
]

export const WEEKDAYS = [
  { value: 1, short: 'Lun', label: 'Lunedì' },
  { value: 2, short: 'Mar', label: 'Martedì' },
  { value: 3, short: 'Mer', label: 'Mercoledì' },
  { value: 4, short: 'Gio', label: 'Giovedì' },
  { value: 5, short: 'Ven', label: 'Venerdì' },
  { value: 6, short: 'Sab', label: 'Sabato' },
  { value: 0, short: 'Dom', label: 'Domenica' }
] as const

export function getCurrentSeason(now = new Date()): { startYear: number; endYear: number } {
  const startYear = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return { startYear, endYear: startYear + 1 }
}

export function defaultTrainingPeriod(
  startYear: number
): { startDate: string; endDate: string } {
  const lastDayOfAugust = new Date(Date.UTC(startYear, 7, 31))
  const daysSinceSunday = lastDayOfAugust.getUTCDay()
  const lastSundayOfAugust = new Date(lastDayOfAugust)
  lastSundayOfAugust.setUTCDate(lastDayOfAugust.getUTCDate() - daysSinceSunday)
  const firstDayOfLastFullWeek = new Date(lastSundayOfAugust)
  firstDayOfLastFullWeek.setUTCDate(lastSundayOfAugust.getUTCDate() - 6)

  return {
    startDate: firstDayOfLastFullWeek.toISOString().slice(0, 10),
    endDate: `${startYear + 1}-06-30`
  }
}

export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function createTeamDocument(input: {
  teamName: string
  organizationName: string
  coachName: string
  startYear: number
  weekdays?: number[]
  trainingStartDate?: string
  trainingEndDate?: string
  athleteNames: string[]
}): TeamDocument {
  const now = new Date().toISOString()
  const teamId = slugify(input.teamName) || crypto.randomUUID()

  return {
    schemaVersion: ATTENDANCE_SCHEMA_VERSION,
    teamId,
    teamName: input.teamName.trim(),
    organizationName: input.organizationName.trim(),
    coachName: input.coachName.trim(),
    season: { startYear: input.startYear, endYear: input.startYear + 1 },
    revision: 1,
    updatedAt: now,
    updatedBy: input.coachName.trim(),
    statuses: DEFAULT_STATUSES.map((status) => ({ ...status })),
    trainingWeekdays: [...(input.weekdays ?? [])].sort(),
    ...(input.trainingStartDate ? { trainingStartDate: input.trainingStartDate } : {}),
    ...(input.trainingEndDate ? { trainingEndDate: input.trainingEndDate } : {}),
    ignoredTrainingDates: [],
    athletes: input.athleteNames
      .map(formatAthleteName)
      .filter(Boolean)
      .map((name, order) => ({
        id: crypto.randomUUID(),
        name,
        order,
        active: true,
        createdAt: now
      })),
    sessions: []
  }
}

export function remoteFileName(document: TeamDocument): string {
  return `${document.teamId}__${document.season.startYear}-${document.season.endYear}.attendance.json`
}
