// src/App.jsx
// The root of the React app. Sets up all routes and wraps everything
// in the AuthProvider so every page has access to the current user.
//
// React Router is like a URL dispatcher — it maps URL paths to components.
// Think of it like a Java servlet mapping or a Spring @RequestMapping,
// except it runs in the browser and swaps components without a page reload.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

// Pages — we'll create these one by one
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import StudentOnboarding from './pages/StudentOnboarding'
import AlumniOnboarding from './pages/AlumniOnboarding'
import StudentDashboard from './pages/StudentDashboard'
import AlumniDashboard from './pages/AlumniDashboard'
import Messages from './pages/Messages'
import MessagesInbox from './pages/MessagesInbox'
import StudentProfile from './pages/StudentProfile'
import AlumniProfile from './pages/AlumniProfile'
import StudentProfileView from './pages/StudentProfileView'
import AlumniProfileView from './pages/AlumniProfileView'
import Admin from './pages/Admin'
import StudentPeers from './pages/StudentPeers'
import PeerIntroduction from './pages/PeerIntroduction'

// ProtectedRoute wraps any page that requires login.
// If the user isn't logged in, it redirects to /login.
// Think of it like a Java @PreAuthorize annotation on a method.
function ProtectedRoute({ children, accountType }) {
  const { user, loading } = useAuth()

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (accountType && user.account_type !== accountType) {
    return <Navigate to="/" replace />
  }

  return children
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Student-only routes */}
      <Route path="/onboarding/student" element={
        <ProtectedRoute accountType="student">
          <StudentOnboarding />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/student" element={
        <ProtectedRoute accountType="student">
          <StudentDashboard />
        </ProtectedRoute>
      } />
      <Route path="/profile/view/student/:matchId" element={
        <ProtectedRoute accountType="alumni"><StudentProfileView /></ProtectedRoute>
      } />

      {/* Alumni-only routes */}
      <Route path="/onboarding/alumni" element={
        <ProtectedRoute accountType="alumni">
          <AlumniOnboarding />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/alumni" element={
        <ProtectedRoute accountType="alumni">
          <AlumniDashboard />
        </ProtectedRoute>
      } />
      <Route path="/profile/view/alumni/:matchId" element={
        <ProtectedRoute accountType="student"><AlumniProfileView /></ProtectedRoute>
      } />
      {/* Shared — both students and alumni can message */}
      <Route path="/messages" element={
        <ProtectedRoute>
          <MessagesInbox />
        </ProtectedRoute>
      } />
      <Route path="/messages/:matchId" element={
        <ProtectedRoute>
          <Messages />
        </ProtectedRoute>
      } />
      <Route path="/profile/student" element={
        <ProtectedRoute accountType="student"><StudentProfile /></ProtectedRoute>
      } />
      <Route path="/peers" element={
        <ProtectedRoute accountType="student"><StudentPeers /></ProtectedRoute>
      } />
      <Route path="/peers/introductions/:introId" element={
        <ProtectedRoute accountType="student"><PeerIntroduction /></ProtectedRoute>
      } />
      <Route path="/profile/alumni" element={
        <ProtectedRoute accountType="alumni"><AlumniProfile /></ProtectedRoute>
      } />

      <Route path="/admin" element={
        <AdminRoute><Admin /></AdminRoute>
      } />
      
      {/* Catch-all — redirect unknown URLs to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}