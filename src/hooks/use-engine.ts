import { useSyncExternalStore } from "react"
import { initEngine } from "@/engine/export"

let state: "loading" | "ready" | "error" = "loading"
const listeners = new Set<() => void>()

function start() {
  state = "loading"
  listeners.forEach((listener) => listener())
  initEngine().then(
    () => {
      state = "ready"
      listeners.forEach((listener) => listener())
    },
    () => {
      state = "error"
      listeners.forEach((listener) => listener())
    },
  )
}
start()

export function retryEngine() {
  start()
}

export function useEngineReady() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => state,
  )
}
