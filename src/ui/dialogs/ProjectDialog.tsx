import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Checkbox } from "@/components/arc/checkbox/checkbox"
import { NumberField } from "@/components/arc/number-field/number-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DAYS, PAGE_LIMITS, PAGE_PRESETS, TEXT_LIMITS, sortDays } from "@/domain/constants"
import { defaultSettings, deleteBlocks, excludedBlocks, expandRange, pageFromPreset, withSettings } from "@/domain/document"
import { THEME_PRESETS, presetById } from "@/domain/presets"
import { formatMinutes } from "@/domain/time"
import type { Appearance, DayId, DocumentSettings, PagePreset } from "@/domain/types"
import { useRendered } from "@/hooks/use-rendered"
import { describeBlock } from "@/state/actions"
import { useEditor } from "@/state/editor"
import { commit, useStudio } from "@/state/studio"
import { ChoiceTiles, DayChips, Field, SectionTitle, SwitchRow, TimeField } from "../common"
import { useFieldId } from "../platform"
import { PreviewPane } from "./Preview"
import { sampleDocument } from "./sample"
import { DialogFooter, DialogShell, FooterNote, SplitBody } from "./shell"
import { ThemeSwatch } from "./ThemeSwatch"

/** The page's proportion, drawn on a quiet stage so formats compare at a glance. */
function PageShape({ width, height }: { width: number; height: number }) {
  const scale = 34 / Math.max(width, height)
  return (
    <span aria-hidden="true" className="grid h-14 place-items-center bg-muted/60">
      <span className="rounded-[3px] border border-foreground/20 bg-card shadow-[0_1px_2px_rgb(0_0_0/0.08)]" style={{ width: Math.max(10, width * scale), height: Math.max(10, height * scale) }} />
    </span>
  )
}

const SHOW_LABELS: [keyof DocumentSettings["show"], string][] = [
  ["subtitle", "Subtítulo"],
  ["legend", "Leyenda de materias"],
  ["hourLabels", "Horas de la grilla"],
  ["blockTimes", "Horario en cada clase"],
  ["room", "Aula"],
  ["kind", "Tipo de clase"],
  ["notes", "Notas"],
]

const WEEKDAYS: DayId[] = ["mon", "tue", "wed", "thu", "fri"]

function ProjectForm({ mode }: { mode: "new" | "settings" }) {
  const doc = useStudio((state) => state.session?.doc)
  const themes = useStudio((state) => state.themes)
  const prefs = useStudio((state) => state.prefs)
  const initial: DocumentSettings = mode === "settings" && doc ? doc.settings : defaultSettings()
  const [title, setTitle] = useState(mode === "new" ? "" : initial.title)
  const [subtitle, setSubtitle] = useState(initial.subtitle)
  const [preset, setPreset] = useState<PagePreset>(initial.page.preset)
  const [custom, setCustom] = useState({ width: initial.page.width, height: initial.page.height })
  const [days, setDays] = useState<DayId[]>(initial.days)
  const [range, setRange] = useState(initial.range)
  const [compactEmptyHours, setCompactEmptyHours] = useState(initial.compactEmptyHours)
  const [show, setShow] = useState(initial.show)
  const [themeId, setThemeId] = useState(() => {
    const preferred = prefs.defaultThemeId
    if (preferred && (themes.some((theme) => theme.id === preferred) || presetById(preferred))) return presetById(preferred)?.id ?? preferred
    return THEME_PRESETS[0]!.id
  })
  const [dropExcluded, setDropExcluded] = useState(false)
  const titleId = useFieldId("title")
  const subtitleId = useFieldId("subtitle")

  const excluded = mode === "settings" && doc ? excludedBlocks(doc.blocks, days, range) : []
  const missingDays = sortDays([...new Set(excluded.filter((block) => !days.includes(block.day)).map((block) => block.day))])
  const outOfRange = excluded.filter((block) => days.includes(block.day))
  const expanded = expandRange(range, outOfRange)
  const rangeError = range.end - range.start < 60 ? "El horario visible debe abarcar al menos una hora." : null
  const daysError = days.length ? null : "Elegí al menos un día."
  const blocked = !!rangeError || !!daysError || (excluded.length > 0 && !dropExcluded)
  const page = pageFromPreset(preset, custom)
  const settings: DocumentSettings = { title: title.trim() || "Mi horario", subtitle: subtitle.trim(), page, days: days.length ? days : initial.days, range: rangeError ? initial.range : range, compactEmptyHours, show }

  const saved = themes.find((theme) => theme.id === themeId)
  const appearance: Appearance | undefined = mode === "new" ? (saved ? { ...saved.appearance, name: saved.name } : presetById(themeId)?.appearance) : doc?.appearance
  const previewDoc = mode === "new" ? (appearance ? sampleDocument(settings, appearance) : null) : doc ? withSettings(doc, settings) : null
  const rendered = useRendered(previewDoc, "pj")

  const submit = async () => {
    if (blocked) return
    if (mode === "new") {
      useEditor.getState().closeDialog()
      await useStudio.getState().newProject(settings, appearance)
      return
    }
    const ids = excluded.map((block) => block.id)
    commit(
      ids.length ? `Cambiar ajustes y eliminar ${ids.length} clases` : "Cambiar ajustes del documento",
      (current) => {
        const next = withSettings(current, settings)
        return ids.length ? deleteBlocks(next, ids) : next
      },
      { announce: "Ajustes del documento actualizados" },
    )
    useEditor.getState().closeDialog()
  }

  const sameDays = (list: DayId[]) => list.length === days.length && list.every((day) => days.includes(day))
  const dayPresets: [string, DayId[]][] = [
    ["Lun a vie", WEEKDAYS],
    ["Lun a sáb", [...WEEKDAYS, "sat"]],
    ["Todos", DAYS.map((day) => day.id)],
  ]

  const main = (
    <div className="grid gap-7">
      <div className="grid gap-3">
        <Field label="Título" htmlFor={titleId}>
          <Input id={titleId} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Mi horario" maxLength={TEXT_LIMITS.title} autoFocus={mode === "new"} className="h-10 text-base font-medium md:text-base" />
        </Field>
        <Field label="Subtítulo" htmlFor={subtitleId} hint="Opcional: cuatrimestre, curso, nombre…">
          <Input id={subtitleId} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="1.er cuatrimestre 2026" maxLength={TEXT_LIMITS.subtitle} />
        </Field>
      </div>

      {mode === "new" ? (
        <section className="grid gap-2.5">
          <SectionTitle description="Colores y fuentes; podés ajustarlos después.">Tema</SectionTitle>
          <ChoiceTiles
            label="Tema"
            size="sm"
            className="grid-cols-2 sm:grid-cols-3"
            value={themeId}
            onChange={setThemeId}
            options={[
              ...THEME_PRESETS.map((item) => ({ value: item.id, label: item.appearance.name, visual: <ThemeSwatch appearance={item.appearance} className="h-16" /> })),
              ...themes.map((theme) => ({ value: theme.id, label: theme.name, meta: "Mi tema", visual: <ThemeSwatch appearance={theme.appearance} className="h-16" /> })),
            ]}
          />
        </section>
      ) : null}

      <section className="grid gap-2.5">
        <SectionTitle>Formato</SectionTitle>
        <ChoiceTiles
          label="Formato del documento"
          size="sm"
          indicator={false}
          className="grid-cols-3"
          value={preset}
          onChange={(value) => setPreset(value as PagePreset)}
          options={[
            ...(Object.entries(PAGE_PRESETS) as [Exclude<PagePreset, "custom">, (typeof PAGE_PRESETS)[keyof typeof PAGE_PRESETS]][]).map(([id, item]) => ({
              value: id,
              label: item.label,
              meta: item.ratio,
              visual: <PageShape width={item.width} height={item.height} />,
            })),
            { value: "custom", label: "A medida", meta: `${custom.width} × ${custom.height}`, visual: <PageShape width={custom.width} height={custom.height} /> },
          ]}
        />
        {preset === "custom" ? (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Ancho" value={custom.width} min={PAGE_LIMITS.min} max={PAGE_LIMITS.max} step={10} largeStep={100} suffix=" px" onValueChange={(width) => setCustom((current) => ({ ...current, width }))} />
            <NumberField label="Alto" value={custom.height} min={PAGE_LIMITS.min} max={PAGE_LIMITS.max} step={10} largeStep={100} suffix=" px" onValueChange={(height) => setCustom((current) => ({ ...current, height }))} />
          </div>
        ) : null}
      </section>

      <section className="grid gap-2.5">
        <SectionTitle
          action={
            <div className="flex gap-0.5">
              {dayPresets.map(([label, list]) => (
                <Button key={label} type="button" size="xs" variant="ghost" aria-pressed={sameDays(list)} className="text-muted-foreground aria-pressed:text-foreground" onClick={() => setDays(list)}>
                  {label}
                </Button>
              ))}
            </div>
          }
        >
          Días
        </SectionTitle>
        <DayChips multiple label="Días visibles" value={days} onChange={(next) => setDays(sortDays(next))} />
        {daysError ? <p className="text-xs text-destructive">{daysError}</p> : null}
      </section>

      <section className="grid gap-2.5">
        <SectionTitle>Horario visible</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <TimeField label="Desde" value={range.start} max={range.end - 60} onChange={(start) => setRange((current) => ({ ...current, start }))} />
          <TimeField label="Hasta" end value={range.end} min={range.start + 60} onChange={(end) => setRange((current) => ({ ...current, end }))} />
        </div>
        {rangeError ? <p className="text-xs text-destructive">{rangeError}</p> : null}
        <SwitchRow
          label="Compactar horas vacías"
          description="Reduce las franjas sin clases en ningún día para dar más espacio a las clases."
          checked={compactEmptyHours}
          onCheckedChange={setCompactEmptyHours}
        />
      </section>

      {excluded.length ? (
        <div className="grid gap-2 rounded-xl border border-warning/40 bg-warning/8 p-3.5 text-sm" role="alert">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
            {excluded.length === 1 ? "1 clase quedaría fuera del documento" : `${excluded.length} clases quedarían fuera del documento`}
          </p>
          <ul className="grid gap-0.5 pl-6 text-xs text-muted-foreground">
            {excluded.slice(0, 4).map((block) => (
              <li key={block.id}>{doc ? describeBlock(doc, block) : null}</li>
            ))}
            {excluded.length > 4 ? <li>y {excluded.length - 4} más</li> : null}
          </ul>
          <div className="flex flex-wrap gap-1.5 pl-6">
            {outOfRange.length ? (
              <Button type="button" size="xs" variant="outline" onClick={() => setRange(expanded)}>
                Ampliar a {formatMinutes(expanded.start)}–{formatMinutes(expanded.end)}
              </Button>
            ) : null}
            {missingDays.length ? (
              <Button type="button" size="xs" variant="outline" onClick={() => setDays(sortDays([...days, ...missingDays]))}>
                Volver a incluir {missingDays.map((day) => DAYS.find((item) => item.id === day)?.label.toLocaleLowerCase("es")).join(", ")}
              </Button>
            ) : null}
          </div>
          <div className="pl-6">
            <Checkbox label={excluded.length === 1 ? "Eliminar esa clase al guardar" : `Eliminar esas ${excluded.length} clases al guardar`} checked={dropExcluded} onCheckedChange={(value) => setDropExcluded(value === true)} />
          </div>
        </div>
      ) : null}

      {mode === "settings" ? (
        <section className="grid gap-1">
          <SectionTitle>Mostrar en el documento</SectionTitle>
          <div className="grid gap-x-6">
            {SHOW_LABELS.map(([key, label]) => (
              <SwitchRow key={key} label={label} checked={show[key]} onCheckedChange={(value) => setShow((current) => ({ ...current, [key]: value }))} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )

  return (
    <SplitBody
      onSubmit={() => void submit()}
      mainWidth="25rem"
      main={main}
      aside={<PreviewPane rendered={rendered} caption={mode === "new" ? "Vista de ejemplo, con materias de muestra." : "Así va a quedar tu documento."} />}
      footer={
        <DialogFooter>
          <FooterNote>
            {page.width} × {page.height} px
          </FooterNote>
          <Button type="button" variant="ghost" onClick={() => useEditor.getState().closeDialog()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={blocked}>
            {mode === "new" ? "Crear proyecto" : "Guardar cambios"}
          </Button>
        </DialogFooter>
      }
    />
  )
}

export function NewProjectDialog() {
  return (
    <DialogShell name="new-project" title="Nuevo proyecto" description="Elegí un tema y un formato. Todo se puede cambiar después." width={980} layout="split">
      <ProjectForm mode="new" />
    </DialogShell>
  )
}

export function SettingsDialog() {
  return (
    <DialogShell name="settings" title="Ajustes del documento" description="Título, formato, días y horario visible." width={980} layout="split">
      <ProjectForm mode="settings" />
    </DialogShell>
  )
}
