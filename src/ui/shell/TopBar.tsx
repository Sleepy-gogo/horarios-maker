import { Download, FileJson, Image as ImageIcon, Redo2, Undo2 } from "lucide-react"
import { InlineEdit } from "@/components/arc/inline-edit/inline-edit"
import { SplitButton } from "@/components/arc/split-button/split-button"
import { TEXT_LIMITS } from "@/domain/constants"
import { useLayoutTier } from "@/hooks/use-media"
import { useEditor } from "@/state/editor"
import { commit, useStudio } from "@/state/studio"
import { IconButton } from "../common"
import { mod } from "../platform"
import { quickExport } from "../exporter"
import { CompactMenu, MenuBar } from "./MenuBar"
import { SaveStatus } from "./SaveStatus"

export function TopBar() {
  const tier = useLayoutTier()
  const doc = useStudio((state) => state.session?.doc)
  const canUndo = useStudio((state) => !!state.session?.past.length)
  const canRedo = useStudio((state) => !!state.session?.future.length)
  const undoLabel = useStudio((state) => state.session?.past.at(-1)?.label)
  const redoLabel = useStudio((state) => state.session?.future[0]?.label)
  const phone = tier === "phone"

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border bg-[var(--chrome-bg,var(--background))] px-2 sm:gap-2 sm:px-3">
      {tier !== "desktop" ? (
        <CompactMenu />
      ) : (
        <MenuBar />
      )}
      <div className="mx-1 h-5 w-px shrink-0 bg-border max-sm:hidden" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {doc ? (
          <InlineEdit
            key={doc.id}
            variant="compact"
            label="Título del documento"
            value={doc.settings.title}
            placeholder="Sin título"
            validate={(next) => (next.trim().length > TEXT_LIMITS.title ? `Máximo ${TEXT_LIMITS.title} caracteres` : null)}
            onSave={(next) => {
              commit("Cambiar título", (current) => ({ ...current, settings: { ...current.settings, title: next.trim() } }))
            }}
            className="max-w-full"
          />
        ) : (
          <span className="truncate text-sm text-muted-foreground">Sin proyecto abierto</span>
        )}
      </div>
      {doc ? (
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
          <SaveStatus compact={phone} />
          {!phone ? (
            <>
              <IconButton label={undoLabel ? `Deshacer: ${undoLabel}` : "Deshacer"} shortcut={`${mod}Z`} disabled={!canUndo} onClick={() => useStudio.getState().undo()}>
                <Undo2 />
              </IconButton>
              <IconButton label={redoLabel ? `Rehacer: ${redoLabel}` : "Rehacer"} shortcut={`${mod}⇧Z`} disabled={!canRedo} onClick={() => useStudio.getState().redo()}>
                <Redo2 />
              </IconButton>
            </>
          ) : null}
          {phone ? (
            <IconButton label="Exportar" variant="default" onClick={() => useEditor.getState().openDialog("export")}>
              <Download />
            </IconButton>
          ) : (
            <div className="ml-1">
              <SplitButton
                label="Exportar"
                icon={<Download size={16} aria-hidden="true" />}
                onClick={() => useEditor.getState().openDialog("export")}
                actions={[
                  { label: "Descargar PNG", icon: <ImageIcon size={16} aria-hidden="true" />, onSelect: () => quickExport("png") },
                  { label: "Descargar SVG", icon: <ImageIcon size={16} aria-hidden="true" />, onSelect: () => quickExport("svg") },
                  { label: "Proyecto editable (JSON)", icon: <FileJson size={16} aria-hidden="true" />, onSelect: () => useStudio.getState().downloadProject() },
                ]}
              />
            </div>
          )}
        </div>
      ) : null}
    </header>
  )
}
