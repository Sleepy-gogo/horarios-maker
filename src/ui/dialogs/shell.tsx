import type { FormEvent, ReactNode } from "react"
import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet"
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog"
import { useLayoutTier } from "@/hooks/use-media"
import { cn } from "@/lib/utils"
import { useEditor, type DialogName } from "@/state/editor"

type ShellProps = {
  name: DialogName | DialogName[]
  title: string
  description?: string
  width?: number
  /** "split" hands the body to the content: no padding, a fixed height, and its own scroll regions. */
  layout?: "form" | "split"
  /** Height of the sheet on phones, as a fraction of the screen. Short dialogs ask for less. */
  sheet?: number
  className?: string
  children: ReactNode
}

/**
 * A dialog bound to the editor dialog state. Content mounts on open, so every opening starts fresh.
 * Phones get a bottom sheet instead: it rises from the thumb, can be dragged away, and keeps the action row in reach.
 */
export function DialogShell({ name, title, description, width = 480, layout = "form", sheet = 0.92, className, children }: ShellProps) {
  const names = Array.isArray(name) ? name : [name]
  const open = useEditor((state) => !!state.dialog && names.includes(state.dialog.name))
  const phone = useLayoutTier() === "phone"
  const onOpenChange = (next: boolean) => !next && useEditor.getState().closeDialog()

  if (phone) {
    return (
      <BottomSheet open={open} onOpenChange={onOpenChange} title={title} description={description} detents={[sheet]} className={cn("dialog-sheet", className)}>
        {children}
      </BottomSheet>
    )
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        className={cn("dialog-shell", className)}
        bodyClassName={layout === "split" ? "dialog-split" : undefined}
        style={{ width: `min(calc(100vw - 2rem), ${width}px)`, ...(layout === "split" ? { height: "min(calc(100dvh - 2rem), 760px)" } : null) }}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}

type SplitProps = {
  /** The controls. They scroll on their own beside the stage. */
  main: ReactNode
  /** The stage beside the controls, usually a live preview. */
  aside: ReactNode
  /** What phones show above the controls instead of the full stage, if anything. */
  compactAside?: ReactNode
  footer: ReactNode
  /** Column width of the controls on larger screens. */
  mainWidth?: string
  /** Puts the stage on the left, where the eye lands first. */
  asideFirst?: boolean
  onSubmit?: () => void
}

/**
 * Body of a split dialog. Larger screens get two panes, controls and stage, each with its own scroll, over a full-width footer.
 * Phones get one column in the sheet: an optional compact stage, the controls, and the footer pinned to the bottom.
 */
export function SplitBody({ main, aside, compactAside, footer, mainWidth = "26rem", asideFirst = false, onSubmit }: SplitProps) {
  const phone = useLayoutTier() === "phone"
  const Root = onSubmit ? "form" : "div"
  const submit = onSubmit
    ? {
        onSubmit: (event: FormEvent) => {
          event.preventDefault()
          onSubmit()
        },
      }
    : {}
  if (phone) {
    return (
      <Root className="grid gap-6" {...submit}>
        {compactAside}
        {main}
        {footer}
      </Root>
    )
  }
  const columns = asideFirst ? `minmax(0,1fr) minmax(0,${mainWidth})` : `minmax(0,${mainWidth}) minmax(0,1fr)`
  return (
    <Root className="flex min-h-0 flex-1 flex-col" {...submit}>
      <div className="grid min-h-0 flex-1 border-t border-border" style={{ gridTemplateColumns: columns }}>
        <div className={cn("min-h-0 overflow-y-auto overscroll-contain px-6 pt-5 pb-8", asideFirst && "order-2 border-l border-border")}>{main}</div>
        <div className={cn("min-h-0", asideFirst ? "order-1" : "border-l border-border")}>{aside}</div>
      </div>
      {footer}
    </Root>
  )
}

/** Action row pinned to the bottom of the dialog body, or of the sheet on phones. */
export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("dialog-footer", className)}>{children}</div>
}

/** Quiet text at the start of the footer. Hidden on phones, where the row holds only the actions. */
export function FooterNote({ children }: { children: ReactNode }) {
  return <span className="footer-note mr-auto min-w-0 truncate text-xs text-muted-foreground tabular-nums">{children}</span>
}
