import { useState } from "react"
import { AlertTriangle, FileJson, Image as ImageIcon, RefreshCw, Shapes } from "lucide-react"
import { toast } from "sonner"
import { ActionButton } from "@/components/arc/action-button/action-button"
import { Checkbox } from "@/components/arc/checkbox/checkbox"
import { CopyButton } from "@/components/arc/copy-button/copy-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { projectFile, slugify } from "@/domain/files"
import { maxPngScale, pngSize } from "@/engine/export"
import { ensureFonts } from "@/engine/render"
import { retryFont } from "@/fonts/service"
import { useFontsVersion } from "@/hooks/use-fonts-version"
import { useRendered } from "@/hooks/use-rendered"
import { useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
import { ChoiceTiles, Field, Segmented, SectionTitle } from "../common"
import { useFieldId } from "../platform"
import { fitRangeToBlocks } from "../commands"
import { downloadImage } from "../exporter"
import { Preview, PreviewPane } from "./Preview"
import { DialogFooter, DialogShell, FooterNote, SplitBody } from "./shell"
import { dialogPayload } from "./payload"

type Format = "png" | "svg" | "json"

const FORMAT_ICON = "grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground group-aria-checked:bg-primary/12 group-aria-checked:text-primary"

function ExportBody() {
  const doc = useStudio((state) => state.session?.doc)
  const prefs = useStudio((state) => state.prefs)
  const rendered = useRendered(doc)
  const fontsVersion = useFontsVersion()
  const [format, setFormat] = useState<Format>(dialogPayload<Format>("format") ?? "png")
  const [scale, setScale] = useState(prefs.pngScale)
  const [name, setName] = useState(slugify(doc?.settings.title ?? "horario"))
  const [acknowledged, setAcknowledged] = useState(false)
  const nameId = useFieldId("file-name")
  if (!doc) return null

  const fonts = ensureFonts(doc.appearance, fontsVersion)
  const scene = rendered?.scene
  const errors = scene?.issues.filter((issue) => issue.level === "error") ?? []
  const warnings = scene?.issues.filter((issue) => issue.level === "warning") ?? []
  const image = format !== "json"
  const maxScale = scene ? Math.max(0.5, Math.min(8, maxPngScale(scene.width, scene.height))) : 4
  const scales = [...new Set([1, 2, 3, 4, scale])].filter((value) => value <= maxScale).sort((a, b) => a - b)
  const size = scene ? (format === "png" ? pngSize(scene.width, scene.height, scale) : { width: scene.width, height: scene.height, tooLarge: false }) : null
  const blocked = image && (!rendered || errors.length > 0 || (warnings.length > 0 && !acknowledged) || !!size?.tooLarge)
  const extension = format === "json" ? "horario.json" : format
  const fileName = `${slugify(name) || "horario"}.${extension}`
  const json = JSON.stringify(projectFile(doc), null, 2)

  const run = async () => {
    if (format === "json") {
      useStudio.getState().downloadProject(doc)
      return
    }
    if (format === "png" && scale !== prefs.pngScale) useStudio.getState().setPrefs({ pngScale: scale })
    await downloadImage(doc, format, scale, fileName)
  }

  const main = (
    <div className="grid gap-7">
      <section className="grid gap-2.5">
        <SectionTitle>Formato</SectionTitle>
        <ChoiceTiles
          label="Formato"
          direction="row"
          className="grid-cols-1"
          value={format}
          onChange={(value) => setFormat(value as Format)}
          options={[
            { value: "png", label: "Imagen PNG", meta: "Para compartir, imprimir o usar de fondo", visual: <span className={FORMAT_ICON}><ImageIcon className="size-4.5" aria-hidden="true" /></span> },
            { value: "svg", label: "Vectorial SVG", meta: "Nítido a cualquier tamaño", visual: <span className={FORMAT_ICON}><Shapes className="size-4.5" aria-hidden="true" /></span> },
            { value: "json", label: "Proyecto editable", meta: "Para abrirlo en otro dispositivo", visual: <span className={FORMAT_ICON}><FileJson className="size-4.5" aria-hidden="true" /></span> },
          ]}
        />
      </section>

      {format === "png" ? (
        <section className="grid gap-2">
          <Segmented label="Resolución" value={String(scale)} onChange={(value) => setScale(Number(value))} options={scales.map((value) => ({ value: String(value), label: `${value}×` }))} />
          <p className="text-xs text-muted-foreground tabular-nums">{size ? `${size.width} × ${size.height} px` : "Calculando…"}{scale >= 2 ? " · ideal para pantallas y para imprimir" : ""}</p>
        </section>
      ) : null}

      <Field label="Nombre del archivo" htmlFor={nameId}>
        <div className="flex h-8 min-w-0 items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30">
          <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} className="h-full min-w-0 flex-1 border-0 bg-transparent! pr-1 focus-visible:ring-0" />
          <span className="shrink-0 pr-2.5 text-sm text-muted-foreground">.{extension}</span>
        </div>
      </Field>

      {image && errors.length ? (
        <div className="grid gap-2 rounded-xl border border-destructive/40 bg-destructive/8 p-3.5 text-sm" role="alert">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" /> No se puede exportar todavía
          </p>
          <ul className="grid gap-0.5 pl-6 text-xs">
            {errors.map((issue, index) => (
              <li key={index}>{issue.message}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-1.5 pl-6">
            {fonts.state === "failed" ? (
              <Button size="xs" variant="outline" onClick={() => fonts.refs.forEach((ref) => retryFont(ref))}>
                <RefreshCw /> Reintentar fuentes
              </Button>
            ) : null}
            {errors.some((issue) => issue.code === "font-unavailable") ? (
              <Button size="xs" variant="outline" onClick={() => useEditor.getState().openDialog("appearance", { tab: "type" })}>
                Elegir otra fuente
              </Button>
            ) : null}
            {errors.some((issue) => issue.code === "out-of-range") ? (
              <Button size="xs" variant="outline" onClick={fitRangeToBlocks}>
                Ajustar rango a mis clases
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {image && !errors.length && warnings.length ? (
        <div className="grid gap-2 rounded-xl border border-warning/40 bg-warning/8 p-3.5 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" /> Revisá antes de exportar
          </p>
          <ul className="grid gap-0.5 pl-6 text-xs text-muted-foreground">
            {warnings.map((issue, index) => (
              <li key={index}>{issue.message}</li>
            ))}
          </ul>
          <div className="pl-6">
            <Checkbox label="Exportar igual" checked={acknowledged} onCheckedChange={(value) => setAcknowledged(value === true)} />
          </div>
        </div>
      ) : null}
      {size?.tooLarge ? <p className="text-xs text-destructive">La imagen es demasiado grande. Bajá la resolución.</p> : null}
    </div>
  )

  return (
    <SplitBody
      asideFirst
      mainWidth="23rem"
      main={main}
      aside={<PreviewPane rendered={rendered} caption={format === "json" ? "El proyecto guarda materias, clases y apariencia; se edita al abrirlo." : "El archivo es idéntico a esta vista y al lienzo."} />}
      compactAside={
        <div className="rounded-xl bg-canvas p-4">
          {rendered ? <Preview svg={rendered.svg} width={rendered.scene.width} height={rendered.scene.height} className="h-44" /> : <div className="h-44" />}
        </div>
      }
      footer={
        <DialogFooter>
          {format === "json" ? <CopyButton value={json} label="Copiar JSON" /> : <FooterNote>{fileName}</FooterNote>}
          <Button variant="ghost" className="max-sm:hidden" onClick={() => useEditor.getState().closeDialog()}>
            Cerrar
          </Button>
          <ActionButton
            label={format === "json" ? "Descargar proyecto" : `Descargar ${format.toUpperCase()}`}
            successLabel="Descargado"
            pendingLabel="Generando"
            disabled={blocked}
            onAction={run}
            onActionError={(error) => toast.error("No se pudo exportar", { description: error instanceof Error ? error.message : undefined })}
          />
        </DialogFooter>
      }
    />
  )
}

export function ExportDialog() {
  return (
    <DialogShell name="export" title="Exportar" description="Descargá el horario como imagen o como proyecto editable." width={980} layout="split">
      <ExportBody />
    </DialogShell>
  )
}
