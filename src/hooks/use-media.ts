import { useSyncExternalStore } from "react"

export function useMedia(query: string) {
  return useSyncExternalStore(
    (listener) => {
      const list = window.matchMedia(query)
      list.addEventListener("change", listener)
      return () => list.removeEventListener("change", listener)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Layout tiers: phone (sheets), tablet (library + floating inspector), desktop (three columns). */
export function useLayoutTier() {
  const desktop = useMedia("(min-width: 1180px)")
  const tablet = useMedia("(min-width: 768px)")
  return desktop ? "desktop" : tablet ? "tablet" : "phone"
}
export type LayoutTier = ReturnType<typeof useLayoutTier>
