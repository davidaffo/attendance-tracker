import { COACH_ONBOARDING_VERSION } from '../domain/defaults'
import {
  loadCoordinatorTeamCache,
  loadDocument,
  storeCoachDocumentOrigin,
  storeCoachOnboardingVersion,
  storeCoordinatorTeamCache,
  storeDocument,
  storeSyncMeta
} from '../storage/database'
import {
  developmentCoachDocument,
  developmentTeamSummaries
} from './developmentData'

export async function seedDevelopmentData(): Promise<void> {
  const [storedDocument, storedTeamCache] = await Promise.all([
    loadDocument(),
    loadCoordinatorTeamCache()
  ])
  const writes: Promise<void>[] = []

  if (!storedDocument) {
    writes.push(
      storeDocument(developmentCoachDocument()),
      storeSyncMeta({ dirty: false }),
      storeCoachOnboardingVersion(COACH_ONBOARDING_VERSION),
      storeCoachDocumentOrigin('self-managed')
    )
  }

  if (!storedTeamCache) {
    writes.push(
      storeCoordinatorTeamCache({
        teams: developmentTeamSummaries(),
        loadedAt: new Date().toISOString(),
        source: 'files',
        sourceLabel: 'registri demo di sviluppo',
        owner: 'coordinator'
      })
    )
  }

  await Promise.all(writes)
}
