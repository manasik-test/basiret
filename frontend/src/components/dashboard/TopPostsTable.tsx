import { useTranslation } from 'react-i18next'
import { useTopPosts } from '../../hooks/useAnalytics'
import { Heart, MessageCircle, Image as ImageIcon, Video, LayoutGrid, ExternalLink, Film } from 'lucide-react'

function ContentTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'video':
      return <Video className="w-4 h-4 text-primary" />
    case 'reel':
      return <Film className="w-4 h-4 text-primary" />
    case 'carousel':
      return <LayoutGrid className="w-4 h-4 text-cta" />
    default:
      return <ImageIcon className="w-4 h-4 text-accent-foreground" />
  }
}

function Thumbnail({ url, type, caption }: { url: string | null; type: string; caption: string }) {
  if (!url) {
    return (
      <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
        <ContentTypeIcon type={type} />
      </div>
    )
  }
  return (
    <img
      src={url}
      alt={caption.slice(0, 40) || 'post'}
      className="w-12 h-12 rounded-lg object-cover bg-muted"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={(e) => {
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}

export default function TopPostsTable() {
  const { t, i18n } = useTranslation()
  const { data: posts, isLoading } = useTopPosts(10)

  const dateLocale = i18n.language?.startsWith('ar') ? 'ar-SA' : 'en-US'

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        {t('dashboard.topPosts')}
      </h2>
      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground">
          {t('dashboard.loading')}
        </div>
      ) : !posts || posts.length === 0 ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          {t('dashboard.noTopPosts', 'No posts yet — sync Instagram to see your top performers here.')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-start pb-3 font-medium w-14">{t('dashboard.type')}</th>
                <th className="text-start pb-3 font-medium">{t('dashboard.caption')}</th>
                <th className="text-start pb-3 font-medium">
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5" /> {t('dashboard.likes')}
                  </span>
                </th>
                <th className="text-start pb-3 font-medium">
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-3.5 h-3.5" /> {t('dashboard.comments')}
                  </span>
                </th>
                <th className="text-start pb-3 font-medium">{t('dashboard.date')}</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => {
                const date = post.posted_at
                  ? new Date(post.posted_at).toLocaleDateString(dateLocale, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : '—'
                return (
                  <tr
                    key={post.id}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <td className="py-3">
                      <Thumbnail url={post.thumbnail_url} type={post.content_type} caption={post.caption} />
                    </td>
                    <td className="py-3 text-foreground max-w-[280px]">
                      <div className="flex items-center gap-1.5">
                        <ContentTypeIcon type={post.content_type} />
                        <span dir="auto" className="truncate">
                          {post.caption || <span className="text-muted-foreground italic">—</span>}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-foreground font-medium tabular-nums">
                      {post.likes.toLocaleString()}
                    </td>
                    <td className="py-3 text-foreground font-medium tabular-nums">
                      {post.comments.toLocaleString()}
                    </td>
                    <td className="py-3 text-muted-foreground whitespace-nowrap">{date}</td>
                    <td className="py-3">
                      {post.permalink ? (
                        <a
                          href={post.permalink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-primary hover:underline"
                          aria-label="Open on Instagram"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
