import { beforeAll, describe, expect, test } from "bun:test"
import { createDocument } from "../src/domain/document"
import { LOCAL_FAMILIES } from "../src/fonts/catalog"
import type { FaceHandle, ResolvedFont } from "../src/fonts/service"
import { layoutDocument, type FontResolver } from "../src/engine/layout"
import { minuteToY, type SceneNode } from "../src/engine/scene"
import { initEngine } from "../src/engine/export"
import { sceneToSvg } from "../src/engine/svg"
import type { Block } from "../src/domain/types"

let resolveFont: FontResolver
beforeAll(async () => {
  await initEngine()
  const hb = await import("harfbuzzjs")
  const handles = new Map<string, FaceHandle>()
  for (const family of LOCAL_FAMILIES) {
    const bytes = await Bun.file(`public${family.url}`).arrayBuffer()
    const face = new hb.Face(new hb.Blob(bytes), 0)
    const font = new hb.Font(face)
    const extents = font.hExtents()
    handles.set(family.id, { key: family.id, font, upem: face.upem, ascender: extents.ascender, descender: Math.abs(extents.descender), sha256: family.id, paths: new Map() })
  }
  resolveFont = (ref) => ({ font: { refKey: ref.id, ref, faces: [handles.get(ref.id)!] } satisfies ResolvedFont, fallback: false })
})

function document(compactEmptyHours = true) {
  const doc = createDocument({ compactEmptyHours, page: { preset: "square", width: 1080, height: 1080 } })
  doc.settings.show.legend = false
  doc.subjects = [{ id: "subject", name: "Ingeniería de Software", color: "#6366F1", textColor: "#FFFFFF" }]
  doc.blocks = [block("morning", "mon", 600, 720), block("afternoon", "tue", 1080, 1200)]
  return doc
}

function block(id: string, day: Block["day"], start: number, end: number): Block {
  return { id, subjectId: "subject", day, start, end, room: "Aula 24", kind: "Teórica", notes: "" }
}

function allNodes(nodes: SceneNode[]): SceneNode[] {
  return nodes.flatMap((node) => node.type === "group" ? [node, ...allNodes(node.children)] : [node])
}

describe("compression in the rendered scene", () => {
  test("classes grow and hour lines, stripes, half-hour lines and block boxes share the same scale", () => {
    const doc = document()
    doc.appearance.grid.stripes = true
    doc.appearance.grid.halfHourLines = true
    const scene = layoutDocument(doc, resolveFont)
    const uniform = layoutDocument({ ...doc, settings: { ...doc.settings, compactEmptyHours: false } }, resolveFont)
    expect(scene.blocks[0]!.h).toBeGreaterThan(uniform.blocks[0]!.h)
    expect(scene.grid.bodyH).toBe(uniform.grid.bodyH)
    const y = minuteToY(scene.grid, 900)
    const round = (n: number) => Math.round(n * 100) / 100
    const nodes = allNodes(scene.nodes)
    expect(nodes.some((node) => node.type === "line" && node.y1 === round(y) && node.y2 === round(y))).toBe(true)
    expect(nodes.some((node) => node.type === "line" && node.dash && node.y1 === round(minuteToY(scene.grid, 930)))).toBe(true)
    expect(nodes.some((node) => node.type === "rect" && node.fill === doc.appearance.grid.stripeColor && node.y === round(y) && node.h === round(minuteToY(scene.grid, 960) - y))).toBe(true)
    for (const box of scene.blocks) {
      const source = doc.blocks.find((block) => block.id === box.blockId)!
      expect(box.y).toBeCloseTo(minuteToY(scene.grid, source.start) + doc.appearance.blocks.inset / 2, 1)
      expect(box.h).toBeCloseTo(minuteToY(scene.grid, source.end) - minuteToY(scene.grid, source.start) - doc.appearance.blocks.inset, 1)
    }
    expect(scene.issues.filter((issue) => issue.level === "error")).toEqual([])
    const svg = sceneToSvg(scene)
    expect(svg).toContain(`y1="${round(y)}"`)
    expect(svg).not.toContain("NaN")
    expect(svg).not.toContain("Infinity")
  })

  test("a class on any visible day protects an hour, while hidden or out-of-range classes do not affect the scale", () => {
    const doc = document()
    const baseline = layoutDocument(doc, resolveFont)
    doc.blocks.push(block("hidden", "sun", 840, 1080), block("outside", "thu", 470, 900))
    const invalid = layoutDocument(doc, resolveFont)
    expect(invalid.grid.timeScale).toEqual(baseline.grid.timeScale)
    expect(invalid.issues.filter((issue) => issue.code === "out-of-range")).toHaveLength(2)
    doc.blocks = doc.blocks.filter((b) => b.id !== "outside")
    doc.settings.days.push("sun")
    const withSunday = layoutDocument(doc, resolveFont)
    const occupied = (g: typeof baseline.grid, start: number) => minuteToY(g, start + 60) - minuteToY(g, start)
    expect(occupied(withSunday.grid, 840)).toBeCloseTo(occupied(withSunday.grid, 600), 9)
  })

  test("overlapping lanes and exact minute geometry survive compression", () => {
    const doc = document()
    doc.blocks.push(block("overlap", "mon", 615, 675))
    const scene = layoutDocument(doc, resolveFont)
    const box = scene.blocks.find((box) => box.blockId === "overlap")!
    expect(box.lanes).toBe(2)
    expect(box.conflict).toBe(true)
    expect(box.y).toBeCloseTo(minuteToY(scene.grid, 615) + doc.appearance.blocks.inset / 2, 1)
  })

  test("turning compression off restores the identical SVG", () => {
    const doc = document(false)
    const before = sceneToSvg(layoutDocument(doc, resolveFont))
    doc.settings.compactEmptyHours = true
    expect(sceneToSvg(layoutDocument(doc, resolveFont))).not.toBe(before)
    doc.settings.compactEmptyHours = false
    expect(sceneToSvg(layoutDocument(doc, resolveFont))).toBe(before)
  })

  test("hour label spacing also protects a short first interval in a partial range", () => {
    const doc = document()
    doc.settings.range = { start: 520, end: 1260 }
    const scene = layoutDocument(doc, resolveFont)
    const minimum = doc.appearance.type.hour.size * doc.appearance.type.hour.lineHeight + 4
    expect(minuteToY(scene.grid, 540) - minuteToY(scene.grid, 520)).toBeGreaterThanOrEqual(minimum - 0.01)
  })
})
