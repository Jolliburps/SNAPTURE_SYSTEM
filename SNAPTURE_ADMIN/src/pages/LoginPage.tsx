import { useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowRight, Eye, EyeOff, Leaf, LockKeyhole, Mail, Recycle } from 'lucide-react'
import { Link, Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/AuthContext'
import { navigation } from '../config/navigation'
import { message } from '../lib/api'

export default function LoginPage() {
  const { isSignedIn, loading, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const requestedPath = location.state?.from
  // Restrict the return destination to an existing dashboard route.
  const destination = navigation.some((item) => item.path === requestedPath) ? requestedPath : '/dashboard'

  if (loading) return <div className="loading-state" role="status">Checking your CESD session…</div>
  if (isSignedIn) return <Navigate to={destination} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError('')
    try { await signIn(email.trim(), password) }
    catch (error) { setError(message(error)); setPassword('') }
    finally { setBusy(false) }
  }

  return <main className="login-page">
    <div className="login-layout">
      <section className="login-brand-panel" aria-label="SNAPTURE waste management">
        <div className="brand login-brand">
          <img src="/snapture.svg" width="44" height="44" alt="" />
          <span className="brand-copy"><strong>SNAPTURE</strong><span>Admin Panel</span></span>
        </div>
        <div className="login-brand-message">
          <span className="login-leaf-mark" aria-hidden="true"><Leaf size={48} strokeWidth={1.3} /></span>
          <span className="login-eyebrow">WASTE MANAGEMENT ADMINISTRATION</span>
          <h1>A cleaner community.<br />A better tomorrow.</h1>
          <p>Manage information, share knowledge, and coordinate waste collection for the communities of Bacoor.</p>
          <div className="login-community"><Recycle size={19} aria-hidden="true" /><span>Working together for a greener Bacoor</span></div>
        </div>
        <div className="login-brand-footer">City Environment and Sanitation Department · Bacoor</div>
      </section>
      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form-content">
          <span className="login-lock-icon" aria-hidden="true"><LockKeyhole size={25} /></span>
          <h2 id="login-title">Welcome back</h2>
          <p className="login-subtitle">Sign in to access the SNAPTURE Admin Panel.</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="admin-email">Email address <span aria-hidden="true">*</span></label>
              <div className="login-input-wrap"><Mail size={18} aria-hidden="true" /><input id="admin-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Enter your email address" required value={email} onChange={(event) => { setEmail(event.target.value); setError('') }} aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} /></div>
            </div>
            <div className="login-field">
              <label htmlFor="admin-password">Password <span aria-hidden="true">*</span></label>
              <div className="login-input-wrap"><LockKeyhole size={18} aria-hidden="true" /><input id="admin-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" required value={password} onChange={(event) => { setPassword(event.target.value); setError('') }} aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} /><button className="login-password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            </div>
            {error && <p className="login-error" id="login-error" role="alert">{error}</p>}
            <button className="primary-button login-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<ArrowRight size={17} aria-hidden="true" /></button>
          </form>
          <p className="login-preview-note"><Link className="text-link" to="/account-setup">Set up or reset your password</Link></p>
          <p className="login-preview-note">For authorized CESD personnel. Contact the account owner for access.</p>
        </div>
        <p className="login-form-footer">SNAPTURE · Admin access</p>
      </section>
    </div>
  </main>
}
