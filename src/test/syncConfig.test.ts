import { describe, expect, it } from 'vitest'
import {
  configForLocalStorage,
  detailsFromNextcloudFolderLink,
  metaForManualSync,
  metaForRestoredBackup
} from '../domain/syncConfig'

const config = {
  baseUrl: 'https://cloud.example.it',
  username: 'allenatore',
  appPassword: 'segreto',
  remoteFolder: 'attendance-tracker',
  folderLink:
    'https://cloud.example.it/apps/files/files/42?dir=/attendance-tracker'
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
      remoteFolder: config.remoteFolder,
      folderLink: config.folderLink
    })
  })
})

describe('link della cartella Nextcloud', () => {
  it('estrae server e percorso dal link dell’app File', () => {
    expect(
      detailsFromNextcloudFolderLink(
        'https://nx100087.your-storageshare.de/apps/files/files/131125?dir=/Volley/Stagioni/2026-2027/attendance-tracker'
      )
    ).toEqual({
      baseUrl: 'https://nx100087.your-storageshare.de',
      remoteFolder: 'Volley/Stagioni/2026-2027/attendance-tracker'
    })
  })

  it('supporta Nextcloud installato in una sottocartella e percorsi codificati', () => {
    expect(
      detailsFromNextcloudFolderLink(
        'https://cloud.example.it/nextcloud/index.php/apps/files/files/42?dir=%2FVolley%20Club%2FStagione%202026-2027'
      )
    ).toEqual({
      baseUrl: 'https://cloud.example.it/nextcloud',
      remoteFolder: 'Volley Club/Stagione 2026-2027'
    })
  })

  it('rifiuta un indirizzo generico privo del percorso della cartella', () => {
    expect(() =>
      detailsFromNextcloudFolderLink('https://cloud.example.it/apps/files/')
    ).toThrow('Incolla il link aperto dalla cartella')
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
