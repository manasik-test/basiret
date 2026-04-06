import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Admin from './pages/Admin'
import Onboarding from './pages/Onboarding'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
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
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout><Dashboard /></AppLayout>
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

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
