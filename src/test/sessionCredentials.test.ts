import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SyncConfig } from '../domain/types'
import {
  clearSessionPasswords,
  loadSessionPassword,
  rememberSessionPassword
} from '../services/sessionCredentials'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key)
    },
    setItem: (key, value) => {
      values.set(key, value)
    }
  }
}

const config: SyncConfig = {
  baseUrl: 'https://cloud.example.it/',
  username: 'coordinatore',
  appPassword: 'password-app',
  remoteFolder: 'attendance-tracker'
}

beforeEach(() => {
  vi.stubGlobal('window', { sessionStorage: memoryStorage() })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('password Nextcloud della sessione browser', () => {
  it('sopravvive alla rilettura della configurazione nello stesso ruolo e account', () => {
    rememberSessionPassword('coordinator', config)

    expect(
      loadSessionPassword('coordinator', { ...config, appPassword: '' })
    ).toBe('password-app')
  })

  it('non riutilizza la password per un altro ruolo, server o account', () => {
    rememberSessionPassword('coordinator', config)

    expect(loadSessionPassword('viewer', { ...config, appPassword: '' })).toBeUndefined()
    expect(
      loadSessionPassword('coordinator', {
        ...config,
        baseUrl: 'https://altro.example.it',
        appPassword: ''
      })
    ).toBeUndefined()
    expect(
      loadSessionPassword('coordinator', {
        ...config,
        username: 'altro-utente',
        appPassword: ''
      })
    ).toBeUndefined()
  })

  it('cancella tutte le password quando si resetta la PWA', () => {
    rememberSessionPassword('coach', { ...config, username: 'allenatore' })
    rememberSessionPassword('coordinator', config)
    rememberSessionPassword('viewer', { ...config, username: 'giocatrice' })

    clearSessionPasswords()

    expect(
      loadSessionPassword('coach', { ...config, username: 'allenatore', appPassword: '' })
    ).toBeUndefined()
    expect(loadSessionPassword('coordinator', { ...config, appPassword: '' })).toBeUndefined()
    expect(
      loadSessionPassword('viewer', { ...config, username: 'giocatrice', appPassword: '' })
    ).toBeUndefined()
  })
})
