import { COACH_ONBOARDING_VERSION } from '../domain/defaults'
import {
  loadCoordinatorTeamCache,
  loadCoachDocumentOrigin,
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
  const [storedDocument, storedTeamCache, storedOrigin] = await Promise.all([
    loadDocument(),
    loadCoordinatorTeamCache(),
    loadCoachDocumentOrigin()
  ])
  const writes: Promise<void>[] = []

  if (!storedDocument) {
    writes.push(
      storeDocument(developmentCoachDocument()),
      storeSyncMeta({ dirty: false }),
      storeCoachOnboardingVersion(COACH_ONBOARDING_VERSION),
      storeCoachDocumentOrigin('development-demo')
    )
  } else if (
    storedOrigin === 'self-managed' &&
    developmentTeamSummaries().some(
      (team) => team.document.teamId === storedDocument.teamId
    )
  ) {
    writes.push(storeCoachDocumentOrigin('development-demo'))
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
