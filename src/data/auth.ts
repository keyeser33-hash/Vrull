// Hyrja në llogari (SPEC §3, §3a). Llogaria e vetme krijohet te paneli i Supabase dhe
// regjistrimet janë të mbyllura, ndaj app-i ka vetëm hyrjen. Sesioni ruhet në telefon:
// pas hyrjes së parë app-i hapet pa internet.

import { currentI18n, type I18n } from '@/i18n'

export type AuthStatus = 'loading' | 'signed_out' | 'signed_in'

export interface AuthState {
  status: AuthStatus
  userId: string | null
  email: string | null
}

interface SessionLike {
  user: { id: string; email?: string | null }
}

interface AuthErrorLike {
  code?: string
  status?: number
  name?: string
  message?: string
}

/** Pjesa e `supabase.auth` që përdor app-i. */
export interface AuthClient {
  getSession(): Promise<{ data: { session: SessionLike | null } }>
  onAuthStateChange(callback: (event: string, session: SessionLike | null) => void): unknown
  signInWithPassword(credentials: { email: string; password: string }): Promise<{ error: AuthErrorLike | null }>
  signOut(options: { scope: 'local' }): Promise<{ error: AuthErrorLike | null }>
}

export type SignInResult = { ok: true } | { ok: false; message: string }

/** Gabimi i hyrjes me fjalë, në gjuhën e tanishme të app-it. */
export function signInErrorMessage(error: AuthErrorLike, { t }: I18n = currentI18n()): string {
  if (error.code === 'invalid_credentials' || /invalid login credentials/i.test(error.message ?? '')) {
    return t('auth.wrongCredentials')
  }
  if (error.code === 'email_not_confirmed') return t('auth.notConfirmed')
  if (error.status === 429 || error.code === 'over_request_rate_limit') return t('auth.tooManyAttempts')
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return t('auth.offline')
  if ((error.status ?? 0) >= 500) return t('auth.serverDown')
  return t('auth.failed')
}

const toState = (session: SessionLike | null): AuthState =>
  session
    ? { status: 'signed_in', userId: session.user.id, email: session.user.email ?? null }
    : { status: 'signed_out', userId: null, email: null }

export function createAuth(client: AuthClient) {
  let state: AuthState = { status: 'loading', userId: null, email: null }
  const listeners = new Set<() => void>()

  function setState(next: AuthState) {
    if (next.status === state.status && next.userId === state.userId && next.email === state.email) return
    state = next
    listeners.forEach((listener) => listener())
  }

  return {
    /** Lexon sesionin e ruajtur (pa rrjet) dhe ndjek ndryshimet e tij. */
    async start() {
      const { data } = await client.getSession()
      setState(toState(data.session))
      client.onAuthStateChange((_event, session) => setState(toState(session)))
    },

    async signIn(email: string, password: string): Promise<SignInResult> {
      const trimmed = email.trim()
      if (!trimmed) return { ok: false, message: currentI18n().t('auth.emailMissing') }
      if (!password) return { ok: false, message: currentI18n().t('auth.passwordMissing') }
      try {
        const { error } = await client.signInWithPassword({ email: trimmed, password })
        if (error) return { ok: false, message: signInErrorMessage(error) }
        return { ok: true }
      } catch (error) {
        return { ok: false, message: signInErrorMessage({ name: (error as Error)?.name, status: 0 }) }
      }
    },

    /** Del vetëm në këtë telefon, edhe pa internet. Të dhënat lokale mbeten. */
    async signOut() {
      await client.signOut({ scope: 'local' })
      setState(toState(null))
    },

    getState: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}

export type Auth = ReturnType<typeof createAuth>
