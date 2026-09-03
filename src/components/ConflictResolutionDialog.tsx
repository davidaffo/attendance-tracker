import { AlertTriangle, CloudDownload, GitMerge, Upload } from 'lucide-react'
import type { ConflictResolution } from '../services/webdav'

interface ConflictResolutionDialogProps {
  teamName: string
  busy?: boolean
  error?: string
  onResolve: (resolution: ConflictResolution) => void
  onClose: () => void
}

export function ConflictResolutionDialog({
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
            Il registro di <strong>{teamName}</strong> è cambiato su Nextcloud mentre lo
            stavi salvando. Scegli quale versione mantenere.
          </p>
        </div>
        {error && <p className="password-dialog-error" role="alert">{error}</p>}
        <div className="conflict-options">
          <button className="button primary" disabled={busy} onClick={() => onResolve('merge')}>
            <GitMerge size={17} />
            Unisci e salva
          </button>
          <small>Mantiene le modifiche più recenti e tutte le sessioni compatibili.</small>
          <button className="button secondary" disabled={busy} onClick={() => onResolve('remote')}>
            <CloudDownload size={17} />
            Usa versione cloud
          </button>
          <small>Scarta le modifiche appena fatte in questa schermata.</small>
          <button className="button danger" disabled={busy} onClick={() => onResolve('local')}>
            <Upload size={17} />
            Sovrascrivi il cloud
          </button>
          <small>Sostituisce la versione cloud con quella modificata qui.</small>
        </div>
        <button className="button ghost" disabled={busy} onClick={onClose}>Annulla</button>
      </section>
    </div>
  )
}
