import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalDatabase } from '@/data/db'
import type { LocalStore } from '@/data/store'
import { language } from '@/i18n'
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
    useLocalQuery<T>(query: () => Promise<T>) {
      const [value, setValue] = useState<T>()
      useEffect(() => {
        // Si useLocalQuery i vërtetë: një lexim i vjetër nuk mbishkruan një më të ri.
        let started = 0
        let shown = 0
        const run = () => {
          const ticket = ++started
          void query().then((result) => {
            if (ticket < shown) return
            shown = ticket
            setValue(() => result)
          })
        }
        run()
        return store.subscribe(run)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return value
    },
  }
})

const fetchSpy = vi.spyOn(globalThis, 'fetch')

async function reset() {
  await import('@/data/app-data')
  const { completeOnboarding } = await import('@/data/profile')
  // Tabelat zbrazen vërtet: fshirja e butë rresht për rresht linte programet e provave të mëparshme
  // në bazë, dhe çdo lexim i ekranit i kalonte të gjitha (provat ngadalësoheshin një nga një).
  await Promise.all(data.db.tables.map((table) => table.clear()))
  localStorage.clear()
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

  it('seti: "Herën e kaluar", pragu i rekordit dhe rekordi në moment te pushimi', async () => {
    await atPhaseOneWeekTwo()
    const user = userEvent.setup()
    await renderApp()

    expect(await screen.findByRole('heading', { level: 1, name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Ushtrimet e seancës, 1 nga 9 · \d\d:\d\d$/ })).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progresi i seancës' })).toHaveAttribute('aria-valuetext', '0 nga 30 sete')
    expect(screen.getByText('Seti 1 nga 4 · 9–11 përsëritje')).toBeInTheDocument()
    expect(screen.getByText(/^Herën e kaluar/)).toHaveTextContent('Herën e kaluar 60 × 13 · +2,5 kg')
    // Pesha e propozuar e §7: 86,0 / (1 + 11/30) = 62,9 → 62,5; pa RIR te Java 2 e Shortcut to Size.
    expect(await setGroup('Seti 1: 62,5 kg, 9 përsëritje')).toBeInTheDocument()
    expect(screen.queryByText('Sa të kishin mbetur (RIR)')).not.toBeInTheDocument()
    expect(screen.getByText('Seti 4: rest-pause, 15 s pushim')).toBeInTheDocument()
    expect(screen.getByText('12 përsëritje të japin rekord të ri: e1RM 87,5 kg.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Ushtrimi i radhës' })).toHaveTextContent('PastajIncline Bench Press · 3 sete')

    for (let rep = 0; rep < 3; rep++) await user.click(screen.getByRole('button', { name: 'Rrit përsëritjet' }))
    expect(screen.getByRole('group', { name: 'Seti 1: 62,5 kg, 12 përsëritje' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))

    // Rekordi del në moment, te karta e pushimit.
    expect(await screen.findByText('Seti 1 u ruajt: 62,5 × 12')).toBeInTheDocument()
    expect(screen.getByText('Rekord i ri: e1RM 87,5 kg, +1,5 kg')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAccessibleName(/^Pushimi: mbeten 1 minutë e (30|29|28) sekonda nga 1 minutë e 30 sekonda$/)
    expect(screen.getByText('Seti 2 nga 4 · 62,5 × 9–11')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ruaj setin' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Shto 15 sekonda te pushimi' }))
    expect(screen.getByText('nga 1:45')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kapërce' }))

    // Seti 2 mban peshën e setit 1; pragu tani duhet ta kalojë rekordin e ri (87,5).
    expect(await setGroup('Seti 2: 62,5 kg, 12 përsëritje')).toBeInTheDocument()
    expect(screen.getByText('13 përsëritje të japin rekord të ri: e1RM 89,6 kg.')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Progresi i seancës' })).toHaveAttribute('aria-valuetext', '1 nga 30 sete')

    // Kur pragu bie nën intervalin, çdo set i tij jep rekord.
    // 70 kg e kalojnë 87,5 me 8 përsëritje, para 9–11: 70 × 9 jep 91.
    for (let step = 0; step < 3; step++) await user.click(screen.getByRole('button', { name: 'Rrit peshën me 2,5 kg' }))
    expect(screen.getByText('Çdo set në interval jep rekord të ri: e1RM të paktën 91 kg.')).toBeInTheDocument()

    const [saved] = await data.store.all('set_logs').then((rows) => rows.filter((row) => row.reps === 12 && row.weight_kg === 62.5))
    expect(saved).toMatchObject({ set_number: 1, technique: 'none', rir: null })
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
    expect(screen.getByText(/^Herën e kaluar/)).toHaveTextContent('Herën e kaluar 60 × 13 · +5 kg')

    // Prekja e numrit hap tastierën numerike.
    await user.click(screen.getByRole('button', { name: 'Shkruaj përsëritjet, 9' }))
    const sheet = screen.getByRole('dialog', { name: 'Përsëritjet' })
    const input = within(sheet).getByRole('textbox', { name: 'Përsëritjet' })
    await user.clear(input)
    await user.type(input, '11{enter}')
    expect(await setGroup('Seti 1: 65 kg, 11 përsëritje')).toBeInTheDocument()

    // Lista e ushtrimeve: pulpat kanë histori pa e1RM (30 përsëritje), ndaj marrin peshën e fundit.
    await user.click(screen.getByRole('button', { name: /^Ushtrimet e seancës/ }))
    const list = screen.getByRole('dialog', { name: 'Ushtrimet e sotme' })
    expect(within(list).getByText('0 nga 30 sete', { exact: false })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: /^Bench Press/ })).toHaveAttribute('aria-current', 'step')
    expect(within(list).getByText('Tani: seti 1 nga 4 · 9–11')).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'Ndrysho ushtrimin' })).toBeInTheDocument()
    expect(within(list).getByText('Mbetën 30 sete. Setet e bëra ruhen kur e mbyll.')).toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: /^Standing Calf Raise/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Standing Calf Raise' })).toBeInTheDocument()
    expect(await setGroup('Seti 1: 70 kg, 15 përsëritje')).toBeInTheDocument()
    expect(screen.getByText(/^Herën e kaluar/)).toHaveTextContent('Herën e kaluar 70 × 30')
    expect(screen.queryByText(/rekord të ri/)).not.toBeInTheDocument()
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
    expect(await screen.findByText('Rekord i ri: e1RM 87,5 kg, +1,5 kg')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kapërce' }))
    for (const setNumber of [2, 3, 4]) {
      await setGroup(`Seti ${setNumber}: 62,5 kg, 12 përsëritje`)
      await user.click(screen.getByRole('button', { name: 'Ruaj setin' }))
      if (setNumber < 4) await user.click(await screen.findByRole('button', { name: 'Kapërce' }))
    }
    // Seti 4 me rest-pause: 15 s pushim, pastaj segmenti në të njëjtin set.
    expect(await screen.findByText('nga 0:15')).toBeInTheDocument()
    expect(await screen.findByText('Seti 4 nga 4 · rest-pause, deri në dështim')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Kapërce' }))
    expect(await screen.findByText('Seti 4 nga 4 · rest-pause, deri në dështim')).toBeInTheDocument()
    expect(await setGroup('Seti 4: 62,5 kg, 4 përsëritje')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ruaj segmentin' }))
    expect(await screen.findByText('Seti 4 u ruajt: 62,5 × 12 + 4')).toBeInTheDocument()
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
    expect(screen.queryByText(/rekord të ri/)).not.toBeInTheDocument()
    const rir = screen.getByRole('group', { name: 'Sa të kishin mbetur (RIR)' })
    expect(within(rir).getByRole('button', { name: '2', pressed: true })).toBeInTheDocument()
    await user.click(within(rir).getByRole('button', { name: '3' }))
    await user.click(screen.getByRole('button', { name: 'Shkruaj peshën, 0 kg' }))
    const input = within(screen.getByRole('dialog', { name: 'Pesha, kg' })).getByRole('textbox', { name: 'Pesha, kg' })
    await user.clear(input)
    await user.type(input, '47,5')
    await user.click(within(screen.getByRole('dialog', { name: 'Pesha, kg' })).getByRole('button', { name: 'Ruaj' }))
    await user.click(await screen.findByRole('button', { name: 'Ruaj setin' }))
    // Seti i parë i ushtrimit nuk është rekord.
    expect(await screen.findByText('Seti 1 u ruajt: 47,5 × 12')).toBeInTheDocument()
    expect(screen.queryByText(/Rekord i ri/)).not.toBeInTheDocument()
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
    expect(screen.getByText('Seti 4: drop set te 50 kg')).toBeInTheDocument()
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
    expect(screen.getByText(/^Last time/)).toHaveTextContent('Last time 60 × 13 · +2.5 kg')
    expect(await setGroup('Set 1: 62.5 kg, 9 reps')).toBeInTheDocument()
    expect(screen.getByText('Set 4: rest-pause, 15 s rest')).toBeInTheDocument()
    expect(screen.getByText('Hit 12 reps for a new personal best: e1RM 87.5 kg.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Next exercise' })).toHaveTextContent('NextIncline Bench Press · 3 sets')
    expect(screen.getByRole('button', { name: 'Muscles worked' })).toBeInTheDocument()

    for (let rep = 0; rep < 3; rep++) await user.click(screen.getByRole('button', { name: 'Increase reps' }))
    await user.click(screen.getByRole('button', { name: 'Log set' }))
    expect(await screen.findByText('Set 1 logged: 62.5 × 12')).toBeInTheDocument()
    expect(screen.getByText('New personal best: e1RM 87.5 kg, +1.5 kg')).toBeInTheDocument()
    expect(screen.getByText('Set 2 of 4 · 62.5 × 9–11')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveAccessibleName(/^Rest: 1 minute (30|29|28) seconds left of 1 minute 30 seconds$/)
    expect(screen.getByRole('button', { name: 'Take 15 seconds off the rest' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Skip' }))

    await user.click(await screen.findByRole('button', { name: /^Session exercises/ }))
    const list = screen.getByRole('dialog', { name: 'Today’s exercises' })
    expect(within(list).getByText('Now: set 2 of 4 · 9–11')).toBeInTheDocument()
    expect(within(list).getByText('Set 1: 62.5 kg × 12')).toBeInTheDocument()
    expect(within(list).getByText('29 sets left. Logged sets are kept when you finish.')).toBeInTheDocument()
    await user.click(within(list).getByRole('button', { name: 'Finish workout' }))
    await user.click(within(list).getByRole('button', { name: 'Yes, finish' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'New personal best' })).toBeInTheDocument()
    expect(screen.getByText('Phase 1 · Week 2 · Workout 1')).toBeInTheDocument()
    expect(screen.getByText('Bench Press · set 1: 62.5 × 12')).toBeInTheDocument()
    expect(screen.getByText('+1.5 kg on your previous best')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: '1 working set' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument()
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
