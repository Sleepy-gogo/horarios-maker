import { useSyncExternalStore } from "react"
import { fontsVersion, subscribeFonts } from "@/fonts/service"

/** Changes whenever a font starts, finishes or fails loading. Pass it to font-dependent calls so memoization sees it. */
export function useFontsVersion() {
  return useSyncExternalStore(subscribeFonts, fontsVersion, fontsVersion)
}
