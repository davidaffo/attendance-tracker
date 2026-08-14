import type { SyncConfig } from '../domain/types'

export function normalizeNextcloudBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  const url = new URL(trimmed)
  if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
    throw new Error('L’indirizzo Nextcloud deve usare HTTPS.')
  }
  return url.toString().replace(/\/$/, '')
}

export function nextcloudAuthorization(config: SyncConfig): string {
  const bytes = new TextEncoder().encode(`${config.username}:${config.appPassword}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return `Basic ${btoa(binary)}`
}
