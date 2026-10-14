import { useState } from "react"
import { Download, MoreHorizontal, Plus, Star, Trash2, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { NumberField } from "@/components/arc/number-field/number-field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { readableText } from "@/domain/color"
import { createId, nowIso } from "@/domain/document"
import { THEME_FORMAT, downloadJson, slugify } from "@/domain/files"
import { THEME_PRESETS } from "@/domain/presets"
import type { Appearance, SavedTheme, ScheduleDocument, TextRole } from "@/domain/types"
import { useRendered } from "@/hooks/use-rendered"
import { cn } from "@/lib/utils"
import { useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
import { ChoiceTiles, ColorField, Field, Segmented, SectionTitle, SwitchRow } from "../common"
import { useFieldId } from "../platform"
import { applyAppearance } from "../commands"
import { FontPicker } from "./FontPicker"
import { Preview, PreviewPane } from "./Preview"
import { ThemeSwatch } from "./ThemeSwatch"
import { DialogFooter, DialogShell, SplitBody } from "./shell"
import { dialogPayload } from "./payload"

type Tab = "themes" | "colors" | "type" | "grid" | "blocks" | "page"
type Update = (recipe: (look: Appearance) => void) => void

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

function SavedThemeRow({ theme, active, isDefault, onSelect }: { theme: SavedTheme; active: boolean; isDefault: boolean; onSelect: () => void }) {
  const remove = async () => {
    const removed = await useStudio.getState().removeTheme(theme.id)
    if (removed) toast(`Se eliminó el tema "${removed.name}"`, { action: { label: "Deshacer", onClick: () => void useStudio.getState().saveTheme(removed) } })
  }
  return (
    <li className={cn("flex items-center gap-1 rounded-xl border p-1 pr-1.5 transition-colors", active ? "border-primary shadow-[0_0_0_1px_var(--primary)]" : "border-border hover:border-foreground/25")}>
      <button type="button" aria-pressed={active} onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        <span className="w-16 shrink-0 overflow-hidden rounded-md border border-border">
          <ThemeSwatch appearance={theme.appearance} className="h-9" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{theme.name}</span>
          {isDefault ? <span className="block text-xs text-muted-foreground">Para proyectos nuevos</span> : null}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button type="button" size="icon-sm" variant="ghost" aria-label={`Más acciones para ${theme.name}`} />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-56" align="end">
          <DropdownMenuItem onClick={() => useStudio.getState().setPrefs({ defaultThemeId: isDefault ? undefined : theme.id })}>
            <Star className={cn(isDefault && "fill-current text-warning")} /> {isDefault ? "Dejar de usar en proyectos nuevos" : "Usar en proyectos nuevos"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => downloadJson({ format: THEME_FORMAT, themeSchemaVersion: 1, theme }, `tema-${slugify(theme.name)}.json`)}>
            <Download /> Descargar
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => void remove()}>
            <Trash2 /> Eliminar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

function ThemesTab({ draft, setLook, recolor, setRecolor, autoSave }: { draft: Appearance; setLook: (look: Appearance) => void; recolor: boolean; setRecolor: (value: boolean) => void; autoSave: boolean }) {
  const themes = useStudio((state) => state.themes)
  const prefs = useStudio((state) => state.prefs)
  const [name, setName] = useState(PRESET_NAMES.has(draft.name) ? "" : draft.name.replace(/ \(ajustado\)$/, ""))
  const nameId = useFieldId("theme-name")
  const existing = themes.find((theme) => theme.name.trim().toLocaleLowerCase("es") === name.trim().toLocaleLowerCase("es"))
  const presetId = THEME_PRESETS.find((preset) => preset.appearance.name === draft.name)?.id ?? ""

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

  return (
    <div className="grid gap-7">
      <section className="grid gap-2.5">
        <SectionTitle>Temas incluidos</SectionTitle>
        <ChoiceTiles
          label="Temas incluidos"
          size="sm"
          className="grid-cols-2"
          value={presetId}
          onChange={(id) => setLook(structuredClone(THEME_PRESETS.find((preset) => preset.id === id)!.appearance))}
          options={THEME_PRESETS.map((preset) => ({ value: preset.id, label: preset.appearance.name, visual: <ThemeSwatch appearance={preset.appearance} className="h-16" /> }))}
        />
        <SwitchRow label="Recolorear las materias" description="Usa la paleta del tema en todas tus materias al aplicar." checked={recolor} onCheckedChange={setRecolor} />
      </section>

      <section className="grid gap-2.5">
        <SectionTitle
          action={
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={() => useEditor.getState().openDialog("import")}>
              <Upload /> Importar
            </Button>
          }
        >
          Mis temas
        </SectionTitle>
        {themes.length ? (
          <ul className="grid gap-1.5">
            {themes.map((theme) => (
              <SavedThemeRow key={theme.id} theme={theme} active={draft.name === theme.name} isDefault={prefs.defaultThemeId === theme.id} onSelect={() => setLook({ ...structuredClone(theme.appearance), name: theme.name })} />
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-xs leading-relaxed text-muted-foreground">Ajustá colores y fuentes, y guardalos acá para usarlos en otros proyectos.</p>
        )}
        <Field label="Guardar la apariencia actual" htmlFor={nameId} hint={existing ? `Reemplaza "${existing.name}".` : undefined}>
          <div className="flex gap-2">
            <Input id={nameId} value={name} maxLength={60} placeholder="Nombre del tema" autoFocus={autoSave} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void save()} />
            <Button variant="outline" disabled={!name.trim()} onClick={() => void save()}>
              {existing ? "Actualizar" : "Guardar"}
            </Button>
          </div>
        </Field>
      </section>
    </div>
  )
}

/** The palette as a row of editable chips: tap one to change it, remove it with its ×, or add another. */
function PaletteEditor({ draft, update }: { draft: Appearance; update: Update }) {
  const [editing, setEditing] = useState(0)
  const index = Math.min(editing, draft.palette.length - 1)
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Colores de la paleta">
        {draft.palette.map((color, position) => (
          <span key={position} className="group/chip relative">
            <button
              type="button"
              aria-label={`Editar color ${position + 1}, ${color}`}
              aria-pressed={position === index}
              onClick={() => setEditing(position)}
              className={cn("block size-8 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:size-9", position === index && "ring-2 ring-foreground ring-offset-2 ring-offset-[var(--popover)]")}
              style={{ background: color }}
            />
            {draft.palette.length > 1 ? (
              <button
                type="button"
                aria-label={`Quitar color ${position + 1}`}
                onClick={() => {
                  update((look) => void look.palette.splice(position, 1))
                  setEditing(Math.max(0, position - 1))
                }}
                className="absolute -top-1.5 -right-1.5 grid size-4 place-items-center rounded-full border border-border bg-popover text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover/chip:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100 hover:text-foreground"
              >
                <X className="size-2.5" strokeWidth={3} />
              </button>
            ) : null}
          </span>
        ))}
        <button
          type="button"
          aria-label="Agregar color"
          disabled={draft.palette.length >= 24}
          onClick={() => {
            update((look) => void look.palette.push(look.colors.accent))
            setEditing(draft.palette.length)
          }}
          className="grid size-8 place-items-center rounded-full border border-dashed border-input text-muted-foreground outline-none hover:border-foreground/40 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-40 pointer-coarse:size-9"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <ColorField key={index} label={`Color ${index + 1}`} value={draft.palette[index]!} onChange={(next) => update((look) => void (look.palette[index] = next))} />
    </div>
  )
}

function ColorsTab({ draft, update }: { draft: Appearance; update: Update }) {
  const surface = draft.sheet.show ? draft.sheet.fill : draft.page.background
  return (
    <div className="grid gap-7">
      <section className="grid gap-3">
        <SectionTitle description="Se asigna a cada materia nueva, en orden.">Paleta de materias</SectionTitle>
        <PaletteEditor draft={draft} update={update} />
      </section>
      <section className="grid gap-3">
        <SectionTitle>Texto</SectionTitle>
        <ColorField label="Principal" value={draft.colors.ink} background={surface} onChange={(color) => update((look) => void (look.colors.ink = color))} />
        <ColorField label="Secundario" value={draft.colors.muted} background={surface} onChange={(color) => update((look) => void (look.colors.muted = color))} />
        <ColorField label="Acento" value={draft.colors.accent} background={surface} onChange={(color) => update((look) => void (look.colors.accent = color))} />
      </section>
      <section className="grid gap-3">
        <SectionTitle>Fondo</SectionTitle>
        <ColorField label="Página" value={draft.page.background} onChange={(color) => update((look) => void (look.page.background = color))} />
        {draft.sheet.show ? (
          <>
            <ColorField label="Hoja" value={draft.sheet.fill} onChange={(color) => update((look) => void (look.sheet.fill = color))} />
            <ColorField label="Borde de la hoja" value={draft.sheet.borderColor} onChange={(color) => update((look) => void (look.sheet.borderColor = color))} />
          </>
        ) : null}
        {draft.page.backgroundEnd ? (
          <ColorField label="Degradado hasta" value={draft.page.backgroundEnd} onChange={(color) => update((look) => void (look.page.backgroundEnd = color))} />
        ) : null}
        <SwitchRow label="Fondo en degradado" checked={!!draft.page.backgroundEnd} onCheckedChange={(on) => update((look) => void (look.page.backgroundEnd = on ? look.sheet.fill : null))} />
      </section>
      <section className="grid gap-3">
        <SectionTitle>Grilla</SectionTitle>
        <ColorField label="Encabezado" value={draft.grid.headerFill} onChange={(color) => update((look) => void (look.grid.headerFill = color))} />
        <ColorField label="Fondo" value={draft.grid.bodyFill} onChange={(color) => update((look) => void (look.grid.bodyFill = color))} />
        <ColorField label="Líneas" value={draft.grid.lineColor} onChange={(color) => update((look) => void (look.grid.lineColor = color))} />
        {draft.grid.stripes ? <ColorField label="Franjas" value={draft.grid.stripeColor} onChange={(color) => update((look) => void (look.grid.stripeColor = color))} /> : null}
      </section>
    </div>
  )
}

function TypeTab({ draft, update }: { draft: Appearance; update: Update }) {
  return (
    <div className="grid">
      {ROLES.map(([role, label], position) => {
        const style = draft.type[role]
        return (
          <section key={role} className={cn("grid gap-3 py-5", position > 0 && "border-t border-border", position === 0 && "pt-0")}>
            <SectionTitle
              action={
                <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => update((look) => ROLES.forEach(([other]) => (look.type[other].font = { ...style.font, weight: look.type[other].font.weight })))}>
                  Usar en todo
                </Button>
              }
            >
              {label}
            </SectionTitle>
            <FontPicker label={label} value={style.font} onChange={(font) => update((look) => void (look.type[role].font = font))} />
            <div className="grid grid-cols-3 gap-2">
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

function GridTab({ draft, update }: { draft: Appearance; update: Update }) {
  const legendTitleId = useFieldId("legend-title")
  return (
    <div className="grid gap-7">
      <section className="grid gap-3">
        <SectionTitle>Grilla</SectionTitle>
        <Segmented
          label="Formato de hora"
          value={draft.grid.hourFormat}
          onChange={(value) => update((look) => void (look.grid.hourFormat = value))}
          options={[
            { value: "HH:mm", label: "08:00" },
            { value: "H:mm", label: "8:00" },
            { value: "H", label: "8" },
          ]}
        />
        <div className="grid grid-cols-3 gap-2">
          <NumberField label="Líneas" size="sm" value={draft.grid.lineWidth} min={0} max={12} step={0.5} suffix=" px" formatOptions={{ maximumFractionDigits: 1 }} onValueChange={(value) => update((look) => void (look.grid.lineWidth = value))} />
          <NumberField label="Entre días" size="sm" value={draft.grid.columnGap} min={0} max={60} suffix=" px" onValueChange={(value) => update((look) => void (look.grid.columnGap = value))} />
          <NumberField label="Redondeo" size="sm" value={draft.grid.radius} min={0} max={80} suffix=" px" onValueChange={(value) => update((look) => void (look.grid.radius = value))} />
        </div>
        <div className="grid">
          <SwitchRow label="Líneas cada media hora" checked={draft.grid.halfHourLines} onCheckedChange={(on) => update((look) => void (look.grid.halfHourLines = on))} />
          <SwitchRow label="Franjas alternadas por hora" checked={draft.grid.stripes} onCheckedChange={(on) => update((look) => void (look.grid.stripes = on))} />
        </div>
      </section>
      <section className="grid gap-3">
        <SectionTitle>Encabezado</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Segmented
            label="Alineación"
            value={draft.header.align}
            onChange={(value) => update((look) => void (look.header.align = value))}
            options={[
              { value: "start", label: "Izquierda" },
              { value: "center", label: "Centro" },
            ]}
          />
          <NumberField label="Espacio debajo" size="sm" value={draft.header.gap} min={0} max={200} suffix=" px" onValueChange={(value) => update((look) => void (look.header.gap = value))} />
        </div>
      </section>
      <section className="grid gap-3">
        <SectionTitle>Leyenda</SectionTitle>
        <Segmented
          label="Estilo"
          value={draft.legend.style}
          onChange={(value) => update((look) => void (look.legend.style = value))}
          options={[
            { value: "chips", label: "Etiquetas" },
            { value: "list", label: "Lista" },
          ]}
        />
        <SwitchRow label="Mostrar título" checked={draft.legend.showTitle} onCheckedChange={(on) => update((look) => void (look.legend.showTitle = on))} />
        {draft.legend.showTitle ? (
          <Field label="Título" htmlFor={legendTitleId}>
            <Input id={legendTitleId} value={draft.legend.title} maxLength={40} onChange={(event) => update((look) => void (look.legend.title = event.target.value))} />
          </Field>
        ) : null}
      </section>
    </div>
  )
}

function BlocksTab({ draft, update }: { draft: Appearance; update: Update }) {
  const auto = draft.blocks.borderColor === "auto"
  return (
    <div className="grid gap-7">
      <section className="grid gap-3">
        <SectionTitle>Estilo</SectionTitle>
        <Segmented
          label="Relleno"
          value={draft.blocks.style}
          onChange={(value) => update((look) => void (look.blocks.style = value))}
          options={[
            { value: "solid", label: "Pleno" },
            { value: "soft", label: "Suave" },
            { value: "outline", label: "Contorno" },
          ]}
        />
        <Segmented
          label="Texto"
          value={draft.blocks.align}
          onChange={(value) => update((look) => void (look.blocks.align = value))}
          options={[
            { value: "start", label: "Arriba a la izquierda" },
            { value: "center", label: "Centrado" },
          ]}
        />
        <SwitchRow label="Barra de color a la izquierda" checked={draft.blocks.showAccentBar} onCheckedChange={(on) => update((look) => void (look.blocks.showAccentBar = on))} />
      </section>
      <section className="grid gap-3">
        <SectionTitle>Medidas</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="Redondeo" size="sm" value={draft.blocks.radius} min={0} max={60} suffix=" px" onValueChange={(value) => update((look) => void (look.blocks.radius = value))} />
          <NumberField label="Separación" size="sm" value={draft.blocks.inset} min={0} max={30} suffix=" px" onValueChange={(value) => update((look) => void (look.blocks.inset = value))} />
          <NumberField label="Relleno interno" size="sm" value={draft.blocks.padding} min={0} max={40} suffix=" px" onValueChange={(value) => update((look) => void (look.blocks.padding = value))} />
          <NumberField label="Borde" size="sm" value={draft.blocks.borderWidth} min={0} max={12} step={0.5} suffix=" px" formatOptions={{ maximumFractionDigits: 1 }} onValueChange={(value) => update((look) => void (look.blocks.borderWidth = value))} />
        </div>
        {draft.blocks.borderWidth > 0 || draft.blocks.style === "outline" ? (
          <>
            <SwitchRow label="Color de borde automático" description="Un tono más oscuro del color de cada materia." checked={auto} onCheckedChange={(on) => update((look) => void (look.blocks.borderColor = on ? "auto" : look.colors.ink))} />
            {!auto ? <ColorField label="Color de borde" value={draft.blocks.borderColor} onChange={(color) => update((look) => void (look.blocks.borderColor = color))} /> : null}
          </>
        ) : null}
      </section>
    </div>
  )
}

function PageTab({ draft, update }: { draft: Appearance; update: Update }) {
  return (
    <div className="grid gap-7">
      <section className="grid gap-3">
        <SectionTitle>Página</SectionTitle>
        <NumberField label="Margen" size="sm" value={draft.page.margin} min={0} max={300} suffix=" px" onValueChange={(value) => update((look) => void (look.page.margin = value))} />
      </section>
      <section className="grid gap-3">
        <SectionTitle>Hoja</SectionTitle>
        <SwitchRow label="Hoja sobre el fondo" description="Una tarjeta que contiene el horario." checked={draft.sheet.show} onCheckedChange={(on) => update((look) => void (look.sheet.show = on))} />
        {draft.sheet.show ? (
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Relleno" size="sm" value={draft.sheet.padding} min={0} max={200} suffix=" px" onValueChange={(value) => update((look) => void (look.sheet.padding = value))} />
            <NumberField label="Redondeo" size="sm" value={draft.sheet.radius} min={0} max={120} suffix=" px" onValueChange={(value) => update((look) => void (look.sheet.radius = value))} />
            <NumberField label="Borde" size="sm" value={draft.sheet.borderWidth} min={0} max={20} step={0.5} suffix=" px" formatOptions={{ maximumFractionDigits: 1 }} onValueChange={(value) => update((look) => void (look.sheet.borderWidth = value))} />
          </div>
        ) : null}
      </section>
      <section className="grid gap-3">
        <SectionTitle>Decoración</SectionTitle>
        <SwitchRow label="Formas decorativas" description="Círculos suaves con el color de acento." checked={draft.decorations.accentShapes} onCheckedChange={(on) => update((look) => void (look.decorations.accentShapes = on))} />
      </section>
    </div>
  )
}

const TABS: [Tab, string][] = [
  ["themes", "Temas"],
  ["colors", "Colores"],
  ["type", "Fuentes"],
  ["grid", "Grilla"],
  ["blocks", "Clases"],
  ["page", "Página"],
]

function AppearanceBody({ doc }: { doc: ScheduleDocument }) {
  const [draft, setDraft] = useState<Appearance>(() => structuredClone(doc.appearance))
  const [tab, setTab] = useState<Tab>(() => dialogPayload<Tab>("tab") ?? "themes")
  const [recolor, setRecolor] = useState(false)
  const [autoSave] = useState(() => !!dialogPayload<boolean>("save"))
  const preview = recolor ? { ...doc, appearance: draft, subjects: doc.subjects.map((subject, index) => { const color = draft.palette[index % draft.palette.length]!; return { ...subject, color, textColor: readableText(color) } }) } : { ...doc, appearance: draft }
  const rendered = useRendered(preview, "pv")
  const changed = JSON.stringify(draft) !== JSON.stringify(doc.appearance)
  const issues = rendered?.scene.issues ?? []

  const update: Update = (recipe) => {
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

  const controls = (
    <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
      <TabsList aria-label="Secciones de apariencia" shellClassName="appearance-tabs">
        {TABS.map(([value, label]) => (
          <TabsTrigger key={value} value={value} className="min-w-0! px-2.5!">
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="themes" className="pt-5 text-foreground!">
        <ThemesTab draft={draft} setLook={setDraft} recolor={recolor} setRecolor={setRecolor} autoSave={autoSave} />
      </TabsContent>
      <TabsContent value="colors" className="pt-5 text-foreground!">
        <ColorsTab draft={draft} update={update} />
      </TabsContent>
      <TabsContent value="type" className="pt-5 text-foreground!">
        <TypeTab draft={draft} update={update} />
      </TabsContent>
      <TabsContent value="grid" className="pt-5 text-foreground!">
        <GridTab draft={draft} update={update} />
      </TabsContent>
      <TabsContent value="blocks" className="pt-5 text-foreground!">
        <BlocksTab draft={draft} update={update} />
      </TabsContent>
      <TabsContent value="page" className="pt-5 text-foreground!">
        <PageTab draft={draft} update={update} />
      </TabsContent>
    </Tabs>
  )

  const notes = issues.length ? (
    <ul className="grid gap-0.5">
      {issues.slice(0, 3).map((issue, index) => (
        <li key={index} className={issue.level === "error" ? "text-destructive" : "text-warning"}>
          {issue.message}
        </li>
      ))}
    </ul>
  ) : null

  return (
    <SplitBody
      asideFirst
      mainWidth="24rem"
      main={controls}
      aside={
        <PreviewPane rendered={rendered} caption={changed || recolor ? "Vista previa con tus materias. Nada cambia hasta que aplicás." : "Vista previa con tus materias."}>
          {notes}
        </PreviewPane>
      }
      compactAside={
        // On phones the preview stays pinned above the controls, so every change is visible while scrolling.
        <div data-slot="appearance-preview" className="sticky -top-1 z-20 -mx-[var(--dlg-px)] -mt-1 border-b border-border bg-canvas px-[var(--dlg-px)] py-3">
          {rendered ? <Preview svg={rendered.svg} width={rendered.scene.width} height={rendered.scene.height} className="h-40" /> : <div className="h-40" />}
        </div>
      }
      footer={
        <DialogFooter>
          <Button variant="ghost" className="mr-auto text-muted-foreground max-sm:hidden" disabled={!changed && !recolor} onClick={() => { setDraft(structuredClone(doc.appearance)); setRecolor(false) }}>
            Descartar ajustes
          </Button>
          <Button variant="ghost" onClick={() => useEditor.getState().closeDialog()}>
            Cancelar
          </Button>
          <Button onClick={apply} disabled={!changed && !recolor}>
            Aplicar
          </Button>
        </DialogFooter>
      }
    />
  )
}

export function AppearanceDialog() {
  const doc = useStudio((state) => state.session?.doc)
  return (
    <DialogShell name="appearance" title="Apariencia" description="Tema, colores, fuentes y estilo del documento." width={1160} layout="split" sheet={0.94}>
      {doc ? <AppearanceBody doc={doc} /> : null}
    </DialogShell>
  )
}
