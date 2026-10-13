import { useEffect, useId, useRef, useState } from "react"
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Loader2, Maximize, Minus, MousePointer2, Plus, RefreshCw, SquarePlus, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { STEP } from "@/domain/constants"
import type { ScheduleDocument } from "@/domain/types"
import { retryFont } from "@/fonts/service"
import { retryEngine, useEngineReady } from "@/hooks/use-engine"
import { useFontsVersion } from "@/hooks/use-fonts-version"
import { useRendered } from "@/hooks/use-rendered"
import { ensureFonts, type Rendered } from "@/engine/render"
import { cn } from "@/lib/utils"
import { cancelCandidate, confirmCandidate, describeInterval, moveCandidate } from "@/state/actions"
import { useEditor } from "@/state/editor"
import { IconButton, Swatch } from "../common"
import { mod } from "../platform"
import { fitRangeToBlocks, setZoom, zoomBy } from "../commands"
import { DocumentCanvas } from "./DocumentCanvas"

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      const box = entry!.contentRect
      setSize((current) => (Math.abs(current.width - box.width) < 0.5 && Math.abs(current.height - box.height) < 0.5 ? current : { width: box.width, height: box.height }))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

/** Keeps showing the previous rendering while fonts for a change load, so the canvas never blinks. */
function useStableRendering(doc: ScheduleDocument) {
  const rendered = useRendered(doc)
  const [shown, setShown] = useState<Rendered | null>(rendered)
  if (rendered && rendered !== shown) setShown(rendered)
  return { rendered: rendered ?? shown, pending: !rendered }
}

function ToolSwitch({ doc }: { doc: ScheduleDocument }) {
  const tool = useEditor((state) => state.tool)
  const armedSubjectId = useEditor((state) => state.armedSubjectId)
  const armed = doc.subjects.find((subject) => subject.id === armedSubjectId)
  const editor = useEditor.getState()
  return (
    <div className="flex min-w-0 items-center gap-1" role="toolbar" aria-label="Herramientas">
      <IconButton label="Seleccionar y mover" shortcut="V" aria-pressed={tool === "select"} className={cn(tool === "select" && "bg-accent text-foreground")} onClick={() => editor.set({ tool: "select", hover: null })}>
        <MousePointer2 />
      </IconButton>
      <div className={cn("flex min-w-0 items-center rounded-lg border border-transparent", tool === "place" && "border-primary/40 bg-primary/10")}>
        <IconButton
          label="Colocar materia en la grilla"
          shortcut="B"
          aria-pressed={tool === "place"}
          disabled={!doc.subjects.length}
          className={cn(tool === "place" && "text-primary")}
          onClick={() => editor.arm(armed?.id ?? doc.subjects[0]?.id ?? null)}
        >
          <SquarePlus />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={!doc.subjects.length}
            className="flex h-8 max-w-44 min-w-0 items-center gap-1.5 rounded-md px-1.5 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            aria-label={armed ? `Materia a colocar: ${armed.name}. Cambiar` : "Elegir materia a colocar"}
          >
            {armed ? <Swatch color={armed.color} /> : null}
            <span className="truncate max-sm:hidden">{armed?.name ?? "Materia"}</span>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="max-h-80 w-auto min-w-52" align="start">
            <DropdownMenuLabel>Colocar…</DropdownMenuLabel>
            {doc.subjects.map((subject) => (
              <DropdownMenuItem key={subject.id} onClick={() => editor.arm(subject.id)}>
                <Swatch color={subject.color} />
                <span className="max-w-60 truncate">{subject.name}</span>
                {subject.id === armedSubjectId ? <Check className="ml-auto" /> : null}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => editor.openDialog("subject")}>
              <Plus /> Nueva materia…
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function IssuesButton({ rendered }: { rendered: Rendered }) {
  const issues = rendered.scene.issues
  if (!issues.length) return null
  const errors = issues.filter((issue) => issue.level === "error").length
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
          errors ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-warning/40 bg-warning/10 text-warning",
        )}
      >
        <AlertTriangle className="size-3.5" aria-hidden="true" />
        {issues.length} {issues.length === 1 ? "aviso" : "avisos"}
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[calc(100vw-1.5rem)] p-0" align="end">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-medium">Revisión del documento</p>
          <p className="text-xs text-muted-foreground">{errors ? "Hay problemas que impiden exportar." : "Se puede exportar, pero conviene revisar esto."}</p>
        </div>
        <ul className="max-h-80 overflow-auto py-1">
          {issues.map((issue, index) => (
            <li key={index} className="flex items-start gap-2 px-4 py-2 text-sm">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", issue.level === "error" ? "bg-destructive" : "bg-warning")} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="leading-snug">{issue.message}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {issue.blockId ? (
                    <Button size="xs" variant="outline" onClick={() => useEditor.getState().select(issue.blockId!)}>
                      Seleccionar bloque
                    </Button>
                  ) : null}
                  {issue.code === "out-of-range" ? (
                    <Button size="xs" variant="outline" onClick={fitRangeToBlocks}>
                      Ajustar rango a mis clases
                    </Button>
                  ) : null}
                  {issue.code === "font-unavailable" || issue.code === "missing-glyphs" ? (
                    <Button size="xs" variant="outline" onClick={() => useEditor.getState().openDialog("appearance", { tab: "type" })}>
                      Revisar tipografía
                    </Button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function ZoomControls({ zoom }: { zoom: number }) {
  return (
    <div className="flex shrink-0 items-center rounded-lg border border-border" role="group" aria-label="Zoom">
      <IconButton label="Alejar" shortcut={`${mod}−`} size="icon-sm" onClick={() => zoomBy(0.8)}>
        <Minus />
      </IconButton>
      <DropdownMenu>
        <DropdownMenuTrigger className="h-7 min-w-14 rounded-md px-1 text-xs tabular-nums outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Zoom ${Math.round(zoom * 100)} %. Cambiar`}>
          {Math.round(zoom * 100)} %
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-44" align="end">
          <DropdownMenuItem onClick={() => useEditor.getState().set({ fit: true })}>
            <Maximize /> Ajustar a la ventana
          </DropdownMenuItem>
          {[0.5, 0.75, 1, 1.5, 2].map((value) => (
            <DropdownMenuItem key={value} onClick={() => setZoom(value)}>
              {value * 100} %
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <IconButton label="Acercar" shortcut={`${mod}+`} size="icon-sm" onClick={() => zoomBy(1.25)}>
        <Plus />
      </IconButton>
    </div>
  )
}

function CandidateBar({ doc }: { doc: ScheduleDocument }) {
  const candidate = useEditor((state) => state.candidate)
  if (!candidate) return null
  const subject = doc.subjects.find((item) => item.id === candidate.subjectId) ?? candidate.foreignSubject
  const verb = candidate.source === "paste" ? "Pegar" : candidate.source === "duplicate" ? "Duplicar" : "Colocar"
  return (
    <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-lg" role="region" aria-label="Ubicar bloque">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        {subject ? <Swatch color={subject.color} /> : null}
        <span className="min-w-0 truncate">
          <span className="font-medium">
            {verb} {subject?.name}
          </span>{" "}
          <span className="text-muted-foreground">· {describeInterval(candidate.interval)}</span>
        </span>
      </div>
      <div className="flex items-center gap-0.5" role="group" aria-label="Mover la ubicación">
        <IconButton label="30 minutos antes" size="icon-sm" onClick={() => moveCandidate({ minutes: -STEP })}>
          <ArrowUp />
        </IconButton>
        <IconButton label="30 minutos después" size="icon-sm" onClick={() => moveCandidate({ minutes: STEP })}>
          <ArrowDown />
        </IconButton>
        <IconButton label="Día anterior" size="icon-sm" onClick={() => moveCandidate({ day: -1 })}>
          <ArrowLeft />
        </IconButton>
        <IconButton label="Día siguiente" size="icon-sm" onClick={() => moveCandidate({ day: 1 })}>
          <ArrowRight />
        </IconButton>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" onClick={confirmCandidate}>
          <Check /> {verb} aquí
        </Button>
        <Button size="sm" variant="ghost" onClick={cancelCandidate}>
          <X /> Cancelar
        </Button>
      </div>
    </div>
  )
}

function CanvasHint({ doc }: { doc: ScheduleDocument }) {
  const tool = useEditor((state) => state.tool)
  const candidate = useEditor((state) => state.candidate)
  if (candidate) return null
  if (!doc.subjects.length) {
    return (
      <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg">
        <span>Empezá creando tus materias.</span>
        <Button size="sm" onClick={() => useEditor.getState().openDialog("subject")}>
          <Plus /> Nueva materia
        </Button>
      </div>
    )
  }
  if (!doc.blocks.length) {
    return (
      <div className="pointer-events-none rounded-xl border border-border bg-popover px-4 py-2.5 text-sm text-popover-foreground shadow-lg">
        {tool === "place" ? "Hacé clic en la grilla para ubicar la clase, o arrastrá para marcar su duración." : "Elegí una materia en el panel y hacé clic en la grilla."}
      </div>
    )
  }
  return null
}

export function Workspace({ doc, compact = false }: { doc: ScheduleDocument; compact?: boolean }) {
  const engine = useEngineReady()
  const { rendered, pending } = useStableRendering(doc)
  const fit = useEditor((state) => state.fit)
  const zoomValue = useEditor((state) => state.zoom)
  const [viewportRef, size] = useElementSize<HTMLDivElement>()
  const helpId = useId()
  const padding = compact ? 16 : 40
  const fitZoom = rendered ? Math.max(0.1, Math.min((size.width - padding * 2) / rendered.scene.width, (size.height - padding * 2) / rendered.scene.height)) : 1
  const zoom = fit ? fitZoom : zoomValue
  const fontsVersion = useFontsVersion()
  const fontsState = ensureFonts(doc.appearance, fontsVersion)

  useEffect(() => {
    if (fit && size.width > 0 && Math.abs(zoomValue - fitZoom) > 0.001) useEditor.getState().set({ zoom: Math.round(fitZoom * 1000) / 1000 })
  }, [fit, fitZoom, zoomValue, size.width])

  // Ctrl/Cmd + wheel (and trackpad pinch) zooms the canvas instead of the page.
  useEffect(() => {
    const element = viewportRef.current
    if (!element) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      zoomBy(event.deltaY < 0 ? 1.1 : 1 / 1.1)
    }
    element.addEventListener("wheel", onWheel, { passive: false })
    return () => element.removeEventListener("wheel", onWheel)
  }, [viewportRef])

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Documento">
      <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-2">
        <ToolSwitch doc={doc} />
        <div className="flex min-w-0 items-center gap-1.5">
          {pending && engine === "ready" && fontsState.state === "loading" ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              <span className="max-sm:sr-only">Cargando fuentes</span>
            </span>
          ) : null}
          {fontsState.state === "failed" ? (
            <Button size="xs" variant="outline" onClick={() => fontsState.refs.forEach((ref) => retryFont(ref))}>
              <RefreshCw /> Reintentar fuentes
            </Button>
          ) : null}
          {rendered ? <IssuesButton rendered={rendered} /> : null}
          <ZoomControls zoom={zoom} />
        </div>
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={viewportRef} className="canvas-viewport absolute inset-0 overflow-auto" tabIndex={-1}>
          {rendered ? (
            <div className="grid min-h-full min-w-full place-items-center" style={{ padding, width: "max-content", minWidth: "100%" }}>
              <DocumentCanvas doc={doc} rendered={rendered} zoom={zoom} describedBy={helpId} />
            </div>
          ) : engine === "error" ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div className="max-w-sm">
                <p className="font-medium">No se pudo iniciar el motor de dibujo</p>
                <p className="mt-1 text-sm text-muted-foreground">Revisá tu conexión y volvé a intentar. Tu proyecto está a salvo.</p>
                <Button className="mt-3" onClick={retryEngine}>
                  <RefreshCw /> Reintentar
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground" role="status">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparando el documento…
              </span>
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
          <div className="flex max-w-full flex-col items-center gap-2">
            <CandidateBar doc={doc} />
            <CanvasHint doc={doc} />
          </div>
        </div>
      </div>
      <p id={helpId} className="sr-only">
        Cada clase es un botón: Tab para recorrerlas, flechas para moverla 30 minutos o de día, Mayúsculas con flechas para cambiar la hora de fin, Alt con flechas para la de inicio, Suprimir para eliminarla. Para crear una clase con el teclado usá Agregar bloque con formulario.
      </p>
    </section>
  )
}
