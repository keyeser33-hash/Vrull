import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect, useState } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { LocalStore } from '@/data/store'
import type { ExternalFood } from '@/nutrition/off'

// Shto ushqim me store të vërtetë; Open Food Facts zëvendësohet me përgjigje të njohura.
const data = vi.hoisted(() => ({ store: null as unknown as LocalStore }))
const off = vi.hoisted(() => ({ search: vi.fn(), product: vi.fn(), usda: vi.fn().mockResolvedValue([]) }))
vi.mock('@/nutrition/off', async (original) => ({ ...(await original<object>()), offSearch: off.search, offProduct: off.product }))
const scanner = vi.hoisted(() => ({ native: false, scan: vi.fn() }))
vi.mock('@/lib/barcode-native', () => ({ canScanBarcode: () => scanner.native, scanBarcode: scanner.scan }))
vi.mock('@/data/app-data', async () => {
  const { createDatabase } = await import('@/data/db')
  const { createLocalStore } = await import('@/data/store')
  const store = createLocalStore(createDatabase(`add-food-${crypto.randomUUID()}`), { userId: () => '11111111-1111-4111-8111-111111111111' })
  data.store = store
  return {
    store,
    searchUsda: off.usda,
    useLocalQuery<T>(query: () => Promise<T>, deps: unknown[] = []) {
      const [value, setValue] = useState<T>()
      useEffect(() => {
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
      }, deps)
      return value
    },
  }
})

const NUTELLA: ExternalFood = {
  source: 'off',
  sourceId: '3017620422003',
  name: 'Nutella',
  brand: 'Ferrero',
  kcal: 539,
  proteinG: 6.3,
  carbsG: 57.5,
  fatG: 30.9,
  fiberG: 0,
  servingG: 15,
  servingLabel: '15 g',
}

async function renderPage() {
  const { AddFoodPage } = await import('./add-food')
  const router = createMemoryRouter([{ path: '/ushqimi/shto/:meal', element: <AddFoodPage /> }], { initialEntries: ['/ushqimi/shto/lunch'] })
  render(<RouterProvider router={router} />)
  return router
}

const entries = async () => (await data.store.all('diary_entries')).map((row) => [row.meal, row.grams, Math.round(Number(row.kcal))])

describe('Shto ushqim', () => {
  beforeAll(async () => {
    await import('@/data/app-data')
    const { completeOnboarding } = await import('@/data/profile')
    await completeOnboarding(data.store, { weightKg: 80, trainingDays: [1, 2, 4, 5], trainingTime: '18:00', wakeTime: '07:00', sleepTime: '23:00' })
  })

  it('ushqim i ri me porcion: fleta e sasisë dhe shtimi te vakti', async () => {
    const user = userEvent.setup()
    await renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: 'Shto te Dreka' })).toBeInTheDocument()
    expect(screen.getByText('Ushqimet që regjistron dalin këtu, edhe pa internet.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ushqim i ri' }))
    const sheet = screen.getByRole('dialog', { name: 'Ushqim i ri' })
    await user.type(within(sheet).getByLabelText('Emri'), 'Bukë e zezë')
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj ushqimin' }))
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Shkruaj kcal dhe makrot për 100 g, si numra.')
    for (const [label, value] of [['Kcal', '250'], ['Proteina, g', '9'], ['Karbohidrate, g', '45'], ['Yndyrë, g', '3,5'], ['Një porcion, g', '40']]) {
      await user.type(within(sheet).getByLabelText(label), value)
    }
    await user.click(within(sheet).getByRole('button', { name: 'Ruaj ushqimin' }))

    const amount = await screen.findByRole('dialog', { name: 'Bukë e zezë' })
    expect(within(amount).getByLabelText('Sasia')).toHaveValue('40')
    expect(within(amount).getByText('100 kcal')).toBeInTheDocument()
    await user.click(within(amount).getByRole('button', { name: '5 g më shumë' }))
    await user.click(within(amount).getByRole('button', { name: '5 g më shumë' }))
    await user.click(within(amount).getByRole('button', { name: 'Shto te Dreka' }))
    expect(await screen.findByRole('status')).toHaveTextContent('U shtua: Bukë e zezë, 50 g')
    expect(await entries()).toEqual([['lunch', 50, 125]])
    expect(screen.getByRole('button', { name: /^Bukë e zezë/ })).toBeInTheDocument()
  })

  it('kërkimi: ushqimet e tua dhe Open Food Facts; produkti ruhet dhe shtohet me porcionin', async () => {
    const user = userEvent.setup()
    off.search.mockResolvedValue([NUTELLA])
    off.usda.mockResolvedValue([{ ...NUTELLA, source: 'usda', sourceId: '171477', name: 'Hazelnuts, raw', brand: null, servingG: null, servingLabel: null }])
    await renderPage()
    await user.type(await screen.findByLabelText('Kërko ushqimin'), 'zez')
    expect(await screen.findByRole('region', { name: 'Ushqimet e tua' })).toHaveTextContent('Bukë e zezë')
    await user.type(screen.getByLabelText('Kërko ushqimin'), '{Backspace>3}nutella')
    const results = await screen.findByRole('region', { name: 'Open Food Facts' }, { timeout: 3000 })
    expect(off.search).toHaveBeenLastCalledWith('nutella', expect.any(AbortSignal))
    expect(await screen.findByRole('region', { name: 'USDA · ushqime të përgjithshme' })).toHaveTextContent('Hazelnuts, raw')
    expect(off.usda).toHaveBeenLastCalledWith('nutella')
    await user.click(within(results).getByRole('button', { name: /^Nutella/ }))
    const amount = await screen.findByRole('dialog', { name: 'Nutella' })
    expect(within(amount).getByLabelText('Sasia')).toHaveValue('15')
    await user.click(within(amount).getByRole('button', { name: 'Shto te Dreka' }))
    await waitFor(async () => expect(await entries()).toContainEqual(['lunch', 15, 81]))
  })

  it('barkodi: produkti i gjetur hapet në fletën e sasisë; ai që mungon shtohet si ushqim i ri', async () => {
    const user = userEvent.setup()
    off.product.mockResolvedValueOnce({ ...NUTELLA, sourceId: '8000500310427', name: 'Kinder Bueno', servingG: 21.5, servingLabel: '1 bar' })
    await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Kërko me barkod' }))
    let sheet = screen.getByRole('dialog', { name: 'Barkodi' })
    await user.type(within(sheet).getByLabelText('Shifrat poshtë vijave'), '123')
    await user.click(within(sheet).getByRole('button', { name: 'Kërko' }))
    expect(within(sheet).getByRole('alert')).toHaveTextContent('Shkruaj të gjitha shifrat')
    await user.clear(within(sheet).getByLabelText('Shifrat poshtë vijave'))
    await user.type(within(sheet).getByLabelText('Shifrat poshtë vijave'), '8000500310427{Enter}')
    expect(off.product).toHaveBeenCalledWith('8000500310427')
    const amount = await screen.findByRole('dialog', { name: 'Kinder Bueno' })
    expect(within(amount).getByRole('button', { name: '1 porcion (1 bar)' })).toBeInTheDocument()
    await user.click(within(amount).getByRole('button', { name: 'Mbyll' }))

    off.product.mockResolvedValueOnce(null)
    await user.click(screen.getByRole('button', { name: 'Kërko me barkod' }))
    sheet = screen.getByRole('dialog', { name: 'Barkodi' })
    await user.type(within(sheet).getByLabelText('Shifrat poshtë vijave'), '1234567890123{Enter}')
    await user.click(await within(sheet).findByRole('button', { name: 'Shto si ushqim të ri' }))
    expect(screen.getByRole('dialog', { name: 'Ushqim i ri' })).toBeInTheDocument()
  })

  it('skaneri në telefon: kodi i skanuar kërkohet vetë; herën e parë moduli shkarkohet', async () => {
    const user = userEvent.setup()
    scanner.native = true
    off.product.mockResolvedValueOnce({ ...NUTELLA, sourceId: '5449000000996', name: 'Coca-Cola', servingG: 330, servingLabel: '1 kanoçe' })
    scanner.scan.mockResolvedValueOnce({ state: 'installing' }).mockResolvedValueOnce({ state: 'found', code: '5449000000996' })
    await renderPage()
    await user.click(await screen.findByRole('button', { name: 'Kërko me barkod' }))
    const sheet = screen.getByRole('dialog', { name: 'Barkodi' })
    await user.click(within(sheet).getByRole('button', { name: 'Skano me kamerë' }))
    expect(await within(sheet).findByRole('alert')).toHaveTextContent('Skaneri po shkarkohet nga Google Play')
    await user.click(within(sheet).getByRole('button', { name: 'Skano me kamerë' }))
    expect(await screen.findByRole('dialog', { name: 'Coca-Cola' })).toBeInTheDocument()
    expect(off.product).toHaveBeenLastCalledWith('5449000000996')
    scanner.native = false
  })
})
