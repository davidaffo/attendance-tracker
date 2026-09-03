interface TrainingPeriodFieldsProps {
  startYear: number
  startDate: string
  endDate: string
  disabled?: boolean
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}

export function TrainingPeriodFields({
  startYear,
  startDate,
  endDate,
  disabled = false,
  onStartDateChange,
  onEndDateChange
}: TrainingPeriodFieldsProps) {
  const seasonStart = `${startYear}-08-01`
  const seasonEnd = `${startYear + 1}-07-31`

  return (
    <div className="form-grid two-columns training-period-fields">
      <label className="field">
        <span>Inizio calendario</span>
        <input
          type="date"
          min={seasonStart}
          max={endDate || seasonEnd}
          value={startDate}
          disabled={disabled}
          onChange={(event) => onStartDateChange(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Fine calendario</span>
        <input
          type="date"
          min={startDate || seasonStart}
          max={seasonEnd}
          value={endDate}
          disabled={disabled}
          onChange={(event) => onEndDateChange(event.target.value)}
        />
      </label>
    </div>
  )
}
