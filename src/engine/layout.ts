import { contrastRatio, darken, mix, readableText } from "@/domain/color"
import { DAYS } from "@/domain/constants"
import { compareBlocks } from "@/domain/document"
import { formatMinutes } from "@/domain/time"
import type { Appearance, Block, FontRef, ScheduleDocument, Subject, TextRole, TextStyle } from "@/domain/types"
import type { ResolvedFont } from "@/fonts/service"
import type { BlockBox, GlyphRun, Rect, Scene, SceneGrid, SceneIssue, SceneNode } from "./scene"
import { ellipsize, verticalMetrics, wrapText, type WrappedText } from "./text"

export type FontResolver = (ref: FontRef) => { font: ResolvedFont; fallback: boolean }

type Ctx = {
  doc: ScheduleDocument
  appearance: Appearance
  fonts: Record<TextRole, ResolvedFont>
  issues: SceneIssue[]
  missing: Set<string>
}

const ROLE_NAMES: Record<TextRole, string> = {
  title: "título",
  subtitle: "subtítulo",
  day: "días",
  hour: "horas",
  blockTitle: "nombre de materia",
  blockMeta: "detalles de bloque",
  legend: "leyenda",
}

function r2(value: number) {
  return Math.round(value * 100) / 100
}

/** Places wrapped lines from a top edge, returning glyph runs and the used height. */
function placeLines(ctx: Ctx, role: TextRole, wrapped: WrappedText, box: { x: number; y: number; w: number }, align: "start" | "center", size: number) {
  const style = ctx.appearance.type[role]
  const font = ctx.fonts[role]
  const lineHeight = size * style.lineHeight
  const { ascent, descent } = verticalMetrics(font, size)
  const runs: GlyphRun[] = []
  wrapped.lines.forEach((line, index) => {
    const offset = align === "center" ? (box.w - line.shaped.width) / 2 : 0
    runs.push({
      x: r2(box.x + Math.max(0, offset)),
      baseline: r2(box.y + index * lineHeight + (lineHeight - (ascent + descent)) / 2 + ascent),
      size,
      glyphs: line.shaped.glyphs,
    })
  })
  wrapped.missing.forEach((char) => ctx.missing.add(char))
  return { runs, height: wrapped.lines.length * lineHeight }
}

function wrap(ctx: Ctx, role: TextRole, text: string, width: number, maxLines: number, size?: number) {
  return wrapText(ctx.fonts[role], ctx.appearance.type[role], text, width, maxLines, size)
}

function hourText(minutes: number, format: Appearance["grid"]["hourFormat"]) {
  return formatMinutes(minutes, format)
}

function rangeText(block: Block, format: Appearance["grid"]["hourFormat"]) {
  const f = format === "H" ? "H:mm" : format
  return `${formatMinutes(block.start, f)}–${formatMinutes(block.end, f)}`
}

/** Assigns lanes per connected group of overlapping intervals: deterministic first free lane in start, end, id order. */
export function assignLanes(blocks: Block[]) {
  const result = new Map<string, { lane: number; lanes: number }>()
  const sorted = [...blocks].sort(compareBlocks)
  let group: Block[] = []
  let laneEnds: number[] = []
  let groupEnd = -1
  const flush = () => {
    const lanes = laneEnds.length
    for (const block of group) result.set(block.id, { lane: result.get(block.id)!.lane, lanes })
    group = []
    laneEnds = []
  }
  for (const block of sorted) {
    if (group.length && block.start >= groupEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= block.start)
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(block.end)
    } else {
      laneEnds[lane] = block.end
    }
    result.set(block.id, { lane, lanes: 0 })
    group.push(block)
    groupEnd = group.length === 1 ? block.end : Math.max(groupEnd, block.end)
  }
  if (group.length) flush()
  return result
}

function blockPaint(subject: Subject, appearance: Appearance) {
  const { style, borderWidth, borderColor } = appearance.blocks
  const body = appearance.grid.bodyFill
  const ink = appearance.colors.ink
  let fill = subject.color
  let text = subject.textColor
  let stroke: string | undefined
  let strokeWidth = 0
  if (style === "soft") {
    fill = mix(body, subject.color, 0.3)
    text = contrastRatio(fill, ink) >= 4.5 ? ink : readableText(fill)
  } else if (style === "outline") {
    fill = body
    text = contrastRatio(fill, ink) >= 4.5 ? ink : readableText(fill)
    stroke = subject.color
    strokeWidth = Math.max(1.5, borderWidth)
  }
  if (style !== "outline" && borderWidth > 0) {
    stroke = borderColor === "auto" ? darken(subject.color, 0.28) : borderColor
    strokeWidth = borderWidth
  }
  const accent = style === "solid" ? darken(subject.color, 0.3) : subject.color
  return { fill, text, stroke, strokeWidth, accent }
}

type BlockTextItem = { role: TextRole; text: string; maxLines: number; opacity?: number; priority: number }

/** Name first, then interval, kind/room and notes. Shrinks to a floor, then drops and truncates from the lowest priority. */
function layoutBlockText(ctx: Ctx, items: BlockTextItem[], box: Rect, align: "start" | "center") {
  const scales = [1, 0.92, 0.84, 0.76]
  const gap = (size: number) => size * 0.22
  const measureAll = (scale: number, lineBudget?: number[]) =>
    items.map((item, index) => {
      const style = ctx.appearance.type[item.role]
      const size = Math.max(6, style.size * scale)
      const maxLines = lineBudget ? lineBudget[index]! : item.maxLines
      const wrapped = maxLines > 0 ? wrap(ctx, item.role, item.text, box.w, maxLines, size) : { lines: [], truncated: true, missing: [] }
      return { item, size, wrapped, height: wrapped.lines.length * size * style.lineHeight }
    })
  const totalHeight = (list: ReturnType<typeof measureAll>) => {
    const visible = list.filter((entry) => entry.wrapped.lines.length)
    return visible.reduce((sum, entry) => sum + entry.height, 0) + visible.slice(1).reduce((sum, entry) => sum + gap(entry.size), 0)
  }

  let chosen: ReturnType<typeof measureAll> | null = null
  for (const scale of scales) {
    const list = measureAll(scale)
    if (totalHeight(list) <= box.h + 0.01 && list.every((entry) => !entry.wrapped.truncated)) {
      chosen = list
      break
    }
  }
  let truncated = false
  if (!chosen) {
    // At the smallest scale, hand out lines by priority until the box is full.
    const scale = scales[scales.length - 1]!
    const natural = measureAll(scale)
    const budget = items.map(() => 0)
    let used = 0
    const order = items.map((item, index) => ({ item, index })).sort((a, b) => a.item.priority - b.item.priority)
    for (const { item, index } of order) {
      const style = ctx.appearance.type[item.role]
      const size = Math.max(6, style.size * scale)
      const lineHeight = size * style.lineHeight
      const extraGap = used > 0 ? gap(size) : 0
      const available = Math.floor((box.h - used - extraGap + 0.01) / lineHeight)
      const wanted = Math.min(item.maxLines, natural[index]!.wrapped.lines.length)
      const lines = Math.max(0, Math.min(wanted, available))
      if (index === 0 && lines === 0) {
        budget[index] = 1
        used += lineHeight
        continue
      }
      budget[index] = lines
      if (lines > 0) used += extraGap + lines * lineHeight
    }
    chosen = measureAll(scale, budget)
    truncated = true
  }
  if (chosen.some((entry) => entry.wrapped.truncated)) truncated = true

  const content = totalHeight(chosen)
  let y = box.y + (ctx.appearance.blocks.align === "center" ? Math.max(0, (box.h - content) / 2) : 0)
  const nodes: { runs: GlyphRun[]; opacity?: number }[] = []
  let first = true
  for (const entry of chosen) {
    if (!entry.wrapped.lines.length) continue
    if (!first) y += gap(entry.size)
    first = false
    const placed = placeLines(ctx, entry.item.role, entry.wrapped, { x: box.x, y, w: box.w }, align, entry.size)
    nodes.push({ runs: placed.runs, opacity: entry.item.opacity })
    y += placed.height
  }
  return { nodes, truncated }
}

export function layoutDocument(doc: ScheduleDocument, resolveFont: FontResolver): Scene {
  const appearance = doc.appearance
  const settings = doc.settings
  const issues: SceneIssue[] = []
  const fonts = {} as Record<TextRole, ResolvedFont>
  const fallbackRoles: string[] = []
  for (const role of Object.keys(appearance.type) as TextRole[]) {
    const resolved = resolveFont(appearance.type[role].font)
    fonts[role] = resolved.font
    if (resolved.fallback) fallbackRoles.push(`${ROLE_NAMES[role]} (${appearance.type[role].font.family})`)
  }
  if (fallbackRoles.length) {
    issues.push({
      level: "error",
      code: "font-unavailable",
      message: `No se pudo cargar la fuente de ${fallbackRoles.join(", ")}. La vista usa DM Sans provisoriamente y la descarga queda bloqueada.`,
    })
  }
  const ctx: Ctx = { doc, appearance, fonts, issues, missing: new Set() }
  const W = settings.page.width
  const H = settings.page.height
  const nodes: SceneNode[] = []
  const { colors, grid: gridStyle, sheet } = appearance

  if (appearance.decorations.accentShapes) {
    nodes.push({ type: "circle", cx: r2(W * 0.88), cy: r2(H * 0.1), r: r2(W * 0.1), fill: colors.accent, opacity: 0.1 })
    nodes.push({ type: "circle", cx: r2(W * 0.1), cy: r2(H * 0.9), r: r2(W * 0.08), fill: colors.accent, opacity: 0.08 })
  }

  const margin = Math.min(appearance.page.margin, W * 0.2, H * 0.2)
  const outer: Rect = { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 }
  let inner = outer
  if (sheet.show) {
    nodes.push({
      type: "rect", x: r2(outer.x), y: r2(outer.y), w: r2(outer.w), h: r2(outer.h), rx: sheet.radius,
      fill: sheet.fill, stroke: sheet.borderWidth > 0 ? sheet.borderColor : undefined, strokeWidth: sheet.borderWidth,
    })
    const pad = Math.min(sheet.padding, outer.w * 0.15, outer.h * 0.15)
    inner = { x: outer.x + pad, y: outer.y + pad, w: outer.w - pad * 2, h: outer.h - pad * 2 }
  }

  // Header
  const align = appearance.header.align
  let cursor = inner.y
  let headerUsed = false
  const title = settings.title.trim()
  if (title) {
    const wrapped = wrap(ctx, "title", title, inner.w, 2)
    if (wrapped.truncated) issues.push({ level: "warning", code: "title-truncated", message: "El título no entra en dos líneas y se cortó." })
    const placed = placeLines(ctx, "title", wrapped, { x: inner.x, y: cursor, w: inner.w }, align, appearance.type.title.size)
    nodes.push({ type: "text", runs: placed.runs, fill: colors.ink })
    cursor += placed.height
    headerUsed = true
  }
  const subtitle = settings.subtitle.trim()
  if (settings.show.subtitle && subtitle) {
    if (headerUsed) cursor += appearance.type.subtitle.size * 0.35
    const wrapped = wrap(ctx, "subtitle", subtitle, inner.w, 2)
    if (wrapped.truncated) issues.push({ level: "warning", code: "title-truncated", message: "El subtítulo no entra en dos líneas y se cortó." })
    const placed = placeLines(ctx, "subtitle", wrapped, { x: inner.x, y: cursor, w: inner.w }, align, appearance.type.subtitle.size)
    nodes.push({ type: "text", runs: placed.runs, fill: colors.muted })
    cursor += placed.height
    headerUsed = true
  }
  if (headerUsed) cursor += appearance.header.gap

  // Legend, measured before the grid so the grid takes what is left.
  const usage = new Set(doc.blocks.map((block) => block.subjectId))
  const legendSubjects = doc.subjects.filter((subject) => usage.has(subject.id))
  let legendNodes: SceneNode[] = []
  let legendHeight = 0
  if (settings.show.legend && legendSubjects.length) {
    const available = inner.y + inner.h - cursor
    for (let attempt = 0; attempt < 4; attempt++) {
      const scale = 1 - attempt * 0.12
      const result = layoutLegend(ctx, legendSubjects, inner, scale)
      if (result.height <= available * 0.42 || attempt === 3) {
        if (result.height > available * 0.42) {
          issues.push({
            level: "error",
            code: "legend-too-large",
            message: "La leyenda no entra en la hoja. Ocultala en Documento › Ajustes o elegí una hoja más grande.",
          })
        } else {
          legendNodes = result.nodes
          legendHeight = result.height
        }
        break
      }
    }
  }
  const legendTop = inner.y + inner.h - legendHeight
  const gridBottom = legendHeight ? legendTop - appearance.header.gap : inner.y + inner.h

  // Grid
  const dayStyle = appearance.type.day
  const hourStyle = appearance.type.hour
  const rangeStart = settings.range.start
  const rangeEnd = settings.range.end
  const hourMarks: number[] = []
  for (let minute = Math.ceil(rangeStart / 60) * 60; minute <= rangeEnd; minute += 60) hourMarks.push(minute)
  if (rangeStart % 60 !== 0) hourMarks.unshift(rangeStart)
  let hourColumn = 0
  if (settings.show.hourLabels) {
    const widest = Math.max(...hourMarks.map((minute) => wrap(ctx, "hour", hourText(minute, gridStyle.hourFormat), 9999, 1).lines[0]?.shaped.width ?? 0))
    hourColumn = widest + hourStyle.size * 0.9
  }
  const headerH = dayStyle.size * dayStyle.lineHeight + dayStyle.size * 1.15
  const gridX = inner.x + hourColumn
  const gridW = Math.max(1, inner.w - hourColumn)
  const headerY = cursor
  const bodyY = headerY + headerH
  let bodyH = gridBottom - bodyY
  const slots = (rangeEnd - rangeStart) / 30
  if (bodyH < Math.max(48, slots * 5)) {
    issues.push({
      level: "error",
      code: "grid-too-small",
      message: "La grilla quedó demasiado baja para el rango horario. Reducí el título o la leyenda, acortá el rango o elegí una hoja más alta.",
    })
    bodyH = Math.max(bodyH, 24)
  }
  const days = settings.days
  const columnGap = days.length > 1 ? gridStyle.columnGap : 0
  const columnW = (gridW - columnGap * (days.length - 1)) / days.length
  const columns = days.map((day, index) => ({ day, x: r2(gridX + index * (columnW + columnGap)), w: r2(columnW) }))
  const grid: SceneGrid = { x: gridX, width: gridW, headerY, headerH, bodyY, bodyH, columns, rangeStart, rangeEnd }
  const yOf = (minute: number) => bodyY + ((minute - rangeStart) * bodyH) / (rangeEnd - rangeStart)
  const lineW = gridStyle.lineWidth
  const halfLine = mix(gridStyle.lineColor, gridStyle.bodyFill, 0.45)

  const drawColumnGrid = (x: number, w: number, children: SceneNode[]) => {
    if (gridStyle.stripes) {
      for (let minute = Math.ceil(rangeStart / 60) * 60; minute < rangeEnd; minute += 60) {
        if ((minute / 60) % 2 === 1) {
          const top = yOf(Math.max(minute, rangeStart))
          const bottom = yOf(Math.min(minute + 60, rangeEnd))
          children.push({ type: "rect", x: r2(x), y: r2(top), w: r2(w), h: r2(bottom - top), fill: gridStyle.stripeColor })
        }
      }
    }
    if (gridStyle.halfHourLines && lineW > 0) {
      for (let minute = Math.ceil(rangeStart / 30) * 30; minute < rangeEnd; minute += 30) {
        if (minute % 60 === 30 && minute > rangeStart) {
          children.push({ type: "line", x1: r2(x), x2: r2(x + w), y1: r2(yOf(minute)), y2: r2(yOf(minute)), stroke: halfLine, width: Math.max(0.5, lineW * 0.75), dash: `${r2(lineW * 3)} ${r2(lineW * 3)}` })
        }
      }
    }
    if (lineW > 0) {
      for (const minute of hourMarks) {
        if (minute <= rangeStart || minute >= rangeEnd || minute % 60 !== 0) continue
        children.push({ type: "line", x1: r2(x), x2: r2(x + w), y1: r2(yOf(minute)), y2: r2(yOf(minute)), stroke: gridStyle.lineColor, width: lineW })
      }
    }
  }

  const radius = gridStyle.radius
  if (columnGap <= 0) {
    const shape = { x: r2(gridX), y: r2(headerY), w: r2(gridW), h: r2(headerH + bodyH), rx: radius }
    nodes.push({ type: "rect", ...shape, fill: gridStyle.bodyFill })
    const inside: SceneNode[] = []
    inside.push({ type: "rect", x: r2(gridX), y: r2(headerY), w: r2(gridW), h: r2(headerH), fill: gridStyle.headerFill })
    drawColumnGrid(gridX, gridW, inside)
    if (lineW > 0) {
      inside.push({ type: "line", x1: r2(gridX), x2: r2(gridX + gridW), y1: r2(bodyY), y2: r2(bodyY), stroke: gridStyle.lineColor, width: lineW })
      columns.slice(1).forEach((column) => {
        inside.push({ type: "line", x1: column.x, x2: column.x, y1: r2(headerY), y2: r2(bodyY + bodyH), stroke: gridStyle.lineColor, width: lineW })
      })
    }
    nodes.push({ type: "group", clip: shape, children: inside })
    if (lineW > 0) nodes.push({ type: "rect", ...shape, stroke: gridStyle.lineColor, strokeWidth: lineW })
  } else {
    for (const column of columns) {
      const shape = { x: column.x, y: r2(headerY), w: column.w, h: r2(headerH + bodyH), rx: radius }
      nodes.push({ type: "rect", ...shape, fill: gridStyle.bodyFill })
      const inside: SceneNode[] = [{ type: "rect", x: column.x, y: r2(headerY), w: column.w, h: r2(headerH), fill: gridStyle.headerFill }]
      drawColumnGrid(column.x, column.w, inside)
      if (lineW > 0) inside.push({ type: "line", x1: column.x, x2: r2(column.x + column.w), y1: r2(bodyY), y2: r2(bodyY), stroke: gridStyle.lineColor, width: lineW })
      nodes.push({ type: "group", clip: shape, children: inside })
      if (lineW > 0) nodes.push({ type: "rect", ...shape, stroke: gridStyle.lineColor, strokeWidth: lineW })
    }
  }

  // Day labels: full name, then short name, then a measured ellipsis.
  const headerInk = contrastRatio(gridStyle.headerFill, colors.ink) >= 3 ? colors.ink : readableText(gridStyle.headerFill)
  for (const column of columns) {
    const info = DAYS.find((day) => day.id === column.day)!
    const pad = dayStyle.size * 0.4
    const width = column.w - pad * 2
    let wrapped = wrap(ctx, "day", info.label, width, 1)
    if (wrapped.truncated) wrapped = wrap(ctx, "day", info.short, width, 1)
    const placed = placeLines(ctx, "day", wrapped, { x: column.x + pad, y: headerY + (headerH - dayStyle.size * dayStyle.lineHeight) / 2, w: width }, "center", dayStyle.size)
    nodes.push({ type: "text", runs: placed.runs, fill: headerInk })
  }

  // Hour labels, centred on their line.
  if (settings.show.hourLabels) {
    const font = fonts.hour
    const { ascent, descent } = verticalMetrics(font, hourStyle.size)
    const runs: GlyphRun[] = []
    for (const minute of hourMarks) {
      const wrapped = wrap(ctx, "hour", hourText(minute, gridStyle.hourFormat), hourColumn, 1)
      const line = wrapped.lines[0]
      if (!line) continue
      const baseline = yOf(minute) + (ascent - descent) / 2
      runs.push({ x: r2(gridX - hourStyle.size * 0.55 - line.shaped.width), baseline: r2(baseline), size: hourStyle.size, glyphs: line.shaped.glyphs })
    }
    nodes.push({ type: "text", runs, fill: colors.muted })
  }

  // Blocks
  const subjects = new Map(doc.subjects.map((subject) => [subject.id, subject]))
  const visibleDays = new Set(days)
  const placeable: Block[] = []
  for (const block of doc.blocks) {
    if (!visibleDays.has(block.day) || block.start < rangeStart || block.end > rangeEnd) {
      const subject = subjects.get(block.subjectId)
      issues.push({
        level: "error",
        code: "out-of-range",
        blockId: block.id,
        message: `${subject?.name ?? "Bloque"} (${DAYS.find((day) => day.id === block.day)?.label}, ${formatMinutes(block.start)}–${formatMinutes(block.end)}) queda fuera de los días u horas visibles.`,
      })
      continue
    }
    placeable.push(block)
  }
  const boxes: BlockBox[] = []
  const blockNodes: SceneNode[] = []
  const inset = appearance.blocks.inset
  for (const column of columns) {
    const dayBlocks = placeable.filter((block) => block.day === column.day)
    const lanes = assignLanes(dayBlocks)
    for (const block of [...dayBlocks].sort(compareBlocks)) {
      const subject = subjects.get(block.subjectId)
      if (!subject) continue
      const { lane, lanes: laneCount } = lanes.get(block.id)!
      const laneGap = laneCount > 1 ? Math.max(2, inset) : 0
      const usable = column.w - inset * 2
      const laneW = (usable - laneGap * (laneCount - 1)) / laneCount
      const top = yOf(block.start)
      const bottom = yOf(block.end)
      const vInset = bottom - top > inset * 3 ? inset / 2 : 0
      const box: BlockBox = {
        blockId: block.id,
        day: block.day,
        lane,
        lanes: laneCount,
        conflict: laneCount > 1,
        x: r2(column.x + inset + lane * (laneW + laneGap)),
        y: r2(top + vInset),
        w: r2(Math.max(1, laneW)),
        h: r2(Math.max(1, bottom - top - vInset * 2)),
      }
      boxes.push(box)
      const paint = blockPaint(subject, appearance)
      const rx = Math.min(appearance.blocks.radius, box.w / 2, box.h / 2)
      const shape = { x: box.x, y: box.y, w: box.w, h: box.h, rx }
      const children: SceneNode[] = [{ type: "rect", ...shape, fill: paint.fill }]
      let accentW = 0
      if (appearance.blocks.showAccentBar) {
        accentW = Math.min(6, Math.max(3, box.w * 0.035))
        children.push({ type: "rect", x: box.x, y: box.y, w: r2(accentW), h: box.h, fill: paint.accent })
      }
      const pad = Math.min(appearance.blocks.padding, box.w * 0.12, box.h * 0.2)
      const textBox: Rect = { x: box.x + pad + accentW, y: box.y + pad, w: box.w - pad * 2 - accentW, h: box.h - pad * 2 }
      const show = settings.show
      const items: BlockTextItem[] = [{ role: "blockTitle", text: subject.name, maxLines: 4, priority: 0 }]
      if (show.blockTimes) items.push({ role: "blockMeta", text: rangeText(block, gridStyle.hourFormat), maxLines: 1, priority: 1 })
      const meta = [show.kind ? block.kind.trim() : "", show.room ? block.room.trim() : ""].filter(Boolean).join(" · ")
      if (meta) items.push({ role: "blockMeta", text: meta, maxLines: 2, priority: 2 })
      if (show.notes && block.notes.trim()) items.push({ role: "blockMeta", text: block.notes.trim(), maxLines: 3, opacity: 0.82, priority: 3 })
      if (textBox.w > 4 && textBox.h > 4) {
        const laid = layoutBlockText(ctx, items, textBox, appearance.blocks.align === "center" ? "center" : "start")
        for (const entry of laid.nodes) children.push({ type: "text", runs: entry.runs, fill: paint.text, opacity: entry.opacity })
        if (laid.truncated) {
          issues.push({
            level: "warning",
            code: "truncated",
            blockId: block.id,
            message: `El texto de ${subject.name} (${DAYS.find((day) => day.id === block.day)?.short} ${formatMinutes(block.start)}) no entra completo.`,
          })
        }
      } else {
        issues.push({ level: "warning", code: "truncated", blockId: block.id, message: `${subject.name} es demasiado pequeño para mostrar texto.` })
      }
      blockNodes.push({ type: "group", clip: shape, children })
      if (paint.stroke && paint.strokeWidth > 0) {
        const half = paint.strokeWidth / 2
        blockNodes.push({
          type: "rect", x: r2(box.x + half), y: r2(box.y + half), w: r2(Math.max(0, box.w - paint.strokeWidth)), h: r2(Math.max(0, box.h - paint.strokeWidth)),
          rx: Math.max(0, rx - half), stroke: paint.stroke, strokeWidth: paint.strokeWidth,
        })
      }
    }
  }
  nodes.push(...blockNodes)

  if (legendNodes.length) {
    nodes.push({ type: "group", children: translateNodes(legendNodes, legendTop) })
  }

  if (ctx.missing.size) {
    issues.push({
      level: "warning",
      code: "missing-glyphs",
      message: `La fuente elegida no tiene ${[...ctx.missing].map((char) => `"${char}"`).join(", ")}. Esos caracteres se ven como recuadros; elegí otra fuente o cambiá el texto.`,
    })
  }

  const hashes = new Set<string>()
  Object.values(fonts).forEach((font) => font.faces.forEach((face) => hashes.add(face.sha256)))
  return {
    width: W,
    height: H,
    background: { from: appearance.page.background, to: appearance.page.backgroundEnd },
    nodes,
    grid,
    blocks: boxes,
    issues,
    fontHashes: [...hashes].sort(),
    title: title || "Horario",
    description: `Horario semanal con ${doc.blocks.length} ${doc.blocks.length === 1 ? "clase" : "clases"} de ${legendSubjects.length} ${legendSubjects.length === 1 ? "materia" : "materias"}.`,
  }
}

function translateNodes(nodes: SceneNode[], dy: number): SceneNode[] {
  return nodes.map((node) => {
    switch (node.type) {
      case "rect":
        return { ...node, y: r2(node.y + dy) }
      case "circle":
        return { ...node, cy: r2(node.cy + dy) }
      case "line":
        return { ...node, y1: r2(node.y1 + dy), y2: r2(node.y2 + dy) }
      case "text":
        return { ...node, runs: node.runs.map((run) => ({ ...run, baseline: r2(run.baseline + dy) })) }
      case "group":
        return { ...node, clip: node.clip ? { ...node.clip, y: r2(node.clip.y + dy) } : undefined, children: translateNodes(node.children, dy) }
      case "path":
        return node
    }
  })
}

/** Legend laid out from y = 0; the caller moves it to the bottom of the sheet. */
function layoutLegend(ctx: Ctx, subjects: Subject[], inner: Rect, scale: number) {
  const { appearance } = ctx
  const style: TextStyle = appearance.type.legend
  const size = style.size * scale
  const font = ctx.fonts.legend
  const nodes: SceneNode[] = []
  let y = 0
  if (appearance.legend.showTitle && appearance.legend.title.trim()) {
    const wrapped = wrapText(ctx.fonts.legend, { ...style, uppercase: true, letterSpacing: Math.max(style.letterSpacing, 0.06) }, appearance.legend.title, inner.w, 1, size * 0.78)
    const placed = placeLines(ctx, "legend", wrapped, { x: inner.x, y, w: inner.w }, appearance.header.align, size * 0.78)
    nodes.push({ type: "text", runs: placed.runs, fill: appearance.colors.muted })
    y += placed.height + size * 0.45
  }
  const chips = appearance.legend.style === "chips"
  const itemH = chips ? size * 2 : size * 1.55
  const padX = chips ? size * 0.75 : 0
  const swatch = chips ? size * 0.66 : size * 0.85
  const gapX = chips ? size * 0.5 : size * 1.4
  const gapY = chips ? size * 0.5 : size * 0.25
  const maxText = inner.w - padX * 2 - swatch - size * 0.5
  const items = subjects.map((subject) => {
    let text = transformLegend(style, subject.name)
    let width = wrapText(font, style, subject.name, 99999, 1, size).lines[0]?.shaped.width ?? 0
    if (width > maxText) {
      text = ellipsize(font, style, size, text, maxText)
      width = wrapText(font, { ...style, uppercase: false }, text, 99999, 1, size).lines[0]?.shaped.width ?? 0
    }
    return { subject, text, w: padX * 2 + swatch + size * 0.5 + width }
  })
  // Rows: chips flow by their own widths; list entries share a column width.
  const columnW = chips ? 0 : Math.min(inner.w, Math.max(...items.map((item) => item.w)))
  const rows: (typeof items)[] = [[]]
  let rowWidth = 0
  for (const item of items) {
    const w = chips ? item.w : columnW
    const row = rows[rows.length - 1]!
    if (row.length && rowWidth + gapX + w > inner.w) {
      rows.push([item])
      rowWidth = w
    } else {
      rowWidth += (row.length ? gapX : 0) + w
      row.push(item)
    }
  }
  const { ascent, descent } = verticalMetrics(font, size)
  for (const row of rows) {
    const total = row.reduce((sum, item) => sum + (chips ? item.w : columnW), 0) + gapX * (row.length - 1)
    let x = appearance.header.align === "center" ? inner.x + (inner.w - total) / 2 : inner.x
    for (const item of row) {
      const w = chips ? item.w : columnW
      if (chips) {
        nodes.push({ type: "rect", x: r2(x), y: r2(y), w: r2(w), h: r2(itemH), rx: r2(itemH / 2), fill: appearance.grid.headerFill, stroke: appearance.grid.lineColor, strokeWidth: Math.min(1, appearance.grid.lineWidth || 1) })
        nodes.push({ type: "circle", cx: r2(x + padX + swatch / 2), cy: r2(y + itemH / 2), r: r2(swatch / 2), fill: item.subject.color, opacity: 1 })
      } else {
        nodes.push({ type: "rect", x: r2(x), y: r2(y + (itemH - swatch) / 2), w: r2(swatch), h: r2(swatch), rx: r2(swatch * 0.22), fill: item.subject.color })
      }
      const line = wrapText(font, { ...style, uppercase: false }, item.text, 99999, 1, size).lines[0]
      if (line) {
        line.shaped.missing.forEach((char) => ctx.missing.add(char))
        nodes.push({
          type: "text",
          fill: chips ? (contrastRatio(appearance.grid.headerFill, appearance.colors.ink) >= 3 ? appearance.colors.ink : readableText(appearance.grid.headerFill)) : appearance.colors.ink,
          runs: [{ x: r2(x + padX + swatch + size * 0.5), baseline: r2(y + itemH / 2 + (ascent - descent) / 2), size, glyphs: line.shaped.glyphs }],
        })
      }
      x += w + gapX
    }
    y += itemH + gapY
  }
  return { nodes, height: y - gapY }
}

function transformLegend(style: TextStyle, text: string) {
  return style.uppercase ? text.toLocaleUpperCase("es") : text
}
