import { normalizeNextcloudBaseUrl } from './nextcloud'

export type StartupSyncOutcome =
  | { status: 'synced' | 'skipped' | 'cancelled' }
  | { status: 'error'; message: string }

export async function prepareStartupConnection(
  baseUrl: string | undefined,
  onOnline: () => void,
  synchronize?: () => Promise<StartupSyncOutcome>
): Promise<{ online: boolean; message: string }> {
  const online = await checkConnection(baseUrl)
  if (!online) {
    return {
      online,
      message: 'Connessione non disponibile. Prosegui offline con i dati salvati su questo dispositivo. Le modifiche restano in attesa di sincronizzazione.'
    }
  }

  onOnline()
  if (!synchronize) return { online, message: 'Connessione disponibile.' }
  let outcome: StartupSyncOutcome
  try {
    outcome = await synchronize()
  } catch (error) {
    outcome = { status: 'error', message: error instanceof Error ? error.message : 'Sincronizzazione non riuscita.' }
  }
  return {
    online,
    message: outcome.status === 'synced'
      ? 'Connessione disponibile. Registro sincronizzato con Nextcloud.'
      : outcome.status === 'error'
        ? `Sincronizzazione non riuscita: ${outcome.message} Prosegui con la copia locale; le modifiche restano sul dispositivo.`
        : outcome.status === 'cancelled'
          ? 'Sincronizzazione annullata. Prosegui con la copia locale; le modifiche restano in attesa di sincronizzazione.'
          : 'Connessione disponibile. Sincronizzazione sospesa; prosegui con la copia locale.'
  }
}

/** Verifica la rete senza credenziali e senza usare la cache della PWA. */
export async function checkConnection(baseUrl?: string, timeoutMs = 5000): Promise<boolean> {
  if (!navigator.onLine) return false

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const url = baseUrl
      ? new URL(`${normalizeNextcloudBaseUrl(baseUrl)}/status.php`)
      : new URL(import.meta.env.BASE_URL, window.location.origin)
    url.searchParams.set('connection-check', String(Date.now()))
    const response = await fetch(url, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal
    })
    // Una risposta opaca conferma che il server risponde anche senza CORS.
    return response.type === 'opaque' || response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timeout)
  }
}
