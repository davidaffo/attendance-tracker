import { openDB, type DBSchema } from 'idb'
import { configForLocalStorage } from '../domain/syncConfig'
import type {
  AppMode,
  CoordinatorTeamCache,
  LocalSyncMeta,
  SyncConfig,
  TeamDocument
} from '../domain/types'

interface AttendanceDatabase extends DBSchema {
  state: {
    key:
      | 'document'
      | 'sync-config'
      | 'coordinator-sync-config'
      | 'coordinator-directory-handle'
      | 'coordinator-team-cache'
      | 'coach-onboarding-version'
      | 'coach-credential'
      | 'coordinator-credential'
      | 'sync-meta'
      | 'app-mode'
    value:
      | TeamDocument
      | SyncConfig
      | LocalSyncMeta
      | AppMode
      | number
      | CoordinatorTeamCache
      | FileSystemDirectoryHandle
  }
}

const database = openDB<AttendanceDatabase>('registro-presenze', 1, {
  upgrade(db) {
    db.createObjectStore('state')
  }
})

export async function loadDocument(): Promise<TeamDocument | undefined> {
  return (await database).get('state', 'document') as Promise<TeamDocument | undefined>
}

export async function storeDocument(document: TeamDocument): Promise<void> {
  await (await database).put('state', document, 'document')
}

export async function removeDocument(): Promise<void> {
  await (await database).delete('state', 'document')
}

export async function loadSyncConfig(): Promise<SyncConfig | undefined> {
  const db = await database
  const config = (await db.get('state', 'sync-config')) as SyncConfig | undefined
  if (config?.appPassword) {
    await db.put('state', configForLocalStorage(config), 'sync-config')
  }
  return config
}

export async function storeSyncConfig(config: SyncConfig): Promise<void> {
  await (await database).put('state', configForLocalStorage(config), 'sync-config')
}

export async function loadCoordinatorSyncConfig(): Promise<SyncConfig | undefined> {
  const db = await database
  const config = (await db.get('state', 'coordinator-sync-config')) as
    | SyncConfig
    | undefined
  if (config?.appPassword) {
    await db.put('state', configForLocalStorage(config), 'coordinator-sync-config')
  }
  return config
}

export async function storeCoordinatorSyncConfig(config: SyncConfig): Promise<void> {
  await (await database).put(
    'state',
    configForLocalStorage(config),
    'coordinator-sync-config'
  )
}

export async function loadCoordinatorDirectoryHandle(): Promise<
  FileSystemDirectoryHandle | undefined
> {
  return (await database).get('state', 'coordinator-directory-handle') as Promise<
    FileSystemDirectoryHandle | undefined
  >
}

export async function storeCoordinatorDirectoryHandle(
  handle: FileSystemDirectoryHandle
): Promise<void> {
  await (await database).put('state', handle, 'coordinator-directory-handle')
}

export async function loadCoordinatorTeamCache(): Promise<
  CoordinatorTeamCache | undefined
> {
  return (await database).get('state', 'coordinator-team-cache') as Promise<
    CoordinatorTeamCache | undefined
  >
}

export async function storeCoordinatorTeamCache(
  cache: CoordinatorTeamCache
): Promise<void> {
  await (await database).put('state', cache, 'coordinator-team-cache')
}

export async function removeLegacyEncryptedCredentials(): Promise<void> {
  const db = await database
  await Promise.all([
    db.delete('state', 'coach-credential'),
    db.delete('state', 'coordinator-credential')
  ])
}

export async function removeSyncConfig(): Promise<void> {
  await (await database).delete('state', 'sync-config')
}

export async function loadSyncMeta(): Promise<LocalSyncMeta> {
  return (
    ((await database).get('state', 'sync-meta') as Promise<LocalSyncMeta | undefined>)
  ).then((meta) => meta ?? { dirty: false })
}

export async function storeSyncMeta(meta: LocalSyncMeta): Promise<void> {
  await (await database).put('state', meta, 'sync-meta')
}

export async function loadAppMode(): Promise<AppMode | undefined> {
  return (await database).get('state', 'app-mode') as Promise<AppMode | undefined>
}

export async function storeAppMode(mode: AppMode): Promise<void> {
  await (await database).put('state', mode, 'app-mode')
}

export async function loadCoachOnboardingVersion(): Promise<number | undefined> {
  return (await database).get('state', 'coach-onboarding-version') as Promise<
    number | undefined
  >
}

export async function storeCoachOnboardingVersion(version: number): Promise<void> {
  await (await database).put('state', version, 'coach-onboarding-version')
}

export async function clearLocalData(): Promise<void> {
  await (await database).clear('state')
}
