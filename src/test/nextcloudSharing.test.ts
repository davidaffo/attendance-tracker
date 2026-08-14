import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTeamDocument } from '../domain/defaults'
import {
  createNextcloudShare,
  deleteNextcloudShare,
  listNextcloudShares,
  NEXTCLOUD_PERMISSIONS_EDITOR,
  NEXTCLOUD_PERMISSIONS_VIEWER,
  NEXTCLOUD_SHARE_TYPE_GROUP,
  NEXTCLOUD_SHARE_TYPE_USER,
  nextcloudDocumentFolderUrl,
  nextcloudDocumentPath,
  updateNextcloudSharePermissions
} from '../services/nextcloudSharing'

const config = {
  baseUrl: 'https://cloud.example.it/nextcloud',
  username: 'coordinatore',
  appPassword: 'password-app',
  remoteFolder: 'Volley/Stagione 2026/attendance-tracker'
}

const document = createTeamDocument({
  teamName: 'Under 14 Blu',
  organizationName: 'Volley Club',
  coachName: 'Mario',
  startYear: 2026,
  weekdays: [],
  athleteNames: ['Anna']
})

function ocsResponse<T>(data: T, meta: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      ocs: {
        meta: { status: 'ok', statuscode: 200, message: 'OK', ...meta },
        data
      }
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API condivisioni Nextcloud', () => {
  it('assegna solo lettura alla giocatrice e lettura più scrittura all’allenatore', () => {
    expect(NEXTCLOUD_PERMISSIONS_VIEWER).toBe(1)
    expect(NEXTCLOUD_PERMISSIONS_EDITOR).toBe(3)
    expect(NEXTCLOUD_PERMISSIONS_EDITOR & (4 | 8 | 16)).toBe(0)
  })

  it('costruisce il percorso del singolo registro senza esporre la cartella', () => {
    expect(nextcloudDocumentPath(config, document)).toBe(
      '/Volley/Stagione 2026/attendance-tracker/under-14-blu__2026-2027.attendance.json'
    )
  })

  it('costruisce il collegamento di ripiego alla cartella Nextcloud', () => {
    expect(nextcloudDocumentFolderUrl(config)).toBe(
      'https://cloud.example.it/nextcloud/index.php/apps/files/files?dir=%2FVolley%2FStagione+2026%2Fattendance-tracker'
    )
  })

  it('elenca le condivisioni con autenticazione OCS e senza cache', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      ocsResponse([
        {
          id: 41,
          share_type: 0,
          share_with: 'mrossi',
          share_with_displayname: 'Mario Rossi',
          permissions: 3,
          can_edit: true,
          can_delete: true
        }
      ])
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(listNextcloudShares(config, document)).resolves.toEqual([
      {
        id: '41',
        shareType: 0,
        shareWith: 'mrossi',
        displayName: 'Mario Rossi',
        permissions: 3,
        canEdit: true,
        canDelete: true
      }
    ])

    const [url, init] = fetchMock.mock.calls[0]
    const parsedUrl = new URL(String(url))
    expect(parsedUrl.pathname).toBe(
      '/nextcloud/index.php/apps/webapppassword/api/v1/shares'
    )
    expect(parsedUrl.searchParams.get('path')).toBe(nextcloudDocumentPath(config, document))
    expect(parsedUrl.searchParams.get('reshares')).toBe('true')
    expect(parsedUrl.searchParams.get('format')).toBe('json')
    expect(new Headers(init?.headers).get('OCS-APIRequest')).toBe('true')
    expect(new Headers(init?.headers).get('Authorization')).toMatch(/^Basic /)
    expect(new Headers(init?.headers).get('X-Requested-With')).toBeNull()
    expect(init?.cache).toBe('no-store')
  })

  it('usa i permessi dichiarati da Nextcloud anche se lo username di login non coincide con uid_owner', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        ocsResponse([
          {
            id: 42,
            share_type: 0,
            share_with: 'anna',
            share_with_displayname: 'Anna Rossi',
            permissions: 1,
            uid_owner: 'uid-canonico-coordinatore',
            can_edit: true,
            can_delete: true
          },
          {
            id: 43,
            share_type: 3,
            share_with_displayname: '(Link condiviso)',
            permissions: 1,
            uid_owner: 'uid-canonico-coordinatore',
            can_edit: false,
            can_delete: true
          }
        ])
      )
    )

    await expect(listNextcloudShares(config, document)).resolves.toMatchObject([
      { id: '42', canEdit: true, canDelete: true },
      { id: '43', canEdit: false, canDelete: true }
    ])
  })

  it('crea, modifica e rimuove una condivisione con i permessi previsti', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        ocsResponse({
          id: '52',
          share_type: 0,
          share_with: 'mrossi',
          share_with_displayname: 'Mario Rossi',
          permissions: 3
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ocs: { meta: { status: 'ok', statuscode: 100, message: 'OK' } }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await createNextcloudShare(
      config,
      document,
      {
        shareType: NEXTCLOUD_SHARE_TYPE_USER,
        shareWith: 'mrossi',
        displayName: 'Mario Rossi'
      },
      NEXTCLOUD_PERMISSIONS_EDITOR
    )
    await updateNextcloudSharePermissions(
      config,
      '52',
      NEXTCLOUD_PERMISSIONS_VIEWER
    )
    await deleteNextcloudShare(config, '52')

    const createInit = fetchMock.mock.calls[0][1]
    expect(createInit?.method).toBe('POST')
    expect(String(createInit?.body)).toContain('shareType=0')
    expect(String(createInit?.body)).toContain('permissions=3')
    expect(String(createInit?.body)).toContain('path=%2FVolley%2FStagione+2026')

    const updateInit = fetchMock.mock.calls[1][1]
    expect(updateInit?.method).toBe('PUT')
    expect(String(updateInit?.body)).toBe('permissions=1')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/shares/52?format=json')

    expect(fetchMock.mock.calls[2][1]?.method).toBe('DELETE')
  })

  it('rende comprensibile un rifiuto per mancanza di permessi', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        ocsResponse([], {
          status: 'failure',
          statuscode: 403,
          message: 'You are not allowed to share this file'
        })
      )
    )

    await expect(listNextcloudShares(config, document)).rejects.toThrow(
      'non ha il permesso di condividere'
    )
  })

  it('distingue il blocco browser o di rete dagli errori WebDAV', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('CORS')))

    await expect(listNextcloudShares(config, document)).rejects.toThrow(
      'sezione Files sharing API'
    )
  })
})
