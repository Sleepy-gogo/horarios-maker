import { useEffect, useId, useRef, useState, type ReactElement } from "react"
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronDown, Library, Loader2, Maximize, Minus, MousePointer2, Plus, RefreshCw, SlidersHorizontal, SquarePlus, Undo2, X } from "lucide-react"
import { FloatingButtonGroup, type FloatingButtonGroupItem } from "@/components/arc/floating-button-group/floating-button-group"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/arc/popover/popover"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { STEP } from "@/domain/constants"
import type { ScheduleDocument } from "@/domain/types"
import { retryFont } from "@/fonts/service"
import { retryEngine, useEngineReady } from "@/hooks/use-engine"
import { useFontsVersion } from "@/hooks/use-fonts-version"
import { useLayoutTier, type LayoutTier } from "@/hooks/use-media"
import { useRendered } from "@/hooks/use-rendered"
import { ensureFonts, type Rendered } from "@/engine/render"
import { cn } from "@/lib/utils"
import { cancelCandidate, confirmCandidate, describeInterval, moveCandidate } from "@/state/actions"
import { useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
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

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text)

/**
 * The canvas tools, floating over the bottom of the canvas, near the hand and out of the document's way.
 * It adapts to the device instead of only shrinking: desktops get tools and zoom; tablets add the properties sheet;
 * phones trade zoom (pinch does that) for the panels and undo, with larger targets.
 */
function CanvasToolbar({ doc, zoom, tier, width }: { doc: ScheduleDocument; zoom: number; tier: LayoutTier; width: number }) {
  const tool = useEditor((state) => state.tool)
  const armedSubjectId = useEditor((state) => state.armedSubjectId)
  const selectedBlockId = useEditor((state) => state.selectedBlockId)
  const focusedSubjectId = useEditor((state) => state.focusedSubjectId)
  const canUndo = useStudio((state) => !!state.session?.past.length)
  const undoLabel = useStudio((state) => state.session?.past.at(-1)?.label)
  const armed = doc.subjects.find((subject) => subject.id === armedSubjectId) ?? doc.subjects[0]
  const editor = useEditor.getState()
  const phone = tier === "phone"
  // Labels come and go with the room the canvas has, not only with the device: a tablet with the library open is as narrow as a phone.
  const subjectLabel = !phone && width >= 520
  const panelLabel = width >= 680
  const empty = !doc.subjects.length
  const percent = `${Math.round(zoom * 100)} %`
  const context = selectedBlockId ? "Editar clase" : focusedSubjectId ? "Editar materia" : "Propiedades"
  const sheet = (id: "library" | "inspector") => () => editor.set({ mobileSheet: id })

  const subjectMenu = (button: ReactElement) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={button} disabled={empty} />
      <DropdownMenuContent side="top" align="center" sideOffset={10} className="max-h-80 w-auto min-w-56 pointer-coarse:[&_[role=menuitem]]:min-h-11">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Materia a colocar</DropdownMenuLabel>
          {doc.subjects.map((subject) => (
            <DropdownMenuItem key={subject.id} onClick={() => editor.arm(subject.id)}>
              <Swatch color={subject.color} />
              <span className="max-w-60 truncate">{subject.name}</span>
              {subject.id === armedSubjectId ? <Check className="ml-auto" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => editor.openDialog("subject")}>
          <Plus /> Nueva materia…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const zoomMenu = (button: ReactElement) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={button} />
      <DropdownMenuContent side="top" align="center" sideOffset={10} className="w-auto min-w-44 pointer-coarse:[&_[role=menuitem]]:min-h-11">
        <DropdownMenuItem onClick={() => editor.set({ fit: true })}>
          <Maximize /> Ajustar a la ventana
        </DropdownMenuItem>
        {[0.5, 0.75, 1, 1.5, 2].map((value) => (
          <DropdownMenuItem key={value} onClick={() => setZoom(value)}>
            {value * 100} %
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const tools: FloatingButtonGroupItem[] = [
    { id: "select", label: "Seleccionar y mover", icon: <MousePointer2 />, iconOnly: true, shortcut: phone ? undefined : "V", pressed: tool === "select", onSelect: () => editor.set({ tool: "select", hover: null }) },
    { id: "place", label: "Colocar en la grilla", icon: <SquarePlus />, iconOnly: true, shortcut: phone ? undefined : "B", pressed: tool === "place", disabled: empty, onSelect: () => editor.arm(armed?.id ?? null) },
    {
      id: "subject",
      label: armed ? shorten(armed.name, 22) : "Materia",
      ariaLabel: armed ? `Materia a colocar: ${armed.name}. Cambiar` : "Elegir materia a colocar",
      icon: armed ? <Swatch color={armed.color} className="size-3.5 rounded-[4px]" /> : undefined,
      iconOnly: !subjectLabel,
      trailing: <ChevronDown />,
      disabled: empty,
      wrap: subjectMenu,
    },
  ]
  const zoomItems: FloatingButtonGroupItem[] = [
    { type: "separator", id: "zoom-separator" },
    { id: "zoom-out", label: "Alejar", icon: <Minus />, iconOnly: true, shortcut: `${mod}−`, onSelect: () => zoomBy(0.8) },
    { id: "zoom", label: percent, ariaLabel: `Zoom ${percent}. Cambiar`, reserveLabels: ["100 %"], wrap: zoomMenu },
    { id: "zoom-in", label: "Acercar", icon: <Plus />, iconOnly: true, shortcut: `${mod}+`, onSelect: () => zoomBy(1.25) },
  ]
  const items: FloatingButtonGroupItem[] =
    tier === "desktop"
      ? [...tools, ...zoomItems]
      : tier === "tablet"
        ? [...tools, ...zoomItems, { type: "separator", id: "panel-separator" }, { id: "inspector", label: context, icon: <SlidersHorizontal />, iconOnly: !panelLabel, reserveLabels: ["Propiedades", "Editar materia"], onSelect: sheet("inspector") }]
        : [
            { id: "library", label: "Materias y clases", icon: <Library />, iconOnly: true, onSelect: sheet("library") },
            { type: "separator", id: "tools-separator" },
            ...tools,
            { type: "separator", id: "panel-separator" },
            { id: "undo", label: undoLabel ? `Deshacer: ${undoLabel}` : "Deshacer", icon: <Undo2 />, iconOnly: true, disabled: !canUndo, onSelect: () => useStudio.getState().undo() },
            { id: "inspector", label: context, icon: <SlidersHorizontal />, iconOnly: true, onSelect: sheet("inspector") },
          ]

  return <FloatingButtonGroup items={items} label="Herramientas del lienzo" variant="floating" className={cn("canvas-toolbar pointer-events-auto", phone && "canvas-toolbar-touch")} />
}

function IssuesButton({ rendered }: { rendered: Rendered }) {
  const issues = rendered.scene.issues
  if (!issues.length) return null
  const errors = issues.filter((issue) => issue.level === "error").length
  return (
    <Popover>
      <PopoverTrigger className={cn("canvas-chip outline-none focus-visible:ring-2 focus-visible:ring-ring", errors ? "text-destructive" : "text-warning")}>
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

function CandidateBar({ doc }: { doc: ScheduleDocument }) {
  const candidate = useEditor((state) => state.candidate)
  if (!candidate) return null
  const subject = doc.subjects.find((item) => item.id === candidate.subjectId) ?? candidate.foreignSubject
  const verb = candidate.source === "paste" ? "Pegar" : candidate.source === "duplicate" ? "Duplicar" : "Colocar"
  return (
    <div className="canvas-float pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-2 rounded-xl px-3 py-2" role="region" aria-label="Ubicar bloque">
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
      <div className="canvas-float pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl py-2 pr-2 pl-4 text-sm">
        <span>Empezá creando tus materias.</span>
        <Button size="sm" onClick={() => useEditor.getState().openDialog("subject")}>
          <Plus /> Nueva materia
        </Button>
      </div>
    )
  }
  if (!doc.blocks.length) {
    return (
      <div className="canvas-float pointer-events-none rounded-xl px-4 py-2.5 text-sm">
        {tool === "place" ? "Tocá la grilla para ubicar la clase, o arrastrá para marcar su duración." : "Elegí una materia y tocá la grilla para ubicar su clase."}
      </div>
    )
  }
  return null
}

export function Workspace({ doc }: { doc: ScheduleDocument }) {
  const tier = useLayoutTier()
  const engine = useEngineReady()
  const { rendered, pending } = useStableRendering(doc)
  const fit = useEditor((state) => state.fit)
  const zoomValue = useEditor((state) => state.zoom)
  const [viewportRef, size] = useElementSize<HTMLDivElement>()
  const helpId = useId()
  const phone = tier === "phone"
  const padding = phone ? 16 : 40
  // Room under the page for the floating toolbar, so a fitted page never sits behind it.
  const dock = phone ? 64 : 48
  const fitZoom = rendered ? Math.max(0.1, Math.min((size.width - padding * 2) / rendered.scene.width, (size.height - padding * 2 - dock) / rendered.scene.height)) : 1
  const zoom = fit ? fitZoom : zoomValue
  const fontsVersion = useFontsVersion()
  const fontsState = ensureFonts(doc.appearance, fontsVersion)
  const loadingFonts = pending && engine === "ready" && fontsState.state === "loading"
  const issues = rendered?.scene.issues.length ?? 0

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
    <section className="relative min-h-0 min-w-0 flex-1" aria-label="Documento">
      <div ref={viewportRef} className="canvas-viewport absolute inset-0 overflow-auto" tabIndex={-1}>
        {rendered ? (
          <div className="grid min-h-full min-w-full place-items-center" style={{ padding: `${padding}px ${padding}px ${padding + dock}px`, width: "max-content", minWidth: "100%" }}>
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
      {loadingFonts || fontsState.state === "failed" || issues ? (
        <div className="absolute top-3 right-3 flex items-center gap-2">
          {loadingFonts ? (
            <span className="canvas-chip text-muted-foreground" role="status">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Cargando fuentes
            </span>
          ) : null}
          {fontsState.state === "failed" ? (
            <button type="button" className="canvas-chip outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => fontsState.refs.forEach((ref) => retryFont(ref))}>
              <RefreshCw className="size-3.5" aria-hidden="true" /> Reintentar fuentes
            </button>
          ) : null}
          {rendered ? <IssuesButton rendered={rendered} /> : null}
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex max-w-full flex-col items-center gap-2">
          <CandidateBar doc={doc} />
          <CanvasHint doc={doc} />
          <CanvasToolbar doc={doc} zoom={zoom} tier={tier} width={size.width} />
        </div>
      </div>
      <p id={helpId} className="sr-only">
        Cada clase es un botón: Tab para recorrerlas, flechas para moverla 30 minutos o de día, Mayúsculas con flechas para cambiar la hora de fin, Alt con flechas para la de inicio, Suprimir para eliminarla. Para crear una clase con el teclado usá Agregar bloque con formulario.
      </p>
    </section>
  )
}
