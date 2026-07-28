import { describe, expect, it } from 'vitest'
import { percentageScaleColor } from '../domain/percentageColorScale'

describe('scale colore percentuali Excel', () => {
  const absent = { id: 'absent', code: 'A' }
  const late = { id: 'late', code: 'R' }

  it('usa le soglie originali per le assenze', () => {
    expect(percentageScaleColor(absent, 0)).toBe('rgb(0, 169, 51)')
    expect(percentageScaleColor(absent, 20)).toBe('rgb(255, 255, 0)')
    expect(percentageScaleColor(absent, 33)).toBe('rgb(255, 0, 0)')
    expect(percentageScaleColor(absent, 100)).toBe('rgb(255, 0, 0)')
  })

  it('usa le soglie originali per i ritardi', () => {
    expect(percentageScaleColor(late, 0)).toBe('rgb(0, 169, 51)')
    expect(percentageScaleColor(late, 25)).toBe('rgb(255, 255, 0)')
    expect(percentageScaleColor(late, 40)).toBe('rgb(255, 0, 0)')
  })

  it('interpola i colori e ignora gli altri stati', () => {
    expect(percentageScaleColor(absent, 10)).toBe('rgb(128, 212, 26)')
    expect(percentageScaleColor({ id: 'present', code: 'P' }, 75)).toBeUndefined()
  })

  it('riconosce anche i codici di un documento non standard', () => {
    expect(percentageScaleColor({ id: 'custom-absence', code: 'a' }, 20)).toBe(
      'rgb(255, 255, 0)'
    )
  })
})
