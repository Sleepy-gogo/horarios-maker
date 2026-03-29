import { useState } from "react"
import { ChevronDown, Trash } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DAYS, type Day, type ScheduleItem } from "@/features/schedule/types"

type SubjectEditorCardProps = {
  item: ScheduleItem
  onUpdate: <Key extends keyof ScheduleItem>(key: Key, value: ScheduleItem[Key]) => void
  onRemove: () => void
}

export function SubjectEditorCard({ item, onUpdate, onRemove }: SubjectEditorCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <article className="subject-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="subject-card-header">
          <div className="subject-card-chip" style={{ background: item.color }} />
          <span className="subject-card-name">{item.subject}</span>
          <span className="subject-card-meta">
            {item.day.slice(0, 3)} {item.start}–{item.end}
          </span>
          <ChevronDown className={`section-chevron ${open ? "open" : ""}`} />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="subject-card-body">
            <div className="field">
              <Label htmlFor={`subject-${item.id}`} className="field-label">
                Materia
              </Label>
              <Input
                id={`subject-${item.id}`}
                className="field-control"
                value={item.subject}
                onChange={(event) => onUpdate("subject", event.target.value)}
              />
            </div>

            <div className="field-row">
              <div className="field">
                <Label className="field-label">Día</Label>
                <Select value={item.day} onValueChange={(value) => onUpdate("day", value as Day)}>
                  <SelectTrigger className="field-control field-select-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="field-select-content">
                    <SelectGroup>
                      {DAYS.map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>

              <div className="field">
                <Label htmlFor={`room-${item.id}`} className="field-label">
                  Aula
                </Label>
                <Input
                  id={`room-${item.id}`}
                  className="field-control"
                  value={item.room}
                  onChange={(event) => onUpdate("room", event.target.value)}
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field">
                <Label htmlFor={`start-${item.id}`} className="field-label">
                  Inicio
                </Label>
                <Input
                  id={`start-${item.id}`}
                  type="time"
                  className="field-control"
                  value={item.start}
                  onChange={(event) => onUpdate("start", event.target.value)}
                />
              </div>

              <div className="field">
                <Label htmlFor={`end-${item.id}`} className="field-label">
                  Fin
                </Label>
                <Input
                  id={`end-${item.id}`}
                  type="time"
                  className="field-control"
                  value={item.end}
                  onChange={(event) => onUpdate("end", event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <Label htmlFor={`details-${item.id}`} className="field-label">
                Detalle
              </Label>
              <Input
                id={`details-${item.id}`}
                className="field-control"
                value={item.details}
                onChange={(event) => onUpdate("details", event.target.value)}
              />
            </div>

            <div className="field-row">
              <div className="field">
                <Label htmlFor={`color-${item.id}`} className="field-label">
                  Color fondo
                </Label>
                <input
                  id={`color-${item.id}`}
                  type="color"
                  value={item.color}
                  onChange={(event) => onUpdate("color", event.target.value)}
                />
              </div>

              <div className="field">
                <Label htmlFor={`text-color-${item.id}`} className="field-label">
                  Color texto
                </Label>
                <input
                  id={`text-color-${item.id}`}
                  type="color"
                  value={item.textColor}
                  onChange={(event) => onUpdate("textColor", event.target.value)}
                />
              </div>
            </div>

            <div className="subject-card-actions">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="btn btn-sm btn-danger-ghost"
                onClick={onRemove}
              >
                <Trash style={{ width: "1rem", height: "1rem" }} />
                Eliminar
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </article>
  )
}
