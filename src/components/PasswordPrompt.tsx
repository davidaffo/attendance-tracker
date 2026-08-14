import { useEffect, useRef, useState, type FormEvent } from 'react'
import { KeyRound, RefreshCw, X } from 'lucide-react'

interface PasswordPromptProps {
  username: string
  onSubmit: (password: string) => Promise<void>
  onCancel: () => void
}

export function PasswordPrompt({
  username,
  onSubmit,
  onCancel
}: PasswordPromptProps) {
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [onCancel])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit(password)
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Impossibile verificare la password applicativa.'
      )
      setPassword('')
      requestAnimationFrame(() => inputRef.current?.focus())
    } finally {
      setSubmitting(false)
    }
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
          disabled={submitting}
          aria-label="Annulla"
        >
          <X size={18} />
        </button>
        <div className="password-dialog-icon">
          <KeyRound size={24} />
        </div>
        <div>
          <h2 id="password-dialog-title">Password Nextcloud</h2>
          <p>
            Inserisci la password applicativa di <strong>{username}</strong>. Dopo la
            verifica resterà disponibile soltanto in questa scheda, anche se ricarichi
            la pagina, e verrà scartata quando la chiudi.
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
              onChange={(event) => {
                setPassword(event.target.value)
                setError('')
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'password-dialog-error' : undefined}
              disabled={submitting}
              required
            />
          </label>
          {error && (
            <p className="password-dialog-error" id="password-dialog-error" role="alert">
              {error}
            </p>
          )}
          <div className="inline-actions password-dialog-actions">
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting && <RefreshCw className="spin" size={16} />}
              {submitting ? 'Verifico…' : 'Continua e sincronizza'}
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={onCancel}
              disabled={submitting}
            >
              Non ora
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}
