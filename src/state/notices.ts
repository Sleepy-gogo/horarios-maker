import { create } from "zustand"

export type NoticeAction = { label: string; run: () => void | Promise<void>; primary?: boolean }

export type Notice = {
  id: string
  tone: "info" | "success" | "warning" | "danger"
  title: string
  body?: string
  details?: string[]
  actions?: NoticeAction[]
  /** Persistent notices stay until the user dismisses them or the cause is resolved. */
  dismissible?: boolean
}

type NoticeState = {
  notices: Notice[]
  push: (notice: Notice) => void
  dismiss: (id: string) => void
}

export const useNotices = create<NoticeState>((set) => ({
  notices: [],
  push: (notice) => set((state) => ({ notices: [...state.notices.filter((item) => item.id !== notice.id), notice] })),
  dismiss: (id) => set((state) => ({ notices: state.notices.filter((item) => item.id !== id) })),
}))

type AnnounceState = { message: string; seq: number; announce: (message: string) => void }

/** Polite live region text for confirmed results; never fed from pointer moves. */
export const useAnnouncer = create<AnnounceState>((set) => ({
  message: "",
  seq: 0,
  announce: (message) => set((state) => ({ message, seq: state.seq + 1 })),
}))

export function announce(message: string) {
  useAnnouncer.getState().announce(message)
}
