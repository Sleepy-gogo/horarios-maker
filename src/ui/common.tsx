import { forwardRef, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip } from "@/components/arc/tooltip/tooltip"
import { ColorPicker } from "@/components/arc/color-picker/color-picker"
import { TimePicker } from "@/components/arc/time-picker/time-picker"
import SegmentedControl from "@/components/arc/segmented-control/segmented-control"
import { DAYS } from "@/domain/constants"
import { normalizeHex, readableText } from "@/domain/color"
import type { DayId } from "@/domain/types"
import { formatMinutes } from "@/domain/time"
import { cn } from "@/lib/utils"
import { useStudio } from "@/state/studio"
import { useFieldId } from "./platform"

type IconButtonProps = Omit<ComponentProps<typeof Button>, "children"> & { label: string; shortcut?: string; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }

/** Icon-only button: the label is its accessible name and tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, shortcut, children, side = "bottom", variant = "ghost", size = "icon", ...props }, ref) {
  return (
    <Tooltip content={shortcut ? `${label} · ${shortcut}` : label} side={side}>
      <Button ref={ref} variant={variant} size={size} aria-label={label} {...props}>
        {children}
      </Button>
    </Tooltip>
  )
})

export { Select, type SelectOption } from "@/components/arc/select/select"

export function Field({ label, hint, error, children, htmlFor, className }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm leading-tight font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function SectionTitle({ children, action, description }: { children: ReactNode; action?: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2">
      <div className="min-w-0">
        <h3 className="section-label">{children}</h3>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

/** Moves focus and selection with the arrow keys inside a radio-like group; only the chosen item is a tab stop. */
function useRoving(count: number, index: number, choose: (index: number) => void) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const last = count - 1
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? (index >= last ? 0 : index + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index <= 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : -1
    if (next < 0) return
    event.preventDefault()
    choose(next)
    refs.current[next]?.focus()
  }
  return { refs, onKeyDown }
}

export type ChoiceTile = { value: string; label: string; meta?: ReactNode; visual?: ReactNode; disabled?: boolean }

/** A radio group of visual tiles: a picture of the option, its name, and a quiet detail line. */
export function ChoiceTiles({ label, options, value, onChange, className, size = "md", direction = "column", indicator = true }: { label: string; options: ChoiceTile[]; value: string; onChange: (value: string) => void; className?: string; size?: "sm" | "md"; direction?: "column" | "row"; indicator?: boolean }) {
  const index = Math.max(0, options.findIndex((option) => option.value === value))
  const { refs, onKeyDown } = useRoving(options.length, index, (next) => onChange(options[next]!.value))
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid gap-2", className)}>
      {options.map((option, position) => {
        const checked = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => void (refs.current[position] = node)}
            type="button"
            role="radio"
            aria-checked={checked}
            disabled={option.disabled}
            tabIndex={position === index ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => onChange(option.value)}
            className={cn(
              "group relative flex min-w-0 overflow-hidden rounded-xl border bg-card text-left outline-none transition-[border-color,box-shadow] duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
              direction === "row" ? "flex-row items-center pl-3" : "flex-col",
              checked ? "border-primary shadow-[0_0_0_1px_var(--primary)]" : "border-border hover:border-foreground/25",
            )}
          >
            {option.visual}
            <span className={cn("flex min-w-0 flex-1 items-center gap-2", size === "sm" ? "px-2.5 py-2" : "px-3 py-2.5")}>
              <span className={cn("min-w-0 flex-1", !indicator && "text-center")}>
                <span className={cn("block truncate leading-tight font-medium", size === "sm" ? "text-[0.8125rem]" : "text-sm")}>{option.label}</span>
                {option.meta ? <span className="mt-0.5 block truncate text-xs text-muted-foreground tabular-nums">{option.meta}</span> : null}
              </span>
              {indicator ? (
                <span aria-hidden="true" className={cn("grid size-4 shrink-0 place-items-center rounded-full transition-colors", checked ? "bg-primary text-primary-foreground" : "border border-input")}>
                  {checked ? <Check className="size-2.5" strokeWidth={3.5} /> : null}
                </span>
              ) : null}
            </span>
          </button>
        )
      })}
    </div>
  )
}

const chip = "inline-flex h-8 min-w-0 items-center justify-center rounded-lg border text-[0.8125rem] font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:h-10"

type DayChipsProps = { label: string; days?: DayId[]; className?: string } & ({ multiple: true; value: DayId[]; onChange: (days: DayId[]) => void } | { multiple?: false; value: DayId; onChange: (day: DayId) => void })

/** Days of the week as equal chips. Several can be on (visible days), or exactly one (a class's day). */
export function DayChips(props: DayChipsProps) {
  const days = DAYS.filter((day) => !props.days || props.days.includes(day.id))
  const single = !props.multiple
  const index = props.multiple ? 0 : Math.max(0, days.findIndex((day) => day.id === props.value))
  const { refs, onKeyDown } = useRoving(days.length, index, (next) => {
    if (!props.multiple) props.onChange(days[next]!.id)
  })
  const toggle = (day: DayId, on: boolean) => {
    if (props.multiple) props.onChange(on ? props.value.filter((item) => item !== day) : [...props.value, day])
    else props.onChange(day)
  }
  return (
    <div role={single ? "radiogroup" : "group"} aria-label={props.label} className={cn("grid gap-1", props.className)} style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((day, position) => {
        const on = props.multiple ? props.value.includes(day.id) : props.value === day.id
        return (
          <button
            key={day.id}
            ref={(node) => void (refs.current[position] = node)}
            type="button"
            title={day.label}
            aria-label={day.label}
            {...(single ? { role: "radio", "aria-checked": on, tabIndex: position === index ? 0 : -1, onKeyDown } : { "aria-pressed": on })}
            onClick={() => toggle(day.id, on)}
            className={cn(chip, on ? "border-primary/45 bg-primary/10 text-primary" : "border-border bg-transparent text-muted-foreground hover:border-foreground/25 hover:text-foreground")}
          >
            {day.short}
          </button>
        )
      })}
    </div>
  )
}

/** The theme palette as round swatches. The chosen one carries a check in the color its text would use. */
export function SwatchPicker({ label, colors, value, onChange, className }: { label: string; colors: string[]; value: string; onChange: (color: string) => void; className?: string }) {
  const unique = [...new Set(colors.map((color) => color.toUpperCase()))]
  const index = unique.indexOf(value.toUpperCase())
  const stop = Math.max(0, index)
  const { refs, onKeyDown } = useRoving(unique.length, stop, (next) => onChange(unique[next]!))
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {unique.map((color, position) => {
        const checked = position === index
        return (
          <button
            key={color}
            ref={(node) => void (refs.current[position] = node)}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={color}
            tabIndex={position === stop ? 0 : -1}
            onKeyDown={onKeyDown}
            onClick={() => onChange(color)}
            className={cn(
              "grid size-8 place-items-center rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] outline-none transition-transform duration-150 focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-95 pointer-coarse:size-9",
              checked && "ring-2 ring-foreground ring-offset-2 ring-offset-[var(--popover)]",
            )}
            style={{ background: color }}
          >
            {checked ? <Check className="size-4" strokeWidth={2.75} style={{ color: readableText(color) }} aria-hidden="true" /> : null}
          </button>
        )
      })}
    </div>
  )
}

/** A labeled segmented control for two to four short, mutually exclusive options. */
export function Segmented<T extends string>({ label, options, value, onChange, hideLabel, className }: { label: string; options: { value: T; label: string }[]; value: T; onChange: (value: T) => void; hideLabel?: boolean; className?: string }) {
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      {hideLabel ? null : <span className="text-sm leading-tight font-medium">{label}</span>}
      <SegmentedControl label={label} options={options} value={value} onValueChange={(next) => onChange(next as T)} className="segmented-fill" />
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-secondary px-1 font-mono text-[0.68rem] text-muted-foreground">{children}</kbd>
}


/** Color field with saved swatches shared across the app (persisted in preferences). */
export function ColorField({ label, value, onChange, background, contrastLabel }: { label: string; value: string; onChange: (hex: string) => void; background?: string; contrastLabel?: string }) {
  const swatches = useStudio((state) => state.prefs.swatches)
  const setPrefs = useStudio((state) => state.setPrefs)
  return (
    <ColorPicker
      label={label}
      value={value}
      alpha={false}
      background={background ?? "#FFFFFF"}
      contrastLabel={contrastLabel}
      maxSwatches={12}
      swatches={swatches.map((color, index) => ({ id: `${index}-${color}`, color }))}
      onSwatchesChange={(next) => setPrefs({ swatches: next.map((entry) => entry.color) })}
      onValueChange={(hex) => {
        const normalized = normalizeHex(hex)
        if (normalized) onChange(normalized.slice(0, 7))
      }}
    />
  )
}

const toText = (minutes: number) => formatMinutes(minutes)
const fromText = (text: string) => {
  const [h, m] = text.split(":").map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

/** 24-hour time in 30-minute steps with exact typed entry; 24:00 only for end fields. */
export function TimeField({ label, value, onChange, end = false, min, max, hideLabel, disabled, className }: { label: string; value: number; onChange: (minutes: number) => void; end?: boolean; min?: number; max?: number; hideLabel?: boolean; disabled?: boolean; className?: string }) {
  return (
    <TimePicker
      label={label}
      hideLabel={hideLabel}
      value={toText(value)}
      onChange={(text) => onChange(fromText(text))}
      includeEndOfDay={end}
      min={min ?? (end ? 30 : 0)}
      max={max ?? (end ? 1440 : 1410)}
      disabled={disabled}
      className={className}
    />
  )
}


export function Swatch({ color, className }: { color: string; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-3 shrink-0 rounded-full ring-1 ring-black/15 ring-inset", className)} style={{ background: color }} />
}

/** Labeled switch row. The whole row is the label, so it is easy to hit on touch screens. */
export function SwitchRow({ label, description, checked, onCheckedChange, disabled }: { label: string; description?: string; checked: boolean; onCheckedChange: (checked: boolean) => void; disabled?: boolean }) {
  const id = useFieldId("switch")
  return (
    <label htmlFor={id} className={cn("flex min-h-9 cursor-pointer items-center justify-between gap-3 rounded-md py-1", disabled && "cursor-not-allowed opacity-60")}>
      <span className="min-w-0">
        <span className="block text-sm leading-tight">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(!!value)} disabled={disabled} />
    </label>
  )
}

/** Text input that commits once on blur or Enter, so typing produces a single history entry. Escape restores the value. */
export function CommitInput({ value, onCommit, multiline = false, className, maxLength, ...props }: Omit<ComponentProps<"input">, "value" | "onChange" | "defaultValue"> & { value: string; onCommit: (value: string) => void; multiline?: boolean }) {
  const [draft, setDraft] = useState(value)
  const [base, setBase] = useState(value)
  if (base !== value) {
    setBase(value)
    setDraft(value)
  }
  const finish = () => {
    if (draft !== value) onCommit(draft)
  }
  const shared = {
    value: draft,
    maxLength,
    onBlur: finish,
    onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (!multiline || event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        finish()
      }
      if (event.key === "Escape" && draft !== value) {
        event.preventDefault()
        event.stopPropagation()
        setDraft(value)
      }
    },
  }
  if (multiline) {
    return <Textarea {...shared} id={props.id} placeholder={props.placeholder} aria-label={props["aria-label"]} onChange={(event) => setDraft(event.target.value)} className={cn("min-h-16 resize-none", className)} />
  }
  return <Input {...props} {...shared} onChange={(event) => setDraft(event.target.value)} className={className} />
}
