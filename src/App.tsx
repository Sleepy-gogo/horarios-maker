import { Suspense, lazy, useEffect } from "react"
import { Loader2, PanelLeftOpen, PanelRightOpen } from "lucide-react"
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet"
import { Toaster } from "@/components/ui/sonner"
import type { ScheduleDocument } from "@/domain/types"
import { useLayoutTier } from "@/hooks/use-media"
import { useUiTheme } from "@/hooks/use-ui-theme"
import { useEditor } from "@/state/editor"
import { useAnnouncer } from "@/state/notices"
import { useStudio } from "@/state/studio"
import { Workspace } from "@/ui/canvas/Workspace"
import { IconButton } from "@/ui/common"
import { AboutDialog, BlockFormDialog, CommandDialog, DeleteSubjectDialog, ShortcutsDialog, SubjectDialog } from "@/ui/dialogs/MiscDialogs"
import { NewProjectDialog, SettingsDialog } from "@/ui/dialogs/ProjectDialog"
import { ProjectsDialog } from "@/ui/dialogs/ProjectsDialog"
import { Inspector } from "@/ui/panels/Inspector"
import { LibraryPanel } from "@/ui/panels/LibraryPanel"
import { Notices } from "@/ui/shell/Notices"
import { TopBar } from "@/ui/shell/TopBar"
import { Welcome } from "@/ui/shell/Welcome"
import { useShortcuts } from "@/ui/shortcuts"

function LiveRegion() {
  const message = useAnnouncer((state) => state.message)
  const seq = useAnnouncer((state) => state.seq)
  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      <span key={seq}>{message}</span>
    </div>
  )
}

// The heaviest dialogs (font catalog, export previews, import parsing) load in their own chunks, fetched right after the shell.
const AppearanceDialog = lazy(() => import("@/ui/dialogs/AppearanceDialog").then((module) => ({ default: module.AppearanceDialog })))
const ExportDialog = lazy(() => import("@/ui/dialogs/ExportDialog").then((module) => ({ default: module.ExportDialog })))
const ImportDialog = lazy(() => import("@/ui/dialogs/ImportDialog").then((module) => ({ default: module.ImportDialog })))

function Dialogs() {
  return (
    <Suspense fallback={null}>
      <NewProjectDialog />
      <SettingsDialog />
      <ProjectsDialog />
      <ImportDialog />
      <ExportDialog />
      <AppearanceDialog />
      <SubjectDialog />
      <DeleteSubjectDialog />
      <BlockFormDialog />
      <ShortcutsDialog />
      <AboutDialog />
      <CommandDialog />
    </Suspense>
  )
}

function Studio({ doc }: { doc: ScheduleDocument }) {
  const tier = useLayoutTier()
  const libraryOpen = useStudio((state) => state.prefs.libraryOpen)
  const inspectorOpen = useStudio((state) => state.prefs.inspectorOpen)
  const mobileSheet = useEditor((state) => state.mobileSheet)
  const setPrefs = useStudio((state) => state.setPrefs)
  const closeSheet = () => useEditor.getState().set({ mobileSheet: null })
  const phone = tier === "phone"
  const desktop = tier === "desktop"
  const showLibrary = !phone && libraryOpen
  const showInspector = desktop && inspectorOpen

  // Sheets belong to small screens; growing the window closes them so they never cover the side panels.
  useEffect(() => {
    if (desktop && useEditor.getState().mobileSheet) useEditor.getState().set({ mobileSheet: null })
  }, [desktop])

  return (
    <>
      <div className="flex min-h-0 flex-1">
        {showLibrary ? (
          <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-background xl:w-72" aria-label="Materias y clases">
            <LibraryPanel doc={doc} className="min-h-0 flex-1" />
            <div className="flex shrink-0 justify-end border-t border-border p-1">
              <IconButton label="Ocultar panel de materias" size="icon-sm" side="right" onClick={() => setPrefs({ libraryOpen: false })}>
                <PanelLeftOpen className="rotate-180" />
              </IconButton>
            </div>
          </aside>
        ) : !phone ? (
          <div className="flex w-10 shrink-0 flex-col items-center border-r border-border bg-background py-2">
            <IconButton label="Mostrar panel de materias" size="icon-sm" side="right" onClick={() => setPrefs({ libraryOpen: true })}>
              <PanelLeftOpen />
            </IconButton>
          </div>
        ) : null}
        <Workspace doc={doc} />
        {showInspector ? (
          <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-background" aria-label="Propiedades">
            <Inspector doc={doc} className="flex-1" />
            <div className="flex shrink-0 border-t border-border p-1">
              <IconButton label="Ocultar panel de propiedades" size="icon-sm" side="left" onClick={() => setPrefs({ inspectorOpen: false })}>
                <PanelRightOpen className="rotate-180" />
              </IconButton>
            </div>
          </aside>
        ) : desktop ? (
          <div className="flex w-10 shrink-0 flex-col items-center border-l border-border bg-background py-2">
            <IconButton label="Mostrar panel de propiedades" size="icon-sm" side="left" onClick={() => setPrefs({ inspectorOpen: true })}>
              <PanelRightOpen />
            </IconButton>
          </div>
        ) : null}
      </div>
      {!desktop ? (
        <>
          <BottomSheet open={mobileSheet === "library"} onOpenChange={(open) => !open && closeSheet()} title="Materias y clases" detents={[0.6, 0.92]}>
            <LibraryPanel doc={doc} onDone={closeSheet} className="-mx-1" />
          </BottomSheet>
          <BottomSheet open={mobileSheet === "inspector"} onOpenChange={(open) => !open && closeSheet()} title="Propiedades" detents={[0.6, 0.92]}>
            <Inspector doc={doc} className="-mx-4 -mt-2 overflow-visible" />
          </BottomSheet>
        </>
      ) : null}
    </>
  )
}

export default function App() {
  const theme = useUiTheme()
  const boot = useStudio((state) => state.boot)
  const doc = useStudio((state) => state.session?.doc)
  useShortcuts()

  useEffect(() => {
    void useStudio.getState().bootStart()
  }, [])

  useEffect(() => {
    document.title = doc ? `${doc.settings.title || "Sin título"} · Horario Studio` : "Horario Studio"
  }, [doc])

  return (
    <>
      <TopBar />
      <Notices />
      {boot === "loading" ? (
        <main className="grid flex-1 place-items-center text-sm text-muted-foreground" role="status">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Abriendo tus proyectos…
          </span>
        </main>
      ) : doc ? (
        <Studio doc={doc} />
      ) : (
        <Welcome />
      )}
      <Dialogs />
      <Toaster theme={theme} position="bottom-center" offset={{ bottom: 76 }} mobileOffset={{ bottom: 84 }} closeButton toastOptions={{ classNames: { toast: "cn-toast" } }} />
      <LiveRegion />
    </>
  )
}
