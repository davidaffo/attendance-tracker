import { describe, expect, it } from 'vitest'
import {
  configForLocalStorage,
  coordinatorDetailsFromNextcloudLink,
  detailsFromNextcloudFolderLink,
  detailsFromNextcloudLink,
  metaForManualSync,
  metaForRestoredBackup,
  nextcloudLinkFromRouteHash,
  nextcloudQuickAccessUrl
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
  it('usa attendance-tracker dal solo indirizzo del coordinatore', () => {
    expect(coordinatorDetailsFromNextcloudLink('https://cloud.example.it/')).toEqual({
      baseUrl: 'https://cloud.example.it',
      remoteFolder: 'attendance-tracker'
    })
  })

  it('aggiunge attendance-tracker alla cartella padre senza duplicarla', () => {
    expect(
      coordinatorDetailsFromNextcloudLink(
        'https://cloud.example.it/apps/files/files/42?dir=%2FVolley%2FStagione%202026-2027'
      ).remoteFolder
    ).toBe('Volley/Stagione 2026-2027/attendance-tracker')
    expect(
      coordinatorDetailsFromNextcloudLink(
        'https://cloud.example.it/apps/files/files/42?dir=%2FVolley%2Fattendance-tracker'
      ).remoteFolder
    ).toBe('Volley/attendance-tracker')
  })

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

  it('accetta un file condiviso visibile nella radice dell’account', () => {
    expect(
      detailsFromNextcloudLink(
        'https://cloud.example.it/apps/files/files/42?dir=%2F&openfile=731'
      )
    ).toEqual({
      baseUrl: 'https://cloud.example.it',
      remoteFolder: ''
    })
  })

  it('accetta l’indirizzo del server per la ricerca automatica', () => {
    expect(detailsFromNextcloudLink('https://cloud.example.it/')).toEqual({
      baseUrl: 'https://cloud.example.it',
      remoteFolder: ''
    })
  })

  it('accetta l’indirizzo WebDAV di Nextcloud', () => {
    expect(
      detailsFromNextcloudLink(
        'https://cloud.example.it/nextcloud/remote.php/dav/files/giocatrice'
      )
    ).toEqual({
      baseUrl: 'https://cloud.example.it/nextcloud',
      remoteFolder: ''
    })
  })

  it('ricava il server da un link interno a un file', () => {
    expect(
      detailsFromNextcloudLink(
        'https://cloud.example.it/nextcloud/index.php/f/731'
      )
    ).toEqual({
      baseUrl: 'https://cloud.example.it/nextcloud',
      remoteFolder: ''
    })
  })

  it('spiega che un link pubblico non identifica il percorso WebDAV', () => {
    expect(() =>
      detailsFromNextcloudLink('https://cloud.example.it/s/token-pubblico')
    ).toThrow('Il link pubblico non identifica il file WebDAV')
  })
})

describe('link rapido alla vista in sola lettura', () => {
  it('inserisce soltanto l’indirizzo Nextcloud nel link dell’app', () => {
    expect(
      nextcloudQuickAccessUrl(
        'https://davidaffo.github.io/attendance-tracker/',
        'https://cloud.example.it'
      )
    ).toBe(
      'https://davidaffo.github.io/attendance-tracker/#/consultazione?nextcloud=https%3A%2F%2Fcloud.example.it'
    )
  })

  it('recupera l’indirizzo Nextcloud dal parametro della route', () => {
    expect(
      nextcloudLinkFromRouteHash(
        '#/consultazione?nextcloud=https%3A%2F%2Fcloud.example.it'
      )
    ).toBe('https://cloud.example.it')
    expect(nextcloudLinkFromRouteHash('#/consultazione')).toBeUndefined()
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
