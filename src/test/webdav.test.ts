import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTeamDocument } from '../domain/defaults'
import { serializeTeamDocument } from '../domain/document'
import { detailsFromNextcloudFolderLink } from '../domain/syncConfig'
import {
  createRemoteTeamDocument,
  deleteRemoteTeamDocument,
  discoverAttendanceTrackerFolders,
  discoverRemoteTeamDocuments,
  documentUrl,
  normalizeEtag,
  remoteFolderFromDocumentUrl,
  synchronizeDocument,
  testNextcloudCredentials,
  verifyRemoteFolderWritable
} from '../services/webdav'

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

  it('conserva la sottocartella effettiva dei registri trovati', () => {
    expect(
      remoteFolderFromDocumentUrl(
        {
          baseUrl: 'https://cloud.example.it',
          username: 'allenatore',
          appPassword: 'password-app',
          remoteFolder: ''
        },
        'https://cloud.example.it/remote.php/dav/files/allenatore/Condivisi/Under%2014/u14.attendance.json'
      )
    ).toBe('Condivisi/Under 14')
  })
})

describe('verifica della password applicativa', () => {
  const connection = {
    baseUrl: 'https://cloud.example.it',
    username: 'coordinatore',
    appPassword: 'password-app',
    remoteFolder: 'Stagioni/attendance-tracker'
  }

  it('verifica l’account sulla radice personale senza dipendere dalla cartella scelta', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 207 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(testNextcloudCredentials(connection)).resolves.toBeUndefined()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://cloud.example.it/remote.php/dav/files/coordinatore'
    )
    expect(init?.method).toBe('PROPFIND')
  })

  it('segnala la password errata senza confonderla con un errore della cartella', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 401 }))
    )

    await expect(testNextcloudCredentials(connection)).rejects.toThrow(
      'Password applicativa non valida'
    )
  })
})

describe('scoperta dei registri in sola lettura', () => {
  const connection = {
    baseUrl: 'https://cloud.example.it',
    username: 'giocatrice',
    appPassword: 'password-app',
    remoteFolder: ''
  }

  it('cerca automaticamente i file accessibili quando non è indicata una cartella', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(discoverRemoteTeamDocuments(connection)).rejects.toThrow(
      'Credenziali non valide'
    )

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://cloud.example.it/remote.php/dav')
    expect(init?.method).toBe('SEARCH')
    expect(String(init?.body)).toContain('<d:href>/files/giocatrice</d:href>')
    expect(String(init?.body)).toContain('<d:literal>%.attendance.json</d:literal>')
  })

  it('scansiona soltanto la cartella quando il coordinatore ne indica una', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      discoverRemoteTeamDocuments({
        ...connection,
        username: 'coordinatore',
        remoteFolder: 'Condivisi/attendance-tracker'
      })
    ).rejects.toThrow('Credenziali non valide')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(
      'https://cloud.example.it/remote.php/dav/files/coordinatore/Condivisi/attendance-tracker'
    )
    expect(init?.method).toBe('PROPFIND')
  })
})

describe('ricerca della cartella del coordinatore', () => {
  const connection = {
    baseUrl: 'https://cloud.example.it',
    username: 'coordinatore',
    appPassword: 'password-app',
    remoteFolder: ''
  }

  it('trova attendance-tracker anche nelle sottocartelle', async () => {
    const xml = `<?xml version="1.0"?>
      <d:multistatus xmlns:d="DAV:">
        <d:response>
          <d:href>/remote.php/dav/files/coordinatore/Volley/Stagione%202026/attendance-tracker/</d:href>
          <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
        </d:response>
        <d:response>
          <d:href>/remote.php/dav/files/coordinatore/Altra/attendance-tracker/</d:href>
          <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
        </d:response>
        <d:response>
          <d:href>/remote.php/dav/files/coordinatore/attendance-tracker.txt</d:href>
          <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
        </d:response>
      </d:multistatus>`
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(xml, { status: 207 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(discoverAttendanceTrackerFolders(connection)).resolves.toEqual([
      'Altra/attendance-tracker',
      'Volley/Stagione 2026/attendance-tracker'
    ])

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://cloud.example.it/remote.php/dav')
    expect(init?.method).toBe('SEARCH')
    expect(String(init?.body)).toContain('<d:depth>infinity</d:depth>')
    expect(String(init?.body)).toContain('<d:literal>attendance-tracker</d:literal>')
  })

  it('non avvia una scansione pesante se SEARCH non è supportato', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('', { status: 405 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(discoverAttendanceTrackerFolders(connection)).rejects.toThrow(
      'non supporta la ricerca delle sottocartelle'
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('scrittura condizionale WebDAV', () => {
  it('usa nell’If-Match l’ETag decodificato dal PROPFIND', async () => {
    const document = createTeamDocument({
      teamName: 'U14',
      organizationName: 'Volley Club',
      coachName: 'Mario',
      startYear: 2026,
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

describe('creazione dei registri del coordinatore', () => {
  const document = createTeamDocument({
    teamName: 'Under 14',
    organizationName: 'Volley Club',
    coachName: 'Mario',
    startYear: 2026,
    athleteNames: ['Anna']
  })
  const connection = {
    baseUrl: 'https://cloud.example.it',
    username: 'coordinatore',
    appPassword: 'password-app',
    remoteFolder: 'attendance-tracker'
  }

  it('verifica i permessi creando e rimuovendo un file temporaneo', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await verifyRemoteFolderWritable(connection)

    expect(fetchMock.mock.calls.map((call) => call[1]?.method)).toEqual([
      'PROPFIND',
      'PUT',
      'DELETE'
    ])
    expect(String(fetchMock.mock.calls[1][0])).toContain(
      '/attendance-tracker/.attendance-write-check-'
    )
    expect(fetchMock.mock.calls[2][0]).toBe(fetchMock.mock.calls[1][0])
  })

  it('segnala quando la cartella non consente la scrittura', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(new Response('', { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(verifyRemoteFolderWritable(connection)).rejects.toThrow(
      'non ha il permesso di scrittura'
    )
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('crea la cartella mancante e carica il nuovo file senza sovrascrivere', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 201 }))
      .mockResolvedValueOnce(new Response('', { status: 404 }))
      .mockImplementationOnce(async (input, init) => {
        expect(input).toBe(
          'https://cloud.example.it/remote.php/dav/files/coordinatore/attendance-tracker/under-14__2026-2027.attendance.json'
        )
        expect(init?.method).toBe('PUT')
        expect(new Headers(init?.headers).get('If-None-Match')).toBe('*')
        expect(String(init?.body)).toBe(serializeTeamDocument(document))
        return new Response(null, { status: 204, headers: { ETag: '"new"' } })
      })
    vi.stubGlobal('fetch', fetchMock)

    await createRemoteTeamDocument(document, connection)

    expect(fetchMock.mock.calls[0][1]?.method).toBe('PROPFIND')
    expect(fetchMock.mock.calls[1][1]?.method).toBe('MKCOL')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('rifiuta un registro già esistente', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(
        new Response(serializeTeamDocument(document), { status: 200 })
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(createRemoteTeamDocument(document, connection)).rejects.toThrow(
      'Esiste già un registro'
    )
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('elimina soltanto il file della squadra selezionata', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await deleteRemoteTeamDocument(document, connection)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://cloud.example.it/remote.php/dav/files/coordinatore/attendance-tracker/under-14__2026-2027.attendance.json'
    )
    expect(fetchMock.mock.calls[0][1]?.method).toBe('DELETE')
  })

  it('segnala quando il coordinatore non può eliminare il registro', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 403 }))
    )

    await expect(deleteRemoteTeamDocument(document, connection)).rejects.toThrow(
      'non ha il permesso di eliminare'
    )
  })
})
