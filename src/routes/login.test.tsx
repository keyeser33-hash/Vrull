import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { language } from '@/i18n/language'
import { LoginPage } from './login'

const auth = vi.hoisted(() => ({
  signIn: vi.fn(async (_email: string, _password: string) => ({ ok: true }) as { ok: true } | { ok: false; message: string }),
}))
vi.mock('@/data/app-data', () => ({ auth }))

function renderLogin() {
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

// Hyrja sipas bordit "Hyrja · Hyr" (V2-E1-17).
describe('hyrja', () => {
  let phone: string[]
  beforeEach(() => {
    auth.signIn.mockClear()
    window.localStorage.clear()
    phone = ['sq-AL']
    vi.spyOn(navigator, 'languages', 'get').mockImplementation(() => phone)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    language.set('sq')
  })

  it('ka logon me emrin Vrull, titullin, dy fusha me etiketa dhe veprimin kryesor', () => {
    renderLogin()
    expect(screen.getByRole('heading', { level: 1, name: 'Mirë se erdhe' })).toBeInTheDocument()
    expect(screen.getByText('Vrull')).toBeInTheDocument()
    expect(screen.getByText('Hyr me emailin dhe fjalëkalimin e llogarisë tënde.')).toBeInTheDocument()
    expect(screen.getByLabelText('Emaili')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Fjalëkalimi')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Hyr' })).toBeInTheDocument()
    expect(screen.getByText('Hyrja e parë kërkon internet. Pastaj Vrull punon edhe pa të.')).toBeInTheDocument()
    expect(screen.getByText('Llogaritë hapen vetëm me ftesë nga admini.')).toBeInTheDocument()
  })

  it('pa kod ftese deri te Etapa 4 dhe pa fjalë teknike', () => {
    renderLogin()
    expect(screen.queryByRole('button', { name: /kod ftese/i })).not.toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/supabase|training hub/i)
  })

  it('"Hyr" aktivizohet kur të dyja fushat kanë tekst', async () => {
    renderLogin()
    const submit = screen.getByRole('button', { name: 'Hyr' })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Emaili'), 'une@example.com')
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Fjalëkalimi'), 'x')
    expect(submit).toBeEnabled()
  })

  it('pa internet e thotë para se të provosh', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderLogin()
    expect(screen.getByText('Pa internet tani. Hyrja e parë kërkon internet; pastaj Vrull punon edhe pa të.')).toBeInTheDocument()
  })

  it('dërgon emailin dhe fjalëkalimin', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText('Emaili'), 'une@example.com')
    await userEvent.type(screen.getByLabelText('Fjalëkalimi'), 'sekret-i-gjate')
    await userEvent.click(screen.getByRole('button', { name: 'Hyr' }))
    expect(auth.signIn).toHaveBeenCalledWith('une@example.com', 'sekret-i-gjate')
  })

  it('tregon gabimin me fjalë dhe e lidh me fushat', async () => {
    auth.signIn.mockResolvedValueOnce({ ok: false, message: 'Emaili ose fjalëkalimi nuk është i saktë.' })
    renderLogin()
    await userEvent.type(screen.getByLabelText('Emaili'), 'une@example.com')
    await userEvent.type(screen.getByLabelText('Fjalëkalimi'), 'gabim{enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Emaili ose fjalëkalimi nuk është i saktë.')
    expect(screen.getByLabelText('Fjalëkalimi')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Fjalëkalimi')).toHaveAccessibleDescription('Emaili ose fjalëkalimi nuk është i saktë.')
    expect(screen.getByRole('button', { name: 'Hyr' })).toBeEnabled()
  })

  it('fjalëkalimi mund të shfaqet dhe të fshihet', async () => {
    renderLogin()
    const password = screen.getByLabelText('Fjalëkalimi')
    await userEvent.click(screen.getByRole('button', { name: 'Shfaq fjalëkalimin' }))
    expect(password).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Fshih fjalëkalimin' }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('në anglisht: titulli, fushat dhe veprimi', () => {
    language.set('en')
    renderLogin()
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    expect(screen.getByText('Accounts are opened only by invitation from the admin.')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Hyr|Fjalëkalimi|Mirë se erdhe/)
  })

  it('para se të ketë llogari, gjuha ndjek telefonin', () => {
    phone = ['en-GB', 'sq']
    renderLogin()
    expect(screen.getByRole('heading', { level: 1, name: 'Welcome' })).toBeInTheDocument()
    expect(language.get()).toBe('en')
  })

  it('gjuha e zgjedhur më parë fiton mbi atë të telefonit', () => {
    window.localStorage.setItem('th-language', 'sq')
    phone = ['en-GB']
    renderLogin()
    expect(screen.getByRole('heading', { level: 1, name: 'Mirë se erdhe' })).toBeInTheDocument()
  })
})
