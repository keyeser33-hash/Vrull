import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import { currentI18n } from '@/i18n'
import { mealName } from '@/i18n/domain'
import { language } from '@/i18n/language'
import { canMoveMeal, rhythmOf } from '@/today/rhythm'

// Ritmi i ditës te Sot (V57, SPEC §0.3f; bordet "Sot", "Sot · Rreshqit", "Sot · Lëviz"): vija nga zgjimi te gjumi, prekja,
// flluska e rrëshqitjes dhe lëvizja e një vakti që vjen me shtypje të gjatë. Sot është e diela 8 nëntor 2026, 10:00.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore, clock: new Date(2026, 10, 8, 10, 0) }))

vi.mock('@/data/app-data', async () => {
  const store = new Proxy({} as LocalStore, {
    get: (_, key: keyof LocalStore) => {
      const value = data.store[key]
      return typeof value === 'function' ? value.bind(data.store) : value
    },
  })
  return { store, useLocalQuery: (await import('@/test/local-query')).useLocalQueryFor(store) }
})

const USER = '11111111-1111-4111-8111-111111111111'
const at = (day: number, month: number, hours = 10, minutes = 0) => new Date(2026, month - 1, day, hours, minutes)
const PROFILE = { weightKg: 80, trainingDays: [7, 1, 2, 4], trainingTime: '17:15', wakeTime: '07:00', sleepTime: '23:00' }
const WIDTH = 358
const PAD = 12

async function setup(clock = at(8, 11)) {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  data.clock = at(25, 10, 9)
  data.store = createLocalStore(createDatabase(`day-rhythm-${crypto.randomUUID()}`), { userId: () => USER, now: () => data.clock })
  const { completeOnboarding } = await import('@/data/profile')
  await completeOnboarding(data.store, PROFILE, () => data.clock)
  data.clock = clock
  return data.store
}

async function renderRhythm() {
  const { useLocalQuery, store } = await import('@/data/app-data')
  const { todayView, isTrainingMode } = await import('@/data/today')
  const { DayRhythm } = await import('./day-rhythm')
  const views: Awaited<ReturnType<typeof todayView>>[] = []
  function Host() {
    const view = useLocalQuery(() => todayView(store), [])
    if (view) views[0] = view
    return view ? <DayRhythm view={view} /> : null
  }
  const router = createMemoryRouter(
    [
      { path: '/', element: <Host /> },
      { path: '/ushqimi', element: <h1>Ushqimi</h1> },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
  const region = await screen.findByRole('region', { name: /^(Ritmi i ditës|Your day)/ })
  const area = region.querySelector<HTMLElement>('.touch-pan-y')!
  area.getBoundingClientRect = () => ({ left: 0, right: WIDTH, top: 0, bottom: 56, width: WIDTH, height: 56, x: 0, y: 0, toJSON: () => ({}) })
  // Pikat e ritmit nga e njëjta logjikë, që prova të gjejë ku të prekë.
  const view = views[0]
  const rhythm = rhythmOf({
    wakeTime: view.wakeTime,
    sleepTime: view.sleepTime,
    meals: view.meals,
    workout: isTrainingMode(view) || view.mode === 'done' ? { time: view.trainingTime, done: view.mode === 'done' } : null,
    nowMinutes: view.nowMinutes,
  })
  const xOf = (fraction: number) => PAD + fraction * (WIDTH - PAD * 2)
  return { router, region, area, rhythm, xOf }
}

const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', element: Element, x: number) => fireEvent[type](element, { pointerId: 1, pointerType: 'touch', clientX: x, clientY: 28, button: 0 })

describe('ritmi i ditës te Sot', () => {
  afterEach(async () => {
    cleanup()
    await act(() => language.set('sq'))
  })

  it('vija e ditës: butonat për lexuesin e ekranit, vakti i radhës dhe gjumi; prekja e një vakti hap Ushqimin', async () => {
    const user = userEvent.setup()
    await setup()
    const { router, region, rhythm } = await renderRhythm()
    expect(rhythm.points.some((point) => point.kind === 'workout')).toBe(true)
    const buttons = within(region).getAllByRole('button')
    expect(buttons).toHaveLength(rhythm.points.length)
    expect(within(region).getByRole('button', { name: 'Stërvitja, 17:15' })).toBeInTheDocument()
    const next = rhythm.next!
    expect(region).toHaveTextContent(/I radhës: .+ · \d\d:\d\d · pas (\d+ orë)?( ?\d+ min)?/)
    expect(region).toHaveTextContent('Gjumi 23:00')
    expect(region).toHaveTextContent('Tani, 10:00')
    await user.click(buttons.find((button) => button.textContent === `${mealName(currentI18n().t, next.id as never)}, ${next.time}`)!)
    await waitFor(() => expect(router.state.location.pathname).toBe('/ushqimi'))
    expect(router.state.location.search).toBe(`?vakti=${next.id}`)
  })

  it('rrëshqitja jep flluskën me vaktin e pikës më të afërt dhe nuk lëviz asgjë; prekja e pikës hap vaktin', async () => {
    await setup()
    const { area, rhythm, xOf, router } = await renderRhythm()
    const meal = rhythm.points.find((point) => point.kind === 'meal' && point.done === false)!
    pointer('pointerDown', area, xOf(0.9))
    pointer('pointerMove', area, xOf(0.9) - 20)
    pointer('pointerMove', area, xOf(meal.fraction))
    pointer('pointerUp', area, xOf(meal.fraction))
    expect(await screen.findByText('Prek për ta hapur')).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`^${meal.time} · `))).toBeInTheDocument()
    expect(screen.getByText('Pa regjistrim')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    // Prekje e shkurtër mbi një pikë: hapet vakti.
    pointer('pointerDown', area, xOf(meal.fraction))
    pointer('pointerUp', area, xOf(meal.fraction))
    await waitFor(() => expect(router.state.location.pathname).toBe('/ushqimi'))
  })

  it('shtypja e gjatë lëviz një vakt që vjen; vaktet e zakonshme pas tij lëvizin bashkë me të, ato para dhe pas stërvitjes jo', async () => {
    const store = await setup()
    const { area, rhythm, xOf } = await renderRhythm()
    const before = new Map(rhythm.points.map((point) => [point.id, point.time]))
    const dragged = rhythm.points.find((point) => canMoveMeal(point, rhythm.nowMinutes))!
    const target = dragged.minutes + 30
    const targetFraction = (target - rhythm.startMinutes) / (rhythm.endMinutes - rhythm.startMinutes)
    pointer('pointerDown', area, xOf(dragged.fraction))
    await act(() => new Promise((resolve) => setTimeout(resolve, 480)))
    pointer('pointerMove', area, xOf(targetFraction))
    expect(await screen.findByText('Lësho për ta ruajtur vetëm për sot')).toBeInTheDocument()
    expect(screen.getByText(/→/)).toBeInTheDocument()
    pointer('pointerUp', area, xOf(targetFraction))
    const { todayView } = await import('@/data/today')
    await waitFor(async () => {
      const meals = (await todayView(store)).meals
      expect(meals.find((meal) => meal.meal === dragged.id)?.time).not.toBe(before.get(dragged.id))
    })
    const after = (await todayView(store)).meals
    const moved = after.find((meal) => meal.meal === dragged.id)!
    expect(moved.minutes - dragged.minutes).toBeGreaterThanOrEqual(25)
    // Vaktet para stërvitjes, pas saj dhe para gjumit nuk lëvizin.
    for (const fixed of ['pre_workout', 'post_workout', 'bedtime'] as const) {
      expect(after.find((meal) => meal.meal === fixed)?.time).toBe(before.get(fixed))
    }
    expect(await screen.findByText(/lëvizi në \d\d:\d\d për sot$/)).toBeInTheDocument()
    // Vetëm sot (V64): nesër vakti mbetet në orën e planit.
    const { mealPlanOn, readSchedule } = await import('@/data/schedule-settings')
    const plan = (await readSchedule(store)).plan
    expect(mealPlanOn(plan, '2026-11-09').times[dragged.id as keyof typeof plan.times]).toBeUndefined()
  })

  it('një vakt i ngrënë ose stërvitja nuk lëvizin: shtypja e gjatë nuk ndryshon orarin', async () => {
    const store = await setup()
    const { area, rhythm, xOf } = await renderRhythm()
    const workout = rhythm.points.find((point) => point.kind === 'workout')!
    pointer('pointerDown', area, xOf(workout.fraction))
    await act(() => new Promise((resolve) => setTimeout(resolve, 480)))
    pointer('pointerMove', area, xOf(workout.fraction + 0.05))
    pointer('pointerUp', area, xOf(workout.fraction + 0.05))
    expect(screen.queryByText('Lësho për ta ruajtur vetëm për sot')).not.toBeInTheDocument()
    const { todayView } = await import('@/data/today')
    expect((await todayView(store)).meals.map((meal) => meal.time)).toEqual(rhythm.points.filter((point) => point.kind === 'meal').map((point) => point.time))
  })

  it('anglisht: emrat e vakteve dhe teksti i radhës', async () => {
    await setup()
    await act(() => language.set('en'))
    const { region } = await renderRhythm()
    expect(region).toHaveAccessibleName('Your day, from 07:00 to 23:00')
    expect(region).toHaveTextContent(/Next: .+ · \d\d:\d\d · in/)
    expect(region).toHaveTextContent('Sleep 23:00')
    expect(within(region).getByRole('button', { name: 'Workout, 17:15' })).toBeInTheDocument()
  })
})
