import { useState } from "react"
import { ChevronDown, Plus } from "lucide-react"

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
import { Switch } from "@/components/ui/switch"
import { SubjectEditorCard } from "@/features/schedule/components/subject-editor-card"
import {
  ASPECT_RATIOS,
  BACKGROUND_THEMES,
  END_HOUR_OPTIONS,
  START_HOUR_OPTIONS,
  type CompactMode,
  type Density,
  type ScheduleItem,
  type ScheduleSettings,
  type TimeRangeMode,
} from "@/features/schedule/types"
import { formatHourLabel } from "@/features/schedule/utils"

type StudioSidebarProps = {
  titleId: string
  items: ScheduleItem[]
  settings: ScheduleSettings
  onUpdateSettings: <Key extends keyof ScheduleSettings>(
    key: Key,
    value: ScheduleSettings[Key],
  ) => void
  onUpdateItem: <Key extends keyof ScheduleItem>(
    id: string,
    key: Key,
    value: ScheduleItem[Key],
  ) => void
  onAddItem: () => void
  onRemoveItem: (id: string) => void
}

type SidebarSectionProps = {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}

function SidebarSection({ title, children, defaultOpen = true }: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="section">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="section-header">
          <h2>{title}</h2>
          <ChevronDown className={`section-chevron ${open ? "open" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="section-body">{children}</CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function SidebarSwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <Switch className="toggle-switch" checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export function StudioSidebar({
  titleId,
  items,
  settings,
  onUpdateSettings,
  onUpdateItem,
  onAddItem,
  onRemoveItem,
}: StudioSidebarProps) {
  return (
    <aside className="sidebar" aria-labelledby={titleId}>
      <div className="sidebar-scroll">
        <SidebarSection title="Documento">
          <div className="field">
            <Label htmlFor="schedule-title" className="field-label" id={titleId}>
              Título
            </Label>
            <Input
              id="schedule-title"
              className="field-control"
              value={settings.title}
              onChange={(event) => onUpdateSettings("title", event.target.value)}
            />
          </div>

          <div className="field">
            <Label htmlFor="schedule-subtitle" className="field-label">
              Subtítulo
            </Label>
            <Input
              id="schedule-subtitle"
              className="field-control"
              value={settings.subtitle}
              onChange={(event) => onUpdateSettings("subtitle", event.target.value)}
            />
          </div>

          <div className="field-row">
            <div className="field">
              <Label className="field-label">Aspecto</Label>
              <Select
                value={settings.aspectRatio}
                onValueChange={(value) =>
                  onUpdateSettings("aspectRatio", value as ScheduleSettings["aspectRatio"])
                }
              >
                <SelectTrigger className="field-control field-select-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="field-select-content">
                  <SelectGroup>
                    {Object.entries(ASPECT_RATIOS).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="field">
              <Label className="field-label">Compactación</Label>
              <Select
                value={settings.compactMode}
                onValueChange={(value) => onUpdateSettings("compactMode", value as CompactMode)}
              >
                <SelectTrigger className="field-control field-select-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="field-select-content">
                  <SelectGroup>
                    <SelectItem value="uniforme">Uniforme</SelectItem>
                    <SelectItem value="optimizado">Optimizado</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <Label className="field-label">Rango horario</Label>
              <Select
                value={settings.timeRangeMode}
                onValueChange={(value) => onUpdateSettings("timeRangeMode", value as TimeRangeMode)}
              >
                <SelectTrigger className="field-control field-select-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="field-select-content">
                  <SelectGroup>
                    <SelectItem value="automatico">Automático</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="field">
              <Label className="field-label">Inicio del documento</Label>
              <Select
                value={String(settings.documentStartHour)}
                onValueChange={(value) => {
                  const nextStartHour = Number(value)
                  onUpdateSettings("documentStartHour", nextStartHour)
                  if (nextStartHour >= settings.documentEndHour) {
                    onUpdateSettings("documentEndHour", Math.min(nextStartHour + 1, 24))
                  }
                }}
                disabled={settings.timeRangeMode !== "manual"}
              >
                <SelectTrigger className="field-control field-select-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="field-select-content">
                  <SelectGroup>
                    {START_HOUR_OPTIONS.map((hour) => (
                      <SelectItem key={hour} value={String(hour)}>
                        {formatHourLabel(hour)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="field">
            <Label className="field-label">Fin del documento</Label>
            <Select
              value={String(settings.documentEndHour)}
              onValueChange={(value) => onUpdateSettings("documentEndHour", Number(value))}
              disabled={settings.timeRangeMode !== "manual"}
            >
              <SelectTrigger className="field-control field-select-trigger">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="field-select-content">
                <SelectGroup>
                  {END_HOUR_OPTIONS.filter((hour) => hour > settings.documentStartHour).map((hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {formatHourLabel(hour)}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </SidebarSection>

        <SidebarSection title="Estilo">
          <div className="field-row">
            <div className="field">
              <Label className="field-label">Tema</Label>
              <Select
                value={settings.theme}
                onValueChange={(value) =>
                  onUpdateSettings("theme", value as ScheduleSettings["theme"])
                }
              >
                <SelectTrigger className="field-control field-select-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="field-select-content">
                  <SelectGroup>
                    {Object.entries(BACKGROUND_THEMES).map(([key, value]) => (
                      <SelectItem key={key} value={key}>
                        {value.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="field">
              <Label className="field-label">Densidad</Label>
              <Select
                value={settings.density}
                onValueChange={(value) => onUpdateSettings("density", value as Density)}
              >
                <SelectTrigger className="field-control field-select-trigger">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="field-select-content">
                  <SelectGroup>
                    <SelectItem value="aireado">Aireado</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="compacto">Compacto</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SidebarSection>

        <SidebarSection title="Elementos">
          <SidebarSwitchRow
            label="Título en mayúsculas"
            checked={settings.uppercaseTitle}
            onCheckedChange={(value) => onUpdateSettings("uppercaseTitle", value)}
          />
          <SidebarSwitchRow
            label="Aula"
            checked={settings.showRoom}
            onCheckedChange={(value) => onUpdateSettings("showRoom", value)}
          />
          <SidebarSwitchRow
            label="Detalle"
            checked={settings.showDetails}
            onCheckedChange={(value) => onUpdateSettings("showDetails", value)}
          />
          <SidebarSwitchRow
            label="Leyenda"
            checked={settings.showLegend}
            onCheckedChange={(value) => onUpdateSettings("showLegend", value)}
          />
          <SidebarSwitchRow
            label="Horas"
            checked={settings.showTimeLabels}
            onCheckedChange={(value) => onUpdateSettings("showTimeLabels", value)}
          />
        </SidebarSection>

        <SidebarSection title="Materias">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: "0.72rem", color: "var(--text-tertiary)" }}>
              {items.length} bloque{items.length !== 1 ? "s" : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="btn btn-ghost btn-sm"
              onClick={onAddItem}
            >
              <Plus style={{ width: "1rem", height: "1rem" }} />
              Agregar
            </Button>
          </div>

          <div className="subject-list">
            {items.map((item) => (
              <SubjectEditorCard
                key={item.id}
                item={item}
                onUpdate={(key, value) => onUpdateItem(item.id, key, value)}
                onRemove={() => onRemoveItem(item.id)}
              />
            ))}
          </div>
        </SidebarSection>
      </div>
    </aside>
  )
}
