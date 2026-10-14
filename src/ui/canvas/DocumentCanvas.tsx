import { useEffect, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react"
import { MIN_DURATION, STEP } from "@/domain/constants"
import { clamp, formatRange, snapDown } from "@/domain/time"
import type { Block, DayId, ScheduleDocument } from "@/domain/types"
import type { Rendered } from "@/engine/render"
import { dayAt, minuteToY, yToMinute, type Scene } from "@/engine/scene"
import { cn } from "@/lib/utils"
import { adjustEdge, describeBlock, fitInterval, moveCandidate, placeBlock, setBlockInterval } from "@/state/actions"
import { durationFor, useEditor, type Interval } from "@/state/editor"
import { setActiveGesture } from "./gesture"

type Gesture = {
  pointerId: number
  pointerType: string
  kind: "create" | "tap" | "move" | "resize-start" | "resize-end" | "background"
  clientX: number
  clientY: number
  downMinute: number
  downDay: DayId | null
  subjectId: string
  block?: Block
  moved: boolean
}

const THRESHOLD = 4


function columnOf(scene: Scene, day: DayId) {
  return scene.grid.columns.find((column) => column.day === day)
}

/** Screen rectangle of an interval spanning its whole day column. */
function intervalRect(scene: Scene, interval: Interval, z: number) {
  const column = columnOf(scene, interval.day)
  if (!column) return null
  const top = minuteToY(scene.grid, interval.start)
  const bottom = minuteToY(scene.grid, interval.end)
  return { left: column.x * z, top: top * z, width: column.w * z, height: Math.max(2, (bottom - top) * z) }
}

function Ghost({ rect, color, label, detail, tone }: { rect: { left: number; top: number; width: number; height: number }; color: string; label: string; detail?: string; tone: "hover" | "draft" | "candidate" }) {
  const short = rect.height < 34
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute rounded-md border-2", tone === "hover" ? "border-dashed" : "border-solid", tone === "candidate" && "animate-pulse")}
      style={{
        ...rect,
        borderColor: color,
        background: `color-mix(in srgb, ${color} ${tone === "hover" ? 28 : 42}%, transparent)`,
      }}
    >
      <div
        className={cn("absolute left-1 flex max-w-[calc(100%-0.5rem)] min-w-0 flex-col rounded bg-[var(--popover)] px-1.5 py-0.5 text-[11px] leading-tight text-popover-foreground shadow-sm ring-1 ring-border", short ? "-top-1 -translate-y-full" : "top-1")}
      >
        <span className="truncate font-semibold tabular-nums">{label}</span>
        {detail ? <span className="truncate text-muted-foreground">{detail}</span> : null}
      </div>
    </div>
  )
}

export function DocumentCanvas({ doc, rendered, zoom, describedBy }: { doc: ScheduleDocument; rendered: Rendered; zoom: number; describedBy?: string }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const tool = useEditor((state) => state.tool)
  const armedSubjectId = useEditor((state) => state.armedSubjectId)
  const selectedBlockId = useEditor((state) => state.selectedBlockId)
  const hover = useEditor((state) => state.hover)
  const draft = useEditor((state) => state.draft)
  const candidate = useEditor((state) => state.candidate)
  const { scene, svg } = rendered
  const z = zoom
  const grid = scene.grid
  const placing = tool === "place" && !!armedSubjectId && doc.subjects.some((subject) => subject.id === armedSubjectId)
  const subjectOf = (id: string) => doc.subjects.find((subject) => subject.id === id) ?? (candidate?.foreignSubject?.id === id ? candidate.foreignSubject : undefined)

  // Keyboard focus follows the selection after deletes and neighbor moves, but never steals it from fields elsewhere.
  useEffect(() => {
    if (!selectedBlockId) return
    const active = document.activeElement
    if (active && active !== document.body && !stageRef.current?.contains(active)) return
    const button = stageRef.current?.querySelector<HTMLElement>(`[data-block-id="${selectedBlockId}"]`)
    if (button && button !== active) button.focus({ preventScroll: true })
  }, [selectedBlockId])

  useEffect(() => () => setActiveGesture(null), [])

  const toDoc = (event: { clientX: number; clientY: number }) => {
    const rect = stageRef.current!.getBoundingClientRect()
    return { x: (event.clientX - rect.left) / z, y: (event.clientY - rect.top) / z }
  }

  const pointAt = (event: { clientX: number; clientY: number }) => {
    const point = toDoc(event)
    const day = dayAt(grid, point.x)
    const minute = yToMinute(grid, point.y)
    const inside = !!day && minute >= grid.rangeStart && minute < grid.rangeEnd && point.y >= grid.bodyY
    return { ...point, day, minute, inside }
  }

  const finish = () => {
    const current = gesture.current
    gesture.current = null
    setActiveGesture(null)
    if (current && stageRef.current?.hasPointerCapture(current.pointerId)) stageRef.current.releasePointerCapture(current.pointerId)
    useEditor.getState().set({ draft: null })
  }

  const begin = (event: ReactPointerEvent, next: Omit<Gesture, "pointerId" | "pointerType" | "clientX" | "clientY" | "moved">) => {
    gesture.current = { ...next, pointerId: event.pointerId, pointerType: event.pointerType, clientX: event.clientX, clientY: event.clientY, moved: false }
    setActiveGesture(finish)
    if (next.kind !== "tap" && next.kind !== "background") {
      try {
        stageRef.current?.setPointerCapture(event.pointerId)
      } catch {
        // The pointer may already be gone (e.g. a synthetic or cancelled pointer); the gesture still works without capture.
      }
    }
  }

  const createInterval = (g: Gesture, minute: number): Interval => {
    const day = g.downDay!
    const anchor = clamp(snapDown(g.downMinute), grid.rangeStart, grid.rangeEnd - STEP)
    if (!g.moved) {
      const duration = durationFor(g.subjectId)
      return fitInterval(doc, { day, start: anchor, end: anchor + duration })
    }
    const current = clamp(snapDown(minute), grid.rangeStart, grid.rangeEnd - STEP)
    return { day, start: Math.min(anchor, current), end: Math.max(anchor, current) + STEP }
  }

  const editInterval = (g: Gesture, minute: number, day: DayId | null): Interval => {
    const block = g.block!
    const delta = Math.round((minute - g.downMinute) / STEP) * STEP
    if (g.kind === "move") {
      const duration = block.end - block.start
      const start = clamp(block.start + delta, grid.rangeStart, grid.rangeEnd - duration)
      return { day: day ?? block.day, start, end: start + duration }
    }
    if (g.kind === "resize-start") return { day: block.day, start: clamp(block.start + delta, grid.rangeStart, block.end - MIN_DURATION), end: block.end }
    return { day: block.day, start: block.start, end: clamp(block.end + delta, block.start + MIN_DURATION, grid.rangeEnd) }
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || gesture.current) return
    const point = pointAt(event)
    const editor = useEditor.getState()
    if (editor.candidate) {
      if (point.inside) {
        const duration = editor.candidate.interval.end - editor.candidate.interval.start
        const start = snapDown(point.minute)
        moveCandidate({ to: { day: point.day!, start, end: start + duration } })
      }
      return
    }
    if (placing) {
      if (!point.inside) return
      begin(event, { kind: event.pointerType === "touch" ? "tap" : "create", downMinute: point.minute, downDay: point.day, subjectId: armedSubjectId! })
      if (event.pointerType !== "touch") {
        event.preventDefault()
        useEditor.getState().set({ hover: null, draft: { kind: "create", subjectId: armedSubjectId!, interval: createInterval(gesture.current!, point.minute) } })
      }
      return
    }
    begin(event, { kind: "background", downMinute: point.minute, downDay: point.day, subjectId: "" })
  }

  const onBlockPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, block: Block) => {
    if (event.button !== 0 || gesture.current || placing || useEditor.getState().candidate) return
    event.stopPropagation()
    const wasSelected = useEditor.getState().selectedBlockId === block.id
    useEditor.getState().select(block.id)
    // On touch, a block only moves once it is selected, so a swipe over the schedule still scrolls.
    if (event.pointerType === "touch" && !wasSelected) return
    const point = pointAt(event)
    begin(event, { kind: "move", downMinute: point.minute, downDay: point.day, subjectId: block.subjectId, block })
  }

  const onHandlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, block: Block, edge: "start" | "end") => {
    if (event.button !== 0 || gesture.current) return
    event.stopPropagation()
    event.preventDefault()
    const point = pointAt(event)
    begin(event, { kind: edge === "start" ? "resize-start" : "resize-end", downMinute: point.minute, downDay: point.day, subjectId: block.subjectId, block })
    useEditor.getState().set({ draft: { kind: edge === "start" ? "resize-start" : "resize-end", blockId: block.id, subjectId: block.subjectId, interval: { day: block.day, start: block.start, end: block.end } } })
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    const editor = useEditor.getState()
    if (!g) {
      if (event.pointerType === "touch" || !placing || editor.candidate) {
        if (editor.hover) editor.set({ hover: null })
        return
      }
      const point = pointAt(event)
      if (!point.inside) {
        if (editor.hover) editor.set({ hover: null })
        return
      }
      const duration = durationFor(armedSubjectId!)
      const start = clamp(snapDown(point.minute), grid.rangeStart, grid.rangeEnd - STEP)
      const next = fitInterval(doc, { day: point.day!, start, end: start + duration })
      if (!editor.hover || editor.hover.day !== next.day || editor.hover.start !== next.start || editor.hover.end !== next.end) editor.set({ hover: next })
      return
    }
    if (event.pointerId !== g.pointerId) return
    if (!g.moved && Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) >= THRESHOLD) g.moved = true
    if (g.kind === "tap" || g.kind === "background") return
    if (!g.moved && g.kind === "move") return
    const point = pointAt(event)
    const interval = g.kind === "create" ? createInterval(g, point.minute) : editInterval(g, point.minute, point.day)
    const current = editor.draft
    if (current && current.interval.day === interval.day && current.interval.start === interval.start && current.interval.end === interval.end) return
    editor.set({ draft: { kind: g.kind, blockId: g.block?.id, subjectId: g.subjectId, interval } })
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const g = gesture.current
    if (!g || event.pointerId !== g.pointerId) return
    const draftInterval = useEditor.getState().draft?.interval
    finish()
    if (g.kind === "background") {
      if (!g.moved) useEditor.getState().select(null)
      return
    }
    if (g.kind === "tap") {
      if (g.moved || !g.downDay) return
      const duration = durationFor(g.subjectId)
      const start = clamp(snapDown(g.downMinute), grid.rangeStart, grid.rangeEnd - STEP)
      useEditor.getState().set({
        candidate: { source: "tap", subjectId: g.subjectId, room: "", kind: "", notes: "", interval: fitInterval(doc, { day: g.downDay, start, end: start + duration }) },
      })
      return
    }
    if (g.kind === "create") {
      const point = pointAt(event)
      placeBlock(g.subjectId, createInterval(g, point.minute), {}, { remember: g.moved })
      return
    }
    if (!g.moved || !draftInterval || !g.block) return
    if (g.kind === "move") setBlockInterval(g.block.id, draftInterval, "Mover")
    else if (setBlockInterval(g.block.id, draftInterval, "Cambiar duración de")) {
      useEditor.getState().rememberDuration(g.block.subjectId, draftInterval.end - draftInterval.start)
    }
  }

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, block: Block, edge: "start" | "end") => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
    event.preventDefault()
    event.stopPropagation()
    adjustEdge(block.id, edge, event.key === "ArrowUp" ? -STEP : STEP)
  }

  const width = scene.width * z
  const height = scene.height * z
  const selectedBox = scene.blocks.find((box) => box.blockId === selectedBlockId)
  const selected = doc.blocks.find((block) => block.id === selectedBlockId)
  const draftRect = draft ? intervalRect(scene, draft.interval, z) : null
  const draftSubject = draft ? subjectOf(draft.subjectId) : undefined
  const hiddenBox = draft?.blockId ? scene.blocks.find((box) => box.blockId === draft.blockId) : undefined
  const hoverRect = hover && placing && !draft ? intervalRect(scene, hover, z) : null
  const armed = armedSubjectId ? subjectOf(armedSubjectId) : undefined
  const candidateRect = candidate ? intervalRect(scene, candidate.interval, z) : null
  const candidateSubject = candidate ? subjectOf(candidate.subjectId) : undefined
  const handleSize = 22
  const blockOrder = [...scene.blocks].sort((a, b) => {
    const blockA = doc.blocks.find((block) => block.id === a.blockId)!
    const blockB = doc.blocks.find((block) => block.id === b.blockId)!
    return doc.settings.days.indexOf(blockA.day) - doc.settings.days.indexOf(blockB.day) || blockA.start - blockB.start || a.lane - b.lane
  })

  return (
    <div
      ref={stageRef}
      role="group"
      aria-label="Lienzo del horario"
      aria-describedby={describedBy}
      className={cn("relative shrink-0 select-none", placing || candidate ? "cursor-crosshair" : "cursor-default")}
      style={{ width, height, touchAction: placing || candidate ? "manipulation" : "auto", boxShadow: "var(--shadow-doc)" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => gesture.current && finish()}
      onLostPointerCapture={(event) => {
        if (gesture.current?.pointerId === event.pointerId && gesture.current.kind !== "tap" && gesture.current.kind !== "background") finish()
      }}
      onPointerLeave={() => {
        if (!gesture.current && useEditor.getState().hover) useEditor.getState().set({ hover: null })
      }}
    >
      <div className="doc-layer absolute inset-0" aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />

      {hiddenBox && draft?.kind !== "create" ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{ left: hiddenBox.x * z, top: hiddenBox.y * z, width: hiddenBox.w * z, height: hiddenBox.h * z, background: `color-mix(in srgb, ${doc.appearance.page.background} 62%, transparent)` }}
        />
      ) : null}

      {blockOrder.map((box) => {
        const block = doc.blocks.find((item) => item.id === box.blockId)!
        const isSelected = box.blockId === selectedBlockId
        const style: CSSProperties = { left: box.x * z, top: box.y * z, width: box.w * z, height: box.h * z, touchAction: isSelected ? "none" : undefined }
        return (
          <button
            key={box.blockId}
            type="button"
            data-block-id={box.blockId}
            aria-label={describeBlock(doc, block) + (box.conflict ? ", se superpone con otra clase" : "")}
            aria-pressed={isSelected}
            tabIndex={isSelected || (!selectedBlockId && box === blockOrder[0]) ? 0 : -1}
            className={cn(
              "absolute rounded-[3px] outline-none transition-[box-shadow] duration-100",
              placing || candidate ? "pointer-events-none" : "cursor-grab active:cursor-grabbing",
              isSelected ? "shadow-[0_0_0_2px_var(--primary)]" : "hover:shadow-[0_0_0_1.5px_color-mix(in_srgb,var(--primary)_70%,transparent)] focus-visible:shadow-[0_0_0_2px_var(--ring)]",
            )}
            style={style}
            onPointerDown={(event) => onBlockPointerDown(event, block)}
            onFocus={() => {
              if (useEditor.getState().selectedBlockId !== block.id) useEditor.getState().select(block.id)
            }}
          />
        )
      })}

      {selectedBox && selected && !placing && !candidate
        ? (["start", "end"] as const).map((edge) => {
            const y = (edge === "start" ? selectedBox.y : selectedBox.y + selectedBox.h) * z
            return (
              <button
                key={edge}
                type="button"
                aria-label={edge === "start" ? "Cambiar hora de inicio" : "Cambiar hora de fin"}
                aria-description="Flechas arriba y abajo para mover este borde 30 minutos"
                className="group absolute z-10 flex cursor-ns-resize items-center justify-center outline-none"
                style={{ left: (selectedBox.x + selectedBox.w / 2) * z - handleSize, top: y - handleSize / 2, width: handleSize * 2, height: handleSize, touchAction: "none" }}
                onPointerDown={(event) => onHandlePointerDown(event, selected, edge)}
                onKeyDown={(event) => onHandleKeyDown(event, selected, edge)}
              >
                <span className="h-2 w-7 rounded-full border-2 border-primary bg-background shadow-sm transition-transform group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-ring" />
              </button>
            )
          })
        : null}

      {hoverRect && armed ? <Ghost rect={hoverRect} color={armed.color} label={armed.name} detail={formatRange(hover!.start, hover!.end)} tone="hover" /> : null}
      {draftRect && draftSubject ? (
        <Ghost rect={draftRect} color={draftSubject.color} label={formatRange(draft!.interval.start, draft!.interval.end)} detail={draft!.kind === "create" ? draftSubject.name : undefined} tone="draft" />
      ) : null}
      {candidateRect && candidateSubject ? (
        <Ghost rect={candidateRect} color={candidateSubject.color} label={candidateSubject.name} detail={formatRange(candidate!.interval.start, candidate!.interval.end)} tone="candidate" />
      ) : null}
    </div>
  )
}
