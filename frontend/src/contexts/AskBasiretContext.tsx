import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface AskBasiretState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

const Ctx = createContext<AskBasiretState | null>(null)

export function AskBasiretProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((v) => !v), [])
  return <Ctx.Provider value={{ isOpen, open, close, toggle }}>{children}</Ctx.Provider>
}

export function useAskBasiret(): AskBasiretState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAskBasiret must be used inside <AskBasiretProvider>')
  return ctx
}
