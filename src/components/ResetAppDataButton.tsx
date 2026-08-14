import { useState } from 'react'
import { RotateCcw, Trash2, X } from 'lucide-react'

interface ResetAppDataButtonProps {
  onReset: () => Promise<void>
  className?: string
}

export function ResetAppDataButton({
  onReset,
  className = 'button danger'
}: ResetAppDataButtonProps) {
  const [confirming, setConfirming] = useState(false)
  const [resetting, setResetting] = useState(false)

  const reset = async () => {
    setResetting(true)
    try {
      await onReset()
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Resetta app"
      >
        <RotateCcw size={17} />
        <span>Resetta app</span>
      </button>

      {confirming && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="password-dialog reset-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-dialog-title"
          >
            <button
              className="icon-button quiet password-dialog-close"
              type="button"
              onClick={() => setConfirming(false)}
              aria-label="Chiudi"
            >
              <X size={18} />
            </button>
            <div className="reset-dialog-icon">
              <Trash2 size={24} />
            </div>
            <div>
              <div className="eyebrow">Azione irreversibile</div>
              <h2 id="reset-dialog-title">Cancellare tutti i dati locali?</h2>
              <p>
                Verranno rimossi registro, configurazioni, cache della vista in sola lettura,
                cartella ricordata e stato della guida. L’app tornerà alla schermata iniziale.
              </p>
              <p>
                I file già caricati su Nextcloud e le password salvate dal browser non verranno
                cancellati.
              </p>
            </div>
            <div className="inline-actions reset-dialog-actions">
              <button
                className="button danger"
                type="button"
                disabled={resetting}
                onClick={() => void reset()}
              >
                <Trash2 size={17} />
                {resetting ? 'Cancellazione…' : 'Cancella e ricomincia'}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={resetting}
                onClick={() => setConfirming(false)}
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
