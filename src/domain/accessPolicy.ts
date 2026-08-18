import type {
  AppMode,
  CoachDocumentOrigin,
  SyncConfig,
  TeamDocument
} from './types'

export function allowsCoachBackgroundSync(
  origin: CoachDocumentOrigin | undefined
): boolean {
  // Anche i registri condivisi devono rileggere il remoto all'apertura:
  // l'ETag e il merge proteggono le modifiche locali pendenti.
  return origin === 'self-managed' || origin === 'coordinator-managed' || origin === undefined
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
