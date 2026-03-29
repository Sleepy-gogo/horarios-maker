import {
  ASPECT_RATIOS,
  BACKGROUND_THEMES,
  DAYS,
  DEFAULT_STATE,
  STORAGE_KEY,
  type AppState,
  type FittedText,
  type ScheduleItem,
  type ScheduleSettings,
  type TimelineMetrics,
} from "@/features/schedule/types"

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function pad(value: number) {
  return String(value).padStart(2, "0")
}

export function formatHourLabel(hour: number) {
  return hour === 24 ? "24:00" : `${pad(hour)}:00`
}

export function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `item-${Math.random().toString(36).slice(2, 10)}`
}

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0
  return hours * 60 + minutes
}

export function minutesToTime(value: number) {
  const safe = clamp(Math.round(value), 0, 23 * 60 + 59)
  return `${pad(Math.floor(safe / 60))}:${pad(safe % 60)}`
}

export function normalizeTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return "08:00"
  return `${pad(clamp(hours, 0, 23))}:${pad(clamp(minutes, 0, 59))}`
}

export function sortItems(items: ScheduleItem[]) {
  return [...items].sort((left, right) => {
    const dayOrder = DAYS.indexOf(left.day) - DAYS.indexOf(right.day)
    if (dayOrder !== 0) return dayOrder
    return timeToMinutes(left.start) - timeToMinutes(right.start)
  })
}

export function sanitizeItem(item: ScheduleItem): ScheduleItem {
  const start = normalizeTime(item.start)
  const rawEnd = normalizeTime(item.end)
  const safeEnd =
    timeToMinutes(rawEnd) <= timeToMinutes(start)
      ? minutesToTime(timeToMinutes(start) + 60)
      : rawEnd

  return {
    ...item,
    start,
    end: safeEnd,
    subject: item.subject || "Materia",
    room: item.room || "",
    details: item.details || "",
    color: item.color || "#e5e7eb",
    textColor: item.textColor || "#0f172a",
  }
}

export function sanitizeSettings(input: Partial<ScheduleSettings> | undefined): ScheduleSettings {
  const merged = { ...DEFAULT_STATE.settings, ...input }
  const startHour = clamp(Math.floor(Number(merged.documentStartHour) || 0), 0, 23)
  const endHour = clamp(Math.floor(Number(merged.documentEndHour) || 0), startHour + 1, 24)

  return {
    ...merged,
    timeRangeMode: merged.timeRangeMode === "manual" ? "manual" : "automatico",
    documentStartHour: startHour,
    documentEndHour: endHour,
  }
}

export function sanitizeState(input: AppState): AppState {
  return {
    version: 1,
    settings: sanitizeSettings(input.settings),
    items: sortItems((input.items || []).map(sanitizeItem)),
  }
}

export function encodeState(state: AppState) {
  const json = JSON.stringify(state)
  const bytes = new TextEncoder().encode(json)
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("")
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

export function decodeState(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4)
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return JSON.parse(new TextDecoder().decode(bytes)) as AppState
}

export function loadInitialState() {
  try {
    const encoded = new URL(window.location.href).searchParams.get("s")
    if (encoded) return sanitizeState(decodeState(encoded))

    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored) return sanitizeState(JSON.parse(stored) as AppState)

    return DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

export function persistState(state: AppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function getTimelineMetrics(
  items: ScheduleItem[],
  settings: Pick<
    ScheduleSettings,
    "compactMode" | "timeRangeMode" | "documentStartHour" | "documentEndHour"
  >,
): TimelineMetrics {
  const starts = items.map((item) => timeToMinutes(item.start))
  const ends = items.map((item) => timeToMinutes(item.end))
  const startHour =
    settings.timeRangeMode === "manual"
      ? clamp(settings.documentStartHour, 0, 23)
      : clamp(Math.floor(Math.min(...starts, 8 * 60) / 60), 6, 22)
  const endHour =
    settings.timeRangeMode === "manual"
      ? clamp(settings.documentEndHour, startHour + 1, 24)
      : clamp(Math.ceil(Math.max(...ends, 21 * 60) / 60), startHour + 1, 24)

  const hourWeights = Array.from({ length: endHour - startHour }, (_, index) => {
    if (settings.compactMode === "uniforme") return 1
    const hourStart = (startHour + index) * 60
    const hourEnd = hourStart + 60
    return items.some(
      (item) => timeToMinutes(item.start) < hourEnd && timeToMinutes(item.end) > hourStart,
    )
      ? 1
      : 0.42
  })

  return {
    startHour,
    endHour,
    hourWeights,
    totalWeight: hourWeights.reduce((sum, weight) => sum + weight, 0),
  }
}

export function getMinutePosition(value: number, timeline: TimelineMetrics, height: number) {
  const minute = clamp(value, timeline.startHour * 60, timeline.endHour * 60)
  const relative = (minute - timeline.startHour * 60) / 60
  const whole = Math.floor(relative)
  const fraction = relative - whole
  let weight = 0

  for (let index = 0; index < whole; index += 1) {
    weight += timeline.hourWeights[index] || 0
  }

  if (whole < timeline.hourWeights.length) {
    weight += (timeline.hourWeights[whole] || 0) * fraction
  }

  return (weight / timeline.totalWeight) * height
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function wrapSvgText(text: string, maxWidth: number, fontSize: number) {
  const clean = text.trim()
  if (!clean) return []

  const approxChars = Math.max(4, Math.floor(maxWidth / (fontSize * 0.56)))
  const words = clean.split(/\s+/)
  const lines: string[] = []
  let current = ""

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word
    if (next.length <= approxChars) {
      current = next
      return
    }

    if (current) lines.push(current)
    current = word
  })

  if (current) lines.push(current)
  return lines
}

export function getLegend(items: ScheduleItem[]) {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (seen.has(item.subject)) return false
    seen.add(item.subject)
    return true
  })
}

export function createEmptyItem(): ScheduleItem {
  return {
    id: createId(),
    day: "Lunes",
    start: "08:00",
    end: "09:00",
    subject: "Nueva materia",
    room: "Aula",
    details: "Comision",
    color: "#d1fae5",
    textColor: "#0f172a",
  }
}

export function fitTextInBlock(
  text: string,
  maxWidth: number,
  maxHeight: number,
  preferredSize: number,
  minSize: number,
): FittedText {
  for (let size = preferredSize; size >= minSize; size -= 0.5) {
    const lines = wrapSvgText(text, maxWidth, size)
    const lineHeight = size * 1.25
    const totalHeight = lines.length * lineHeight
    if (totalHeight <= maxHeight) {
      return { lines, fontSize: size, lineHeight, totalHeight }
    }
  }

  const lineHeight = minSize * 1.25
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeight))
  const all = wrapSvgText(text, maxWidth, minSize)
  const lines = all.slice(0, maxLines)

  if (lines.length > 0 && all.length > maxLines) {
    const last = lines[lines.length - 1]
    lines[lines.length - 1] = last.length > 2 ? `${last.slice(0, -1)}…` : last
  }

  return { lines, fontSize: minSize, lineHeight, totalHeight: lines.length * lineHeight }
}

export function computeLayout(
  frameWidth: number,
  frameHeight: number,
  settings: ScheduleSettings,
  legendCount: number,
) {
  const outerPad = Math.round(Math.min(frameWidth, frameHeight) * 0.022)
  const titleFontSize = Math.round(clamp(Math.min(frameWidth * 0.085, frameHeight * 0.08), 36, 120))
  const subtitleFontSize = Math.round(
    clamp(Math.min(frameWidth * 0.018, frameHeight * 0.018), 10, 22),
  )
  const titleBaseY = outerPad + titleFontSize * 0.82
  const subtitleBaseY = titleBaseY + subtitleFontSize * 2
  const gridTop = subtitleBaseY + outerPad * 0.6
  const dayRowHeight = Math.round(clamp(frameHeight * 0.04, 32, 56))
  const dayFontSize = Math.round(clamp(frameWidth * 0.024, 12, 30))
  const timeLabelWidth = settings.showTimeLabels
    ? Math.round(clamp(frameWidth * 0.075, 55, 120))
    : Math.round(frameWidth * 0.02)
  const timeLabelFontSize = Math.round(clamp(frameWidth * 0.02, 10, 24))
  const rightMargin = Math.round(frameWidth * 0.025)
  const legendCols = 3
  const legendRows = settings.showLegend ? Math.ceil(legendCount / legendCols) : 0
  const legendChipHeight = Math.round(clamp(frameHeight * 0.02, 16, 26))
  const legendRowHeight = legendChipHeight + 8
  const legendLabelSize = Math.round(clamp(frameWidth * 0.016, 10, 18))
  const footerPad = Math.round(frameHeight * 0.012)
  const footerHeight = settings.showLegend
    ? footerPad + legendLabelSize * 1.3 + 6 + legendRows * legendRowHeight + footerPad
    : Math.round(frameHeight * 0.025)
  const gridStartY = gridTop + dayRowHeight
  const timelineHeight = frameHeight - gridStartY - footerHeight
  const columnWidth = (frameWidth - timeLabelWidth - rightMargin) / DAYS.length
  const blockInset = Math.max(3, Math.round(columnWidth * 0.04))
  const blockGapV = Math.max(2, Math.round(timelineHeight * 0.003))

  return {
    outerPad,
    titleFontSize,
    subtitleFontSize,
    titleBaseY,
    subtitleBaseY,
    gridTop,
    dayRowHeight,
    dayFontSize,
    timeLabelWidth,
    timeLabelFontSize,
    rightMargin,
    gridStartY,
    timelineHeight,
    columnWidth,
    blockInset,
    blockGapV,
    footerHeight,
    footerPad,
    legendCols,
    legendRows,
    legendChipHeight,
    legendRowHeight,
    legendLabelSize,
  }
}

export function getFrame(aspectRatio: keyof typeof ASPECT_RATIOS) {
  return ASPECT_RATIOS[aspectRatio]
}

export function getTheme(theme: keyof typeof BACKGROUND_THEMES) {
  return BACKGROUND_THEMES[theme]
}
