import { useEffect, useState } from "react"
import { AlertTriangle, Check, ChevronDown, Italic, Loader2, RefreshCw } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover"
import { SearchField } from "@/components/arc/search-field/search-field"
import { Button } from "@/components/ui/button"
import type { FontRef } from "@/domain/types"
import { LOCAL_FAMILIES, categoryLabel, loadGoogleCatalog, loadGoogleFamily, localFamily, localWeights, type GoogleFamily } from "@/fonts/catalog"
import { fontStatus, loadFont, retryFont } from "@/fonts/service"
import { useFontsVersion } from "@/hooks/use-fonts-version"
import { cn } from "@/lib/utils"
import { IconButton, Select } from "../common"

const WEIGHT_NAMES: Record<number, string> = { 100: "Fina", 200: "Extraligera", 300: "Ligera", 400: "Regular", 500: "Media", 600: "Seminegrita", 700: "Negrita", 800: "Extranegrita", 900: "Black" }

function weightName(weight: number) {
  return `${WEIGHT_NAMES[weight] ?? weight} (${weight})`
}

function closest(weights: number[], target: number) {
  return weights.reduce((best, weight) => (Math.abs(weight - target) < Math.abs(best - target) ? weight : best), weights[0] ?? 400)
}

type Variants = { weights: number[]; italic: boolean } | null

/** Available weights and italics for a font reference; Google families are looked up (and cached) on demand. */
function useVariants(ref: FontRef): Variants {
  const [google, setGoogle] = useState<{ id: string; weights: number[]; italic: boolean } | null>(null)
  useEffect(() => {
    if (ref.source !== "google") return
    let alive = true
    loadGoogleFamily(ref.id).then(
      (detail) => alive && setGoogle({ id: ref.id, weights: detail.weights, italic: detail.styles.includes("italic") }),
      () => alive && setGoogle({ id: ref.id, weights: [ref.weight], italic: ref.italic }),
    )
    return () => {
      alive = false
    }
  }, [ref.source, ref.id, ref.weight, ref.italic])
  if (ref.source === "local") {
    const family = localFamily(ref.id)
    return { weights: family ? localWeights(family) : [ref.weight], italic: false }
  }
  return google?.id === ref.id ? google : null
}

/** Load status of a font reference, re-rendering as fonts finish. */
export function FontStatusLine({ font }: { font: FontRef }) {
  const version = useFontsVersion()
  const status = fontStatus(font, version)
  useEffect(() => {
    if (!fontStatus(font)) void loadFont(font).catch(() => undefined)
  }, [font])
  if (!status || status.status === "loading") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
        <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Cargando {font.family}…
      </span>
    )
  }
  if (status.status === "error") {
    return (
      <span className="flex flex-wrap items-center gap-1.5 text-xs text-destructive" role="alert">
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        {status.message} La vista usa DM Sans y no se puede exportar hasta resolverlo.
        <Button size="xs" variant="outline" onClick={() => void retryFont(font).catch(() => undefined)}>
          <RefreshCw /> Reintentar
        </Button>
      </span>
    )
  }
  return null
}

export function FontPicker({ label, value, onChange }: { label: string; value: FontRef; onChange: (font: FontRef) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [catalog, setCatalog] = useState<GoogleFamily[] | null>(null)
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [picking, setPicking] = useState<string | null>(null)
  const [pickError, setPickError] = useState<string | null>(null)
  const variants = useVariants(value)

  useEffect(() => {
    if (!open || catalog) return
    let alive = true
    loadGoogleCatalog().then(
      (families) => alive && setCatalog(families),
      (error: unknown) => alive && setCatalogError(error instanceof Error ? error.message : "Sin conexión"),
    )
    return () => {
      alive = false
    }
  }, [open, catalog])

  const key = query.trim().toLocaleLowerCase("es")
  const locals = LOCAL_FAMILIES.filter((family) => !key || family.family.toLocaleLowerCase("es").includes(key))
  const googles = (catalog ?? []).filter((family) => !key || family.family.toLocaleLowerCase("es").includes(key)).slice(0, key ? 60 : 30)

  const pickLocal = (id: string) => {
    const family = localFamily(id)!
    onChange({ source: "local", id: family.id, family: family.family, weight: closest(localWeights(family), value.weight), italic: false })
    setOpen(false)
  }
  const pickGoogle = async (entry: GoogleFamily) => {
    setPicking(entry.id)
    setPickError(null)
    try {
      const detail = await loadGoogleFamily(entry.id)
      const italic = value.italic && detail.styles.includes("italic")
      onChange({ source: "google", id: detail.id, family: detail.family, version: detail.version, weight: closest(detail.weights, value.weight), italic })
      setOpen(false)
    } catch (error) {
      setPickError(error instanceof Error ? error.message : "No se pudo obtener la familia.")
    } finally {
      setPicking(null)
    }
  }

  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)_auto] gap-1.5">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className="flex h-8 min-w-0 items-center justify-between gap-2 rounded-lg border border-input px-2.5 text-left text-sm outline-none hover:bg-foreground/4 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[popup-open]:border-ring dark:bg-input/30" aria-label={`${label}: ${value.family}. Cambiar fuente`}>
            <span className="truncate" style={{ fontFamily: `"${value.family}"` }}>{value.family}</span>
            <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
              {value.source === "google" ? "Google" : "Incluida"}
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-80 max-w-[calc(100vw-1.5rem)] p-0" align="start">
            <div className="border-b border-border p-2">
              <SearchField label="Buscar fuentes" value={query} onValueChange={setQuery} placeholder="Buscar entre +1500 fuentes" autoFocus />
            </div>
            <div className="max-h-80 overflow-auto p-1" role="listbox" aria-label="Fuentes">
              {locals.length ? <p className="px-2 pt-1.5 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Incluidas, sin conexión</p> : null}
              {locals.map((family) => (
                <button key={family.id} type="button" role="option" aria-selected={value.source === "local" && value.id === family.id} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none" onClick={() => pickLocal(family.id)}>
                  <span className="truncate">{family.family}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {family.category}
                    {value.source === "local" && value.id === family.id ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : null}
                  </span>
                </button>
              ))}
              <p className="px-2 pt-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Google Fonts</p>
              {catalogError ? (
                <div className="px-2 py-2 text-xs text-destructive">
                  No se pudo cargar el catálogo ({catalogError}).
                  <Button size="xs" variant="outline" className="ml-1" onClick={() => { setCatalogError(null); loadGoogleCatalog(true).then(setCatalog, (error: unknown) => setCatalogError(error instanceof Error ? error.message : "Sin conexión")) }}>
                    Reintentar
                  </Button>
                </div>
              ) : !catalog ? (
                <p className="flex items-center gap-1.5 px-2 py-2 text-xs text-muted-foreground" role="status">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" /> Cargando catálogo…
                </p>
              ) : googles.length ? (
                googles.map((family) => (
                  <button key={family.id} type="button" role="option" aria-selected={value.source === "google" && value.id === family.id} disabled={!!picking} className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:opacity-60" onClick={() => void pickGoogle(family)}>
                    <span className="truncate">{family.family}</span>
                    <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                      {picking === family.id ? <Loader2 className="size-3 animate-spin" aria-hidden="true" /> : categoryLabel(family.category)}
                      {value.source === "google" && value.id === family.id ? <Check className="size-3.5 text-primary" aria-hidden="true" /> : null}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-2 py-2 text-xs text-muted-foreground">Sin resultados.</p>
              )}
              {pickError ? <p className="px-2 py-1 text-xs text-destructive" role="alert">{pickError}</p> : null}
            </div>
          </PopoverContent>
        </Popover>
        <Select
          label={`${label}: peso`}
          hideLabel
          value={String(value.weight)}
          disabled={!variants}
          onValueChange={(weight) => onChange({ ...value, weight: Number(weight) })}
          options={(variants?.weights.includes(value.weight) ? variants.weights : [...(variants?.weights ?? []), value.weight].sort((a, b) => a - b)).map((weight) => ({ value: String(weight), label: weightName(weight) }))}
        />
        <IconButton
          label={variants?.italic || value.italic ? "Cursiva" : "Esta fuente no tiene cursiva"}
          variant="outline"
          aria-pressed={value.italic}
          disabled={!variants?.italic && !value.italic}
          className={cn("size-8", value.italic && "border-primary bg-primary/10 text-primary")}
          onClick={() => onChange({ ...value, italic: !value.italic })}
        >
          <Italic />
        </IconButton>
      </div>
      <div className="flex flex-wrap items-center gap-2 empty:hidden">
        <FontStatusLine font={value} />
      </div>
    </div>
  )
}
