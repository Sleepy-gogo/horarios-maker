import { svgPaint } from "@/domain/color"
import { glyphPath, type FaceHandle } from "@/fonts/service"
import type { Scene, SceneNode } from "./scene"

type HB = typeof import("harfbuzzjs")

let hb: HB | null = null

export function setSvgHarfBuzz(module: HB) {
  hb = module
}

function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

const n = (value: number) => String(Math.round(value * 100) / 100)

function paintAttrs(name: "fill" | "stroke", value: string | undefined) {
  if (!value) return name === "fill" ? ` fill="none"` : ""
  const { color, opacity } = svgPaint(value)
  return ` ${name}="${color}"${opacity < 1 ? ` ${name}-opacity="${opacity}"` : ""}`
}

/**
 * The only graphic representation of a document. The studio shows this string and the SVG/PNG downloads use the very same
 * bytes, so composition, glyphs and colors cannot drift between view and file. Text is drawn as glyph outlines; no fonts,
 * CSS, network resources or editor controls are referenced.
 */
export function sceneToSvg(scene: Scene, idPrefix = "hs"): string {
  if (!hb) throw new Error("HarfBuzz no está listo")
  const defs: string[] = []
  const glyphIds = new Map<string, string>()
  let clipCount = 0

  const glyphRef = (face: FaceHandle, gid: number) => {
    const key = `${face.key}-${gid}`
    let id = glyphIds.get(key)
    if (!id) {
      id = `${idPrefix}-g${glyphIds.size}`
      glyphIds.set(key, id)
      const d = glyphPath(face, gid, hb!)
      defs.push(`<path id="${id}" d="${d}"/>`)
    }
    return id
  }

  const render = (node: SceneNode): string => {
    switch (node.type) {
      case "rect": {
        const rx = node.rx ? ` rx="${n(node.rx)}"` : ""
        const stroke = node.stroke && node.strokeWidth ? `${paintAttrs("stroke", node.stroke)} stroke-width="${n(node.strokeWidth)}"` : ""
        return `<rect x="${n(node.x)}" y="${n(node.y)}" width="${n(Math.max(0, node.w))}" height="${n(Math.max(0, node.h))}"${rx}${paintAttrs("fill", node.fill)}${stroke}/>`
      }
      case "path": {
        const stroke = node.stroke && node.strokeWidth ? `${paintAttrs("stroke", node.stroke)} stroke-width="${n(node.strokeWidth)}"` : ""
        return `<path d="${node.d}"${paintAttrs("fill", node.fill)}${stroke}/>`
      }
      case "line": {
        const dash = node.dash ? ` stroke-dasharray="${node.dash}"` : ""
        return `<line x1="${n(node.x1)}" y1="${n(node.y1)}" x2="${n(node.x2)}" y2="${n(node.y2)}"${paintAttrs("stroke", node.stroke)} stroke-width="${n(node.width)}"${dash}/>`
      }
      case "circle":
        return `<circle cx="${n(node.cx)}" cy="${n(node.cy)}" r="${n(node.r)}"${paintAttrs("fill", node.fill)}${node.opacity < 1 ? ` opacity="${node.opacity}"` : ""}/>`
      case "text": {
        const parts: string[] = []
        for (const run of node.runs) {
          // One group per run and face: glyph offsets in font units under a single transform.
          const byFace = new Map<FaceHandle, string[]>()
          for (const glyph of run.glyphs) {
            const scale = run.size / glyph.face.upem
            const id = glyphRef(glyph.face, glyph.gid)
            const list = byFace.get(glyph.face) ?? []
            const gx = Math.round((glyph.x / scale) * 10) / 10
            const gy = Math.round((-glyph.y / scale) * 10) / 10
            list.push(`<use xlink:href="#${id}" x="${gx}"${gy ? ` y="${gy}"` : ""}/>`)
            byFace.set(glyph.face, list)
          }
          for (const [face, uses] of byFace) {
            const scale = Math.round((run.size / face.upem) * 1e6) / 1e6
            parts.push(`<g transform="matrix(${scale} 0 0 ${-scale} ${n(run.x)} ${n(run.baseline)})">${uses.join("")}</g>`)
          }
        }
        if (!parts.length) return ""
        const opacity = node.opacity !== undefined && node.opacity < 1 ? ` opacity="${node.opacity}"` : ""
        return `<g${paintAttrs("fill", node.fill)}${opacity}>${parts.join("")}</g>`
      }
      case "group": {
        const inner = node.children.map(render).join("")
        if (!node.clip) return `<g>${inner}</g>`
        const id = `${idPrefix}-c${clipCount++}`
        const clip = node.clip
        defs.push(`<clipPath id="${id}"><rect x="${n(clip.x)}" y="${n(clip.y)}" width="${n(clip.w)}" height="${n(clip.h)}"${clip.rx ? ` rx="${n(clip.rx)}"` : ""}/></clipPath>`)
        return `<g clip-path="url(#${id})">${inner}</g>`
      }
    }
  }

  const body = scene.nodes.map(render).join("")
  let background: string
  if (scene.background.to) {
    const from = svgPaint(scene.background.from)
    const to = svgPaint(scene.background.to)
    defs.unshift(
      `<linearGradient id="${idPrefix}-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from.color}"${from.opacity < 1 ? ` stop-opacity="${from.opacity}"` : ""}/><stop offset="1" stop-color="${to.color}"${to.opacity < 1 ? ` stop-opacity="${to.opacity}"` : ""}/></linearGradient>`,
    )
    background = `<rect width="${scene.width}" height="${scene.height}" fill="url(#${idPrefix}-bg)"/>`
  } else {
    background = `<rect width="${scene.width}" height="${scene.height}"${paintAttrs("fill", scene.background.from)}/>`
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}">` +
    `<title>${esc(scene.title)}</title><desc>${esc(scene.description)}</desc>` +
    `<defs>${defs.join("")}</defs>` +
    background +
    body +
    `</svg>`
  )
}
