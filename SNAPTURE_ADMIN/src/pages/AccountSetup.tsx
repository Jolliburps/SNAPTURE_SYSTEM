import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api, message } from '../lib/api'

export default function AccountSetup() {
  const [params] = useSearchParams()
  const uid = params.get('uid'), token = params.get('token')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('')
    const data = new FormData(event.currentTarget)
    if (uid && token && data.get('password') !== data.get('confirm')) { setError('Passwords do not match.'); setBusy(false); return }
    try {
      const result = await api<{ detail: string }>(uid && token ? 'password/confirm/' : 'password/request/', { method: 'POST', body: JSON.stringify(uid && token ? { uid, token, password: data.get('password') } : { email: data.get('email') }) })
      setNotice(result.detail); if (uid && token) setComplete(true)
    } catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  return <main className="login-page"><section className="panel setup-panel"><img src="/snapture.svg" alt="" width="44" height="44" /><h1>{uid && token ? 'Set your password' : 'Password assistance'}</h1><p className="muted">Use your individual CESD account.</p>
    <form className="record-form" onSubmit={submit}>
      {!complete && (uid && token ? <><label>New password<input name="password" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label><label>Confirm password<input name="confirm" type="password" minLength={8} maxLength={128} autoComplete="new-password" required /></label></> : <label>Email address<input name="email" type="email" autoComplete="email" required /></label>)}
      {error && <p className="notice notice--error" role="alert">{error}</p>}{notice && <p className="notice" role="status">{notice}</p>}
      {!complete && <button className="primary-button" disabled={busy}>{busy ? 'Please wait…' : uid && token ? 'Save password' : 'Request instructions'}</button>}
      <Link to="/login" className="text-link">Back to sign in</Link>
    </form></section></main>
}
