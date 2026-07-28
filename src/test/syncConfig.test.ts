import { describe, expect, it } from 'vitest'
import {
  configForLocalStorage,
  metaForManualSync,
  metaForRestoredBackup
} from '../domain/syncConfig'

const config = {
  baseUrl: 'https://cloud.example.it',
  username: 'allenatore',
  appPassword: 'segreto',
  remoteFolder: 'attendance-tracker'
}

describe('persistenza configurazione cloud', () => {
  it('rimuove sempre la password applicativa', () => {
    expect(configForLocalStorage(config)).toEqual({
      ...config,
      appPassword: ''
    })
  })

  it('non modifica gli altri dati della connessione', () => {
    expect(configForLocalStorage(config)).toMatchObject({
      baseUrl: config.baseUrl,
      username: config.username,
      remoteFolder: config.remoteFolder
    })
  })
})

describe('sincronizzazione dopo un ripristino', () => {
  it('sospende la sincronizzazione automatica del backup ripristinato', () => {
    expect(metaForRestoredBackup()).toEqual({
      dirty: true,
      restorePending: true
    })
  })

  it('riabilita la sincronizzazione soltanto dopo il comando manuale', () => {
    expect(
      metaForManualSync({
        dirty: true,
        restorePending: true,
        etag: 'vecchio-etag',
        lastSyncedAt: '2026-07-28T12:00:00.000Z',
        lastError: 'errore precedente'
      })
    ).toEqual({
      dirty: true
    })
  })
})
