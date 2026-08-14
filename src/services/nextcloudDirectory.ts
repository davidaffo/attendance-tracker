import type { SyncConfig } from '../domain/types'
import { nextcloudAuthorization, normalizeNextcloudBaseUrl } from './nextcloud'

export interface NextcloudDirectoryUser {
  id: string
  displayName: string
  email?: string
}

function decodeXml(value: string): string {
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16))
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10))
    )
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}

function decodeVCardValue(value: string): string {
  return value
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .trim()
}

function vCardProperty(card: string, name: string): string | undefined {
  const unfolded = card.replace(/\r?\n[ \t]/g, '')
  for (const line of unfolded.split(/\r?\n/)) {
    const separator = line.indexOf(':')
    if (separator < 0) continue
    const property = line.slice(0, separator).split(';')[0]?.toLocaleUpperCase()
    if (property === name) return decodeVCardValue(line.slice(separator + 1))
  }
  return undefined
}

export function parseNextcloudDirectoryUsers(xml: string): NextcloudDirectoryUser[] {
  const cards = [
    ...xml.matchAll(
      /<(?:[\w-]+:)?address-data\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?address-data>/gi
    )
  ]
  const users = cards.flatMap((match) => {
    const card = decodeXml(match[1].trim())
    const id = vCardProperty(card, 'UID')
    if (!id) return []
    const displayName = vCardProperty(card, 'FN') || id
    const email = vCardProperty(card, 'EMAIL')
    return [{ id, displayName, ...(email ? { email } : {}) }]
  })
  return [...new Map(users.map((user) => [user.id, user])).values()].sort((first, second) =>
    first.displayName.localeCompare(second.displayName, 'it', { sensitivity: 'base' })
  )
}

export function nextcloudUserIdFromPrincipal(xml: string): string | undefined {
  for (const match of xml.matchAll(
    /<(?:[\w-]+:)?href\b[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?href>/gi
  )) {
    const href = decodeXml(match[1].trim())
    const principal = href.match(/\/principals\/users\/([^/]+)\/?/i)
    if (!principal) continue
    try {
      return decodeURIComponent(principal[1])
    } catch {
      return principal[1]
    }
  }
  return undefined
}

async function resolveNextcloudUserId(config: SyncConfig): Promise<string> {
  try {
    const response = await fetch(
      `${normalizeNextcloudBaseUrl(config.baseUrl)}/remote.php/dav/`,
      {
        method: 'PROPFIND',
        mode: 'cors',
        cache: 'no-store',
        headers: {
          Authorization: nextcloudAuthorization(config),
          'X-Requested-With': 'XMLHttpRequest',
          Depth: '0',
          'Content-Type': 'application/xml; charset=utf-8'
        },
        body: `<?xml version="1.0" encoding="UTF-8"?>
          <d:propfind xmlns:d="DAV:">
            <d:prop><d:current-user-principal/></d:prop>
          </d:propfind>`
      }
    )
    if (response.ok || response.status === 207) {
      return nextcloudUserIdFromPrincipal(await response.text()) || config.username
    }
  } catch {
    // Il percorso storico resta un ripiego per istanze che non espongono il principal.
  }
  return config.username
}

function directoryHeaders(config: SyncConfig, depth: '0' | '1'): HeadersInit {
  return {
    Authorization: nextcloudAuthorization(config),
    'X-Requested-With': 'XMLHttpRequest',
    Depth: depth,
    'Content-Type': 'application/xml; charset=utf-8'
  }
}

async function directoryRequest(
  config: SyncConfig,
  url: string,
  method: 'REPORT' | 'PROPFIND'
): Promise<Response | undefined> {
  try {
    return await fetch(url, {
      method,
      mode: 'cors',
      cache: 'no-store',
      headers: directoryHeaders(config, '1'),
      body:
        method === 'REPORT'
          ? `<?xml version="1.0" encoding="UTF-8"?>
            <card:addressbook-query xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
              <d:prop><card:address-data/></d:prop>
              <card:filter/>
            </card:addressbook-query>`
          : `<?xml version="1.0" encoding="UTF-8"?>
            <d:propfind xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
              <d:prop><card:address-data/></d:prop>
            </d:propfind>`
    })
  } catch {
    return undefined
  }
}

export async function listNextcloudDirectoryUsers(
  config: SyncConfig
): Promise<NextcloudDirectoryUser[]> {
  const userId = await resolveNextcloudUserId(config)
  const url = `${normalizeNextcloudBaseUrl(config.baseUrl)}/remote.php/dav/addressbooks/users/${encodeURIComponent(userId)}/z-server-generated--system/`
  const reportResponse = await directoryRequest(config, url, 'REPORT')

  if (reportResponse?.status === 401 || reportResponse?.status === 403) {
    throw new Error('L’account non può leggere la rubrica utenti Nextcloud.')
  }
  if (reportResponse?.status === 404) {
    throw new Error(
      'La rubrica di sistema è disattivata. In Nextcloud apri Impostazioni di amministrazione → Groupware → Rubrica di sistema e abilitala.'
    )
  }

  let users = reportResponse
    ? parseNextcloudDirectoryUsers(await reportResponse.text())
    : []
  let response = reportResponse

  if (users.length === 0) {
    const propfindResponse = await directoryRequest(config, url, 'PROPFIND')
    if (propfindResponse) {
      response = propfindResponse
      users = parseNextcloudDirectoryUsers(await propfindResponse.text())
    }
  }

  if (!response) {
    throw new Error(
      'La rubrica utenti Nextcloud non è raggiungibile dal browser. Verifica il CORS WebDAV di WebAppPassword.'
    )
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error('L’account non può leggere la rubrica utenti Nextcloud.')
  }
  if (response.status === 404) {
    throw new Error(
      'La rubrica di sistema è disattivata. In Nextcloud apri Impostazioni di amministrazione → Groupware → Rubrica di sistema e abilitala.'
    )
  }
  if (response.status !== 207 && !response.ok) {
    throw new Error(`Impossibile caricare la rubrica utenti (${response.status}).`)
  }

  users = users.filter(
    (user) => user.id.toLocaleLowerCase() !== userId.toLocaleLowerCase()
  )
  if (users.length === 0) {
    throw new Error(
      'Nextcloud non espone altri utenti. Abilita la Rubrica di sistema in Amministrazione → Groupware e l’autocompletamento dei nomi utente in Amministrazione → Condivisione.'
    )
  }
  return users
}
