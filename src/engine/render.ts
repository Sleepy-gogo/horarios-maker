import { localFont } from "@/domain/presets"
import type { Appearance, FontRef, ScheduleDocument } from "@/domain/types"
import { fontKey, fontStatus, fontsVersion, loadFont, readyFont, type ResolvedFont } from "@/fonts/service"
import { layoutDocument } from "./layout"
import type { Scene } from "./scene"
import { sceneToSvg } from "./svg"

export type Rendered = { scene: Scene; svg: string }

export function requiredFonts(appearance: Appearance): FontRef[] {
  const map = new Map<string, FontRef>()
  for (const style of Object.values(appearance.type)) map.set(fontKey(style.font), style.font)
  return [...map.values()]
}

function fallbackFor(ref: FontRef): FontRef {
  return { ...localFont("dm-sans"), weight: Math.min(1000, Math.max(100, ref.weight)) }
}

export type FontsState = { state: "ready" } | { state: "loading" } | { state: "failed"; refs: FontRef[] }

/** Starts loading every font of an appearance (and the local fallbacks of failed ones) and reports the overall state. */
/** `fontsVersion` is only a dependency marker so memoizing callers recompute when a font finishes loading. */
export function ensureFonts(appearance: Appearance, _fontsVersion?: number): FontsState {
  const failed: FontRef[] = []
  let loading = false
  for (const ref of requiredFonts(appearance)) {
    const status = fontStatus(ref)
    if (!status) {
      void loadFont(ref).catch(() => undefined)
      loading = true
    } else if (status.status === "loading") {
      loading = true
    } else if (status.status === "error") {
      failed.push(ref)
      const fallback = fallbackFor(ref)
      const fallbackStatus = fontStatus(fallback)
      if (!fallbackStatus) {
        void loadFont(fallback).catch(() => undefined)
        loading = true
      } else if (fallbackStatus.status === "loading") loading = true
    }
  }
  if (loading) return { state: "loading" }
  if (failed.length) return { state: "failed", refs: failed }
  return { state: "ready" }
}

const cache = new WeakMap<ScheduleDocument, { version: number; idPrefix: string; result: Rendered }>()

/** Builds the scene and its SVG. Returns null while fonts are still loading. */
export function renderDocument(doc: ScheduleDocument, idPrefix = "hs", _fontsVersion?: number): Rendered | null {
  const state = ensureFonts(doc.appearance)
  if (state.state === "loading") return null
  const version = fontsVersion()
  const cached = cache.get(doc)
  if (cached && cached.version === version && cached.idPrefix === idPrefix) return cached.result
  const resolve = (ref: FontRef): { font: ResolvedFont; fallback: boolean } => {
    const font = readyFont(ref)
    if (font) return { font, fallback: false }
    const fallback = readyFont(fallbackFor(ref))
    if (!fallback) throw new Error("La fuente de respaldo no está disponible.")
    return { font: fallback, fallback: true }
  }
  try {
    const scene = layoutDocument(doc, resolve)
    const result = { scene, svg: sceneToSvg(scene, idPrefix) }
    cache.set(doc, { version, idPrefix, result })
    return result
  } catch (error) {
    console.error(error)
    return null
  }
}
