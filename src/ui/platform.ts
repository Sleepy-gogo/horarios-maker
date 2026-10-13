import { useId } from "react"

export const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
export const mod = isMac ? "⌘" : "Ctrl"

export function useFieldId(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, "")}`
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return "hace instantes"
  if (minutes < 60) return `hace ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `hace ${hours} h`
  return new Date(iso).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })
}
