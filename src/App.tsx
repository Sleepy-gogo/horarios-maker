import { useCallback, useId, useRef } from "react"
import { toast } from "sonner"

import "./App.css"
import { Toaster } from "@/components/ui/sonner"
import { StudioHeader } from "@/features/schedule/components/studio-header"
import { SchedulePreview } from "@/features/schedule/components/schedule-preview"
import { StudioSidebar } from "@/features/schedule/components/studio-sidebar"
import { useScheduleStudio } from "@/features/schedule/use-schedule-studio"
import { downloadBlob, sanitizeState } from "@/features/schedule/utils"
import type { AppState } from "@/features/schedule/types"

function App() {
  const titleId = useId()
  const svgRef = useRef<SVGSVGElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const {
    state,
    settings,
    items,
    frame,
    theme,
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
  } = useScheduleStudio()

  const setAction = useCallback(
    (message: string, variant: "success" | "error" | "info" = "success") => {
      setLastAction(message)

      if (variant === "error") {
        toast.error(message)
        return
      }

      if (variant === "info") {
        toast(message)
        return
      }

      toast.success(message)
    },
    [setLastAction],
  )

  const handleReset = useCallback(() => {
    resetSchedule()
    setAction("Horario reiniciado")
  }, [resetSchedule, setAction])

  const handleExportJson = useCallback(() => {
    const json = JSON.stringify(state, null, 2)
    const blob = new Blob([json], { type: "application/json;charset=utf-8" })
    downloadBlob(blob, "horario.json")
    setAction("JSON exportado")
  }, [setAction, state])

  const handleOpenImport = useCallback(() => {
    importInputRef.current?.click()
  }, [])

  const handleImportJson = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ""
      if (!file) return

      try {
        const raw = await file.text()
        const parsed = sanitizeState(JSON.parse(raw) as AppState)
        replaceState(parsed)
        setAction("JSON importado")
      } catch {
        setAction("Archivo JSON inválido", "error")
      }
    },
    [replaceState, setAction],
  )

  const handleDownloadPng = useCallback(async () => {
    if (!svgRef.current) return

    const markup = new XMLSerializer().serializeToString(svgRef.current)
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.decoding = "async"

    try {
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve()
        image.onerror = () => reject(new Error("SVG load failed"))
        image.src = url
      })

      const canvas = document.createElement("canvas")
      canvas.width = frame.width * 2
      canvas.height = frame.height * 2

      const context = canvas.getContext("2d")
      if (!context) throw new Error("Canvas unavailable")

      context.scale(2, 2)
      context.drawImage(image, 0, 0, frame.width, frame.height)

      const pngBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1),
      )

      if (!pngBlob) throw new Error("PNG failed")

      downloadBlob(pngBlob, "horario.png")
      setAction("PNG descargado")
    } catch {
      setAction("Error al generar PNG", "error")
    } finally {
      URL.revokeObjectURL(url)
    }
  }, [frame.height, frame.width, setAction])

  return (
    <>
      <input
        ref={importInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={handleImportJson}
      />

      <StudioHeader
        status={lastAction}
        onReset={handleReset}
        onImport={handleOpenImport}
        onExport={handleExportJson}
        onDownload={handleDownloadPng}
      />

      <div className="studio">
        <StudioSidebar
          titleId={titleId}
          items={items}
          settings={settings}
          onUpdateSettings={updateSettings}
          onUpdateItem={updateItem}
          onAddItem={addItem}
          onRemoveItem={removeItem}
        />
        <SchedulePreview
          svgRef={svgRef}
          frame={frame}
          settings={settings}
          items={items}
          theme={theme}
          timeline={timeline}
          densityFactor={densityFactor}
        />
      </div>

      <Toaster position="top-right" richColors closeButton />
    </>
  )
}

export default App
