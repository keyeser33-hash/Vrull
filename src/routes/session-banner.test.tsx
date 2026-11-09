import { act, fireEvent, render, screen } from '@testing-library/react'
import { language } from '@/i18n'
import { type BannerRecord, RecordBanner } from './session-banner'

// Banderola e rekordit (SPEC §0.3c, V2-E2-21, E2-23): teksti në të dyja gjuhët, "Mbyll", 3 s në ekran,
// zbritja 250 ms dhe, me "lëvizje të reduktuar", vetëm zbehja 120 ms pa rrëshqitje. Web Animations
// imitohen, sepse jsdom nuk i ka.

const record: BannerRecord = { id: 'set-1', exercise: 'Bench Press', e1rmKg: 87.5, gainKg: 1.5 }

type Call = { keyframes: Keyframe[]; options: KeyframeAnimationOptions; animation: { onfinish: (() => void) | null; oncancel: (() => void) | null } }
let calls: Call[] = []

function stubMotion(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduced && query.includes('reduce'), addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  calls = []
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value(keyframes: Keyframe[], options: KeyframeAnimationOptions) {
      const animation = { onfinish: null, oncancel: null }
      calls.push({ keyframes, options, animation })
      return animation
    },
  })
}

afterEach(() => {
  language.set('sq')
  vi.useRealTimers()
  vi.unstubAllGlobals()
  delete (HTMLElement.prototype as { animate?: unknown }).animate
})

describe('banderola e rekordit', () => {
  it('"Rekord i ri", ushtrimi, e1RM-ja dhe shtesa; "Mbyll" (44 px) e heq', () => {
    const onDone = vi.fn()
    render(<RecordBanner banner={record} onDone={onDone} />)
    expect(screen.getByRole('status')).toHaveTextContent('Rekord i riBench Press · e1RM 87,5 kg +1,5 kg')
    const close = screen.getByRole('button', { name: 'Mbyll njoftimin e rekordit' })
    expect(close).toHaveClass('size-touch')
    fireEvent.click(close)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('në anglisht', () => {
    language.set('en')
    render(<RecordBanner banner={{ ...record, e1rmKg: 89.6, gainKg: 2.1 }} onDone={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('New personal bestBench Press · e1RM 89.6 kg +2.1 kg')
    expect(screen.getByRole('button', { name: 'Dismiss personal best' })).toBeInTheDocument()
  })

  it('pa banderolë rajoni mbetet bosh, që lexuesi i ekranit ta lexojë kur hyn', () => {
    render(<RecordBanner banner={null} onDone={vi.fn()} />)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('zbret në 250 ms, rri 3 s dhe ngjitet përsëri', () => {
    vi.useFakeTimers()
    stubMotion(false)
    const onDone = vi.fn()
    render(<RecordBanner banner={record} onDone={onDone} />)
    expect(calls).toHaveLength(1)
    expect(calls[0].keyframes).toEqual([{ transform: 'translateY(-120%)' }, { transform: 'translateY(0)' }])
    expect(calls[0].options.duration).toBe(250)
    act(() => void vi.advanceTimersByTime(3249))
    expect(calls).toHaveLength(1)
    act(() => void vi.advanceTimersByTime(1))
    expect(calls).toHaveLength(2)
    expect(calls[1].keyframes).toEqual([{ transform: 'translateY(0)' }, { transform: 'translateY(-120%)' }])
    expect(onDone).not.toHaveBeenCalled()
    act(() => calls[1].animation.onfinish?.())
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('me "lëvizje të reduktuar" nuk rrëshqet: shfaqet dhe zbehet në 120 ms', () => {
    vi.useFakeTimers()
    stubMotion(true)
    const onDone = vi.fn()
    render(<RecordBanner banner={record} onDone={onDone} />)
    expect(calls[0].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }])
    expect(calls[0].options.duration).toBe(120)
    fireEvent.click(screen.getByRole('button', { name: 'Mbyll njoftimin e rekordit' }))
    expect(calls[1].keyframes).toEqual([{ opacity: 1 }, { opacity: 0 }])
    expect(calls[1].options.duration).toBe(120)
    expect(calls.flatMap((call) => call.keyframes).some((frame) => 'transform' in frame)).toBe(false)
    act(() => calls[1].animation.onfinish?.())
    // Koha e banderolës nuk e mbyll dy herë.
    act(() => void vi.advanceTimersByTime(5000))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
