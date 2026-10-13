import { STEP } from "./constants"

const pad = (value: number) => String(value).padStart(2, "0")

export function formatMinutes(minutes: number, format: "HH:mm" | "H:mm" | "H" = "HH:mm") {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (format === "H") return m === 0 ? `${h} h` : `${h}:${pad(m)}`
  if (format === "H:mm") return `${h}:${pad(m)}`
  return `${pad(h)}:${pad(m)}`
}

export function formatRange(start: number, end: number) {
  return `${formatMinutes(start)}–${formatMinutes(end)}`
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return h === 1 ? "1 hora" : `${h} horas`
  return `${h} h ${m} min`
}

/** Parses "9", "930", "0930", "9:30", "09.30", "9h" into minutes. Returns null for anything invalid. */
export function parseTime(input: string, { allowEndOfDay = false } = {}): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, "").replace(/h$/, "")
  if (!text) return null
  let hours: number
  let minutes: number
  const separated = /^(\d{1,2})[:.h](\d{1,2})$/.exec(text)
  if (separated) {
    hours = Number(separated[1])
    minutes = Number(separated[2])
    if (separated[2]!.length === 1) minutes *= 10
  } else if (/^\d{1,4}$/.test(text)) {
    if (text.length <= 2) {
      hours = Number(text)
      minutes = 0
    } else {
      hours = Number(text.slice(0, text.length - 2))
      minutes = Number(text.slice(-2))
    }
  } else {
    return null
  }
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes > 59) return null
  const total = hours * 60 + minutes
  if (total === 1440 && allowEndOfDay) return total
  if (hours > 23) return null
  return total
}

export function snap(minutes: number, step = STEP) {
  return step * Math.floor(minutes / step + 0.5)
}

export function snapDown(minutes: number, step = STEP) {
  return step * Math.floor(minutes / step)
}

export function snapUp(minutes: number, step = STEP) {
  return step * Math.ceil(minutes / step)
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return a.start < b.end && b.start < a.end
}
