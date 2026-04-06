import { useTranslation } from 'react-i18next'
import { useOverview } from '../../hooks/useAnalytics'
import { Heart, MessageCircle, Image, Video, LayoutGrid } from 'lucide-react'

// Placeholder: in a future sprint, this will call GET /api/v1/analytics/posts
// For now we show a summary from the overview data
function ContentTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'VIDEO':
      return <Video className="w-4 h-4 text-primary" />
    case 'CAROUSEL_ALBUM':
      return <LayoutGrid className="w-4 h-4 text-cta" />
    default:
      return <Image className="w-4 h-4 text-accent-foreground" />
  }
}

interface MockPost {
  id: number
  type: string
  caption: string
  likes: number
  comments: number
  date: string
}

function generateMockPosts(totalLikes: number, totalComments: number): MockPost[] {
  const types = ['IMAGE', 'VIDEO', 'CAROUSEL_ALBUM']
  const posts: MockPost[] = []
  for (let i = 0; i < 8; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i * 2)
    posts.push({
      id: i + 1,
      type: types[i % 3],
      caption: `Post #${i + 1}`,
      likes: Math.round((totalLikes / 8) * (1.5 - i * 0.12)),
      comments: Math.round((totalComments / 8) * (1.4 - i * 0.1)),
      date: date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' }),
    })
  }
  return posts
}

export default function TopPostsTable() {
  const { t } = useTranslation()
  const { data: overview, isLoading } = useOverview()

  const posts = overview
    ? generateMockPosts(overview.total_likes, overview.total_comments)
    : []

  return (
    <div className="glass rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">
        {t('dashboard.topPosts')}
      </h2>
      {isLoading ? (
        <div className="h-48 flex items-center justify-center text-muted-foreground">
          {t('dashboard.loading')}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-start pb-3 font-medium">{t('dashboard.type')}</th>
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
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <td className="py-3">
                    <ContentTypeIcon type={post.type} />
                  </td>
                  <td className="py-3 text-foreground max-w-[200px] truncate">
                    {post.caption}
                  </td>
                  <td className="py-3 text-foreground font-medium">
                    {post.likes.toLocaleString()}
                  </td>
                  <td className="py-3 text-foreground font-medium">
                    {post.comments.toLocaleString()}
                  </td>
                  <td className="py-3 text-muted-foreground">{post.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
