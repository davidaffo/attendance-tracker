import { describe, expect, it } from 'vitest'
import type { Athlete } from '../domain/types'
import { matchAthleteByName, parseTeamAssignments } from '../domain/scoreImport'

const athletes = ['Anna Rossi', 'Bianca Verdi', 'Carla Rossi'].map((name, order): Athlete => ({
  id: String(order), name, order, active: true, createdAt: '2026-08-01T00:00:00.000Z'
}))

describe('assegnazione rapida delle squadre', () => {
  it('trova nome completo, nome o cognome quando sono univoci', () => {
    expect(matchAthleteByName(athletes, 'Anna Rossi').athlete?.id).toBe('0')
    expect(matchAthleteByName(athletes, 'Bianca').athlete?.id).toBe('1')
    expect(matchAthleteByName(athletes, 'Rossi').ambiguous).toBe(true)
  })

  it('preferisce un nome esatto alla radice di un altro nome', () => {
    const similarNames = ['Gottero Isabel', 'Bertozzi Isabella'].map(
      (name, order): Athlete => ({
        id: String(order), name, order, active: true, createdAt: '2026-08-01T00:00:00.000Z'
      })
    )

    expect(matchAthleteByName(similarNames, 'Isabel').athlete?.name).toBe('Gottero Isabel')
    expect(matchAthleteByName(similarNames, 'Isabella').athlete?.name).toBe('Bertozzi Isabella')
    expect(matchAthleteByName(similarNames, 'Isa').ambiguous).toBe(true)
  })

  it('legge due righe semplici', () => {
    expect(parseTeamAssignments('Anna Rossi, Bianca Verdi\nCarla Rossi')).toEqual({
      a: ['Anna Rossi', 'Bianca Verdi'], b: ['Carla Rossi']
    })
  })

  it('legge una tabella Markdown con le squadre in colonna', () => {
    expect(parseTeamAssignments(
      '| Squadra A | Squadra B |\n|---|---|\n| Anna Rossi | Carla Rossi |\n| Bianca Verdi | |'
    )).toEqual({ a: ['Anna Rossi', 'Bianca Verdi'], b: ['Carla Rossi'] })
  })

  it('legge due righe Markdown etichettate', () => {
    expect(parseTeamAssignments(
      '| Squadra A | Anna Rossi | Bianca Verdi |\n| Squadra B | Carla Rossi |'
    )).toEqual({ a: ['Anna Rossi', 'Bianca Verdi'], b: ['Carla Rossi'] })
  })
})
