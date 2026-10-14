import type { Appearance, FontRef, TextRole, TextStyle } from "./types"

export function localFont(id: "dm-sans" | "bebas-neue" | "jetbrains-mono" | "inter" | "geist", weight = 400): FontRef {
  const family = {
    "dm-sans": "DM Sans",
    "bebas-neue": "Bebas Neue",
    "jetbrains-mono": "JetBrains Mono",
    inter: "Inter",
    geist: "Geist",
  }[id]
  return { source: "local", id, family, weight, italic: false }
}

function style(font: FontRef, size: number, extra: Partial<TextStyle> = {}): TextStyle {
  return { font, size, letterSpacing: 0, uppercase: false, lineHeight: 1.2, ...extra }
}

type TypeSet = Record<TextRole, TextStyle>

function poster(): TypeSet {
  return {
    title: style(localFont("bebas-neue", 400), 72, { letterSpacing: 0.04, uppercase: true, lineHeight: 1 }),
    subtitle: style(localFont("dm-sans", 500), 22, { lineHeight: 1.25 }),
    day: style(localFont("dm-sans", 700), 17, { letterSpacing: 0.01 }),
    hour: style(localFont("dm-sans", 600), 13),
    blockTitle: style(localFont("dm-sans", 700), 17, { lineHeight: 1.12 }),
    blockMeta: style(localFont("dm-sans", 500), 13, { lineHeight: 1.2 }),
    legend: style(localFont("dm-sans", 600), 15),
  }
}

function technical(): TypeSet {
  return {
    title: style(localFont("inter", 800), 54, { letterSpacing: -0.02, lineHeight: 1.05 }),
    subtitle: style(localFont("inter", 500), 20, { lineHeight: 1.25 }),
    day: style(localFont("inter", 700), 15, { letterSpacing: 0.06, uppercase: true }),
    hour: style(localFont("jetbrains-mono", 500), 12),
    blockTitle: style(localFont("inter", 700), 16, { lineHeight: 1.12, letterSpacing: -0.01 }),
    blockMeta: style(localFont("inter", 500), 12.5, { lineHeight: 1.2 }),
    legend: style(localFont("inter", 600), 14),
  }
}

function soft(): TypeSet {
  return {
    title: style(localFont("geist", 700), 56, { letterSpacing: -0.03, lineHeight: 1.05 }),
    subtitle: style(localFont("geist", 400), 21, { lineHeight: 1.25 }),
    day: style(localFont("geist", 600), 16),
    hour: style(localFont("geist", 500), 13),
    blockTitle: style(localFont("geist", 600), 16.5, { lineHeight: 1.12 }),
    blockMeta: style(localFont("geist", 400), 13, { lineHeight: 1.2 }),
    legend: style(localFont("geist", 500), 15),
  }
}

function mono(): TypeSet {
  return {
    title: style(localFont("jetbrains-mono", 800), 50, { letterSpacing: -0.02, uppercase: true, lineHeight: 1.05 }),
    subtitle: style(localFont("jetbrains-mono", 400), 18, { lineHeight: 1.3 }),
    day: style(localFont("jetbrains-mono", 700), 15, { uppercase: true }),
    hour: style(localFont("jetbrains-mono", 400), 12),
    blockTitle: style(localFont("jetbrains-mono", 700), 15, { lineHeight: 1.15 }),
    blockMeta: style(localFont("jetbrains-mono", 400), 12, { lineHeight: 1.2 }),
    legend: style(localFont("jetbrains-mono", 500), 14),
  }
}

/**
 * Palettes are chosen per theme so every color takes the same text color: dark text on the light and pastel sets,
 * white on the vivid set. Neighboring entries alternate warm and cool hues, so the first subjects never look alike.
 */
const BRIGHT = ["#3B82F6", "#F43F5E", "#10B981", "#F59E0B", "#8B5CF6", "#F97316", "#06B6D4", "#EC4899", "#84CC16", "#6366F1", "#14B8A6", "#EF4444"]
const VIVID = ["#2563EB", "#E11D48", "#7C3AED", "#0F766E", "#DB2777", "#4F46E5", "#0369A1", "#C026D3", "#DC2626", "#15803D", "#9333EA", "#0E7490"]
const PASTEL = ["#BFDBFE", "#FECDD3", "#A7F3D0", "#FDE68A", "#DDD6FE", "#FED7AA", "#A5F3FC", "#FBCFE8", "#D9F99D", "#C7D2FE", "#99F6E4", "#F5D0FE"]
const NEON = ["#60A5FA", "#FB7185", "#34D399", "#FBBF24", "#A78BFA", "#FB923C", "#22D3EE", "#F472B6", "#A3E635", "#818CF8", "#2DD4BF", "#38BDF8"]
const MARKER = ["#FDE047", "#7DD3FC", "#F9A8D4", "#BEF264", "#C4B5FD", "#FDBA74", "#6EE7B7", "#FCA5A5", "#67E8F9", "#A5B4FC"]
const PRINT = ["#2563EB", "#DC2626", "#059669", "#D97706", "#7C3AED", "#EA580C", "#0891B2", "#DB2777", "#65A30D", "#4F46E5"]

export type ThemePreset = { id: string; appearance: Appearance }

const noSheet = (fill: string) => ({ show: false, fill, radius: 0, borderColor: fill, borderWidth: 0, padding: 28 })

/** Six flat looks: one background, no gradients and no decorative shapes. */
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "claro",
    appearance: {
      name: "Claro",
      page: { background: "#FFFFFF", backgroundEnd: null, margin: 44 },
      colors: { ink: "#18181B", muted: "#71717A", accent: "#3B82F6" },
      sheet: noSheet("#FFFFFF"),
      header: { align: "start", gap: 28 },
      grid: {
        headerFill: "#FFFFFF", bodyFill: "#FFFFFF", lineColor: "#ECECEF", lineWidth: 1, halfHourLines: false,
        stripes: false, stripeColor: "#FAFAFA", columnGap: 0, radius: 0, hourFormat: "HH:mm",
      },
      blocks: { radius: 8, inset: 3, padding: 9, borderWidth: 0, borderColor: "auto", align: "start", style: "soft", showAccentBar: true },
      legend: { title: "Materias", showTitle: false, style: "chips" },
      decorations: { accentShapes: false },
      type: soft(),
      palette: BRIGHT,
    },
  },
  {
    id: "vivo",
    appearance: {
      name: "Vivo",
      page: { background: "#FFFFFF", backgroundEnd: null, margin: 40 },
      colors: { ink: "#18181B", muted: "#52525B", accent: "#E11D48" },
      sheet: noSheet("#FFFFFF"),
      header: { align: "center", gap: 24 },
      grid: {
        headerFill: "#18181B", bodyFill: "#FFFFFF", lineColor: "#E4E4E7", lineWidth: 1, halfHourLines: false,
        stripes: false, stripeColor: "#FAFAFA", columnGap: 0, radius: 12, hourFormat: "HH:mm",
      },
      blocks: { radius: 10, inset: 3, padding: 9, borderWidth: 0, borderColor: "auto", align: "center", style: "solid", showAccentBar: false },
      legend: { title: "Materias", showTitle: false, style: "chips" },
      decorations: { accentShapes: false },
      type: poster(),
      palette: VIVID,
    },
  },
  {
    id: "pastel",
    appearance: {
      name: "Pastel",
      page: { background: "#FFFFFF", backgroundEnd: null, margin: 40 },
      colors: { ink: "#27272A", muted: "#71717A", accent: "#EC4899" },
      sheet: noSheet("#FFFFFF"),
      header: { align: "start", gap: 26 },
      grid: {
        headerFill: "#FFFFFF", bodyFill: "#F7F7F8", lineColor: "#EDEDF0", lineWidth: 1, halfHourLines: false,
        stripes: false, stripeColor: "#F4F4F5", columnGap: 8, radius: 14, hourFormat: "H:mm",
      },
      blocks: { radius: 12, inset: 4, padding: 10, borderWidth: 0, borderColor: "auto", align: "start", style: "solid", showAccentBar: false },
      legend: { title: "Materias", showTitle: false, style: "chips" },
      decorations: { accentShapes: false },
      type: soft(),
      palette: PASTEL,
    },
  },
  {
    id: "noche",
    appearance: {
      name: "Noche",
      page: { background: "#0B0B0E", backgroundEnd: null, margin: 40 },
      colors: { ink: "#FAFAFA", muted: "#A1A1AA", accent: "#A78BFA" },
      sheet: noSheet("#0B0B0E"),
      header: { align: "start", gap: 28 },
      grid: {
        headerFill: "#0B0B0E", bodyFill: "#0B0B0E", lineColor: "#232329", lineWidth: 1, halfHourLines: false,
        stripes: false, stripeColor: "#111115", columnGap: 0, radius: 0, hourFormat: "HH:mm",
      },
      blocks: { radius: 8, inset: 3, padding: 9, borderWidth: 0, borderColor: "auto", align: "start", style: "solid", showAccentBar: false },
      legend: { title: "Materias", showTitle: false, style: "chips" },
      decorations: { accentShapes: false },
      type: soft(),
      palette: NEON,
    },
  },
  {
    id: "tinta",
    appearance: {
      name: "Tinta",
      page: { background: "#FFFFFF", backgroundEnd: null, margin: 36 },
      colors: { ink: "#0A0A0A", muted: "#525252", accent: "#0A0A0A" },
      sheet: noSheet("#FFFFFF"),
      header: { align: "start", gap: 22 },
      grid: {
        headerFill: "#0A0A0A", bodyFill: "#FFFFFF", lineColor: "#0A0A0A", lineWidth: 1.5, halfHourLines: false,
        stripes: false, stripeColor: "#F5F5F5", columnGap: 0, radius: 0, hourFormat: "HH:mm",
      },
      blocks: { radius: 4, inset: 4, padding: 8, borderWidth: 1.5, borderColor: "#0A0A0A", align: "start", style: "solid", showAccentBar: false },
      legend: { title: "Materias", showTitle: true, style: "list" },
      decorations: { accentShapes: false },
      type: technical(),
      palette: MARKER,
    },
  },
  {
    id: "editorial",
    appearance: {
      name: "Editorial",
      page: { background: "#FFFFFF", backgroundEnd: null, margin: 44 },
      colors: { ink: "#111111", muted: "#737373", accent: "#FF4F00" },
      sheet: noSheet("#FFFFFF"),
      header: { align: "start", gap: 26 },
      grid: {
        headerFill: "#FFFFFF", bodyFill: "#FFFFFF", lineColor: "#E5E5E5", lineWidth: 1, halfHourLines: true,
        stripes: false, stripeColor: "#FAFAFA", columnGap: 0, radius: 0, hourFormat: "HH:mm",
      },
      blocks: { radius: 0, inset: 2, padding: 8, borderWidth: 0, borderColor: "auto", align: "start", style: "outline", showAccentBar: true },
      legend: { title: "Índice", showTitle: true, style: "list" },
      decorations: { accentShapes: false },
      type: mono(),
      palette: PRINT,
    },
  },
]

/** Ids of looks that were retired or renamed, so legacy files and saved preferences still land on their closest successor. */
const RENAMED: Record<string, string> = { papel: "claro", pizarra: "noche" }

export function presetById(id: string) {
  const target = RENAMED[id] ?? id
  return THEME_PRESETS.find((preset) => preset.id === target)
}

export function defaultAppearance(): Appearance {
  return structuredClone(THEME_PRESETS[0]!.appearance)
}
