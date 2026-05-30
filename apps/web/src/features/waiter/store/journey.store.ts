import { create } from 'zustand'

interface WaiterJourneyState {
  isOpen: boolean | null  // null = still loading / unknown
  sessionId: string | null
  startedAt: string | null
  setOpen: (sessionId: string, startedAt: string) => void
  setClosed: () => void
}

export const useWaiterJourneyStore = create<WaiterJourneyState>((set) => ({
  isOpen: null,
  sessionId: null,
  startedAt: null,
  setOpen: (sessionId, startedAt) => set({ isOpen: true, sessionId, startedAt }),
  setClosed: () => set({ isOpen: false, sessionId: null, startedAt: null }),
}))
