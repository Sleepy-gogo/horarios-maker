import { describe, expect, test } from "bun:test"
import { createTimeScale } from "../src/engine/time-scale"
import { minuteToY, yToMinute, type SceneGrid } from "../src/engine/scene"
import { snapDown } from "../src/domain/time"

function grid(start: number, end: number, height: number, blocks: { start: number; end: number }[], minimum = 0): SceneGrid {
  return { x: 0, width: 500, headerY: 0, headerH: 30, bodyY: 30, bodyH: height, columns: [], rangeStart: start, rangeEnd: end, timeScale: createTimeScale(start, end, height, blocks, minimum) }
}

const hourHeight = (g: SceneGrid, hour: number) => minuteToY(g, hour * 60 + 60) - minuteToY(g, hour * 60)

describe("compressed time scale", () => {
  test("redistributes a four-hour empty band while keeping the full page and 42% ratio", () => {
    const g = grid(480, 1260, 780, [{ start: 480, end: 840 }, { start: 1080, end: 1260 }])
    expect(hourHeight(g, 14) / hourHeight(g, 8)).toBeCloseTo(0.42, 12)
    expect(hourHeight(g, 14)).toBeLessThan(60)
    expect(hourHeight(g, 8)).toBeGreaterThan(60)
    expect(minuteToY(g, 480)).toBe(30)
    expect(minuteToY(g, 1260)).toBe(810)
  })

  test("an overlap of any length protects the entire hour, with exclusive end boundaries", () => {
    const g = grid(480, 720, 400, [{ start: 539, end: 541 }, { start: 660, end: 720 }])
    expect(hourHeight(g, 8)).toBeCloseTo(hourHeight(g, 9), 12)
    expect(hourHeight(g, 10) / hourHeight(g, 9)).toBeCloseTo(0.42, 12)
    expect(hourHeight(g, 11)).toBeCloseTo(hourHeight(g, 9), 12)
  })

  test("empty and fully occupied schedules retain uniform heights", () => {
    for (const blocks of [[], [{ start: 480, end: 1260 }]]) {
      const g = grid(480, 1260, 780, blocks)
      for (let h = 8; h < 21; h++) expect(hourHeight(g, h)).toBeCloseTo(60, 12)
    }
  })

  test("large hour labels set a spacing floor without making empty hours taller than occupied hours", () => {
    const g = grid(0, 1440, 600, [{ start: 480, end: 1380 }], 23)
    expect(hourHeight(g, 0)).toBeCloseTo(23, 10)
    expect(hourHeight(g, 8)).toBeGreaterThan(23)
    const tight = grid(0, 1440, 240, [{ start: 480, end: 1380 }], 23)
    expect(hourHeight(tight, 0)).toBeCloseTo(10, 10)
    expect(hourHeight(tight, 8)).toBeCloseTo(10, 10)
  })

  test("partial ranges and exact imported minutes interpolate within hourly segments", () => {
    const g = grid(497, 751, 500, [{ start: 558, end: 614 }])
    expect(g.timeScale!.map((segment) => [segment.start, segment.end])).toEqual([[497, 540], [540, 600], [600, 660], [660, 720], [720, 751]])
    expect(minuteToY(g, 570)).toBeCloseTo((minuteToY(g, 540) + minuteToY(g, 600)) / 2, 12)
    expect(minuteToY(g, 751)).toBe(530)
  })

  test("forward and inverse mappings agree across boundaries and outside the grid", () => {
    for (const [start, end] of [[0, 1440], [497, 751], [1380, 1440], [480, 1260]]) {
      for (const height of [24, 600, 2000]) {
        const g = grid(start!, end!, height, [{ start: 538, end: 691 }, { start: 1200, end: 1390 }], 18)
        let previous = -Infinity
        for (let minute = start! - 60; minute <= end! + 60; minute += 0.5) {
          const y = minuteToY(g, minute)
          expect(y).toBeGreaterThan(previous)
          expect(yToMinute(g, y)).toBeCloseTo(minute, 9)
          previous = y
        }
        for (const segment of g.timeScale!) {
          expect(yToMinute(g, minuteToY(g, segment.start))).toBeCloseTo(segment.start, 10)
          expect(yToMinute(g, minuteToY(g, segment.end))).toBeCloseTo(segment.end, 10)
        }
      }
    }
  })

  test("disabled mode preserves the original uniform formula", () => {
    const g = { ...grid(497, 751, 500, []), timeScale: null }
    for (let minute = 450; minute <= 800; minute++) {
      expect(minuteToY(g, minute)).toBe(g.bodyY + ((minute - g.rangeStart) * g.bodyH) / (g.rangeEnd - g.rangeStart))
      expect(yToMinute(g, minuteToY(g, minute))).toBeCloseTo(minute, 10)
    }
  })

  test("clicks exactly on half-hour boundaries cannot fall into the previous slot", () => {
    for (const height of [24, 600, 867.5999999999999, 2000]) {
      for (const compact of [true, false]) {
        const g = { ...grid(480, 1260, height, [{ start: 480, end: 720 }, { start: 840, end: 1080 }]), bodyY: 168.4 }
        if (!compact) g.timeScale = null
        for (let minute = 480; minute <= 1260; minute += 30) {
          expect(snapDown(yToMinute(g, minuteToY(g, minute)))).toBe(minute)
          expect(snapDown(yToMinute(g, minuteToY(g, minute - 0.001)))).toBe(minute - 30)
        }
      }
    }
  })
})
