import type { DayId, PagePreset } from "./types"

export const DAYS: { id: DayId; label: string; short: string }[] = [
  { id: "mon", label: "Lunes", short: "Lun" },
  { id: "tue", label: "Martes", short: "Mar" },
  { id: "wed", label: "Miércoles", short: "Mié" },
  { id: "thu", label: "Jueves", short: "Jue" },
  { id: "fri", label: "Viernes", short: "Vie" },
  { id: "sat", label: "Sábado", short: "Sáb" },
  { id: "sun", label: "Domingo", short: "Dom" },
]

export const DAY_IDS = DAYS.map((day) => day.id)
export const DEFAULT_DAYS: DayId[] = ["mon", "tue", "wed", "thu", "fri"]

export function dayLabel(id: DayId) {
  return DAYS.find((day) => day.id === id)?.label ?? id
}

export function sortDays(days: DayId[]) {
  return [...new Set(days)].sort((a, b) => DAY_IDS.indexOf(a) - DAY_IDS.indexOf(b))
}

export const PAGE_PRESETS: Record<Exclude<PagePreset, "custom">, { label: string; ratio: string; width: number; height: number }> = {
  "a4-portrait": { label: "A4 vertical", ratio: "1 : 1,41", width: 1000, height: 1414 },
  "a4-landscape": { label: "A4 horizontal", ratio: "1,41 : 1", width: 1414, height: 1000 },
  square: { label: "Cuadrado", ratio: "1 : 1", width: 1080, height: 1080 },
  story: { label: "Historia", ratio: "9 : 16", width: 1080, height: 1920 },
  widescreen: { label: "Panorámico", ratio: "16 : 9", width: 1600, height: 900 },
}

export const PAGE_LIMITS = { min: 320, max: 4000 }

export const CLASS_KINDS = ["Teórica", "Práctica", "Laboratorio", "Consulta", "Taller", "Seminario"]

export const STEP = 30
export const MIN_DURATION = 30
export const DEFAULT_DURATION = 60
export const DEFAULT_RANGE = { start: 8 * 60, end: 21 * 60 }

export const TEXT_LIMITS = {
  title: 120,
  subtitle: 160,
  subjectName: 80,
  room: 60,
  kind: 40,
  notes: 280,
}

export const MAX_SUBJECTS = 200
export const MAX_BLOCKS = 600
export const HISTORY_LIMIT = 100
