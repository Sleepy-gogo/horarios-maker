import { useState, type FormEvent } from "react"
import { CommandPalette, type CommandItem } from "@/components/arc/command-palette/command-palette"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CLASS_KINDS, DEFAULT_DURATION, MAX_SUBJECTS, TEXT_LIMITS } from "@/domain/constants"
import { cn } from "@/lib/utils"
import { readableText } from "@/domain/color"
import { expandRange, findSubjectByName, nextSubjectColor } from "@/domain/document"
import { formatMinutes } from "@/domain/time"
import type { DayId, Subject } from "@/domain/types"
import { createSubject, placeBlock, removeSubject } from "@/state/actions"
import { durationFor, useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
import { ColorField, CommitInput, DayChips, Field, Kbd, Select, SectionTitle, Swatch, SwatchPicker, SwitchRow, TimeField } from "../common"
import { mod, useFieldId } from "../platform"
import { useMenus, type MenuEntry } from "../commands"
import { DialogFooter, DialogShell } from "./shell"
import { dialogPayload } from "./payload"

// New subject

/** The subject as it will look on the schedule: its color, its name in the chosen text color, and a sample time line. */
function SubjectPreview({ name, color, text }: { name: string; color: string; text: string }) {
  return (
    <div className="grid place-items-center rounded-xl bg-canvas px-6 py-7" aria-hidden="true">
      <div className="w-full max-w-64 rounded-lg px-3.5 py-3 shadow-[0_1px_2px_rgb(0_0_0/0.08)] transition-colors duration-200" style={{ background: color, color: text }}>
        <p className="truncate text-[0.9375rem] leading-tight font-semibold">{name.trim() || "Nombre de la materia"}</p>
        <p className="mt-1 text-xs tabular-nums opacity-80">Lunes · 08:00–10:00 · Aula 12</p>
      </div>
    </div>
  )
}

function SubjectForm() {
  const doc = useStudio((state) => state.session?.doc)
  const [name, setName] = useState("")
  const [color, setColor] = useState(() => (doc ? nextSubjectColor(doc) : "#3B82F6"))
  const [autoText, setAutoText] = useState(true)
  const [textColor, setTextColor] = useState(() => readableText(color))
  const [confirmTwin, setConfirmTwin] = useState(false)
  const nameId = useFieldId("subject-name")
  if (!doc) return null
  const twin = name.trim() ? findSubjectByName(doc, name) : undefined
  const text = autoText ? readableText(color) : textColor
  const full = doc.subjects.length >= MAX_SUBJECTS

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim() || full) return
    if (twin && !confirmTwin) {
      setConfirmTwin(true)
      return
    }
    createSubject(name, color, text)
    useEditor.getState().closeDialog()
  }

  return (
    <form className="grid gap-6" onSubmit={submit}>
      <SubjectPreview name={name} color={color} text={text} />
      <Field label="Nombre" htmlFor={nameId} error={full ? `Llegaste al máximo de ${MAX_SUBJECTS} materias.` : null}>
        <Input
          id={nameId}
          autoFocus
          value={name}
          maxLength={TEXT_LIMITS.subjectName}
          placeholder="Ej.: Análisis Matemático I"
          className="h-10 text-base md:text-base"
          onChange={(event) => {
            setName(event.target.value)
            setConfirmTwin(false)
          }}
        />
      </Field>
      {twin ? (
        <div className="grid gap-2 rounded-xl border border-warning/40 bg-warning/8 p-3.5 text-sm" role="alert">
          <p>
            Ya existe <strong>{twin.name}</strong>. Podés usarla para agregar más clases, o crear otra con el mismo nombre (por ejemplo, de otra comisión).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                useEditor.getState().arm(twin.id)
                useEditor.getState().closeDialog()
              }}
            >
              Usar {twin.name}
            </Button>
            {confirmTwin ? <span className="text-xs text-muted-foreground">Tocá “Crear materia” otra vez para crear la variante.</span> : null}
          </div>
        </div>
      ) : null}
      <section className="grid gap-3">
        <SectionTitle description={`Paleta del tema ${doc.appearance.name}`}>Color</SectionTitle>
        <SwatchPicker label="Colores de la paleta del tema" colors={doc.appearance.palette} value={color} onChange={setColor} />
        <ColorField label="Otro color" value={color} onChange={setColor} />
      </section>
      <section className="grid gap-2">
        <SwitchRow label="Texto automático" description="Blanco o negro, el que se lea mejor sobre el color." checked={autoText} onCheckedChange={setAutoText} />
        {!autoText ? <ColorField label="Color del texto" value={textColor} background={color} contrastLabel="sobre el color de la materia" onChange={setTextColor} /> : null}
      </section>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => useEditor.getState().closeDialog()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!name.trim() || full}>
          Crear materia
        </Button>
      </DialogFooter>
    </form>
  )
}

export function SubjectDialog() {
  return (
    <DialogShell name="subject" title="Nueva materia" description="Después elegila y tocá la grilla para ubicar sus clases." width={440}>
      <SubjectForm />
    </DialogShell>
  )
}

// Delete subject

function DeleteSubjectBody() {
  const doc = useStudio((state) => state.session?.doc)
  const [subjectId] = useState(() => dialogPayload<string>("subjectId"))
  const subject = doc?.subjects.find((item) => item.id === subjectId)
  if (!doc || !subject) return <p className="text-sm text-muted-foreground">La materia ya no existe.</p>
  const count = doc.blocks.filter((block) => block.subjectId === subject.id).length
  return (
    <div className="grid gap-4 text-sm">
      <div className="flex items-center gap-3 rounded-xl border border-border p-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-semibold" style={{ background: subject.color, color: subject.textColor }} aria-hidden="true">
          {subject.name.trim().charAt(0).toLocaleUpperCase("es") || "·"}
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium">{subject.name}</p>
          <p className="text-xs text-muted-foreground">{count ? (count === 1 ? "1 clase en el horario" : `${count} clases en el horario`) : "Sin clases en el horario"}</p>
        </div>
      </div>
      <p className="text-muted-foreground">{count ? `${count === 1 ? "Su clase también se elimina" : "Sus clases también se eliminan"}. Podés deshacerlo con ${mod}Z.` : `Podés deshacerlo con ${mod}Z.`}</p>
      <DialogFooter>
        <Button variant="ghost" onClick={() => useEditor.getState().closeDialog()}>
          Cancelar
        </Button>
        <Button
          variant="destructive"
          autoFocus
          onClick={() => {
            useEditor.getState().closeDialog()
            removeSubject(subject.id)
          }}
        >
          Eliminar materia
        </Button>
      </DialogFooter>
    </div>
  )
}

export function DeleteSubjectDialog() {
  return (
    <DialogShell name="delete-subject" title="¿Eliminar la materia?" width={400} sheet={0.5}>
      <DeleteSubjectBody />
    </DialogShell>
  )
}

// Add a class with a form (keyboard path)

function BlockForm() {
  const doc = useStudio((state) => state.session?.doc)
  const armed = useEditor((state) => state.armedSubjectId)
  const [subjectId, setSubjectId] = useState(() => dialogPayload<string>("subjectId") ?? armed ?? doc?.subjects[0]?.id ?? "")
  const [day, setDay] = useState<DayId>(() => doc?.settings.days[0] ?? "mon")
  const [start, setStart] = useState(() => doc?.settings.range.start ?? 480)
  const [end, setEnd] = useState(() => (doc?.settings.range.start ?? 480) + (subjectId ? durationFor(subjectId) : DEFAULT_DURATION))
  const [room, setRoom] = useState("")
  const [kind, setKind] = useState("")
  const [notes, setNotes] = useState("")
  const ids = { subject: useFieldId("bf-subject"), room: useFieldId("bf-room"), kind: useFieldId("bf-kind"), notes: useFieldId("bf-notes") }
  if (!doc) return null
  if (!doc.subjects.length) return <p className="text-sm text-muted-foreground">Primero creá una materia.</p>
  const invalid = end <= start ? "El fin debe ser posterior al inicio." : null
  const outside = !invalid && (start < doc.settings.range.start || end > doc.settings.range.end)
  const nextRange = outside ? expandRange(doc.settings.range, [{ start, end }]) : null

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (invalid || !subjectId) return
    const id = placeBlock(subjectId, { day, start, end }, { room: room.trim(), kind: kind.trim(), notes: notes.trim() }, { expandRange: true })
    if (id) useEditor.getState().closeDialog()
  }

  return (
    <form className="grid gap-6" onSubmit={submit}>
      <div className="grid gap-4">
        <Select
          id={ids.subject}
          label="Materia"
          value={subjectId}
          onValueChange={setSubjectId}
          options={doc.subjects.map((subject: Subject) => ({ value: subject.id, label: subject.name, icon: <Swatch color={subject.color} className="size-3.5 rounded-[4px]" /> }))}
        />
        <div className="grid gap-1.5">
          <span className="text-sm leading-tight font-medium">Día</span>
          <DayChips label="Día" days={doc.settings.days} value={day} onChange={setDay} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TimeField
            label="Inicio"
            value={start}
            max={1410}
            onChange={(value) => {
              setStart(value)
              if (end <= value) setEnd(Math.min(1440, value + (end - start)))
            }}
          />
          <TimeField label="Fin" end value={end} min={30} onChange={setEnd} />
        </div>
        {invalid ? <p className="text-xs text-destructive">{invalid}</p> : null}
        {nextRange ? (
          <p className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            Queda fuera del horario visible. Al agregarla, el documento se amplía a {formatMinutes(nextRange.start)}–{formatMinutes(nextRange.end)}.
          </p>
        ) : null}
      </div>
      <section className="grid gap-4">
        <SectionTitle description="Opcional">Detalles</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Aula" htmlFor={ids.room}>
            <Input id={ids.room} value={room} maxLength={TEXT_LIMITS.room} onChange={(event) => setRoom(event.target.value)} placeholder="Ej.: Aula 12" />
          </Field>
          <Field label="Tipo" htmlFor={ids.kind}>
            <Input id={ids.kind} value={kind} maxLength={TEXT_LIMITS.kind} onChange={(event) => setKind(event.target.value)} placeholder="Ej.: Teórica" />
          </Field>
        </div>
        <div className="-mt-1 flex flex-wrap gap-1" role="group" aria-label="Tipos frecuentes">
          {CLASS_KINDS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={kind === item}
              onClick={() => setKind(kind === item ? "" : item)}
              className={cn("h-7 rounded-full border px-2.5 text-xs outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-9", kind === item ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
            >
              {item}
            </button>
          ))}
        </div>
        <Field label="Notas" htmlFor={ids.notes}>
          <CommitInput id={ids.notes} multiline value={notes} maxLength={TEXT_LIMITS.notes} onCommit={setNotes} placeholder="Comisión, docente, enlace…" />
        </Field>
      </section>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => useEditor.getState().closeDialog()}>
          Cancelar
        </Button>
        <Button type="submit" disabled={!!invalid}>
          Agregar clase
        </Button>
      </DialogFooter>
    </form>
  )
}

export function BlockFormDialog() {
  return (
    <DialogShell name="block-form" title="Agregar clase" description="Ubicá una clase con precisión, sin usar la grilla." width={520}>
      <BlockForm />
    </DialogShell>
  )
}

// Shortcuts

const SHORTCUTS: [string, [string, string[]][]][] = [
  [
    "Edición",
    [
      ["Deshacer", [mod, "Z"]],
      ["Rehacer", [mod, "⇧", "Z"]],
      ["Copiar clase", [mod, "C"]],
      ["Pegar clase", [mod, "V"]],
      ["Duplicar clase", [mod, "D"]],
      ["Eliminar clase", ["Supr"]],
      ["Cancelar gesto o ubicación", ["Esc"]],
    ],
  ],
  [
    "Lienzo",
    [
      ["Herramienta Seleccionar", ["V"]],
      ["Herramienta Colocar", ["B"]],
      ["Mover clase 30 min", ["↑", "↓"]],
      ["Mover clase de día", ["←", "→"]],
      ["Cambiar hora de fin", ["⇧", "↑ ↓"]],
      ["Cambiar hora de inicio", ["Alt", "↑ ↓"]],
      ["Clase siguiente o anterior", ["Tab"]],
      ["Confirmar ubicación", ["Enter"]],
    ],
  ],
  [
    "Vista y archivo",
    [
      ["Acercar y alejar", [mod, "+ −"]],
      ["Ajustar a la ventana", [mod, "0"]],
      ["Mis proyectos", [mod, "O"]],
      ["Guardar ahora", [mod, "S"]],
      ["Exportar", [mod, "⇧", "E"]],
      ["Ajustes del documento", [mod, ","]],
      ["Apariencia", [mod, "⇧", "A"]],
      ["Buscar comandos", [mod, "K"]],
    ],
  ],
]

export function ShortcutsDialog() {
  return (
    <DialogShell name="shortcuts" title="Atajos de teclado" width={640}>
      <div className="grid gap-6 sm:grid-cols-2">
        {SHORTCUTS.map(([group, items]) => (
          <section key={group}>
            <h3 className="section-label mb-2">{group}</h3>
            <dl className="grid gap-1.5">
              {items.map(([label, keys]) => (
                <div key={label} className="flex items-center justify-between gap-3 text-sm">
                  <dt>{label}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {keys.map((key) => (
                      <Kbd key={key}>{key}</Kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </DialogShell>
  )
}

// About storage and privacy

export function AboutDialog() {
  return (
    <DialogShell name="about" title="Guardado y privacidad" width={520} sheet={0.75}>
      <div className="grid gap-3 text-sm leading-relaxed">
        <p>Horario Studio guarda tus proyectos, temas y colores solo en este navegador. No hay cuentas ni servidores: nada de tu horario sale de tu dispositivo.</p>
        <p>Cada cambio se guarda automáticamente. Si el guardado falla, la barra superior lo indica y te ofrece reintentar o descargar el proyecto.</p>
        <p>Borrar los datos del sitio elimina tus proyectos. Para resguardarlos o pasarlos a otro dispositivo, descargá una copia de seguridad desde Archivo.</p>
        <p>Las fuentes de Google se descargan desde Fontsource (jsDelivr) solo cuando elegís una, y quedan guardadas para usarlas sin conexión.</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => void useStudio.getState().downloadBackup()}>
            Descargar copia de seguridad
          </Button>
          <Button onClick={() => useEditor.getState().closeDialog()}>Entendido</Button>
        </DialogFooter>
      </div>
    </DialogShell>
  )
}

// Command palette

function flatten(entries: MenuEntry[], group: string, out: { item: CommandItem; run: () => void }[]) {
  for (const entry of entries) {
    if (entry.type === "item" && !entry.disabled) out.push({ item: { id: entry.id, label: entry.label, group, shortcut: entry.shortcut, keywords: entry.keywords }, run: entry.run })
    if (entry.type === "submenu") flatten(entry.items, entry.label, out)
    if (entry.type === "radio") {
      for (const option of entry.options) out.push({ item: { id: `${entry.id}-${option.value}`, label: `${entry.label}: ${option.label}`, group }, run: () => entry.onChange(option.value) })
    }
  }
}

function Commands() {
  const menus = useMenus()
  const doc = useStudio((state) => state.session?.doc)
  const projects = useStudio((state) => state.projects)
  const commands: { item: CommandItem; run: () => void }[] = []
  for (const menu of menus) flatten(menu.items, menu.label, commands)
  for (const subject of doc?.subjects ?? []) {
    commands.push({ item: { id: `place-${subject.id}`, label: `Colocar ${subject.name}`, group: "Materias", keywords: ["agregar", "clase"] }, run: () => useEditor.getState().arm(subject.id) })
  }
  for (const project of projects.filter((item) => !item.deletedAt && !item.damaged && item.id !== doc?.id).slice(0, 12)) {
    commands.push({ item: { id: `open-${project.id}`, label: `Abrir ${project.title}`, group: "Proyectos" }, run: () => void useStudio.getState().openProject(project.id) })
  }
  return (
    <CommandPalette
      autoFocus
      label="Comandos"
      placeholder="Buscar comandos, materias o proyectos"
      items={commands.map((command) => command.item)}
      onClose={() => useEditor.getState().closeDialog()}
      onSelect={(item) => {
        const command = commands.find((entry) => entry.item.id === item.id)
        useEditor.getState().closeDialog()
        if (command) window.setTimeout(command.run, 0)
      }}
    />
  )
}

export function CommandDialog() {
  return (
    <DialogShell name="commands" title="Buscar comandos" width={560} className="command-dialog">
      <Commands />
    </DialogShell>
  )
}
