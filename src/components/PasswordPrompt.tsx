import { useEffect, useRef, useState, type FormEvent } from 'react'
import { KeyRound, X } from 'lucide-react'

interface PasswordPromptProps {
  username: string
  onSubmit: (password: string) => void
  onCancel: () => void
}

export function PasswordPrompt({
  username,
  onSubmit,
  onCancel
}: PasswordPromptProps) {
  const [password, setPassword] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onCancel])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (password) onSubmit(password)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="password-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="password-dialog-title"
      >
        <button
          className="icon-button quiet password-dialog-close"
          type="button"
          onClick={onCancel}
          aria-label="Annulla"
        >
          <X size={18} />
        </button>
        <div className="password-dialog-icon">
          <KeyRound size={24} />
        </div>
        <div>
          <div className="eyebrow">Nextcloud</div>
          <h2 id="password-dialog-title">Serve la password per sincronizzare</h2>
          <p>
            Inserisci la password applicativa di <strong>{username}</strong>. Puoi lasciare che
            sia il browser a salvarla e compilarla in futuro.
          </p>
        </div>
        <form onSubmit={submit} autoComplete="on">
          <input
            className="visually-hidden"
            name="username"
            autoComplete="username"
            value={username}
            readOnly
            tabIndex={-1}
          />
          <label className="field">
            <span>Password applicativa</span>
            <input
              ref={inputRef}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <div className="inline-actions password-dialog-actions">
            <button className="button primary" type="submit">
              Continua e sincronizza
            </button>
            <button className="button secondary" type="button" onClick={onCancel}>
              Non ora
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
