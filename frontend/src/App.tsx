import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Swords, TrendingUp, Target, MessageCircleQuestion } from 'lucide-react'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import Analytics from './pages/Analytics'
import Audience from './pages/Audience'
import Recommendations from './pages/Recommendations'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Admin from './pages/Admin'
import Onboarding from './pages/Onboarding'
import ComingSoon from './pages/ComingSoon'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public landing page */}
          <Route path="/" element={<Landing />} />

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
                  <ComingSoon titleKey="nav.myGoals" questionKey="comingSoon.myGoalsQ" icon={Target} />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/ask-basiret"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ComingSoon titleKey="nav.askBasiret" questionKey="comingSoon.askBasiretQ" icon={MessageCircleQuestion} />
                </AppLayout>
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
          <Route path="/sentiment" element={<Navigate to="/dashboard" replace />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
