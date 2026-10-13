import { useEditor } from "@/state/editor"

/** Reads a value passed when the current dialog was opened. */
export function dialogPayload<T>(key: string): T | undefined {
  return useEditor.getState().dialog?.payload?.[key] as T | undefined
}
