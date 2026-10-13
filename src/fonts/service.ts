import type { FontRef } from "@/domain/types"
import { getDB } from "@/storage/db"
import { googleFileUrl, loadGoogleFamily, localFamily } from "./catalog"

type HB = typeof import("harfbuzzjs")
type HBFont = InstanceType<HB["Font"]>
type HBDrawFuncs = InstanceType<HB["DrawFuncs"]>

let hbPromise: Promise<HB> | null = null

export function loadHarfBuzz(): Promise<HB> {
  if (!hbPromise) {
    hbPromise = import("harfbuzzjs").catch((error) => {
      hbPromise = null
      throw error
    })
  }
  return hbPromise
}

export type FaceHandle = {
  /** Stable id used for glyph definitions: file hash prefix plus weight. */
  key: string
  font: HBFont
  upem: number
  ascender: number
  descender: number
  sha256: string
  paths: Map<number, string>
}

export type ResolvedFont = {
  refKey: string
  ref: FontRef
  /** Primary face first, then other subsets of the same family. Never another family. */
  faces: FaceHandle[]
}

export type FontStatus = { status: "loading" } | { status: "ready"; font: ResolvedFont } | { status: "error"; message: string }

export function fontKey(ref: FontRef) {
  return `${ref.source}:${ref.id}@${ref.version ?? ""}:${ref.weight}:${ref.italic ? "i" : "n"}`
}

const statuses = new Map<string, FontStatus>()
const pending = new Map<string, Promise<ResolvedFont>>()
const listeners = new Set<() => void>()
let version = 0

let scheduled = false

/** Notifies after the current task, so a render that starts a load never updates other components mid-render. */
function emit() {
  if (scheduled) return
  scheduled = true
  queueMicrotask(() => {
    scheduled = false
    version++
    for (const listener of listeners) listener()
  })
}

export function subscribeFonts(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function fontsVersion() {
  return version
}

export function fontStatus(ref: FontRef, _fontsVersion?: number): FontStatus | undefined {
  return statuses.get(fontKey(ref))
}

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

const fileCache = new Map<string, Promise<{ bytes: ArrayBuffer; sha256: string }>>()

/** Downloads a font file once; remote files are kept in IndexedDB so projects reopen offline. */
function fetchFontFile(url: string, persist: boolean) {
  let promise = fileCache.get(url)
  if (!promise) {
    promise = (async () => {
      if (persist) {
        const stored = await getDB().then((db) => db.get("fonts", url)).catch(() => undefined)
        if (stored) return { bytes: stored.bytes, sha256: stored.sha256 }
      }
      let response: Response
      try {
        response = await fetch(url)
      } catch {
        throw new Error("No hay conexión para descargar la fuente.")
      }
      if (!response.ok) throw new Error(response.status === 404 ? "Esa variante no existe." : `El servidor de fuentes respondió ${response.status}.`)
      const bytes = await response.arrayBuffer()
      const signature = new Uint8Array(bytes.slice(0, 4))
      const tag = String.fromCharCode(...signature)
      if (!(tag === "\u0000\u0001\u0000\u0000" || tag === "OTTO" || tag === "true")) throw new Error("El archivo descargado no es una fuente TrueType/OpenType.")
      const hash = await sha256(bytes)
      if (persist) {
        await getDB()
          .then((db) => db.put("fonts", { url, bytes, sha256: hash, fetchedAt: new Date().toISOString() }))
          .catch(() => undefined)
      }
      return { bytes, sha256: hash }
    })().catch((error) => {
      fileCache.delete(url)
      throw error
    })
    fileCache.set(url, promise)
  }
  return promise
}

const faceCache = new Map<string, { face: InstanceType<HB["Face"]>; axes: Record<string, { min: number; max: number; default: number }>; sha256: string }>()

async function loadFace(hb: HB, url: string, persist: boolean) {
  const cached = faceCache.get(url)
  if (cached) return cached
  const file = await fetchFontFile(url, persist)
  const blob = new hb.Blob(file.bytes)
  const face = new hb.Face(blob, 0)
  if (!face.upem) throw new Error("La fuente no tiene métricas válidas.")
  const axes = face.getAxisInfos() as Record<string, { min: number; max: number; default: number }>
  const entry = { face, axes, sha256: file.sha256 }
  faceCache.set(url, entry)
  return entry
}

async function makeHandle(hb: HB, url: string, weight: number, persist: boolean): Promise<FaceHandle> {
  const { face, axes, sha256: hash } = await loadFace(hb, url, persist)
  const font = new hb.Font(face)
  const wght = axes.wght
  let resolvedWeight = weight
  if (wght) {
    resolvedWeight = Math.min(wght.max, Math.max(wght.min, weight))
    font.setVariations([new hb.Variation("wght", resolvedWeight)])
  }
  const extents = font.hExtents()
  return {
    key: `${hash.slice(0, 8)}${wght ? `w${resolvedWeight}` : ""}`,
    font,
    upem: face.upem,
    ascender: extents.ascender,
    descender: Math.abs(extents.descender),
    sha256: hash,
    paths: new Map(),
  }
}

async function resolve(ref: FontRef): Promise<ResolvedFont> {
  const hb = await loadHarfBuzz()
  if (ref.source === "local") {
    const family = localFamily(ref.id)
    if (!family) throw new Error(`La fuente local "${ref.family}" no existe.`)
    if (ref.italic) throw new Error(`${family.family} no incluye cursiva.`)
    const handle = await makeHandle(hb, family.url, ref.weight, false)
    return { refKey: fontKey(ref), ref, faces: [handle] }
  }
  const detail = await loadGoogleFamily(ref.id)
  const versionPin = ref.version ?? detail.version
  if (!detail.weights.includes(ref.weight)) throw new Error(`${detail.family} no tiene peso ${ref.weight}.`)
  if (ref.italic && !detail.styles.includes("italic")) throw new Error(`${detail.family} no tiene cursiva.`)
  const subsets = ["latin", "latin-ext"].filter((subset) => detail.subsets.includes(subset))
  if (!subsets.length) throw new Error(`${detail.family} no cubre el alfabeto latino.`)
  const faces: FaceHandle[] = []
  for (const subset of subsets) {
    try {
      faces.push(await makeHandle(hb, googleFileUrl(ref.id, versionPin, subset, ref.weight, ref.italic), ref.weight, true))
    } catch (error) {
      // The latin subset is required; extended Latin only adds coverage.
      if (subset === "latin") throw error
    }
  }
  return { refKey: fontKey(ref), ref: { ...ref, version: versionPin }, faces }
}

/** Loads a font reference, tracking its status. Failures are reported, never replaced by another family. */
export function loadFont(ref: FontRef): Promise<ResolvedFont> {
  const key = fontKey(ref)
  const existing = statuses.get(key)
  if (existing?.status === "ready") return Promise.resolve(existing.font)
  let promise = pending.get(key)
  if (!promise) {
    statuses.set(key, { status: "loading" })
    emit()
    promise = resolve(ref)
      .then((font) => {
        statuses.set(key, { status: "ready", font })
        return font
      })
      .catch((error: unknown) => {
        statuses.set(key, { status: "error", message: error instanceof Error ? error.message : "No se pudo cargar la fuente." })
        throw error
      })
      .finally(() => {
        pending.delete(key)
        emit()
      })
    pending.set(key, promise)
  }
  return promise
}

export function retryFont(ref: FontRef) {
  const key = fontKey(ref)
  if (statuses.get(key)?.status === "error") statuses.delete(key)
  return loadFont(ref)
}

export function readyFont(ref: FontRef): ResolvedFont | undefined {
  const status = statuses.get(fontKey(ref))
  return status?.status === "ready" ? status.font : undefined
}

let drawFuncs: HBDrawFuncs | null = null

/** Glyph outline in font units (y up), rounded to a tenth of a unit. */
export function glyphPath(face: FaceHandle, gid: number, hb: HB): string {
  let path = face.paths.get(gid)
  if (path !== undefined) return path
  if (!drawFuncs) {
    drawFuncs = new hb.DrawFuncs()
    const r = (value: number) => Math.round(value * 10) / 10
    drawFuncs.setMoveToFunc((x, y, data) => (data as string[]).push(`M${r(x)} ${r(y)}`))
    drawFuncs.setLineToFunc((x, y, data) => (data as string[]).push(`L${r(x)} ${r(y)}`))
    drawFuncs.setQuadraticToFunc((cx, cy, x, y, data) => (data as string[]).push(`Q${r(cx)} ${r(cy)} ${r(x)} ${r(y)}`))
    drawFuncs.setCubicToFunc((c1x, c1y, c2x, c2y, x, y, data) =>
      (data as string[]).push(`C${r(c1x)} ${r(c1y)} ${r(c2x)} ${r(c2y)} ${r(x)} ${r(y)}`),
    )
    drawFuncs.setClosePathFunc((data) => (data as string[]).push("Z"))
  }
  const parts: string[] = []
  face.font.drawGlyph(gid, drawFuncs, parts)
  path = parts.join("")
  face.paths.set(gid, path)
  return path
}
