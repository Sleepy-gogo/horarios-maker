import { createId, nowIso, reidentify } from "./document"
import { isLegacyState, migrateLegacy, type MigrationReport } from "./legacy"
import { validateDocument, validateTheme, type ValidationProblem } from "./schema"
import type { ScheduleDocument, SavedTheme } from "./types"

export const PROJECT_FORMAT = "horario-studio/project"
export const BACKUP_FORMAT = "horario-studio/backup"
export const THEME_FORMAT = "horario-studio/theme"

export type ProjectFile = { format: typeof PROJECT_FORMAT; schemaVersion: 2; exportedAt: string; document: ScheduleDocument }

export type BackupProject = { document: ScheduleDocument; updatedAt: string; deletedAt?: string | null }

export type BackupFile = {
  format: typeof BACKUP_FORMAT
  schemaVersion: 2
  exportedAt: string
  projects: BackupProject[]
  themes: SavedTheme[]
  swatches: string[]
}

export function projectFile(document: ScheduleDocument): ProjectFile {
  return { format: PROJECT_FORMAT, schemaVersion: 2, exportedAt: nowIso(), document }
}

export type ImportCandidate =
  | { kind: "project"; document: ScheduleDocument; report: MigrationReport | null; source: "v2" | "v1" }
  | { kind: "backup"; projects: BackupProject[]; themes: SavedTheme[]; swatches: string[]; rejected: number }
  | { kind: "theme"; themes: SavedTheme[] }

export type ImportResult = { ok: true; candidate: ImportCandidate } | { ok: false; message: string; problems?: ValidationProblem[] }

/** Reads any supported file. Nothing is stored here: the caller reviews the candidate and confirms. */
export function readImport(text: string): ImportResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, message: "El archivo no es JSON válido." }
  }
  if (!data || typeof data !== "object") return { ok: false, message: "El archivo no contiene un proyecto." }
  const record = data as Record<string, unknown>

  if (isLegacyState(data)) {
    const migrated = migrateLegacy(data)
    if ("error" in migrated) return { ok: false, message: migrated.error }
    return { ok: true, candidate: { kind: "project", document: migrated.document, report: migrated.report, source: "v1" } }
  }

  if (typeof record.schemaVersion === "number" && record.schemaVersion > 2) {
    return { ok: false, message: `El archivo usa la versión ${record.schemaVersion}, más nueva que esta aplicación. Actualizá la página e intentá de nuevo.` }
  }

  if (record.format === PROJECT_FORMAT || (record.format === undefined && record.schemaVersion === 2)) {
    const docInput = record.format === PROJECT_FORMAT ? record.document : data
    const result = validateDocument(docInput)
    if (!result.ok) return { ok: false, message: "El proyecto tiene datos inválidos.", problems: result.problems }
    return { ok: true, candidate: { kind: "project", document: reidentify(result.document), report: null, source: "v2" } }
  }

  if (record.format === BACKUP_FORMAT) {
    const projects: BackupProject[] = []
    let rejected = 0
    for (const entry of Array.isArray(record.projects) ? record.projects : []) {
      const value = entry as Record<string, unknown>
      const result = validateDocument(value?.document)
      if (!result.ok) {
        rejected++
        continue
      }
      projects.push({
        document: reidentify(result.document),
        updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : nowIso(),
        deletedAt: typeof value.deletedAt === "string" ? value.deletedAt : null,
      })
    }
    const themes = (Array.isArray(record.themes) ? record.themes : [])
      .map((theme) => validateTheme(theme))
      .filter((theme): theme is SavedTheme => !!theme)
      .map((theme) => ({ ...theme, id: createId("thm") }))
    const swatches = (Array.isArray(record.swatches) ? record.swatches : []).filter((value): value is string => typeof value === "string" && /^#[0-9a-f]{6,8}$/i.test(value))
    if (!projects.length && !themes.length) return { ok: false, message: "La copia de seguridad no contiene proyectos ni temas válidos." }
    return { ok: true, candidate: { kind: "backup", projects, themes, swatches, rejected } }
  }

  if (record.format === THEME_FORMAT) {
    const list = Array.isArray(record.themes) ? record.themes : [record.theme]
    const themes = list.map((theme) => validateTheme(theme)).filter((theme): theme is SavedTheme => !!theme)
    if (!themes.length) return { ok: false, message: "El archivo de tema es inválido." }
    return { ok: true, candidate: { kind: "theme", themes: themes.map((theme) => ({ ...theme, id: createId("thm") })) } }
  }

  return { ok: false, message: "No reconocemos este formato. Elegí un proyecto, una copia de seguridad o un tema de Horario Studio." }
}

export function slugify(text: string) {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "horario"
  )
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function downloadJson(data: unknown, fileName: string) {
  downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), fileName)
}
