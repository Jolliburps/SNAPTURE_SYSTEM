import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './AuthContext'

export default function RequireAuth() {
  const { isSignedIn, loading } = useAuth()
  const location = useLocation()

  if (loading) return <div className="loading-state" role="status">Checking your CESD session…</div>
  if (!isSignedIn) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
