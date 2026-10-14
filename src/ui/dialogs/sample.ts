import { readableText } from "@/domain/color"
import { createDocument, createId } from "@/domain/document"
import { STEP } from "@/domain/constants"
import type { Appearance, Block, DocumentSettings, ScheduleDocument, Subject } from "@/domain/types"

const NAMES = ["Matemática", "Historia", "Biología", "Literatura", "Inglés", "Química"]
const ROOMS = ["Aula 12", "Aula 4", "Lab 2", "Aula 7", "Aula 1", "Lab 1"]

const snap = (minutes: number) => Math.round(minutes / STEP) * STEP

/** A small believable week for previews: two classes a day, spread over the visible range, in the theme's own palette. */
export function sampleDocument(settings: DocumentSettings, appearance: Appearance): ScheduleDocument {
  const doc = createDocument(settings, appearance)
  const subjects: Subject[] = NAMES.map((name, index) => {
    const color = appearance.palette[index % appearance.palette.length]!
    return { id: `sample-${index}`, name, color, textColor: readableText(color) }
  })
  const { start, end } = settings.range
  const span = end - start
  const blocks: Block[] = []
  settings.days.forEach((day, index) => {
    const slots = [
      { at: 0.08 + (index % 2) * 0.1, length: 0.16, subject: (index * 2) % NAMES.length },
      { at: 0.45 + (index % 3) * 0.08, length: 0.2, subject: (index * 2 + 1) % NAMES.length },
    ]
    for (const slot of slots) {
      const from = snap(start + span * slot.at)
      const to = Math.min(end, Math.max(from + STEP * 2, snap(from + span * slot.length)))
      if (to <= from || from < start) continue
      blocks.push({ id: createId("smp"), subjectId: subjects[slot.subject]!.id, day, start: from, end: to, room: ROOMS[slot.subject]!, kind: "", notes: "" })
    }
  })
  const used = new Set(blocks.map((block) => block.subjectId))
  return { ...doc, subjects: subjects.filter((subject) => used.has(subject.id)), blocks }
}
