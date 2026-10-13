import { useState } from "react"
import { AlertTriangle, FileJson, Image as ImageIcon, Loader2, RefreshCw, Shapes } from "lucide-react"
import { toast } from "sonner"
import { ActionButton } from "@/components/arc/action-button/action-button"
import { Checkbox } from "@/components/arc/checkbox/checkbox"
import { CopyButton } from "@/components/arc/copy-button/copy-button"
import { NumberField } from "@/components/arc/number-field/number-field"
import { RadioCards } from "@/components/arc/radio-cards/radio-cards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { projectFile, slugify } from "@/domain/files"
import { maxPngScale, pngSize } from "@/engine/export"
import { ensureFonts } from "@/engine/render"
import { retryFont } from "@/fonts/service"
import { useFontsVersion } from "@/hooks/use-fonts-version"
import { useRendered } from "@/hooks/use-rendered"
import { cn } from "@/lib/utils"
import { useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
import { Field } from "../common"
import { useFieldId } from "../platform"
import { fitRangeToBlocks } from "../commands"
import { downloadImage } from "../exporter"
import { Preview } from "./Preview"
import { DialogFooter, DialogShell } from "./shell"
import { dialogPayload } from "./payload"

type Format = "png" | "svg" | "json"

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
  const size = scene ? (format === "png" ? pngSize(scene.width, scene.height, scale) : { width: scene.width, height: scene.height, tooLarge: false }) : null
  const blocked = image && (!rendered || errors.length > 0 || (warnings.length > 0 && !acknowledged) || !!size?.tooLarge)
  const extension = format === "json" ? "horario.json" : format
  const fileName = `${slugify(name)}.${extension}`
  const json = JSON.stringify(projectFile(doc), null, 2)

  const run = async () => {
    if (format === "json") {
      useStudio.getState().downloadProject(doc)
      return
    }
    if (format === "png" && scale !== prefs.pngScale) useStudio.getState().setPrefs({ pngScale: scale })
    await downloadImage(doc, format, scale, fileName)
  }

  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="order-2 grid content-start gap-5 sm:order-1">
        <RadioCards
          aria-label="Formato"
          layout="list"
          value={format}
          onValueChange={(value) => setFormat(value as Format)}
          options={[
            { value: "png", label: "PNG", description: "Imagen para compartir o imprimir", icon: <ImageIcon size={18} aria-hidden="true" /> },
            { value: "svg", label: "SVG", description: "Vectorial, nítido a cualquier tamaño", icon: <Shapes size={18} aria-hidden="true" /> },
            { value: "json", label: "Proyecto editable", description: "Para volver a abrirlo o pasarlo a otro dispositivo", icon: <FileJson size={18} aria-hidden="true" /> },
          ]}
        />
        {format === "png" ? (
          <NumberField
            label="Escala"
            value={scale}
            min={0.5}
            max={maxScale}
            step={0.5}
            formatOptions={{ minimumFractionDigits: 0, maximumFractionDigits: 2 }}
            suffix="×"
            description={size ? `${size.width} × ${size.height} px` : undefined}
            onValueChange={setScale}
          />
        ) : null}
        <Field label="Nombre del archivo" htmlFor={nameId} hint={fileName}>
          <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
      </div>

      <div className="order-1 grid content-start gap-3 sm:order-2">
        {rendered ? (
          <Preview svg={rendered.svg} width={rendered.scene.width} height={rendered.scene.height} />
        ) : (
          <div className="grid h-56 place-items-center rounded-xl border border-border text-sm text-muted-foreground" role="status">
            <span className="inline-flex items-center gap-2">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando fuentes…
            </span>
          </div>
        )}
        {image && errors.length ? (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">
            <p className="font-medium text-destructive">No se puede exportar todavía</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {errors.map((issue, index) => (
                <li key={index}>{issue.message}</li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-1.5">
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
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="size-4 text-warning" aria-hidden="true" /> Revisá antes de exportar
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {warnings.map((issue, index) => (
                <li key={index}>{issue.message}</li>
              ))}
            </ul>
            <div className="mt-2">
              <Checkbox label="Exportar igual" checked={acknowledged} onCheckedChange={(value) => setAcknowledged(value === true)} />
            </div>
          </div>
        ) : null}
        {size?.tooLarge ? <p className="text-xs text-destructive">La imagen es demasiado grande. Bajá la escala.</p> : null}
      </div>

      <DialogFooter className="order-3 sm:col-span-2">
        {format === "json" ? <CopyButton value={json} label="Copiar JSON" /> : <span className={cn("mr-auto text-xs text-muted-foreground")}>El archivo es idéntico a lo que ves en el lienzo.</span>}
        <Button variant="ghost" onClick={() => useEditor.getState().closeDialog()}>
          Cerrar
        </Button>
        <ActionButton
          label={`Descargar ${format === "json" ? "JSON" : format.toUpperCase()}`}
          successLabel="Descargado"
          pendingLabel="Generando"
          disabled={blocked}
          onAction={run}
          onActionError={(error) => toast.error("No se pudo exportar", { description: error instanceof Error ? error.message : undefined })}
        />
      </DialogFooter>
    </div>
  )
}

export function ExportDialog() {
  return (
    <DialogShell name="export" title="Exportar" width={760}>
      <ExportBody />
    </DialogShell>
  )
}
