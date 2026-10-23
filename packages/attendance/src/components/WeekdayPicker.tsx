import { WEEKDAYS } from '../domain/defaults'

interface WeekdayPickerProps {
  value: number[]
  onChange?: (weekdays: number[]) => void
  disabled?: boolean
}

export function WeekdayPicker({ value, onChange, disabled = false }: WeekdayPickerProps) {
  return (
    <div className="weekday-grid" aria-label="Giorni di allenamento">
      {WEEKDAYS.map((day) => {
        const selected = value.includes(day.value)
        return (
          <button
            className={`weekday-button ${selected ? 'selected' : ''}`}
            key={day.value}
            type="button"
            aria-label={day.label}
            aria-pressed={selected}
            disabled={disabled}
            onClick={() =>
              onChange?.(
                selected
                  ? value.filter((weekday) => weekday !== day.value)
                  : [...value, day.value].sort()
              )
            }
          >
            {day.short}
          </button>
        )
      })}
    </div>
  )
}
