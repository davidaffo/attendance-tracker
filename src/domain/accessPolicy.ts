import type {
  AppMode,
  CoachDocumentOrigin,
  SyncConfig,
  TeamDocument
} from './types'

export function allowsCoachBackgroundSync(
  origin: CoachDocumentOrigin | undefined
): boolean {
  return origin !== 'coordinator-managed'
}

export function hasStoredSetupForMode(
  mode: AppMode | undefined,
  setup: {
    coachDocument?: TeamDocument
    coachConfig?: SyncConfig
    coordinatorConfig?: SyncConfig
    viewerConfig?: SyncConfig
  }
): boolean {
  if (mode === 'coach') return Boolean(setup.coachDocument || setup.coachConfig)
  if (mode === 'coordinator') return Boolean(setup.coordinatorConfig)
  if (mode === 'viewer') return Boolean(setup.viewerConfig)
  return false
}
