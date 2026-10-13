import { forwardRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip } from "@/components/arc/tooltip/tooltip"
import { ColorPicker } from "@/components/arc/color-picker/color-picker"
import { TimePicker } from "@/components/arc/time-picker/time-picker"
import { normalizeHex } from "@/domain/color"
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

export function Field({ label, hint, error, children, htmlFor, className }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; className?: string }) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium leading-tight">
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

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2">
      <h3 className="text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{children}</h3>
      {action}
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

/** Native select styled like the inputs: reliable on touch screens and with screen readers. */
export function NativeSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <select
        className="h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent pr-8 pl-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"
        {...props}
      >
        {children}
      </select>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground">
        <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
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
