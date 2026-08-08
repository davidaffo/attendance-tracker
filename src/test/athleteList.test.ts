import { describe, expect, it } from 'vitest'
import { normalizeAthleteName, parseAthleteList } from '../domain/athleteList'

describe('elenco giocatrici', () => {
  it('legge una giocatrice per riga e ignora le righe vuote', () => {
    expect(parseAthleteList('Giulia Rossi\n\n Marta Bianchi \r\nSara Verdi')).toEqual([
      'Giulia Rossi',
      'Marta Bianchi',
      'Sara Verdi'
    ])
  })

  it('rimuove numerazione, punti elenco e duplicati', () => {
    expect(parseAthleteList('1. Giulia Rossi\n• Marta Bianchi\n- Sara Verdi\n giulia   rossi')).toEqual([
      'Giulia Rossi',
      'Marta Bianchi',
      'Sara Verdi'
    ])
  })

  it('confronta i nomi senza differenze di spazi o maiuscole', () => {
    expect(normalizeAthleteName('  GIULIA   Rossi ')).toBe('giulia rossi')
  })
})
