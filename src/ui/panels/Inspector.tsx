import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, CopyPlus, Eye, ListPlus, Palette, Settings2, SquarePlus, Trash2, Wand2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/arc/tooltip/tooltip"
import { CLASS_KINDS, DAYS, STEP, TEXT_LIMITS, dayLabel } from "@/domain/constants"
import { contrastRatio, readableText } from "@/domain/color"
import { conflictsOf, excludedBlocks, findSubjectByName, subjectUsage } from "@/domain/document"
import { formatDuration, formatMinutes, formatRange } from "@/domain/time"
import type { Block, DayId, DocumentSettings, ScheduleDocument, Subject } from "@/domain/types"
import { cn } from "@/lib/utils"
import {
  adjustEdge, copyBlock, deleteBlock, edgeLimits, editBlockFields, editSubject, nudgeBlock, setBlockInterval, shiftBlockDay, startDuplicate, unifySubjects,
} from "@/state/actions"
import { useEditor } from "@/state/editor"
import { ColorField, CommitInput, DayChips, Field, IconButton, SectionTitle, Select, Swatch, SwatchPicker, TimeField } from "../common"
import { useFieldId } from "../platform"
import { fitRangeToBlocks, toggleShow } from "../commands"

function HiddenHint({ doc, field, label }: { doc: ScheduleDocument; field: keyof DocumentSettings["show"]; label: string }) {
  if (doc.settings.show[field]) return null
  return (
    <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline" onClick={() => toggleShow(field, `Mostrar ${label}`)}>
      <Eye className="size-3" aria-hidden="true" /> No se muestra en el documento. Mostrar
    </button>
  )
}

function StepButtons({ label, onEarlier, onLater, earlier, later }: { label: string; onEarlier: () => void; onLater: () => void; earlier: boolean; later: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        <Button size="xs" variant="outline" disabled={!earlier} onClick={onEarlier} aria-label={`${label}: 30 minutos antes`}>
          −30 min
        </Button>
        <Button size="xs" variant="outline" disabled={!later} onClick={onLater} aria-label={`${label}: 30 minutos después`}>
          +30 min
        </Button>
      </div>
    </div>
  )
}

function BlockInspector({ doc, block }: { doc: ScheduleDocument; block: Block }) {
  const subject = doc.subjects.find((item) => item.id === block.subjectId)
  const conflicts = conflictsOf(doc, block)
  const outside = excludedBlocks([block], doc.settings.days, doc.settings.range).length > 0
  const limits = edgeLimits(doc, block)
  const days = doc.settings.days.includes(block.day) ? doc.settings.days : [...doc.settings.days, block.day]
  const dayIndex = doc.settings.days.indexOf(block.day)
  const roomId = useFieldId("room")
  const kindId = useFieldId("kind")
  const notesId = useFieldId("notes")
  const subjectId = useFieldId("block-subject")
  const dayId = useFieldId("block-day")
  const editor = useEditor.getState()

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 size-9 shrink-0 rounded-lg ring-1 ring-black/10 ring-inset" style={{ background: subject?.color }} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Clase seleccionada</p>
          <h2 className="truncate text-base font-semibold leading-tight">{subject?.name}</h2>
          <p className="text-xs text-muted-foreground tabular-nums">
            {dayLabel(block.day)} · {formatRange(block.start, block.end)} · {formatDuration(block.end - block.start)}
          </p>
        </div>
        <IconButton label="Quitar selección" size="icon-sm" onClick={() => editor.select(null)}>
          <X />
        </IconButton>
      </div>

      {outside ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">
          <p className="font-medium text-destructive">Esta clase queda fuera del documento</p>
          <p className="mt-1 text-xs">Su día o su horario no están visibles. Ajustá el rango o cambiá el día para que aparezca y se pueda exportar.</p>
          <Button size="xs" className="mt-2" variant="outline" onClick={fitRangeToBlocks}>
            Ajustar rango a mis clases
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3">
        <Select
          id={subjectId}
          label="Materia"
          value={block.subjectId}
          onValueChange={(value) => editBlockFields(block.id, { subjectId: value })}
          options={doc.subjects.map((item) => ({ value: item.id, label: item.name, icon: <Swatch color={item.color} className="size-3.5 rounded-[4px]" /> }))}
        />
        <div className="grid gap-1.5">
          <span id={dayId} className="text-sm leading-tight font-medium">Día</span>
          <DayChips label="Día" days={days} value={block.day} onChange={(day: DayId) => setBlockInterval(block.id, { day, start: block.start, end: block.end }, "Mover")} />
          {doc.settings.days.includes(block.day) ? null : <p className="text-xs text-warning">{dayLabel(block.day)} no se muestra en el documento.</p>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TimeField label="Inicio" value={block.start} min={doc.settings.range.start} max={block.end - STEP} onChange={(start) => setBlockInterval(block.id, { day: block.day, start, end: block.end }, "Cambiar inicio de")} />
          <TimeField label="Fin" end value={block.end} min={block.start + STEP} max={doc.settings.range.end} onChange={(end) => setBlockInterval(block.id, { day: block.day, start: block.start, end }, "Cambiar fin de")} />
        </div>
        <div className="grid gap-1.5 rounded-lg border border-border p-2.5">
          <StepButtons label="Inicio" earlier={limits.startEarlier} later={limits.startLater} onEarlier={() => adjustEdge(block.id, "start", -STEP)} onLater={() => adjustEdge(block.id, "start", STEP)} />
          <StepButtons label="Fin" earlier={limits.endEarlier} later={limits.endLater} onEarlier={() => adjustEdge(block.id, "end", -STEP)} onLater={() => adjustEdge(block.id, "end", STEP)} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Mover</span>
            <div className="flex gap-1">
              <IconButton label="30 minutos antes" size="icon-xs" variant="outline" disabled={!limits.moveEarlier} onClick={() => nudgeBlock(block.id, -STEP)}>
                <ArrowUp />
              </IconButton>
              <IconButton label="30 minutos después" size="icon-xs" variant="outline" disabled={!limits.moveLater} onClick={() => nudgeBlock(block.id, STEP)}>
                <ArrowDown />
              </IconButton>
              <IconButton label="Día anterior" size="icon-xs" variant="outline" disabled={dayIndex <= 0} onClick={() => shiftBlockDay(block.id, -1)}>
                <ArrowLeft />
              </IconButton>
              <IconButton label="Día siguiente" size="icon-xs" variant="outline" disabled={dayIndex < 0 || dayIndex >= doc.settings.days.length - 1} onClick={() => shiftBlockDay(block.id, 1)}>
                <ArrowRight />
              </IconButton>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        <Field label="Aula" htmlFor={roomId} hint={<HiddenHint doc={doc} field="room" label="aula" />}>
          <CommitInput id={roomId} value={block.room} maxLength={TEXT_LIMITS.room} placeholder="Ej.: Aula 12" onCommit={(room) => editBlockFields(block.id, { room: room.trim() })} />
        </Field>
        <Field label="Tipo de clase" htmlFor={kindId} hint={<HiddenHint doc={doc} field="kind" label="tipo de clase" />}>
          <CommitInput id={kindId} value={block.kind} maxLength={TEXT_LIMITS.kind} placeholder="Ej.: Teórica" onCommit={(kind) => editBlockFields(block.id, { kind: kind.trim() })} />
          <div className="flex flex-wrap gap-1" role="group" aria-label="Tipos frecuentes">
            {CLASS_KINDS.map((kind) => (
              <button
                key={kind}
                type="button"
                aria-pressed={block.kind === kind}
                onClick={() => editBlockFields(block.id, { kind: block.kind === kind ? "" : kind })}
                className={cn("rounded-full border px-2 py-0.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring", block.kind === kind ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}
              >
                {kind}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Notas" htmlFor={notesId} hint={<HiddenHint doc={doc} field="notes" label="notas" />}>
          <CommitInput id={notesId} multiline value={block.notes} maxLength={TEXT_LIMITS.notes} placeholder="Comisión, docente, enlace…" onCommit={(notes) => editBlockFields(block.id, { notes: notes.trim() })} />
        </Field>
      </div>

      {conflicts.length ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-4 text-warning" aria-hidden="true" /> Se superpone con {conflicts.length === 1 ? "1 clase" : `${conflicts.length} clases`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Se muestran lado a lado en el documento.</p>
          <ul className="mt-2 grid gap-1">
            {conflicts.map((other) => {
              const otherSubject = doc.subjects.find((item) => item.id === other.subjectId)
              return (
                <li key={other.id}>
                  <button type="button" className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs hover:bg-background/60" onClick={() => editor.select(other.id)}>
                    <Swatch color={otherSubject?.color ?? "#999"} className="size-2.5" />
                    <span className="truncate">{otherSubject?.name}</span>
                    <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">{formatRange(other.start, other.end)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-3 gap-1.5">
        <Button variant="outline" size="sm" onClick={() => startDuplicate(block.id)}>
          <CopyPlus /> Duplicar
        </Button>
        <Button variant="outline" size="sm" onClick={() => copyBlock(block.id)}>
          <Copy /> Copiar
        </Button>
        <Button variant="destructive" size="sm" onClick={() => deleteBlock(block.id)}>
          <Trash2 /> Eliminar
        </Button>
      </div>
      {subject ? (
        <Tooltip content={`Editar nombre y colores de ${subject.name}`}>
          <Button variant="ghost" size="sm" className="min-w-0 justify-start" onClick={() => editor.set({ focusedSubjectId: subject.id, selectedBlockId: null })}>
            <Palette /> <span className="truncate">Editar nombre y colores de {subject.name}</span>
          </Button>
        </Tooltip>
      ) : null}
    </div>
  )
}

function SubjectInspector({ doc, subject }: { doc: ScheduleDocument; subject: Subject }) {
  const nameId = useFieldId("subject-name")
  const count = subjectUsage(doc).get(subject.id) ?? 0
  const twin = findSubjectByName(doc, subject.name, subject.id)
  const ratio = contrastRatio(subject.textColor, subject.color)
  const editor = useEditor.getState()
  const palette = doc.appearance.palette

  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg text-sm font-bold ring-1 ring-black/10 ring-inset" style={{ background: subject.color, color: subject.textColor }} aria-hidden="true">
          {subject.name.trim().charAt(0).toLocaleUpperCase("es") || "·"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Materia</p>
          <h2 className="truncate text-base font-semibold leading-tight">{subject.name}</h2>
          <p className="text-xs text-muted-foreground">{count === 0 ? "Sin clases todavía" : count === 1 ? "1 clase · los cambios se aplican a ella" : `${count} clases · los cambios se aplican a todas`}</p>
        </div>
        <IconButton label="Cerrar" size="icon-sm" onClick={() => editor.set({ focusedSubjectId: null })}>
          <X />
        </IconButton>
      </div>

      <Field label="Nombre" htmlFor={nameId}>
        <CommitInput
          id={nameId}
          value={subject.name}
          maxLength={TEXT_LIMITS.subjectName}
          onCommit={(name) => {
            if (name.trim()) editSubject(subject.id, { name })
          }}
        />
      </Field>
      {twin ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs" role="status">
          <p>
            Hay otra materia llamada <strong>{twin.name}</strong>. En el estudio se distinguen como variantes; en el documento se ven iguales salvo por el color.
          </p>
          <Button size="xs" variant="outline" className="mt-2" onClick={() => unifySubjects(subject.id, twin.id)}>
            Unificar en una sola materia
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3">
        <SectionTitle>Colores</SectionTitle>
        <SwatchPicker label="Colores de la paleta del tema" colors={palette} value={subject.color} onChange={(color) => editSubject(subject.id, { color, textColor: readableText(color) })} />
        <ColorField label="Fondo" value={subject.color} onChange={(color) => editSubject(subject.id, { color }, `subject-color-${subject.id}`)} />
        <ColorField label="Texto" value={subject.textColor} background={subject.color} contrastLabel="sobre el fondo de la materia" onChange={(textColor) => editSubject(subject.id, { textColor }, `subject-text-${subject.id}`)} />
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className={cn(ratio < 3 ? "text-destructive" : ratio < 4.5 ? "text-warning" : "text-muted-foreground")}>
            Contraste {ratio.toFixed(1)}:1{ratio < 3 ? " · difícil de leer" : ratio < 4.5 ? " · aceptable en textos grandes" : ""}
          </span>
          <Button size="xs" variant="ghost" onClick={() => editSubject(subject.id, { textColor: readableText(subject.color) })}>
            <Wand2 /> Texto automático
          </Button>
        </div>
      </div>

      <div className="grid gap-1.5">
        <Button size="sm" onClick={() => editor.arm(subject.id)}>
          <SquarePlus /> Colocar en la grilla
        </Button>
        <Button size="sm" variant="outline" onClick={() => editor.openDialog("block-form", { subjectId: subject.id })}>
          <ListPlus /> Agregar clase con formulario
        </Button>
        <Button size="sm" variant="destructive" onClick={() => editor.openDialog("delete-subject", { subjectId: subject.id })}>
          <Trash2 /> Eliminar materia
        </Button>
      </div>
    </div>
  )
}

function DocumentInspector({ doc }: { doc: ScheduleDocument }) {
  const editor = useEditor.getState()
  const { settings } = doc
  const outside = excludedBlocks(doc.blocks, settings.days, settings.range).length
  const rows: [string, string][] = [
    ["Tamaño", `${settings.page.width} × ${settings.page.height} px`],
    ["Días", settings.days.map((day) => DAYS.find((item) => item.id === day)?.short).join(", ")],
    ["Horario visible", `${formatMinutes(settings.range.start)} a ${formatMinutes(settings.range.end)}`],
    ["Tema", doc.appearance.name],
    ["Contenido", `${doc.subjects.length} materias · ${doc.blocks.length} clases`],
  ]
  return (
    <div className="grid min-w-0 grid-cols-1 gap-5">
      <div>
        <p className="text-xs text-muted-foreground">Documento</p>
        <h2 className="truncate text-base font-semibold leading-tight">{settings.title || "Sin título"}</h2>
      </div>
      <dl className="grid gap-2 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd className="min-w-0 truncate text-right">{value}</dd>
          </div>
        ))}
      </dl>
      {outside ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs" role="alert">
          {outside === 1 ? "1 clase queda" : `${outside} clases quedan`} fuera del documento.
          <Button size="xs" className="mt-2 block" variant="outline" onClick={fitRangeToBlocks}>
            Ajustar rango a mis clases
          </Button>
        </div>
      ) : null}
      <div className="grid gap-1.5">
        <Button size="sm" variant="outline" className="justify-start" onClick={() => editor.openDialog("settings")}>
          <Settings2 /> Título, tamaño, días y horario…
        </Button>
        <Button size="sm" variant="outline" className="justify-start" onClick={() => editor.openDialog("appearance")}>
          <Palette /> Colores, fuentes y estilo…
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">Elegí una clase en el lienzo para editar su horario, aula y notas, o una materia del panel para cambiar su nombre y colores.</p>
    </div>
  )
}

/** Contextual properties: the selected class, the focused subject, or the document. */
export function Inspector({ doc, className }: { doc: ScheduleDocument; className?: string }) {
  const selectedBlockId = useEditor((state) => state.selectedBlockId)
  const focusedSubjectId = useEditor((state) => state.focusedSubjectId)
  const block = doc.blocks.find((item) => item.id === selectedBlockId)
  const subject = doc.subjects.find((item) => item.id === focusedSubjectId)
  return (
    <div className={cn("min-h-0 min-w-0 overflow-y-auto p-4", className)}>
      {block ? <BlockInspector key={block.id} doc={doc} block={block} /> : subject ? <SubjectInspector key={subject.id} doc={doc} subject={subject} /> : <DocumentInspector doc={doc} />}
    </div>
  )
}
