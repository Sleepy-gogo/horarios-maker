import { nowIso } from "@/domain/document"
import { validateDocument } from "@/domain/schema"
import type { SavedTheme, ScheduleDocument } from "@/domain/types"
import { getDB, kvGet, kvSet, type LegacyRecord, type ProjectRecord } from "./db"

export type ProjectMeta = {
  id: string
  title: string
  subjects: number
  blocks: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  revision: number
  /** Present when the stored document no longer passes validation. */
  damaged?: string
}

export const TRASH_DAYS = 7

export class ConflictError extends Error {
  readonly storedRevision: number
  constructor(storedRevision: number) {
    super("Otra pestaña guardó una versión más nueva de este proyecto.")
    this.storedRevision = storedRevision
  }
}

function metaOf(record: ProjectRecord): ProjectMeta {
  const doc = record.document
  return {
    id: record.id,
    title: doc?.settings?.title?.trim() || "Sin título",
    subjects: Array.isArray(doc?.subjects) ? doc.subjects.length : 0,
    blocks: Array.isArray(doc?.blocks) ? doc.blocks.length : 0,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    revision: record.revision,
  }
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const db = await getDB()
  const records = await db.getAll("projects")
  return records
    .map((record) => {
      const meta = metaOf(record)
      const check = validateDocument(record.document)
      return check.ok ? meta : { ...meta, damaged: check.problems.map((problem) => `${problem.path}: ${problem.message}`).join("; ") }
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function loadProject(id: string): Promise<{ document: ScheduleDocument; revision: number }> {
  const db = await getDB()
  const record = await db.get("projects", id)
  if (!record) throw new Error("El proyecto ya no existe en este navegador.")
  const check = validateDocument(record.document)
  if (!check.ok) throw new Error(`El proyecto guardado está dañado (${check.problems[0]?.path}: ${check.problems[0]?.message}).`)
  return { document: check.document, revision: record.revision }
}

export async function getRawProject(id: string) {
  const db = await getDB()
  return db.get("projects", id)
}

/** Creates a new record. Fails instead of overwriting an existing id. */
export async function createProject(document: ScheduleDocument): Promise<ProjectMeta> {
  const db = await getDB()
  const tx = db.transaction("projects", "readwrite")
  if (await tx.store.get(document.id)) throw new Error("Ya existe un proyecto con ese identificador.")
  const now = nowIso()
  const record: ProjectRecord = { id: document.id, document, revision: 1, createdAt: now, updatedAt: now, deletedAt: null }
  await tx.store.add(record)
  await tx.done
  return metaOf(record)
}

/**
 * Writes a new revision only if the stored one is the one this tab started from. The previous record stays intact until the
 * transaction commits, so a failed write never loses the last good copy.
 */
export async function saveProject(document: ScheduleDocument, baseRevision: number): Promise<ProjectMeta> {
  const db = await getDB()
  const tx = db.transaction("projects", "readwrite")
  const current = await tx.store.get(document.id)
  if (current && current.revision !== baseRevision) {
    tx.abort()
    await tx.done.catch(() => undefined)
    throw new ConflictError(current.revision)
  }
  const now = nowIso()
  const record: ProjectRecord = {
    id: document.id,
    document,
    revision: (current?.revision ?? 0) + 1,
    createdAt: current?.createdAt ?? now,
    updatedAt: now,
    deletedAt: current?.deletedAt ?? null,
  }
  await tx.store.put(record)
  await tx.done
  return metaOf(record)
}

export async function setDeleted(id: string, deleted: boolean) {
  const db = await getDB()
  const tx = db.transaction("projects", "readwrite")
  const record = await tx.store.get(id)
  if (!record) throw new Error("El proyecto ya no existe.")
  record.deletedAt = deleted ? nowIso() : null
  record.revision += 1
  await tx.store.put(record)
  await tx.done
  return metaOf(record)
}

export async function deleteForever(id: string) {
  const db = await getDB()
  await db.delete("projects", id)
}

export async function purgeTrash() {
  const db = await getDB()
  const limit = Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000
  const records = await db.getAll("projects")
  const expired = records.filter((record) => record.deletedAt && Date.parse(record.deletedAt) < limit)
  for (const record of expired) await db.delete("projects", record.id)
  return expired.length
}

export async function allProjectRecords() {
  const db = await getDB()
  return db.getAll("projects")
}

// Themes

export async function listThemes(): Promise<SavedTheme[]> {
  const db = await getDB()
  const themes = await db.getAll("themes")
  return themes.sort((a, b) => a.name.localeCompare(b.name, "es"))
}

export async function putTheme(theme: SavedTheme) {
  const db = await getDB()
  await db.put("themes", theme)
}

export async function deleteTheme(id: string) {
  const db = await getDB()
  await db.delete("themes", id)
}

// Preferences

export type Prefs = {
  lastProjectId?: string
  uiTheme: "system" | "light" | "dark"
  defaultThemeId?: string
  libraryOpen: boolean
  inspectorOpen: boolean
  swatches: string[]
  pngScale: number
}

export const DEFAULT_PREFS: Prefs = { uiTheme: "system", libraryOpen: true, inspectorOpen: true, swatches: [], pngScale: 2 }

const PREFS_KEY = "prefs"
const LOCAL_PREFS_KEY = "horario-studio-prefs"

/** Small preferences live in IndexedDB with a localStorage mirror, so the UI theme applies before IndexedDB opens. */
export function readLocalPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(LOCAL_PREFS_KEY)
    if (raw) return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) }
  } catch {
    // ignore
  }
  return { ...DEFAULT_PREFS }
}

export async function loadPrefs(): Promise<Prefs> {
  const stored = await kvGet<Partial<Prefs>>(PREFS_KEY).catch(() => undefined)
  return { ...readLocalPrefs(), ...(stored ?? {}) }
}

export async function savePrefs(prefs: Prefs) {
  try {
    window.localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify({ uiTheme: prefs.uiTheme, libraryOpen: prefs.libraryOpen, inspectorOpen: prefs.inspectorOpen }))
  } catch {
    // ignore
  }
  await kvSet(PREFS_KEY, prefs)
}

// Legacy originals are kept untouched in their own store.

export async function keepLegacy(record: Omit<LegacyRecord, "id">) {
  const db = await getDB()
  return db.add("legacy", record as LegacyRecord)
}

export async function listLegacy() {
  const db = await getDB()
  return db.getAll("legacy")
}
