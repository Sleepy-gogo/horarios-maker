export const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"] as const

export const ASPECT_RATIOS = {
  a4Vertical: { label: "A4 vertical", width: 1000, height: 1414 },
  a4Horizontal: { label: "A4 horizontal", width: 1414, height: 1000 },
  cuadrado: { label: "Cuadrado", width: 1080, height: 1080 },
  historia: { label: "Story", width: 1080, height: 1920 },
  panoramico: { label: "Panoramico", width: 1600, height: 900 },
} as const

export const BACKGROUND_THEMES = {
  papel: {
    label: "Papel",
    page: "#f4efe4",
    pageEnd: "#fffaf0",
    ink: "#171717",
    panel: "rgba(255, 251, 244, 0.76)",
    panelStrong: "rgba(255, 251, 244, 0.94)",
    grid: "rgba(23, 23, 23, 0.18)",
    muted: "rgba(23, 23, 23, 0.55)",
    accent: "#d65a31",
    panelRadius: 24,
    blockRadius: 16,
    strokeWidth: 1,
  },
  noche: {
    label: "Noche",
    page: "#111827",
    pageEnd: "#0f172a",
    ink: "#f8fafc",
    panel: "rgba(15, 23, 42, 0.72)",
    panelStrong: "rgba(30, 41, 59, 0.92)",
    grid: "rgba(148, 163, 184, 0.2)",
    muted: "rgba(226, 232, 240, 0.65)",
    accent: "#f59e0b",
    panelRadius: 14,
    blockRadius: 10,
    strokeWidth: 0.8,
  },
  tinta: {
    label: "Tinta",
    page: "#e7ecef",
    pageEnd: "#dce3e8",
    ink: "#0f172a",
    panel: "rgba(255, 255, 255, 0.7)",
    panelStrong: "rgba(255, 255, 255, 0.92)",
    grid: "rgba(15, 23, 42, 0.3)",
    muted: "rgba(15, 23, 42, 0.6)",
    accent: "#0f766e",
    panelRadius: 4,
    blockRadius: 3,
    strokeWidth: 2.2,
  },
} as const

export const STORAGE_KEY = "horario-app-state"
export const START_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => index)
export const END_HOUR_OPTIONS = Array.from({ length: 24 }, (_, index) => index + 1)

export type Day = (typeof DAYS)[number]
export type AspectRatio = keyof typeof ASPECT_RATIOS
export type BackgroundTheme = keyof typeof BACKGROUND_THEMES
export type CompactMode = "uniforme" | "optimizado"
export type Density = "aireado" | "normal" | "compacto"
export type TimeRangeMode = "automatico" | "manual"

export type ScheduleItem = {
  id: string
  day: Day
  start: string
  end: string
  subject: string
  room: string
  details: string
  color: string
  textColor: string
}

export type ScheduleSettings = {
  title: string
  subtitle: string
  compactMode: CompactMode
  timeRangeMode: TimeRangeMode
  documentStartHour: number
  documentEndHour: number
  aspectRatio: AspectRatio
  theme: BackgroundTheme
  density: Density
  uppercaseTitle: boolean
  showRoom: boolean
  showDetails: boolean
  showLegend: boolean
  showTimeLabels: boolean
}

export type AppState = {
  version: 1
  settings: ScheduleSettings
  items: ScheduleItem[]
}

export type TimelineMetrics = {
  startHour: number
  endHour: number
  hourWeights: number[]
  totalWeight: number
}

export type FittedText = {
  lines: string[]
  fontSize: number
  lineHeight: number
  totalHeight: number
}

export const DEFAULT_STATE: AppState = {
  version: 1,
  settings: {
    title: "Horario",
    subtitle: "",
    compactMode: "optimizado",
    timeRangeMode: "automatico",
    documentStartHour: 8,
    documentEndHour: 21,
    aspectRatio: "a4Vertical",
    theme: "papel",
    density: "normal",
    uppercaseTitle: true,
    showRoom: true,
    showDetails: true,
    showLegend: true,
    showTimeLabels: true,
  },
  items: [],
}
