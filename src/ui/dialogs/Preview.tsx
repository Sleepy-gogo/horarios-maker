import { cn } from "@/lib/utils"

/** Shows the exact bytes that will be downloaded, isolated in an image so ids never clash with the canvas. */
export function Preview({ svg, width, height, className }: { svg: string; width: number; height: number; className?: string }) {
  const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  return (
    <div className={cn("canvas-viewport grid h-56 place-items-center overflow-hidden rounded-xl border border-border p-3 sm:h-full sm:min-h-72", className)}>
      <img src={src} alt="Vista previa del archivo" className="max-h-full max-w-full shadow-md" style={{ aspectRatio: `${width} / ${height}` }} />
    </div>
  )
}
