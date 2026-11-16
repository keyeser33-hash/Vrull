import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { language } from '@/i18n/language'
import { ExerciseMotion, ExerciseMotionSheet } from './exercise-motion'

// Lëvizja e ushtrimit (SPEC §0.3g, V58): dy fotot ndërrohen sipas tempos me orë të rreme; rrëshqitja e
// gishtit, prekja, palosja, ekrani i plotë, lëvizja e reduktuar, pa foto dhe anglishtja.

const ID = 'Barbell_Bench_Press_-_Medium_Grip'
const TEMPO = { downS: 2, upS: 1 }

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  act(() => language.set('sq'))
})

function fakeClock() {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
}
const tick = (ms: number) => act(() => void vi.advanceTimersByTime(ms))
const endImage = (container: HTMLElement) => container.querySelector<HTMLImageElement>('img[alt$="fundi i lëvizjes"], img[alt$="end of the movement"]')!
const opacity = (container: HTMLElement) => Number(endImage(container).style.opacity)
const stageOf = () => screen.getByRole('button', { name: /lëvizjen/ })

describe('ExerciseMotion', () => {
  it('dy fotot bardh e zi, fillimi dhe fundi; tempo me fjalë', () => {
    const { container } = render(<ExerciseMotion libraryId={ID} name="Bench Press" tempo={TEMPO} />)
    const start = container.querySelector('img[alt="Bench Press, fillimi i lëvizjes"]')
    expect(start).toHaveAttribute('src', `/exercise-photos/${ID}.jpg`)
    expect(start).toHaveClass('grayscale')
    expect(endImage(container)).toHaveAttribute('src', `/exercise-photos/${ID}-end.jpg`)
    expect(endImage(container)).toHaveClass('grayscale')
    expect(screen.getByText('Poshtë 2 s · lart 1 s')).toBeInTheDocument()
  })

  it('foto e fundit ndërrohet me kalim të butë sipas tempos', () => {
    fakeClock()
    const { container } = render(<ExerciseMotion libraryId={ID} name="Bench Press" tempo={TEMPO} />)
    expect(opacity(container)).toBe(0)
    tick(1000)
    expect(opacity(container)).toBeGreaterThan(0.4)
    expect(opacity(container)).toBeLessThan(0.6)
    tick(1100)
    expect(opacity(container)).toBeCloseTo(1, 1)
    tick(700)
    expect(opacity(container)).toBeGreaterThan(0.4)
    expect(opacity(container)).toBeLessThan(0.6)
    tick(600)
    expect(opacity(container)).toBe(0)
  })

  it('një tempo më e ngadaltë zgjat më shumë', () => {
    fakeClock()
    const { container } = render(<ExerciseMotion libraryId={ID} name="Bench Press" tempo={{ downS: 4, upS: 1 }} />)
    tick(1000)
    expect(opacity(container)).toBeLessThan(0.2)
    expect(screen.getByText('Poshtë 4 s · lart 1 s')).toBeInTheDocument()
  })

  it('prekja e ndal, prekja tjetër e rinis nga aty ku ishte', () => {
    fakeClock()
    const { container } = render(<ExerciseMotion libraryId={ID} name="Bench Press" tempo={TEMPO} />)
    tick(1000)
    fireEvent.pointerDown(stageOf(), { pointerId: 1, clientX: 100 })
    fireEvent.pointerUp(stageOf(), { pointerId: 1, clientX: 100 })
    const held = opacity(container)
    expect(screen.getByRole('button', { name: 'Luaj lëvizjen' })).toBeInTheDocument()
    tick(1500)
    expect(opacity(container)).toBe(held)
    fireEvent.pointerDown(stageOf(), { pointerId: 1, clientX: 100 })
    fireEvent.pointerUp(stageOf(), { pointerId: 1, clientX: 100 })
    tick(500)
    expect(opacity(container)).toBeGreaterThan(held)
  })

  it('rrëshqitja e gishtit e çon nga fillimi te fundi dhe e ndal', () => {
    fakeClock()
    const { container } = render(<ExerciseMotion libraryId={ID} name="Bench Press" tempo={TEMPO} />)
    vi.spyOn(screen.getByRole('button', { name: 'Ndalo lëvizjen' }), 'getBoundingClientRect').mockReturnValue({ width: 300 } as DOMRect)
    const stage = screen.getByRole('button', { name: 'Ndalo lëvizjen' })
    tick(16)
    fireEvent.pointerDown(stage, { pointerId: 1, clientX: 50 })
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 200 })
    expect(opacity(container)).toBeCloseTo(0.5, 1)
    fireEvent.pointerMove(stage, { pointerId: 1, clientX: 400 })
    expect(opacity(container)).toBe(1)
    fireEvent.pointerUp(stage, { pointerId: 1, clientX: 400 })
    tick(2000)
    expect(opacity(container)).toBe(1)
    expect(screen.getByRole('button', { name: 'Luaj lëvizjen' })).toBeInTheDocument()
  })

  it('e palosur është një rresht; prekja e hap; "Palos" e kthen', async () => {
    const user = userEvent.setup()
    const { container } = render(<ExerciseMotion libraryId={ID} name="Bench Press" tempo={TEMPO} foldable defaultFolded />)
    expect(container.querySelector('img[alt$="fundi i lëvizjes"]')).toBeNull()
    expect(screen.getByText('Poshtë 2 s · lart 1 s')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hap lëvizjen' }))
    expect(endImage(container)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Palos lëvizjen' }))
    expect(screen.getByRole('button', { name: 'Hap lëvizjen' })).toBeInTheDocument()
  })

  it('"Zgjero" thërret onExpand; mbajtja (pa tempo) nuk e shfaq tempon', async () => {
    const user = userEvent.setup()
    const onExpand = vi.fn()
    const { rerender } = render(<ExerciseMotion libraryId={ID} name="Bench Press" tempo={TEMPO} onExpand={onExpand} />)
    await user.click(screen.getByRole('button', { name: 'Zgjero' }))
    expect(onExpand).toHaveBeenCalledOnce()
    rerender(<ExerciseMotion libraryId={ID} name="Plank" tempo={TEMPO} showTempo={false} />)
    expect(screen.queryByText(/Poshtë/)).toBeNull()
  })

  it('pa foto (pa ID në bibliotekë) nuk del asgjë', () => {
    const { container } = render(<ExerciseMotion libraryId={null} name="Hip Thrust" tempo={TEMPO} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('anglisht: tempo dhe emrat e kontrolleve', () => {
    act(() => language.set('en'))
    const { container } = render(<ExerciseMotion libraryId={ID} name="Bench Press" tempo={TEMPO} onExpand={() => undefined} />)
    expect(screen.getByText('Down 2 s · up 1 s')).toBeInTheDocument()
    expect(container.querySelector('img[alt="Bench Press, start of the movement"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pause the movement' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand' })).toBeInTheDocument()
  })

  describe('lëvizja e reduktuar', () => {
    beforeEach(() => {
      vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    })

    it('mbetet foto e fillimit me çelësin "Fillimi / Fundi", pa lëvizje', async () => {
      fakeClock()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      const { container } = render(<ExerciseMotion libraryId={ID} name="Bench Press" tempo={TEMPO} />)
      expect(screen.getByText('Lëvizja është e ndalur nga cilësimi i telefonit')).toBeInTheDocument()
      tick(1500)
      expect(opacity(container)).toBe(0)
      expect(screen.queryByRole('button', { name: /lëvizjen/ })).toBeNull()
      expect(screen.getByRole('button', { name: 'Fillimi' })).toHaveAttribute('aria-pressed', 'true')
      await user.click(screen.getByRole('button', { name: 'Fundi' }))
      expect(opacity(container)).toBe(1)
      expect(screen.getByRole('button', { name: 'Fundi' })).toHaveAttribute('aria-pressed', 'true')
      await user.click(screen.getByRole('button', { name: 'Fillimi' }))
      expect(opacity(container)).toBe(0)
    })
  })
})

describe('ExerciseMotionSheet', () => {
  it('ekrani i plotë: rrëshqitësi "Fillimi — Fundi" e ndal lëvizjen dhe vendos foton', () => {
    fakeClock()
    const { baseElement } = render(
      <ExerciseMotionSheet libraryId={ID} name="Bench Press" tempo={TEMPO} onClose={() => undefined}>
        <p>Poshtë sheetit</p>
      </ExerciseMotionSheet>,
    )
    expect(screen.getByRole('dialog', { name: 'Bench Press' })).toBeInTheDocument()
    expect(screen.getByText('Poshtë sheetit')).toBeInTheDocument()
    const slider = screen.getByRole('slider', { name: 'Pozicioni i lëvizjes, nga fillimi te fundi' })
    fireEvent.input(slider, { target: { value: '750' } })
    expect(opacity(baseElement)).toBeCloseTo(0.75, 2)
    tick(1500)
    expect(opacity(baseElement)).toBeCloseTo(0.75, 2)
    expect(screen.getByRole('button', { name: 'Luaj lëvizjen' })).toBeInTheDocument()
  })
})
