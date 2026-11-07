import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { ProfileSection } from './settings-profile'

// Store i vërtetë me një përdorues dhe një useLocalQuery i thjeshtë që rifreskohet pas shkrimeve.
const data = vi.hoisted(() => ({ store: null as unknown }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`settings-profile-${crypto.randomUUID()}`), {
    userId: () => '11111111-1111-4111-8111-111111111111',
  })
  data.store = store
  return {
    store,
    useLocalQuery<T>(query: () => Promise<T>) {
      const [value, setValue] = useState<T>()
      useEffect(() => {
        const run = () => void query().then((result) => setValue(() => result))
        run()
        return store.subscribe(run)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return value
    },
  }
})

type Store = Parameters<typeof import('@/data/profile').readProfile>[0]

describe('profili te cilësimet', () => {
  beforeAll(async () => {
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store as Store, {
      weightKg: 80.5,
      trainingDays: [1, 2, 4, 5],
      trainingTime: '18:00',
      wakeTime: '07:00',
      sleepTime: '23:00',
    })
  })

  it('tregon vlerat e hyrjes së parë', async () => {
    render(<ProfileSection />)
    expect(await screen.findByLabelText('Pesha e sotme (kg)')).toHaveValue('80,5')
    expect(screen.getByRole('button', { name: 'E enjte' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Ora e stërvitjes')).toHaveValue('18:00')
    expect(screen.getByLabelText('Zgjimi')).toHaveValue('07:00')
    expect(screen.getByLabelText('Gjumi')).toHaveValue('23:00')
  })

  it('çdo ndryshim ruhet menjëherë', async () => {
    const { readProfile } = await import('@/data/profile')
    const user = userEvent.setup()
    render(<ProfileSection />)
    const weight = await screen.findByLabelText('Pesha e sotme (kg)')
    await user.clear(weight)
    await user.type(weight, '79,8{enter}')
    await user.click(screen.getByRole('button', { name: 'E shtunë' }))

    await vi.waitFor(async () =>
      expect(await readProfile(data.store as Store)).toMatchObject({ weightKg: 79.8, trainingDays: [1, 2, 4, 5, 6] }),
    )
  })

  it('pesha e pavlefshme nuk ruhet dhe e thotë nën fushë', async () => {
    const { readProfile } = await import('@/data/profile')
    const user = userEvent.setup()
    render(<ProfileSection />)
    const weight = await screen.findByLabelText('Pesha e sotme (kg)')
    const before = (await readProfile(data.store as Store)).weightKg
    await user.clear(weight)
    await user.type(weight, '3{enter}')
    expect(weight).toHaveAttribute('aria-invalid', 'true')
    expect(weight).toHaveAccessibleDescription(/mes 30 dhe 300 kg/)
    expect((await readProfile(data.store as Store)).weightKg).toBe(before)
  })
})
