import { mergeDocuments, parseTeamDocument, serializeTeamDocument } from '../domain/document'
import { remoteFileName } from '../domain/defaults'
import type {
  LocalSyncMeta,
  SyncConfig,
  TeamDocument,
  TeamSummary
} from '../domain/types'

interface RemoteFile {
  document?: TeamDocument
  etag?: string
  exists: boolean
}

export interface SyncResult {
  document: TeamDocument
  meta: LocalSyncMeta
  merged: boolean
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  const url = new URL(trimmed)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('L’indirizzo Nextcloud deve usare HTTPS.')
  }
  return url.toString().replace(/\/$/, '')
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
}

function basicAuthorization(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `Basic ${btoa(binary)}`
}

function folderUrl(config: SyncConfig): string {
  const root = filesRootUrl(config)
  const folder = encodePath(config.remoteFolder)
  return folder ? `${root}/${folder}` : root
}

function davRootUrl(config: SyncConfig): string {
  return `${normalizeBaseUrl(config.baseUrl)}/remote.php/dav`
}

function filesRootUrl(config: SyncConfig): string {
  return `${davRootUrl(config)}/files/${encodeURIComponent(config.username)}`
}

export function documentUrl(config: SyncConfig, document: TeamDocument): string {
  return `${folderUrl(config)}/${encodeURIComponent(remoteFileName(document))}`
}

function headers(config: SyncConfig, extra?: HeadersInit): Headers {
  return new Headers({
    Authorization: basicAuthorization(config.username, config.appPassword),
    'X-Requested-With': 'XMLHttpRequest',
    ...extra
  })
}

async function davFetch(
  config: SyncConfig,
  url: string,
  init: RequestInit
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      headers: headers(config, init.headers),
      mode: 'cors',
      cache: 'no-store'
    })
  } catch {
    throw new Error(
      'Nextcloud non è raggiungibile. Controlla la connessione e l’autorizzazione CORS di WebAppPassword.'
    )
  }
}

export function normalizeEtag(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const normalized = value
    .trim()
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&apos;|&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .trim()
  return normalized || undefined
}

function extractEtag(xml: string): string | undefined {
  const match = xml.match(
    /<(?:[\w-]+:)?getetag[^>]*>([^<]+)<\/(?:[\w-]+:)?getetag>/i
  )
  return normalizeEtag(match?.[1])
}

function documentsAreEqual(first: TeamDocument, second: TeamDocument): boolean {
  return serializeTeamDocument(first) === serializeTeamDocument(second)
}

function syncedMeta(
  etag: string | undefined,
  conditionalWrites: boolean | undefined
): LocalSyncMeta {
  return {
    dirty: false,
    etag,
    lastSyncedAt: new Date().toISOString(),
    ...(conditionalWrites === false ? { conditionalWrites: false } : {})
  }
}

export async function testWebDavConnection(config: SyncConfig): Promise<void> {
  const response = await davFetch(config, folderUrl(config), {
    method: 'PROPFIND',
    headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
    body:
      '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error('Credenziali non valide o cartella non autorizzata.')
  }
  if (response.status === 404) {
    throw new Error('La cartella remota non esiste.')
  }
  if (response.status !== 207 && !response.ok) {
    throw new Error(`Nextcloud ha risposto con errore ${response.status}.`)
  }
}

export async function listRemoteTeamDocuments(config: SyncConfig): Promise<TeamSummary[]> {
  await testWebDavConnection(config)
  const response = await davFetch(config, folderUrl(config), {
    method: 'PROPFIND',
    headers: { Depth: '1', 'Content-Type': 'application/xml; charset=utf-8' },
    body:
      '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getcontenttype/><d:getetag/></d:prop></d:propfind>'
  })

  if (response.status !== 207 && !response.ok) {
    throw new Error(`Impossibile leggere la cartella remota (${response.status}).`)
  }

  return teamDocumentsFromDavResponse(config, response)
}

async function teamDocumentsFromDavResponse(
  config: SyncConfig,
  response: Response
): Promise<TeamSummary[]> {
  const xml = new DOMParser().parseFromString(await response.text(), 'application/xml')
  const entries = [...xml.getElementsByTagNameNS('DAV:', 'response')]
  const fileUrls = entries
    .map((entry) => entry.getElementsByTagNameNS('DAV:', 'href')[0]?.textContent?.trim())
    .filter((href): href is string => Boolean(href))
    .filter((href) => {
      try {
        return decodeURIComponent(new URL(href, config.baseUrl).pathname).endsWith(
          '.attendance.json'
        )
      } catch {
        return false
      }
    })
    .map((href) => new URL(href, config.baseUrl).toString())

  const documents = await Promise.all(
    fileUrls.map(async (url): Promise<TeamSummary | undefined> => {
      const file = await davFetch(config, url, { method: 'GET' })
      if (!file.ok) return undefined
      try {
        return {
          source: decodeURIComponent(new URL(url).pathname.split('/').pop() ?? url),
          document: parseTeamDocument(await file.text())
        }
      } catch {
        return undefined
      }
    })
  )

  return documents
    .filter((entry): entry is TeamSummary => Boolean(entry))
    .sort((a, b) => a.document.teamName.localeCompare(b.document.teamName))
}

export async function discoverRemoteTeamDocuments(
  config: SyncConfig
): Promise<TeamSummary[]> {
  if (config.remoteFolder) return listRemoteTeamDocuments(config)

  const scope = `/files/${encodeURIComponent(config.username)}`
  const response = await davFetch(config, davRootUrl(config), {
    method: 'SEARCH',
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    body: `<?xml version="1.0" encoding="UTF-8"?>
      <d:searchrequest xmlns:d="DAV:">
        <d:basicsearch>
          <d:select>
            <d:prop>
              <d:displayname/>
              <d:getcontenttype/>
              <d:getetag/>
            </d:prop>
          </d:select>
          <d:from>
            <d:scope>
              <d:href>${scope}</d:href>
              <d:depth>infinity</d:depth>
            </d:scope>
          </d:from>
          <d:where>
            <d:like>
              <d:prop><d:displayname/></d:prop>
              <d:literal>%.attendance.json</d:literal>
            </d:like>
          </d:where>
          <d:orderby/>
        </d:basicsearch>
      </d:searchrequest>`
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error('Credenziali non valide o account non autorizzato.')
  }
  if (response.status === 405 || response.status === 501) {
    return listRemoteTeamDocuments(config)
  }
  if (response.status !== 207 && !response.ok) {
    throw new Error(`Impossibile cercare i registri su Nextcloud (${response.status}).`)
  }

  return teamDocumentsFromDavResponse(config, response)
}

async function readRemote(config: SyncConfig, local: TeamDocument): Promise<RemoteFile> {
  const url = documentUrl(config, local)
  const properties = await davFetch(config, url, {
    method: 'PROPFIND',
    headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
    body:
      '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>'
  })

  if (properties.status === 404) return { exists: false }
  if (properties.status === 401 || properties.status === 403) {
    throw new Error('L’account non può leggere il file della squadra.')
  }
  if (properties.status !== 207 && !properties.ok) {
    throw new Error(`Impossibile controllare il file remoto (${properties.status}).`)
  }

  const etag = extractEtag(await properties.text())
  const response = await davFetch(config, url, { method: 'GET' })
  if (!response.ok) {
    throw new Error(`Impossibile scaricare il file remoto (${response.status}).`)
  }
  return {
    exists: true,
    etag: normalizeEtag(response.headers.get('etag')) ?? etag,
    document: parseTeamDocument(await response.text())
  }
}

async function writeRemote(
  config: SyncConfig,
  document: TeamDocument,
  expectedEtag?: string,
  createOnly = false
): Promise<string | undefined> {
  const conditionalHeaders: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8'
  }
  const normalizedExpectedEtag = normalizeEtag(expectedEtag)
  if (normalizedExpectedEtag) conditionalHeaders['If-Match'] = normalizedExpectedEtag
  if (createOnly) conditionalHeaders['If-None-Match'] = '*'

  const response = await davFetch(config, documentUrl(config, document), {
    method: 'PUT',
    headers: conditionalHeaders,
    body: serializeTeamDocument(document)
  })

  if (response.status === 412) {
    throw new Error('CONFLICT')
  }
  if (!response.ok) {
    throw new Error(`Impossibile caricare il file remoto (${response.status}).`)
  }
  const responseEtag = normalizeEtag(response.headers.get('etag'))
  if (responseEtag) return responseEtag

  const confirmed = await readRemote(config, document)
  return confirmed.etag
}

async function writeAndVerifyWithoutCondition(
  config: SyncConfig,
  document: TeamDocument
): Promise<RemoteFile> {
  await writeRemote(config, document)
  const confirmed = await readRemote(config, document)
  if (!confirmed.document || !documentsAreEqual(confirmed.document, document)) {
    throw new Error(
      'Conflitto remoto reale: il file è cambiato durante la verifica finale.'
    )
  }
  return confirmed
}

export async function synchronizeDocument(
  local: TeamDocument,
  meta: LocalSyncMeta,
  config: SyncConfig
): Promise<SyncResult> {
  await testWebDavConnection(config)
  let remote = await readRemote(config, local)

  if (!remote.exists) {
    const etag = await writeRemote(config, local, undefined, true)
    return {
      document: local,
      merged: false,
      meta: syncedMeta(etag, meta.conditionalWrites)
    }
  }

  if (!remote.document) throw new Error('Il file remoto è vuoto.')

  if (!meta.dirty) {
    return {
      document: remote.document,
      merged: false,
      meta: syncedMeta(remote.etag, meta.conditionalWrites)
    }
  }

  let document = local
  let merged = false
  const localEtag = normalizeEtag(meta.etag)
  if (localEtag && remote.etag && localEtag !== remote.etag) {
    document = mergeDocuments(local, remote.document)
    merged = true
  }

  if (meta.conditionalWrites === false) {
    const confirmed = await writeAndVerifyWithoutCondition(config, document)
    return {
      document,
      merged,
      meta: syncedMeta(confirmed.etag, false)
    }
  }

  try {
    const etag = await writeRemote(config, document, remote.etag)
    return {
      document,
      merged,
      meta: syncedMeta(etag, meta.conditionalWrites)
    }
  } catch (error) {
    if (error instanceof Error && error.message === 'CONFLICT') {
      remote = await readRemote(config, local)
      if (!remote.document) throw new Error('Conflitto remoto non risolvibile.')
      if (documentsAreEqual(remote.document, document)) {
        return {
          document,
          merged,
          meta: syncedMeta(remote.etag, meta.conditionalWrites)
        }
      }
      document = mergeDocuments(document, remote.document)
      try {
        const etag = await writeRemote(config, document, remote.etag)
        return {
          document,
          merged: true,
          meta: syncedMeta(etag, meta.conditionalWrites)
        }
      } catch (retryError) {
        if (!(retryError instanceof Error) || retryError.message !== 'CONFLICT') {
          throw retryError
        }
        const latest = await readRemote(config, local)
        if (latest.document && documentsAreEqual(latest.document, document)) {
          return {
            document,
            merged: true,
            meta: syncedMeta(latest.etag, meta.conditionalWrites)
          }
        }
        if (!latest.document) {
          throw new Error('Il file remoto è vuoto dopo il conflitto.')
        }
        document = mergeDocuments(document, latest.document)
        const confirmed = await writeAndVerifyWithoutCondition(config, document)
        return {
          document,
          merged: true,
          meta: syncedMeta(confirmed.etag, false)
        }
      }
    }
    throw error
  }
}
