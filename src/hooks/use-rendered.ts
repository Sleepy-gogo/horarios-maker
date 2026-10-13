import { useFontsVersion } from "./use-fonts-version"
import type { ScheduleDocument } from "@/domain/types"
import { renderDocument, type Rendered } from "@/engine/render"
import { useEngineReady } from "./use-engine"

/** Scene and SVG for a document, re-rendered when fonts finish loading. Null while the engine or fonts are not ready. */
export function useRendered(doc: ScheduleDocument | null | undefined, idPrefix = "hs"): Rendered | null {
  const engine = useEngineReady()
  const version = useFontsVersion()
  if (!doc || engine !== "ready") return null
  return renderDocument(doc, idPrefix, version)
}
