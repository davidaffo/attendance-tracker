import type { Athlete, ScoreTeam } from './types'

function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('it-IT')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function matchAthleteByName(
  athletes: Athlete[],
  query: string
): { athlete?: Athlete; ambiguous: boolean } {
  const normalizedQuery = normalizeName(query)
  if (!normalizedQuery) return { ambiguous: false }
  const exact = athletes.filter((athlete) => normalizeName(athlete.name) === normalizedQuery)
  if (exact.length === 1) return { athlete: exact[0], ambiguous: false }
  if (exact.length > 1) return { ambiguous: true }

  const matches = athletes.filter((athlete) => {
    const parts = normalizeName(athlete.name).split(' ')
    return parts.includes(normalizedQuery) || normalizeName(athlete.name).includes(normalizedQuery)
  })
  return matches.length === 1
    ? { athlete: matches[0], ambiguous: false }
    : { ambiguous: matches.length > 1 }
}

function cellsForLine(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const separator = trimmed.includes('|')
    ? /\s*\|\s*/
    : trimmed.includes('\t')
      ? /\t+/
      : /\s*[,;]\s*/
  return trimmed.split(separator).map((cell) => cell.trim()).filter(Boolean)
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell))
}

function teamLabel(value: string): ScoreTeam | undefined {
  const normalized = normalizeName(value).replace(/^squadra\s+/, '')
  return normalized === 'a' ? 'a' : normalized === 'b' ? 'b' : undefined
}

export function parseTeamAssignments(text: string): Record<ScoreTeam, string[]> {
  const rows = text
    .split(/\r?\n/)
    .map(cellsForLine)
    .filter((cells) => cells.length && !isSeparatorRow(cells))
  const result: Record<ScoreTeam, string[]> = { a: [], b: [] }
  if (!rows.length) return result

  const headerA = rows[0].findIndex((cell) => teamLabel(cell) === 'a')
  const headerB = rows[0].findIndex((cell) => teamLabel(cell) === 'b')
  if (headerA >= 0 && headerB >= 0) {
    for (const cells of rows.slice(1)) {
      if (cells[headerA]) result.a.push(cells[headerA])
      if (cells[headerB]) result.b.push(cells[headerB])
    }
    return result
  }

  const labelledRows = rows.filter((cells) => teamLabel(cells[0]))
  if (labelledRows.length) {
    for (const cells of labelledRows) {
      const team = teamLabel(cells[0])!
      result[team].push(...cells.slice(1))
    }
    return result
  }

  if (rows.length === 2) {
    result.a.push(...rows[0])
    result.b.push(...rows[1])
    return result
  }

  for (const cells of rows) {
    if (cells[0]) result.a.push(cells[0])
    if (cells[1]) result.b.push(cells[1])
  }
  return result
}
