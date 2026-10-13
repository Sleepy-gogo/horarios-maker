import { useState } from "react"
import { CheckCircle2, FileWarning } from "lucide-react"
import { toast } from "sonner"
import { FileDropzone } from "@/components/arc/file-dropzone/file-dropzone"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { readImport, type ImportResult } from "@/domain/files"
import { nowIso } from "@/domain/document"
import { useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
import { applyAppearance } from "../commands"
import { DialogFooter, DialogShell } from "./shell"

const MAX_BYTES = 10 * 1024 * 1024

function Summary({ result }: { result: ImportResult }) {
  if (!result.ok) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">
        <p className="flex items-center gap-1.5 font-medium text-destructive">
          <FileWarning className="size-4" aria-hidden="true" /> No se puede importar
        </p>
        <p className="mt-1">{result.message}</p>
        {result.problems?.length ? (
          <ul className="mt-2 max-h-40 list-disc overflow-auto pl-5 text-xs text-muted-foreground">
            {result.problems.slice(0, 20).map((problem, index) => (
              <li key={index}>
                <code>{problem.path || "archivo"}</code>: {problem.message}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-xs text-muted-foreground">No se modificó ningún proyecto.</p>
      </div>
    )
  }
  const candidate = result.candidate
  return (
    <div className="rounded-lg border border-border bg-card p-3 text-sm" role="status">
      <p className="flex items-center gap-1.5 font-medium">
        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        {candidate.kind === "project"
          ? candidate.source === "v1"
            ? "Horario de la versión anterior"
            : "Proyecto de Horario Studio"
          : candidate.kind === "backup"
            ? "Copia de seguridad"
            : candidate.themes.length === 1
              ? "Tema"
              : `${candidate.themes.length} temas`}
      </p>
      {candidate.kind === "project" ? (
        <>
          <p className="mt-1">
            <strong>{candidate.document.settings.title || "Sin título"}</strong> · {candidate.document.subjects.length} materias · {candidate.document.blocks.length} clases
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Se agrega como un proyecto nuevo; no reemplaza ninguno existente.</p>
          {candidate.report && (candidate.report.notes.length || candidate.report.skipped.length) ? (
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
              {candidate.report.notes.map((note, index) => (
                <li key={index}>{note}</li>
              ))}
              {candidate.report.skipped.map((item) => (
                <li key={item.index} className="text-warning">
                  Bloque {item.index + 1} sin convertir: {item.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : candidate.kind === "backup" ? (
        <>
          <p className="mt-1">
            {candidate.projects.length} proyectos · {candidate.themes.length} temas
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Todo se agrega como copias nuevas; tus proyectos actuales no cambian.</p>
          {candidate.rejected ? <p className="mt-1 text-xs text-warning">{candidate.rejected} proyectos dañados no se importarán.</p> : null}
        </>
      ) : (
        <p className="mt-1">{candidate.themes.map((theme) => theme.name).join(", ")}</p>
      )}
    </div>
  )
}

function ImportBody() {
  const [result, setResult] = useState<ImportResult | null>(null)
  const [pasted, setPasted] = useState("")
  const [busy, setBusy] = useState(false)
  const hasDoc = useStudio((state) => !!state.session)

  const read = async (files: File[]) => {
    const file = files.at(-1)
    if (!file) {
      setResult(null)
      return
    }
    if (file.size > MAX_BYTES) {
      setResult({ ok: false, message: "El archivo supera los 10 MB." })
      return
    }
    try {
      setResult(readImport(await file.text()))
    } catch {
      setResult({ ok: false, message: "No se pudo leer el archivo." })
    }
  }

  const confirm = async () => {
    if (!result?.ok) return
    const studio = useStudio.getState()
    const candidate = result.candidate
    setBusy(true)
    try {
      if (candidate.kind === "project") {
        const meta = await studio.addProject(candidate.document, { open: true })
        if (meta || !studio.storageOk) {
          toast.success(`Se importó "${candidate.document.settings.title || "Sin título"}"`)
          useEditor.getState().closeDialog()
        }
      } else if (candidate.kind === "backup") {
        let count = 0
        for (const project of candidate.projects) {
          if (await studio.addProject(project.document, { open: false })) count++
        }
        for (const theme of candidate.themes) await studio.saveTheme({ ...theme, updatedAt: nowIso() })
        if (candidate.swatches.length) studio.setPrefs({ swatches: [...new Set([...studio.prefs.swatches, ...candidate.swatches])].slice(0, 12) })
        toast.success(`Se importaron ${count} proyectos y ${candidate.themes.length} temas`)
        useEditor.getState().closeDialog()
        if (!studio.session) useEditor.getState().openDialog("projects")
      } else {
        for (const theme of candidate.themes) await studio.saveTheme(theme)
        toast.success(candidate.themes.length === 1 ? `Se guardó el tema "${candidate.themes[0]!.name}"` : `Se guardaron ${candidate.themes.length} temas`, {
          action: hasDoc ? { label: "Aplicar", onClick: () => applyAppearance({ ...candidate.themes[0]!.appearance, name: candidate.themes[0]!.name }, { label: `Aplicar tema ${candidate.themes[0]!.name}` }) } : undefined,
        })
        useEditor.getState().closeDialog()
      }
    } catch (error) {
      toast.error("No se pudo importar", { description: error instanceof Error ? error.message : undefined })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-4">
      <FileDropzone
        accept=".json,application/json,text/plain"
        multiple={false}
        maxFiles={1}
        label="Elegir archivo"
        description="Soltá un proyecto, una copia de seguridad o un tema (.json)"
        note="También sirve el JSON exportado por la versión anterior."
        onFilesChange={(files) => void read(files)}
      />
      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Pegar el contenido en lugar de elegir un archivo</summary>
        <div className="mt-2 grid gap-2">
          <Textarea value={pasted} onChange={(event) => setPasted(event.target.value)} placeholder='{"format": "horario-studio/project", …}' aria-label="Contenido JSON" className="max-h-48 min-h-24 font-mono text-xs" />
          <Button variant="outline" size="sm" className="justify-self-start" disabled={!pasted.trim()} onClick={() => setResult(readImport(pasted))}>
            Revisar contenido
          </Button>
        </div>
      </details>
      {result ? <Summary result={result} /> : null}
      <DialogFooter>
        <Button variant="ghost" onClick={() => useEditor.getState().closeDialog()}>
          Cancelar
        </Button>
        <Button disabled={!result?.ok || busy} onClick={() => void confirm()}>
          Importar
        </Button>
      </DialogFooter>
    </div>
  )
}

export function ImportDialog() {
  return (
    <DialogShell name="import" title="Importar" description="Revisá el contenido antes de agregarlo. Nunca se reemplaza un proyecto existente." width={540}>
      <ImportBody />
    </DialogShell>
  )
}
