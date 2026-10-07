import { afterEach, describe, expect, it, vi } from 'vitest'
import { createTeamDocument } from '../domain/defaults'
import { saveSession, serializeTeamDocument } from '../domain/document'
import { RemoteDocumentConflictError, synchronizeDocument } from '../services/webdav'
import type { TeamDocument } from '../domain/types'

const config = { baseUrl: 'https://cloud.example.it', username: 'coach', appPassword: 'password', remoteFolder: 'attendance-tracker' }
const base = createTeamDocument({ teamName: 'U14', organizationName: 'Volley', coachName: 'Coach', startYear: 2026, athleteNames: ['Anna'] })
const athlete = base.athletes[0].id
const present = base.statuses[0].id
const add = (doc: TeamDocument, date: string, id: string, status = present) => saveSession(doc, { id, date, attendances: { [athlete]: status } }, 'Coach')
const etag = (tag: string) => new Response(`<d:multistatus xmlns:d="DAV:"><d:getetag>"${tag}"</d:getetag></d:multistatus>`, { status: 207 })
const content = (doc: TeamDocument) => new Response(serializeTeamDocument(doc), { status: 200 })
afterEach(() => vi.unstubAllGlobals())

describe('sincronizzazione di allenamenti registrati offline', () => {
  it('pubblica un allenamento dalla vecchia copia conservando gli allenamenti cloud, anche senza ETag locale', async () => {
    const local = add(base, '2026-10-07', 'offline')
    const remote = add(base, '2026-10-05', 'cloud')
    let uploaded: TeamDocument | undefined
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(etag('remote'))
      .mockResolvedValueOnce(content(remote))
      .mockImplementationOnce(async (_url, init) => {
        expect(new Headers(init?.headers).get('If-Match')).toBe('"remote"')
        uploaded = JSON.parse(String(init?.body))
        return new Response(null, { status: 204, headers: { ETag: '"saved"' } })
      })
    vi.stubGlobal('fetch', fetchMock)
    const result = await synchronizeDocument(local, { dirty: true, baseDocument: base }, config)
    expect(uploaded?.sessions.map(s => s.date)).toEqual(['2026-10-05', '2026-10-07'])
    expect(result.meta.dirty).toBe(false)
    expect(result.meta.baseDocument).toEqual(result.document)
  })

  it('un errore di connessione lascia intatta la copia locale pendente', async () => {
    const local = add(base, '2026-10-07', 'offline')
    const meta = { dirty: true, baseDocument: base }
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')))
    await expect(synchronizeDocument(local, meta, config)).rejects.toThrow('non è raggiungibile')
    expect(meta.dirty).toBe(true)
    expect(local.sessions[0].id).toBe('offline')
  })

  it('non carica alcun file quando lo stesso dato è stato modificato in modo incompatibile', async () => {
    const ancestor = add(base, '2026-10-01', 'first')
    const local = add(ancestor, '2026-10-01', 'first', base.statuses[1].id)
    const remote = saveSession(ancestor, { id: 'first', date: '2026-10-01', attendances: {} }, 'Cloud')
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(etag('remote'))
      .mockResolvedValueOnce(content(remote))
    vi.stubGlobal('fetch', fetchMock)
    await expect(synchronizeDocument(local, { dirty: true, baseDocument: ancestor }, config)).rejects.toBeInstanceOf(RemoteDocumentConflictError)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('rilegge il cloud dopo una modifica concorrente e conserva anche il giorno aggiunto durante il tentativo', async () => {
    const local = add(base, '2026-10-07', 'offline')
    const remote = add(base, '2026-10-05', 'cloud')
    const latest = add(remote, '2026-10-06', 'concurrent')
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('', { status: 207 }))
      .mockResolvedValueOnce(etag('remote'))
      .mockResolvedValueOnce(content(remote))
      .mockResolvedValueOnce(new Response(null, { status: 412 }))
      .mockResolvedValueOnce(etag('latest'))
      .mockResolvedValueOnce(content(latest))
      .mockImplementationOnce(async (_url, init) => {
        expect(new Headers(init?.headers).get('If-Match')).toBe('"latest"')
        expect(JSON.parse(String(init?.body)).sessions.map((s: { date: string }) => s.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07'])
        return new Response(null, { status: 204, headers: { ETag: '"saved"' } })
      })
    vi.stubGlobal('fetch', fetchMock)
    const result = await synchronizeDocument(local, { dirty: true, baseDocument: base }, config)
    expect(result.document.sessions).toHaveLength(3)
    expect(result.meta.dirty).toBe(false)
  })
})
