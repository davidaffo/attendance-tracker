import type { LocalSyncMeta, SyncConfig } from './types'

export function configForLocalStorage(config: SyncConfig): SyncConfig {
  return { ...config, appPassword: '' }
}

export function metaForRestoredBackup(): LocalSyncMeta {
  return {
    dirty: true,
    restorePending: true
  }
}

export function metaForManualSync(meta: LocalSyncMeta): LocalSyncMeta {
  const {
    restorePending: _restorePending,
    etag: _etag,
    lastSyncedAt: _lastSyncedAt,
    lastError: _lastError,
    ...current
  } = meta
  return {
    ...current,
    dirty: true
  }
}
