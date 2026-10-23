export function normalizeAthleteName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it')
}

export function formatAthleteName(name: string) {
  return normalizeAthleteName(name).replace(
    /(^|[\s'’\-])(\p{L})/gu,
    (_, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase('it')}`
  )
}

export function parseAthleteList(value: string) {
  const seen = new Set<string>()

  return value
    .split(/\r?\n/)
    .map((line) =>
      formatAthleteName(
        line
        .trim()
        .replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '')
      )
    )
    .filter((name) => {
      if (!name) return false
      const normalized = normalizeAthleteName(name)
      if (seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}
