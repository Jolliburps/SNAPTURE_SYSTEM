import { createContext, useContext } from 'react'
import type { StaffUser } from '../lib/api'

interface AuthContextValue {
  isSignedIn: boolean
  loading: boolean
  user: StaffUser | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const auth = useContext(AuthContext)
  if (!auth) throw new Error('useAuth must be used inside AuthProvider')
  return auth
}
