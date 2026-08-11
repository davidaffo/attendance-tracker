const UPDATE_QUERY_PARAMETER = 'app-update'

export async function activateWaitingServiceWorker(
  registration: ServiceWorkerRegistration,
  serviceWorkers: ServiceWorkerContainer,
  timeoutMs = 2_500
): Promise<boolean> {
  const waitingWorker = registration.waiting
  if (!waitingWorker) return false

  return new Promise((resolve) => {
    let settled = false
    const finish = (activated: boolean) => {
      if (settled) return
      settled = true
      globalThis.clearTimeout(timeout)
      serviceWorkers.removeEventListener('controllerchange', handleControllerChange)
      resolve(activated)
    }
    const handleControllerChange = () => finish(true)
    const timeout = globalThis.setTimeout(() => finish(false), timeoutMs)

    serviceWorkers.addEventListener('controllerchange', handleControllerChange)
    try {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    } catch {
      finish(false)
    }
  })
}

export function updateReloadUrl(href: string, timestamp = Date.now()): string {
  const url = new URL(href)
  url.searchParams.set(UPDATE_QUERY_PARAMETER, String(timestamp))
  return url.toString()
}

export function removeUpdateReloadToken(href: string): string | undefined {
  const url = new URL(href)
  if (!url.searchParams.has(UPDATE_QUERY_PARAMETER)) return undefined
  url.searchParams.delete(UPDATE_QUERY_PARAMETER)
  return url.toString()
}

export function cacheBelongsToScope(cacheName: string, scope: string): boolean {
  const scopeUrl = new URL(scope)
  return (
    cacheName.includes(`${scopeUrl.origin}${scopeUrl.pathname}`) ||
    cacheName.includes(scopeUrl.pathname)
  )
}

export async function clearCachesForScope(
  scope: string,
  cacheStorage: CacheStorage
): Promise<void> {
  const cacheNames = await cacheStorage.keys()
  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheBelongsToScope(cacheName, scope))
      .map((cacheName) => cacheStorage.delete(cacheName))
  )
}
