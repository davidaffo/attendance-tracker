import type { LocalSyncMeta, SyncConfig } from './types'

export interface NextcloudResourceDetails {
  baseUrl: string
  remoteFolder: string
}

export function detailsFromNextcloudLink(value: string): NextcloudResourceDetails {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Il link Nextcloud non è valido.')
  }

  const filesAppMarker = '/apps/files'
  const markerIndex = url.pathname.indexOf(filesAppMarker)
  const internalFileMatch = url.pathname.match(
    /^(.*?)(?:\/index\.php)?\/f\/\d+\/?$/
  )
  if (/\/(?:index\.php\/)?s\/[^/]+\/?$/.test(url.pathname)) {
    throw new Error(
      'Il link pubblico non identifica il file WebDAV. Accedi a Nextcloud, apri il file nell’app File e copia quel link.'
    )
  }
  const directory = url.searchParams.get('dir')
  const segments = (directory ?? '').split('/').filter(Boolean)
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Il percorso della cartella Nextcloud non è valido.')
  }

  const davMarkerIndex = url.pathname.indexOf('/remote.php/dav')
  const rawInstallationPath =
    markerIndex >= 0
      ? url.pathname.slice(0, markerIndex)
      : davMarkerIndex >= 0
        ? url.pathname.slice(0, davMarkerIndex)
        : internalFileMatch
          ? internalFileMatch[1]
          : url.pathname === '/' || url.pathname === '/index.php'
            ? ''
            : url.pathname
  const installationPath = rawInstallationPath
    .replace(/\/index\.php$/, '')
    .replace(/\/+$/, '')

  return {
    baseUrl: `${url.origin}${installationPath}`,
    remoteFolder: segments.join('/')
  }
}

export const detailsFromNextcloudFolderLink = detailsFromNextcloudLink

export function nextcloudLinkFromRouteHash(hash: string): string | undefined {
  const queryIndex = hash.indexOf('?')
  if (queryIndex < 0) return undefined
  const value = new URLSearchParams(hash.slice(queryIndex + 1)).get('nextcloud')?.trim()
  return value || undefined
}

export function nextcloudQuickAccessUrl(
  appBaseUrl: string,
  nextcloudBaseUrl: string
): string {
  const appUrl = new URL(appBaseUrl)
  appUrl.search = ''
  appUrl.hash = ''
  const query = new URLSearchParams({ nextcloud: nextcloudBaseUrl.trim() })
  return `${appUrl.toString()}#/coordinatore?${query.toString()}`
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
