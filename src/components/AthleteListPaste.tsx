import { useMemo, useState } from 'react'
import { ClipboardPaste, Plus } from 'lucide-react'
import { normalizeAthleteName, parseAthleteList } from '../domain/athleteList'

interface AthleteListPasteProps {
  existingNames: string[]
  onAdd: (names: string[]) => void
}

export function AthleteListPaste({ existingNames, onAdd }: AthleteListPasteProps) {
  const [value, setValue] = useState('')
  const [addedCount, setAddedCount] = useState(0)
  const parsedNames = useMemo(() => parseAthleteList(value), [value])
  const existing = useMemo(
    () => new Set(existingNames.filter(Boolean).map(normalizeAthleteName)),
    [existingNames]
  )
  const newNames = parsedNames.filter((name) => !existing.has(normalizeAthleteName(name)))
  const skippedCount = parsedNames.length - newNames.length

  const addNames = () => {
    if (!newNames.length) return
    onAdd(newNames)
    setAddedCount(newNames.length)
    setValue('')
  }

  return (
    <details className="athlete-list-paste">
      <summary>
        <ClipboardPaste size={17} />
        Incolla un elenco di giocatrici
      </summary>
      <div className="athlete-list-paste-content">
        <label className="field">
          <span>Una giocatrice per riga</span>
          <textarea
            rows={6}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              setAddedCount(0)
            }}
            placeholder={'Giulia Rossi\nMarta Bianchi\nSara Verdi'}
          />
        </label>
        <div className="athlete-list-paste-actions">
          <small>
            {skippedCount > 0
              ? `${skippedCount} ${skippedCount === 1 ? 'nome già presente' : 'nomi già presenti'} non verranno aggiunti.`
              : addedCount > 0
                ? `${addedCount} ${addedCount === 1 ? 'giocatrice aggiunta' : 'giocatrici aggiunte'}.`
                : 'Sono accettati anche elenchi numerati o con punti elenco.'}
          </small>
          <button
            className="button secondary compact"
            type="button"
            onClick={addNames}
            disabled={!newNames.length}
          >
            <Plus size={16} />
            Aggiungi{newNames.length ? ` ${newNames.length}` : ''}
          </button>
        </div>
      </div>
    </details>
  )
}
