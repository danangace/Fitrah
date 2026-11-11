import { create } from 'zustand'
import type { AlertVariant } from '../components/ui/Alert'

export type Toast = { id: number; title: string; description?: string; variant: AlertVariant }

type ToastState = {
  toasts: Toast[]
  dismiss: (id: number) => void
}

let nextId = 1
const DURATION = 4000
const MAX = 4

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Bottom-right alert, gone after a few seconds. `toast.success('Saved')`, `toast.error('…')`. */
function show(variant: AlertVariant, title: string, description?: string): void {
  const id = nextId++
  useToasts.setState((s) => ({ toasts: [...s.toasts, { id, title, description, variant }].slice(-MAX) }))
  setTimeout(() => useToasts.getState().dismiss(id), DURATION)
}

export const toast = {
  success: (title: string, description?: string) => show('success', title, description),
  error: (title: string, description?: string) => show('destructive', title, description),
  info: (title: string, description?: string) => show('default', title, description),
}
