import { describe, expect, it, vi } from 'vitest'
import {
  activateWaitingServiceWorker,
  cacheBelongsToScope,
  clearCachesForScope,
  removeUpdateReloadToken,
  updateReloadUrl
} from '../services/appUpdate'

describe('aggiornamento della PWA', () => {
  it('attiva il service worker in attesa e rileva il cambio di controller', async () => {
    const serviceWorkers = new EventTarget()
    const postMessage = vi.fn(() => {
      serviceWorkers.dispatchEvent(new Event('controllerchange'))
    })
    const registration = {
      waiting: { postMessage }
    } as unknown as ServiceWorkerRegistration

    await expect(
      activateWaitingServiceWorker(
        registration,
        serviceWorkers as ServiceWorkerContainer,
        50
      )
    ).resolves.toBe(true)
    expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' })
  })

  it('termina senza restare bloccato se il controller non cambia', async () => {
    const registration = {
      waiting: { postMessage: vi.fn() }
    } as unknown as ServiceWorkerRegistration

    await expect(
      activateWaitingServiceWorker(
        registration,
        new EventTarget() as ServiceWorkerContainer,
        5
      )
    ).resolves.toBe(false)
  })

  it('genera un URL anti-cache preservando la rotta e poi lo ripulisce', () => {
    const refreshed = updateReloadUrl(
      'https://example.it/attendance-tracker/?foo=bar#/coordinatore',
      1234
    )

    expect(refreshed).toBe(
      'https://example.it/attendance-tracker/?foo=bar&app-update=1234#/coordinatore'
    )
    expect(removeUpdateReloadToken(refreshed)).toBe(
      'https://example.it/attendance-tracker/?foo=bar#/coordinatore'
    )
  })

  it('elimina soltanto le cache appartenenti allo scope dell’app', async () => {
    const deleteCache = vi.fn(async () => true)
    const cacheStorage = {
      keys: async () => [
        'workbox-precache-v2-https://example.it/attendance-tracker/',
        'workbox-runtime-/attendance-tracker/',
        'workbox-precache-v2-https://example.it/altra-app/'
      ],
      delete: deleteCache
    } as unknown as CacheStorage

    expect(
      cacheBelongsToScope(
        'workbox-precache-v2-https://example.it/attendance-tracker/',
        'https://example.it/attendance-tracker/'
      )
    ).toBe(true)
    await clearCachesForScope('https://example.it/attendance-tracker/', cacheStorage)

    expect(deleteCache).toHaveBeenCalledTimes(2)
    expect(deleteCache).not.toHaveBeenCalledWith(
      'workbox-precache-v2-https://example.it/altra-app/'
    )
  })
})
