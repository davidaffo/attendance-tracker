import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { FileUp, RotateCcw, X } from 'lucide-react'
import { parseTeamDocument } from '../domain/document'
import type { TeamDocument } from '../domain/types'

interface RestoreBackupButtonProps {
  currentDocument?: TeamDocument
  onRestore: (document: TeamDocument) => Promise<void>
  className?: string
  label?: string
}

interface SelectedBackup {
  fileName: string
  document: TeamDocument
}

const updatedAtFormatter = new Intl.DateTimeFormat('it-IT', {
  dateStyle: 'short',
  timeStyle: 'short'
})

function formattedUpdatedAt(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Non disponibile' : updatedAtFormatter.format(date)
}

export function RestoreBackupButton({
  currentDocument,
  onRestore,
  className = 'button secondary',
  label = 'Ripristina da JSON'
}: RestoreBackupButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState<SelectedBackup>()
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    if (!selected) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !restoring) setSelected(undefined)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [selected, restoring])

  const close = () => {
    if (!restoring) setSelected(undefined)
  }

  const chooseBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setMessage('')
    setIsError(false)
    try {
      const document = parseTeamDocument(await file.text())
      setSelected({ fileName: file.name, document })
    } catch {
      setIsError(true)
      setMessage(
        'Il file scelto non è un backup valido del Registro Presenze oppure è danneggiato.'
      )
    }
  }

  const restore = async () => {
    if (!selected) return
    setRestoring(true)
    setMessage('')
    setIsError(false)
    try {
      await onRestore(selected.document)
      setSelected(undefined)
      setMessage(`Backup di ${selected.document.teamName} ripristinato sul dispositivo.`)
    } catch (error) {
      setIsError(true)
      setMessage(error instanceof Error ? error.message : 'Ripristino non riuscito.')
    } finally {
      setRestoring(false)
    }
  }

  const activeAthletes = selected?.document.athletes.filter((athlete) => athlete.active).length
  const replacesDifferentTeam =
    currentDocument &&
    selected &&
    currentDocument.teamId !== selected.document.teamId

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={() => inputRef.current?.click()}
      >
        <FileUp size={17} />
        {label}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        onChange={(event) => void chooseBackup(event)}
      />
      {message && (
        <p className={`restore-message${isError ? ' error' : ''}`} role={isError ? 'alert' : 'status'}>
          {message}
        </p>
      )}

      {selected && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="password-dialog restore-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="restore-dialog-title"
          >
            <button
              className="icon-button quiet password-dialog-close"
              type="button"
              onClick={close}
              disabled={restoring}
              aria-label="Chiudi"
            >
              <X size={18} />
            </button>
            <div className="password-dialog-icon">
              <RotateCcw size={24} />
            </div>
            <div>
              <div className="eyebrow">Backup valido</div>
              <h2 id="restore-dialog-title">Ripristinare questo registro?</h2>
              <p>
                Controlla i dati prima di sostituire il registro conservato su questo
                dispositivo.
              </p>
            </div>

            <dl className="restore-preview">
              <div>
                <dt>File</dt>
                <dd>{selected.fileName}</dd>
              </div>
              <div>
                <dt>Squadra</dt>
                <dd>{selected.document.teamName}</dd>
              </div>
              <div>
                <dt>Stagione</dt>
                <dd>
                  {selected.document.season.startYear}–{selected.document.season.endYear}
                </dd>
              </div>
              <div>
                <dt>Contenuto</dt>
                <dd>
                  {activeAthletes} atlete · {selected.document.sessions.length} allenamenti
                </dd>
              </div>
              <div>
                <dt>Ultimo aggiornamento</dt>
                <dd>{formattedUpdatedAt(selected.document.updatedAt)}</dd>
              </div>
            </dl>

            <div className="restore-warning">
              <strong>
                {replacesDifferentTeam
                  ? `Il registro ${currentDocument.teamName} verrà sostituito.`
                  : 'Il registro locale attuale verrà sostituito.'}
              </strong>
              <span>
                Nextcloud non verrà modificato automaticamente. Dopo il ripristino dovrai
                premere “Sincronizza ora” per pubblicare volontariamente questa copia.
              </span>
            </div>

            <div className="inline-actions reset-dialog-actions">
              <button
                className="button primary"
                type="button"
                disabled={restoring}
                onClick={() => void restore()}
              >
                <RotateCcw size={17} />
                {restoring ? 'Ripristino…' : 'Ripristina questo backup'}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={restoring}
                onClick={close}
              >
                Annulla
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
