import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import type { Rendered } from "@/engine/render"
import { cn } from "@/lib/utils"

/** Shows the exact bytes that will be downloaded, isolated in an image so ids never clash with the canvas. */
export function Preview({ svg, width, height, className }: { svg: string; width: number; height: number; className?: string }) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return (
    <div className={cn("relative min-h-0", className)}>
      <div className="absolute inset-0 grid place-items-center">
        <img src={src} alt="Vista previa del documento" className="max-h-full max-w-full rounded-[2px] shadow-[0_0_0_1px_rgb(0_0_0/0.04),0_2px_6px_rgb(0_0_0/0.06),0_14px_40px_rgb(0_0_0/0.14)]" style={{ aspectRatio: `${width} / ${height}` }} />
      </div>
    </div>
  )
}

/** The document stage of split dialogs: the canvas backdrop, the page centered on it, and a short caption. */
export function PreviewPane({ rendered, caption, className, children }: { rendered: Rendered | null; caption?: ReactNode; className?: string; children?: ReactNode }) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col gap-3 bg-canvas p-6", className)}>
      {rendered ? (
        <Preview svg={rendered.svg} width={rendered.scene.width} height={rendered.scene.height} className="flex-1" />
      ) : (
        <div className="grid flex-1 place-items-center text-sm text-muted-foreground" role="status">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Preparando la vista previa…
          </span>
        </div>
      )}
      {caption || children ? (
        <div className="grid shrink-0 gap-2 text-center text-xs text-muted-foreground">
          {caption ? <p>{caption}</p> : null}
          {children}
        </div>
      ) : null}
    </div>
  )
}
