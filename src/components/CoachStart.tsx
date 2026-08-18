import { ArrowLeft, Cloud, Settings2 } from 'lucide-react'
import type { TeamDocument } from '../domain/types'
import { RestoreBackupButton } from './RestoreBackupButton'

interface CoachStartProps {
  onCreateTeam: () => void
  onOpenSharedTeam: () => void
  onChooseMode: () => void
  onRestoreBackup: (document: TeamDocument) => Promise<void>
}

export function CoachStart({
  onCreateTeam,
  onOpenSharedTeam,
  onChooseMode,
  onRestoreBackup
}: CoachStartProps) {
  return (
    <main className="setup-page">
      <section className="setup-card coach-start-card">
        <div>
          <span className="eyebrow">Configurazione allenatore</span>
          <h1>Come vuoi iniziare?</h1>
          <p className="section-copy">
            Puoi creare e gestire una squadra in autonomia oppure aprire il registro già
            preparato e condiviso dal coordinatore.
          </p>
        </div>

        <div className="coach-start-options">
          <button className="mode-card" type="button" onClick={onCreateTeam}>
            <Settings2 size={26} />
            <strong>Crea una nuova squadra</strong>
            <span>Inserisci squadra, stagione e rosa.</span>
          </button>
          <button className="mode-card" type="button" onClick={onOpenSharedTeam}>
            <Cloud size={26} />
            <strong>Apri una squadra condivisa</strong>
            <span>Accedi a Nextcloud e usa il registro preparato dal coordinatore.</span>
          </button>
        </div>

        <div className="setup-restore">
          <span>Hai già un backup del Registro Presenze?</span>
          <RestoreBackupButton onRestore={onRestoreBackup} label="Ripristina da JSON" />
        </div>

        <button className="button ghost coach-start-back" type="button" onClick={onChooseMode}>
          <ArrowLeft size={17} />
          Torna alla scelta modalità
        </button>
      </section>
    </main>
  )
}
