import { create } from "zustand"
import { toast } from "sonner"
import { HISTORY_LIMIT } from "@/domain/constants"
import { createDocument, nowIso, reidentify } from "@/domain/document"
import { downloadBlob, downloadJson, projectFile, slugify, type BackupFile, BACKUP_FORMAT } from "@/domain/files"
import { decodeLegacyLink, LEGACY_STORAGE_KEY, migrateLegacy, type MigrationReport } from "@/domain/legacy"
import { presetById, defaultAppearance } from "@/domain/presets"
import type { Appearance, DocumentSettings, SavedTheme, ScheduleDocument } from "@/domain/types"
import { describeStorageError, getDB, kvGet, kvSet } from "@/storage/db"
import {
  allProjectRecords, ConflictError, createProject, DEFAULT_PREFS, deleteForever, deleteTheme, keepLegacy, listProjects, listThemes,
  loadPrefs, loadProject, purgeTrash, putTheme, readLocalPrefs, saveProject, savePrefs, setDeleted, type Prefs, type ProjectMeta,
} from "@/storage/projects"
import { useEditor } from "./editor"
import { announce, useNotices } from "./notices"

export type SaveState =
  | { state: "saved"; at: string }
  | { state: "pending" }
  | { state: "saving" }
  | { state: "error"; message: string }
  | { state: "conflict" }
  | { state: "unavailable"; message: string }

type HistoryEntry = { doc: ScheduleDocument; label: string; key?: string; at?: number }

/** Consecutive changes with the same key within this window (a color drag, slider scrub) form one undo step. */
const COALESCE_MS = 1500

export type CommitOptions = { announce?: string; coalesce?: string }

export type Session = {
  doc: ScheduleDocument
  past: HistoryEntry[]
  future: HistoryEntry[]
  baseRevision: number
  /** True while the latest document has not been written. */
  dirty: boolean
  save: SaveState
}

type StudioState = {
  boot: "loading" | "ready"
  storageOk: boolean
  storageMessage: string
  projects: ProjectMeta[]
  themes: SavedTheme[]
  prefs: Prefs
  session: Session | null
  bootStart: () => Promise<void>
  refreshProjects: () => Promise<void>
  commit: (label: string, recipe: (doc: ScheduleDocument) => ScheduleDocument, options?: CommitOptions) => boolean
  undo: () => void
  redo: () => void
  saveNow: () => Promise<boolean>
  openProject: (id: string) => Promise<boolean>
  closeProject: () => Promise<void>
  newProject: (settings: Partial<DocumentSettings>, appearance?: Appearance) => Promise<void>
  addProject: (doc: ScheduleDocument, options?: { open?: boolean; legacyRaw?: string; legacyKind?: "local-storage" | "link" }) => Promise<ProjectMeta | null>
  duplicateProject: (id: string) => Promise<void>
  trashProject: (id: string) => Promise<void>
  restoreProject: (id: string) => Promise<void>
  destroyProject: (id: string) => Promise<void>
  reloadFromStorage: () => Promise<void>
  saveAsCopy: () => Promise<void>
  setPrefs: (patch: Partial<Prefs>) => void
  saveTheme: (theme: SavedTheme) => Promise<void>
  removeTheme: (id: string) => Promise<SavedTheme | undefined>
  downloadProject: (doc?: ScheduleDocument) => void
  downloadBackup: () => Promise<void>
}

const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("horario-studio") : null

let saveTimer: number | undefined
let saving: Promise<boolean> | null = null
let booted = false

function scheduleSave() {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void useStudio.getState().saveNow(), 450)
}

function fileName(doc: ScheduleDocument, extension: string) {
  return `${slugify(doc.settings.title)}.${extension}`
}

async function hashText(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest).slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

function reportDetails(report: MigrationReport | null | undefined) {
  if (!report) return undefined
  return [...report.notes, ...report.skipped.map((item) => `Bloque ${item.index + 1} sin convertir: ${item.reason}. El original quedó guardado.`)]
}

export const useStudio = create<StudioState>((set, get) => ({
  boot: "loading",
  storageOk: true,
  storageMessage: "",
  projects: [],
  themes: [],
  prefs: readLocalPrefs(),
  session: null,

  bootStart: async () => {
    // StrictMode mounts twice in development; migrations and listeners must run once.
    if (booted) return
    booted = true
    const notices = useNotices.getState()
    try {
      await getDB()
    } catch (error) {
      set({ storageOk: false, storageMessage: describeStorageError(error), boot: "ready" })
      notices.push({
        id: "storage-unavailable",
        tone: "danger",
        title: "Este navegador no permite guardar proyectos",
        body: `${describeStorageError(error)} Podés trabajar igual y descargar el proyecto como JSON antes de cerrar.`,
      })
      return
    }
    const prefs = await loadPrefs().catch(() => ({ ...DEFAULT_PREFS }))
    set({ prefs })
    await purgeTrash().catch(() => undefined)
    set({ themes: await listThemes().catch(() => []) })

    // Previous single-schedule version: import once as a new project, never touching the original key.
    let legacyRaw: string | null = null
    try {
      legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY)
    } catch {
      legacyRaw = null
    }
    if (legacyRaw) {
      const marker = `legacy-migrated:${await hashText(legacyRaw)}`
      if (!(await kvGet(marker).catch(() => true))) {
        let parsed: unknown = null
        try {
          parsed = JSON.parse(legacyRaw)
        } catch {
          parsed = null
        }
        const migrated = parsed ? migrateLegacy(parsed) : { error: "El contenido no es JSON válido." }
        if ("document" in migrated) {
          const meta = await get().addProject(migrated.document, { open: false, legacyRaw, legacyKind: "local-storage" })
          if (meta) {
            await kvSet(marker, meta.id).catch(() => undefined)
            notices.push({
              id: "legacy-local",
              tone: "info",
              title: "Importamos tu horario anterior como un proyecto nuevo",
              body: "El original sigue guardado sin cambios en este navegador.",
              details: reportDetails(migrated.report),
              dismissible: true,
            })
          }
        } else {
          await keepLegacy({ kind: "local-storage", raw: legacyRaw, createdAt: nowIso() }).catch(() => undefined)
          await kvSet(marker, "invalid").catch(() => undefined)
          notices.push({
            id: "legacy-local",
            tone: "warning",
            title: "No pudimos leer el horario de la versión anterior",
            body: `${migrated.error} Lo conservamos tal como estaba; podés descargarlo.`,
            actions: [{ label: "Descargar original", run: () => downloadBlob(new Blob([legacyRaw!], { type: "text/plain" }), "horario-anterior.txt") }],
            dismissible: true,
          })
        }
      }
    }

    // Old share links (?s=...) open as a new project; a damaged link never touches local projects.
    let openId: string | null = null
    const url = new URL(window.location.href)
    const linkValue = url.searchParams.get("s")
    if (linkValue) {
      const marker = `legacy-link:${await hashText(linkValue)}`
      const known = await kvGet<string>(marker).catch(() => undefined)
      let parsed: unknown = null
      try {
        parsed = decodeLegacyLink(linkValue)
      } catch {
        parsed = null
      }
      const migrated = parsed ? migrateLegacy(parsed) : { error: "El enlace está incompleto o dañado." }
      if (known && known !== "invalid") {
        openId = known
      } else if ("document" in migrated) {
        const meta = await get().addProject(migrated.document, { open: false, legacyRaw: linkValue, legacyKind: "link" })
        if (meta) {
          openId = meta.id
          await kvSet(marker, meta.id).catch(() => undefined)
          notices.push({
            id: "legacy-link",
            tone: "info",
            title: "Abrimos el horario del enlace como un proyecto nuevo",
            details: reportDetails(migrated.report),
            dismissible: true,
          })
        }
      } else {
        await keepLegacy({ kind: "invalid-link", raw: linkValue, createdAt: nowIso() }).catch(() => undefined)
        notices.push({
          id: "legacy-link",
          tone: "warning",
          title: "El enlace no contiene un horario válido",
          body: `${migrated.error} Tus proyectos no se modificaron.`,
          actions: [{ label: "Descargar enlace", run: () => downloadBlob(new Blob([linkValue], { type: "text/plain" }), "enlace-horario.txt") }],
          dismissible: true,
        })
      }
      if (openId || !("document" in migrated)) {
        url.searchParams.delete("s")
        window.history.replaceState(null, "", url.pathname + (url.search ? url.search : "") + url.hash)
      }
    }

    await get().refreshProjects()
    const projects = get().projects.filter((project) => !project.deletedAt)
    const target = openId ?? (projects.find((project) => project.id === prefs.lastProjectId) ? prefs.lastProjectId! : projects[0]?.id)
    if (target) {
      const opened = await get().openProject(target)
      if (!opened) useEditor.getState().openDialog("projects")
    }
    set({ boot: "ready" })

    channel?.addEventListener("message", (event: MessageEvent) => {
      const data = event.data as { type: string; id: string; revision?: number }
      void get().refreshProjects()
      const session = get().session
      if (!session || data.id !== session.doc.id) return
      if (data.type === "saved" && (data.revision ?? 0) > session.baseRevision) {
        if (!session.dirty && session.save.state !== "saving") void get().reloadFromStorage()
        else set({ session: { ...session, save: { state: "conflict" } } })
      }
      if (data.type === "deleted") {
        useNotices.getState().push({
          id: "deleted-elsewhere",
          tone: "warning",
          title: "Este proyecto se envió a la papelera en otra pestaña",
          body: "Seguís viendo tu copia. Podés restaurarlo desde Mis proyectos.",
          dismissible: true,
        })
      }
    })
  },

  refreshProjects: async () => {
    if (!get().storageOk) return
    try {
      set({ projects: await listProjects() })
    } catch {
      // keep the previous list
    }
  },

  commit: (label, recipe, options) => {
    const session = get().session
    if (!session) return false
    const next = recipe(session.doc)
    if (next === session.doc) return false
    const last = session.past.at(-1)
    const now = Date.now()
    const merge = !!options?.coalesce && !session.future.length && last?.key === options.coalesce && now - (last.at ?? 0) < COALESCE_MS
    const past = merge
      ? [...session.past.slice(0, -1), { ...last!, at: now }]
      : [...session.past, { doc: session.doc, label, key: options?.coalesce, at: now }].slice(-HISTORY_LIMIT)
    set({ session: { ...session, doc: next, past, future: [], dirty: true, save: get().storageOk ? (session.save.state === "conflict" ? session.save : { state: "pending" }) : session.save } })
    if (options?.announce) announce(options.announce)
    scheduleSave()
    return true
  },

  undo: () => {
    const session = get().session
    const entry = session?.past.at(-1)
    if (!session || !entry) return
    set({
      session: {
        ...session,
        doc: entry.doc,
        past: session.past.slice(0, -1),
        future: [{ doc: session.doc, label: entry.label }, ...session.future],
        dirty: true,
        save: session.save.state === "conflict" || session.save.state === "unavailable" ? session.save : { state: "pending" },
      },
    })
    announce(`Deshecho: ${entry.label}`)
    scheduleSave()
  },

  redo: () => {
    const session = get().session
    const entry = session?.future[0]
    if (!session || !entry) return
    set({
      session: {
        ...session,
        doc: entry.doc,
        past: [...session.past, { doc: session.doc, label: entry.label }],
        future: session.future.slice(1),
        dirty: true,
        save: session.save.state === "conflict" || session.save.state === "unavailable" ? session.save : { state: "pending" },
      },
    })
    announce(`Rehecho: ${entry.label}`)
    scheduleSave()
  },

  saveNow: async () => {
    window.clearTimeout(saveTimer)
    if (saving) await saving
    const session = get().session
    if (!session) return true
    if (!get().storageOk) {
      set({ session: { ...session, save: { state: "unavailable", message: get().storageMessage } } })
      return false
    }
    if (session.save.state === "conflict") return false
    if (!session.dirty) return true
    const doc = session.doc
    set({ session: { ...session, save: { state: "saving" } } })
    saving = (async () => {
      try {
        const meta = await saveProject(doc, session.baseRevision)
        const current = get().session
        if (current && current.doc.id === doc.id) {
          const changedMeanwhile = current.doc !== doc
          set({
            session: {
              ...current,
              baseRevision: meta.revision,
              dirty: changedMeanwhile,
              save: changedMeanwhile ? { state: "pending" } : { state: "saved", at: meta.updatedAt },
            },
          })
          if (changedMeanwhile) scheduleSave()
        }
        set({ projects: [meta, ...get().projects.filter((project) => project.id !== meta.id)] })
        channel?.postMessage({ type: "saved", id: meta.id, revision: meta.revision })
        return true
      } catch (error) {
        const current = get().session
        if (current && current.doc.id === doc.id) {
          set({
            session: {
              ...current,
              save: error instanceof ConflictError ? { state: "conflict" } : { state: "error", message: describeStorageError(error) },
            },
          })
        }
        return false
      } finally {
        saving = null
      }
    })()
    return saving
  },

  openProject: async (id) => {
    const current = get().session
    if (current?.doc.id === id) return true
    if (current?.dirty) {
      const saved = await get().saveNow()
      if (!saved) {
        toast.error("Guardá o descargá el proyecto actual antes de cambiar.", { description: "No se pudo guardar en este navegador." })
        return false
      }
    }
    try {
      const { document, revision } = await loadProject(id)
      useEditor.getState().reset()
      set({ session: { doc: document, past: [], future: [], baseRevision: revision, dirty: false, save: { state: "saved", at: nowIso() } } })
      get().setPrefs({ lastProjectId: id })
      useNotices.getState().dismiss("open-failed")
      return true
    } catch (error) {
      useNotices.getState().push({
        id: "open-failed",
        tone: "danger",
        title: "No se pudo abrir el proyecto",
        body: `${error instanceof Error ? error.message : "Error desconocido"} El contenido guardado no se modificó.`,
        dismissible: true,
      })
      return false
    }
  },

  closeProject: async () => {
    if (get().session?.dirty) await get().saveNow()
    useEditor.getState().reset()
    set({ session: null })
  },

  newProject: async (settings, appearance) => {
    let look = appearance
    if (!look) {
      const defaultId = get().prefs.defaultThemeId
      const saved = get().themes.find((theme) => theme.id === defaultId)
      look = saved?.appearance ?? presetById(defaultId ?? "")?.appearance ?? defaultAppearance()
    }
    const doc = createDocument(settings, look)
    await get().addProject(doc, { open: true })
  },

  addProject: async (doc, options = {}) => {
    if (!get().storageOk) {
      // In-memory only: still usable, with a visible warning and JSON download.
      if (options.open !== false) {
        useEditor.getState().reset()
        set({ session: { doc, past: [], future: [], baseRevision: 0, dirty: true, save: { state: "unavailable", message: get().storageMessage } } })
      }
      return null
    }
    try {
      const meta = await createProject(doc)
      if (options.legacyRaw) {
        await keepLegacy({ kind: options.legacyKind ?? "local-storage", raw: options.legacyRaw, createdAt: nowIso(), projectId: meta.id }).catch(() => undefined)
      }
      await get().refreshProjects()
      if (options.open !== false) await get().openProject(meta.id)
      return meta
    } catch (error) {
      useNotices.getState().push({
        id: `create-failed-${doc.id}`,
        tone: "danger",
        title: "No se pudo crear el proyecto en este navegador",
        body: describeStorageError(error),
        actions: [{ label: "Descargar JSON", run: () => get().downloadProject(doc), primary: true }],
        dismissible: true,
      })
      return null
    }
  },

  duplicateProject: async (id) => {
    const session = get().session
    let doc: ScheduleDocument
    if (session?.doc.id === id) doc = session.doc
    else doc = (await loadProject(id)).document
    const copy = reidentify(doc)
    copy.settings = { ...copy.settings, title: `${doc.settings.title || "Horario"}, copia`.slice(0, 120) }
    const meta = await get().addProject(copy, { open: false })
    if (meta) toast.success(`Se creó "${copy.settings.title}"`, { action: { label: "Abrir", onClick: () => void get().openProject(meta.id) } })
  },

  trashProject: async (id) => {
    try {
      await setDeleted(id, true)
      channel?.postMessage({ type: "deleted", id })
      if (get().session?.doc.id === id) {
        useEditor.getState().reset()
        set({ session: null })
      }
      await get().refreshProjects()
      toast("Proyecto enviado a la papelera", {
        description: "Se elimina definitivamente en 7 días.",
        action: { label: "Deshacer", onClick: () => void get().restoreProject(id) },
      })
    } catch (error) {
      toast.error("No se pudo eliminar el proyecto", { description: describeStorageError(error) })
    }
  },

  restoreProject: async (id) => {
    try {
      await setDeleted(id, false)
      await get().refreshProjects()
      toast.success("Proyecto restaurado")
    } catch (error) {
      toast.error("No se pudo restaurar", { description: describeStorageError(error) })
    }
  },

  destroyProject: async (id) => {
    try {
      await deleteForever(id)
      await get().refreshProjects()
    } catch (error) {
      toast.error("No se pudo eliminar", { description: describeStorageError(error) })
    }
  },

  reloadFromStorage: async () => {
    const session = get().session
    if (!session) return
    try {
      const { document, revision } = await loadProject(session.doc.id)
      useEditor.getState().set({ draft: null, candidate: null, selectedBlockId: null })
      set({ session: { doc: document, past: [], future: [], baseRevision: revision, dirty: false, save: { state: "saved", at: nowIso() } } })
      toast("Se cargó la versión guardada en otra pestaña")
    } catch (error) {
      toast.error("No se pudo recargar", { description: error instanceof Error ? error.message : undefined })
    }
  },

  saveAsCopy: async () => {
    const session = get().session
    if (!session) return
    const copy = reidentify(session.doc)
    copy.settings = { ...copy.settings, title: `${session.doc.settings.title || "Horario"}, copia`.slice(0, 120) }
    await get().addProject(copy, { open: true })
  },

  setPrefs: (patch) => {
    const prefs = { ...get().prefs, ...patch }
    set({ prefs })
    if (get().storageOk) void savePrefs(prefs).catch(() => undefined)
  },

  saveTheme: async (theme) => {
    await putTheme(theme)
    set({ themes: await listThemes() })
  },

  removeTheme: async (id) => {
    const theme = get().themes.find((item) => item.id === id)
    await deleteTheme(id)
    set({ themes: await listThemes() })
    if (get().prefs.defaultThemeId === id) get().setPrefs({ defaultThemeId: undefined })
    return theme
  },

  downloadProject: (doc) => {
    const target = doc ?? get().session?.doc
    if (!target) return
    downloadJson(projectFile(target), fileName(target, "horario.json"))
  },

  downloadBackup: async () => {
    if (get().session?.dirty) await get().saveNow()
    const records = get().storageOk ? await allProjectRecords() : []
    const session = get().session
    const projects = records.map((record) => ({ document: record.document, updatedAt: record.updatedAt, deletedAt: record.deletedAt }))
    if (session && !records.some((record) => record.id === session.doc.id)) projects.push({ document: session.doc, updatedAt: nowIso(), deletedAt: null })
    const backup: BackupFile = {
      format: BACKUP_FORMAT,
      schemaVersion: 2,
      exportedAt: nowIso(),
      projects,
      themes: get().themes,
      swatches: get().prefs.swatches,
    }
    const date = new Date().toISOString().slice(0, 10)
    downloadJson(backup, `horario-studio-copia-${date}.json`)
    announce("Copia de seguridad descargada")
  },
}))

/** Shortcut for components and handlers. */
export function commit(label: string, recipe: (doc: ScheduleDocument) => ScheduleDocument, options?: CommitOptions) {
  return useStudio.getState().commit(label, recipe, options)
}

export function currentDoc() {
  return useStudio.getState().session?.doc ?? null
}

window.addEventListener("beforeunload", (event) => {
  const session = useStudio.getState().session
  if (session?.dirty) {
    void useStudio.getState().saveNow()
    event.preventDefault()
  }
})
