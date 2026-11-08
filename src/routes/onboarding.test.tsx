import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { language } from '@/i18n/language'
import { OnboardingPage } from './onboarding'
import { BuildStartPage, ProgramEditorPage } from './program-editor'

// Një store i vërtetë (IndexedDB në memorie) me një përdorues të hyrë.
const data = vi.hoisted(() => ({ store: null as unknown }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  data.store = createLocalStore(createDatabase(`onboarding-${crypto.randomUUID()}`), {
    userId: () => '11111111-1111-4111-8111-111111111111',
  })
  return { store: data.store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(data.store as never) }
})

function renderOnboarding() {
  const router = createMemoryRouter(
    [
      {
        path: '/fillimi',
        element: <OnboardingPage />,
        // "Ndërto timin" (V2-E1-10): ndërtuesi brenda hapave, si te router.tsx.
        children: [
          { path: 'programi', element: <BuildStartPage /> },
          { path: 'programi/:programId', element: <ProgramEditorPage /> },
        ],
      },
      { path: '/', element: <h1>Sot</h1> },
    ],
    { initialEntries: ['/fillimi'] },
  )
  render(<RouterProvider router={router} />)
  return router
}

const progress = () => screen.getByRole('progressbar', { name: 'Hapat e parë' })

async function toDays(user: ReturnType<typeof userEvent.setup>, weight = '80') {
  await user.type(screen.getByLabelText('Pesha sot'), weight)
  await user.click(screen.getByRole('button', { name: 'Vazhdo' }))
  expect(screen.getByRole('heading', { level: 1, name: 'Ditët dhe oraret' })).toBeInTheDocument()
}

// Hapat e parë sipas bordeve "Gjuha dhe pesha", "Ditët dhe oraret" dhe "Programi" (V2-E1-17).
describe('hapat e parë', () => {
  afterEach(() => language.set('sq'))

  it('kalon katër hapat në tri ekrane, ruan profilin dhe nis te Java 0 · Stërvitja 1', async () => {
    const router = renderOnboarding()
    const user = userEvent.setup()

    expect(screen.getByText('Hapi 1 nga 4')).toBeInTheDocument()
    expect(progress()).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByRole('heading', { level: 1, name: 'Gjuha dhe pesha' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Shqip' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: 'Mbrapa' })).not.toBeInTheDocument()
    await toDays(user, '80,5')

    expect(screen.getByText('Hapat 2 dhe 3 nga 4')).toBeInTheDocument()
    expect(progress()).toHaveAttribute('aria-valuenow', '3')
    const days = screen.getByRole('group', { name: 'Ditët e stërvitjes' })
    expect(within(days).getAllByRole('button').map((day) => day.textContent)).toEqual(['H', 'M', 'M', 'E', 'P', 'Sh', 'D'])
    expect(screen.getByRole('button', { name: 'E hënë' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'E mërkurë' })).toHaveAttribute('aria-pressed', 'false')
    expect(days).toHaveAccessibleDescription(/^4 ditë në javë, sa stërvitjet e Shortcut to Size\./)
    expect(screen.getByRole('button', { name: 'Fillimi, 18:00' })).toHaveAccessibleDescription(
      'E njëjta për të 4 ditët. E ndryshon kur të duash te Cilësimet.',
    )
    expect(screen.getByRole('button', { name: 'Zgjimi, 07:00' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gjumi, 23:00' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Zgjidh programin' })).toBeInTheDocument()
    expect(screen.getByText('Hapi 4 nga 4')).toBeInTheDocument()
    expect(progress()).toHaveAttribute('aria-valuenow', '4')
    const programmes = screen.getByRole('radiogroup', { name: 'Programi' })
    expect(within(programmes).getAllByRole('radio')).toHaveLength(1)
    expect(within(programmes).getByRole('radio', { name: /Shortcut to Size/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText('12 javë + Java 0 · Jim Stoppani')).toBeInTheDocument()
    expect(screen.getByText('Java 0 për teknikën, pastaj 3 faza nga 4 javë, 4 stërvitje në javë.')).toBeInTheDocument()
    // "Ndërto timin" (E1-10) poshtë "Ose nis vetë"; programet e miqve (Etapa 4) dhe "Importo nga PDF"
    // (E1-11) nuk shfaqen ende.
    expect(screen.getByRole('heading', { level: 2, name: 'Ose nis vetë' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ndërto timin/ })).toHaveTextContent('Nga e para ose nga një shabllon')
    expect(screen.queryByText(/Importo nga PDF|Ndarë nga/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Fillo programin' }))
    // Ekrani pret derisa porta ta çojë te Sot (shih gate.test.tsx).
    expect(await screen.findByRole('button', { name: 'Po ruhet' })).toBeDisabled()
    expect(router.state.location.pathname).toBe('/fillimi')

    const { readProfile } = await import('@/data/profile')
    const { trainingSnapshot } = await import('@/data/training')
    const store = data.store as Parameters<typeof readProfile>[0]
    await vi.waitFor(async () => expect((await store.all('user_settings'))[0]?.onboarded_at).toBeTruthy())
    expect(await readProfile(store)).toEqual({
      weightKg: 80.5,
      trainingDays: [1, 2, 4, 5],
      trainingTime: '18:00',
      wakeTime: '07:00',
      sleepTime: '23:00',
    })
    expect(await trainingSnapshot(store)).toMatchObject({ label: 'Java 0', plan: { dayNumber: 1 } })
  })

  it('"Ndërto timin": ndërtuesi brenda hapave; "Ruaj programin" i mbyll me programin e ndërtuar', async () => {
    const router = renderOnboarding()
    const user = userEvent.setup()
    await toDays(user, '82')
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))
    await user.click(screen.getByRole('button', { name: /^Ndërto timin/ }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Ndërto programin tënd' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/fillimi/programi')
    await user.click(screen.getByRole('button', { name: /^Upper\/Lower 4 ditë/ }))
    const sheet = screen.getByRole('dialog', { name: 'Upper/Lower 4 ditë' })
    expect(sheet).toHaveAccessibleDescription('8 javë · 4 ditë · sipër dhe poshtë')
    await user.click(within(sheet).getByRole('button', { name: 'Ndërto nga shablloni' }))

    expect(await screen.findByLabelText('Emri i programit')).toHaveValue('Upper/Lower 4 ditë')
    expect(router.state.location.pathname).toMatch(/^\/fillimi\/programi\/[\w-]+$/)
    expect(screen.getByText('Nisur nga shablloni Upper/Lower 4 ditë')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Dita 1, Sipër A/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj programin' }))

    const store = data.store as import('@/data/store').LocalStore
    const active = async () => store.get('programs', String((await store.all('user_settings'))[0]?.active_program_id))
    await vi.waitFor(async () => expect(await active()).toMatchObject({ name: 'Upper/Lower 4 ditë', template: 'upper_lower_4', draft: false }))
    expect((await store.all('user_settings'))[0]?.onboarded_at).toBeTruthy()
    const { trainingSnapshot } = await import('@/data/training')
    expect(await trainingSnapshot(store)).toMatchObject({ programName: 'Upper/Lower 4 ditë', plan: { blockName: 'Bazat', week: 1, dayName: 'Sipër A' } })
  })

  it('gjuha ndryshon menjëherë tekstet e hapave dhe ruhet në telefon', async () => {
    renderOnboarding()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'English' }))
    // chooseLanguage shkruan rreshtin e cilësimeve para ndërrimit: tekstet vijnë pas leximit të bazës.
    expect(await screen.findByRole('heading', { level: 1, name: 'Language and weight' })).toBeInTheDocument()
    expect(language.get()).toBe('en')
    expect(window.localStorage.getItem('th-language')).toBe('en')
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true')
    await user.type(screen.getByLabelText('Weight today'), '80.5')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Days and times' })).toBeInTheDocument()
    expect(screen.getByText('Steps 2 and 3 of 4')).toBeInTheDocument()
    const days = screen.getByRole('group', { name: 'Training days' })
    expect(within(days).getAllByRole('button').map((day) => day.textContent)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S'])
    expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Start, 18:00' })).toHaveAccessibleDescription('The same for all 4 days. Change it any time in Settings.')
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(screen.getByRole('heading', { level: 1, name: 'Choose your programme' })).toBeInTheDocument()
    expect(screen.getByText('12 weeks + Week 0 · Jim Stoppani')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start the programme' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Vazhdo|Hapi|Zgjidh programin|stërvitje/)

    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Back' }))
    await user.click(screen.getByRole('button', { name: 'Shqip' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Gjuha dhe pesha' })).toBeInTheDocument()
    expect(screen.getByLabelText('Pesha sot')).toHaveValue('80,5')
  })

  it('pesha e pavlefshme ndal hapin dhe e thotë nën numër', async () => {
    renderOnboarding()
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Pesha sot'), '8')
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))
    expect(screen.getByLabelText('Pesha sot')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Pesha sot')).toHaveAccessibleDescription(/mes 30 dhe 300 kg/)
    expect(screen.getByText('Hapi 1 nga 4')).toBeInTheDocument()
  })

  it('pesha nuk vjen e mbushur: nis nga 80 kg me prekjen e parë dhe ndryshon me 0,5 kg', async () => {
    renderOnboarding()
    const user = userEvent.setup()
    const weight = screen.getByLabelText('Pesha sot')
    expect(weight).toHaveValue('')
    expect(weight).toHaveAttribute('placeholder', '80,0')
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))
    expect(weight).toHaveAttribute('aria-invalid', 'true')
    await user.click(screen.getByRole('button', { name: 'Rrit peshën me 0,5 kg' }))
    expect(weight).toHaveValue('80,0')
    expect(weight).not.toHaveAttribute('aria-invalid')
    await user.click(screen.getByRole('button', { name: 'Rrit peshën me 0,5 kg' }))
    await user.click(screen.getByRole('button', { name: 'Rrit peshën me 0,5 kg' }))
    await user.click(screen.getByRole('button', { name: 'Ul peshën me 0,5 kg' }))
    expect(weight).toHaveValue('80,5')
  })

  it('pa asnjë ditë stërvitjeje nuk vazhdon; "Mbrapa" kthen te hapi 1 me peshën', async () => {
    renderOnboarding()
    const user = userEvent.setup()
    await toDays(user)
    for (const day of ['E hënë', 'E martë', 'E enjte', 'E premte']) {
      await user.click(screen.getByRole('button', { name: day }))
    }
    await user.click(screen.getByRole('button', { name: 'Vazhdo' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Zgjidh të paktën një ditë stërvitjeje.')
    expect(screen.getByRole('heading', { level: 1, name: 'Ditët dhe oraret' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Mbrapa' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Gjuha dhe pesha' })).toBeInTheDocument()
    expect(screen.getByLabelText('Pesha sot')).toHaveValue('80,0')
  })

  it('ditët ndryshojnë fjalinë: më pak ose më shumë se stërvitjet e programit', async () => {
    renderOnboarding()
    const user = userEvent.setup()
    await toDays(user)
    const days = screen.getByRole('group', { name: 'Ditët e stërvitjes' })
    await user.click(screen.getByRole('button', { name: 'E premte' }))
    expect(days).toHaveAccessibleDescription(
      '3 ditë në javë për 4 stërvitje: stërvitjet ndjekin radhën, ndaj programi zgjat më shumë se 13 javë.',
    )
    expect(screen.getByRole('button', { name: 'Fillimi, 18:00' })).toHaveAccessibleDescription(/^E njëjta për të 3 ditët\./)
    await user.click(screen.getByRole('button', { name: 'E premte' }))
    await user.click(screen.getByRole('button', { name: 'E shtunë' }))
    expect(days).toHaveAccessibleDescription(
      '5 ditë në javë për 4 stërvitje: stërvitjet ndjekin radhën, ndaj programi mbaron para 13 javëve.',
    )
  })

  it('ora ndryshohet te fleta: 24 orë, me 15 minuta ose e shkruar, dhe ruhet me "Ruaj"', async () => {
    renderOnboarding()
    const user = userEvent.setup()
    await toDays(user)
    await user.click(screen.getByRole('button', { name: 'Fillimi, 18:00' }))
    const sheet = screen.getByRole('dialog', { name: 'Ora e stërvitjes' })
    const time = within(sheet).getByLabelText('Ora e stërvitjes')
    expect(time).toHaveValue('18:00')
    await user.click(within(sheet).getByRole('button', { name: 'Ora e stërvitjes 15 minuta më vonë' }))
    expect(time).toHaveValue('18:15')
    await user.clear(time)
    await user.type(time, '1930{enter}')
    expect(time).toHaveValue('19:30')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Fillimi, 19:30' })).toBeInTheDocument()

    // "Mbyll" nuk e ndryshon orën.
    await user.click(screen.getByRole('button', { name: 'Zgjimi, 07:00' }))
    const wake = screen.getByRole('dialog', { name: 'Zgjimi' })
    await user.click(within(wake).getByRole('button', { name: 'Zgjimi 15 minuta më herët' }))
    await user.click(within(wake).getByRole('button', { name: 'Mbyll' }))
    expect(screen.getByRole('button', { name: 'Zgjimi, 07:00' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Ditët dhe oraret' })).toBeInTheDocument()
  })
})
