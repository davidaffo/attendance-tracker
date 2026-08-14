import type { SyncConfig } from '../domain/types'

export type CredentialOwner = 'coach' | 'coordinator' | 'viewer'

interface SessionCredential {
  baseUrl: string
  username: string
  appPassword: string
}

const storagePrefix = 'registro-presenze:nextcloud-session:v1:'

function credentialKey(owner: CredentialOwner): string {
  return `${storagePrefix}${owner}`
}

function normalizedBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

function sessionStorageIfAvailable(): Storage | undefined {
  if (typeof window === 'undefined') return undefined
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

export function loadSessionPassword(
  owner: CredentialOwner,
  config: SyncConfig
): string | undefined {
  const storage = sessionStorageIfAvailable()
  if (!storage) return undefined
  try {
    const serialized = storage.getItem(credentialKey(owner))
    if (!serialized) return undefined
    const credential = JSON.parse(serialized) as Partial<SessionCredential>
    if (
      credential.baseUrl !== normalizedBaseUrl(config.baseUrl) ||
      credential.username !== config.username.trim() ||
      typeof credential.appPassword !== 'string' ||
      !credential.appPassword
    ) {
      return undefined
    }
    return credential.appPassword
  } catch {
    return undefined
  }
}

export function rememberSessionPassword(
  owner: CredentialOwner,
  config: SyncConfig
): void {
  if (!config.appPassword) return
  const storage = sessionStorageIfAvailable()
  if (!storage) return
  try {
    storage.setItem(
      credentialKey(owner),
      JSON.stringify({
        baseUrl: normalizedBaseUrl(config.baseUrl),
        username: config.username.trim(),
        appPassword: config.appPassword
      } satisfies SessionCredential)
    )
  } catch {
    // La PWA continua a funzionare chiedendo la password se lo storage è bloccato.
  }
}

export function forgetSessionPassword(owner: CredentialOwner): void {
  const storage = sessionStorageIfAvailable()
  if (!storage) return
  try {
    storage.removeItem(credentialKey(owner))
  } catch {
    // Nessuna sessione da cancellare se lo storage non è disponibile.
  }
}

export function clearSessionPasswords(): void {
  const storage = sessionStorageIfAvailable()
  if (!storage) return
  try {
    for (const owner of ['coach', 'coordinator', 'viewer'] as const) {
      storage.removeItem(credentialKey(owner))
    }
  } catch {
    // Il reset dei dati IndexedDB deve comunque proseguire.
  }
}
