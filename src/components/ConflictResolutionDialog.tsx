import { AlertTriangle, CloudDownload, GitMerge, Upload } from 'lucide-react'
import type { ConflictResolution } from '../services/webdav'

interface ConflictResolutionDialogProps {
  syncConflicts?: string[]
  teamName: string
  busy?: boolean
  error?: string
  onResolve: (resolution: ConflictResolution) => void
  onClose: () => void
}

export function ConflictResolutionDialog({
  syncConflicts,
  teamName,
  busy = false,
  error,
  onResolve,
  onClose
}: ConflictResolutionDialogProps) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose()
    }}>
      <section
        className="password-dialog conflict-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="conflict-dialog-title"
      >
        <div className="password-dialog-icon"><AlertTriangle size={22} /></div>
        <div>
          <h2 id="conflict-dialog-title">Modifiche contemporanee</h2>
          <p>
            Il registro di <strong>{teamName}</strong> contiene modifiche contemporanee.
            Scegli quale versione mantenere{syncConflicts ? ' per i dati in conflitto; le altre modifiche vengono unite automaticamente' : ''}.
          </p>
        </div>
        {syncConflicts && <p className="section-copy">{[...new Set(syncConflicts.map(path => path.startsWith('sessions.') ? path.split('.')[1] : 'Impostazioni del registro'))].join(', ')}</p>}
        {error && <p className="password-dialog-error" role="alert">{error}</p>}
        <div className="conflict-options">
          {!syncConflicts && <><button className="button primary" disabled={busy} onClick={() => onResolve('merge')}>
            <GitMerge size={17} />
            Unisci e salva
          </button>
          <small>Mantiene le modifiche più recenti e tutte le sessioni compatibili.</small></>}
          <button className="button secondary" disabled={busy} onClick={() => onResolve('remote')}>
            <CloudDownload size={17} />
            {syncConflicts ? 'Mantieni i dati cloud in conflitto' : 'Usa versione cloud'}
          </button>
          <small>{syncConflicts ? 'Conserva anche le modifiche locali compatibili.' : 'Scarta le modifiche appena fatte in questa schermata.'}</small>
          <button className="button danger" disabled={busy} onClick={() => onResolve('local')}>
            <Upload size={17} />
            {syncConflicts ? 'Mantieni i dati locali in conflitto' : 'Sovrascrivi il cloud'}
          </button>
          <small>{syncConflicts ? 'Conserva anche le modifiche cloud compatibili.' : 'Sostituisce la versione cloud con quella modificata qui.'}</small>
        </div>
        <button className="button ghost" disabled={busy} onClick={onClose}>Annulla</button>
      </section>
    </div>
  )
}
