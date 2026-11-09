import { render, renderHook, waitFor } from '@testing-library/react'
import { setDayAttribute } from '@/lib/day-mode'
import { useGoalCelebration, useSpark } from './goal-motion'
import { useRecordBurst } from './session-motion'

// Ditë e lodhur (V50, DESIGN.md › Lëvizja): 360 ms pa kërcim, pa festime. Normalja mbetet 600 ms me `ease-vrull`.
const device = vi.hoisted(() => ({ saved: undefined as unknown, writes: 0 }))
vi.mock('@/data/app-data', () => ({
  store: {
    readDevice: async () => device.saved,
    writeDevice: async (_: string, value: unknown) => {
      device.saved = value
      device.writes++
    },
  },
}))

const animate = vi.fn()

function Burst() {
  const { sparks, number } = useRecordBurst<HTMLDivElement, HTMLSpanElement>()
  return (
    <div>
      <div ref={sparks} data-testid="sparks" />
      <span ref={number} data-testid="number" />
    </div>
  )
}

function Ring() {
  const ref = useSpark<HTMLSpanElement>()
  return <span ref={ref} />
}

describe('lëvizja e ditës së lodhur', () => {
  beforeEach(() => {
    animate.mockReset()
    Element.prototype.animate = animate as unknown as Element['animate']
    device.saved = undefined
    device.writes = 0
  })
  afterEach(() => setDayAttribute('normal'))

  it('rekordi: normalisht shkëndijat 600 ms, në ditë të lodhur vetëm numri, 360 ms ease-out', () => {
    render(<Burst />)
    expect(animate.mock.calls.map(([, options]) => options.duration)).toEqual([600, 320])
    animate.mockReset()
    setDayAttribute('tired')
    render(<Burst />)
    expect(animate).toHaveBeenCalledTimes(1)
    expect(animate.mock.calls[0][1]).toMatchObject({ duration: 360, easing: 'ease-out' })
  })

  it('unaza e qëllimit nuk vizatohet në ditë të lodhur', () => {
    setDayAttribute('tired')
    render(<Ring />)
    expect(animate).not.toHaveBeenCalled()
    setDayAttribute('normal')
    render(<Ring />)
    expect(animate).toHaveBeenCalledTimes(1)
  })

  it('festimi i qëllimit: normalisht del, në ditë të lodhur jo (por shënohet i festuar)', async () => {
    const normal = renderHook(() => useGoalCelebration('2026-11-02', ['workouts']))
    await waitFor(() => expect([...normal.result.current]).toEqual(['workouts']))
    normal.unmount()

    device.saved = undefined
    setDayAttribute('tired')
    const tired = renderHook(() => useGoalCelebration('2026-11-02', ['workouts']))
    await waitFor(() => expect(device.writes).toBe(2))
    expect([...tired.result.current]).toEqual([])
    expect(device.saved).toMatchObject({ monday: '2026-11-02', keys: ['workouts'] })
  })
})
