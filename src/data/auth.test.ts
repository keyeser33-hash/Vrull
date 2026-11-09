import { i18nFor } from '@/i18n'
import { createAuth, signInErrorMessage } from './auth'

type Listener = (event: string, session: { user: { id: string; email?: string } } | null) => void

function fakeClient(initial: { user: { id: string; email?: string; app_metadata?: Record<string, unknown> } } | null = null) {
  let listener: Listener = () => {}
  const client = {
    getSession: vi.fn(async () => ({ data: { session: initial } })),
    onAuthStateChange: vi.fn((callback: Listener) => {
      listener = callback
      return { data: { subscription: { unsubscribe: () => {} } } }
    }),
    signInWithPassword: vi.fn(async ({ email }: { email: string; password: string }) => {
      if (email === 'gabim@example.com') {
        return { data: { session: null, user: null }, error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' } }
      }
      const session = { user: { id: 'user-1', email } }
      listener('SIGNED_IN', session)
      return { data: { session, user: session.user }, error: null }
    }),
    signOut: vi.fn(async () => {
      listener('SIGNED_OUT', null)
      return { error: null }
    }),
  }
  return client
}

describe('hyrja në llogari', () => {
  it('lexon sesionin e ruajtur në telefon, pa rrjet', async () => {
    const auth = createAuth(fakeClient({ user: { id: 'user-1', email: 'une@example.com' } }))
    expect(auth.getState().status).toBe('loading')
    await auth.start()
    expect(auth.getState()).toEqual({ status: 'signed_in', userId: 'user-1', email: 'une@example.com', admin: false })
  })

  it('pa sesion: jashtë llogarisë', async () => {
    const auth = createAuth(fakeClient())
    await auth.start()
    expect(auth.getState()).toEqual({ status: 'signed_out', userId: null, email: null, admin: false })
  })

  it('hyrja e suksesshme njofton dëgjuesit', async () => {
    const auth = createAuth(fakeClient())
    await auth.start()
    const seen: string[] = []
    auth.subscribe(() => seen.push(auth.getState().status))
    expect(await auth.signIn(' une@example.com ', 'fjalekalim')).toEqual({ ok: true })
    expect(auth.getState()).toMatchObject({ status: 'signed_in', userId: 'user-1', email: 'une@example.com' })
    expect(seen).toEqual(['signed_in'])
  })

  it('kontrollon fushat para se të thërrasë serverin', async () => {
    const client = fakeClient()
    const auth = createAuth(client)
    expect(await auth.signIn('', 'x')).toEqual({ ok: false, message: 'Shkruaj emailin.' })
    expect(await auth.signIn('une@example.com', '')).toEqual({ ok: false, message: 'Shkruaj fjalëkalimin.' })
    expect(client.signInWithPassword).not.toHaveBeenCalled()
  })

  it('fjalëkalimi i gabuar kthehet si mesazh në shqip', async () => {
    const auth = createAuth(fakeClient())
    await auth.start()
    expect(await auth.signIn('gabim@example.com', 'x')).toEqual({
      ok: false,
      message: 'Emaili ose fjalëkalimi nuk është i saktë.',
    })
    expect(auth.getState().status).toBe('signed_out')
  })

  it('dalja punon edhe pa internet (vetëm në telefon)', async () => {
    const client = fakeClient({ user: { id: 'user-1' } })
    const auth = createAuth(client)
    await auth.start()
    await auth.signOut()
    expect(client.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(auth.getState().status).toBe('signed_out')
  })
})

describe('mesazhet e gabimeve të hyrjes', () => {
  it.each([
    [{ code: 'invalid_credentials', status: 400 }, 'Emaili ose fjalëkalimi nuk është i saktë.'],
    [{ message: 'Invalid login credentials', status: 400 }, 'Emaili ose fjalëkalimi nuk është i saktë.'],
    [{ code: 'email_not_confirmed', status: 400 }, 'Llogaria nuk është konfirmuar ende.'],
    [{ code: 'over_request_rate_limit', status: 429 }, 'Shumë përpjekje radhazi. Prit pak minuta dhe provo përsëri.'],
    [{ name: 'AuthRetryableFetchError', status: 0 }, 'Hyrja kërkon internet. Lidhu dhe provo përsëri.'],
    [{ status: 503 }, 'Serveri nuk po përgjigjet. Provo përsëri pas pak.'],
    [{ status: 418 }, 'Hyrja nuk u krye. Provo përsëri.'],
  ])('%o', (error, message) => {
    expect(signInErrorMessage(error)).toBe(message)
  })

  it('në anglisht', () => {
    expect(signInErrorMessage({ code: 'invalid_credentials', status: 400 }, i18nFor('en'))).toBe('The email or password is not correct.')
    expect(signInErrorMessage({ status: 0 }, i18nFor('en'))).toBe('Signing in needs the internet. Connect and try again.')
  })

  it('admini vjen nga app_metadata e sesionit (V42)', async () => {
    const auth = createAuth(fakeClient({ user: { id: 'user-1', email: 'une@example.com', app_metadata: { vrull_admin: true } } }))
    await auth.start()
    expect(auth.getState()).toMatchObject({ status: 'signed_in', admin: true })
  })
})
