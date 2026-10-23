import type { AttendanceStatus } from './types'

interface ColorScaleRule {
  middle: number
  maximum: number
}

interface RgbColor {
  red: number
  green: number
  blue: number
}

const EXCEL_GREEN: RgbColor = { red: 0, green: 169, blue: 51 }
const EXCEL_YELLOW: RgbColor = { red: 255, green: 255, blue: 0 }
const EXCEL_RED: RgbColor = { red: 255, green: 0, blue: 0 }

const ABSENCE_SCALE: ColorScaleRule = {
  middle: 20,
  maximum: 33
}

const LATE_SCALE: ColorScaleRule = {
  middle: 25,
  maximum: 40
}

function colorScaleForStatus(
  status: Pick<AttendanceStatus, 'id' | 'code'>
): ColorScaleRule | undefined {
  const id = status.id.toLocaleLowerCase()
  const code = status.code.trim().toLocaleUpperCase()

  if (id === 'absent' || code === 'A') return ABSENCE_SCALE
  if (id === 'late' || code === 'R') return LATE_SCALE
  return undefined
}

function interpolate(start: number, end: number, position: number): number {
  return Math.round(start + (end - start) * position)
}

function interpolateColor(start: RgbColor, end: RgbColor, position: number): string {
  const boundedPosition = Math.min(1, Math.max(0, position))
  const red = interpolate(start.red, end.red, boundedPosition)
  const green = interpolate(start.green, end.green, boundedPosition)
  const blue = interpolate(start.blue, end.blue, boundedPosition)

  return `rgb(${red}, ${green}, ${blue})`
}

/**
 * Replica le scale colore del file Excel:
 * A%: 0 verde, 20 giallo, 33 rosso.
 * R%: 0 verde, 25 giallo, 40 rosso.
 */
export function percentageScaleColor(
  status: Pick<AttendanceStatus, 'id' | 'code'>,
  percentage: number
): string | undefined {
  const scale = colorScaleForStatus(status)
  if (!scale || !Number.isFinite(percentage)) return undefined

  const value = Math.max(0, percentage)
  if (value <= scale.middle) {
    return interpolateColor(EXCEL_GREEN, EXCEL_YELLOW, value / scale.middle)
  }

  return interpolateColor(
    EXCEL_YELLOW,
    EXCEL_RED,
    (value - scale.middle) / (scale.maximum - scale.middle)
  )
}
