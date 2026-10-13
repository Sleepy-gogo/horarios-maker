import { z } from "zod"
import { DAY_IDS, MAX_BLOCKS, MAX_SUBJECTS, PAGE_LIMITS, TEXT_LIMITS } from "./constants"
import type { Appearance, ScheduleDocument, SavedTheme } from "./types"

const hex = z.string().regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "color inválido")
const dayId = z.enum(DAY_IDS as [string, ...string[]])
const minute = z.number().int().min(0).max(1440)
const size = (min: number, max: number) => z.number().finite().min(min).max(max)

export const fontRefSchema = z.object({
  source: z.enum(["local", "google"]),
  id: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/),
  family: z.string().min(1).max(80),
  version: z.string().max(24).optional(),
  weight: z.number().int().min(100).max(1000),
  italic: z.boolean(),
})

const textStyle = z.object({
  font: fontRefSchema,
  size: size(4, 240),
  letterSpacing: size(-0.2, 0.6),
  uppercase: z.boolean(),
  lineHeight: size(0.8, 2.4),
})

export const appearanceSchema = z.object({
  name: z.string().max(60),
  page: z.object({ background: hex, backgroundEnd: hex.nullable(), margin: size(0, 300) }),
  colors: z.object({ ink: hex, muted: hex, accent: hex }),
  sheet: z.object({
    show: z.boolean(), fill: hex, radius: size(0, 120), borderColor: hex, borderWidth: size(0, 20), padding: size(0, 200),
  }),
  header: z.object({ align: z.enum(["start", "center"]), gap: size(0, 200) }),
  grid: z.object({
    headerFill: hex, bodyFill: hex, lineColor: hex, lineWidth: size(0, 12), halfHourLines: z.boolean(),
    stripes: z.boolean(), stripeColor: hex, columnGap: size(0, 60), radius: size(0, 80),
    hourFormat: z.enum(["HH:mm", "H:mm", "H"]),
  }),
  blocks: z.object({
    radius: size(0, 60), inset: size(0, 30), padding: size(0, 40), borderWidth: size(0, 12),
    borderColor: z.union([z.literal("auto"), hex]), align: z.enum(["center", "start"]),
    style: z.enum(["solid", "soft", "outline"]), showAccentBar: z.boolean(),
  }),
  legend: z.object({ title: z.string().max(40), showTitle: z.boolean(), style: z.enum(["chips", "list"]) }),
  decorations: z.object({ accentShapes: z.boolean() }),
  type: z.object({
    title: textStyle, subtitle: textStyle, day: textStyle, hour: textStyle,
    blockTitle: textStyle, blockMeta: textStyle, legend: textStyle,
  }),
  palette: z.array(hex).min(1).max(24),
})

const subjectSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1, "nombre vacío").max(TEXT_LIMITS.subjectName),
  color: hex,
  textColor: hex,
})

const blockSchema = z.object({
  id: z.string().min(1).max(64),
  subjectId: z.string().min(1).max(64),
  day: dayId,
  start: minute,
  end: minute,
  room: z.string().max(TEXT_LIMITS.room),
  kind: z.string().max(TEXT_LIMITS.kind),
  notes: z.string().max(TEXT_LIMITS.notes),
})

const settingsSchema = z.object({
  title: z.string().max(TEXT_LIMITS.title),
  subtitle: z.string().max(TEXT_LIMITS.subtitle),
  page: z.object({
    preset: z.enum(["a4-portrait", "a4-landscape", "square", "story", "widescreen", "custom"]),
    width: z.number().int().min(PAGE_LIMITS.min).max(PAGE_LIMITS.max),
    height: z.number().int().min(PAGE_LIMITS.min).max(PAGE_LIMITS.max),
  }),
  days: z.array(dayId).min(1).max(7),
  range: z.object({ start: minute, end: minute }),
  show: z.object({
    subtitle: z.boolean(), room: z.boolean(), kind: z.boolean(), notes: z.boolean(),
    blockTimes: z.boolean(), hourLabels: z.boolean(), legend: z.boolean(),
  }),
})

export const documentSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1).max(64),
  createdAt: z.string().max(40),
  subjects: z.array(subjectSchema).max(MAX_SUBJECTS),
  blocks: z.array(blockSchema).max(MAX_BLOCKS),
  settings: settingsSchema,
  appearance: appearanceSchema,
})

export const savedThemeSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  themeSchemaVersion: z.literal(1),
  appearance: appearanceSchema,
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40),
})

export type ValidationProblem = { path: string; message: string }

const FIELD_NAMES: Record<string, string> = {
  subjects: "materias",
  blocks: "bloques",
  settings: "ajustes",
  appearance: "apariencia",
  name: "nombre",
  color: "color",
  textColor: "color de texto",
  start: "inicio",
  end: "fin",
  day: "día",
  days: "días",
  range: "rango",
  page: "hoja",
  title: "título",
  subtitle: "subtítulo",
  room: "aula",
  kind: "tipo",
  notes: "notas",
}

function describePath(path: PropertyKey[]) {
  return path
    .map((part) => (typeof part === "number" ? `#${part + 1}` : FIELD_NAMES[String(part)] ?? String(part)))
    .join(" › ")
}

function zodProblems(error: z.ZodError): ValidationProblem[] {
  return error.issues.slice(0, 30).map((issue) => ({
    path: describePath(issue.path),
    message: issue.code === "invalid_type" ? "falta o tiene un tipo incorrecto" : issue.message,
  }))
}

/** Structural and referential validation. Never repairs: returns problems instead. */
export function validateDocument(input: unknown): { ok: true; document: ScheduleDocument } | { ok: false; problems: ValidationProblem[] } {
  const parsed = documentSchema.safeParse(input)
  if (!parsed.success) return { ok: false, problems: zodProblems(parsed.error) }
  const doc = parsed.data as ScheduleDocument
  const problems: ValidationProblem[] = []
  const subjectIds = new Set<string>()
  doc.subjects.forEach((subject, index) => {
    if (subjectIds.has(subject.id)) problems.push({ path: `materias › #${index + 1}`, message: `ID repetido "${subject.id}"` })
    subjectIds.add(subject.id)
  })
  const blockIds = new Set<string>()
  doc.blocks.forEach((block, index) => {
    const path = `bloques › #${index + 1}`
    if (blockIds.has(block.id)) problems.push({ path, message: `ID repetido "${block.id}"` })
    blockIds.add(block.id)
    if (!subjectIds.has(block.subjectId)) problems.push({ path, message: "referencia a una materia inexistente" })
    if (block.start >= block.end) problems.push({ path, message: "el inicio debe ser anterior al fin" })
    if (block.start >= 1440) problems.push({ path, message: "el inicio no puede ser 24:00" })
  })
  if (doc.settings.range.start >= doc.settings.range.end) problems.push({ path: "ajustes › rango", message: "el rango horario está invertido" })
  if (doc.settings.range.end - doc.settings.range.start < 60) problems.push({ path: "ajustes › rango", message: "el rango debe cubrir al menos una hora" })
  if (new Set(doc.settings.days).size !== doc.settings.days.length) problems.push({ path: "ajustes › días", message: "días repetidos" })
  if (problems.length) return { ok: false, problems }
  return { ok: true, document: doc }
}

export function validateAppearance(input: unknown): Appearance | null {
  const parsed = appearanceSchema.safeParse(input)
  return parsed.success ? (parsed.data as Appearance) : null
}

export function validateTheme(input: unknown): SavedTheme | null {
  const parsed = savedThemeSchema.safeParse(input)
  return parsed.success ? (parsed.data as SavedTheme) : null
}
