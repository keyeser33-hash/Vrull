import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalDatabase } from '@/data/db'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'
import { setDayAttribute } from '@/lib/day-mode'
import { setRestAlarm } from '@/lib/use-rest-timer'
import { SESSION_TIMING } from './session-local'
import { createFakeRemote } from '@/test/fake-remote'

// Seanca në Vrull (V2-E1-07). Pranimi: një seancë e plotë e Stërvitjes 1 regjistrohet pa internet
// dhe sinkronizohet; rekordi del në moment. Store i vërtetë mbi IndexedDB në memorie, Supabase i
// rremë (src/test/fake-remote), asnjë kërkesë rrjeti.
const USER = '11111111-1111-4111-8111-111111111111'
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, db: null as unknown as LocalDatabase }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const db = createDatabase(`session-${crypto.randomUUID()}`)
  // Ora e store-it ecën një sekondë me çdo lexim, që setet e ruajtura shpejt të kenë radhë të qartë.
  let clock = Date.now()
  const store = createLocalStore(db, { userId: () => '11111111-1111-4111-8111-111111111111', now: () => new Date((clock += 1000)) })
  data.store = store
  data.db = db
  return {
    store,
    useAppUpdate: () => ({ status: 'idle' }),
    updater: {},
    useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store),
  }
})

// Pamja e ditës (V50) vjen nga gatishmëria; këtu e zgjedh prova, që seanca të provohet edhe në ditë të lodhur.
const dayMode = vi.hoisted(() => ({ value: 'normal' as 'normal' | 'tired' | 'energetic' }))
vi.mock('@/data/day-mode', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/data/day-mode')>()),
  dayModeNow: async () => dayMode.value,
}))

// Dridhjet (SPEC §0.3c): e lehtë te çdo ruajtje, e rëndë në vend të saj kur seti jep rekord.
const pulses = vi.hoisted(() => ({ save: vi.fn(() => Promise.resolve()), record: vi.fn(() => Promise.resolve()) }))
vi.mock('./session-motion', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./session-motion')>()),
  savePulse: pulses.save,
  recordPulse: pulses.record,
}))

const fetchSpy = vi.spyOn(globalThis, 'fetch')

async function reset() {
  await import('@/data/app-data')
  const { completeOnboarding } = await import('@/data/profile')
  // Tabelat zbrazen vërtet: fshirja e butë rresht për rresht linte programet e provave të mëparshme
  // në bazë, dhe çdo lexim i ekranit i kalonte të gjitha (provat ngadalësoheshin një nga një).
  await Promise.all(data.db.tables.map((table) => table.clear()))
  localStorage.clear()
  pulses.save.mockClear()
  pulses.record.mockClear()
  await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
}

/**
 * Faza 1 · Java 2 · Stërvitja 1, si te bordet: Java 0 e kapërcyer, Java 1 me Bench Press
 * 60 × 13, 12, 11, 10 + 4 (e1RM 86,0) dhe Standing Calf Raise 70 × 30 (pa e1RM).
 */
async function atPhaseOneWeekTwo() {
  const { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } = await import('@/data/training')
  const { store } = data
  for (let day = 0; day < 4; day++) await skipWorkout(store)
  const java1 = await startWorkout(store)
  const snapshot = (await trainingSnapshot(store))!
  const slotOf = (name: string) => snapshot.plan.slots.find((slot) => snapshot.exercises[slot.exerciseId].name === name)!
  const bench = slotOf('Bench Press')
  for (const [setNumber, reps] of [[1, 13], [2, 12], [3, 11]]) await saveSet(store, { sessionId: java1, slot: bench, setNumber, weightKg: 60, reps })
  await saveSet(store, { sessionId: java1, slot: bench, setNumber: 4, weightKg: 60, reps: 10, technique: 'rest_pause', segments: [{ weightKg: 60, reps: 4 }] })
  await saveSet(store, { sessionId: java1, slot: slotOf('Standing Calf Raise'), setNumber: 1, weightKg: 70, reps: 30 })
  await finishWorkout(store, java1)
  for (let day = 0; day < 3; day++) await skipWorkout(store)
  return { bench, calf: slotOf('Standing Calf Raise'), sessionId: await startWorkout(store) }
}

async function renderApp(path = '/seanca') {
  const { appRoutes } = await import('@/router')
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
  return router
}

const setGroup = (name: string) => screen.findByRole('group', { name })
/** Rreshtat poshtë numrave të setit aktiv (0.23): si të zgjidhet pesha dhe pragu i rekordit. */
const rows = (name = 'Herën e kaluar dhe pragu i rekordit') => screen.getByRole('region', { name })
/** Tabela e seteve (V58): rreshtat e saj; i aktivi është karta me stepper-in. */
const table = (name = 'Setet e ushtrimit') => within(screen.getByRole('region', { name })).getAllByRole('listitem')
/** Rreshtat që nuk janë aktivë, si tekst për lexuesin e ekranit ose emri i butonit. */
const tableText = (name?: string) =>
  table(name).map((item) => (item.getAttribute('aria-current') ? 'aktiv' : (item.querySelector('button')?.getAttribute('aria-label') ?? item.querySelector('.sr-only')?.textContent)))

/** Ruan çdo set dhe segment me vlerat e propozuara, dhe kapërcen pushimet, deri te "Të gjitha setet u bënë". */
async function logEverySet(user: ReturnType<typeof userEvent.setup>) {
  const saveName = /^(Ruaj setin|Ruaj segmentin|Log set|Log segment)$/
  let saved = 0
  for (let guard = 0; guard < 150; guard++) {
    // Ekrani i radhës: mbyllja, pushimi (Kapërce) ose një set që pret ruajtjen. Butoni kërkohet
    // përsëri në çdo provë, sepse seti ri-vizatohet kur leximi i ri sjell setin e ruajtur.
    const next = await waitFor(
      () => {
        if (screen.queryByRole('heading', { level: 1, name: /^(Të gjitha setet u bënë|All sets done)$/ })) return null
        const skip = screen.queryByRole('button', { name: /^(Kapërce|Skip)$/ })
        if (skip) return { button: skip, save: false }
        const button = screen.getByRole('button', { name: saveName })
        // Një ushtrim pa peshë të mëparshme nis me 0 kg dhe "Ruaj setin" pret peshën (F5): shtohet një hap.
        if ((button as HTMLButtonElement).disabled && screen.queryByText(/^(Shkruaj peshën|Enter the weight)$/)) {
          return { button: screen.getByRole('button', { name: /^(Rrit peshën me|Increase weight by)/ }), save: false }
        }
        expect(button).toBeEnabled()
        return { button, save: true }
      },
    ).catch(() => {
      throw new Error(`Pa set për të ruajtur: ${document.body.textContent?.slice(0, 400)}`)
    })
    if (!next) return saved
    await user.click(next.button)
    if (!next.save) continue
    saved += 1
    // Pas ruajtjes vjen pushimi, segmenti, seti tjetër ose mbyllja: butoni i këtij seti largohet.
    await waitFor(() => expect(next.button.isConnected).toBe(false))
  }
  throw new Error(`Seanca nuk mbaroi: ${document.body.textContent?.slice(0, 300)}`)
}

describe('seanca (V2-E1-07)', () => {
  beforeEach(reset)
  afterEach(() => {
    language.set('sq')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('seti: çipat, "Herën e kaluar" dhe pragu i rekordit si rreshta; banderola e rekordit mbi pushimin', async () => {
    await atPhaseOneWeekTwo()
    const user = userEvent.setup()
    await renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ushtrimet e seancës, 1 nga 9 · \d\d:\d\d$/ })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progresi i seancës' })).toHaveAttribute('aria-valuetext', '0 nga 30 sete')
    expect(screen.getByText('Seti 1 nga 4 · 9–11 përsëritje')).toBeInTheDocument()
    expect(screen.getByText('· pushim 90 s', { exact: false })).toBeInTheDocument()
    // Tabela: rreshti aktiv me stepper-in, të tjerët me synimin, i fundit me teknikën.
    expect(tableText()).toEqual(['aktiv', 'Seti 2: synimi 62,5 × 9–11', 'Seti 3: synimi 62,5 × 9–11', 'Seti 4: synimi 62,5 × 9–11'])
    expect(table()[3]).toHaveTextContent('rest-pause')
    expect(table()[3]).toHaveTextContent('Pastaj 15 s pushim dhe vazhdo')
    expect(table()[1]).toHaveTextContent('60 × 12')
    expect(within(table()[0]).getByText(/^Herën e kaluar · /)).toHaveTextContent('Herën e kaluar · 60 × 13 · +2,5 kg')
    // Pesha e propozuar e §7: 86,0 / (1 + 11/30) = 62,9 → 62,5; pa RIR te Java 2 e Shortcut to Size.
    expect(await setGroup('Seti 1: 62,5 kg, 9 përsëritje')).toBeInTheDocument()
    expect(screen.getByText('përsëritje · synimi 9–11')).toBeInTheDocument()
    expect(screen.queryByText('Sa të kishin mbetur (RIR)')).not.toBeInTheDocument()
    expect(rows()).toHaveTextContent('Rekord i ri me12 përsëritje · e1RM 87,5 kg')
    // Lëvizja dhe 3 sinjalet e udhëzuesit, të hapura te seti i parë; "Shiko videon" me videon e zgjedhur.
    expect(within(screen.getByRole('list', { name: 'Sinjalet e formës' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      '1Këmbët në dysheme, shtyj tokën',
      '2Tërhiq shpatullat pas',
      '3Bërrylat rreth 45° nga trupi',
    ])
    expect(screen.getByRole('button', { name: 'Fshih lëvizjen dhe sinjalet' })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: /^Shiko videon/ })).toBeInTheDocument()
    // Pa mini-player mbi "Ruaj setin": jashtë telefonit muzika s'ka as ikonë.
    expect(screen.queryByRole('button', { name: /Trupi në ritëm|Lidh muzikën/ })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()

    for (let rep = 0; rep < 3; rep++) await user.click(screen.getByRole('button', { name: 'Rrit përsëritjet' }))
    expect(screen.getByRole('group', { name: 'Seti 1: 62,5 kg, 12 përsëritje' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))

    // Rekordi del në moment: banderola mbi pushimin, me ushtrimin, e1RM-në dhe shtesën.
    expect(await screen.findByText('Seti 1 u ruajt · 62,5 × 12')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Rekord i riBench Press · e1RM 87,5 kg +1,5 kg')
    // Dridhja e rëndë e rekordit, jo edhe e lehta e ruajtjes.
    expect(pulses.record).toHaveBeenCalledTimes(1)
    expect(pulses.save).not.toHaveBeenCalled()
    expect(screen.getByRole('timer')).toHaveAccessibleName(/^Pushimi: mbeten 1 minutë e (30|29|28) sekonda nga 1 minutë e 30 sekonda$/)
    // Pushimi (bordi "Pushimi · Zhbëj"): seti që vjen dhe tabela e ushtrimit, me setin e ruajtur që preket.
    expect(screen.getByText('Pastaj · seti 2 nga 4')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Bench Press' })).toBeInTheDocument()
    expect(tableText()).toEqual(['Seti 1: 62,5\u00A0kg × 12, rekord. Prek për ta ndryshuar', 'aktiv', 'Seti 3: synimi 62,5 × 9–11', 'Seti 4: synimi 62,5 × 9–11'])
    expect(table()[0]).toHaveTextContent('rekord')
    expect(table()[1]).toHaveTextContent('tani')
    expect(screen.queryByRole('button', { name: 'Ruaj setin' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ruaj setin 2' })).toBeInTheDocument()
    // "Mbyll" e heq banderolën; pushimi vazhdon.
    await user.click(screen.getByRole('button', { name: 'Mbyll njoftimin e rekordit' }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('timer')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Shto 15 sekonda te pushimi' }))
    expect(screen.getByText('nga 1:45')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kapërce' }))

    // Seti 2 mban peshën e setit 1; pragu tani duhet ta kalojë rekordin e ri (87,5).
    expect(await setGroup('Seti 2: 62,5 kg, 12 përsëritje')).toBeInTheDocument()
    expect(rows()).toHaveTextContent('Rekord i ri me13 përsëritje · e1RM 89,6 kg')
    expect(screen.getByRole('progressbar', { name: 'Progresi i seancës' })).toHaveAttribute('aria-valuetext', '1 nga 30 sete')
    expect(tableText()).toEqual(['Seti 1: 62,5\u00A0kg × 12, rekord. Prek për ta ndryshuar', 'aktiv', 'Seti 3: synimi 62,5 × 9–11', 'Seti 4: synimi 62,5 × 9–11'])
    expect(table()[0]).toHaveTextContent('rekord')
    // Pas setit të parë lëvizja paloset në një rresht; sinjalet nuk dalin derisa të hapet.
    expect(screen.queryByRole('list', { name: 'Sinjalet e formës' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Shfaq lëvizjen dhe sinjalet' })).toHaveAttribute('aria-expanded', 'false')

    // Kur pragu bie nën intervalin, çdo set i tij jep rekord.
    // 70 kg e kalojnë 87,5 me 8 përsëritje, para 9–11: 70 × 9 jep 91.
    for (let step = 0; step < 3; step++) await user.click(screen.getByRole('button', { name: 'Rrit peshën me 2,5 kg' }))
    expect(rows()).toHaveTextContent('Rekord i ri meçdo set në interval · e1RM të paktën 91 kg')

    const [saved] = await data.store.all('set_logs').then((rows) => rows.filter((row) => row.reps === 12 && row.weight_kg === 62.5))
    expect(saved).toMatchObject({ set_number: 1, technique: 'none', rir: null })
  })

  it('"Ruaj setin" pa rekord: dridhja e lehtë, pa banderolë', async () => {
    await atPhaseOneWeekTwo()
    const user = userEvent.setup()
    await renderApp()
    expect(await setGroup('Seti 1: 62,5 kg, 9 përsëritje')).toBeInTheDocument()
    // 57,5 × 9: nën 60 kg të Javës 1 dhe nën e1RM-në e saj.
    for (let step = 0; step < 2; step++) await user.click(screen.getByRole('button', { name: 'Ul peshën me 2,5 kg' }))
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
    expect(await screen.findByText('Seti 1 u ruajt · 57,5 × 9')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(pulses.save).toHaveBeenCalledTimes(1)
    expect(pulses.record).not.toHaveBeenCalled()
  })

  it('pesha nga "Peshat e javës", tastiera numerike dhe pesha e fundit kur s\'ka e1RM', async () => {
    const { bench } = await atPhaseOneWeekTwo()
    const { changeWeekWeight } = await import('@/data/week-weights')
    const { trainingSnapshot } = await import('@/data/training')
    const { plan } = (await trainingSnapshot(data.store))!
    await changeWeekWeight(data.store, { blockId: plan.blockId, week: plan.week }, bench.slotId, 65)
    const user = userEvent.setup()
    await renderApp()

    expect(await setGroup('Seti 1: 65 kg, 9 përsëritje')).toBeInTheDocument()
    expect(within(table()[0]).getByText(/^Herën e kaluar · /)).toHaveTextContent('Herën e kaluar · 60 × 13 · +5 kg')

    // Prekja e numrit hap tastierën numerike (bordi "Seanca · tastiera"): shifra e parë zëvendëson vlerën.
    await user.click(screen.getByRole('button', { name: 'Shkruaj përsëritjet, 9' }))
    let sheet = screen.getByRole('dialog', { name: 'Përsëritjet' })
    expect(sheet).toHaveAccessibleDescription('Bench Press · seti 1')
    expect(within(sheet).getByRole('button', { name: /^Herën e kaluar/, pressed: false })).toHaveTextContent('13')
    await user.click(within(sheet).getByRole('button', { name: '1' }))
    await user.click(within(sheet).getByRole('button', { name: '1' }))
    await user.click(within(sheet).getByRole('button', { name: 'Gati' }))
    expect(await setGroup('Seti 1: 65 kg, 11 përsëritje')).toBeInTheDocument()

    // Pesha: −/+ me hapin e shufrës, disqet për anë, "Pesha e javës" dhe tastiera fizike.
    await user.click(screen.getByRole('button', { name: 'Shkruaj peshën, 65 kg' }))
    sheet = screen.getByRole('dialog', { name: 'Pesha' })
    expect(sheet).toHaveTextContent('Shufra 20 kg')
    expect(sheet).toHaveTextContent('Për anë: 20 + 2,5')
    expect(sheet).toHaveTextContent('65 = 20 + 2 × 22,5')
    expect(within(sheet).getByRole('button', { name: /^Pesha e javës/, pressed: true })).toHaveTextContent('65')
    await user.click(within(sheet).getByRole('button', { name: 'Ul peshën me 2,5 kg' }))
    expect(sheet).toHaveTextContent('Për anë: 20 + 1,25')
    await user.click(within(sheet).getByRole('button', { name: 'Fshi shifrën e fundit' }))
    await user.keyboard('2,5')
    expect(sheet).toHaveTextContent('2,5kg')
    await user.click(within(sheet).getByRole('button', { name: /^Herën e kaluar/ }))
    await user.keyboard('{Enter}')
    expect(await setGroup('Seti 1: 60 kg, 11 përsëritje')).toBeInTheDocument()

    // Lista e ushtrimeve: pulpat kanë histori pa e1RM (30 përsëritje), ndaj marrin peshën e fundit.
    await user.click(screen.getByRole('button', { name: /^Ushtrimet e seancës/ }))
    const list = screen.getByRole('dialog', { name: 'Ushtrimet e sotme' })
    expect(within(list).getByText('0 nga 30 sete', { exact: false })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /^Bench Press/ })).toHaveAttribute('aria-current', 'step')
    expect(within(list).getByText('Tani: seti 1 nga 4 · 9–11')).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'Ndrysho ushtrimin' })).toBeInTheDocument()
    expect(within(list).getByText('Prek një ushtrim për ta parë dhe për të ndryshuar setet. Mbetën 30 sete.')).toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: /^Standing Calf Raise/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Standing Calf Raise' })).toBeInTheDocument()
    expect(await setGroup('Seti 1: 70 kg, 15 përsëritje')).toBeInTheDocument()
    expect(within(table()[0]).getByText(/^Herën e kaluar · /)).toHaveTextContent('Herën e kaluar · 70 × 30')
    expect(screen.queryByText('Rekord i ri me')).not.toBeInTheDocument()
  })

  it('pranimi: Stërvitja 1 e plotë pa internet, me rest-pause si segmente, mbyllja me rekordin dhe sinkronizimi', async () => {
    const { sessionId } = await atPhaseOneWeekTwo()
    const { createSync } = await import('@/data/sync')
    const remote = createFakeRemote()
    remote.offline = true
    const sync = createSync({ db: data.db, remote, userId: () => USER })
    const user = userEvent.setup({ delay: null })
    const router = await renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    for (let rep = 0; rep < 3; rep++) await user.click(screen.getByRole('button', { name: 'Rrit përsëritjet' }))
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Rekord i riBench Press · e1RM 87,5 kg +1,5 kg'))
    await user.click(await screen.findByRole('button', { name: 'Kapërce' }))
    for (const setNumber of [2, 3, 4]) {
      await setGroup(`Seti ${setNumber}: 62,5 kg, 12 përsëritje`)
      await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
      if (setNumber < 4) await user.click(await screen.findByRole('button', { name: 'Kapërce' }))
    }
    // Seti 4 me rest-pause: 15 s pushim, pastaj segmenti në të njëjtin set.
    expect(await screen.findByText('nga 0:15')).toBeInTheDocument()
    expect(await screen.findByText('Seti 4 · rest-pause')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ruaj segmentin' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kapërce' }))
    expect(await screen.findByText('Seti 4 nga 4 · rest-pause, deri në dështim')).toBeInTheDocument()
    expect(await setGroup('Seti 4: 62,5 kg, 4 përsëritje')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj segmentin' }))
    expect(await screen.findByText('Segmenti i setit 4 u ruajt · 62,5 × 12 + 4')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kapërce' }))

    // Lista: Bench Press i bërë me rekordin, Incline Bench Press tani.
    expect(await screen.findByRole('heading', { level: 1, name: 'Incline Bench Press' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Ushtrimet e seancës/ }))
    const list = screen.getByRole('dialog', { name: 'Ushtrimet e sotme' })
    const done = within(list).getAllByRole('listitem')[0]
    expect(done).toHaveTextContent('Bench Press62,5 kg · 12, 12, 12, 12 + 4Rekord i ri: e1RM 87,5 kg4/4')
    expect(within(done).getByRole('img', { name: 'E bërë' })).toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: 'Mbyll' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())

    await logEverySet(user)
    await user.click(screen.getByRole('button', { name: 'Mbyll stërvitjen' }))

    // Mbyllja: rekordi i seancës dhe setet e punës.
    await waitFor(() => expect(router.state.location.pathname).toBe(`/seanca/mbyllja/${sessionId}`))
    expect(await screen.findByRole('heading', { level: 1, name: 'Rekord i ri' })).toBeInTheDocument()
    expect(screen.getByText('Faza 1 · Java 2 · Stërvitja 1')).toBeInTheDocument()
    expect(screen.getByText('87,5')).toBeInTheDocument()
    expect(screen.getByText('Bench Press · seti 1: 62,5 × 12')).toBeInTheDocument()
    expect(screen.getByText('+1,5 kg nga rekordi i kaluar')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '30 sete pune' })).toHaveTextContent('Setet e punës30')
    // Gjoksi: 13 sete sot dhe 4 të Bench Press të Javës 1, e regjistruar në provë në të njëjtën javë.
    const volume = screen.getByRole('region', { name: 'Gjoksi këtë javë' })
    expect(volume).toHaveTextContent('Në objektiv17nga 10–20 sete pune')
    expect(within(volume).getByRole('img', { name: '17 sete, objektivi 10 deri 20' })).toBeInTheDocument()
    expect(volume).toHaveTextContent('13 sete sot, 4 më herët këtë javë.')

    // Gjithçka u ruajt vetëm në telefon; sinkronizimi pret rrjetin.
    const sets = await data.store.where('set_logs', 'session_id', sessionId)
    expect(sets).toHaveLength(30)
    const lastSets = sets.filter((set) => set.technique === 'rest_pause')
    expect(lastSets).toHaveLength(9)
    expect(lastSets.every((set) => Array.isArray(set.segments) && set.segments.length === 1)).toBe(true)
    expect(sets.every((set) => set.rir === null)).toBe(true)
    expect(await sync.run()).toMatchObject({ status: 'offline' })
    expect(remote.rows('set_logs')).toEqual([])

    remote.offline = false
    expect(await sync.run()).toMatchObject({ status: 'ok', rejected: 0 })
    expect(remote.rows('set_logs').filter((row) => row.session_id === sessionId)).toHaveLength(30)
    expect(remote.rows('workout_sessions').find((row) => row.id === sessionId)).toMatchObject({ status: 'completed', user_id: USER })
    const [state] = remote.rows('program_state')
    expect(state).toMatchObject({ week: 2 })
    expect(state.day_id).not.toBe(sets[0].session_id)

    await user.click(screen.getByRole('button', { name: 'Mbaro' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  })

  it('Java 0: RIR-i i recetës zgjidhet te seti; mbyllja pa rekord', async () => {
    const { startWorkout } = await import('@/data/training')
    const sessionId = await startWorkout(data.store)
    const user = userEvent.setup()
    await renderApp()
    expect(await screen.findByText('Seti 1 nga 3 · 12–15 përsëritje')).toBeInTheDocument()
    expect(screen.getByText('Zgjidh peshën ku mbyll 12–15 përsëritje')).toBeInTheDocument()
    expect(screen.queryByText('Rekord i ri me')).not.toBeInTheDocument()
    const rir = screen.getByRole('group', { name: 'Sa të kishin mbetur (RIR)' })
    expect(within(rir).getByRole('button', { name: '2', pressed: true })).toBeInTheDocument()
    await user.click(within(rir).getByRole('button', { name: '3' }))
    // F5: me 0 kg "Ruaj setin" është i çaktivizuar dhe tregon pse.
    expect(screen.getByRole('button', { name: 'Ruaj setin' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Ruaj setin' })).toHaveAccessibleDescription('Shkruaj peshën')
    await user.click(screen.getByRole('button', { name: 'Shkruaj peshën, 0 kg' }))
    await user.keyboard('47,5')
    await user.click(within(screen.getByRole('dialog', { name: 'Pesha' })).getByRole('button', { name: 'Gati' }))
    expect(screen.queryByText('Shkruaj peshën')).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Ruaj setin' }))
    // Seti i parë i ushtrimit nuk është rekord: pa banderolë, pa etiketë.
    expect(await screen.findByText('Seti 1 u ruajt · 47,5 × 12')).toBeInTheDocument()
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.getByRole('button', { name: 'Seti 1: 47,5\u00A0kg × 12. Prek për ta ndryshuar' })).toBeInTheDocument()
    expect((await data.store.where('set_logs', 'session_id', sessionId))[0]).toMatchObject({ weight_kg: 47.5, reps: 12, rir: 3 })

    await user.click(screen.getByRole('button', { name: 'Kapërce' }))
    await user.click(await screen.findByRole('button', { name: /^Ushtrimet e seancës/ }))
    const list = screen.getByRole('dialog', { name: 'Ushtrimet e sotme' })
    await user.click(within(list).getByRole('button', { name: 'Mbyll stërvitjen' }))
    expect(within(list).getByText('Mbeten 20 sete pa bërë. Stërvitja mbyllet me ato që ke regjistruar.')).toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: 'Po, mbyll' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Stërvitja 1' })).toBeInTheDocument()
    expect(screen.getByText('Java 0 · Stërvitja 1')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '1 set pune' })).toBeInTheDocument()
  })

  it('Faza 1 · Java 3: seti i fundit me drop set te pesha e javës 1, pa internet', async () => {
    const { finishWorkout, saveSet, skipWorkout, startWorkout, trainingSnapshot } = await import('@/data/training')
    for (let workout = 0; workout < 4; workout++) await skipWorkout(data.store)
    // Faza 1 · Java 1 · Stërvitja 1: Bench Press me 50 kg.
    const week1 = await startWorkout(data.store)
    const [bench] = (await trainingSnapshot(data.store))!.plan.slots
    await saveSet(data.store, { sessionId: week1, slot: bench, setNumber: 1, weightKg: 50, reps: 14 })
    await finishWorkout(data.store, week1)
    for (let workout = 0; workout < 7; workout++) await skipWorkout(data.store)
    const sessionId = await startWorkout(data.store)

    const user = userEvent.setup({ delay: null })
    await renderApp()
    expect(await screen.findByText('Seti 1 nga 4 · 6–8 përsëritje')).toBeInTheDocument()
    // 1RM nga 50 × 14 = 73,3; 73,3 / (1 + 8/30) = 57,9 → 57,5 me hapin e shufrës.
    expect(await setGroup('Seti 1: 57,5 kg, 6 përsëritje')).toBeInTheDocument()
    expect(screen.getByText('Pastaj 50 kg, pa pushim')).toBeInTheDocument()
    for (const setNumber of [1, 2, 3, 4]) {
      await setGroup(`Seti ${setNumber}: 57,5 kg, 6 përsëritje`)
      await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
      if (setNumber < 4) await user.click(await screen.findByRole('button', { name: 'Kapërce' }))
    }
    expect(await screen.findByText('Seti 4 nga 4 · drop set, ul peshën dhe vazhdo')).toBeInTheDocument()
    expect(await setGroup('Seti 4: 50 kg, 2 përsëritje')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj segmentin' }))
    await logEverySet(user)
    await user.click(screen.getByRole('button', { name: 'Mbyll stërvitjen' }))
    expect(await screen.findByText('Seanca u mbyll')).toBeInTheDocument()

    const sets = await data.store.where('set_logs', 'session_id', sessionId)
    const benchSets = sets.filter((set) => set.exercise_id === bench.exerciseId).sort((a, b) => Number(a.set_number) - Number(b.set_number))
    expect(benchSets.map((set) => [set.set_number, set.weight_kg, set.technique])).toEqual([
      [1, 57.5, 'none'],
      [2, 57.5, 'none'],
      [3, 57.5, 'none'],
      [4, 57.5, 'drop_set'],
    ])
    expect(benchSets[3].segments).toEqual([{ weight_kg: 50, reps: 2 }])
    // Çdo ushtrim i ditës mbyll setin e fundit me drop set (pulpat përfshirë).
    const lastSets = sets.filter((set) => set.technique === 'drop_set')
    expect(lastSets).toHaveLength(9)
    expect(lastSets.every((set) => Array.isArray(set.segments) && set.segments.length === 1)).toBe(true)
  })

  it('anglisht: seti, pushimi dhe mbyllja me tekstet e bordit "EN · Seanca"', async () => {
    language.set('en')
    await atPhaseOneWeekTwo()
    const user = userEvent.setup()
    await renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Session exercises, 1 of 9 · \d\d:\d\d$/ })).toBeInTheDocument()
    expect(screen.getByText('Set 1 of 4 · 9–11 reps')).toBeInTheDocument()
    expect(screen.getByText('· 90 s rest', { exact: false })).toBeInTheDocument()
    expect(tableText('Sets for this exercise')).toEqual(['aktiv', 'Set 2: target 62.5 × 9–11', 'Set 3: target 62.5 × 9–11', 'Set 4: target 62.5 × 9–11'])
    expect(within(table('Sets for this exercise')[0]).getByText(/^Last time · /)).toHaveTextContent('Last time · 60 × 13 · +2.5 kg')
    expect(await setGroup('Set 1: 62.5 kg, 9 reps')).toBeInTheDocument()
    expect(screen.getByText('reps · target 9–11')).toBeInTheDocument()
    expect(screen.getByText('Then 15 s rest and keep going')).toBeInTheDocument()
    expect(rows('Last time and personal best')).toHaveTextContent('Personal best with12 reps · e1RM 87.5 kg')
    expect(within(screen.getByRole('list', { name: 'Form cues' })).getAllByRole('listitem')[2]).toHaveTextContent('Elbows about 45°')
    expect(screen.getByRole('button', { name: 'Hide the movement and cues' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Muscles worked' })).toBeInTheDocument()

    for (let rep = 0; rep < 3; rep++) await user.click(screen.getByRole('button', { name: 'Increase reps' }))
    await user.click(screen.getByRole('button', { name: 'Log set' }))
    expect(await screen.findByText('Set 1 logged · 62.5 × 12')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('New personal bestBench Press · e1RM 87.5 kg +1.5 kg')
    expect(screen.getByRole('button', { name: 'Dismiss personal best' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Set 1: 62.5\u00A0kg × 12, personal best. Tap to edit' })).toBeInTheDocument()
    expect(screen.getByText('Next · set 2 of 4')).toBeInTheDocument()
    expect(screen.getByText('Tap a set to edit it')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log set 2' })).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAccessibleName(/^Rest: 1 minute (30|29|28) seconds left of 1 minute 30 seconds$/)
    expect(screen.getByRole('button', { name: 'Take 15 seconds off the rest' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Skip' }))
    expect(await screen.findByRole('button', { name: 'Set 1: 62.5\u00A0kg × 12, personal best. Tap to edit' })).toBeInTheDocument()
    expect(tableText('Sets for this exercise')).toEqual(['Set 1: 62.5\u00A0kg × 12, personal best. Tap to edit', 'aktiv', 'Set 3: target 62.5 × 9–11', 'Set 4: target 62.5 × 9–11'])

    await user.click(await screen.findByRole('button', { name: /^Session exercises/ }))
    const list = screen.getByRole('dialog', { name: 'Today’s exercises' })
    expect(within(list).getByText('Now: set 2 of 4 · 9–11')).toBeInTheDocument()
    expect(within(list).getByText('Set 1: 62.5 kg × 12')).toBeInTheDocument()
    expect(within(list).getByText('Tap an exercise to see it and edit its sets. 29 sets left.')).toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: 'Finish workout' }))
    await user.click(within(list).getByRole('button', { name: 'Yes, finish' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'New personal best' })).toBeInTheDocument()
    expect(screen.getByText('Phase 1 · Week 2 · Workout 1')).toBeInTheDocument()
    expect(screen.getByText('Bench Press · set 1: 62.5 × 12')).toBeInTheDocument()
    expect(screen.getByText('+1.5 kg on your previous best')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '1 working set' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
  })

  it('prekja e setit të ruajtur hap "Ndrysho setin": rekordi dhe pragu rillogariten, pushimi nuk ndalet', async () => {
    const { sessionId } = await atPhaseOneWeekTwo()
    const user = userEvent.setup()
    await renderApp()
    for (let rep = 0; rep < 3; rep++) await user.click(await screen.findByRole('button', { name: 'Rrit përsëritjet' }))
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))

    // Nga pushimi: prekja e setit te tabela hap fletën mbi pushimin, që vazhdon.
    await user.click(await screen.findByRole('button', { name: 'Seti 1: 62,5\u00A0kg × 12, rekord. Prek për ta ndryshuar' }))
    let sheet = screen.getByRole('dialog', { name: 'Ndrysho setin 1' })
    expect(within(sheet).getByText('e1RM 87,5 kg · rekord +1,5 kg')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Mbyll' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: 'Kapërce' }))

    // Nga çipi: 60 × 10 nuk e kalon as e1RM-në 86,0, as peshën e Javës 1 për 10 përsëritje (60 × 13);
    // seti humb rekordin dhe pragu kthehet te 12.
    await user.click(await screen.findByRole('button', { name: 'Seti 1: 62,5\u00A0kg × 12, rekord. Prek për ta ndryshuar' }))
    sheet = screen.getByRole('dialog', { name: 'Ndrysho setin 1' })
    expect(within(sheet).getByText('Bench Press')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Ul peshën me 2,5 kg' }))
    await user.click(within(sheet).getByRole('button', { name: 'Ul përsëritjet' }))
    await user.click(within(sheet).getByRole('button', { name: 'Ul përsëritjet' }))
    expect(within(sheet).getByText('e1RM 80,0 kg · Seti nuk është më rekord.')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj ndryshimin' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByRole('button', { name: 'Seti 1: 60\u00A0kg × 10. Prek për ta ndryshuar' })).toBeInTheDocument()
    expect(table()[0]).not.toHaveTextContent('rekord')
    expect(rows()).toHaveTextContent('Rekord i ri me12 përsëritje · e1RM 87,5 kg')
    const [set1] = (await data.store.where('set_logs', 'session_id', sessionId)).filter((set) => set.set_number === 1)
    expect(set1).toMatchObject({ weight_kg: 60, reps: 10, rir: null })
  })

  it('pulpat pa e1RM: pesha më e madhe për 30 përsëritje jep rekord, me banderolën dhe etiketën', async () => {
    await atPhaseOneWeekTwo()
    const user = userEvent.setup()
    await renderApp()
    await user.click(await screen.findByRole('button', { name: /^Ushtrimet e seancës/ }))
    await user.click(within(screen.getByRole('dialog', { name: 'Ushtrimet e sotme' })).getByRole('button', { name: /^Standing Calf Raise/ }))
    expect(await setGroup('Seti 1: 70 kg, 15 përsëritje')).toBeInTheDocument()
    // Java 1: 70 × 30. Sot 75 × 30: pa e1RM (mbi 15 përsëritje), por pesha më e madhe për 30.
    await user.click(screen.getByRole('button', { name: 'Shkruaj peshën, 70 kg' }))
    // Pulpat me makinë: pa disqet e shufrës.
    expect(screen.getByRole('dialog', { name: 'Pesha' })).not.toHaveTextContent('Shufra')
    await user.keyboard('75{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Shkruaj përsëritjet, 15' }))
    await user.keyboard('30{Enter}')
    expect(await setGroup('Seti 1: 75 kg, 30 përsëritje')).toBeInTheDocument()
    expect(screen.queryByText('Rekord i ri me')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Rekord i riStanding Calf Raise · Pesha më e madhe për 30 përsëritje: 75 kg'))
    expect(await screen.findByRole('button', { name: 'Seti 1: 75\u00A0kg × 30, rekord. Prek për ta ndryshuar' })).toBeInTheDocument()
  })

  it('segmenti i rest-pause kapërcehet; "Mbrapa" e lë seancën të hapur', async () => {
    const { bench, sessionId } = await atPhaseOneWeekTwo()
    const { saveSet } = await import('@/data/training')
    for (const setNumber of [1, 2, 3]) await saveSet(data.store, { sessionId, slot: bench, setNumber, weightKg: 62.5, reps: 10 })
    const user = userEvent.setup()
    const router = await renderApp()

    expect(await setGroup('Seti 4: 62,5 kg, 10 përsëritje')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
    await user.click(await screen.findByRole('button', { name: 'Kapërce' }))
    expect(await screen.findByRole('button', { name: 'Ruaj segmentin' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kapërce segmentin' }))
    // Pushimi i zakonshëm, pastaj ushtrimi tjetër.
    expect(await screen.findByText('nga 1:30')).toBeInTheDocument()
    expect(screen.getByText('Incline Bench Press')).toBeInTheDocument()
    const set4 = (await data.store.where('set_logs', 'session_id', sessionId)).find((set) => set.set_number === 4)
    expect(set4).toMatchObject({ technique: 'rest_pause', segments: null })

    await user.click(screen.getByRole('button', { name: 'Mbrapa' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect((await data.store.get('workout_sessions', sessionId))?.status).toBe('in_progress')
  })

  it('pa seancë të hapur kthehet te Sot', async () => {
    const router = await renderApp()
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    await act(async () => {})
  })
})

describe('seanca e re: "Zhbëj", ndryshimi i çdo seti, rrëshqitja dhe lista (V58)', () => {
  beforeEach(reset)
  afterEach(() => {
    language.set('sq')
    setRestAlarm(undefined)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('"Ruaj setin" e shfaq setin dhe "Zhbëj" menjëherë, pa pritur bazën; "Zhbëj" e heq setin dhe ndal pushimin me njoftimin e tij', async () => {
    const { sessionId } = await atPhaseOneWeekTwo()
    const alarm = { schedule: vi.fn(), cancel: vi.fn() }
    setRestAlarm(alarm)
    const user = userEvent.setup()
    await renderApp()
    expect(await setGroup('Seti 1: 62,5 kg, 9 përsëritje')).toBeInTheDocument()
    for (let rep = 0; rep < 3; rep++) await user.click(screen.getByRole('button', { name: 'Rrit përsëritjet' }))

    // Shkrimi i setit vonon 2 s, si një telefon i zënë: ekrani nuk e pret.
    const put = data.store.put
    let release: () => void = () => {}
    const slow = new Promise<void>((resolve) => (release = resolve))
    data.store.put = (async (table, values, options) => {
      if (table === 'set_logs') await slow
      return put(table, values, options)
    }) as typeof put
    try {
      await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
      // Pa asnjë pritje: pushimi, "Zhbëj", seti te tabela e pushimit dhe banderola e rekordit.
      expect(screen.getByRole('timer')).toBeInTheDocument()
      expect(screen.getByText('Seti 1 u ruajt · 62,5 × 12')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Zhbëj setin 1' })).toBeInTheDocument()
      expect(screen.getByRole('status')).toHaveTextContent('Rekord i ri')
      expect(alarm.schedule).toHaveBeenCalledTimes(1)
      expect(await data.store.where('set_logs', 'session_id', sessionId)).toEqual([])

      // "Zhbëj" para se baza ta ketë shkruar: seti zhduket, pushimi dhe njoftimi i tij ndalen, banderola ikën.
      await user.click(screen.getByRole('button', { name: 'Zhbëj setin 1' }))
      expect(screen.queryByRole('timer')).not.toBeInTheDocument()
      expect(alarm.cancel).toHaveBeenCalled()
      expect(screen.getByRole('status')).toBeEmptyDOMElement()
      expect(screen.queryByText('Seti 1 u ruajt · 62,5 × 12')).not.toBeInTheDocument()
      expect(await setGroup('Seti 1: 62,5 kg, 9 përsëritje')).toBeInTheDocument()
      expect(table()[0]).toHaveAttribute('aria-current', 'step')
    } finally {
      release()
      data.store.put = put
    }
    // Shkrimi mbaroi, pastaj fshirja: asnjë set i gjallë, fshirja e butë pret sinkronizimin.
    await waitFor(async () =>
      expect((await data.db.set_logs.toArray()).filter((row) => row.session_id === sessionId)).toEqual([expect.objectContaining({ deleted_at: expect.any(String), reps: 12 })]),
    )
    expect(await data.store.where('set_logs', 'session_id', sessionId)).toEqual([])
    expect(screen.getByRole('progressbar', { name: 'Progresi i seancës' })).toHaveAttribute('aria-valuetext', '0 nga 30 sete')
  })

  it('"Zhbëj" ikën pas 6 sekondash', async () => {
    await atPhaseOneWeekTwo()
    await renderApp()
    const save = await screen.findByRole('button', { name: 'Ruaj setin' })
    // Me kohëmatës të rremë vetëm setTimeout (docs/MESIMET.md): klikimi me fireEvent, pa findBy.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      fireEvent.click(save)
      expect(screen.getByRole('button', { name: 'Zhbëj setin 1' })).toBeInTheDocument()
      await act(() => vi.advanceTimersByTimeAsync(5900))
      expect(screen.getByRole('button', { name: 'Zhbëj setin 1' })).toBeInTheDocument()
      await act(() => vi.advanceTimersByTimeAsync(200))
      expect(screen.queryByRole('button', { name: 'Zhbëj setin 1' })).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
    // Pa "Zhbëj", lexuesi i ekranit e dëgjon setin te pushimi.
    expect(screen.getByText('Seti 1 u ruajt: 62,5 × 9')).toBeInTheDocument()
  })

  it('ushtrimi i bërë hapet nga lista dhe me rrëshqitje: çdo set i tij ndryshohet me parapamjen e e1RM-së dhe të rekordit', async () => {
    const { bench, sessionId } = await atPhaseOneWeekTwo()
    const { saveSet } = await import('@/data/training')
    // Bench Press i bërë: 62,5 × 12 (rekord), 12, 11, 10 + 3.
    for (const [setNumber, reps] of [[1, 12], [2, 12], [3, 11]]) await saveSet(data.store, { sessionId, slot: bench, setNumber, weightKg: 62.5, reps })
    await saveSet(data.store, { sessionId, slot: bench, setNumber: 4, weightKg: 62.5, reps: 10, technique: 'rest_pause', segments: [{ weightKg: 62.5, reps: 3 }] })
    const user = userEvent.setup()
    await renderApp()
    expect(await screen.findByRole('heading', { level: 1, name: 'Incline Bench Press' })).toBeInTheDocument()

    // Lista: Bench Press i bërë, me miniaturën dhe shenjën, hapet për t'u parë.
    await user.click(screen.getByRole('button', { name: /^Ushtrimet e seancës/ }))
    const list = screen.getByRole('dialog', { name: 'Ushtrimet e sotme' })
    expect(within(list).getByText('Prek një ushtrim për ta parë dhe për të ndryshuar setet. Mbetën 26 sete.')).toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: /^E bërëBench Press/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByText('4 nga 4 sete të ruajtura · 9–11 përsëritje')).toBeInTheDocument()
    expect(tableText()).toEqual([
      'Seti 1: 62,5 kg × 12, rekord. Prek për ta ndryshuar',
      'Seti 2: 62,5 kg × 12. Prek për ta ndryshuar',
      'Seti 3: 62,5 kg × 11. Prek për ta ndryshuar',
      'Seti 4: 62,5 kg × 10 + 3. Prek për ta ndryshuar',
    ])
    expect(screen.queryByRole('button', { name: 'Ruaj setin' })).not.toBeInTheDocument()

    // Seti 2 bëhet 65 × 12: e1RM 91,0 kg, rekord +3,5 kg kundrejt setit 1.
    await user.click(screen.getByRole('button', { name: 'Seti 2: 62,5 kg × 12. Prek për ta ndryshuar' }))
    const sheet = screen.getByRole('dialog', { name: 'Ndrysho setin 2' })
    await user.click(within(sheet).getByRole('button', { name: 'Rrit peshën me 2,5 kg' }))
    expect(within(sheet).getByText('e1RM 91,0 kg · rekord +3,5 kg')).toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj ndryshimin' }))
    expect(await screen.findByRole('button', { name: 'Seti 2: 65 kg × 12, rekord. Prek për ta ndryshuar' })).toBeInTheDocument()
    const [set2] = (await data.store.where('set_logs', 'session_id', sessionId)).filter((row) => row.set_number === 2)
    expect(set2).toMatchObject({ weight_kg: 65, reps: 12 })

    // "Vazhdo te Incline Bench Press" kthen te seti që pret; rrëshqitja majtas e hap Bench Press përsëri.
    await user.click(screen.getByRole('button', { name: 'Vazhdo te Incline Bench Press' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Incline Bench Press' })).toBeInTheDocument()
    const main = screen.getByRole('main')
    fireEvent.pointerDown(main, { clientX: 60, clientY: 400 })
    fireEvent.pointerUp(main, { clientX: 260, clientY: 410 })
    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    // Rrëshqitja djathtas çon te ushtrimi i radhës; një lëvizje e vogël ose vertikale jo.
    fireEvent.pointerDown(screen.getByRole('main'), { clientX: 300, clientY: 400 })
    fireEvent.pointerUp(screen.getByRole('main'), { clientX: 280, clientY: 600 })
    expect(screen.getByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    fireEvent.pointerDown(screen.getByRole('main'), { clientX: 300, clientY: 400 })
    fireEvent.pointerUp(screen.getByRole('main'), { clientX: 120, clientY: 420 })
    expect(await screen.findByRole('heading', { level: 1, name: 'Incline Bench Press' })).toBeInTheDocument()
  })

  it('anglisht: "Undo", ushtrimi i bërë dhe lista', async () => {
    language.set('en')
    const { bench, sessionId } = await atPhaseOneWeekTwo()
    const { saveSet } = await import('@/data/training')
    for (const setNumber of [1, 2, 3]) await saveSet(data.store, { sessionId, slot: bench, setNumber, weightKg: 62.5, reps: 10 })
    const user = userEvent.setup()
    await renderApp()
    expect(await setGroup('Set 4: 62.5 kg, 10 reps')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Log set' }))
    expect(screen.getByText('Set 4 logged · 62.5 × 10')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Undo set 4' }))
    expect(await setGroup('Set 4: 62.5 kg, 10 reps')).toBeInTheDocument()
    expect(screen.getByText('Then 15 s rest and keep going')).toBeInTheDocument()
  })
})

describe('seanca e re: pushimi me tabelën dhe ushtrimin e ri (V58)', () => {
  beforeEach(reset)
  afterEach(() => {
    language.set('sq')
    SESSION_TIMING.tapGuardMs = 0
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('"Ruaj setin 2" te pushimi ruan setin me vlerat e propozuara dhe nis pushimin e ri; prekja e dytë menjëherë nuk ruan', async () => {
    const { sessionId } = await atPhaseOneWeekTwo()
    SESSION_TIMING.tapGuardMs = 450
    const user = userEvent.setup()
    await renderApp()
    for (let rep = 0; rep < 3; rep++) await user.click(await screen.findByRole('button', { name: 'Rrit përsëritjet' }))
    await new Promise((resolve) => setTimeout(resolve, 500))
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
    // Prekja e dytë bie te "Ruaj setin 2" në të njëjtin vend: nuk ruan.
    await user.click(screen.getByRole('button', { name: 'Ruaj setin 2' }))
    expect(screen.getByText('Seti 1 u ruajt · 62,5 × 12')).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 500))
    await user.click(screen.getByRole('button', { name: 'Ruaj setin 2' }))
    expect(screen.getByText('Seti 2 u ruajt · 62,5 × 12')).toBeInTheDocument()
    expect(screen.getByText('Pastaj · seti 3 nga 4')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAccessibleName(/nga 1 minutë e 30 sekonda$/)
    expect(tableText().slice(0, 3)).toEqual(['Seti 1: 62,5 kg × 12, rekord. Prek për ta ndryshuar', 'Seti 2: 62,5 kg × 12. Prek për ta ndryshuar', 'aktiv'])
    await waitFor(async () =>
      expect((await data.store.where('set_logs', 'session_id', sessionId)).map((row) => [row.set_number, row.weight_kg, row.reps]).sort()).toEqual([
        [1, 62.5, 12],
        [2, 62.5, 12],
      ]),
    )
  })

  it('para një ushtrimi tjetër: lëvizja, tempo dhe 3 sinjalet e tij; pa peshë "Ruaj setin" pret ekranin e setit', async () => {
    const { bench, sessionId } = await atPhaseOneWeekTwo()
    const { saveSet } = await import('@/data/training')
    for (const setNumber of [1, 2, 3]) await saveSet(data.store, { sessionId, slot: bench, setNumber, weightKg: 62.5, reps: 10 })
    const user = userEvent.setup()
    await renderApp()
    expect(await setGroup('Seti 4: 62,5 kg, 10 përsëritje')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
    // Rest-pause: 15 s, pastaj segmenti nga pushimi me "Ruaj segmentin".
    expect(screen.getByText('Seti 4 · rest-pause')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj segmentin' }))
    expect(screen.getByText('Segmenti i setit 4 u ruajt · 62,5 × 10 + 3')).toBeInTheDocument()

    // Pushimi para Incline Bench Press (pa histori): karta e ushtrimit të ri, pa tabelë.
    const card = screen.getByRole('region', { name: 'Incline Bench Press' })
    expect(card).toHaveTextContent('Pastaj')
    expect(card).toHaveTextContent('Seti 1 nga 3 · 9–11')
    expect(card).toHaveTextContent('Ushtrim i ri')
    expect(within(card).getByText('Poshtë 2 s · lart 1 s')).toBeInTheDocument()
    expect(within(card).getAllByRole('listitem').map((item) => item.textContent)).toEqual(['1Shpina fort te jastëku', '2Tërhiq shpatullat pas', '3Ule shufrën drejt gjoksit të sipërm'])
    expect(screen.queryByRole('region', { name: 'Setet e ushtrimit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ruaj setin 1' })).not.toBeInTheDocument()
    const [set4] = (await data.store.where('set_logs', 'session_id', sessionId)).filter((row) => row.set_number === 4)
    await waitFor(async () => expect((await data.store.get('set_logs', set4.id))?.segments).toEqual([{ weight_kg: 62.5, reps: 3 }]))
  })

  it('anglisht: pushimi para ushtrimit të ri', async () => {
    language.set('en')
    const { bench, sessionId } = await atPhaseOneWeekTwo()
    const { saveSet } = await import('@/data/training')
    for (const setNumber of [1, 2, 3]) await saveSet(data.store, { sessionId, slot: bench, setNumber, weightKg: 62.5, reps: 10 })
    await saveSet(data.store, { sessionId, slot: bench, setNumber: 4, weightKg: 62.5, reps: 10, technique: 'rest_pause' })
    const user = userEvent.setup()
    await renderApp()
    await user.click(await screen.findByRole('button', { name: 'Log segment' }))
    const card = screen.getByRole('region', { name: 'Incline Bench Press' })
    expect(card).toHaveTextContent('NextIncline Bench PressSet 1 of 3 · 9–11New exercise')
    expect(within(card).getAllByRole('listitem')[0]).toHaveTextContent('Back firmly on the pad')
    expect(screen.getByText('Set 4 segment logged · 62.5 × 10 + 3')).toBeInTheDocument()
  })
})

describe('seanca e re në ditë të lodhur (V50, V58)', () => {
  beforeEach(reset)
  afterEach(() => {
    dayMode.value = 'normal'
    setDayAttribute('normal')
  })

  it('"Ruaj setin" mbetet i vetmi buton me prushin, që në ditë të lodhur bëhet rërë; pa dridhjen e rëndë', async () => {
    await atPhaseOneWeekTwo()
    dayMode.value = 'tired'
    const user = userEvent.setup()
    await renderApp()
    const filled = () => [...document.querySelectorAll('button')].filter((button) => button.className.split(/\s+/).includes('bg-ember')).map((button) => button.textContent)
    expect(await setGroup('Seti 1: 62,5 kg, 9 përsëritje')).toBeInTheDocument()
    // `bg-ember` merr `--sand` nën `:root[data-day="tired"]` (globals.css): një veprim kryesor në ekran.
    await waitFor(() => expect(document.documentElement.dataset.day).toBe('tired'))
    expect(filled()).toEqual(['Ruaj setin'])
    for (let rep = 0; rep < 3; rep++) await user.click(screen.getByRole('button', { name: 'Rrit përsëritjet' }))
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
    // Pushimi: "Ruaj setin 2" i vetmi; "Zhbëj" është tekst prushi (rërë), jo buton i mbushur.
    expect(filled()).toEqual(['Ruaj setin 2'])
    expect(screen.getByRole('button', { name: 'Zhbëj setin 1' })).toHaveClass('text-ember-text')
    // Rekordi në ditë të lodhur: dridhja e lehtë (`recordPulse` e kthen te `savePulse`), banderola mbetet.
    expect(pulses.record).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Rekord i ri')
  })
})
