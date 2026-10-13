import { toast } from "sonner"
import { downloadBlob, slugify } from "@/domain/files"
import type { ScheduleDocument } from "@/domain/types"
import { svgToPng } from "@/engine/export"
import { renderDocument } from "@/engine/render"
import { exportBlockers } from "@/engine/scene"
import { useEditor } from "@/state/editor"
import { announce } from "@/state/notices"
import { currentDoc, useStudio } from "@/state/studio"

export type ImageFormat = "png" | "svg"

export function exportFileName(doc: ScheduleDocument, extension: string) {
  return `${slugify(doc.settings.title)}.${extension}`
}

/** Downloads the exact SVG the studio shows, or its rasterization. Refuses when the scene has blocking issues. */
export async function downloadImage(doc: ScheduleDocument, format: ImageFormat, scale = 2, fileName?: string) {
  const rendered = renderDocument(doc)
  if (!rendered) throw new Error("Las fuentes del documento todavía se están cargando.")
  const blockers = exportBlockers(rendered.scene)
  if (blockers.length) throw new Error(blockers[0]!.message)
  const name = fileName ?? exportFileName(doc, format)
  if (format === "svg") {
    downloadBlob(new Blob([rendered.svg], { type: "image/svg+xml;charset=utf-8" }), name)
  } else {
    const blob = await svgToPng(rendered.svg, rendered.scene.width, rendered.scene.height, scale)
    downloadBlob(blob, name)
  }
  announce(`${format.toUpperCase()} descargado`)
}

/** One-click export from the top bar. Anything that needs a decision (issues, loading fonts) opens the export dialog instead. */
export function quickExport(format: ImageFormat) {
  const doc = currentDoc()
  if (!doc) return
  const rendered = renderDocument(doc)
  if (!rendered || rendered.scene.issues.length) {
    useEditor.getState().openDialog("export", { format })
    return
  }
  const scale = format === "png" ? useStudio.getState().prefs.pngScale : 1
  void downloadImage(doc, format, scale).then(
    () => toast.success(`Descargaste ${exportFileName(doc, format)}`),
    (error: unknown) => toast.error("No se pudo exportar", { description: error instanceof Error ? error.message : undefined }),
  )
}
