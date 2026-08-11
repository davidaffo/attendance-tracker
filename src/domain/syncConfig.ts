import type { LocalSyncMeta, SyncConfig } from './types'

export interface NextcloudFolderDetails {
  baseUrl: string
  remoteFolder: string
}

export function detailsFromNextcloudFolderLink(value: string): NextcloudFolderDetails {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Il link della cartella Nextcloud non è valido.')
  }

  const filesAppMarker = '/apps/files/'
  const markerIndex = url.pathname.indexOf(filesAppMarker)
  const directory = url.searchParams.get('dir')
  if (markerIndex < 0 || !directory) {
    throw new Error('Incolla il link aperto dalla cartella nell’app File di Nextcloud.')
  }

  const segments = directory.split('/').filter(Boolean)
  if (!segments.length || segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Il percorso della cartella Nextcloud non è valido.')
  }

  const installationPath = url.pathname
    .slice(0, markerIndex)
    .replace(/\/index\.php$/, '')
    .replace(/\/+$/, '')

  return {
    baseUrl: `${url.origin}${installationPath}`,
    remoteFolder: segments.join('/')
  }
}

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
