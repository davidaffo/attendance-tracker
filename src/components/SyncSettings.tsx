import { useEffect, useState, type FormEvent } from 'react'
import {
  Cloud,
  CloudUpload,
  Download,
  ExternalLink,
  ListChecks,
  Save
} from 'lucide-react'
import type { LocalSyncMeta, SyncConfig, SyncIndicator, TeamDocument } from '../domain/types'
import { serializeTeamDocument } from '../domain/document'
import { remoteFileName } from '../domain/defaults'
import { testWebDavConnection } from '../services/webdav'
import { ResetAppDataButton } from './ResetAppDataButton'
import { RestoreBackupButton } from './RestoreBackupButton'

interface SyncSettingsProps {
  document: TeamDocument
  config?: SyncConfig
  meta: LocalSyncMeta
  indicator: SyncIndicator
  onSaveConfig: (config: SyncConfig) => Promise<void>
  onPersistConnectionDetails: (config: SyncConfig) => Promise<void>
  onSync: () => Promise<void>
  onRestoreBackup: (document: TeamDocument) => Promise<void>
  onChooseMode: () => void
  onOpenOnboarding: () => void
  onResetAllData: () => Promise<void>
}

export function SyncSettings({
  document,
  config,
  meta,
  indicator,
  onSaveConfig,
  onPersistConnectionDetails,
  onSync,
  onRestoreBackup,
  onChooseMode,
  onOpenOnboarding,
  onResetAllData
}: SyncSettingsProps) {
  const [draft, setDraft] = useState<SyncConfig>(
    config ?? {
      baseUrl: '',
      username: '',
      appPassword: '',
      remoteFolder: 'attendance-tracker'
    }
  )
  const [message, setMessage] = useState('')
  const [testing, setTesting] = useState(false)

  const updateConnectionDetails = (
    patch: Partial<Pick<SyncConfig, 'baseUrl' | 'username' | 'remoteFolder'>>
  ) => {
    const next = { ...draft, ...patch }
    setDraft(next)
    void onPersistConnectionDetails({ ...next, appPassword: '' })
  }

  useEffect(() => {
    if (config) {
      setDraft((current) =>
        current.baseUrl === config.baseUrl &&
        current.username === config.username &&
        current.remoteFolder === config.remoteFolder
          ? { ...current, appPassword: config.appPassword || current.appPassword }
          : config
      )
    }
  }, [config])

  const saveAndTest = async (event: FormEvent) => {
    event.preventDefault()
    setTesting(true)
    setMessage('')
    try {
      await testWebDavConnection(draft)
      await onSaveConfig(draft)
      setMessage(
        'Connessione verificata e registro sincronizzato correttamente.'
      )
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
        <form className="form-grid" onSubmit={saveAndTest} autoComplete="on">
          <label className="field">
            <span>Indirizzo Nextcloud</span>
            <input
              type="url"
              placeholder="https://nx12345.your-storageshare.de"
              value={draft.baseUrl}
              onChange={(event) => updateConnectionDetails({ baseUrl: event.target.value })}
              required
            />
          </label>
          <div className="form-grid two-columns">
            <label className="field">
              <span>Nome utente</span>
              <input
                name="username"
                autoComplete="username"
                value={draft.username}
                onChange={(event) => updateConnectionDetails({ username: event.target.value })}
                required
              />
            </label>
            <label className="field">
              <span>Password applicativa</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={draft.appPassword}
                onChange={(event) => setDraft({ ...draft, appPassword: event.target.value })}
                required
              />
              <small>
                L’app non la salva. Il browser può proporti di ricordarla e compilarla.
              </small>
            </label>
          </div>
          <label className="field">
            <span>Cartella squadra</span>
            <input
              placeholder="attendance-tracker"
              value={draft.remoteFolder}
              onChange={(event) => updateConnectionDetails({ remoteFolder: event.target.value })}
            />
            <small>
              Cartella nella root dell’account. Per questo progetto:
              {' '}
              <code>attendance-tracker</code>.
            </small>
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
                {meta.restorePending ? 'Pubblica il ripristino' : 'Sincronizza ora'}
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
            <dd>
              {meta.restorePending
                ? 'Backup ripristinato, cloud sospeso'
                : meta.dirty
                  ? 'Modifiche da sincronizzare'
                  : 'Allineato'}
            </dd>
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
        {meta.lastError && (indicator === 'error' || indicator === 'conflict') && (
          <div className="sync-error-detail" role="alert">
            <strong>Ultimo errore di sincronizzazione</strong>
            <span>{meta.lastError}</span>
          </div>
        )}
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">Portabilità</div>
            <h2>Backup e ripristino</h2>
          </div>
        </div>
        <p className="section-copy">
          Scarica una copia completa del registro oppure ripristina una copia JSON salvata in
          precedenza. Il ripristino non modifica Nextcloud finché non lo confermi manualmente.
        </p>
        <div className="backup-actions">
          <button className="button secondary" type="button" onClick={downloadJson}>
            <Download size={17} />
            Scarica backup JSON
          </button>
          <RestoreBackupButton
            currentDocument={document}
            onRestore={onRestoreBackup}
          />
        </div>
      </section>

      <section className="panel settings-panel coordinator-switch">
        <div>
          <div className="eyebrow">Aiuto</div>
          <h2>Configurazione guidata</h2>
          <p>
            Rivedi passo per passo squadra, giorni, rosa e collegamento Nextcloud.
          </p>
        </div>
        <button className="button secondary" onClick={onOpenOnboarding}>
          Apri la guida
          <ListChecks size={17} />
        </button>
      </section>

      <section className="panel settings-panel coordinator-switch">
        <div>
          <div className="eyebrow">Questo computer</div>
          <h2>Cambia modalità</h2>
          <p>Torna alla scelta fra allenatore e coordinatore senza cancellare i dati locali.</p>
        </div>
        <button className="button secondary" onClick={onChooseMode}>
          Scegli modalità
          <ExternalLink size={17} />
        </button>
      </section>

      <section className="panel settings-panel coordinator-switch reset-panel">
        <div>
          <div className="eyebrow">Ripristino</div>
          <h2>Ricomincia da zero</h2>
          <p>
            Cancella tutti i dati conservati localmente e torna alla prima schermata dell’app.
          </p>
        </div>
        <ResetAppDataButton onReset={onResetAllData} />
      </section>
    </div>
  )
}
