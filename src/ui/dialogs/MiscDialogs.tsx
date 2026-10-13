import { useState, type FormEvent } from "react"
import { CommandPalette, type CommandItem } from "@/components/arc/command-palette/command-palette"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CLASS_KINDS, DAYS, DEFAULT_DURATION, MAX_SUBJECTS, TEXT_LIMITS } from "@/domain/constants"
import { readableText } from "@/domain/color"
import { expandRange, findSubjectByName, nextSubjectColor } from "@/domain/document"
import { formatMinutes } from "@/domain/time"
import type { DayId, Subject } from "@/domain/types"
import { createSubject, placeBlock, removeSubject } from "@/state/actions"
import { durationFor, useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
import { ColorField, CommitInput, Field, Kbd, NativeSelect, SwitchRow, TimeField } from "../common"
import { mod, useFieldId } from "../platform"
import { useMenus, type MenuEntry } from "../commands"
import { DialogFooter, DialogShell } from "./shell"
import { dialogPayload } from "./payload"

// New subject

function SubjectForm() {
  const doc = useStudio((state) => state.session?.doc)
  const [name, setName] = useState("")
  const [color, setColor] = useState(() => (doc ? nextSubjectColor(doc) : "#4F7CFF"))
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
    <form className="grid gap-4" onSubmit={submit}>
      <Field label="Nombre" htmlFor={nameId} error={full ? `Llegaste al máximo de ${MAX_SUBJECTS} materias.` : null}>
        <Input
          id={nameId}
          autoFocus
          value={name}
          maxLength={TEXT_LIMITS.subjectName}
          placeholder="Ej.: Análisis Matemático I"
          onChange={(event) => {
            setName(event.target.value)
            setConfirmTwin(false)
          }}
        />
      </Field>
      {twin ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm" role="alert">
          <p>
            Ya existe <strong>{twin.name}</strong>. Podés usarla para agregar más clases, o crear otra con el mismo nombre (por ejemplo, de otra comisión).
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                useEditor.getState().arm(twin.id)
                useEditor.getState().closeDialog()
              }}
            >
              Usar esta materia
            </Button>
            {confirmTwin ? <span className="self-center text-xs text-muted-foreground">Tocá “Crear materia” otra vez para crear la variante.</span> : null}
          </div>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Colores de la paleta del tema">
        {doc.appearance.palette.map((swatch) => (
          <button
            key={swatch}
            type="button"
            aria-label={`Usar ${swatch}`}
            aria-pressed={swatch.toUpperCase() === color.toUpperCase()}
            className="size-7 rounded-md ring-1 ring-black/15 ring-inset outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-foreground aria-pressed:ring-offset-2 aria-pressed:ring-offset-background"
            style={{ background: swatch }}
            onClick={() => setColor(swatch)}
          />
        ))}
      </div>
      <ColorField label="Fondo" value={color} onChange={setColor} />
      <SwitchRow label="Color de texto automático" description="Elige blanco o negro según el contraste." checked={autoText} onCheckedChange={setAutoText} />
      {!autoText ? <ColorField label="Texto" value={textColor} background={color} contrastLabel="sobre el fondo de la materia" onChange={setTextColor} /> : null}
      <div className="flex items-center gap-3 rounded-lg border border-border p-3">
        <span className="rounded-md px-3 py-2 text-sm font-semibold" style={{ background: color, color: text }}>
          {name.trim() || "Vista previa"}
        </span>
        <span className="text-xs text-muted-foreground">Así se verá en sus clases y en la leyenda.</span>
      </div>
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
    <DialogShell name="subject" title="Nueva materia" description="Después elegila y hacé clic en la grilla para ubicar sus clases." width={460}>
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
    <div className="grid gap-3 text-sm">
      <p>{count ? `También se eliminarán ${count === 1 ? "su clase" : `sus ${count} clases`}. Podés deshacerlo con ${mod}Z.` : "No tiene clases en el horario."}</p>
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
          Eliminar {subject.name}
        </Button>
      </DialogFooter>
    </div>
  )
}

export function DeleteSubjectDialog() {
  return (
    <DialogShell name="delete-subject" title="¿Eliminar materia?" width={420}>
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
  const ids = { subject: useFieldId("bf-subject"), day: useFieldId("bf-day"), room: useFieldId("bf-room"), kind: useFieldId("bf-kind"), notes: useFieldId("bf-notes") }
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
    <form className="grid gap-4" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Materia" htmlFor={ids.subject}>
          <NativeSelect id={ids.subject} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
            {doc.subjects.map((subject: Subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label="Día" htmlFor={ids.day}>
          <NativeSelect id={ids.day} value={day} onChange={(event) => setDay(event.target.value as DayId)}>
            {DAYS.filter((item) => doc.settings.days.includes(item.id)).map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <TimeField label="Inicio" value={start} max={1410} onChange={(value) => {
          setStart(value)
          if (end <= value) setEnd(Math.min(1440, value + (end - start)))
        }} />
        <TimeField label="Fin" end value={end} min={30} onChange={setEnd} />
      </div>
      {invalid ? <p className="text-xs text-destructive">{invalid}</p> : null}
      {nextRange ? (
        <p className="rounded-lg border border-border bg-muted/40 p-2.5 text-xs">
          Este horario queda fuera de lo visible. Al agregarla, el documento se ampliará a {formatMinutes(nextRange.start)}–{formatMinutes(nextRange.end)}.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Aula" htmlFor={ids.room}>
          <Input id={ids.room} value={room} maxLength={TEXT_LIMITS.room} onChange={(event) => setRoom(event.target.value)} placeholder="Opcional" />
        </Field>
        <Field label="Tipo" htmlFor={ids.kind}>
          <Input id={ids.kind} value={kind} maxLength={TEXT_LIMITS.kind} onChange={(event) => setKind(event.target.value)} placeholder="Opcional" list={`${ids.kind}-list`} />
          <datalist id={`${ids.kind}-list`}>
            {CLASS_KINDS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="Notas" htmlFor={ids.notes}>
        <CommitInput id={ids.notes} multiline value={notes} maxLength={TEXT_LIMITS.notes} onCommit={setNotes} placeholder="Opcional" />
      </Field>
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
    <DialogShell name="block-form" title="Agregar clase" description="Ubicá una clase con precisión, sin usar el mouse." width={560}>
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
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group}</h3>
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
    <DialogShell name="about" title="Guardado y privacidad" width={520}>
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
