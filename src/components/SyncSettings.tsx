import { useEffect, useState, type FormEvent } from 'react'
import { Cloud, CloudUpload, Download, ExternalLink, Save } from 'lucide-react'
import type { LocalSyncMeta, SyncConfig, SyncIndicator, TeamDocument } from '../domain/types'
import { serializeTeamDocument } from '../domain/document'
import { remoteFileName } from '../domain/defaults'
import { testWebDavConnection } from '../services/webdav'

interface SyncSettingsProps {
  document: TeamDocument
  config?: SyncConfig
  meta: LocalSyncMeta
  indicator: SyncIndicator
  onSaveConfig: (config: SyncConfig) => Promise<void>
  onSync: () => Promise<void>
  onCoordinatorMode: () => void
}

export function SyncSettings({
  document,
  config,
  meta,
  indicator,
  onSaveConfig,
  onSync,
  onCoordinatorMode
}: SyncSettingsProps) {
  const [draft, setDraft] = useState<SyncConfig>(
    config ?? { baseUrl: '', username: '', appPassword: '', remoteFolder: '' }
  )
  const [message, setMessage] = useState('')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (config) setDraft(config)
  }, [config])

  const saveAndTest = async (event: FormEvent) => {
    event.preventDefault()
    setTesting(true)
    setMessage('')
    try {
      await testWebDavConnection(draft)
      await onSaveConfig(draft)
      setMessage('Connessione riuscita. Configurazione salvata su questo dispositivo.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Connessione non riuscita.')
    } finally {
      setTesting(false)
    }
  }

  const downloadJson = () => {
    const blob = new Blob([serializeTeamDocument(document)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = window.document.createElement('a')
    anchor.href = url
    anchor.download = remoteFileName(document)
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="page-content">
      <div className="page-title-row">
        <div>
          <div className="eyebrow">Impostazioni</div>
          <h1>Cloud e dati</h1>
        </div>
      </div>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Nextcloud</div>
            <h2>Sincronizzazione WebDAV</h2>
          </div>
          <Cloud size={24} />
        </div>
        <p className="section-copy">
          Usa una password applicativa revocabile creata in Nextcloud, non la password principale.
          WebAppPassword deve autorizzare il dominio di questa PWA.
        </p>
        <form className="form-grid" onSubmit={saveAndTest}>
          <label className="field">
            <span>Indirizzo Nextcloud</span>
            <input
              type="url"
              placeholder="https://nx12345.your-storageshare.de"
              value={draft.baseUrl}
              onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })}
              required
            />
          </label>
          <div className="form-grid two-columns">
            <label className="field">
              <span>Nome utente</span>
              <input
                autoComplete="username"
                value={draft.username}
                onChange={(event) => setDraft({ ...draft, username: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Password applicativa</span>
              <input
                type="password"
                autoComplete="current-password"
                value={draft.appPassword}
                onChange={(event) => setDraft({ ...draft, appPassword: event.target.value })}
                required
              />
            </label>
          </div>
          <label className="field">
            <span>Cartella squadra</span>
            <input
              placeholder="Squadre/U14"
              value={draft.remoteFolder}
              onChange={(event) => setDraft({ ...draft, remoteFolder: event.target.value })}
            />
            <small>Percorso relativo alla cartella principale dell’account.</small>
          </label>
          <div className="inline-actions">
            <button className="button primary" type="submit" disabled={testing}>
              <Save size={17} />
              {testing ? 'Verifica…' : 'Verifica e salva'}
            </button>
            {config && (
              <button
                className="button secondary"
                type="button"
                disabled={indicator === 'syncing'}
                onClick={onSync}
              >
                <CloudUpload size={17} />
                Sincronizza ora
              </button>
            )}
          </div>
          {message && <p className="form-message">{message}</p>}
        </form>

        <dl className="sync-details">
          <div>
            <dt>File remoto</dt>
            <dd>{remoteFileName(document)}</dd>
          </div>
          <div>
            <dt>Stato locale</dt>
            <dd>{meta.dirty ? 'Modifiche da sincronizzare' : 'Allineato'}</dd>
          </div>
          <div>
            <dt>Ultima sincronizzazione</dt>
            <dd>
              {meta.lastSyncedAt
                ? new Intl.DateTimeFormat('it-IT', {
                    dateStyle: 'short',
                    timeStyle: 'short'
                  }).format(new Date(meta.lastSyncedAt))
                : 'Mai'}
            </dd>
          </div>
        </dl>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Portabilità</div>
            <h2>Copia del file</h2>
          </div>
        </div>
        <p className="section-copy">
          Scarica una copia leggibile del documento della squadra. Non serve per la sincronizzazione
          ordinaria.
        </p>
        <button className="button secondary" onClick={downloadJson}>
          <Download size={17} />
          Scarica JSON
        </button>
      </section>

      <section className="panel settings-panel coordinator-switch">
        <div>
          <div className="eyebrow">Questo computer</div>
          <h2>Vista coordinatore</h2>
          <p>Leggi e riunisci i file già sincronizzati dal client Nextcloud Desktop.</p>
        </div>
        <button className="button secondary" onClick={onCoordinatorMode}>
          Apri
          <ExternalLink size={17} />
        </button>
      </section>
    </div>
  )
}
