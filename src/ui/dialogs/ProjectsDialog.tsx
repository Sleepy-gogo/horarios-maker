import { useState } from "react"
import { Copy, Download, FolderOpen, MoreHorizontal, Plus, RotateCcw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { SearchField } from "@/components/arc/search-field/search-field"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { downloadJson, slugify } from "@/domain/files"
import { normalizeName } from "@/domain/document"
import { cn } from "@/lib/utils"
import { describeStorageError } from "@/storage/db"
import { TRASH_DAYS, getRawProject, loadProject, type ProjectMeta } from "@/storage/projects"
import { useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
import { relativeTime } from "../platform"
import { DialogShell } from "./shell"

async function downloadStored(meta: ProjectMeta) {
  try {
    if (meta.damaged) {
      const raw = await getRawProject(meta.id)
      downloadJson(raw?.document ?? null, `${slugify(meta.title)}-sin-reparar.json`)
      return
    }
    const { document } = await loadProject(meta.id)
    useStudio.getState().downloadProject(document)
  } catch (error) {
    toast.error("No se pudo descargar", { description: describeStorageError(error) })
  }
}

function ProjectRow({ meta, current }: { meta: ProjectMeta; current: boolean }) {
  const studio = useStudio.getState()
  const [confirming, setConfirming] = useState(false)
  const trashed = !!meta.deletedAt
  const daysLeft = meta.deletedAt ? Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(meta.deletedAt).getTime()) / 86400000)) : 0

  return (
    <li className={cn("flex items-center gap-2 border-b border-border px-3 py-2.5 last:border-b-0", current && "bg-primary/8")}>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{meta.title}</span>
          {current ? <span className="shrink-0 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">Abierto</span> : null}
        </p>
        <p className={cn("truncate text-xs", meta.damaged ? "text-destructive" : "text-muted-foreground")}>
          {meta.damaged
            ? "Datos dañados: descargalos para recuperarlos"
            : trashed
              ? `En la papelera · se borra en ${daysLeft} ${daysLeft === 1 ? "día" : "días"}`
              : `${meta.subjects} materias · ${meta.blocks} clases · ${relativeTime(meta.updatedAt)}`}
        </p>
      </div>
      {trashed ? (
        confirming ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="destructive" onClick={() => void studio.destroyProject(meta.id)}>
              Borrar para siempre
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
              No
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => void studio.restoreProject(meta.id)}>
              <RotateCcw /> Restaurar
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label={`Borrar ${meta.title} para siempre`} onClick={() => setConfirming(true)}>
              <Trash2 />
            </Button>
          </div>
        )
      ) : (
        <div className="flex shrink-0 items-center gap-1">
          {!current && !meta.damaged ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                if (await studio.openProject(meta.id)) useEditor.getState().closeDialog()
              }}
            >
              <FolderOpen /> Abrir
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label={`Más acciones para ${meta.title}`} />}>
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-auto min-w-48" align="end">
              {!meta.damaged ? (
                <DropdownMenuItem onClick={() => void studio.duplicateProject(meta.id)}>
                  <Copy /> Duplicar
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onClick={() => void downloadStored(meta)}>
                <Download /> Descargar JSON
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => void studio.trashProject(meta.id)}>
                <Trash2 /> Enviar a la papelera
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  )
}

function ProjectsBody() {
  const projects = useStudio((state) => state.projects)
  const storageOk = useStudio((state) => state.storageOk)
  const currentId = useStudio((state) => state.session?.doc.id)
  const [query, setQuery] = useState("")
  const [showTrash, setShowTrash] = useState(false)
  const key = normalizeName(query)
  const matches = (meta: ProjectMeta) => !key || normalizeName(meta.title).includes(key)
  const active = projects.filter((meta) => !meta.deletedAt && matches(meta))
  const trash = projects.filter((meta) => meta.deletedAt)

  if (!storageOk) {
    return <p className="text-sm text-muted-foreground">Este navegador no permite guardar proyectos. Descargá el proyecto actual como JSON para no perderlo.</p>
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-48 flex-1">
          <SearchField label="Buscar proyectos" value={query} onValueChange={setQuery} placeholder="Buscar por título" />
        </div>
        <Button onClick={() => useEditor.getState().openDialog("new-project")}>
          <Plus /> Nuevo
        </Button>
      </div>
      {active.length ? (
        <ul className="overflow-hidden rounded-xl border border-border">
          {active.map((meta) => (
            <ProjectRow key={meta.id} meta={meta} current={meta.id === currentId} />
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{query ? "Ningún proyecto coincide con la búsqueda." : "Todavía no hay proyectos en este navegador."}</p>
      )}
      {trash.length ? (
        <section>
          <Button variant="ghost" size="sm" aria-expanded={showTrash} onClick={() => setShowTrash((value) => !value)}>
            <Trash2 /> Papelera ({trash.length})
          </Button>
          {showTrash ? (
            <ul className="mt-2 overflow-hidden rounded-xl border border-border">
              {trash.map((meta) => (
                <ProjectRow key={meta.id} meta={meta} current={false} />
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      <p className="text-xs leading-relaxed text-muted-foreground">
        Los proyectos se guardan solo en este navegador y este dispositivo. Para pasarlos a otro lado o resguardarlos, usá Archivo → Descargar copia de seguridad.
      </p>
    </div>
  )
}

export function ProjectsDialog() {
  return (
    <DialogShell name="projects" title="Mis proyectos" width={620}>
      <ProjectsBody />
    </DialogShell>
  )
}
