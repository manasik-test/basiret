import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, X, Send, Sparkles, Trash2 } from 'lucide-react'
import { useAskBasiret } from '../contexts/AskBasiretContext'
import { askBasiret, type AskHistoryTurn } from '../api/analytics'
import { cn } from '../lib/utils'

// Single source of truth for the per-conversation history limit. Backend
// caps at 6 turns (Pydantic max_length); we stay one short of that to avoid
// 422s when we slice the latest turns to send.
const MAX_HISTORY = 6
const MAX_QUESTION_CHARS = 500

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  language: 'en' | 'ar'
  timestamp: number
  degraded?: boolean
}

const STARTER_PROMPT_KEYS = [
  'askBasiret.starters.bestContent',
  'askBasiret.starters.bestTime',
  'askBasiret.starters.sentiment',
  'askBasiret.starters.thisWeek',
] as const

// Lightweight follow-up suggestions chosen by keyword match against the
// user's question. Keeps round-trips zero — no extra Gemini call per answer.
function suggestedFollowUps(t: (k: string) => string, lastQuestion: string): string[] {
  const q = lastQuestion.toLowerCase()
  if (/(content|video|image|reel|carousel|post type|format)/.test(q)) {
    return [t('askBasiret.followups.bestHashtags'), t('askBasiret.followups.topPostsType')]
  }
  if (/(time|when|day|hour|schedule)/.test(q)) {
    return [t('askBasiret.followups.bestDay'), t('askBasiret.followups.timingChange')]
  }
  if (/(sentiment|positive|negative|neutral|feel|emotion|reaction|comment)/.test(q)) {
    return [t('askBasiret.followups.negativePosts'), t('askBasiret.followups.responsiveTopics')]
  }
  return []
}

function detectLangFromText(t: string): 'en' | 'ar' {
  return /[؀-ۿ]/.test(t) ? 'ar' : 'en'
}

function newId(): string {
  // crypto.randomUUID is widely available; falls back to a timestamp+random
  // pair when the browser can't provide it (older Safari, sandboxed iframes).
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
      <span className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

function MessageBubble({ message, t }: { message: ChatMessage; t: (k: string) => string }) {
  const isUser = message.role === 'user'
  const isArabic = message.language === 'ar'
  const dirAttr = isArabic ? 'rtl' : 'auto'

  const time = new Date(message.timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className={cn('flex flex-col', isUser ? 'items-end' : 'items-start')}>
      <div
        dir={dirAttr}
        className={cn(
          'max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words',
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-md'
            : 'bg-white border border-border text-foreground rounded-bl-md',
          message.degraded && 'border-amber-300 bg-amber-50',
        )}
      >
        {message.content}
      </div>
      <span className="text-[10px] text-muted-foreground mt-1 px-1">
        {message.degraded ? `${t('askBasiret.degraded')} · ${time}` : time}
      </span>
    </div>
  )
}

function PanelInner() {
  const { t, i18n } = useTranslation()
  const { close } = useAskBasiret()
  const lang: 'en' | 'ar' = i18n.language?.startsWith('ar') ? 'ar' : 'en'

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to the latest bubble whenever the list grows or we transition
  // into the loading state (so the typing indicator is visible).
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, loading])

  // Auto-grow textarea up to ~4 rows
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`
  }, [input])

  async function send(question: string) {
    const trimmed = question.trim()
    if (!trimmed || loading) return

    const userMsg: ChatMessage = {
      id: newId(),
      role: 'user',
      content: trimmed,
      language: detectLangFromText(trimmed),
      timestamp: Date.now(),
    }
    // History sent to the backend = previous turns (NOT including the new
    // user question, which goes in `question`). Cap to MAX_HISTORY.
    const history: AskHistoryTurn[] = messages
      .slice(-MAX_HISTORY)
      .map((m) => ({ role: m.role, content: m.content }))

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await askBasiret({
        question: trimmed,
        language: lang,
        conversation_history: history,
      })
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: res.answer,
          language: res.language,
          timestamp: Date.now(),
        },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('askBasiret.errorGeneric')
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: msg,
          language: lang,
          timestamp: Date.now(),
          degraded: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const lastUserQuestion = [...messages].reverse().find((m) => m.role === 'user')?.content ?? ''
  const followUps =
    !loading && messages[messages.length - 1]?.role === 'assistant' && !messages[messages.length - 1]?.degraded
      ? suggestedFollowUps(t, lastUserQuestion)
      : []
  const remaining = MAX_QUESTION_CHARS - input.length
  const isEmpty = messages.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground leading-none">{t('askBasiret.title')}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t('askBasiret.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!isEmpty && (
            <button
              onClick={() => setMessages([])}
              className="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
              title={t('askBasiret.clear')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
            title={t('askBasiret.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground" dir="auto">
                {t('askBasiret.emptyTitle')}
              </p>
              <p className="text-xs text-muted-foreground mt-1" dir="auto">
                {t('askBasiret.emptySubtitle')}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-2">
              {STARTER_PROMPT_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => send(t(key))}
                  className="text-start text-xs text-foreground/80 px-3 py-2 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                  dir="auto"
                >
                  {t(key)}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} t={t} />
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-border rounded-2xl rounded-bl-md px-3.5 py-1.5">
                  <TypingIndicator />
                </div>
              </div>
            )}
            {followUps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {followUps.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => send(suggestion)}
                    className="text-[11px] text-primary px-2.5 py-1 rounded-full bg-primary/8 hover:bg-primary/15 border border-primary/20 transition-colors"
                    dir="auto"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border px-3 py-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              const v = e.target.value
              if (v.length <= MAX_QUESTION_CHARS) setInput(v)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('askBasiret.inputPlaceholder')}
            rows={1}
            disabled={loading}
            className="flex-1 resize-none px-3 py-2 text-sm rounded-xl border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 placeholder:text-muted-foreground"
            dir="auto"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="shrink-0 w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity"
            title={t('askBasiret.send')}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
            {lang === 'ar' ? 'AR' : 'EN'}
          </span>
          {remaining < 100 && (
            <span className={cn('text-[10px]', remaining < 0 ? 'text-rose-500' : 'text-muted-foreground')}>
              {remaining}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AskBasiretFab() {
  const { isOpen, toggle, close, open } = useAskBasiret()
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  // Direct-link entry from /ask-basiret (and any other `?ask=open` URLs):
  // open the panel, then strip the param from the URL so a refresh doesn't
  // re-fire it. Re-entrant: the param is gone after the first run, so the
  // effect won't loop even though `location` is in the dep list.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (params.get('ask') === 'open') {
      open()
      params.delete('ask')
      const cleaned = params.toString()
      navigate(
        { pathname: location.pathname, search: cleaned ? `?${cleaned}` : '' },
        { replace: true },
      )
    }
  }, [location, navigate, open])

  // Close on Escape — common chat-panel affordance
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, close])

  return (
    <>
      {/* Sliding panel — bottom-left corner, anchored to the FAB */}
      <div
        aria-hidden={!isOpen}
        className={cn(
          'fixed z-50 bottom-24 start-6 w-[calc(100vw-3rem)] max-w-[420px] h-[580px] max-h-[calc(100vh-8rem)]',
          'glass-strong rounded-2xl shadow-2xl border border-white/40 overflow-hidden',
          'transition-all duration-200 ease-out origin-bottom-left',
          isOpen
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none',
        )}
      >
        {/* Mount the inner conversation only when open so its state resets
            cleanly when the user closes/reopens — matches the spec's
            "no persistence between page navigations" rule. */}
        {isOpen && <PanelInner />}
      </div>

      {/* FAB — bottom-left, "+" rotates to "×" when open */}
      <button
        onClick={toggle}
        aria-label={isOpen ? t('askBasiret.close') : t('askBasiret.open')}
        title={isOpen ? t('askBasiret.close') : t('askBasiret.open')}
        className={cn(
          'fixed z-50 bottom-6 start-6 w-14 h-14 rounded-full bg-primary text-primary-foreground',
          'shadow-lg hover:shadow-xl flex items-center justify-center transition-all duration-200',
          'hover:scale-105 active:scale-95',
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6 transition-transform" />
        ) : (
          <Plus className="w-6 h-6 transition-transform" />
        )}
      </button>
    </>
  )
}
