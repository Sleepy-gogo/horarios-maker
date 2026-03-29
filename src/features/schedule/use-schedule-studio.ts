import { useCallback, useEffect, useState } from "react"

import {
  DEFAULT_STATE,
  type AppState,
  type ScheduleItem,
  type ScheduleSettings,
} from "@/features/schedule/types"
import {
  createEmptyItem,
  getFrame,
  getLegend,
  getTheme,
  getTimelineMetrics,
  loadInitialState,
  persistState,
  sanitizeItem,
  sortItems,
} from "@/features/schedule/utils"

function getInitialStatus() {
  const url = new URL(window.location.href)
  return url.searchParams.has("s") ? "Horario cargado desde enlace" : "Listo"
}

export function useScheduleStudio() {
  const [state, setState] = useState<AppState>(loadInitialState)
  const [lastAction, setLastAction] = useState(getInitialStatus)

  useEffect(() => {
    persistState(state)
  }, [state])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has("s")) return

    url.searchParams.delete("s")
    window.history.replaceState(null, "", url)
  }, [])

  const updateSettings = useCallback(
    <Key extends keyof ScheduleSettings>(key: Key, value: ScheduleSettings[Key]) => {
      setState((current) => ({
        ...current,
        settings: { ...current.settings, [key]: value },
      }))
    },
    [],
  )

  const updateItem = useCallback(
    <Key extends keyof ScheduleItem>(id: string, key: Key, value: ScheduleItem[Key]) => {
      setState((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === id ? sanitizeItem({ ...item, [key]: value }) : item,
        ),
      }))
    },
    [],
  )

  const addItem = useCallback(() => {
    setState((current) => ({
      ...current,
      items: sortItems([...current.items, createEmptyItem()]),
    }))
  }, [])

  const removeItem = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }))
  }, [])

  const replaceState = useCallback((next: AppState) => {
    setState(next)
  }, [])

  const resetSchedule = useCallback(() => {
    setState(DEFAULT_STATE)
  }, [])

  const settings = state.settings
  const items = sortItems(state.items)
  const frame = getFrame(settings.aspectRatio)
  const theme = getTheme(settings.theme)
  const legend = getLegend(items)
  const densityFactor =
    settings.density === "aireado" ? 1.12 : settings.density === "compacto" ? 0.88 : 1
  const timeline = getTimelineMetrics(items, settings)

  return {
    state,
    settings,
    items,
    frame,
    theme,
    legend,
    timeline,
    densityFactor,
    lastAction,
    setLastAction,
    updateSettings,
    updateItem,
    addItem,
    removeItem,
    replaceState,
    resetSchedule,
  }
}
