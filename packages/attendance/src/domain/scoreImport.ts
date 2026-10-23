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

  const exactPartMatches = athletes.filter((athlete) =>
    normalizeName(athlete.name).split(' ').includes(normalizedQuery)
  )
  if (exactPartMatches.length === 1) {
    return { athlete: exactPartMatches[0], ambiguous: false }
  }
  if (exactPartMatches.length > 1) return { ambiguous: true }

  const matches = athletes.filter((athlete) =>
    normalizeName(athlete.name).includes(normalizedQuery)
  )
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

function teamLabel(value: string, teams: ScoreTeam[]): ScoreTeam | undefined {
  const normalized = normalizeName(value).replace(/^squadra\s+/, '')
  return teams.find((team) => normalizeName(team) === normalized)
}

export function parseTeamAssignments(
  text: string,
  teams: ScoreTeam[] = ['a', 'b']
): Record<ScoreTeam, string[]> {
  const rows = text
    .split(/\r?\n/)
    .map(cellsForLine)
    .filter((cells) => cells.length && !isSeparatorRow(cells))
  const result: Record<ScoreTeam, string[]> = Object.fromEntries(
    teams.map((team) => [team, []])
  )
  if (!rows.length) return result

  const headers = rows[0]
    .map((cell, index) => ({ team: teamLabel(cell, teams), index }))
    .filter((header): header is { team: ScoreTeam; index: number } => Boolean(header.team))
  if (headers.length >= 2) {
    for (const cells of rows.slice(1)) {
      for (const header of headers) {
        if (cells[header.index]) result[header.team].push(cells[header.index])
      }
    }
    return result
  }

  const labelledRows = rows.filter((cells) => teamLabel(cells[0], teams))
  if (labelledRows.length) {
    for (const cells of labelledRows) {
      const team = teamLabel(cells[0], teams)!
      result[team].push(...cells.slice(1))
    }
    return result
  }

  if (rows.length === teams.length) {
    rows.forEach((cells, index) => result[teams[index]].push(...cells))
    return result
  }

  for (const cells of rows) {
    teams.forEach((team, index) => {
      if (cells[index]) result[team].push(cells[index])
    })
  }
  return result
}
