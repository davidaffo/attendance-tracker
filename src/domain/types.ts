export const ATTENDANCE_SCHEMA_VERSION = 1 as const

export type SyncIndicator =
  | 'local'
  | 'syncing'
  | 'synced'
  | 'pending'
  | 'conflict'
  | 'error'

export type AppMode = 'coach' | 'coordinator'

export interface AttendanceStatus {
  id: string
  code: string
  label: string
  color: string
}

export interface Athlete {
  id: string
  name: string
  order: number
  active: boolean
  createdAt: string
  archivedAt?: string
}

export interface TrainingSession {
  id: string
  date: string
  attendances: Record<string, string>
  createdAt: string
  updatedAt: string
  updatedBy?: string
}

export interface Season {
  startYear: number
  endYear: number
}

export interface TeamDocument {
  schemaVersion: typeof ATTENDANCE_SCHEMA_VERSION
  teamId: string
  teamName: string
  organizationName: string
  coachName: string
  season: Season
  revision: number
  updatedAt: string
  updatedBy: string
  statuses: AttendanceStatus[]
  trainingWeekdays: number[]
  athletes: Athlete[]
  sessions: TrainingSession[]
}

export interface SyncConfig {
  baseUrl: string
  username: string
  appPassword: string
  remoteFolder: string
  folderLink?: string
}

export interface LocalSyncMeta {
  dirty: boolean
  etag?: string
  lastSyncedAt?: string
  lastError?: string
  restorePending?: boolean
  conditionalWrites?: boolean
}

export interface TeamSummary {
  source: string
  document: TeamDocument
}

export interface CoordinatorTeamCache {
  teams: TeamSummary[]
  loadedAt: string
  source: 'nextcloud' | 'directory' | 'files'
  sourceLabel: string
  connectionKey?: string
}

export interface TeamTotals {
  sessions: number
  byStatus: Record<string, number>
}
