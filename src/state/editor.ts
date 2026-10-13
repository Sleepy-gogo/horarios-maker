import { create } from "zustand"
import { DEFAULT_DURATION } from "@/domain/constants"
import type { Block, DayId, Subject } from "@/domain/types"

export type Tool = "select" | "place"

export type Interval = { day: DayId; start: number; end: number }

/** A block waiting for a position: pasted, duplicated, or tapped on a touch screen. Confirming inserts it as one operation. */
export type Candidate = {
  source: "paste" | "duplicate" | "tap"
  subjectId: string
  room: string
  kind: string
  notes: string
  interval: Interval
  /** Subject carried from another project, created on confirm if it does not exist here. */
  foreignSubject?: Subject
}

export type GestureDraft = {
  kind: "create" | "move" | "resize-start" | "resize-end"
  blockId?: string
  subjectId: string
  interval: Interval
  /** Text shown next to the draft, e.g. a limit reached. */
  hint?: string
}

export type ClipboardPayload = {
  format: "horario-studio/block"
  version: 1
  projectId: string
  block: Omit<Block, "id">
  subject: Subject
}

export type DialogName =
  | "new-project"
  | "settings"
  | "projects"
  | "import"
  | "export"
  | "appearance"
  | "subject"
  | "delete-subject"
  | "shortcuts"
  | "about"
  | "commands"
  | "block-form"

export type DialogState = { name: DialogName; payload?: Record<string, unknown> } | null

type EditorState = {
  tool: Tool
  armedSubjectId: string | null
  selectedBlockId: string | null
  /** Subject shown in the inspector when no block is selected. */
  focusedSubjectId: string | null
  hover: Interval | null
  draft: GestureDraft | null
  candidate: Candidate | null
  clipboard: ClipboardPayload | null
  durations: Record<string, number>
  zoom: number
  fit: boolean
  dialog: DialogState
  mobileSheet: "library" | "inspector" | null
  leftTab: "subjects" | "blocks"
  set: (patch: Partial<EditorState>) => void
  arm: (subjectId: string | null) => void
  select: (blockId: string | null) => void
  openDialog: (name: DialogName, payload?: Record<string, unknown>) => void
  closeDialog: () => void
  rememberDuration: (subjectId: string, minutes: number) => void
  reset: () => void
}

const initial = {
  tool: "select" as Tool,
  armedSubjectId: null,
  selectedBlockId: null,
  focusedSubjectId: null,
  hover: null,
  draft: null,
  candidate: null,
  durations: {},
  zoom: 1,
  fit: true,
  mobileSheet: null,
}

export const useEditor = create<EditorState>((set) => ({
  ...initial,
  clipboard: null,
  dialog: null,
  leftTab: "subjects",
  set: (patch) => set(patch),
  arm: (subjectId) =>
    set(subjectId ? { armedSubjectId: subjectId, tool: "place", focusedSubjectId: subjectId, candidate: null } : { tool: "select", hover: null }),
  select: (blockId) => set(blockId ? { selectedBlockId: blockId, focusedSubjectId: null } : { selectedBlockId: null }),
  openDialog: (name, payload) => set({ dialog: { name, payload } }),
  closeDialog: () => set({ dialog: null }),
  rememberDuration: (subjectId, minutes) => set((state) => ({ durations: { ...state.durations, [subjectId]: minutes } })),
  /** Called when the project changes: nothing transient carries over. */
  reset: () => set({ ...initial }),
}))

export function durationFor(subjectId: string) {
  return useEditor.getState().durations[subjectId] ?? DEFAULT_DURATION
}
