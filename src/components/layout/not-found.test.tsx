import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { language } from '@/i18n'
import { appRoutes } from '@/router'
import { CrashPage } from './not-found'

// F2: adresë e panjohur = gjendje bosh brenda kornizës; gabim vizatimi = faqja "Diçka nuk shkoi".
describe('adresa e panjohur dhe gabimi i vizatimit', () => {
  afterEach(() => act(() => language.set('sq')))

  it('një adresë e panjohur tregon gjendjen bosh brenda kornizës dhe kthen te Sot', async () => {
    const user = userEvent.setup()
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/nuk-ekziston/aspak'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { level: 1, name: 'Kjo faqe nuk ekziston' })).toBeInTheDocument()
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kthehu te Sot' }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('në anglisht', async () => {
    language.set('en')
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/nowhere'] })
    render(<RouterProvider router={router} />)
    expect(await screen.findByRole('heading', { level: 1, name: 'This page does not exist' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Back to Today' })).toBeInTheDocument()
  })

  it('një gabim vizatimi tregon "Diçka nuk shkoi" me "Rifillo", jo faqen e React Router', () => {
    const Boom = () => {
      throw new Error('prishje prove')
    }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = createMemoryRouter([{ path: '/', element: <Boom />, errorElement: <CrashPage /> }])
    render(<RouterProvider router={router} />)
    expect(screen.getByRole('heading', { name: 'Diçka nuk shkoi' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Rifillo' })).toBeInTheDocument()
    expect(screen.queryByText(/Unexpected Application Error/)).not.toBeInTheDocument()
    act(() => language.set('en'))
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument()
    log.mockRestore()
  })

  it('rrënja e app-it ka errorElement', async () => {
    const { routes } = await import('@/router')
    expect(routes.every((route) => route.errorElement)).toBe(true)
  })
})
