import { useEffect } from "react"
import { toast } from "sonner"
import { STEP } from "@/domain/constants"
import {
  adjustEdge, cancelCandidate, confirmCandidate, copyBlock, deleteBlock, moveCandidate, nudgeBlock, parseClipboard, selectedBlock, shiftBlockDay, startDuplicate, startPaste,
} from "@/state/actions"
import { useEditor } from "@/state/editor"
import { useStudio } from "@/state/studio"
import { cancelActiveGesture } from "./canvas/gesture"
import { setZoom, zoomBy } from "./commands"

/** True when the key belongs to a text field, a menu, a list or another widget that handles its own keys. */
function ownsKeys(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (target.closest("input, textarea, select, [contenteditable='true']")) return true
  if (target.closest("[role='menu'], [role='menubar'], [role='listbox'], [role='combobox'], [role='slider'], [role='spinbutton'], [role='tablist'], [role='radiogroup']")) return true
  return false
}

function inModal() {
  return !!document.querySelector("[role='dialog'][data-state='open'], [role='alertdialog'][data-state='open'], [data-slot='dropdown-menu-content']")
}

/** Global editing shortcuts. Native copy/paste events keep the system clipboard in sync and never fire while typing in fields. */
export function useShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.defaultPrevented) return
      const studio = useStudio.getState()
      const editor = useEditor.getState()
      const doc = studio.session?.doc
      const mod = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      const typing = ownsKeys(event.target)
      const modal = inModal()

      if (event.key === "Escape" && !typing && !modal) {
        if (cancelActiveGesture()) {
          event.preventDefault()
          return
        }
        if (editor.candidate) {
          event.preventDefault()
          cancelCandidate()
          return
        }
        if (editor.tool === "place") {
          editor.set({ tool: "select", hover: null })
          return
        }
        if (editor.selectedBlockId) editor.select(null)
        return
      }

      if (mod && !event.altKey) {
        // Shortcuts that work everywhere, including inside fields, because the browser default would be harmful.
        if (key === "s") {
          event.preventDefault()
          if (doc) void studio.saveNow().then((ok) => (ok ? toast.success("Guardado en este navegador") : toast.error("No se pudo guardar")))
          return
        }
        if (key === "k") {
          event.preventDefault()
          editor.openDialog("commands")
          return
        }
        if (modal) return
        if (key === "o") {
          event.preventDefault()
          editor.openDialog("projects")
          return
        }
        if (key === "e" && event.shiftKey) {
          event.preventDefault()
          if (doc) editor.openDialog("export")
          return
        }
        if (key === "a" && event.shiftKey) {
          event.preventDefault()
          if (doc) editor.openDialog("appearance")
          return
        }
        if (event.key === ",") {
          event.preventDefault()
          if (doc) editor.openDialog("settings")
          return
        }
        if (typing) return
        if (key === "z" && !event.shiftKey) {
          event.preventDefault()
          if (cancelActiveGesture()) return
          studio.undo()
          return
        }
        if ((key === "z" && event.shiftKey) || key === "y") {
          event.preventDefault()
          studio.redo()
          return
        }
        if (key === "d") {
          event.preventDefault()
          const block = selectedBlock()
          if (block) startDuplicate(block.id)
          return
        }
        if (event.key === "+" || event.key === "=") {
          event.preventDefault()
          zoomBy(1.25)
          return
        }
        if (event.key === "-" || event.key === "_") {
          event.preventDefault()
          zoomBy(0.8)
          return
        }
        if (event.key === "0") {
          event.preventDefault()
          editor.set({ fit: true })
          return
        }
        if (event.key === "1") {
          event.preventDefault()
          setZoom(1)
          return
        }
        return
      }

      if (typing || modal || !doc) return
      if (event.altKey && event.key !== "ArrowUp" && event.key !== "ArrowDown") return

      if (editor.candidate) {
        const moves: Record<string, Parameters<typeof moveCandidate>[0]> = {
          ArrowUp: { minutes: -STEP },
          ArrowDown: { minutes: STEP },
          ArrowLeft: { day: -1 },
          ArrowRight: { day: 1 },
        }
        if (moves[event.key]) {
          event.preventDefault()
          moveCandidate(moves[event.key]!)
          return
        }
        if (event.key === "Enter") {
          event.preventDefault()
          confirmCandidate()
          return
        }
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
        if (key === "v") {
          editor.set({ tool: "select", hover: null })
          return
        }
        if (key === "b" && doc.subjects.length) {
          editor.arm(editor.armedSubjectId ?? doc.subjects[0]!.id)
          return
        }
      }
      if (event.key === "?") {
        editor.openDialog("shortcuts")
        return
      }

      const block = selectedBlock()
      if (!block) return
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault()
        deleteBlock(block.id)
        return
      }
      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        const delta = event.key === "ArrowUp" ? -STEP : STEP
        if (event.shiftKey) adjustEdge(block.id, "end", delta)
        else if (event.altKey) adjustEdge(block.id, "start", delta)
        else nudgeBlock(block.id, delta)
        return
      }
      if ((event.key === "ArrowLeft" || event.key === "ArrowRight") && !event.shiftKey) {
        event.preventDefault()
        shiftBlockDay(block.id, event.key === "ArrowLeft" ? -1 : 1)
        return
      }
      if (event.key === "Enter" && window.matchMedia("(max-width: 1179px)").matches) {
        editor.set({ mobileSheet: "inspector" })
      }
    }

    const onCopy = (event: ClipboardEvent) => {
      if (ownsKeys(document.activeElement) || inModal() || window.getSelection()?.toString()) return
      const block = selectedBlock()
      if (!block) return
      const payload = copyBlock(block.id)
      if (!payload) return
      event.preventDefault()
      event.clipboardData?.setData("text/plain", JSON.stringify(payload))
      toast("Clase copiada", { description: "Pegala con " + (navigator.platform.includes("Mac") ? "⌘V" : "Ctrl+V") + " en este u otro proyecto." })
    }

    const onPaste = (event: ClipboardEvent) => {
      if (ownsKeys(document.activeElement) || inModal() || !useStudio.getState().session) return
      const text = event.clipboardData?.getData("text/plain") ?? ""
      const payload = parseClipboard(text) ?? useEditor.getState().clipboard
      if (!payload) return
      event.preventDefault()
      startPaste(payload)
    }

    window.addEventListener("keydown", onKeyDown)
    document.addEventListener("copy", onCopy)
    document.addEventListener("paste", onPaste)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      document.removeEventListener("copy", onCopy)
      document.removeEventListener("paste", onPaste)
    }
  }, [])
}
