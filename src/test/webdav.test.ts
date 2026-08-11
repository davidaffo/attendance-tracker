import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTeamDocument } from '../domain/defaults'
import { serializeTeamDocument } from '../domain/document'
import { detailsFromNextcloudFolderLink } from '../domain/syncConfig'
import { documentUrl, normalizeEtag, synchronizeDocument } from '../services/webdav'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ETag WebDAV Nextcloud', () => {
  it('decodifica le virgolette restituite nel XML PROPFIND', () => {
    expect(normalizeEtag('&quot;abc123&quot;')).toBe('"abc123"')
    expect(normalizeEtag('&#34;abc123&#34;')).toBe('"abc123"')
    expect(normalizeEtag('&#x22;abc123&#x22;')).toBe('"abc123"')
  })

  it('mantiene invariato un ETag letto dagli header HTTP', () => {
    expect(normalizeEtag('"abc123"')).toBe('"abc123"')
    expect(normalizeEtag('W/"abc123"')).toBe('W/"abc123"')
  })

  it('gestisce spazi, entità concatenate e valori assenti', () => {
    expect(normalizeEtag('  &quot;a&amp;b&quot;  ')).toBe('"a&b"')
    expect(normalizeEtag(undefined)).toBeUndefined()
    expect(normalizeEtag('   ')).toBeUndefined()
  })
})

describe('percorso WebDAV del supervisore', () => {
  it('usa la cartella annidata estratta dal link Nextcloud', () => {
    const document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      weekdays: [],
      athleteNames: ['Anna']
    })
    const details = detailsFromNextcloudFolderLink(
      'https://nx100087.your-storageshare.de/apps/files/files/131125?dir=/Volley/Stagioni/2026-2027/attendance-tracker'
    )

    expect(
      documentUrl(
        {
          ...details,
          username: 'supervisore',
          appPassword: 'password-app'
        },
        document
      )
    ).toBe(
      'https://nx100087.your-storageshare.de/remote.php/dav/files/supervisore/Volley/Stagioni/2026-2027/attendance-tracker/u14__2026-2027.attendance.json'
    )
  })
})

describe('scrittura condizionale WebDAV', () => {
  it('usa nell’If-Match l’ETag decodificato dal PROPFIND', async () => {
    const document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      weekdays: [],
      athleteNames: ['Anna']
    })
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(
        new Response(
          '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><d:getetag>&quot;etag-1&quot;</d:getetag></d:prop></d:propstat></d:response></d:multistatus>',
          { status: 207 }
        )
      )
      .mockResolvedValueOnce(
        new Response(serializeTeamDocument(document), { status: 200 })
      )
      .mockImplementationOnce(async (_input, init) => {
        expect(new Headers(init?.headers).get('If-Match')).toBe('"etag-1"')
        return new Response(null, {
          status: 204,
          headers: { ETag: '"etag-2"' }
        })
      })
    vi.stubGlobal('fetch', fetchMock)

    const result = await synchronizeDocument(
      { ...document, revision: document.revision + 1 },
      { dirty: true },
      {
        baseUrl: 'https://cloud.example.it',
        username: 'allenatore',
        appPassword: 'password-app',
        remoteFolder: 'attendance-tracker'
      }
    )

    expect(result.meta.dirty).toBe(false)
    expect(result.meta.etag).toBe('"etag-2"')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('passa al fallback verificato se Nextcloud rifiuta sempre If-Match', async () => {
    const remoteDocument = createTeamDocument({
      teamName: 'U16',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
      weekdays: [],
      athleteNames: ['Anna']
    })
    const localDocument = {
      ...remoteDocument,
      revision: remoteDocument.revision + 1,
      updatedAt: new Date(Date.now() + 1_000).toISOString()
    }
    const etagResponse = (etag: string) =>
      new Response(
        `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><d:getetag>&quot;${etag}&quot;</d:getetag></d:prop></d:propstat></d:response></d:multistatus>`,
        { status: 207 }
      )
    const remoteResponse = () =>
      new Response(serializeTeamDocument(remoteDocument), { status: 200 })
    let uploadedDocument = ''
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(etagResponse('etag-1'))
      .mockResolvedValueOnce(remoteResponse())
      .mockResolvedValueOnce(new Response('', { status: 412 }))
      .mockResolvedValueOnce(etagResponse('etag-2'))
      .mockResolvedValueOnce(remoteResponse())
      .mockResolvedValueOnce(new Response('', { status: 412 }))
      .mockResolvedValueOnce(etagResponse('etag-3'))
      .mockResolvedValueOnce(remoteResponse())
      .mockImplementationOnce(async (_input, init) => {
        expect(new Headers(init?.headers).has('If-Match')).toBe(false)
        uploadedDocument = String(init?.body)
        return new Response(null, {
          status: 204,
          headers: { ETag: '"etag-4"' }
        })
      })
      .mockResolvedValueOnce(etagResponse('etag-4'))
      .mockImplementationOnce(async () =>
        new Response(uploadedDocument, { status: 200 })
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await synchronizeDocument(
      localDocument,
      { dirty: true },
      {
        baseUrl: 'https://cloud.example.it',
        username: 'allenatore',
        appPassword: 'password-app',
        remoteFolder: 'attendance-tracker'
      }
    )

    expect(result.meta.dirty).toBe(false)
    expect(result.meta.etag).toBe('"etag-4"')
    expect(result.meta.conditionalWrites).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(12)
  })
})
