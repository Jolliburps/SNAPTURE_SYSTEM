import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api, ApiError } from '../lib/api'
import type { StaffUser } from '../lib/api'
import { AuthContext } from './AuthContext'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null)
  const [loading, setLoading] = useState(true)
  const refresh = useCallback(async () => {
    try { setUser((await api<{ user: StaffUser }>('me/')).user) }
    catch (error) { if (error instanceof ApiError && [401, 403].includes(error.status)) setUser(null) }
    finally { setLoading(false) }
  }, [])
  useEffect(() => {
    void Promise.resolve().then(refresh)
    const ended = () => setUser(null)
    window.addEventListener('cesd-session-ended', ended)
    window.addEventListener('focus', refresh)
    const timer = window.setInterval(refresh, 30000)
    return () => { window.removeEventListener('cesd-session-ended', ended); window.removeEventListener('focus', refresh); clearInterval(timer) }
  }, [refresh])
  async function signIn(email: string, password: string) {
    setUser((await api<{ user: StaffUser }>('login/', { method: 'POST', body: JSON.stringify({ email, password }) })).user)
  }
  async function signOut() {
    await api('logout/', { method: 'POST' })
    setUser(null)
  }
  return <AuthContext.Provider value={{ isSignedIn: !!user, loading, user, signIn, signOut, refresh }}>{children}</AuthContext.Provider>
}
