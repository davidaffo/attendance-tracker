import { useState } from 'react'
import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import type { TeamDocument, TeamSummary } from '../domain/types'

interface CoachTeamSwitcherProps {
  currentDocument: TeamDocument
  teams: TeamSummary[]
  loading: boolean
  error?: string
  onLoad: () => Promise<void>
  onSelect: (team: TeamSummary) => Promise<void>
}

export function CoachTeamSwitcher({
  currentDocument,
  teams,
  loading,
  error,
  onLoad,
  onSelect
}: CoachTeamSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [switchingSource, setSwitchingSource] = useState<string>()
  const [selectionError, setSelectionError] = useState<string>()

  const toggle = async () => {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    await onLoad()
  }

  const select = async (team: TeamSummary) => {
    const source = `${team.remoteFolder ?? ''}/${team.source}`
    setSwitchingSource(source)
    setSelectionError(undefined)
    try {
      await onSelect(team)
      setOpen(false)
    } catch (error) {
      setSelectionError(
        error instanceof Error ? error.message : 'Cambio squadra non riuscito.'
      )
    } finally {
      setSwitchingSource(undefined)
    }
  }

  return (
    <section className={`sidebar-team-switcher ${open ? 'open' : ''}`}>
      <button
        className="sidebar-team-current"
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
      >
        <span>
          <small>Squadra attiva</small>
          <strong>{currentDocument.teamName}</strong>
          <i>{currentDocument.season.startYear}–{currentDocument.season.endYear}</i>
        </span>
        {loading ? <LoaderCircle className="spin" size={17} /> : <ChevronDown size={17} />}
      </button>

      {open && (
        <div className="sidebar-team-options">
          {(error || selectionError) && <p role="alert">{error ?? selectionError}</p>}
          {!loading && !error && !selectionError && teams.length === 0 && (
            <p>Nessun altro registro trovato.</p>
          )}
          {teams.map((team) => {
            const source = `${team.remoteFolder ?? ''}/${team.source}`
            const current =
              team.document.teamId === currentDocument.teamId &&
              team.document.season.startYear === currentDocument.season.startYear
            return (
              <button
                type="button"
                key={source}
                disabled={Boolean(switchingSource)}
                onClick={() => void select(team)}
              >
                <span>
                  <strong>{team.document.teamName}</strong>
                  <small>
                    {team.document.season.startYear}–{team.document.season.endYear}
                  </small>
                </span>
                {switchingSource === source ? (
                  <LoaderCircle className="spin" size={15} />
                ) : current ? (
                  <Check size={15} />
                ) : null}
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
