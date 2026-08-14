import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  listNextcloudDirectoryUsers,
  nextcloudUserIdFromPrincipal,
  parseNextcloudDirectoryUsers
} from '../services/nextcloudDirectory'

const responseXml = `<?xml version="1.0"?>
  <d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav">
    <d:response><d:propstat><d:prop><card:address-data>BEGIN:VCARD&#13;
VERSION:4.0&#13;
UID:anna&#13;
FN:Anna Rossi&#13;
EMAIL;TYPE=work:anna@example.it&#13;
END:VCARD&#13;
</card:address-data></d:prop></d:propstat></d:response>
    <d:response><d:propstat><d:prop><card:address-data><![CDATA[BEGIN:VCARD
VERSION:4.0
UID:beatrice
FN:Beatrice Bianchi
END:VCARD
]]></card:address-data></d:prop></d:propstat></d:response>
  </d:multistatus>`

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rubrica utenti Nextcloud', () => {
  it('ricava l’UID canonico dal principal autenticato', () => {
    expect(
      nextcloudUserIdFromPrincipal(`<?xml version="1.0"?>
        <d:multistatus xmlns:d="DAV:">
          <d:response><d:propstat><d:prop><d:current-user-principal>
            <d:href>/remote.php/dav/principals/users/coord%40societa/</d:href>
          </d:current-user-principal></d:prop></d:propstat></d:response>
        </d:multistatus>`)
    ).toBe('coord@societa')
  })

  it('estrae identificativo, nome ed email dalle vCard della rubrica di sistema', () => {
    expect(parseNextcloudDirectoryUsers(responseXml)).toEqual([
      { id: 'anna', displayName: 'Anna Rossi', email: 'anna@example.it' },
      { id: 'beatrice', displayName: 'Beatrice Bianchi' }
    ])
  })

  it('legge la rubrica CardDAV dell’account ed esclude il coordinatore', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          '<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"><d:response><d:propstat><d:prop><d:current-user-principal><d:href>/remote.php/dav/principals/users/coordinatore/</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>',
          { status: 207 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          responseXml.replace(
            '</d:multistatus>',
            '<d:response><d:propstat><d:prop><card:address-data>BEGIN:VCARD\nUID:coordinatore\nFN:Coordinatore\nEND:VCARD</card:address-data></d:prop></d:propstat></d:response></d:multistatus>'
          ),
          { status: 207 }
        )
      )
    vi.stubGlobal('fetch', fetchMock)

    const users = await listNextcloudDirectoryUsers({
      baseUrl: 'https://cloud.example.it',
      username: 'coordinatore',
      appPassword: 'password-app',
      remoteFolder: 'attendance-tracker'
    })

    expect(users.map((user) => user.id)).toEqual(['anna', 'beatrice'])
    expect(fetchMock.mock.calls[0][0]).toBe('https://cloud.example.it/remote.php/dav/')
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PROPFIND')
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://cloud.example.it/remote.php/dav/addressbooks/users/coordinatore/z-server-generated--system/'
    )
    expect(fetchMock.mock.calls[1][1]?.method).toBe('REPORT')
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain('<card:filter/>')
  })

  it('usa l’UID canonico anche quando il login è un indirizzo email', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          '<d:multistatus xmlns:d="DAV:"><d:href>/remote.php/dav/principals/users/coordinatore/</d:href></d:multistatus>',
          { status: 207 }
        )
      )
      .mockResolvedValueOnce(new Response(responseXml, { status: 207 }))
    vi.stubGlobal('fetch', fetchMock)

    await listNextcloudDirectoryUsers({
      baseUrl: 'https://cloud.example.it',
      username: 'coordinatore@example.it',
      appPassword: 'password-app',
      remoteFolder: 'attendance-tracker'
    })

    expect(fetchMock.mock.calls[1][0]).toContain('/addressbooks/users/coordinatore/')
  })

  it('ripiega su PROPFIND quando REPORT non restituisce le vCard', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          '<d:multistatus xmlns:d="DAV:"><d:href>/remote.php/dav/principals/users/coordinatore/</d:href></d:multistatus>',
          { status: 207 }
        )
      )
      .mockResolvedValueOnce(new Response('', { status: 400 }))
      .mockResolvedValueOnce(new Response(responseXml, { status: 207 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      listNextcloudDirectoryUsers({
        baseUrl: 'https://cloud.example.it',
        username: 'coordinatore',
        appPassword: 'password-app',
        remoteFolder: 'attendance-tracker'
      })
    ).resolves.toHaveLength(2)
    expect(fetchMock.mock.calls[2][1]?.method).toBe('PROPFIND')
  })

  it('spiega quale impostazione abilitare quando Nextcloud non enumera gli utenti', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          new Response(
            '<d:multistatus xmlns:d="DAV:"><d:href>/remote.php/dav/principals/users/coordinatore/</d:href></d:multistatus>',
            { status: 207 }
          )
        )
        .mockImplementation(async () =>
          new Response('<?xml version="1.0"?><d:multistatus xmlns:d="DAV:"/>', {
            status: 207
          })
        )
    )

    await expect(
      listNextcloudDirectoryUsers({
        baseUrl: 'https://cloud.example.it',
        username: 'coordinatore',
        appPassword: 'password-app',
        remoteFolder: 'attendance-tracker'
      })
    ).rejects.toThrow('autocompletamento')
  })
})
