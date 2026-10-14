import type { DayId } from "@/domain/types"
import type { PlacedGlyph } from "./text"
import { timeSegmentAt, type TimeScaleSegment } from "./time-scale"

export type Rect = { x: number; y: number; w: number; h: number }

export type GlyphRun = { x: number; baseline: number; size: number; glyphs: PlacedGlyph[] }

export type SceneNode =
  | { type: "rect"; x: number; y: number; w: number; h: number; rx?: number; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: "path"; d: string; fill?: string; stroke?: string; strokeWidth?: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; stroke: string; width: number; dash?: string }
  | { type: "circle"; cx: number; cy: number; r: number; fill: string; opacity: number }
  | { type: "text"; runs: GlyphRun[]; fill: string; opacity?: number }
  | { type: "group"; clip?: Rect & { rx: number }; children: SceneNode[] }

export type SceneIssue = {
  level: "error" | "warning"
  code: "font-unavailable" | "missing-glyphs" | "truncated" | "out-of-range" | "grid-too-small" | "legend-too-large" | "title-truncated"
  message: string
  blockId?: string
}

export type BlockBox = Rect & { blockId: string; day: DayId; lane: number; lanes: number; conflict: boolean }

export type SceneGrid = {
  /** Left edge of the first day column, after the hour labels. */
  x: number
  width: number
  headerY: number
  headerH: number
  bodyY: number
  bodyH: number
  columns: { day: DayId; x: number; w: number }[]
  rangeStart: number
  rangeEnd: number
  timeScale: TimeScaleSegment[] | null
}

export type Scene = {
  width: number
  height: number
  background: { from: string; to: string | null }
  nodes: SceneNode[]
  grid: SceneGrid
  blocks: BlockBox[]
  issues: SceneIssue[]
  /** File hashes of every face used. */
  fontHashes: string[]
  title: string
  description: string
}

export function minuteToY(grid: SceneGrid, minute: number) {
  if (grid.timeScale) {
    const segment = timeSegmentAt(grid.timeScale, minute, "minute")
    return grid.bodyY + segment.yStart + ((minute - segment.start) * (segment.yEnd - segment.yStart)) / (segment.end - segment.start)
  }
  return grid.bodyY + ((minute - grid.rangeStart) * grid.bodyH) / (grid.rangeEnd - grid.rangeStart)
}

export function yToMinute(grid: SceneGrid, y: number) {
  if (grid.timeScale) {
    const offset = y - grid.bodyY
    const segment = timeSegmentAt(grid.timeScale, offset, "y")
    return cleanMinute(segment.start + ((offset - segment.yStart) * (segment.end - segment.start)) / (segment.yEnd - segment.yStart))
  }
  return cleanMinute(grid.rangeStart + ((y - grid.bodyY) * (grid.rangeEnd - grid.rangeStart)) / grid.bodyH)
}

/** Floating-point noise at an exact grid boundary must not snap a click into the previous slot. */
function cleanMinute(minute: number) {
  const rounded = Math.round(minute)
  return Math.abs(minute - rounded) < 1e-9 ? rounded : minute
}

/** Column under x, using the column's full width including the gap halves, or null outside the grid. */
export function dayAt(grid: SceneGrid, x: number): DayId | null {
  for (let index = 0; index < grid.columns.length; index++) {
    const column = grid.columns[index]!
    const next = grid.columns[index + 1]
    const left = index === 0 ? column.x : column.x - (column.x - (grid.columns[index - 1]!.x + grid.columns[index - 1]!.w)) / 2
    const right = next ? column.x + column.w + (next.x - (column.x + column.w)) / 2 : column.x + column.w
    if (x >= left && x < right) return column.day
  }
  return null
}

export function exportBlockers(scene: Scene) {
  return scene.issues.filter((issue) => issue.level === "error")
}
