import type { ReactNode } from "react"
import { Dialog, DialogContent } from "@/components/arc/dialog/dialog"
import { cn } from "@/lib/utils"
import { useEditor, type DialogName } from "@/state/editor"

/** A dialog bound to the editor dialog state. Content mounts on open, so every opening starts fresh. */
export function DialogShell({ name, title, description, width = 480, className, children }: { name: DialogName | DialogName[]; title: string; description?: string; width?: number; className?: string; children: ReactNode }) {
  const names = Array.isArray(name) ? name : [name]
  const open = useEditor((state) => !!state.dialog && names.includes(state.dialog.name))
  return (
    <Dialog open={open} onOpenChange={(next) => !next && useEditor.getState().closeDialog()}>
      <DialogContent title={title} description={description} className={cn("dialog-shell", className)} style={{ width: `min(calc(100vw - 1.5rem), ${width}px)`, maxHeight: "calc(100dvh - 1.5rem)" }}>
        {children}
      </DialogContent>
    </Dialog>
  )
}

/** Sticky action row at the bottom of a dialog body. */
export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("sticky -bottom-6 z-10 -mx-6 -mb-6 mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-[var(--surface-raised)] px-6 py-4", className)}>{children}</div>
}
