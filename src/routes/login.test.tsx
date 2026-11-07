import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
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

  it('ka një titull, dy fusha me etiketa dhe veprimin kryesor', () => {
    renderLogin()
    expect(screen.getByRole('heading', { level: 1, name: 'Training Hub' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Fjalëkalimi')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Hyr' })).toBeInTheDocument()
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

  it('fjalëkalimi mund të shfaqet dhe të fshihet', async () => {
    renderLogin()
    const password = screen.getByLabelText('Fjalëkalimi')
    await userEvent.click(screen.getByRole('button', { name: 'Shfaq fjalëkalimin' }))
    expect(password).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Fshih fjalëkalimin' }))
    expect(password).toHaveAttribute('type', 'password')
  })
})
