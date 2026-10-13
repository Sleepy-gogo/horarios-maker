import { useState, type ReactNode } from "react"
import { Check, Download, Loader2, Star, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { NumberField } from "@/components/arc/number-field/number-field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createId, nowIso } from "@/domain/document"
import { THEME_FORMAT, downloadJson, slugify } from "@/domain/files"
import { THEME_PRESETS } from "@/domain/presets"
import type { Appearance, SavedTheme, ScheduleDocument, TextRole } from "@/domain/types"
import { useRendered } from "@/hooks/use-rendered"
import { cn } from "@/lib/utils"
import { useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
import { ColorField, Field, NativeSelect, SectionTitle, SwitchRow } from "../common"
import { useFieldId } from "../platform"
import { applyAppearance } from "../commands"
import { FontPicker } from "./FontPicker"
import { Preview } from "./Preview"
import { DialogFooter, DialogShell } from "./shell"
import { dialogPayload } from "./payload"

type Tab = "themes" | "colors" | "type" | "grid" | "blocks" | "page"

const ROLES: [TextRole, string][] = [
  ["title", "Título"],
  ["subtitle", "Subtítulo"],
  ["day", "Días"],
  ["hour", "Horas"],
  ["blockTitle", "Nombre de la materia"],
  ["blockMeta", "Detalles de la clase"],
  ["legend", "Leyenda"],
]

const PRESET_NAMES = new Set(THEME_PRESETS.map((preset) => preset.appearance.name))

function ThemeCard({ appearance, active, onSelect, children }: { appearance: Appearance; active: boolean; onSelect: () => void; children?: ReactNode }) {
  return (
    <div className={cn("group relative overflow-hidden rounded-xl border bg-card transition-colors", active ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/30")}>
      <button type="button" aria-pressed={active} onClick={onSelect} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="relative h-16" style={{ background: appearance.page.backgroundEnd ? `linear-gradient(135deg, ${appearance.page.background}, ${appearance.page.backgroundEnd})` : appearance.page.background }}>
          <div className="absolute inset-x-3 top-3 bottom-0 rounded-t-md p-2" style={{ background: appearance.sheet.show ? appearance.sheet.fill : appearance.grid.bodyFill }}>
            <div className="h-1.5 w-10 rounded-full" style={{ background: appearance.colors.ink }} />
            <div className="mt-1.5 flex gap-1">
              {appearance.palette.slice(0, 5).map((color, index) => (
                <span key={index} className="h-4 flex-1 rounded-sm" style={{ background: color }} />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <span className="truncate text-sm font-medium">{appearance.name}</span>
          {active ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
        </div>
      </button>
      {children}
    </div>
  )
}

function ThemesTab({ draft, setLook, recolor, setRecolor, autoSave }: { draft: Appearance; setLook: (look: Appearance) => void; recolor: boolean; setRecolor: (value: boolean) => void; autoSave: boolean }) {
  const themes = useStudio((state) => state.themes)
  const prefs = useStudio((state) => state.prefs)
  const [name, setName] = useState(PRESET_NAMES.has(draft.name) ? "" : draft.name)
  const nameId = useFieldId("theme-name")
  const existing = themes.find((theme) => theme.name.trim().toLocaleLowerCase("es") === name.trim().toLocaleLowerCase("es"))

  const save = async () => {
    const clean = name.trim()
    if (!clean) return
    const theme: SavedTheme = existing
      ? { ...existing, appearance: { ...draft, name: clean }, updatedAt: nowIso() }
      : { id: createId("thm"), name: clean, themeSchemaVersion: 1, appearance: { ...draft, name: clean }, createdAt: nowIso(), updatedAt: nowIso() }
    try {
      await useStudio.getState().saveTheme(theme)
      setLook({ ...draft, name: clean })
      toast.success(existing ? `Tema "${clean}" actualizado` : `Tema "${clean}" guardado`)
    } catch {
      toast.error("No se pudo guardar el tema en este navegador")
    }
  }

  const remove = async (theme: SavedTheme) => {
    const removed = await useStudio.getState().removeTheme(theme.id)
    if (removed) toast(`Se eliminó el tema "${removed.name}"`, { action: { label: "Deshacer", onClick: () => void useStudio.getState().saveTheme(removed) } })
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <SectionTitle>Temas incluidos</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {THEME_PRESETS.map((preset) => (
            <ThemeCard key={preset.id} appearance={preset.appearance} active={draft.name === preset.appearance.name} onSelect={() => setLook(structuredClone(preset.appearance))} />
          ))}
        </div>
      </section>

      <section className="grid gap-2">
        <SectionTitle>Mis temas</SectionTitle>
        {themes.length ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {themes.map((theme) => (
              <ThemeCard key={theme.id} appearance={{ ...theme.appearance, name: theme.name }} active={draft.name === theme.name} onSelect={() => setLook({ ...structuredClone(theme.appearance), name: theme.name })}>
                <div className="flex items-center justify-end gap-0.5 border-t border-border px-1.5 py-1">
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    aria-label={prefs.defaultThemeId === theme.id ? `${theme.name} es el tema para proyectos nuevos` : `Usar ${theme.name} en proyectos nuevos`}
                    aria-pressed={prefs.defaultThemeId === theme.id}
                    title="Tema para proyectos nuevos"
                    onClick={() => useStudio.getState().setPrefs({ defaultThemeId: prefs.defaultThemeId === theme.id ? undefined : theme.id })}
                  >
                    <Star className={cn(prefs.defaultThemeId === theme.id && "fill-current text-warning")} />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`Descargar ${theme.name}`} title="Descargar" onClick={() => downloadJson({ format: THEME_FORMAT, themeSchemaVersion: 1, theme }, `tema-${slugify(theme.name)}.json`)}>
                    <Download />
                  </Button>
                  <Button size="icon-xs" variant="ghost" aria-label={`Eliminar ${theme.name}`} title="Eliminar" onClick={() => void remove(theme)}>
                    <Trash2 />
                  </Button>
                </div>
              </ThemeCard>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Ajustá colores y fuentes y guardalos como tema para reutilizarlos en otros proyectos.</p>
        )}
        <Button variant="ghost" size="sm" className="justify-self-start" onClick={() => useEditor.getState().openDialog("import")}>
          <Upload /> Importar tema…
        </Button>
      </section>

      <section className="grid gap-2 rounded-xl border border-border p-3">
        <Field label="Guardar la apariencia actual como tema" htmlFor={nameId} hint={existing ? `Se actualizará "${existing.name}".` : "Queda disponible para todos tus proyectos."}>
          <div className="flex gap-2">
            <Input id={nameId} value={name} maxLength={60} placeholder="Nombre del tema" autoFocus={autoSave} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void save()} />
            <Button variant="outline" disabled={!name.trim()} onClick={() => void save()}>
              {existing ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </Field>
      </section>

      <SwitchRow label="Recolorear las materias con la paleta del tema" description="Si está apagado, cada materia conserva sus colores." checked={recolor} onCheckedChange={setRecolor} />
    </div>
  )
}

function ColorsTab({ draft, update }: { draft: Appearance; update: (recipe: (look: Appearance) => void) => void }) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <SectionTitle>Página</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label="Fondo" value={draft.page.background} onChange={(color) => update((look) => void (look.page.background = color))} />
          {draft.page.backgroundEnd ? <ColorField label="Fondo (degradado)" value={draft.page.backgroundEnd} onChange={(color) => update((look) => void (look.page.backgroundEnd = color))} /> : null}
        </div>
        <SwitchRow label="Fondo en degradado" checked={!!draft.page.backgroundEnd} onCheckedChange={(on) => update((look) => void (look.page.backgroundEnd = on ? look.sheet.fill : null))} />
      </section>
      <section className="grid gap-3">
        <SectionTitle>Textos y acento</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label="Texto principal" value={draft.colors.ink} background={draft.sheet.show ? draft.sheet.fill : draft.page.background} onChange={(color) => update((look) => void (look.colors.ink = color))} />
          <ColorField label="Texto secundario" value={draft.colors.muted} background={draft.sheet.show ? draft.sheet.fill : draft.page.background} onChange={(color) => update((look) => void (look.colors.muted = color))} />
          <ColorField label="Acento" value={draft.colors.accent} onChange={(color) => update((look) => void (look.colors.accent = color))} />
        </div>
      </section>
      <section className="grid gap-3">
        <SectionTitle>Hoja y grilla</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <ColorField label="Hoja" value={draft.sheet.fill} onChange={(color) => update((look) => void (look.sheet.fill = color))} />
          <ColorField label="Borde de la hoja" value={draft.sheet.borderColor} onChange={(color) => update((look) => void (look.sheet.borderColor = color))} />
          <ColorField label="Encabezado de la grilla" value={draft.grid.headerFill} onChange={(color) => update((look) => void (look.grid.headerFill = color))} />
          <ColorField label="Fondo de la grilla" value={draft.grid.bodyFill} onChange={(color) => update((look) => void (look.grid.bodyFill = color))} />
          <ColorField label="Líneas" value={draft.grid.lineColor} onChange={(color) => update((look) => void (look.grid.lineColor = color))} />
          <ColorField label="Franjas" value={draft.grid.stripeColor} onChange={(color) => update((look) => void (look.grid.stripeColor = color))} />
        </div>
      </section>
      <section className="grid gap-3">
        <SectionTitle
          action={
            <div className="flex gap-1">
              <Button size="xs" variant="ghost" disabled={draft.palette.length >= 24} onClick={() => update((look) => void look.palette.push(look.colors.accent))}>
                Agregar
              </Button>
              <Button size="xs" variant="ghost" disabled={draft.palette.length <= 1} onClick={() => update((look) => void look.palette.pop())}>
                Quitar
              </Button>
            </div>
          }
        >
          Paleta para materias nuevas
        </SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          {draft.palette.map((color, index) => (
            <ColorField key={index} label={`Color ${index + 1}`} value={color} onChange={(next) => update((look) => void (look.palette[index] = next))} />
          ))}
        </div>
      </section>
    </div>
  )
}

function TypeTab({ draft, update }: { draft: Appearance; update: (recipe: (look: Appearance) => void) => void }) {
  return (
    <div className="grid gap-3">
      {ROLES.map(([role, label]) => {
        const style = draft.type[role]
        return (
          <section key={role} className="grid gap-3 rounded-xl border border-border p-3">
            <SectionTitle
              action={
                <Button size="xs" variant="ghost" onClick={() => update((look) => ROLES.forEach(([other]) => (look.type[other].font = { ...style.font, weight: look.type[other].font.weight })))}>
                  Usar esta familia en todo
                </Button>
              }
            >
              {label}
            </SectionTitle>
            <FontPicker label={label} value={style.font} onChange={(font) => update((look) => void (look.type[role].font = font))} />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <NumberField label="Tamaño" size="sm" value={style.size} min={6} max={200} step={0.5} largeStep={4} suffix=" px" formatOptions={{ maximumFractionDigits: 1 }} onValueChange={(value) => update((look) => void (look.type[role].size = value))} />
              <NumberField label="Espaciado" size="sm" value={Math.round(style.letterSpacing * 1000) / 10} min={-20} max={60} step={0.5} suffix=" %" formatOptions={{ maximumFractionDigits: 1 }} onValueChange={(value) => update((look) => void (look.type[role].letterSpacing = value / 100))} />
              <NumberField label="Interlineado" size="sm" value={style.lineHeight} min={0.8} max={2.4} step={0.05} formatOptions={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} onValueChange={(value) => update((look) => void (look.type[role].lineHeight = value))} />
            </div>
            <SwitchRow label="Mayúsculas" checked={style.uppercase} onCheckedChange={(on) => update((look) => void (look.type[role].uppercase = on))} />
          </section>
        )
      })}
    </div>
  )
}

function GridTab({ draft, update }: { draft: Appearance; update: (recipe: (look: Appearance) => void) => void }) {
  const hourId = useFieldId("hour-format")
  const alignId = useFieldId("header-align")
  const legendId = useFieldId("legend-style")
  const legendTitleId = useFieldId("legend-title")
  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <SectionTitle>Grilla</SectionTitle>
        <Field label="Formato de hora" htmlFor={hourId}>
          <NativeSelect id={hourId} value={draft.grid.hourFormat} onChange={(event) => update((look) => void (look.grid.hourFormat = event.target.value as Appearance["grid"]["hourFormat"]))}>
            <option value="HH:mm">08:00</option>
            <option value="H:mm">8:00</option>
            <option value="H">8</option>
          </NativeSelect>
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField label="Grosor de líneas" size="sm" value={draft.grid.lineWidth} min={0} max={12} step={0.5} suffix=" px" formatOptions={{ maximumFractionDigits: 1 }} onValueChange={(value) => update((look) => void (look.grid.lineWidth = value))} />
          <NumberField label="Separación de días" size="sm" value={draft.grid.columnGap} min={0} max={60} suffix=" px" onValueChange={(value) => update((look) => void (look.grid.columnGap = value))} />
          <NumberField label="Redondeo" size="sm" value={draft.grid.radius} min={0} max={80} suffix=" px" onValueChange={(value) => update((look) => void (look.grid.radius = value))} />
        </div>
        <SwitchRow label="Líneas cada media hora" checked={draft.grid.halfHourLines} onCheckedChange={(on) => update((look) => void (look.grid.halfHourLines = on))} />
        <SwitchRow label="Franjas alternadas por hora" checked={draft.grid.stripes} onCheckedChange={(on) => update((look) => void (look.grid.stripes = on))} />
      </section>
      <section className="grid gap-3">
        <SectionTitle>Encabezado</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alineación" htmlFor={alignId}>
            <NativeSelect id={alignId} value={draft.header.align} onChange={(event) => update((look) => void (look.header.align = event.target.value as "start" | "center"))}>
              <option value="center">Centrado</option>
              <option value="start">A la izquierda</option>
            </NativeSelect>
          </Field>
          <NumberField label="Espacio debajo" size="sm" value={draft.header.gap} min={0} max={200} suffix=" px" onValueChange={(value) => update((look) => void (look.header.gap = value))} />
        </div>
      </section>
      <section className="grid gap-3">
        <SectionTitle>Leyenda</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estilo" htmlFor={legendId}>
            <NativeSelect id={legendId} value={draft.legend.style} onChange={(event) => update((look) => void (look.legend.style = event.target.value as "chips" | "list"))}>
              <option value="chips">Etiquetas</option>
              <option value="list">Lista con puntos</option>
            </NativeSelect>
          </Field>
          <Field label="Título" htmlFor={legendTitleId}>
            <Input id={legendTitleId} value={draft.legend.title} maxLength={40} disabled={!draft.legend.showTitle} onChange={(event) => update((look) => void (look.legend.title = event.target.value))} />
          </Field>
        </div>
        <SwitchRow label="Mostrar título de la leyenda" checked={draft.legend.showTitle} onCheckedChange={(on) => update((look) => void (look.legend.showTitle = on))} />
      </section>
    </div>
  )
}

function BlocksTab({ draft, update }: { draft: Appearance; update: (recipe: (look: Appearance) => void) => void }) {
  const styleId = useFieldId("block-style")
  const alignId = useFieldId("block-align")
  const auto = draft.blocks.borderColor === "auto"
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Relleno" htmlFor={styleId}>
          <NativeSelect id={styleId} value={draft.blocks.style} onChange={(event) => update((look) => void (look.blocks.style = event.target.value as Appearance["blocks"]["style"]))}>
            <option value="solid">Color pleno</option>
            <option value="soft">Suave</option>
            <option value="outline">Solo contorno</option>
          </NativeSelect>
        </Field>
        <Field label="Texto" htmlFor={alignId}>
          <NativeSelect id={alignId} value={draft.blocks.align} onChange={(event) => update((look) => void (look.blocks.align = event.target.value as "center" | "start"))}>
            <option value="center">Centrado</option>
            <option value="start">Arriba a la izquierda</option>
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="Redondeo" size="sm" value={draft.blocks.radius} min={0} max={60} suffix=" px" onValueChange={(value) => update((look) => void (look.blocks.radius = value))} />
        <NumberField label="Margen" size="sm" value={draft.blocks.inset} min={0} max={30} suffix=" px" onValueChange={(value) => update((look) => void (look.blocks.inset = value))} />
        <NumberField label="Relleno interno" size="sm" value={draft.blocks.padding} min={0} max={40} suffix=" px" onValueChange={(value) => update((look) => void (look.blocks.padding = value))} />
        <NumberField label="Borde" size="sm" value={draft.blocks.borderWidth} min={0} max={12} step={0.5} suffix=" px" formatOptions={{ maximumFractionDigits: 1 }} onValueChange={(value) => update((look) => void (look.blocks.borderWidth = value))} />
      </div>
      <SwitchRow label="Color de borde automático" description="Un tono más oscuro del color de cada materia." checked={auto} onCheckedChange={(on) => update((look) => void (look.blocks.borderColor = on ? "auto" : look.colors.ink))} />
      {!auto ? <ColorField label="Color de borde" value={draft.blocks.borderColor} onChange={(color) => update((look) => void (look.blocks.borderColor = color))} /> : null}
      <SwitchRow label="Barra de color a la izquierda" checked={draft.blocks.showAccentBar} onCheckedChange={(on) => update((look) => void (look.blocks.showAccentBar = on))} />
    </div>
  )
}

function PageTab({ draft, update }: { draft: Appearance; update: (recipe: (look: Appearance) => void) => void }) {
  return (
    <div className="grid gap-4">
      <NumberField label="Margen de la página" size="sm" value={draft.page.margin} min={0} max={300} suffix=" px" onValueChange={(value) => update((look) => void (look.page.margin = value))} />
      <SwitchRow label="Hoja sobre el fondo" description="Una tarjeta que contiene el horario." checked={draft.sheet.show} onCheckedChange={(on) => update((look) => void (look.sheet.show = on))} />
      {draft.sheet.show ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <NumberField label="Relleno de la hoja" size="sm" value={draft.sheet.padding} min={0} max={200} suffix=" px" onValueChange={(value) => update((look) => void (look.sheet.padding = value))} />
          <NumberField label="Redondeo" size="sm" value={draft.sheet.radius} min={0} max={120} suffix=" px" onValueChange={(value) => update((look) => void (look.sheet.radius = value))} />
          <NumberField label="Borde" size="sm" value={draft.sheet.borderWidth} min={0} max={20} step={0.5} suffix=" px" formatOptions={{ maximumFractionDigits: 1 }} onValueChange={(value) => update((look) => void (look.sheet.borderWidth = value))} />
        </div>
      ) : null}
      <SwitchRow label="Formas decorativas" description="Círculos suaves con el color de acento." checked={draft.decorations.accentShapes} onCheckedChange={(on) => update((look) => void (look.decorations.accentShapes = on))} />
    </div>
  )
}

function AppearanceBody({ doc }: { doc: ScheduleDocument }) {
  const [draft, setDraft] = useState<Appearance>(() => structuredClone(doc.appearance))
  const [tab, setTab] = useState<Tab>(() => dialogPayload<Tab>("tab") ?? "themes")
  const [recolor, setRecolor] = useState(false)
  const [autoSave] = useState(() => !!dialogPayload<boolean>("save"))
  const preview = { ...doc, appearance: draft }
  const rendered = useRendered(preview, "pv")
  const changed = JSON.stringify(draft) !== JSON.stringify(doc.appearance)

  const update = (recipe: (look: Appearance) => void) => {
    setDraft((current) => {
      const next = structuredClone(current)
      recipe(next)
      if (PRESET_NAMES.has(next.name)) next.name = `${next.name} (ajustado)`
      return next
    })
  }

  const apply = () => {
    if (changed || recolor) applyAppearance(draft, { label: recolor ? "Aplicar tema y recolorear materias" : "Cambiar apariencia", recolor })
    useEditor.getState().closeDialog()
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0">
        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList aria-label="Secciones de apariencia">
            <TabsTrigger value="themes" className="min-w-0! px-3!">Temas</TabsTrigger>
            <TabsTrigger value="colors" className="min-w-0! px-3!">Colores</TabsTrigger>
            <TabsTrigger value="type" className="min-w-0! px-3!">Fuentes</TabsTrigger>
            <TabsTrigger value="grid" className="min-w-0! px-3!">Grilla</TabsTrigger>
            <TabsTrigger value="blocks" className="min-w-0! px-3!">Clases</TabsTrigger>
            <TabsTrigger value="page" className="min-w-0! px-3!">Página</TabsTrigger>
          </TabsList>
          <TabsContent value="themes" className="text-foreground!">
            <ThemesTab draft={draft} setLook={setDraft} recolor={recolor} setRecolor={setRecolor} autoSave={autoSave} />
          </TabsContent>
          <TabsContent value="colors" className="text-foreground!">
            <ColorsTab draft={draft} update={update} />
          </TabsContent>
          <TabsContent value="type" className="text-foreground!">
            <TypeTab draft={draft} update={update} />
          </TabsContent>
          <TabsContent value="grid" className="text-foreground!">
            <GridTab draft={draft} update={update} />
          </TabsContent>
          <TabsContent value="blocks" className="text-foreground!">
            <BlocksTab draft={draft} update={update} />
          </TabsContent>
          <TabsContent value="page" className="text-foreground!">
            <PageTab draft={draft} update={update} />
          </TabsContent>
        </Tabs>
      </div>
      <div className="order-first min-w-0 lg:order-none">
        <div className="lg:sticky lg:top-0">
          {rendered ? (
            <Preview svg={rendered.svg} width={rendered.scene.width} height={rendered.scene.height} className="h-48 sm:h-64 lg:h-[min(62dvh,560px)]" />
          ) : (
            <div className="grid h-48 place-items-center rounded-xl border border-border text-sm text-muted-foreground sm:h-64" role="status">
              <span className="inline-flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando fuentes…
              </span>
            </div>
          )}
          {rendered?.scene.issues.length ? (
            <ul className="mt-2 grid gap-1 text-xs">
              {rendered.scene.issues.slice(0, 4).map((issue, index) => (
                <li key={index} className={issue.level === "error" ? "text-destructive" : "text-warning"}>
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">Vista previa con tus materias y clases. Nada cambia hasta que aplicás.</p>
          )}
        </div>
      </div>
      <DialogFooter className="lg:col-span-2">
        <Button variant="ghost" className="mr-auto" disabled={!changed} onClick={() => setDraft(structuredClone(doc.appearance))}>
          Descartar ajustes
        </Button>
        <Button variant="ghost" onClick={() => useEditor.getState().closeDialog()}>
          Cancelar
        </Button>
        <Button onClick={apply} disabled={!changed && !recolor}>
          Aplicar
        </Button>
      </DialogFooter>
    </div>
  )
}

export function AppearanceDialog() {
  const doc = useStudio((state) => state.session?.doc)
  return (
    <DialogShell name="appearance" title="Apariencia del documento" width={1120}>
      {doc ? <AppearanceBody doc={doc} /> : null}
    </DialogShell>
  )
}
