import type { Block } from "@/domain/types"

/** Offsets in document pixels, shared by drawing and pointer hit testing. */
export type TimeScaleSegment = { start: number; end: number; yStart: number; yEnd: number }

const EMPTY_HOUR_WEIGHT = 0.42

/** One scale for the whole week; a partially occupied hour keeps its full weight. */
export function createTimeScale(
  start: number,
  end: number,
  height: number,
  blocks: Pick<Block, "start" | "end">[],
  minHourHeight = 0,
): TimeScaleSegment[] {
  const bands: { start: number; end: number; occupied: boolean }[] = []
  for (let minute = start; minute < end;) {
    const next = Math.min(end, (Math.floor(minute / 60) + 1) * 60)
    bands.push({ start: minute, end: next, occupied: blocks.some((block) => block.start < next && block.end > minute) })
    minute = next
  }
  const occupiedMinutes = bands.reduce((sum, band) => sum + (band.occupied ? band.end - band.start : 0), 0)
  const emptyMinutes = end - start - occupiedMinutes
  // Increase the empty weight when needed to keep neighboring hour labels apart.
  // If even the uniform scale cannot fit that spacing, retain the uniform scale.
  const denominator = height * 60 - minHourHeight * emptyMinutes
  const floorWeight = denominator > 0 ? minHourHeight * occupiedMinutes / denominator : 1
  const emptyWeight = Math.min(1, Math.max(EMPTY_HOUR_WEIGHT, floorWeight))
  const totalWeight = occupiedMinutes + emptyMinutes * emptyWeight
  let y = 0
  return bands.map((band, index) => {
    const yStart = y
    y += ((band.end - band.start) * (band.occupied ? 1 : emptyWeight) * height) / totalWeight
    return { start: band.start, end: band.end, yStart, yEnd: index === bands.length - 1 ? height : y }
  })
}

/** Binary search, extending the first/last segment outside the grid for drag clamping. */
export function timeSegmentAt(segments: TimeScaleSegment[], value: number, axis: "minute" | "y") {
  let low = 0
  let high = segments.length - 1
  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    const end = axis === "minute" ? segments[mid]!.end : segments[mid]!.yEnd
    if (value < end) high = mid
    else low = mid + 1
  }
  return segments[low]!
}
