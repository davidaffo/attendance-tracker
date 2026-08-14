import { remoteFileName } from '../domain/defaults'
import type { SyncConfig, TeamDocument } from '../domain/types'
import { nextcloudAuthorization, normalizeNextcloudBaseUrl } from './nextcloud'

export const NEXTCLOUD_SHARE_TYPE_USER = 0
export const NEXTCLOUD_SHARE_TYPE_GROUP = 1
export const NEXTCLOUD_PERMISSION_READ = 1
export const NEXTCLOUD_PERMISSION_UPDATE = 2
export const NEXTCLOUD_PERMISSIONS_VIEWER = NEXTCLOUD_PERMISSION_READ
export const NEXTCLOUD_PERMISSIONS_EDITOR =
  NEXTCLOUD_PERMISSION_READ | NEXTCLOUD_PERMISSION_UPDATE

export interface NextcloudShare {
  id: string
  shareType: number
  shareWith: string
  displayName: string
  permissions: number
  owner?: string
  canEdit: boolean
  canDelete: boolean
}

export interface NextcloudSharee {
  shareType: typeof NEXTCLOUD_SHARE_TYPE_USER | typeof NEXTCLOUD_SHARE_TYPE_GROUP
  shareWith: string
  displayName: string
}

interface OcsMeta {
  status?: string
  statuscode?: number | string
  message?: string
}

interface OcsEnvelope<T> {
  ocs?: {
    meta?: OcsMeta
    data?: T
  }
}

interface RawShare {
  id?: number | string
  share_type?: number | string
  share_with?: string
  share_with_displayname?: string
  permissions?: number | string
  uid_owner?: string
  can_edit?: boolean | number | string
  can_delete?: boolean | number | string
}

function sharingApiUrl(config: SyncConfig, shareId?: string): string {
  const suffix = shareId ? `/${encodeURIComponent(shareId)}` : ''
  return `${normalizeNextcloudBaseUrl(config.baseUrl)}/index.php/apps/webapppassword/api/v1/shares${suffix}`
}

function sharingHeaders(config: SyncConfig, extra?: HeadersInit): Headers {
  return new Headers({
    Authorization: nextcloudAuthorization(config),
    'OCS-APIRequest': 'true',
    Accept: 'application/json',
    ...extra
  })
}

function responseError(status: number): Error {
  if (status === 401) return new Error('Credenziali Nextcloud non valide.')
  if (status === 403) {
    return new Error('Questo account non ha il permesso di condividere il registro.')
  }
  if (status === 404) {
    return new Error('Il registro o l’API delle condivisioni non è disponibile.')
  }
  return new Error(`Nextcloud ha rifiutato la gestione delle condivisioni (${status}).`)
}

async function ocsFetch<T>(
  config: SyncConfig,
  url: string,
  init: RequestInit = {},
  dataOptional = false
): Promise<T> {
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: sharingHeaders(config, init.headers),
      mode: 'cors',
      cache: 'no-store'
    })
  } catch {
    if (init.method === 'DELETE' || init.method === 'PUT') {
      throw new Error(
        'WebAppPassword non autorizza dal browser le operazioni sulla singola condivisione. Manca la route CORS OPTIONS /api/v1/shares/{id}.'
      )
    }
    throw new Error(
      'L’API delle condivisioni di WebAppPassword non è raggiungibile dal browser. Verifica che l’origine della PWA sia autorizzata anche nella sezione Files sharing API.'
    )
  }

  if (!response.ok) throw responseError(response.status)

  const responseBody = await response.text()
  if (!responseBody.trim()) {
    if (dataOptional) return undefined as T
    throw new Error(
      'Nextcloud non ha restituito una risposta OCS valida per le condivisioni.'
    )
  }

  let envelope: OcsEnvelope<T>
  try {
    envelope = JSON.parse(responseBody) as OcsEnvelope<T>
  } catch {
    throw new Error(
      'Nextcloud non ha restituito una risposta OCS valida per le condivisioni.'
    )
  }

  const meta = envelope.ocs?.meta
  const statusCode = Number(meta?.statuscode ?? response.status)
  if (meta?.status === 'failure' || statusCode >= 400) {
    if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
      throw responseError(statusCode)
    }
    throw new Error(
      meta?.message?.trim() ||
        `Nextcloud ha rifiutato la gestione delle condivisioni (${statusCode}).`
    )
  }
  if (envelope.ocs?.data === undefined) {
    if (dataOptional) return undefined as T
    throw new Error('La risposta OCS di Nextcloud non contiene i dati richiesti.')
  }
  return envelope.ocs.data
}

export function nextcloudDocumentPath(
  config: SyncConfig,
  document: TeamDocument
): string {
  const folder = config.remoteFolder.trim().replace(/^\/+|\/+$/g, '')
  return `/${[folder, remoteFileName(document)].filter(Boolean).join('/')}`
}

export function nextcloudDocumentFolderUrl(config: SyncConfig): string {
  const url = new URL(
    `${normalizeNextcloudBaseUrl(config.baseUrl)}/index.php/apps/files/files`
  )
  const folder = config.remoteFolder.trim().replace(/^\/+|\/+$/g, '')
  url.searchParams.set('dir', folder ? `/${folder}` : '/')
  return url.toString()
}

function nextcloudBoolean(value: boolean | number | string | undefined): boolean | undefined {
  if (value === undefined) return undefined
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  return value === '1' || value.toLocaleLowerCase() === 'true'
}

function parseShare(raw: RawShare, currentUser: string): NextcloudShare | undefined {
  if (raw.id === undefined) return undefined
  const shareType = Number(raw.share_type)
  const shareWith = raw.share_with?.trim() ?? ''
  const displayName = raw.share_with_displayname?.trim() || shareWith
  const owner = raw.uid_owner?.trim()
  const isUserOrGroup =
    shareType === NEXTCLOUD_SHARE_TYPE_USER || shareType === NEXTCLOUD_SHARE_TYPE_GROUP
  const legacyOwnerMatch =
    !owner || owner.toLocaleLowerCase() === currentUser.trim().toLocaleLowerCase()
  return {
    id: String(raw.id),
    shareType,
    shareWith,
    displayName: displayName || 'Condivisione senza nome',
    permissions: Number(raw.permissions ?? 0),
    ...(owner ? { owner } : {}),
    canEdit: nextcloudBoolean(raw.can_edit) ?? (isUserOrGroup && legacyOwnerMatch),
    canDelete: nextcloudBoolean(raw.can_delete) ?? legacyOwnerMatch
  }
}

export async function listNextcloudShares(
  config: SyncConfig,
  document: TeamDocument
): Promise<NextcloudShare[]> {
  const query = new URLSearchParams({
    path: nextcloudDocumentPath(config, document),
    reshares: 'true',
    format: 'json'
  })
  const data = await ocsFetch<RawShare[]>(
    config,
    `${sharingApiUrl(config)}?${query.toString()}`
  )
  return (Array.isArray(data) ? data : [])
    .map((share) => parseShare(share, config.username))
    .filter((share): share is NextcloudShare => Boolean(share))
}

export async function createNextcloudShare(
  config: SyncConfig,
  document: TeamDocument,
  sharee: NextcloudSharee,
  permissions: number
): Promise<NextcloudShare> {
  const body = new URLSearchParams({
    path: nextcloudDocumentPath(config, document),
    shareType: String(sharee.shareType),
    shareWith: sharee.shareWith,
    permissions: String(permissions)
  })
  const data = await ocsFetch<RawShare>(config, `${sharingApiUrl(config)}?format=json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body
  })
  const share = parseShare(data, config.username)
  if (!share) throw new Error('Nextcloud ha creato una condivisione non riconoscibile.')
  return share
}

export async function updateNextcloudSharePermissions(
  config: SyncConfig,
  shareId: string,
  permissions: number
): Promise<void> {
  await ocsFetch<unknown>(
    config,
    `${sharingApiUrl(config, shareId)}?format=json`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ permissions: String(permissions) })
    },
    true
  )
}

export async function deleteNextcloudShare(
  config: SyncConfig,
  shareId: string
): Promise<void> {
  await ocsFetch<unknown>(
    config,
    `${sharingApiUrl(config, shareId)}?format=json`,
    { method: 'DELETE' },
    true
  )
}
