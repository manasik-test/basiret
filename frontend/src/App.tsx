import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Swords, TrendingUp } from 'lucide-react'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import MarketingLayout from './components/layout/MarketingLayout'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Audience from './pages/Audience'
import Recommendations from './pages/Recommendations'
import Sentiment from './pages/Sentiment'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Admin from './pages/Admin'
import Onboarding from './pages/Onboarding'
import ComingSoon from './pages/ComingSoon'
import AskBasiretRedirect from './pages/AskBasiretRedirect'
import MyGoals from './pages/MyGoals'
import { useLanguageCacheInvalidation } from './hooks/useAnalytics'

// Marketing routes are lazy-loaded — they ship Framer Motion + WebGL on top
// of an already-large app bundle, so deferring keeps auth/dashboard cold-start
// fast for returning users.
const Home = lazy(() => import('./pages/marketing/Home'))
const PricingPage = lazy(() => import('./pages/marketing/Pricing'))
const PrivacyPage = lazy(() => import('./pages/marketing/Privacy'))
const TermsPage = lazy(() => import('./pages/marketing/Terms'))
const BlogIndexPage = lazy(() => import('./pages/marketing/blog/BlogIndex'))
const BlogPostPage = lazy(() => import('./pages/marketing/blog/BlogPost'))
const InstagramChannel = lazy(() => import('./pages/marketing/channels/Instagram'))
const FacebookChannel = lazy(() => import('./pages/marketing/channels/Facebook'))
const TikTokChannel = lazy(() => import('./pages/marketing/channels/TikTok'))
const LinkedInChannel = lazy(() => import('./pages/marketing/channels/LinkedIn'))
const XChannel = lazy(() => import('./pages/marketing/channels/X'))
const FeatureAudience = lazy(() => import('./pages/marketing/features/Audience'))
const FeatureActionPlan = lazy(() => import('./pages/marketing/features/ActionPlan'))
const FeatureContentPlanner = lazy(() => import('./pages/marketing/features/ContentPlanner'))
const FeatureCompetitors = lazy(() => import('./pages/marketing/features/Competitors'))
const FeatureAiAdvisor = lazy(() => import('./pages/marketing/features/AiAdvisor'))
const ForSmallBusiness = lazy(() => import('./pages/marketing/for/SmallBusiness'))
const ForCreators = lazy(() => import('./pages/marketing/for/Creators'))
const ForAgencies = lazy(() => import('./pages/marketing/for/Agencies'))
const ForEnterprise = lazy(() => import('./pages/marketing/for/Enterprise'))

function MarketingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="size-8 rounded-full border-2 border-[#664FA1]/20 border-t-[#664FA1] animate-spin" />
    </div>
  )
}

export default function App() {
  useLanguageCacheInvalidation()
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public marketing routes (22 total) — all share MarketingLayout (Navbar + Footer) */}
          <Route
            element={
              <Suspense fallback={<MarketingFallback />}>
                <MarketingLayout />
              </Suspense>
            }
          >
            <Route index element={<Home />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/blog" element={<BlogIndexPage />} />
            <Route path="/blog/:slug" element={<BlogPostPage />} />
            <Route path="/channels/instagram" element={<InstagramChannel />} />
            <Route path="/channels/facebook" element={<FacebookChannel />} />
            <Route path="/channels/tiktok" element={<TikTokChannel />} />
            <Route path="/channels/linkedin" element={<LinkedInChannel />} />
            <Route path="/channels/x" element={<XChannel />} />
            <Route path="/features/audience" element={<FeatureAudience />} />
            <Route path="/features/action-plan" element={<FeatureActionPlan />} />
            <Route path="/features/content-planner" element={<FeatureContentPlanner />} />
            <Route path="/features/competitors" element={<FeatureCompetitors />} />
            <Route path="/features/ai-advisor" element={<FeatureAiAdvisor />} />
            <Route path="/for/small-business" element={<ForSmallBusiness />} />
            <Route path="/for/creators" element={<ForCreators />} />
            <Route path="/for/agencies" element={<ForAgencies />} />
            <Route path="/for/enterprise" element={<ForEnterprise />} />
          </Route>

          {/* Public: registration is step 1 of the onboarding wizard */}
          <Route path="/register" element={<Onboarding />} />
          <Route path="/login" element={<Login />} />

          {/* Protected: deep-link into step 2 if user is already authenticated */}
          <Route
            path="/onboarding/connect-instagram"
            element={
              <ProtectedRoute>
                <Onboarding initialStep="connect" />
              </ProtectedRoute>
            }
          />

          {/* Protected app routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout><Dashboard /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-posts"
            element={
              <ProtectedRoute>
                <AppLayout><Analytics /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-audience"
            element={
              <ProtectedRoute>
                <AppLayout><Audience /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/content-plan"
            element={
              <ProtectedRoute>
                <AppLayout><Recommendations /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/competitors"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ComingSoon titleKey="nav.competitors" questionKey="comingSoon.competitorsQ" icon={Swords} />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sentiment"
            element={
              <ProtectedRoute>
                <AppLayout><Sentiment /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/trends"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ComingSoon titleKey="nav.trends" questionKey="comingSoon.trendsQ" icon={TrendingUp} />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-goals"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <MyGoals />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          {/* Direct link → home with the chat panel auto-opened */}
          <Route
            path="/ask-basiret"
            element={
              <ProtectedRoute>
                <AskBasiretRedirect />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppLayout><Settings /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute requiredRole="system_admin">
                <AppLayout><Admin /></AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Redirect legacy paths */}
          <Route path="/analytics" element={<Navigate to="/my-posts" replace />} />
          <Route path="/audience" element={<Navigate to="/my-audience" replace />} />
          <Route path="/recommendations" element={<Navigate to="/content-plan" replace />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
