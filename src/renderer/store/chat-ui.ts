import { create } from 'zustand'

/**
 * Chat UI state that must survive leaving the workspace page (e.g. a trip to Settings unmounts it):
 * the unsent composer text per chat and the selected chat tab per workspace.
 */
type ChatUi = {
  drafts: Record<string, string>
  activeChat: Record<string, string>
  setDraft: (chatId: string, text: string) => void
  setActiveChat: (workspaceId: string, chatId: string | null) => void
}

export const useChatUi = create<ChatUi>((set) => ({
  drafts: {},
  activeChat: {},
  setDraft: (chatId, text) =>
    set((s) => {
      const drafts = { ...s.drafts }
      if (text) drafts[chatId] = text
      else delete drafts[chatId]
      return { drafts }
    }),
  setActiveChat: (workspaceId, chatId) =>
    set((s) => {
      const activeChat = { ...s.activeChat }
      if (chatId) activeChat[workspaceId] = chatId
      else delete activeChat[workspaceId]
      return { activeChat }
    }),
}))
