import { useState, type FormEvent } from "react"
import { AlertTriangle, ArrowDown, ArrowUp, ListPlus, MoreHorizontal, Pencil, Plus, SquarePlus, Trash2 } from "lucide-react"
import { SearchField } from "@/components/arc/search-field/search-field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/arc/tabs/tabs"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { DAYS, MAX_SUBJECTS, TEXT_LIMITS, dayLabel } from "@/domain/constants"
import { conflictsOf, excludedBlocks, findSubjectByName, moveSubject, normalizeName, sortedBlocks, subjectUsage, subjectVariants } from "@/domain/document"
import { formatRange } from "@/domain/time"
import type { Block, ScheduleDocument, Subject } from "@/domain/types"
import { cn } from "@/lib/utils"
import { createSubject, describeBlock } from "@/state/actions"
import { useEditor } from "@/state/editor"
import { commit } from "@/state/studio"
import { Swatch } from "../common"

function QuickAdd({ doc, onDone }: { doc: ScheduleDocument; onDone?: () => void }) {
  const [name, setName] = useState("")
  const [existing, setExisting] = useState<Subject | null>(null)
  const full = doc.subjects.length >= MAX_SUBJECTS

  const create = () => {
    createSubject(name)
    setName("")
    setExisting(null)
    onDone?.()
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const clean = name.trim()
    if (!clean || full) return
    const match = findSubjectByName(doc, clean)
    if (match && existing?.id !== match.id) {
      setExisting(match)
      return
    }
    create()
  }

  return (
    <form onSubmit={submit} className="grid min-w-0 gap-1.5">
      <div className="flex min-w-0 gap-1.5">
        <Input
          className="min-w-0"
          value={name}
          onChange={(event) => {
            setName(event.target.value)
            setExisting(null)
          }}
          placeholder="Nueva materia"
          aria-label="Nombre de la nueva materia"
          maxLength={TEXT_LIMITS.subjectName}
          disabled={full}
        />
        <Button type="submit" size="icon" aria-label="Crear materia" disabled={!name.trim() || full}>
          <Plus />
        </Button>
      </div>
      {existing ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs" role="alert">
          <p>
            Ya existe <strong>{existing.name}</strong>. ¿Querés usarla o crear otra con el mismo nombre?
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Button
              size="xs"
              type="button"
              onClick={() => {
                useEditor.getState().arm(existing.id)
                setName("")
                setExisting(null)
                onDone?.()
              }}
            >
              Usar esta materia
            </Button>
            <Button size="xs" type="button" variant="outline" onClick={create}>
              Crear otra igual
            </Button>
          </div>
        </div>
      ) : full ? (
        <p className="text-xs text-muted-foreground">Llegaste al máximo de {MAX_SUBJECTS} materias.</p>
      ) : null}
    </form>
  )
}

function SubjectRow({ subject, count, variant, armed, focused, first, last, onDone }: { subject: Subject; count: number; variant?: string; armed: boolean; focused: boolean; first: boolean; last: boolean; onDone?: () => void }) {
  const editor = useEditor.getState()
  const inspect = () => {
    editor.set({ focusedSubjectId: subject.id, selectedBlockId: null })
    if (window.matchMedia("(max-width: 1179px)").matches) editor.set({ mobileSheet: "inspector" })
  }
  return (
    <li className={cn("group flex items-center gap-1 rounded-lg pr-1", armed ? "bg-primary/12 ring-1 ring-primary/40" : focused ? "bg-accent" : "hover:bg-accent/60")}>
      <button
        type="button"
        aria-pressed={armed}
        onClick={() => {
          if (armed) editor.set({ tool: "select", armedSubjectId: null, hover: null })
          else {
            editor.arm(subject.id)
            onDone?.()
          }
        }}
        className="flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title={armed ? "Dejar de colocar" : "Colocar en la grilla"}
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md text-[10px] font-bold ring-1 ring-black/10 ring-inset" style={{ background: subject.color, color: subject.textColor }} aria-hidden="true">
          {subject.name.trim().charAt(0).toLocaleUpperCase("es") || "·"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight">{subject.name}</span>
          <span className="block text-xs text-muted-foreground">
            {count === 0 ? "Sin clases" : count === 1 ? "1 clase" : `${count} clases`}
            {variant ? ` · ${variant}` : ""}
          </span>
        </span>
        {armed ? <span className="shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">Colocando</span> : null}
      </button>
      <Button variant="ghost" size="icon-sm" aria-label={`Editar ${subject.name}`} className="opacity-70 group-hover:opacity-100 focus-visible:opacity-100" onClick={inspect}>
        <Pencil />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Más acciones para ${subject.name}`} className="opacity-70 group-hover:opacity-100 focus-visible:opacity-100" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto min-w-52" align="end">
          <DropdownMenuItem
            onClick={() => {
              editor.arm(subject.id)
              onDone?.()
            }}
          >
            <SquarePlus /> Colocar en la grilla
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => editor.openDialog("block-form", { subjectId: subject.id })}>
            <ListPlus /> Agregar clase con formulario…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={inspect}>
            <Pencil /> Nombre y colores…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={first} onClick={() => commit(`Subir ${subject.name} en la leyenda`, (doc) => moveSubject(doc, subject.id, -1))}>
            <ArrowUp /> Subir en la leyenda
          </DropdownMenuItem>
          <DropdownMenuItem disabled={last} onClick={() => commit(`Bajar ${subject.name} en la leyenda`, (doc) => moveSubject(doc, subject.id, 1))}>
            <ArrowDown /> Bajar en la leyenda
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => editor.openDialog("delete-subject", { subjectId: subject.id })}>
            <Trash2 /> Eliminar materia…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}

function SubjectsTab({ doc, onDone }: { doc: ScheduleDocument; onDone?: () => void }) {
  const [query, setQuery] = useState("")
  const armedSubjectId = useEditor((state) => state.armedSubjectId)
  const tool = useEditor((state) => state.tool)
  const focusedSubjectId = useEditor((state) => state.focusedSubjectId)
  const usage = subjectUsage(doc)
  const variants = subjectVariants(doc.subjects)
  const key = normalizeName(query)
  const visible = key ? doc.subjects.filter((subject) => normalizeName(subject.name).includes(key)) : doc.subjects
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <QuickAdd doc={doc} onDone={onDone} />
      {doc.subjects.length > 6 ? <SearchField label="Buscar materias" value={query} onValueChange={setQuery} placeholder="Buscar materia" /> : null}
      {visible.length ? (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5" aria-label="Materias">
          {visible.map((subject) => (
            <SubjectRow
              key={subject.id}
              subject={subject}
              count={usage.get(subject.id) ?? 0}
              variant={variants.get(subject.id)}
              armed={tool === "place" && armedSubjectId === subject.id}
              focused={focusedSubjectId === subject.id}
              first={doc.subjects[0]?.id === subject.id}
              last={doc.subjects.at(-1)?.id === subject.id}
              onDone={onDone}
            />
          ))}
        </ul>
      ) : doc.subjects.length ? (
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">Ninguna materia coincide con “{query}”.</p>
      ) : (
        <p className="px-2 py-4 text-sm text-muted-foreground">Escribí el nombre de tu primera materia. Después elegila y hacé clic en la grilla para ubicar sus clases.</p>
      )}
    </div>
  )
}

function BlockRow({ doc, block, selected, outside, onDone }: { doc: ScheduleDocument; block: Block; selected: boolean; outside?: boolean; onDone?: () => void }) {
  const subject = doc.subjects.find((item) => item.id === block.subjectId)
  const conflicts = conflictsOf(doc, block).length
  const details = [block.room, block.kind].filter(Boolean).join(" · ")
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        aria-label={describeBlock(doc, block) + (conflicts ? ", se superpone" : "") + (outside ? ", fuera del documento" : "")}
        onClick={() => {
          useEditor.getState().set({ selectedBlockId: block.id, tool: "select", hover: null })
          onDone?.()
        }}
        className={cn("flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring", selected ? "bg-primary/12 ring-1 ring-primary/40" : "hover:bg-accent/60")}
      >
        <Swatch color={subject?.color ?? "#999999"} className="size-2.5" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm leading-tight">{subject?.name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            <span className="tabular-nums">{formatRange(block.start, block.end)}</span>
            {details ? ` · ${details}` : ""}
          </span>
        </span>
        {conflicts || outside ? <AlertTriangle className={cn("size-3.5 shrink-0", outside ? "text-destructive" : "text-warning")} aria-hidden="true" /> : null}
      </button>
    </li>
  )
}

function BlocksTab({ doc, onDone }: { doc: ScheduleDocument; onDone?: () => void }) {
  const selectedBlockId = useEditor((state) => state.selectedBlockId)
  const outside = new Set(excludedBlocks(doc.blocks, doc.settings.days, doc.settings.range).map((block) => block.id))
  const ordered = sortedBlocks(doc.blocks)
  if (!doc.blocks.length) {
    return (
      <div className="grid gap-3 px-2 py-4 text-sm text-muted-foreground">
        <p>Todavía no hay clases.</p>
        <Button variant="outline" size="sm" disabled={!doc.subjects.length} onClick={() => useEditor.getState().openDialog("block-form")}>
          <ListPlus /> Agregar con formulario
        </Button>
      </div>
    )
  }
  const groups = DAYS.filter((day) => doc.settings.days.includes(day.id))
    .map((day) => ({ day, blocks: ordered.filter((block) => block.day === day.id && !outside.has(block.id)) }))
    .filter((group) => group.blocks.length)
  const hidden = ordered.filter((block) => outside.has(block.id))
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <Button variant="outline" size="sm" className="justify-start" disabled={!doc.subjects.length} onClick={() => useEditor.getState().openDialog("block-form")}>
        <ListPlus /> Agregar clase con formulario
      </Button>
      {hidden.length ? (
        <section aria-label="Fuera del documento">
          <h3 className="px-2 pb-1 text-xs font-semibold text-destructive">Fuera del documento ({hidden.length})</h3>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
            {hidden.map((block) => (
              <BlockRow key={block.id} doc={doc} block={block} selected={block.id === selectedBlockId} outside onDone={onDone} />
            ))}
          </ul>
        </section>
      ) : null}
      {groups.map((group) => (
        <section key={group.day.id} aria-label={dayLabel(group.day.id)}>
          <h3 className="px-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{group.day.label}</h3>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-0.5">
            {group.blocks.map((block) => (
              <BlockRow key={block.id} doc={doc} block={block} selected={block.id === selectedBlockId} onDone={onDone} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** Subject library and class list. In a bottom sheet on phones, `onDone` closes it after a choice. */
export function LibraryPanel({ doc, onDone, className }: { doc: ScheduleDocument; onDone?: () => void; className?: string }) {
  const leftTab = useEditor((state) => state.leftTab)
  return (
    <Tabs value={leftTab} onValueChange={(value) => useEditor.getState().set({ leftTab: value as "subjects" | "blocks" })} className={cn("flex min-h-0 flex-col", className)}>
      <div className="shrink-0 px-3 pt-3">
        <TabsList aria-label="Contenido del panel">
          <TabsTrigger value="subjects">Materias ({doc.subjects.length})</TabsTrigger>
          <TabsTrigger value="blocks">Clases ({doc.blocks.length})</TabsTrigger>
        </TabsList>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pt-3 pb-6">
        <TabsContent value="subjects" className="mt-0! text-foreground!">
          <SubjectsTab doc={doc} onDone={onDone} />
        </TabsContent>
        <TabsContent value="blocks" className="mt-0! text-foreground!">
          <BlocksTab doc={doc} onDone={onDone} />
        </TabsContent>
      </div>
    </Tabs>
  )
}
