import { openDB, type DBSchema, type IDBPDatabase } from "idb"
import type { SavedTheme, ScheduleDocument } from "@/domain/types"

export type ProjectRecord = {
  id: string
  document: ScheduleDocument
  /** Increases with every successful write; used to detect writes from other tabs. */
  revision: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type FontRecord = { url: string; bytes: ArrayBuffer; sha256: string; fetchedAt: string }

export type LegacyRecord = { id?: number; kind: "local-storage" | "link" | "invalid-link"; raw: string; createdAt: string; projectId?: string }

interface StudioDB extends DBSchema {
  projects: { key: string; value: ProjectRecord }
  themes: { key: string; value: SavedTheme }
  kv: { key: string; value: unknown }
  fonts: { key: string; value: FontRecord }
  legacy: { key: number; value: LegacyRecord }
}

let dbPromise: Promise<IDBPDatabase<StudioDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    if (typeof indexedDB === "undefined") return Promise.reject(new Error("Este navegador no ofrece IndexedDB."))
    dbPromise = openDB<StudioDB>("horario-studio", 1, {
      upgrade(db) {
        db.createObjectStore("projects", { keyPath: "id" })
        db.createObjectStore("themes", { keyPath: "id" })
        db.createObjectStore("kv")
        db.createObjectStore("fonts", { keyPath: "url" })
        db.createObjectStore("legacy", { keyPath: "id", autoIncrement: true })
      },
      blocking() {
        // A newer version was opened in another tab: release this connection so it can upgrade.
        void dbPromise?.then((db) => db.close())
        dbPromise = null
      },
    }).catch((error) => {
      dbPromise = null
      throw error
    })
  }
  return dbPromise
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const db = await getDB()
  return (await db.get("kv", key)) as T | undefined
}

export async function kvSet(key: string, value: unknown) {
  const db = await getDB()
  await db.put("kv", value, key)
}

export function describeStorageError(error: unknown) {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : ""
  if (name === "QuotaExceededError") return "El navegador no tiene espacio disponible para este sitio."
  if (name === "InvalidStateError" || name === "SecurityError") return "El navegador bloquea el almacenamiento local (por ejemplo, en modo privado)."
  if (error instanceof Error && error.message) return error.message
  return "Error desconocido del almacenamiento."
}
