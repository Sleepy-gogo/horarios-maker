import { loadHarfBuzz } from "@/fonts/service"
import { setSvgHarfBuzz } from "./svg"
import { setHarfBuzz } from "./text"

export const PNG_LIMITS = { maxSide: 8192, maxPixels: 16_000_000 }

let ready: Promise<void> | null = null

/** Loads the shaping engine once; layout and serialization are synchronous afterwards. */
export function initEngine() {
  if (!ready) {
    ready = loadHarfBuzz()
      .then((hb) => {
        setHarfBuzz(hb)
        setSvgHarfBuzz(hb)
      })
      .catch((error) => {
        ready = null
        throw error
      })
  }
  return ready
}

export function pngSize(width: number, height: number, scale: number) {
  const w = Math.round(width * scale)
  const h = Math.round(height * scale)
  const tooLarge = w > PNG_LIMITS.maxSide || h > PNG_LIMITS.maxSide || w * h > PNG_LIMITS.maxPixels
  return { width: w, height: h, tooLarge }
}

export function maxPngScale(width: number, height: number) {
  const bySide = PNG_LIMITS.maxSide / Math.max(width, height)
  const byArea = Math.sqrt(PNG_LIMITS.maxPixels / (width * height))
  return Math.floor(Math.min(bySide, byArea) * 100) / 100
}

/** Rasterizes the exact SVG bytes shown in the studio. Layout and line breaks never change with the scale. */
export async function svgToPng(svg: string, width: number, height: number, scale: number): Promise<Blob> {
  const size = pngSize(width, height, scale)
  if (size.tooLarge) throw new Error(`La imagen superaría el límite de ${PNG_LIMITS.maxSide} px por lado o 16 megapíxeles.`)
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }))
  try {
    const image = new Image()
    image.decoding = "async"
    image.src = url
    await image.decode().catch(() => {
      throw new Error("El navegador no pudo leer el SVG generado.")
    })
    const canvas = document.createElement("canvas")
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("El navegador no pudo crear el lienzo para el PNG.")
    context.drawImage(image, 0, 0, size.width, size.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
    if (!blob) throw new Error("El navegador no pudo generar el PNG; probá con una escala menor.")
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}
