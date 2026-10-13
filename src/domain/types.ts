export const SCHEMA_VERSION = 2 as const

export type DayId = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"

export type Subject = {
  id: string
  name: string
  color: string
  textColor: string
}

export type Block = {
  id: string
  subjectId: string
  day: DayId
  /** Minutes from 00:00, 0 <= start < end <= 1440. */
  start: number
  end: number
  room: string
  kind: string
  notes: string
}

export type PagePreset = "a4-portrait" | "a4-landscape" | "square" | "story" | "widescreen" | "custom"

export type DocumentSettings = {
  title: string
  subtitle: string
  page: { preset: PagePreset; width: number; height: number }
  days: DayId[]
  range: { start: number; end: number }
  show: {
    subtitle: boolean
    room: boolean
    kind: boolean
    notes: boolean
    blockTimes: boolean
    hourLabels: boolean
    legend: boolean
  }
}

export type FontSource = "local" | "google"

export type FontRef = {
  source: FontSource
  /** Local catalog id or Fontsource id. */
  id: string
  family: string
  /** Pinned Fontsource package version for Google fonts. */
  version?: string
  weight: number
  italic: boolean
}

export type TextRole = "title" | "subtitle" | "day" | "hour" | "blockTitle" | "blockMeta" | "legend"

export type TextStyle = {
  font: FontRef
  size: number
  /** Tracking in em. */
  letterSpacing: number
  uppercase: boolean
  lineHeight: number
}

export type Appearance = {
  /** Visible name of the look, e.g. "Papel" or "Personalizado". */
  name: string
  page: {
    background: string
    /** Second gradient stop, diagonal. Null draws a flat page. */
    backgroundEnd: string | null
    margin: number
  }
  colors: { ink: string; muted: string; accent: string }
  sheet: {
    show: boolean
    fill: string
    radius: number
    borderColor: string
    borderWidth: number
    padding: number
  }
  header: { align: "start" | "center"; gap: number }
  grid: {
    headerFill: string
    bodyFill: string
    lineColor: string
    lineWidth: number
    halfHourLines: boolean
    stripes: boolean
    stripeColor: string
    columnGap: number
    radius: number
    hourFormat: "HH:mm" | "H:mm" | "H"
  }
  blocks: {
    radius: number
    inset: number
    padding: number
    borderWidth: number
    /** "auto" darkens the subject color; otherwise a fixed color. */
    borderColor: string
    align: "center" | "start"
    style: "solid" | "soft" | "outline"
    showAccentBar: boolean
  }
  legend: { title: string; showTitle: boolean; style: "chips" | "list" }
  decorations: { accentShapes: boolean }
  type: Record<TextRole, TextStyle>
  /** Automatic colors for new subjects. */
  palette: string[]
}

export type ScheduleDocument = {
  schemaVersion: typeof SCHEMA_VERSION
  id: string
  createdAt: string
  subjects: Subject[]
  blocks: Block[]
  settings: DocumentSettings
  appearance: Appearance
}

export type SavedTheme = {
  id: string
  name: string
  themeSchemaVersion: 1
  appearance: Appearance
  createdAt: string
  updatedAt: string
}
