import { useEffect } from "react"
import { useStudio } from "@/state/studio"
import { useMedia } from "./use-media"

/** Interface appearance only. Document themes travel with each project and never follow this preference. */
export function useUiTheme() {
  const preference = useStudio((state) => state.prefs.uiTheme)
  const systemDark = useMedia("(prefers-color-scheme: dark)")
  const dark = preference === "dark" || (preference === "system" && systemDark)
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", dark)
    root.classList.toggle("light", !dark)
    root.dataset.theme = dark ? "dark" : "light"
  }, [dark])
  return dark ? "dark" : "light"
}
