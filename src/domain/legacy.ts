import { readableText, normalizeHex } from "./color"
import { DEFAULT_RANGE, PAGE_PRESETS, sortDays } from "./constants"
import { createDocument, createId, defaultSettings, fitRange } from "./document"
import { presetById } from "./presets"
import { formatMinutes } from "./time"
import type { Block, DayId, PagePreset, ScheduleDocument, Subject } from "./types"

/** Format of the original single-schedule app, `{ version: 1, settings, items }`. */
export const LEGACY_STORAGE_KEY = "horario-app-state"

export type MigrationReport = {
  notes: string[]
  skipped: { index: number; reason: string; raw: unknown }[]
}

const LEGACY_DAYS: Record<string, DayId> = {
  lunes: "mon",
  martes: "tue",
  miercoles: "wed",
  "miércoles": "wed",
  jueves: "thu",
  viernes: "fri",
  sabado: "sat",
  "sábado": "sat",
  domingo: "sun",
}

const LEGACY_PAGES: Record<string, PagePreset> = {
  a4Vertical: "a4-portrait",
  a4Horizontal: "a4-landscape",
  cuadrado: "square",
  historia: "story",
  panoramico: "widescreen",
}

function parseLegacyTime(value: unknown): number | null {
  if (typeof value !== "string") return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const h = Number(match[1])
  const m = Number(match[2])
  if (m > 59) return null
  if (h === 24 && m === 0) return 1440
  if (h > 23) return null
  return h * 60 + m
}

const str = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "")

export function isLegacyState(input: unknown): input is { version: 1; settings?: unknown; items: unknown[] } {
  return !!input && typeof input === "object" && (input as { version?: unknown }).version === 1 && Array.isArray((input as { items?: unknown }).items)
}

/**
 * Converts a v1 state into a new v2 document. One subject per EXACT combination of name, background and text color, so
 * homonyms with different colors stay distinct. Minutes, rooms and details are preserved; every repair is reported.
 */
export function migrateLegacy(input: unknown): { document: ScheduleDocument; report: MigrationReport } | { error: string } {
  if (!isLegacyState(input)) return { error: "No es un horario de la versión anterior." }
  const report: MigrationReport = { notes: [], skipped: [] }
  const rawSettings = (input.settings && typeof input.settings === "object" ? input.settings : {}) as Record<string, unknown>

  const themeId = typeof rawSettings.theme === "string" && presetById(rawSettings.theme) ? rawSettings.theme : "papel"
  if (rawSettings.theme !== undefined && themeId !== rawSettings.theme) report.notes.push(`El tema "${String(rawSettings.theme)}" no existe; se usó Papel.`)
  const appearance = structuredClone(presetById(themeId)!.appearance)
  if (rawSettings.uppercaseTitle === false) appearance.type.title.uppercase = false
  const density = rawSettings.density
  if (density === "compacto" || density === "aireado") {
    const factor = density === "compacto" ? 0.88 : 1.1
    for (const role of ["blockTitle", "blockMeta", "day", "hour", "legend"] as const) {
      appearance.type[role].size = Math.round(appearance.type[role].size * factor * 10) / 10
    }
    report.notes.push(`Se conservó la densidad "${density}" ajustando los tamaños de texto.`)
  }

  const subjects: Subject[] = []
  const subjectKey = new Map<string, string>()
  const blocks: Block[] = []
  const seenIds = new Set<string>()

  input.items.forEach((raw, index) => {
    if (!raw || typeof raw !== "object") {
      report.skipped.push({ index, reason: "no es un bloque", raw })
      return
    }
    const item = raw as Record<string, unknown>
    const day = typeof item.day === "string" ? LEGACY_DAYS[item.day.trim().toLocaleLowerCase("es")] : undefined
    const start = parseLegacyTime(item.start)
    const end = parseLegacyTime(item.end)
    if (!day) {
      report.skipped.push({ index, reason: `día desconocido "${String(item.day)}"`, raw })
      return
    }
    if (start === null || end === null || start >= 1440) {
      report.skipped.push({ index, reason: "hora inválida", raw })
      return
    }
    if (end <= start) {
      report.skipped.push({ index, reason: `fin ${formatMinutes(end)} no posterior al inicio ${formatMinutes(start)}`, raw })
      return
    }
    const name = str(item.subject, 80).trim() || "Materia sin nombre"
    if (!str(item.subject, 80).trim()) report.notes.push(`El bloque ${index + 1} no tenía materia; se llamó "Materia sin nombre".`)
    const color = normalizeHex(str(item.color, 16)) ?? null
    const textColor = normalizeHex(str(item.textColor, 16)) ?? null
    const fill = color ?? "#E5E7EB"
    const ink = textColor ?? readableText(fill)
    if (!color) report.notes.push(`El bloque ${index + 1} tenía un color inválido; se usó gris.`)
    const key = JSON.stringify([str(item.subject, 80), str(item.color, 16), str(item.textColor, 16)])
    let subjectId = subjectKey.get(key)
    if (!subjectId) {
      subjectId = createId("sub")
      subjectKey.set(key, subjectId)
      subjects.push({ id: subjectId, name, color: fill, textColor: ink })
    }
    let id = typeof item.id === "string" && item.id.length <= 64 ? `blk_${item.id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}` : ""
    if (!id || seenIds.has(id)) {
      if (id) report.notes.push(`El bloque ${index + 1} tenía un ID repetido y recibió uno nuevo.`)
      id = createId("blk")
    }
    seenIds.add(id)
    if (start % 30 !== 0 || end % 30 !== 0) {
      report.notes.push(`${name}: se conservaron las horas exactas ${formatMinutes(start)}–${formatMinutes(end)}.`)
    }
    blocks.push({ id, subjectId, day, start, end, room: str(item.room, 60), kind: "", notes: str(item.details, 280) })
  })

  const homonyms = new Map<string, number>()
  for (const subject of subjects) homonyms.set(subject.name, (homonyms.get(subject.name) ?? 0) + 1)
  for (const [name, count] of homonyms) {
    if (count > 1) report.notes.push(`"${name}" tenía ${count} combinaciones de colores; se conservaron como variantes separadas.`)
  }

  const settings = defaultSettings()
  settings.title = str(rawSettings.title, 120) || "Horario"
  settings.subtitle = str(rawSettings.subtitle, 160)
  settings.compactEmptyHours = rawSettings.compactMode === "optimizado"
  const page = typeof rawSettings.aspectRatio === "string" ? LEGACY_PAGES[rawSettings.aspectRatio] : undefined
  const preset = page ?? "a4-portrait"
  const pageSize = PAGE_PRESETS[preset as Exclude<PagePreset, "custom">]
  settings.page = { preset, width: pageSize.width, height: pageSize.height }
  settings.show = {
    subtitle: true,
    room: rawSettings.showRoom !== false,
    kind: true,
    notes: rawSettings.showDetails !== false,
    blockTimes: false,
    hourLabels: rawSettings.showTimeLabels !== false,
    legend: rawSettings.showLegend !== false,
  }
  const days = new Set<DayId>(["mon", "tue", "wed", "thu", "fri"])
  for (const block of blocks) days.add(block.day)
  settings.days = sortDays([...days])

  if (rawSettings.timeRangeMode === "manual") {
    const startHour = Number(rawSettings.documentStartHour)
    const endHour = Number(rawSettings.documentEndHour)
    let range = Number.isInteger(startHour) && Number.isInteger(endHour) && startHour >= 0 && endHour <= 24 && startHour < endHour
      ? { start: startHour * 60, end: endHour * 60 }
      : { ...DEFAULT_RANGE }
    const fitted = fitRange(blocks, 0)
    if (blocks.length && (fitted.start < range.start || fitted.end > range.end)) {
      range = { start: Math.min(range.start, fitted.start), end: Math.max(range.end, fitted.end) }
      report.notes.push(`El rango manual excluía clases; se amplió a ${formatMinutes(range.start)}–${formatMinutes(range.end)}.`)
    }
    settings.range = range
  } else {
    settings.range = blocks.length ? fitRange(blocks, 0) : { ...DEFAULT_RANGE }
  }
  if (rawSettings.compactMode === "optimizado") {
    report.notes.push("La compactación de horas vacías se reemplazó por escala uniforme: cada media hora ocupa el mismo alto.")
  }

  const document = createDocument(settings, appearance)
  document.subjects = subjects
  document.blocks = blocks
  return { document, report }
}

export function decodeLegacyLink(value: string): unknown {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes))
}
