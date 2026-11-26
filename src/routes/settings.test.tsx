import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import pkg from '../../package.json'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n/language'
import { background } from '@/lib/background'
import type { Release, UpdateState } from '@/update/updater'

// Cilësimet (bordi "Cilësimet", V2-E1-05): Profili, Pamja, Njoftimet, Sinkronizimi, Versioni, "Dil".
// Store i vërtetë me një përdorues; llogaria, sinkronizimi dhe përditësimi të imituara.
const data = vi.hoisted(() => ({
  admin: false,
  store: null as unknown as LocalStore,
  signOut: vi.fn(async () => undefined),
  syncNow: vi.fn(async () => undefined),
  check: vi.fn(async () => undefined),
  update: { status: 'idle' } as UpdateState,
  sync: { syncing: false } as { syncing: boolean; last?: unknown },
}))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`settings-${crypto.randomUUID()}`), {
    userId: () => '11111111-1111-4111-8111-111111111111',
  })
  data.store = store
  return {
    store,
    auth: { signOut: data.signOut },
    useAuth: () => ({ status: 'signed_in', userId: '11111111-1111-4111-8111-111111111111', email: null, admin: data.admin }),
    scheduler: { syncNow: data.syncNow },
    useSyncStatus: () => data.sync,
    usePendingChanges: () => 0,
    planRemindersNow: async () => {},
    updatesSupported: () => true,
    useAppUpdate: () => data.update,
    updater: { check: data.check, update: vi.fn(), allowInstall: vi.fn() },
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

const share = vi.hoisted(() => ({ shareExport: vi.fn(async () => true) }))
vi.mock('@/data/share-export', () => share)

const release: Release = {
  version: '0.30.0',
  apk: 'TrainingHub-0.30.0.apk',
  sha256: 'a'.repeat(64),
  bytes: 12_582_912,
  notes: ['Ushqimi me AI'],
  publishedAt: '2026-12-01T10:00:00Z',
}

async function renderSettings() {
  const { SettingsPage } = await import('./settings')
  const router = createMemoryRouter(
    [
      { path: '/', element: <h1>Sot</h1> },
      { path: '/cilesimet', element: <SettingsPage /> },
      { path: '/cilesimet/pamja', element: <h1>Pamja</h1> },
      { path: '/cilesimet/rikujtuesit', element: <h1>Rikujtuesit</h1> },
    ],
    { initialEntries: ['/', '/cilesimet'], initialIndex: 1 },
  )
  render(<RouterProvider router={router} />)
  await screen.findByRole('button', { name: /^Oraret/ })
  return router
}

const row = (name: RegExp) => screen.getByRole('button', { name })
const group = (name: string) => screen.getByRole('region', { name })

describe('cilësimet', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80.5, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })
  beforeEach(() => {
    window.localStorage.clear()
    document.documentElement.className = 'dark oled'
    data.signOut.mockClear()
    data.update = { status: 'idle' }
    data.sync = { syncing: false }
  })
  afterEach(() => {
    act(() => language.set('sq'))
    act(() => background.set('solid'))
  })

  it('seksionet e bordit me vlerat e tanishme; ato të etapave të tjera mungojnë', async () => {
    await renderSettings()
    expect(screen.getByRole('heading', { level: 1, name: 'Cilësimet' })).toBeInTheDocument()
    // AI (V2-E1-11): përdorimi i muajit, që hap Cilësimet › AI.
    expect(await screen.findByRole('link', { name: 'Përdorimi këtë muaj, 0,00\u00a0€ nga 10\u00a0€' })).toHaveAttribute('href', '/cilesimet/ai')
    expect(await screen.findByRole('switch', { name: /^A e dije\?/ })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Profili', 'Pamja', 'Mëso', 'Njoftimet', 'AI', 'Sinkronizimi', 'Versioni'])
    expect(row(/^Pesha sot/)).toHaveTextContent('80,5 kg')
    expect(row(/^Ditët e stërvitjes/)).toHaveTextContent('Hën, Mar, Enj, Pre')
    expect(row(/^Oraret/)).toHaveTextContent('18:00 · zgjimi 07:00 · gjumi 23:00')
    const appearance = group('Pamja')
    expect(within(appearance).getByRole('link', { name: 'Tema, OLED' })).toHaveAttribute('href', '/cilesimet/pamja')
    expect(within(appearance).getByRole('link', { name: 'Sfondi, I plotë' })).toHaveAttribute('href', '/cilesimet/pamja')
    expect(within(appearance).getByRole('link', { name: 'Gjuha, Shqip' })).toHaveAttribute('href', '/cilesimet/pamja')
    expect(within(group('Njoftimet')).getByRole('link', { name: /^Rikujtuesit/ })).toHaveTextContent('Stërvitja, vaktet, suplementet, uji, matjet')
    for (const later of ['Admini', 'Ora dhe Health Connect']) expect(screen.queryByRole('region', { name: later })).toBeNull()
  })

  it('admini (V42) sheh "Kufiri i AI-së" te grupi Admini', async () => {
    data.admin = true
    try {
      await renderSettings()
      expect(within(group('Admini')).getByRole('link', { name: 'Kufiri i AI-së, Kostoja dhe kufiri për çdo person' })).toHaveAttribute('href', '/cilesimet/admin')
    } finally {
      data.admin = false
    }
  })

  it('mbrapa kthehet aty nga erdhi përdoruesi', async () => {
    const user = userEvent.setup()
    const router = await renderSettings()
    await user.click(screen.getByRole('button', { name: 'Mbrapa' }))
    expect(router.state.location.pathname).toBe('/')
  })

  it('"Dil" në fund pyet një herë dhe del vetëm pas konfirmimit', async () => {
    const user = userEvent.setup()
    await renderSettings()
    expect(screen.getByText('Dalja nuk fshin të dhënat në telefon.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Dil' }))
    const sheet = screen.getByRole('dialog', { name: 'Dil nga llogaria' })
    expect(sheet).toHaveTextContent('Të dhënat mbeten në telefon')
    expect(data.signOut).not.toHaveBeenCalled()
    await user.click(within(sheet).getByRole('button', { name: 'Dil nga llogaria' }))
    expect(data.signOut).toHaveBeenCalledOnce()
  })

  it('oraret ndryshohen në një fletë me − dhe + dhe ruhen me "Ruaj"', async () => {
    const { readProfile } = await import('@/data/profile')
    const user = userEvent.setup()
    await renderSettings()
    await user.click(row(/^Oraret/))
    const sheet = screen.getByRole('dialog', { name: 'Oraret' })
    await user.click(within(sheet).getByRole('button', { name: 'Ora e stërvitjes 15 minuta më vonë' }))
    await user.click(within(sheet).getByRole('button', { name: 'Zgjimi 15 minuta më herët' }))
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    await vi.waitFor(async () => expect(await readProfile(data.store)).toMatchObject({ trainingTime: '18:15', wakeTime: '06:45', sleepTime: '23:00' }))
    expect(await screen.findByRole('button', { name: /^Oraret, 18:15 · zgjimi 06:45/ })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('pesha ruhet si matja e sotme; një peshë e pavlefshme nuk ruhet dhe e thotë', async () => {
    const { readProfile } = await import('@/data/profile')
    const user = userEvent.setup()
    await renderSettings()
    await user.click(row(/^Pesha sot/))
    const sheet = screen.getByRole('dialog', { name: 'Pesha sot' })
    const input = within(sheet).getByLabelText('Pesha')
    await user.clear(input)
    await user.type(input, '3{enter}')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Shkruaj një peshë mes 30 dhe 300 kg, p.sh. 80,5.')
    await user.clear(input)
    await user.type(input, '79,8{enter}')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    await vi.waitFor(async () => expect((await readProfile(data.store)).weightKg).toBe(79.8))
  })

  it('ditët: pa asnjë ditë nuk ruhet; me një ditë më shumë ruhet', async () => {
    const { readProfile } = await import('@/data/profile')
    const user = userEvent.setup()
    await renderSettings()
    await user.click(row(/^Ditët e stërvitjes/))
    const sheet = screen.getByRole('dialog', { name: 'Ditët e stërvitjes' })
    for (const day of ['E hënë', 'E martë', 'E enjte', 'E premte']) await user.click(within(sheet).getByRole('button', { name: day }))
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Zgjidh të paktën një ditë stërvitjeje.')
    for (const day of ['E hënë', 'E martë', 'E enjte', 'E premte', 'E shtunë']) await user.click(within(sheet).getByRole('button', { name: day }))
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj' }))
    await vi.waitFor(async () => expect((await readProfile(data.store)).trainingDays).toEqual([1, 2, 4, 5, 6]))
  })

  it('sinkronizimi: gjendja me fjalë dhe "Sinkronizo tani"; eksporti, i dështuar thuhet me fjalë', async () => {
    const user = userEvent.setup()
    data.sync = { syncing: false, last: { status: 'ok', at: new Date(Date.now() - 2 * 60_000).toISOString(), pushed: 0, pulled: 0, rejected: 0 } }
    await renderSettings()
    const sync = group('Sinkronizimi')
    expect(within(sync).getByRole('status')).toHaveTextContent('I sinkronizuarpara 2 min')
    await user.click(within(sync).getByRole('button', { name: 'Sinkronizo tani' }))
    expect(data.syncNow).toHaveBeenCalled()
    await user.click(within(sync).getByRole('button', { name: 'Eksporto të dhënat' }))
    expect(share.shareExport).toHaveBeenCalledOnce()
    share.shareExport.mockRejectedValueOnce(new Error('disk'))
    await user.click(await within(sync).findByRole('button', { name: 'Eksporto të dhënat' }))
    expect(await within(sync).findByRole('alert')).toHaveTextContent('Eksporti nuk u krye. Provo përsëri.')
  })

  it('burimet dhe licencat: modeli 3D, ushtrimet, ushqimet dhe shkronjat me atribuimin e tyre', async () => {
    const user = userEvent.setup()
    await renderSettings()
    await user.click(row(/^Burimet dhe licencat/))
    const sheet = screen.getByRole('dialog', { name: 'Burimet dhe licencat' })
    expect(sheet).toHaveTextContent('BodyParts3D, (c) The Database Center for Life Science')
    expect(sheet).toHaveTextContent('CC BY-SA 2.1 Japan')
    expect(sheet).toHaveTextContent('free-exercise-db')
    expect(sheet).toHaveTextContent('Open Database License')
    expect(sheet).toHaveTextContent('USDA FoodData Central')
    expect(sheet).toHaveTextContent('Barlow, Barlow Condensed')
  })

  it('burimet: Lista e Vrullit me versionin, numrin e rreshtave, atribuimin e secilit burim dhe lidhjet te burimi e licenca', async () => {
    const user = userEvent.setup()
    await renderSettings()
    await user.click(row(/^Burimet dhe licencat/))
    const sheet = screen.getByRole('dialog', { name: 'Burimet dhe licencat' })
    const list = within(sheet).getByRole('region', { name: 'Lista e Vrullit' })
    expect(list).toHaveTextContent(/Versioni 1 · 21\D298 ushqime/)
    expect(list).toHaveTextContent('Karbohidratet tregohen pa fibrat')
    expect(list).toHaveTextContent('Emrat shqip janë përkthime nga anglishtja')
    const items = within(list).getAllByRole('listitem')
    expect(items.map((item) => item.querySelector('span')?.textContent)).toEqual(['USDA FoodData Central', 'ANSES Ciqual', 'McCance and Widdowson’s CoFID', 'Livsmedelsverket', 'Open Food Facts', 'Pjatat shqiptare'])
    // Çdo burim: licenca, atribuimi që e kërkon, versionet dhe numri; lidhjet hapen jashtë.
    expect(items[0]).toHaveTextContent('CC0 1.0')
    expect(items[0]).toHaveTextContent('FoodData Central, 2019. fdc.nal.usda.gov.')
    expect(items[0]).toHaveTextContent(/13\D199 ushqime · Versioni 2026-04-30 · Versioni 2018-04 · Versioni 2024-10-31/)
    expect(items[1]).toHaveTextContent('etalab 2.0')
    expect(items[1]).toHaveTextContent('Anses, Table de composition nutritionnelle des aliments Ciqual 2025')
    expect(items[2]).toHaveTextContent('Contains public sector information licensed under the Open Government Licence v3.0')
    expect(items[2]).toHaveTextContent('(c) Crown copyright')
    expect(items[3]).toHaveTextContent('CC BY 4.0')
    expect(items[3]).toHaveTextContent('The Swedish Food Agency (Livsmedelsverket)')
    expect(items[4]).toHaveTextContent('Contains data from Open Food Facts, available under the Open Database License')
    expect(items[4]).toHaveTextContent('ODbL')
    // Pjatat shqiptare (V65): receta nga burimet e shënuara te çdo pjatë; pa lidhje këtu (lidhjet janë te faqja e pjatës).
    expect(items[5]).toHaveTextContent('Pjatat shqiptare: receta nga burimet e shënuara te çdo pjatë.')
    expect(items[5]).toHaveTextContent('30 ushqime')
    expect(within(items[5]).queryAllByRole('link')).toHaveLength(0)
    const links = items.slice(0, 5).map((item) => within(item).getAllByRole('link').map((anchor) => [anchor.textContent, anchor.getAttribute('href'), anchor.getAttribute('target'), anchor.getAttribute('rel')]))
    expect(links[0]).toEqual([['Burimi', 'https://fdc.nal.usda.gov/', '_blank', 'noreferrer'], ['Licenca', 'https://creativecommons.org/publicdomain/zero/1.0/', '_blank', 'noreferrer']])
    expect(links[3][1][1]).toBe('https://creativecommons.org/licenses/by/4.0/')
    expect(links[4][1][1]).toBe('https://opendatacommons.org/licenses/odbl/1-0/')
    expect(links[2][1][1]).toBe('https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/')
    expect(links[1][1][1]).toBe('https://spdx.org/licenses/etalab-2.0.html')
  })

  it('burimet në anglisht: titujt dhe përshkrimet në anglisht, atribuimet e licencave të njëjta', async () => {
    const user = userEvent.setup()
    await renderSettings()
    act(() => language.set('en'))
    await user.click(await screen.findByRole('button', { name: /^Sources and licences/ }))
    const sheet = screen.getByRole('dialog', { name: 'Sources and licences' })
    const list = within(sheet).getByRole('region', { name: 'The Vrull food list' })
    expect(list).toHaveTextContent(/Version 1 · 21,298 foods/)
    expect(list).toHaveTextContent('Albanian names are translations from English')
    expect(list).toHaveTextContent('Contains data from Open Food Facts, available under the Open Database License')
    expect(within(list).getAllByRole('link', { name: 'Licence' })).toHaveLength(5)
    expect(list).toHaveTextContent('Albanian dishes: recipes from the sources named on each dish.')
  })

  it('versioni: "Vrull" me versionin nga package.json dhe "Kontrollo tani"', async () => {
    const user = userEvent.setup()
    data.update = { status: 'current' }
    await renderSettings()
    const version = group('Versioni')
    expect(version).toHaveTextContent(`Vrull ${pkg.version}`)
    expect(version).toHaveTextContent('I fundit')
    await user.click(within(version).getByRole('button', { name: 'Kontrollo tani' }))
    expect(data.check).toHaveBeenCalledWith({ force: true })
  })

  it('versioni: kur ka version të ri, rreshti e thotë dhe hap fletën e përditësimit', async () => {
    const user = userEvent.setup()
    data.update = { status: 'available', release }
    const router = await renderSettings()
    await user.click(within(group('Versioni')).getByRole('button', { name: `Vrull ${pkg.version}, 0.30.0 është gati` }))
    expect(router.state.location.search).toBe('?ndrysho=perditesimi')
    expect(screen.getByRole('dialog', { name: 'Versioni 0.30.0' })).toBeInTheDocument()
  })

  it('i gjithë ekrani në anglisht, pa rinisje', async () => {
    await renderSettings()
    act(() => language.set('en'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Use this month, €0.00 of €10' })).toBeInTheDocument()
    expect(await screen.findByRole('switch', { name: /^Did you know\?/ })).toBeChecked()
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual(['Profile', 'Appearance', 'Learn', 'Notifications', 'AI', 'Sync', 'Version'])
    // Provat e mësipërme kanë ndryshuar peshën, ditët dhe oraret: formatet britanike kontrollohen këtu.
    expect(row(/^Weight today/)).toHaveTextContent(/^Weight today\d+\.\d\skg$/)
    expect(row(/^Training days/)).toHaveTextContent(/^Training daysMon, Tue, Thu, Fri/)
    expect(row(/^Times/)).toHaveTextContent(/\d\d:\d\d · wake \d\d:\d\d · sleep \d\d:\d\d/)
    expect(screen.getByRole('link', { name: 'Theme, OLED' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Background, Solid' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Reminders/ })).toHaveTextContent('Workouts, meals, supplements, water, measurements')
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
  })

  it('Mëso: çelësi "A e dije?" i ndezur; fikja ruhet te cilësimet që sinkronizohen (user_settings.learn_facts)', async () => {
    await renderSettings()
    const learn = await screen.findByRole('region', { name: 'Mëso' })
    const toggle = within(learn).getByRole('switch', { name: /^A e dije\?/ })
    expect(toggle).toBeChecked()
    expect(learn).toHaveTextContent('Një fakt në ditë te Sot, gjatë pushimit dhe pas ushqimit.')
    await userEvent.click(toggle)
    expect(toggle).not.toBeChecked()
    await waitFor(async () => expect((await data.store.all('user_settings'))[0].learn_facts).toBe(false))
    await userEvent.click(toggle)
    await waitFor(async () => expect((await data.store.all('user_settings'))[0].learn_facts).toBe(true))
  })

  it('rikujtuesit e fikur dalin te rreshti', async () => {
    const { setReminderToggle } = await import('@/data/reminders')
    await setReminderToggle(data.store, 'meals', false)
    await renderSettings()
    await waitFor(() => expect(screen.getByRole('link', { name: /^Rikujtuesit/ })).toHaveTextContent('Stërvitja, suplementet, uji, matjet'))
    await setReminderToggle(data.store, 'meals', true)
  })
})
