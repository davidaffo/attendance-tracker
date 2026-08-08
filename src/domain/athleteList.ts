export function normalizeAthleteName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it')
}

export function parseAthleteList(value: string) {
  const seen = new Set<string>()

  return value
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '')
        .trim()
        .replace(/\s+/g, ' ')
    )
    .filter((name) => {
      if (!name) return false
      const normalized = normalizeAthleteName(name)
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}
