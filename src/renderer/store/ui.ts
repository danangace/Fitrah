import { create } from 'zustand'

/** Which modal is open (one at a time). */
type Modal = { kind: 'add-project' } | { kind: 'create-workspace'; projectId?: string } | null

export const useModal = create<{ modal: Modal; open: (m: NonNullable<Modal>) => void; close: () => void }>((set) => ({
  modal: null,
  open: (modal) => set({ modal }),
  close: () => set({ modal: null }),
}))
