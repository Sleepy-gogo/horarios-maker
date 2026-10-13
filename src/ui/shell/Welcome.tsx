import { CalendarPlus, FileUp, FolderOpen } from "lucide-react"
import { EmptyState } from "@/components/arc/empty-state/empty-state"
import { Button } from "@/components/ui/button"
import { useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
import { relativeTime } from "../platform"

/** Shown when no project is open: create, import, or reopen a recent one. */
export function Welcome() {
  const all = useStudio((state) => state.projects)
  const projects = all.filter((project) => !project.deletedAt)
  const boot = useStudio((state) => state.boot)
  const openDialog = useEditor((state) => state.openDialog)
  const recent = projects.slice(0, 6)

  return (
    <main className="canvas-viewport flex min-h-0 flex-1 items-start justify-center overflow-auto px-4 py-10 sm:items-center">
      <div className="w-full max-w-xl">
        <EmptyState
          label="Sin proyecto abierto"
          icon={<CalendarPlus size={22} aria-hidden="true" />}
          title={projects.length ? "Elegí un horario o creá uno nuevo" : "Armá tu primer horario"}
          description="Creá materias, ubicalas en la grilla y exportá una imagen idéntica a lo que ves. Todo se guarda en este navegador."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => openDialog("new-project")} disabled={boot !== "ready"}>
                <CalendarPlus /> Nuevo proyecto
              </Button>
              <Button variant="outline" onClick={() => openDialog("import")}>
                <FileUp /> Importar archivo
              </Button>
            </div>
          }
        />
        {recent.length ? (
          <section className="mt-8" aria-labelledby="recent-title">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="recent-title" className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                Recientes
              </h2>
              <Button variant="ghost" size="sm" onClick={() => openDialog("projects")}>
                <FolderOpen /> Todos los proyectos
              </Button>
            </div>
            <ul className="overflow-hidden rounded-xl border border-border bg-card">
              {recent.map((project) => (
                <li key={project.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    disabled={!!project.damaged}
                    onClick={() => void useStudio.getState().openProject(project.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none hover:bg-accent focus-visible:bg-accent disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{project.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {project.damaged ? "Dañado: abrilo desde Mis proyectos para recuperarlo" : `${project.subjects} materias · ${project.blocks} clases`}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(project.updatedAt)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  )
}
