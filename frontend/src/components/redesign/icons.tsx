import type { ReactNode } from 'react'

/* Port of `Basiretdashoards/components/shared.jsx` — icon set + content-type
 * primitives used by every redesigned page. */

interface IconProps {
  path: ReactNode
  size?: number
  stroke?: number
  className?: string
}

export const Icon = ({ path, size = 16, stroke = 1.7, className }: IconProps) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {path}
  </svg>
)

// Icon path fragments. Use as `<Icon path={I.clock} />`.
export const I = {
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  spark: (
    <path d="M12 3v3M12 18v3M4.2 7.2l2 2M17.8 14.8l2 2M3 12h3M18 12h3M4.2 16.8l2-2M17.8 9.2l2-2" />
  ),
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  chevL: <polyline points="15 18 9 12 15 6" />,
  chevR: <polyline points="9 18 15 12 9 6" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  filter: <path d="M3 5h18M6 12h12M10 19h4" />,
  trend: (
    <>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
    </>
  ),
  wand: (
    <>
      <path d="M15 4V2M15 10V8M11 6h2M17 6h2" />
      <path d="M3 21l12-12" />
      <path d="M12 6l2 2" />
    </>
  ),
  warn: (
    <>
      <path d="M10.3 3.86l-8.14 13.5A2 2 0 003.86 20h16.28a2 2 0 001.71-2.64L13.7 3.86a2 2 0 00-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  copy: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 21V9" />
    </>
  ),
  share: <path d="M7 17L17 7M17 7H8M17 7v9" />,
  bars: (
    <>
      <rect x="3" y="10" width="4" height="11" rx="1" />
      <rect x="10" y="5" width="4" height="16" rx="1" />
      <rect x="17" y="13" width="4" height="8" rx="1" />
    </>
  ),
  heart: (
    <path d="M12 21s-7-4.5-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-7 10-7 10z" />
  ),
  bolt: <path d="M13 2 4 14h7v8l9-12h-7z" />,
  users: (
    <>
      <circle cx="9" cy="9" r="3" />
      <path d="M3 21a6 6 0 0 1 12 0" />
      <circle cx="17" cy="8" r="2.5" />
      <path d="M14.5 21a4 4 0 0 1 7.5-2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" />
    </>
  ),
} as const

/* Content-type metadata + visual helpers */

export type ContentTypeKey = 'video' | 'image' | 'carousel'

export const TYPE_META: Record<ContentTypeKey, { color: string; tone: string }> = {
  video: { color: 'var(--video)', tone: 'rgba(234, 105, 90, 0.10)' },
  image: { color: 'var(--image)', tone: 'rgba(70, 168, 158, 0.10)' },
  carousel: { color: 'var(--carousel)', tone: 'rgba(124, 92, 239, 0.10)' },
}

// Normalise backend strings ("CAROUSEL_ALBUM", "VIDEO", "REELS", "IMAGE")
// to one of the three primitive types we render.
export function normalizeContentType(t: string | null | undefined): ContentTypeKey {
  if (!t) return 'image'
  const u = t.toUpperCase()
  if (u.includes('VIDEO') || u.includes('REEL')) return 'video'
  if (u.includes('CAROUSEL') || u.includes('ALBUM')) return 'carousel'
  return 'image'
}

interface TypeIconProps {
  type: ContentTypeKey
  size?: number
}

export const TypeIcon = ({ type, size = 14 }: TypeIconProps) => {
  const s = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (type === 'video')
    return (
      <svg {...s}>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="M16 10l5-3v10l-5-3" />
      </svg>
    )
  if (type === 'image')
    return (
      <svg {...s}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="1.8" />
        <path d="M21 16l-5-5-8 8" />
      </svg>
    )
  return (
    <svg {...s}>
      <rect x="7" y="5" width="12" height="14" rx="2" />
      <path d="M4 7v10M22 9v6" opacity=".55" />
    </svg>
  )
}

interface TypePillProps {
  type: ContentTypeKey
  label: string
  size?: 'sm' | 'md'
}

export const TypePill = ({ type, label, size = 'md' }: TypePillProps) => {
  const m = TYPE_META[type]
  const pad = size === 'sm' ? '3px 8px' : '4px 10px'
  const fs = size === 'sm' ? 11 : 12
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: pad,
        borderRadius: 999,
        background: m.tone,
        color: m.color,
        fontSize: fs,
        fontWeight: 600,
        letterSpacing: '-0.005em',
      }}
    >
      <TypeIcon type={type} size={size === 'sm' ? 11 : 13} />
      {label}
    </span>
  )
}
