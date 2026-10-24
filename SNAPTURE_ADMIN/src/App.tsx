import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import AppShell from './components/AppShell'
import { lazy, Suspense } from 'react'
import ContentManager from './pages/ContentManager'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import AccountSetup from './pages/AccountSetup'
import NotFoundPage from './pages/NotFoundPage'
import LoginPage from './pages/LoginPage'
import AuthProvider from './auth/AuthProvider'
import RequireAuth from './auth/RequireAuth'

const Dashboard = lazy(() => import('./pages/Dashboard'))

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="login" element={<LoginPage />} />
    <Route path="account-setup" element={<AccountSetup />} />
    <Route element={<RequireAuth />}><Route element={<AppShell />}>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="dashboard" element={<Suspense fallback={<div className="loading-state" role="status">Loading Dashboard…</div>}><Dashboard /></Suspense>} />
    <Route path="policies" element={<ContentManager key="policies" resource="policies" />} />
    <Route path="materials" element={<ContentManager key="materials" resource="materials" />} />
    <Route path="announcements" element={<ContentManager key="announcements" resource="announcements" />} />
    <Route path="schedules" element={<ContentManager key="schedules" resource="schedules" />} />
    <Route path="reports" element={<Reports />} />
    <Route path="settings" element={<Settings />} />
    <Route path="users" element={<Navigate to="/settings" replace />} />
    <Route path="*" element={<NotFoundPage />} />
  </Route></Route></Routes></AuthProvider></BrowserRouter>
}
