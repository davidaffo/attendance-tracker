import { openDB, type DBSchema } from 'idb'
import type { AppMode, LocalSyncMeta, SyncConfig, TeamDocument } from '../domain/types'

interface AttendanceDatabase extends DBSchema {
  state: {
    key: 'document' | 'sync-config' | 'sync-meta' | 'app-mode'
    value: TeamDocument | SyncConfig | LocalSyncMeta | AppMode
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
  return (await database).get('state', 'sync-config') as Promise<SyncConfig | undefined>
}

export async function storeSyncConfig(config: SyncConfig): Promise<void> {
  await (await database).put('state', config, 'sync-config')
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

export async function clearLocalData(): Promise<void> {
  await (await database).clear('state')
}
