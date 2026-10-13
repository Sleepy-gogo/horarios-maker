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

const WARM = ["#F2A65A", "#7FB7BE", "#E86F68", "#9DC183", "#B79CED", "#F6D55C", "#5B8DEF", "#F28DB2", "#4FB3A9", "#C9A27E"]
const NIGHT = ["#F59E0B", "#38BDF8", "#F472B6", "#34D399", "#A78BFA", "#FB7185", "#FACC15", "#60A5FA", "#2DD4BF", "#FB923C"]
const INK = ["#0F766E", "#1D4ED8", "#B45309", "#BE123C", "#4D7C0F", "#7C3AED", "#0E7490", "#A16207", "#9D174D", "#334155"]
const PASTEL = ["#FBC4AB", "#B5E2FA", "#CDB4DB", "#C1E1C1", "#FFE5A0", "#F7B2BD", "#A2D2FF", "#D8E2DC", "#FFD6A5", "#BDE0FE"]
const MONO = ["#111111", "#3A3A3A", "#FF4F00", "#6B6B6B", "#1F3FFF", "#909090", "#00A86B", "#C0C0C0", "#E0115F", "#4B4B4B"]

export type ThemePreset = { id: string; appearance: Appearance }

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "papel",
    appearance: {
      name: "Papel",
      page: { background: "#F4EFE4", backgroundEnd: "#FFFAF0", margin: 36 },
      colors: { ink: "#171717", muted: "#6B655B", accent: "#D65A31" },
      sheet: { show: true, fill: "#FFFBF4", radius: 22, borderColor: "#E6DDCB", borderWidth: 1, padding: 32 },
      header: { align: "center", gap: 22 },
      grid: {
        headerFill: "#F4ECDD", bodyFill: "#FFFDF8", lineColor: "#DCD2BF", lineWidth: 1, halfHourLines: true,
        stripes: false, stripeColor: "#F6F0E4", columnGap: 0, radius: 12, hourFormat: "HH:mm",
      },
      blocks: { radius: 12, inset: 4, padding: 9, borderWidth: 0, borderColor: "auto", align: "center", style: "solid", showAccentBar: false },
      legend: { title: "Referencias", showTitle: true, style: "chips" },
      decorations: { accentShapes: true },
      type: poster(),
      palette: WARM,
    },
  },
  {
    id: "noche",
    appearance: {
      name: "Noche",
      page: { background: "#0F172A", backgroundEnd: "#111827", margin: 36 },
      colors: { ink: "#F8FAFC", muted: "#94A3B8", accent: "#F59E0B" },
      sheet: { show: true, fill: "#162033", radius: 16, borderColor: "#24324A", borderWidth: 1, padding: 30 },
      header: { align: "center", gap: 22 },
      grid: {
        headerFill: "#1C2840", bodyFill: "#131C2E", lineColor: "#2A3A55", lineWidth: 1, halfHourLines: true,
        stripes: false, stripeColor: "#162236", columnGap: 0, radius: 10, hourFormat: "HH:mm",
      },
      blocks: { radius: 9, inset: 4, padding: 9, borderWidth: 0, borderColor: "auto", align: "center", style: "solid", showAccentBar: false },
      legend: { title: "Referencias", showTitle: true, style: "chips" },
      decorations: { accentShapes: true },
      type: poster(),
      palette: NIGHT,
    },
  },
  {
    id: "tinta",
    appearance: {
      name: "Tinta",
      page: { background: "#E7ECEF", backgroundEnd: null, margin: 32 },
      colors: { ink: "#0F172A", muted: "#475569", accent: "#0F766E" },
      sheet: { show: false, fill: "#FFFFFF", radius: 4, borderColor: "#0F172A", borderWidth: 2, padding: 28 },
      header: { align: "start", gap: 20 },
      grid: {
        headerFill: "#0F172A", bodyFill: "#FFFFFF", lineColor: "#0F172A", lineWidth: 1.5, halfHourLines: false,
        stripes: true, stripeColor: "#F1F5F9", columnGap: 0, radius: 0, hourFormat: "HH:mm",
      },
      blocks: { radius: 2, inset: 3, padding: 8, borderWidth: 1.5, borderColor: "#0F172A", align: "start", style: "solid", showAccentBar: false },
      legend: { title: "Materias", showTitle: true, style: "list" },
      decorations: { accentShapes: false },
      type: technical(),
      palette: INK,
    },
  },
  {
    id: "pastel",
    appearance: {
      name: "Pastel",
      page: { background: "#FFF7F2", backgroundEnd: "#F3F0FF", margin: 36 },
      colors: { ink: "#2B2D42", muted: "#7A7D95", accent: "#E07A5F" },
      sheet: { show: false, fill: "#FFFFFF", radius: 24, borderColor: "#ECE6F5", borderWidth: 0, padding: 28 },
      header: { align: "start", gap: 24 },
      grid: {
        headerFill: "#FFFFFF", bodyFill: "#FFFFFF", lineColor: "#EAE4F2", lineWidth: 1, halfHourLines: false,
        stripes: false, stripeColor: "#FAF7FD", columnGap: 8, radius: 16, hourFormat: "H:mm",
      },
      blocks: { radius: 14, inset: 3, padding: 10, borderWidth: 0, borderColor: "auto", align: "start", style: "solid", showAccentBar: false },
      legend: { title: "Materias", showTitle: false, style: "chips" },
      decorations: { accentShapes: false },
      type: soft(),
      palette: PASTEL,
    },
  },
  {
    id: "pizarra",
    appearance: {
      name: "Pizarra",
      page: { background: "#1E2B26", backgroundEnd: "#16211D", margin: 34 },
      colors: { ink: "#EEF3EC", muted: "#A9B8AE", accent: "#E9C46A" },
      sheet: { show: false, fill: "#22312B", radius: 12, borderColor: "#30443B", borderWidth: 1, padding: 28 },
      header: { align: "center", gap: 22 },
      grid: {
        headerFill: "#22322B", bodyFill: "#1B2722", lineColor: "#3A5045", lineWidth: 1, halfHourLines: true,
        stripes: false, stripeColor: "#1F2C27", columnGap: 6, radius: 10, hourFormat: "HH:mm",
      },
      blocks: { radius: 8, inset: 3, padding: 9, borderWidth: 0, borderColor: "auto", align: "center", style: "soft", showAccentBar: true },
      legend: { title: "Referencias", showTitle: true, style: "chips" },
      decorations: { accentShapes: false },
      type: poster(),
      palette: NIGHT,
    },
  },
  {
    id: "editorial",
    appearance: {
      name: "Editorial",
      page: { background: "#FFFFFF", backgroundEnd: null, margin: 40 },
      colors: { ink: "#111111", muted: "#6F6F6F", accent: "#FF4F00" },
      sheet: { show: false, fill: "#FFFFFF", radius: 0, borderColor: "#111111", borderWidth: 0, padding: 24 },
      header: { align: "start", gap: 26 },
      grid: {
        headerFill: "#FFFFFF", bodyFill: "#FFFFFF", lineColor: "#D9D9D9", lineWidth: 1, halfHourLines: true,
        stripes: false, stripeColor: "#F7F7F7", columnGap: 0, radius: 0, hourFormat: "HH:mm",
      },
      blocks: { radius: 0, inset: 2, padding: 8, borderWidth: 0, borderColor: "auto", align: "start", style: "outline", showAccentBar: true },
      legend: { title: "Índice", showTitle: true, style: "list" },
      decorations: { accentShapes: false },
      type: mono(),
      palette: MONO,
    },
  },
]

export function presetById(id: string) {
  return THEME_PRESETS.find((preset) => preset.id === id)
}

export function defaultAppearance(): Appearance {
  return structuredClone(THEME_PRESETS[0]!.appearance)
}
