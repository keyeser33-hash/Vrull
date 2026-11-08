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

describe('hyrja', () => {
  beforeEach(() => auth.signIn.mockClear())
  afterEach(() => language.set('sq'))

  it('ka një titull, dy fusha me etiketa dhe veprimin kryesor', () => {
    renderLogin()
    expect(screen.getByRole('heading', { level: 1, name: 'Hyr' })).toBeInTheDocument()
    expect(screen.getByText('Training Hub')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Fjalëkalimi')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Hyr' })).toBeInTheDocument()
  })

  it('pa fjalë teknike: asnjë përmendje e Supabase', () => {
    renderLogin()
    expect(document.body.textContent).not.toMatch(/supabase/i)
  })

  it('"Hyr" aktivizohet kur të dyja fushat kanë tekst', async () => {
    renderLogin()
    const submit = screen.getByRole('button', { name: 'Hyr' })
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Email'), 'une@example.com')
    expect(submit).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Fjalëkalimi'), 'x')
    expect(submit).toBeEnabled()
  })

  it('pa internet e thotë para se të provosh', () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
    renderLogin()
    expect(screen.getByText('Pa internet. Hyrja kërkon internet vetëm herën e parë.')).toBeInTheDocument()
    online.mockRestore()
  })

  it('dërgon email-in dhe fjalëkalimin', async () => {
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'une@example.com')
    await userEvent.type(screen.getByLabelText('Fjalëkalimi'), 'sekret-i-gjate')
    await userEvent.click(screen.getByRole('button', { name: 'Hyr' }))
    expect(auth.signIn).toHaveBeenCalledWith('une@example.com', 'sekret-i-gjate')
  })

  it('tregon gabimin me fjalë dhe e lidh me fushat', async () => {
    auth.signIn.mockResolvedValueOnce({ ok: false, message: 'Email-i ose fjalëkalimi nuk është i saktë.' })
    renderLogin()
    await userEvent.type(screen.getByLabelText('Email'), 'une@example.com')
    await userEvent.type(screen.getByLabelText('Fjalëkalimi'), 'gabim{enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('Email-i ose fjalëkalimi nuk është i saktë.')
    expect(screen.getByRole('button', { name: 'Hyr' })).toBeEnabled()
  })

  it('në anglisht: titulli, fushat, veprimi dhe figura', () => {
    language.set('en')
    renderLogin()
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Show password' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled()
    expect(screen.getByText('Front')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Hyr|Fjalëkalimi|Përpara/)
  })

  it('fjalëkalimi mund të shfaqet dhe të fshihet', async () => {
    renderLogin()
    const password = screen.getByLabelText('Fjalëkalimi')
    await userEvent.click(screen.getByRole('button', { name: 'Shfaq fjalëkalimin' }))
    expect(password).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Fshih fjalëkalimin' }))
    expect(password).toHaveAttribute('type', 'password')
  })
})
