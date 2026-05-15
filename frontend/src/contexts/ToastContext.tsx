/**
 * Minimal toast notification system.
 *
 * No third-party library — Day 3-4 of Week 1 needed exactly one toast surface
 * ("Your 7 posts are ready"), so a 60-line context + container beats pulling in
 * sonner/react-hot-toast for one call site. If a second toast caller appears,
 * the API (`toast.success`, `toast.error`, `toast.info` with optional onClick)
 * already supports it.
 *
 * Behavior:
 *   - Auto-dismisses after 5s
 *   - onClick fires the optional handler then dismisses
 *   - Stacks bottom-end (right in LTR, left in RTL via `end-6`)
 *   - z-index sits above the Ask Basiret FAB and panel
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  kind: ToastKind
  message: string
  onClick?: () => void
}

interface ToastApi {
  show: (kind: ToastKind, message: string, opts?: { onClick?: () => void }) => void
  success: (message: string, opts?: { onClick?: () => void }) => void
  error: (message: string, opts?: { onClick?: () => void }) => void
  info: (message: string, opts?: { onClick?: () => void }) => void
  dismiss: (id: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

const AUTO_DISMISS_MS = 5000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
    if (timersRef.current[id]) {
      clearTimeout(timersRef.current[id])
      delete timersRef.current[id]
    }
  }, [])

  const show = useCallback(
    (kind: ToastKind, message: string, opts?: { onClick?: () => void }) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      setItems((prev) => [...prev, { id, kind, message, onClick: opts?.onClick }])
      timersRef.current[id] = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
    },
    [dismiss],
  )

  // Clean up timers on unmount so React doesn't leak intervals.
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout)
      timersRef.current = {}
    }
  }, [])

  const api: ToastApi = {
    show,
    success: (m, o) => show('success', m, o),
    error: (m, o) => show('error', m, o),
    info: (m, o) => show('info', m, o),
    dismiss,
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer items={items} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

function ToastContainer({
  items,
  dismiss,
}: {
  items: ToastItem[]
  dismiss: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div
      className="fixed bottom-6 end-6 z-[60] flex flex-col gap-2"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {items.map((t) => {
        const palette = TOAST_PALETTE[t.kind]
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              if (t.onClick) t.onClick()
              dismiss(t.id)
            }}
            className={`min-w-[260px] max-w-[420px] rounded-xl px-4 py-3 text-sm shadow-lg border text-start ${palette}`}
            dir="auto"
          >
            <span className="block font-medium">{t.message}</span>
          </button>
        )
      })}
    </div>
  )
}

const TOAST_PALETTE: Record<ToastKind, string> = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100',
  error: 'bg-rose-50 border-rose-200 text-rose-900 hover:bg-rose-100',
  info: 'bg-slate-50 border-slate-200 text-slate-900 hover:bg-slate-100',
}
