import { useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, Check, FolderOpen, RefreshCw, ShieldCheck, Users } from 'lucide-react'
import { totalsForDocument } from '../domain/document'
import type { TeamSummary } from '../domain/types'
import { parseSelectedFiles, pickAndScanDirectory } from '../services/localFiles'

interface CoordinatorDashboardProps {
  onCoachMode: () => void
}

export function CoordinatorDashboard({ onCoachMode }: CoordinatorDashboardProps) {
  const [teams, setTeams] = useState<TeamSummary[]>([])
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const loadFolder = async () => {
    setLoading(true)
    setMessage('')
    try {
      const found = await pickAndScanDirectory()
      setTeams(found)
      setMessage(
        found.length
          ? `${found.length} file squadra caricati.`
          : 'Nessun file .attendance.json trovato nella cartella.'
      )
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setMessage(error instanceof Error ? error.message : 'Cartella non leggibile.')
      inputRef.current?.click()
    } finally {
      setLoading(false)
    }
  }

  const loadFallback = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return
    setLoading(true)
    const found = await parseSelectedFiles(event.target.files)
    setTeams(found)
    setMessage(
      found.length
        ? `${found.length} file squadra caricati.`
        : 'Nessun file .attendance.json valido trovato.'
    )
    setLoading(false)
  }

  const totalSessions = teams.reduce(
    (sum, team) => sum + team.document.sessions.length,
    0
  )
  const totalAthletes = teams.reduce(
    (sum, team) => sum + team.document.athletes.filter((athlete) => athlete.active).length,
    0
  )

  return (
    <div className="coordinator-page">
      <header className="coordinator-header">
        <div className="brand-lockup">
          <div className="brand-mark small">
            <Check size={20} strokeWidth={3} />
          </div>
          <div>
            <strong>Registro Presenze</strong>
            <span>Coordinamento tecnico</span>
          </div>
        </div>
        <button className="button ghost dark-ghost" onClick={onCoachMode}>
          <ArrowLeft size={17} />
          Vista allenatore
        </button>
      </header>

      <main className="coordinator-main">
        <section className="coordinator-hero">
          <div>
            <div className="eyebrow">Dati locali sincronizzati</div>
            <h1>Tutte le squadre,<br />in un solo posto.</h1>
            <p>
              Seleziona la cartella Presenze scaricata da Nextcloud Desktop. La lettura resta su
              questo computer.
            </p>
          </div>
          <button className="button light folder-button" onClick={loadFolder} disabled={loading}>
            {loading ? <RefreshCw className="spin" size={19} /> : <FolderOpen size={20} />}
            {teams.length ? 'Aggiorna cartella' : 'Scegli cartella'}
          </button>
          <input
            ref={inputRef}
            className="visually-hidden"
            type="file"
            multiple
            onChange={loadFallback}
            {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        </section>

        {message && <div className="coordinator-message">{message}</div>}

        <section className="coordinator-metrics">
          <article>
            <span>Squadre</span>
            <strong>{teams.length}</strong>
          </article>
          <article>
            <span>Atlete attive</span>
            <strong>{totalAthletes}</strong>
          </article>
          <article>
            <span>Allenamenti</span>
            <strong>{totalSessions}</strong>
          </article>
          <article className="privacy-metric">
            <ShieldCheck size={22} />
            <span>Sola lettura locale</span>
          </article>
        </section>

        <section className="coordinator-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">Riepilogo</div>
              <h2>Squadre</h2>
            </div>
          </div>

          {teams.length === 0 ? (
            <div className="empty-coordinator">
              <FolderOpen size={38} />
              <h2>Nessuna cartella selezionata</h2>
              <p>I file delle squadre compariranno qui dopo la scansione.</p>
            </div>
          ) : (
            <div className="team-summary-grid">
              {teams.map(({ source, document }) => {
                const totals = totalsForDocument(document)
                const athletes = document.athletes.filter((athlete) => athlete.active).length
                return (
                  <article className="team-summary-card" key={source}>
                    <div className="team-card-heading">
                      <div>
                        <span>{document.organizationName}</span>
                        <h3>{document.teamName}</h3>
                      </div>
                      <span className="season-pill">
                        {document.season.startYear}–{String(document.season.endYear).slice(-2)}
                      </span>
                    </div>
                    <div className="team-card-metrics">
                      <span>
                        <Users size={16} /> {athletes} atlete
                      </span>
                      <span>{totals.sessions} allenamenti</span>
                    </div>
                    <div className="team-status-totals">
                      {document.statuses.map((status) => (
                        <span key={status.id} title={status.label}>
                          <i style={{ background: status.color }}>{status.code}</i>
                          {totals.byStatus[status.id] ?? 0}
                        </span>
                      ))}
                    </div>
                    <div className="team-card-footer">
                      <span>{document.coachName}</span>
                      <span>
                        Aggiornato{' '}
                        {new Intl.DateTimeFormat('it-IT', { dateStyle: 'short' }).format(
                          new Date(document.updatedAt)
                        )}
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
