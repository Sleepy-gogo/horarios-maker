import { DAY_IDS, DEFAULT_DAYS, DEFAULT_RANGE, PAGE_PRESETS, STEP, sortDays } from "./constants"
import { readableText } from "./color"
import { defaultAppearance } from "./presets"
import { overlaps, snapDown, snapUp } from "./time"
import type { Appearance, Block, DayId, DocumentSettings, PagePreset, ScheduleDocument, Subject } from "./types"

export function createId(prefix = "id") {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      : Math.random().toString(36).slice(2, 12) + Date.now().toString(36)
  return `${prefix}_${random}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function defaultSettings(): DocumentSettings {
  const page = PAGE_PRESETS["a4-landscape"]
  return {
    title: "Mi horario",
    subtitle: "",
    page: { preset: "a4-landscape", width: page.width, height: page.height },
    days: [...DEFAULT_DAYS],
    range: { ...DEFAULT_RANGE },
    compactEmptyHours: false,
    show: { subtitle: true, room: true, kind: true, notes: false, blockTimes: true, hourLabels: true, legend: true },
  }
}

export function createDocument(settings: Partial<DocumentSettings> = {}, appearance: Appearance = defaultAppearance()): ScheduleDocument {
  return {
    schemaVersion: 2,
    id: createId("doc"),
    createdAt: nowIso(),
    subjects: [],
    blocks: [],
    settings: { ...defaultSettings(), ...settings },
    appearance: structuredClone(appearance),
  }
}

export function pageFromPreset(preset: PagePreset, custom?: { width: number; height: number }) {
  if (preset === "custom") return { preset, width: custom?.width ?? 1200, height: custom?.height ?? 1200 }
  const value = PAGE_PRESETS[preset]
  return { preset, width: value.width, height: value.height }
}

export function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("es")
}

export function findSubjectByName(doc: ScheduleDocument, name: string, exceptId?: string) {
  const key = normalizeName(name)
  return doc.subjects.find((subject) => subject.id !== exceptId && normalizeName(subject.name) === key)
}

/** Auxiliary labels for homonymous subjects ("variante 2"). Shown only in the studio, never exported. */
export function subjectVariants(subjects: Subject[]) {
  const groups = new Map<string, Subject[]>()
  for (const subject of subjects) {
    const key = normalizeName(subject.name)
    groups.set(key, [...(groups.get(key) ?? []), subject])
  }
  const labels = new Map<string, string>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    group.forEach((subject, index) => labels.set(subject.id, `variante ${index + 1}`))
  }
  return labels
}

export function nextSubjectColor(doc: ScheduleDocument) {
  const palette = doc.appearance.palette
  const used = new Set(doc.subjects.map((subject) => subject.color.toUpperCase()))
  const free = palette.find((color) => !used.has(color.toUpperCase()))
  return free ?? palette[doc.subjects.length % palette.length]!
}

export function makeSubject(doc: ScheduleDocument, name: string, color?: string, textColor?: string): Subject {
  const fill = color ?? nextSubjectColor(doc)
  return { id: createId("sub"), name: name.trim().replace(/\s+/g, " "), color: fill, textColor: textColor ?? readableText(fill) }
}

export function addSubject(doc: ScheduleDocument, subject: Subject): ScheduleDocument {
  return { ...doc, subjects: [...doc.subjects, subject] }
}

export function updateSubject(doc: ScheduleDocument, id: string, patch: Partial<Omit<Subject, "id">>): ScheduleDocument {
  return { ...doc, subjects: doc.subjects.map((subject) => (subject.id === id ? { ...subject, ...patch } : subject)) }
}

export function deleteSubject(doc: ScheduleDocument, id: string): ScheduleDocument {
  return {
    ...doc,
    subjects: doc.subjects.filter((subject) => subject.id !== id),
    blocks: doc.blocks.filter((block) => block.subjectId !== id),
  }
}

export function reassignBlocks(doc: ScheduleDocument, fromId: string, toId: string): ScheduleDocument {
  return { ...doc, blocks: doc.blocks.map((block) => (block.subjectId === fromId ? { ...block, subjectId: toId } : block)) }
}

export function mergeSubjects(doc: ScheduleDocument, fromId: string, intoId: string): ScheduleDocument {
  const reassigned = reassignBlocks(doc, fromId, intoId)
  return { ...reassigned, subjects: reassigned.subjects.filter((subject) => subject.id !== fromId) }
}

export function moveSubject(doc: ScheduleDocument, id: string, direction: -1 | 1): ScheduleDocument {
  const index = doc.subjects.findIndex((subject) => subject.id === id)
  const target = index + direction
  if (index < 0 || target < 0 || target >= doc.subjects.length) return doc
  const subjects = [...doc.subjects]
  const [item] = subjects.splice(index, 1)
  subjects.splice(target, 0, item!)
  return { ...doc, subjects }
}

export function addBlocks(doc: ScheduleDocument, blocks: Block[]): ScheduleDocument {
  return { ...doc, blocks: [...doc.blocks, ...blocks] }
}

export function updateBlock(doc: ScheduleDocument, id: string, patch: Partial<Omit<Block, "id">>): ScheduleDocument {
  return { ...doc, blocks: doc.blocks.map((block) => (block.id === id ? { ...block, ...patch } : block)) }
}

export function deleteBlocks(doc: ScheduleDocument, ids: string[]): ScheduleDocument {
  const set = new Set(ids)
  return { ...doc, blocks: doc.blocks.filter((block) => !set.has(block.id)) }
}

export function sameContent(a: Omit<Block, "id">, b: Omit<Block, "id">) {
  return (
    a.subjectId === b.subjectId &&
    a.day === b.day &&
    a.start === b.start &&
    a.end === b.end &&
    a.room.trim() === b.room.trim() &&
    a.kind.trim() === b.kind.trim() &&
    a.notes.trim() === b.notes.trim()
  )
}

export function findDuplicate(doc: ScheduleDocument, candidate: Omit<Block, "id">, exceptId?: string) {
  return doc.blocks.find((block) => block.id !== exceptId && sameContent(block, candidate))
}

export function conflictsOf(doc: ScheduleDocument, block: Pick<Block, "id" | "day" | "start" | "end">) {
  return doc.blocks.filter((other) => other.id !== block.id && other.day === block.day && overlaps(other, block))
}

export function compareBlocks(a: Block, b: Block) {
  return DAY_IDS.indexOf(a.day) - DAY_IDS.indexOf(b.day) || a.start - b.start || a.end - b.end || a.id.localeCompare(b.id)
}

export function sortedBlocks(blocks: Block[]) {
  return [...blocks].sort(compareBlocks)
}

/** Blocks that a settings change would hide: removed days or outside the visible range. */
export function excludedBlocks(blocks: Block[], days: DayId[], range: { start: number; end: number }) {
  const visible = new Set(days)
  return blocks.filter((block) => !visible.has(block.day) || block.start < range.start || block.end > range.end)
}

/** Range that covers every block with half an hour of margin, limited to 00:00–24:00. */
export function fitRange(blocks: Block[], margin = STEP) {
  if (!blocks.length) return { ...DEFAULT_RANGE }
  const start = Math.max(0, snapDown(Math.min(...blocks.map((block) => block.start))) - margin)
  const end = Math.min(1440, snapUp(Math.max(...blocks.map((block) => block.end))) + margin)
  return end - start >= 60 ? { start, end } : { start, end: Math.min(1440, start + 60) }
}

/** Smallest range containing both the current range and the given blocks, keeping the 30-minute grid. */
export function expandRange(range: { start: number; end: number }, blocks: Pick<Block, "start" | "end">[]) {
  if (!blocks.length) return range
  return {
    start: Math.min(range.start, snapDown(Math.min(...blocks.map((block) => block.start)))),
    end: Math.max(range.end, snapUp(Math.max(...blocks.map((block) => block.end)))),
  }
}

export function withSettings(doc: ScheduleDocument, settings: DocumentSettings): ScheduleDocument {
  return { ...doc, settings: { ...settings, days: sortDays(settings.days) } }
}

export function subjectUsage(doc: ScheduleDocument) {
  const counts = new Map<string, number>()
  for (const block of doc.blocks) counts.set(block.subjectId, (counts.get(block.subjectId) ?? 0) + 1)
  return counts
}

/** Gives every subject and block a fresh id, keeping relations. Used for copies and imports. */
export function reidentify(doc: ScheduleDocument): ScheduleDocument {
  const subjectMap = new Map(doc.subjects.map((subject) => [subject.id, createId("sub")]))
  return {
    ...doc,
    id: createId("doc"),
    createdAt: nowIso(),
    subjects: doc.subjects.map((subject) => ({ ...subject, id: subjectMap.get(subject.id)! })),
    blocks: doc.blocks.map((block) => ({ ...block, id: createId("blk"), subjectId: subjectMap.get(block.subjectId)! })),
  }
}

export function documentSummary(doc: ScheduleDocument) {
  return { title: doc.settings.title.trim() || "Sin título", subjects: doc.subjects.length, blocks: doc.blocks.length }
}
