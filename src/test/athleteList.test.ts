import { describe, expect, it } from 'vitest'
import {
  formatAthleteName,
  normalizeAthleteName,
  parseAthleteList
} from '../domain/athleteList'

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

  it('formatta i nomi in Title Case, inclusi apostrofi e trattini', () => {
    expect(formatAthleteName("  MARIA-CHIARA   D'ANGELO ")).toBe("Maria-Chiara D'Angelo")
  })

  it('formatta in Title Case anche i nomi incollati', () => {
    expect(parseAthleteList('GIULIA ROSSI\nmarta bianchi')).toEqual([
      'Giulia Rossi',
      'Marta Bianchi'
    ])
  })
})
