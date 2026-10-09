import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checkConnection, prepareStartupConnection, type StartupSyncOutcome } from '../services/connection'

const baseUrl = 'https://cloud.example.it/nextcloud'

beforeEach(() => vi.stubGlobal('navigator', { onLine: true }))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('connessione e sincronizzazione all’apertura', () => {
  it('prosegue offline senza chiedere credenziali quando il browser è offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const onOnline = vi.fn()
    const synchronize = vi.fn()

    const result = await prepareStartupConnection(baseUrl, onOnline, synchronize)

    expect(result.online).toBe(false)
    expect(result.message).toContain('Prosegui offline')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(onOnline).not.toHaveBeenCalled()
    expect(synchronize).not.toHaveBeenCalled()
  })

  it('verifica realmente la rete anche quando navigator.onLine è true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const synchronize = vi.fn()

    const result = await prepareStartupConnection(baseUrl, vi.fn(), synchronize)

    expect(result.online).toBe(false)
    expect(result.message).toContain('dati salvati su questo dispositivo')
    expect(synchronize).not.toHaveBeenCalled()
  })

  it('non usa cache o credenziali e accetta la risposta senza CORS di Nextcloud', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ type: 'opaque', ok: false })
    vi.stubGlobal('fetch', fetchMock)

    await expect(checkConnection(baseUrl)).resolves.toBe(true)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url.pathname).toBe('/nextcloud/status.php')
    expect(url.searchParams.has('connection-check')).toBe(true)
    expect(options).toMatchObject({ method: 'HEAD', cache: 'no-store', credentials: 'omit', mode: 'no-cors' })
    expect(options.headers).toBeUndefined()
  })

  it('libera l’avvio dopo il timeout se il server non risponde', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    vi.stubGlobal('fetch', fetchMock)
    const pending = checkConnection(baseUrl)

    await vi.advanceTimersByTimeAsync(5000)

    await expect(pending).resolves.toBe(false)
    expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(true)
  })

  it('controlla l’origine dell’app quando Nextcloud non è ancora configurato', async () => {
    vi.stubGlobal('window', { location: { origin: 'https://app.example.it' } })
    const fetchMock = vi.fn().mockResolvedValue({ type: 'basic', ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await expect(checkConnection()).resolves.toBe(true)
    expect(fetchMock.mock.calls[0][0].origin).toBe('https://app.example.it')
  })

  it('non considera disponibile una risposta HTTP di errore leggibile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ type: 'basic', ok: false, status: 503 }))
    await expect(checkConnection(baseUrl)).resolves.toBe(false)
  })

  it('attende la verifica prima delle credenziali e la sincronizzazione prima di completare l’avvio', async () => {
    let resolveConnection!: (response: { type: string; ok: boolean }) => void
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveConnection = resolve })))
    let resolveSync!: (outcome: StartupSyncOutcome) => void
    const synchronize = vi.fn(() => new Promise<StartupSyncOutcome>(resolve => { resolveSync = resolve }))
    const onOnline = vi.fn()
    let ready = false
    const pending = prepareStartupConnection(baseUrl, onOnline, synchronize).then(result => {
      ready = true
      return result
    })

    expect(onOnline).not.toHaveBeenCalled()
    expect(synchronize).not.toHaveBeenCalled()
    expect(ready).toBe(false)
    resolveConnection({ type: 'opaque', ok: false })
    await vi.waitFor(() => expect(synchronize).toHaveBeenCalledOnce())
    expect(onOnline).toHaveBeenCalledOnce()
    expect(ready).toBe(false)
    resolveSync({ status: 'synced' })

    await expect(pending).resolves.toEqual({ online: true, message: 'Connessione disponibile. Registro sincronizzato con Nextcloud.' })
    expect(ready).toBe(true)
  })

  it.each([
    [{ status: 'cancelled' }, 'Sincronizzazione annullata'],
    [{ status: 'skipped' }, 'Sincronizzazione sospesa'],
    [{ status: 'error', message: 'Errore cloud' }, 'Errore cloud']
  ] as const)('avvisa prima di proseguire con la copia locale: %j', async (outcome, expected) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ type: 'opaque' }))

    const result = await prepareStartupConnection(baseUrl, vi.fn(), async () => outcome)

    expect(result.online).toBe(true)
    expect(result.message).toContain(expected)
    expect(result.message).toContain('copia locale')
  })

  it('avvisa anche se la sincronizzazione genera un errore inatteso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ type: 'opaque' }))
    const result = await prepareStartupConnection(baseUrl, vi.fn(), async () => { throw new Error('Salvataggio locale non riuscito') })
    expect(result.message).toContain('Salvataggio locale non riuscito')
    expect(result.message).toContain('copia locale')
  })
})
