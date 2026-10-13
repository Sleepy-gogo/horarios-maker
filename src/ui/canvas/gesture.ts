let activeCancel: (() => void) | null = null

/** Registers the cancel function of the pointer gesture in progress (null when it ends). */
export function setActiveGesture(cancel: (() => void) | null) {
  activeCancel = cancel
}

/** Cancels an in-progress pointer gesture (Escape). Returns true when there was one. */
export function cancelActiveGesture() {
  if (!activeCancel) return false
  activeCancel()
  return true
}
