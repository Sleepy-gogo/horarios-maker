import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Checkbox } from "@/components/arc/checkbox/checkbox"
import { NumberField } from "@/components/arc/number-field/number-field"
import { RadioCards } from "@/components/arc/radio-cards/radio-cards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DAYS, PAGE_LIMITS, PAGE_PRESETS, TEXT_LIMITS, sortDays } from "@/domain/constants"
import { defaultSettings, deleteBlocks, excludedBlocks, expandRange, pageFromPreset, withSettings } from "@/domain/document"
import { THEME_PRESETS, presetById } from "@/domain/presets"
import { formatMinutes } from "@/domain/time"
import type { DayId, DocumentSettings, PagePreset } from "@/domain/types"
import { describeBlock } from "@/state/actions"
import { useEditor } from "@/state/editor"
import { commit, useStudio } from "@/state/studio"
import { Field, NativeSelect, SectionTitle, SwitchRow, TimeField } from "../common"
import { useFieldId } from "../platform"
import { DialogFooter, DialogShell } from "./shell"

function PageIcon({ width, height }: { width: number; height: number }) {
  const scale = 22 / Math.max(width, height)
  return <span aria-hidden="true" className="inline-block rounded-[3px] border-[1.5px] border-current opacity-70" style={{ width: Math.max(8, width * scale), height: Math.max(8, height * scale) }} />
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
  const [show, setShow] = useState(initial.show)
  const [themeId, setThemeId] = useState(prefs.defaultThemeId ?? "papel")
  const [dropExcluded, setDropExcluded] = useState(false)
  const titleId = useFieldId("title")
  const subtitleId = useFieldId("subtitle")
  const themeField = useFieldId("theme")

  const excluded = mode === "settings" && doc ? excludedBlocks(doc.blocks, days, range) : []
  const missingDays = sortDays([...new Set(excluded.filter((block) => !days.includes(block.day)).map((block) => block.day))])
  const outOfRange = excluded.filter((block) => days.includes(block.day))
  const expanded = expandRange(range, outOfRange)
  const rangeError = range.end - range.start < 60 ? "El horario visible debe abarcar al menos una hora." : null
  const daysError = days.length ? null : "Elegí al menos un día."
  const blocked = !!rangeError || !!daysError || (excluded.length > 0 && !dropExcluded)
  const page = pageFromPreset(preset, custom)

  const toggleDay = (day: DayId, on: boolean) => setDays((current) => sortDays(on ? [...new Set([...current, day])] : current.filter((item) => item !== day)))

  const submit = async () => {
    if (blocked) return
    const settings: DocumentSettings = { title: title.trim() || "Mi horario", subtitle: subtitle.trim(), page, days, range, show }
    if (mode === "new") {
      const saved = themes.find((theme) => theme.id === themeId)
      const appearance = saved ? { ...saved.appearance, name: saved.name } : presetById(themeId)?.appearance
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

  return (
    <form
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Título" htmlFor={titleId}>
          <Input id={titleId} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Mi horario" maxLength={TEXT_LIMITS.title} autoFocus={mode === "new"} />
        </Field>
        <Field label="Subtítulo" htmlFor={subtitleId} hint="Opcional: cuatrimestre, curso, nombre…">
          <Input id={subtitleId} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="1.er cuatrimestre 2026" maxLength={TEXT_LIMITS.subtitle} />
        </Field>
      </div>

      <section className="grid gap-2">
        <SectionTitle>Tamaño</SectionTitle>
        <RadioCards
          aria-label="Tamaño del documento"
          minColumnWidth={150}
          value={preset}
          onValueChange={(value) => setPreset(value as PagePreset)}
          options={[
            ...(Object.entries(PAGE_PRESETS) as [Exclude<PagePreset, "custom">, (typeof PAGE_PRESETS)[keyof typeof PAGE_PRESETS]][]).map(([id, item]) => ({
              value: id,
              label: item.label,
              meta: `${item.width} × ${item.height}`,
              icon: <PageIcon width={item.width} height={item.height} />,
            })),
            { value: "custom", label: "Personalizado", meta: `${custom.width} × ${custom.height}`, icon: <PageIcon width={custom.width} height={custom.height} /> },
          ]}
        />
        {preset === "custom" ? (
          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Ancho" value={custom.width} min={PAGE_LIMITS.min} max={PAGE_LIMITS.max} step={10} largeStep={100} suffix=" px" onValueChange={(width) => setCustom((current) => ({ ...current, width }))} />
            <NumberField label="Alto" value={custom.height} min={PAGE_LIMITS.min} max={PAGE_LIMITS.max} step={10} largeStep={100} suffix=" px" onValueChange={(height) => setCustom((current) => ({ ...current, height }))} />
          </div>
        ) : null}
      </section>

      <section className="grid gap-2">
        <SectionTitle
          action={
            <div className="flex gap-1">
              <Button type="button" size="xs" variant="ghost" onClick={() => setDays(["mon", "tue", "wed", "thu", "fri"])}>
                Lun a vie
              </Button>
              <Button type="button" size="xs" variant="ghost" onClick={() => setDays(["mon", "tue", "wed", "thu", "fri", "sat"])}>
                Lun a sáb
              </Button>
              <Button type="button" size="xs" variant="ghost" onClick={() => setDays(DAYS.map((day) => day.id))}>
                Todos
              </Button>
            </div>
          }
        >
          Días
        </SectionTitle>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4" role="group" aria-label="Días visibles">
          {DAYS.map((day) => (
            <Checkbox key={day.id} label={day.label} checked={days.includes(day.id)} onCheckedChange={(value) => toggleDay(day.id, value === true)} />
          ))}
        </div>
        {daysError ? <p className="text-xs text-destructive">{daysError}</p> : null}
      </section>

      <section className="grid gap-2">
        <SectionTitle>Horario visible</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <TimeField label="Desde" value={range.start} max={range.end - 60} onChange={(start) => setRange((current) => ({ ...current, start }))} />
          <TimeField label="Hasta" end value={range.end} min={range.start + 60} onChange={(end) => setRange((current) => ({ ...current, end }))} />
        </div>
        {rangeError ? <p className="text-xs text-destructive">{rangeError}</p> : null}
      </section>

      {excluded.length ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" role="alert">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />
            {excluded.length === 1 ? "1 clase quedaría fuera del documento" : `${excluded.length} clases quedarían fuera del documento`}
          </p>
          <ul className="mt-1.5 list-disc pl-5 text-xs text-muted-foreground">
            {excluded.slice(0, 5).map((block) => (
              <li key={block.id}>{doc ? describeBlock(doc, block) : null}</li>
            ))}
            {excluded.length > 5 ? <li>y {excluded.length - 5} más</li> : null}
          </ul>
          <div className="mt-2 flex flex-wrap gap-1.5">
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
          <div className="mt-3">
            <Checkbox label={excluded.length === 1 ? "Eliminar esa clase al guardar" : `Eliminar esas ${excluded.length} clases al guardar`} checked={dropExcluded} onCheckedChange={(value) => setDropExcluded(value === true)} />
          </div>
        </div>
      ) : null}

      {mode === "new" ? (
        <Field label="Tema" htmlFor={themeField} hint="Podés cambiar colores y fuentes en cualquier momento.">
          <NativeSelect id={themeField} value={themeId} onChange={(event) => setThemeId(event.target.value)}>
            <optgroup label="Temas incluidos">
              {THEME_PRESETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.appearance.name}
                </option>
              ))}
            </optgroup>
            {themes.length ? (
              <optgroup label="Mis temas">
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </NativeSelect>
        </Field>
      ) : (
        <section className="grid gap-1">
          <SectionTitle>Mostrar en el documento</SectionTitle>
          <div className="grid gap-x-6 sm:grid-cols-2">
            {SHOW_LABELS.map(([key, label]) => (
              <SwitchRow key={key} label={label} checked={show[key]} onCheckedChange={(value) => setShow((current) => ({ ...current, [key]: value }))} />
            ))}
          </div>
        </section>
      )}

      <DialogFooter>
        <span className="mr-auto text-xs text-muted-foreground tabular-nums">
          {page.width} × {page.height} px
        </span>
        <Button type="button" variant="ghost" onClick={() => useEditor.getState().closeDialog()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={blocked}>
          {mode === "new" ? "Crear proyecto" : "Guardar cambios"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function NewProjectDialog() {
  return (
    <DialogShell name="new-project" title="Nuevo proyecto" description="Elegí el formato del horario. Todo se puede cambiar después." width={640}>
      <ProjectForm mode="new" />
    </DialogShell>
  )
}

export function SettingsDialog() {
  return (
    <DialogShell name="settings" title="Ajustes del documento" description="Título, tamaño, días y horario visible." width={640}>
      <ProjectForm mode="settings" />
    </DialogShell>
  )
}
