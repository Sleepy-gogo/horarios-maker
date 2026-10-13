import type { FaceHandle, ResolvedFont } from "@/fonts/service"
import type { TextStyle } from "@/domain/types"

export type PlacedGlyph = { face: FaceHandle; gid: number; x: number; y: number }

export type ShapedText = { glyphs: PlacedGlyph[]; width: number; missing: string[] }

export type TextLine = { text: string; shaped: ShapedText }

export type WrappedText = { lines: TextLine[]; truncated: boolean; missing: string[] }

const cache = new Map<string, ShapedText>()
const ELLIPSIS = "…"

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("es", { granularity: "grapheme" }) : null

export function graphemes(text: string): string[] {
  if (segmenter) return Array.from(segmenter.segment(text), (part) => part.segment)
  return Array.from(text)
}

const INHERIT = /[\p{M}\p{Cf}\s]/u

function faceFor(font: ResolvedFont, codePoint: number) {
  for (let index = 0; index < font.faces.length; index++) {
    if (font.faces[index]!.font.nominalGlyph(codePoint) !== undefined) return index
  }
  return -1
}

type HBModule = typeof import("harfbuzzjs")

let hb: HBModule | null = null

export function setHarfBuzz(module: HBModule) {
  hb = module
}

/**
 * Shapes one line with HarfBuzz. Characters missing in the primary file use the family's other subsets; characters missing
 * everywhere are reported and drawn with the primary .notdef glyph, never with another family.
 */
export function shapeText(font: ResolvedFont, text: string, size: number, tracking: number): ShapedText {
  const key = `${font.refKey}|${size}|${tracking}|${text}`
  const cached = cache.get(key)
  if (cached) return cached
  if (!hb) throw new Error("HarfBuzz no está listo")

  // Split the text into runs that share a face.
  const runs: { face: number; text: string }[] = []
  const missing: string[] = []
  let current = -2
  for (const char of text) {
    const codePoint = char.codePointAt(0)!
    let face = INHERIT.test(char) && current >= 0 ? current : faceFor(font, codePoint)
    if (face < 0) {
      if (!INHERIT.test(char) && !missing.includes(char)) missing.push(char)
      face = 0
    }
    if (face !== current || !runs.length) {
      runs.push({ face, text: char })
      current = face
    } else {
      runs[runs.length - 1]!.text += char
    }
  }

  const glyphs: PlacedGlyph[] = []
  const spacing = tracking * size
  let pen = 0
  for (const run of runs) {
    const face = font.faces[run.face]!
    const scale = size / face.upem
    const buffer = new hb.Buffer()
    buffer.addText(run.text)
    buffer.guessSegmentProperties()
    buffer.setLanguage("es")
    hb.shape(face.font, buffer)
    const infos = buffer.getGlyphInfos()
    const positions = buffer.getGlyphPositions()
    for (let index = 0; index < infos.length; index++) {
      const position = positions[index]!
      glyphs.push({ face, gid: infos[index]!.codepoint, x: pen + position.xOffset * scale, y: -position.yOffset * scale })
      pen += position.xAdvance * scale
      if (position.xAdvance !== 0) pen += spacing
    }
  }
  const width = Math.max(0, glyphs.length ? pen - spacing : 0)
  const shaped = { glyphs, width, missing }
  if (cache.size > 6000) cache.clear()
  cache.set(key, shaped)
  return shaped
}

export function transformText(style: TextStyle, text: string) {
  return style.uppercase ? text.toLocaleUpperCase("es") : text
}

export function measure(font: ResolvedFont, style: TextStyle, text: string, size = style.size) {
  return shapeText(font, text, size, style.letterSpacing).width
}

type Token = { text: string; space: boolean }

function tokenize(paragraph: string): Token[] {
  const tokens: Token[] = []
  const re = /(\s*)([^\s\-/–]+[-/–]?|[-/–])/g
  let match: RegExpExecArray | null
  while ((match = re.exec(paragraph))) tokens.push({ text: match[2]!, space: match[1]!.length > 0 && tokens.length > 0 })
  return tokens
}

function fitPrefix(font: ResolvedFont, style: TextStyle, size: number, parts: string[], maxWidth: number, suffix = "") {
  // Largest number of graphemes whose text (plus suffix) fits, by binary search.
  let lo = 0
  let hi = parts.length
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    const candidate = parts.slice(0, mid).join("").trimEnd() + suffix
    if (shapeText(font, candidate, size, style.letterSpacing).width <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return lo
}

function ellipsisFor(font: ResolvedFont) {
  return font.faces[0]!.font.nominalGlyph(0x2026) !== undefined ? ELLIPSIS : "..."
}

/** Ends a line with a measured ellipsis that fits the width. */
export function ellipsize(font: ResolvedFont, style: TextStyle, size: number, text: string, maxWidth: number): string {
  const mark = ellipsisFor(font)
  const parts = graphemes(text)
  const count = fitPrefix(font, style, size, parts, maxWidth, mark)
  if (count === 0) {
    return shapeText(font, mark, size, style.letterSpacing).width <= maxWidth ? mark : ""
  }
  return parts.slice(0, count).join("").trimEnd() + mark
}

/**
 * Greedy line breaking at spaces and after hyphens or slashes. A word longer than the width breaks between graphemes. Lines
 * beyond `maxLines` are dropped and the last kept line ends with a measured ellipsis.
 */
export function wrapText(font: ResolvedFont, style: TextStyle, rawText: string, maxWidth: number, maxLines: number, size = style.size): WrappedText {
  const text = transformText(style, rawText)
  const width = Math.max(1, maxWidth)
  const measureLine = (value: string) => shapeText(font, value, size, style.letterSpacing).width
  const lines: string[] = []
  let overflow = false
  for (const paragraph of text.split(/\r?\n/)) {
    const tokens = tokenize(paragraph)
    let current = ""
    for (const token of tokens) {
      const candidate = current ? current + (token.space ? " " : "") + token.text : token.text
      if (measureLine(candidate) <= width) {
        current = candidate
        continue
      }
      if (current) {
        lines.push(current)
        current = ""
      }
      if (measureLine(token.text) <= width) {
        current = token.text
        continue
      }
      // Break an overlong word between graphemes.
      let rest = graphemes(token.text)
      while (rest.length) {
        const count = Math.max(1, fitPrefix(font, style, size, rest, width))
        const piece = rest.slice(0, count).join("")
        rest = rest.slice(count)
        if (rest.length) lines.push(piece)
        else current = piece
      }
    }
    if (current || !tokens.length) lines.push(current)
    if (lines.length > maxLines) {
      overflow = true
      break
    }
  }
  while (lines.length && !lines[lines.length - 1]!.trim() && lines.length > 1) lines.pop()
  let kept = lines
  let truncated = false
  if (lines.length > maxLines || overflow) {
    truncated = lines.length > maxLines || overflow
    kept = lines.slice(0, Math.max(0, maxLines))
    if (kept.length) {
      const last = kept.length - 1
      const remainder = lines.slice(last).join(" ")
      kept[last] = ellipsize(font, style, size, remainder, width)
    }
  }
  // A single line wider than the box (e.g. when maxLines is 1 for a long token) is ellipsized too.
  kept = kept.map((line) => {
    if (measureLine(line) <= width + 0.01) return line
    truncated = true
    return ellipsize(font, style, size, line, width)
  })
  const missing = new Set<string>()
  const result = kept.map((line) => {
    const shaped = shapeText(font, line, size, style.letterSpacing)
    shaped.missing.forEach((char) => missing.add(char))
    return { text: line, shaped }
  })
  return { lines: result, truncated, missing: [...missing] }
}

/** Ascent and descent for placing baselines, from the primary face's horizontal metrics. */
export function verticalMetrics(font: ResolvedFont, size: number) {
  const face = font.faces[0]!
  const scale = size / face.upem
  return { ascent: face.ascender * scale, descent: face.descender * scale }
}
