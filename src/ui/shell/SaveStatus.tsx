import { AlertTriangle, Check, CloudOff, Loader2, RefreshCw } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useStudio } from "@/state/studio"

function time(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })
}

/** Truthful save state: "Guardado" only after the write committed. Failures stay visible with recovery actions. */
export function SaveStatus({ compact = false }: { compact?: boolean }) {
  const save = useStudio((state) => state.session?.save)
  const studio = useStudio.getState()
  if (!save) return null

  if (save.state === "saved" || save.state === "pending" || save.state === "saving") {
    const busy = save.state !== "saved"
    return (
      <span
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs text-muted-foreground"
        role="status"
        title={save.state === "saved" ? `Guardado en este navegador a las ${time(save.at)}` : "Guardando en este navegador"}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
        <span className={cn(compact && "sr-only")}>{busy ? "Guardando…" : "Guardado"}</span>
      </span>
    )
  }

  const tone = save.state === "conflict" ? "warning" : "danger"
  const label = save.state === "conflict" ? "Cambios en otra pestaña" : save.state === "unavailable" ? "Sin guardado local" : "No se pudo guardar"
  const description =
    save.state === "conflict"
      ? "Otra pestaña guardó una versión más nueva de este proyecto. El guardado automático está en pausa para no pisar ninguna de las dos."
      : save.state === "unavailable"
        ? `${save.message} Tus cambios están solo en esta pestaña.`
        : `${save.message} Tus cambios siguen en esta pestaña.`
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          tone === "warning" ? "border-warning/40 bg-warning/10 text-warning" : "border-destructive/40 bg-destructive/10 text-destructive",
        )}
      >
        {save.state === "conflict" ? <AlertTriangle className="size-3.5" aria-hidden="true" /> : <CloudOff className="size-3.5" aria-hidden="true" />}
        <span className={cn(compact && "max-w-24 truncate")}>{label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-1.5rem)] p-4" align="end">
        <p className="text-sm font-medium">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {save.state === "error" ? (
            <Button size="sm" onClick={() => void studio.saveNow()}>
              <RefreshCw /> Reintentar
            </Button>
          ) : null}
          {save.state === "conflict" ? (
            <>
              <Button size="sm" onClick={() => void studio.reloadFromStorage()}>
                Cargar la otra versión
              </Button>
              <Button size="sm" variant="outline" onClick={() => void studio.saveAsCopy()}>
                Guardar la mía como copia
              </Button>
            </>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => studio.downloadProject()}>
            Descargar JSON
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
