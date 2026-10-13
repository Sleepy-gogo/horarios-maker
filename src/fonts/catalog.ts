import { kvGet, kvSet } from "@/storage/db"

export type LocalFamily = {
  id: "dm-sans" | "bebas-neue" | "jetbrains-mono" | "inter" | "geist"
  family: string
  url: string
  weights: [number, number]
  category: string
}

/** Complete OFL files shipped with the app, so the studio works offline from the first visit. */
export const LOCAL_FAMILIES: LocalFamily[] = [
  { id: "dm-sans", family: "DM Sans", url: "/fonts/DM-Sans-Variable.ttf", weights: [100, 1000], category: "Sans serif" },
  { id: "bebas-neue", family: "Bebas Neue", url: "/fonts/Bebas-Neue-Regular.ttf", weights: [400, 400], category: "Display" },
  { id: "inter", family: "Inter", url: "/fonts/Inter-Variable.ttf", weights: [100, 900], category: "Sans serif" },
  { id: "geist", family: "Geist", url: "/fonts/Geist-Variable.ttf", weights: [100, 900], category: "Sans serif" },
  { id: "jetbrains-mono", family: "JetBrains Mono", url: "/fonts/JetBrains-Mono-Variable.ttf", weights: [100, 800], category: "Monoespaciada" },
]

export function localFamily(id: string) {
  return LOCAL_FAMILIES.find((family) => family.id === id)
}

export function localWeights(family: LocalFamily) {
  const [min, max] = family.weights
  const list: number[] = []
  for (let weight = Math.ceil(min / 100) * 100; weight <= Math.min(max, 900); weight += 100) list.push(weight)
  return list.length ? list : [min]
}

export type GoogleFamily = {
  id: string
  family: string
  category: string
  weights: number[]
  styles: string[]
  subsets: string[]
}

export type GoogleFamilyDetail = GoogleFamily & { version: string }

const API = "https://api.fontsource.org/v1/fonts"
const CATALOG_KEY = "google-catalog"
const CATALOG_TTL = 7 * 24 * 60 * 60 * 1000

const CATEGORY_LABELS: Record<string, string> = {
  "sans-serif": "Sans serif",
  serif: "Serif",
  display: "Display",
  handwriting: "Manuscrita",
  monospace: "Monoespaciada",
}

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category
}

let catalogPromise: Promise<GoogleFamily[]> | null = null

/** Google Fonts families available as complete TTF files through Fontsource. Cached for a week. */
export function loadGoogleCatalog(force = false): Promise<GoogleFamily[]> {
  if (catalogPromise && !force) return catalogPromise
  catalogPromise = (async () => {
    const cached = await kvGet<{ fetchedAt: number; families: GoogleFamily[] }>(CATALOG_KEY).catch(() => undefined)
    if (!force && cached && Date.now() - cached.fetchedAt < CATALOG_TTL) return cached.families
    try {
      const response = await fetch(`${API}?type=google`)
      if (!response.ok) throw new Error(`El catálogo respondió ${response.status}`)
      const data = (await response.json()) as Array<Record<string, unknown>>
      const families = data
        .filter((entry) => Array.isArray(entry.subsets) && (entry.subsets as string[]).includes("latin"))
        .map((entry) => ({
          id: String(entry.id),
          family: String(entry.family),
          category: String(entry.category ?? ""),
          weights: (entry.weights as number[]) ?? [400],
          styles: (entry.styles as string[]) ?? ["normal"],
          subsets: (entry.subsets as string[]) ?? ["latin"],
        }))
      await kvSet(CATALOG_KEY, { fetchedAt: Date.now(), families }).catch(() => undefined)
      return families
    } catch (error) {
      if (cached) return cached.families
      catalogPromise = null
      throw error
    }
  })()
  return catalogPromise
}

const detailCache = new Map<string, Promise<GoogleFamilyDetail>>()

export function loadGoogleFamily(id: string): Promise<GoogleFamilyDetail> {
  let promise = detailCache.get(id)
  if (!promise) {
    promise = (async () => {
      const key = `google-family:${id}`
      try {
        const response = await fetch(`${API}/${encodeURIComponent(id)}`)
        if (!response.ok) throw new Error(response.status === 404 ? "La familia no existe en Google Fonts." : `Fontsource respondió ${response.status}`)
        const entry = (await response.json()) as Record<string, unknown>
        const detail: GoogleFamilyDetail = {
          id,
          family: String(entry.family),
          category: String(entry.category ?? ""),
          weights: (entry.weights as number[]) ?? [400],
          styles: (entry.styles as string[]) ?? ["normal"],
          subsets: (entry.subsets as string[]) ?? ["latin"],
          version: String(entry.npmVersion ?? "latest"),
        }
        await kvSet(key, detail).catch(() => undefined)
        return detail
      } catch (error) {
        const cached = await kvGet<GoogleFamilyDetail>(key).catch(() => undefined)
        if (cached) return cached
        detailCache.delete(id)
        throw error
      }
    })()
    detailCache.set(id, promise)
  }
  return promise
}

export function googleFileUrl(id: string, version: string, subset: string, weight: number, italic: boolean) {
  return `https://cdn.jsdelivr.net/fontsource/fonts/${id}@${version}/${subset}-${weight}-${italic ? "italic" : "normal"}.ttf`
}
