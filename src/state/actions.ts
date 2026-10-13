import { toast } from "sonner"
import { DAYS, MIN_DURATION, STEP, dayLabel } from "@/domain/constants"
import {
  addBlocks, addSubject, conflictsOf, createId, deleteBlocks, deleteSubject, expandRange, findDuplicate, makeSubject,
  mergeSubjects, sortedBlocks, updateBlock, updateSubject,
} from "@/domain/document"
import { formatMinutes, snapDown } from "@/domain/time"
import type { Block, DayId, ScheduleDocument, Subject } from "@/domain/types"
import { useEditor, type Candidate, type ClipboardPayload, type Interval } from "./editor"
import { announce } from "./notices"
import { commit, currentDoc, useStudio } from "./studio"

export function describeInterval(interval: Interval) {
  return `${dayLabel(interval.day).toLocaleLowerCase("es")} de ${formatMinutes(interval.start)} a ${formatMinutes(interval.end)}`
}

export function describeBlock(doc: ScheduleDocument, block: Block) {
  const subject = doc.subjects.find((item) => item.id === block.subjectId)
  const parts = [`${subject?.name ?? "Bloque"}, ${describeInterval(block)}`]
  if (block.room) parts.push(`aula ${block.room}`)
  if (block.kind) parts.push(block.kind)
  return parts.join(", ")
}

export function subjectName(doc: ScheduleDocument, id: string) {
  return doc.subjects.find((subject) => subject.id === id)?.name ?? "Materia"
}

/** Checks that an interval fits the visible days and range; returns a reason otherwise. */
export function intervalProblem(doc: ScheduleDocument, interval: Interval) {
  const { range, days } = doc.settings
  if (!days.includes(interval.day)) return `${dayLabel(interval.day)} no está entre los días del horario.`
  if (interval.start >= interval.end) return "El inicio debe ser anterior al fin."
  if (interval.start < range.start || interval.end > range.end) {
    return `Queda fuera del rango ${formatMinutes(range.start)}–${formatMinutes(range.end)}.`
  }
  return null
}

// Subjects

export function createSubject(name: string, color?: string, textColor?: string, options: { arm?: boolean } = { arm: true }) {
  const doc = currentDoc()
  if (!doc) return null
  const subject = makeSubject(doc, name, color, textColor)
  commit(`Crear materia ${subject.name}`, (current) => addSubject(current, subject), { announce: `Materia ${subject.name} creada` })
  if (options.arm) useEditor.getState().arm(subject.id)
  return subject
}

export function editSubject(id: string, patch: Partial<Omit<Subject, "id">>, coalesce?: string) {
  const doc = currentDoc()
  const subject = doc?.subjects.find((item) => item.id === id)
  if (!doc || !subject) return
  const next = { ...subject, ...patch, name: (patch.name ?? subject.name).trim().replace(/\s+/g, " ") }
  if (next.name === subject.name && next.color === subject.color && next.textColor === subject.textColor) return
  const label = next.name !== subject.name ? `Renombrar ${subject.name}` : `Cambiar colores de ${subject.name}`
  commit(label, (current) => updateSubject(current, id, next), coalesce ? { coalesce } : { announce: `${next.name} actualizada en todos sus bloques` })
}

export function removeSubject(id: string) {
  const doc = currentDoc()
  const subject = doc?.subjects.find((item) => item.id === id)
  if (!doc || !subject) return
  const count = doc.blocks.filter((block) => block.subjectId === id).length
  commit(`Eliminar ${subject.name}`, (current) => deleteSubject(current, id))
  const editor = useEditor.getState()
  if (editor.armedSubjectId === id) editor.set({ armedSubjectId: null, tool: "select", hover: null })
  if (editor.focusedSubjectId === id) editor.set({ focusedSubjectId: null })
  if (editor.selectedBlockId && !currentDoc()?.blocks.some((block) => block.id === editor.selectedBlockId)) editor.select(null)
  toast(count ? `Se eliminó ${subject.name} y ${count === 1 ? "su bloque" : `sus ${count} bloques`}` : `Se eliminó ${subject.name}`, {
    action: { label: "Deshacer", onClick: () => useStudio.getState().undo() },
  })
}

export function unifySubjects(fromId: string, intoId: string) {
  const doc = currentDoc()
  if (!doc) return
  const from = subjectName(doc, fromId)
  const into = subjectName(doc, intoId)
  commit(`Unificar ${from} en ${into}`, (current) => mergeSubjects(current, fromId, intoId), { announce: `${from} unificada en ${into}` })
  const editor = useEditor.getState()
  if (editor.armedSubjectId === fromId) editor.set({ armedSubjectId: intoId })
  if (editor.focusedSubjectId === fromId) editor.set({ focusedSubjectId: intoId })
}

// Blocks

type BlockFields = { room?: string; kind?: string; notes?: string }

/** Inserts a block as one operation, refusing an exact duplicate and keeping the subject's session duration. */
export function placeBlock(subjectId: string, interval: Interval, fields: BlockFields = {}, options: { expandRange?: boolean; remember?: boolean } = {}) {
  const doc = currentDoc()
  if (!doc) return null
  const block: Block = { id: createId("blk"), subjectId, ...interval, room: fields.room ?? "", kind: fields.kind ?? "", notes: fields.notes ?? "" }
  const duplicate = findDuplicate(doc, block)
  if (duplicate) {
    toast.warning("Este bloque ya existe", { description: "Elegí otra posición o cambiá sus datos." })
    useEditor.getState().select(duplicate.id)
    return null
  }
  if (!options.expandRange) {
    const problem = intervalProblem(doc, interval)
    if (problem) {
      toast.warning("No se puede ubicar ahí", { description: problem })
      return null
    }
  }
  const name = subjectName(doc, subjectId)
  commit(
    `Agregar bloque de ${name}`,
    (current) => {
      let next = addBlocks(current, [block])
      if (options.expandRange) next = { ...next, settings: { ...next.settings, range: expandRange(next.settings.range, [block]) } }
      return next
    },
    { announce: `${name} agregada el ${describeInterval(interval)}` },
  )
  if (options.remember !== false) useEditor.getState().rememberDuration(subjectId, Math.max(MIN_DURATION, snapDown(interval.end - interval.start) || STEP))
  useEditor.getState().select(block.id)
  const conflicts = conflictsOf(currentDoc()!, block)
  if (conflicts.length) toast(`Se superpone con ${conflicts.length === 1 ? "otro bloque" : `${conflicts.length} bloques`}`, { description: "Se muestran en carriles paralelos." })
  return block.id
}

export function setBlockInterval(id: string, interval: Interval, label: string) {
  const doc = currentDoc()
  const block = doc?.blocks.find((item) => item.id === id)
  if (!doc || !block) return false
  if (block.day === interval.day && block.start === interval.start && block.end === interval.end) return false
  const problem = intervalProblem(doc, interval)
  if (problem) {
    toast.warning("No se puede mover ahí", { description: problem })
    return false
  }
  if (findDuplicate(doc, { ...block, ...interval }, id)) {
    toast.warning("Este bloque ya existe", { description: "Ya hay una clase idéntica en ese horario." })
    return false
  }
  const name = subjectName(doc, block.subjectId)
  return commit(`${label} ${name}`, (current) => updateBlock(current, id, interval), { announce: `${name}: ${describeInterval(interval)}` })
}

export function editBlockFields(id: string, patch: Partial<Pick<Block, "room" | "kind" | "notes" | "subjectId">>) {
  const doc = currentDoc()
  const block = doc?.blocks.find((item) => item.id === id)
  if (!doc || !block) return
  const changed = (Object.keys(patch) as (keyof typeof patch)[]).filter((key) => patch[key] !== undefined && patch[key] !== block[key])
  if (!changed.length) return
  if (findDuplicate(doc, { ...block, ...patch }, id)) {
    toast.warning("Este bloque ya existe", { description: "Ya hay una clase idéntica." })
    return
  }
  const names: Record<string, string> = { room: "aula", kind: "tipo", notes: "notas", subjectId: "materia" }
  commit(`Cambiar ${changed.map((key) => names[key]).join(" y ")} de ${subjectName(doc, block.subjectId)}`, (current) => updateBlock(current, id, patch))
}

export function nudgeBlock(id: string, minutes: number) {
  const block = currentDoc()?.blocks.find((item) => item.id === id)
  if (!block) return
  setBlockInterval(id, { day: block.day, start: block.start + minutes, end: block.end + minutes }, "Mover")
}

export function shiftBlockDay(id: string, direction: -1 | 1) {
  const doc = currentDoc()
  const block = doc?.blocks.find((item) => item.id === id)
  if (!doc || !block) return
  const days = doc.settings.days
  const index = days.indexOf(block.day)
  const target = days[index + direction]
  if (index < 0 || !target) return
  setBlockInterval(id, { day: target, start: block.start, end: block.end }, "Mover")
}

/** Moves one end in 30-minute steps from the edge's own value, keeping at least 30 minutes. */
export function adjustEdge(id: string, edge: "start" | "end", delta: number) {
  const block = currentDoc()?.blocks.find((item) => item.id === id)
  if (!block) return
  const interval = { day: block.day, start: block.start, end: block.end }
  if (edge === "start") interval.start = block.start + delta
  else interval.end = block.end + delta
  if (interval.end - interval.start < MIN_DURATION) return
  if (setBlockInterval(id, interval, "Cambiar duración de")) {
    useEditor.getState().rememberDuration(block.subjectId, Math.max(MIN_DURATION, snapDown(interval.end - interval.start) || STEP))
  }
}

export function edgeLimits(doc: ScheduleDocument, block: Block) {
  const { start, end } = doc.settings.range
  return {
    startEarlier: block.start - STEP >= start,
    startLater: block.end - (block.start + STEP) >= MIN_DURATION,
    endEarlier: block.end - STEP - block.start >= MIN_DURATION,
    endLater: block.end + STEP <= end,
    moveEarlier: block.start - STEP >= start,
    moveLater: block.end + STEP <= end,
  }
}

export function deleteBlock(id: string) {
  const doc = currentDoc()
  const block = doc?.blocks.find((item) => item.id === id)
  if (!doc || !block) return
  const ordered = sortedBlocks(doc.blocks)
  const index = ordered.findIndex((item) => item.id === id)
  const next = ordered[index + 1] ?? ordered[index - 1]
  const name = subjectName(doc, block.subjectId)
  commit(`Eliminar bloque de ${name}`, (current) => deleteBlocks(current, [id]), { announce: `Bloque de ${name} eliminado` })
  useEditor.getState().select(next && next.id !== id ? next.id : null)
}

// Clipboard and candidates

export function copyBlock(id: string): ClipboardPayload | null {
  const doc = currentDoc()
  const block = doc?.blocks.find((item) => item.id === id)
  const subject = doc?.subjects.find((item) => item.id === block?.subjectId)
  if (!doc || !block || !subject) return null
  const { id: _id, ...rest } = block
  void _id
  const payload: ClipboardPayload = { format: "horario-studio/block", version: 1, projectId: doc.id, block: rest, subject }
  useEditor.getState().set({ clipboard: payload })
  announce(`Bloque de ${subject.name} copiado`)
  return payload
}

export function parseClipboard(text: string): ClipboardPayload | null {
  try {
    const data = JSON.parse(text) as ClipboardPayload
    if (data?.format !== "horario-studio/block" || data.version !== 1) return null
    const block = data.block
    const days = DAYS.map((day) => day.id) as string[]
    if (!block || typeof block.start !== "number" || typeof block.end !== "number" || !days.includes(block.day) || block.start >= block.end) return null
    if (!data.subject || typeof data.subject.name !== "string" || !/^#[0-9a-f]{6,8}$/i.test(data.subject.color ?? "")) return null
    return {
      ...data,
      block: { ...block, room: String(block.room ?? "").slice(0, 60), kind: String(block.kind ?? "").slice(0, 40), notes: String(block.notes ?? "").slice(0, 280) },
    }
  } catch {
    return null
  }
}

/** Fits an interval into the current range and days, keeping its duration. */
export function fitInterval(doc: ScheduleDocument, interval: Interval): Interval {
  const { range, days } = doc.settings
  const duration = Math.min(interval.end - interval.start, range.end - range.start)
  const day = days.includes(interval.day) ? interval.day : days[0]!
  const start = Math.min(Math.max(interval.start, range.start), range.end - duration)
  return { day, start, end: start + duration }
}

/** Pasting opens a placement candidate: same room, kind, notes and duration, waiting for a position. */
export function startPaste(payload: ClipboardPayload) {
  const doc = currentDoc()
  if (!doc) return
  const local = payload.projectId === doc.id ? doc.subjects.find((subject) => subject.id === payload.block.subjectId) : undefined
  // Between projects, link only to an exactly equal subject; otherwise bring a copy of it.
  const exact = local ?? doc.subjects.find((subject) => subject.name === payload.subject.name && subject.color.toUpperCase() === payload.subject.color.toUpperCase() && subject.textColor.toUpperCase() === payload.subject.textColor.toUpperCase())
  const hover = useEditor.getState().hover
  const base: Interval = { day: payload.block.day, start: payload.block.start, end: payload.block.end }
  const interval = hover ? fitInterval(doc, { day: hover.day, start: hover.start, end: hover.start + (base.end - base.start) }) : fitInterval(doc, base)
  const candidate: Candidate = {
    source: "paste",
    subjectId: exact?.id ?? payload.subject.id,
    room: payload.block.room,
    kind: payload.block.kind,
    notes: payload.block.notes,
    interval,
    foreignSubject: exact ? undefined : { ...payload.subject },
  }
  useEditor.getState().set({ candidate, tool: "select", hover: null })
  announce("Elegí dónde pegar el bloque: clic en la grilla, flechas para moverlo, Enter para confirmar")
}

export function startDuplicate(id: string) {
  const doc = currentDoc()
  const block = doc?.blocks.find((item) => item.id === id)
  if (!doc || !block) return
  const duration = block.end - block.start
  const days = doc.settings.days
  // Start the candidate right after the original (or the next day) so it never sits exactly on top of it.
  let interval: Interval = { day: block.day, start: block.end, end: block.end + duration }
  if (interval.end > doc.settings.range.end) {
    const next = days[days.indexOf(block.day) + 1] ?? days[days.indexOf(block.day) - 1] ?? block.day
    interval = { day: next, start: block.start, end: block.end }
  }
  useEditor.getState().set({
    candidate: { source: "duplicate", subjectId: block.subjectId, room: block.room, kind: block.kind, notes: block.notes, interval: fitInterval(doc, interval) },
    tool: "select",
    hover: null,
  })
  announce("Elegí dónde ubicar la copia: clic en la grilla, flechas para moverla, Enter para confirmar")
}

export function moveCandidate(change: { minutes?: number; day?: -1 | 1; to?: Interval }) {
  const doc = currentDoc()
  const candidate = useEditor.getState().candidate
  if (!doc || !candidate) return
  let interval = candidate.interval
  if (change.to) interval = fitInterval(doc, change.to)
  if (change.minutes) {
    const shifted = { ...interval, start: interval.start + change.minutes, end: interval.end + change.minutes }
    if (shifted.start >= doc.settings.range.start && shifted.end <= doc.settings.range.end) interval = shifted
  }
  if (change.day) {
    const days = doc.settings.days
    const next = days[days.indexOf(interval.day) + change.day]
    if (next) interval = { ...interval, day: next }
  }
  useEditor.getState().set({ candidate: { ...candidate, interval } })
}

export function confirmCandidate() {
  const doc = currentDoc()
  const candidate = useEditor.getState().candidate
  if (!doc || !candidate) return
  let subjectId = candidate.subjectId
  if (candidate.foreignSubject && !doc.subjects.some((subject) => subject.id === subjectId)) {
    const subject = { ...candidate.foreignSubject, id: createId("sub") }
    const duplicateCheck = { subjectId: subject.id, ...candidate.interval, room: candidate.room, kind: candidate.kind, notes: candidate.notes }
    const problem = intervalProblem(doc, candidate.interval)
    if (problem) {
      toast.warning("No se puede ubicar ahí", { description: problem })
      return
    }
    const block: Block = { id: createId("blk"), ...duplicateCheck }
    commit(`Pegar bloque de ${subject.name}`, (current) => addBlocks(addSubject(current, subject), [block]), { announce: `${subject.name} pegada el ${describeInterval(candidate.interval)}` })
    useEditor.getState().set({ candidate: null, selectedBlockId: block.id })
    return
  }
  subjectId = candidate.subjectId
  const id = placeBlock(subjectId, candidate.interval, { room: candidate.room, kind: candidate.kind, notes: candidate.notes }, { remember: false })
  if (id) useEditor.getState().set({ candidate: null })
}

export function cancelCandidate() {
  if (useEditor.getState().candidate) {
    useEditor.getState().set({ candidate: null })
    announce("Ubicación cancelada")
  }
}

export function selectedBlock(): Block | null {
  const doc = currentDoc()
  const id = useEditor.getState().selectedBlockId
  return doc?.blocks.find((block) => block.id === id) ?? null
}

export function selectNeighbor(direction: 1 | -1) {
  const doc = currentDoc()
  if (!doc?.blocks.length) return
  const ordered = sortedBlocks(doc.blocks)
  const current = useEditor.getState().selectedBlockId
  const index = ordered.findIndex((block) => block.id === current)
  const next = index < 0 ? ordered[direction > 0 ? 0 : ordered.length - 1] : ordered[(index + direction + ordered.length) % ordered.length]
  if (next) {
    useEditor.getState().select(next.id)
    announce(describeBlock(doc, next))
  }
}

export function dayOrder(day: DayId) {
  return DAYS.findIndex((item) => item.id === day)
}
