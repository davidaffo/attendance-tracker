import { mergeDocuments, parseTeamDocument, serializeTeamDocument } from '../domain/document'
import { isBackupPath } from '../domain/backup'
import { remoteFileName } from '../domain/defaults'
import type {
  LocalSyncMeta,
  SyncConfig,
  TeamDocument,
  TeamSummary
} from '../domain/types'
import { nextcloudAuthorization, normalizeNextcloudBaseUrl } from './nextcloud'

interface RemoteFile {
  document?: TeamDocument
  etag?: string
  exists: boolean
}

export class RemoteDocumentConflictError extends Error {
  readonly localDocument: TeamDocument
  readonly remoteDocument: TeamDocument

  constructor(localDocument: TeamDocument, remoteDocument: TeamDocument) {
    super('Il registro è stato modificato da un altro utente.')
    this.name = 'RemoteDocumentConflictError'
    this.localDocument = localDocument
    this.remoteDocument = remoteDocument
  }
}

export type ConflictResolution = 'merge' | 'local' | 'remote'

export interface SyncResult {
  document: TeamDocument
  meta: LocalSyncMeta
  merged: boolean
}

function encodePath(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')
}

function folderUrl(config: SyncConfig): string {
  const root = filesRootUrl(config)
  const folder = encodePath(config.remoteFolder)
  return folder ? `${root}/${folder}` : root
}

function davRootUrl(config: SyncConfig): string {
  return `${normalizeNextcloudBaseUrl(config.baseUrl)}/remote.php/dav`
}

function filesRootUrl(config: SyncConfig): string {
  return `${davRootUrl(config)}/files/${encodeURIComponent(config.username)}`
}

export function remoteFolderFromDocumentUrl(
  config: SyncConfig,
  documentUrl: string
): string {
  const resourcePath = remoteResourcePath(config, documentUrl)
  if (!resourcePath) return ''
  const pathSegments = resourcePath.split('/').filter(Boolean)
  pathSegments.pop()
  return pathSegments.join('/')
}

function remoteResourcePath(config: SyncConfig, resourceUrl: string): string | undefined {
  const fileUrl = new URL(resourceUrl, config.baseUrl)
  const rootPath = new URL(filesRootUrl(config)).pathname.replace(/\/+$/, '')
  if (!fileUrl.pathname.startsWith(`${rootPath}/`)) return undefined
  return fileUrl.pathname
    .slice(rootPath.length + 1)
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment))
    .join('/')
}

export function documentUrl(config: SyncConfig, document: TeamDocument): string {
  return `${folderUrl(config)}/${encodeURIComponent(remoteFileName(document))}`
}

function headers(config: SyncConfig, extra?: HeadersInit): Headers {
  return new Headers({
    Authorization: nextcloudAuthorization(config),
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

export async function testNextcloudCredentials(config: SyncConfig): Promise<void> {
  const response = await davFetch(config, filesRootUrl(config), {
    method: 'PROPFIND',
    headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
    body:
      '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error('Password applicativa non valida per questo account Nextcloud.')
  }
  if (response.status !== 207 && !response.ok) {
    throw new Error(`Impossibile verificare le credenziali Nextcloud (${response.status}).`)
  }
}

async function ensureRemoteFolder(config: SyncConfig): Promise<void> {
  const segments = config.remoteFolder.split('/').filter(Boolean)
  if (segments.length === 0) {
    await testWebDavConnection(config)
    return
  }

  let currentUrl = filesRootUrl(config)
  for (const segment of segments) {
    currentUrl = `${currentUrl}/${encodeURIComponent(segment)}`
    const properties = await davFetch(config, currentUrl, {
      method: 'PROPFIND',
      headers: { Depth: '0', 'Content-Type': 'application/xml; charset=utf-8' },
      body:
        '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'
    })
    if (properties.status === 207 || properties.ok) continue
    if (properties.status === 401 || properties.status === 403) {
      throw new Error('Credenziali non valide o cartella non autorizzata.')
    }
    if (properties.status !== 404) {
      throw new Error(`Impossibile controllare la cartella remota (${properties.status}).`)
    }

    const created = await davFetch(config, currentUrl, { method: 'MKCOL' })
    if (!created.ok && created.status !== 405) {
      throw new Error(`Impossibile creare la cartella remota (${created.status}).`)
    }
  }
}

export async function verifyRemoteFolderWritable(config: SyncConfig): Promise<void> {
  await ensureRemoteFolder(config)
  const probeName = `.attendance-write-check-${crypto.randomUUID()}.tmp`
  const probeUrl = `${folderUrl(config)}/${encodeURIComponent(probeName)}`
  const created = await davFetch(config, probeUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'If-None-Match': '*'
    },
    body: 'Verifica permessi Registro Presenze'
  })
  if (created.status === 401 || created.status === 403) {
    throw new Error('L’account non ha il permesso di scrittura sulla cartella.')
  }
  if (!created.ok) {
    throw new Error(`Impossibile verificare la scrittura nella cartella (${created.status}).`)
  }

  const removed = await davFetch(config, probeUrl, { method: 'DELETE' })
  if (!removed.ok && removed.status !== 404) {
    throw new Error(
      `La scrittura funziona, ma il file temporaneo di verifica non può essere rimosso (${removed.status}).`
    )
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
        const path = decodeURIComponent(new URL(href, config.baseUrl).pathname)
        return path.endsWith('.attendance.json') && !isBackupPath(path)
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
        const source = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? url)
        return {
          source,
          remoteFolder: remoteFolderFromDocumentUrl(config, url),
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

export async function discoverAttendanceTrackerFolders(
  config: SyncConfig
): Promise<string[]> {
  const scope = `/files/${encodeURIComponent(config.username)}`
  const response = await davFetch(config, davRootUrl(config), {
    method: 'SEARCH',
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    body: `<?xml version="1.0" encoding="UTF-8"?>
      <d:searchrequest xmlns:d="DAV:">
        <d:basicsearch>
          <d:select>
            <d:prop><d:displayname/><d:resourcetype/></d:prop>
          </d:select>
          <d:from>
            <d:scope><d:href>${scope}</d:href><d:depth>infinity</d:depth></d:scope>
          </d:from>
          <d:where>
            <d:eq>
              <d:prop><d:displayname/></d:prop>
              <d:literal>attendance-tracker</d:literal>
            </d:eq>
          </d:where>
          <d:orderby/>
        </d:basicsearch>
      </d:searchrequest>`
  })

  if (response.status === 401 || response.status === 403) {
    throw new Error('Credenziali non valide o account non autorizzato.')
  }
  if (response.status === 405 || response.status === 501) {
    throw new Error(
      'Questo server non supporta la ricerca delle sottocartelle. Incolla il link diretto alla cartella attendance-tracker.'
    )
  }
  if (response.status !== 207 && !response.ok) {
    throw new Error(`Impossibile cercare la cartella attendance-tracker (${response.status}).`)
  }

  const xml = await response.text()
  const responseBlocks = xml.match(
    /<(?:[\w-]+:)?response\b[^>]*>[\s\S]*?<\/(?:[\w-]+:)?response>/gi
  ) ?? []
  const folders = responseBlocks.flatMap((block) => {
    if (!/<(?:[\w-]+:)?collection\b[^>]*\/?\s*>/i.test(block)) return []
    const href = block.match(
      /<(?:[\w-]+:)?href\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?href>/i
    )?.[1]
      .trim()
      .replace(/&amp;/gi, '&')
    if (!href) return []
    const path = remoteResourcePath(config, href)
    if (path?.split('/').at(-1)?.toLocaleLowerCase() !== 'attendance-tracker') {
      return []
    }
    return [path]
  })

  return [...new Set(folders)].sort((first, second) => first.localeCompare(second))
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

export async function createRemoteTeamDocument(
  document: TeamDocument,
  config: SyncConfig
): Promise<void> {
  await ensureRemoteFolder(config)
  const remote = await readRemote(config, document)
  if (remote.exists) {
    throw new Error('Esiste già un registro con lo stesso nome per questa stagione.')
  }
  try {
    await writeRemote(config, document, undefined, true)
  } catch (error) {
    if (error instanceof Error && error.message === 'CONFLICT') {
      throw new Error('Esiste già un registro con lo stesso nome per questa stagione.')
    }
    throw error
  }
}

export async function updateRemoteTeamDocument(
  document: TeamDocument,
  config: SyncConfig
): Promise<TeamDocument> {
  const remote = await readRemote(config, document)
  if (!remote.document || !remote.etag) {
    throw new Error('Il registro remoto non è disponibile per la modifica.')
  }

  const nextDocument = documentsAreEqual(remote.document, document)
    ? document
    : mergeDocuments(document, remote.document)
  try {
    await writeRemote(config, nextDocument, remote.etag)
    return nextDocument
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'CONFLICT') throw error
    const latest = await readRemote(config, document)
    if (!latest.document) throw new Error('Conflitto remoto non risolvibile.')
    if (documentsAreEqual(latest.document, remote.document)) {
      const confirmed = await writeAndVerifyWithoutCondition(config, nextDocument)
      if (!confirmed.document) {
        throw new Error('Il registro remoto è vuoto dopo il salvataggio.')
      }
      return confirmed.document
    }
    if (documentsAreEqual(latest.document, nextDocument)) {
      return latest.document
    }
    throw new RemoteDocumentConflictError(document, latest.document)
  }
}

export async function resolveRemoteTeamDocumentConflict(
  local: TeamDocument,
  config: SyncConfig,
  resolution: ConflictResolution
): Promise<TeamDocument> {
  const latest = await readRemote(config, local)
  if (!latest.document) {
    throw new Error('Il registro remoto non è più disponibile.')
  }
  if (resolution === 'remote') return latest.document

  const document = resolution === 'merge'
    ? mergeDocuments(local, latest.document)
    : {
        ...local,
        revision: Math.max(local.revision, latest.document.revision) + 1,
        updatedAt: new Date().toISOString()
      }
  const confirmed = await writeAndVerifyWithoutCondition(config, document)
  if (!confirmed.document) throw new Error('Il registro remoto è vuoto dopo il salvataggio.')
  return confirmed.document
}

function backupFolderName(config: SyncConfig): string {
  const folder = config.remoteFolder.split('/').filter(Boolean).join('/')
  return folder ? `${folder}/backup` : 'backup'
}

function backupTimestamp(now = new Date()): string {
  return now.toISOString().replace(/:/g, '').replace(/\.\d{3}Z$/, 'Z')
}

export async function backupRemoteTeamDocuments(
  teams: TeamSummary[],
  config: SyncConfig
): Promise<{ folder: string; count: number }> {
  const folder = `${backupFolderName(config)}/${backupTimestamp()}`
  const backupConfig = { ...config, remoteFolder: folder }
  await ensureRemoteFolder(backupConfig)

  for (const team of teams) {
    await writeRemote(backupConfig, team.document, undefined, true)
  }

  return { folder, count: teams.length }
}

export async function deleteRemoteTeamDocument(
  document: TeamDocument,
  config: SyncConfig
): Promise<void> {
  const response = await davFetch(config, documentUrl(config, document), {
    method: 'DELETE'
  })
  if (response.status === 401 || response.status === 403) {
    throw new Error('L’account non ha il permesso di eliminare questo registro.')
  }
  if (response.status === 404) {
    throw new Error('Il registro non esiste più su Nextcloud.')
  }
  if (!response.ok) {
    throw new Error(`Impossibile eliminare il registro remoto (${response.status}).`)
  }
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
