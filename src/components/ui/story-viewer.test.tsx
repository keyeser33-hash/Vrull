import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { language } from '@/i18n/language'
import { type StoryPage, StoryViewer } from './story-viewer'

// Shikuesi i story-ve (V57, SPEC §0.3f): shiritat, kalimi me prekje dhe rrëshqitje vetëm pa zgjedhje të hapura, "×",
// Escape, fokusi brenda, lexuesi i ekranit, dhe asnjë animacion.

function Host({ pages, onClose, start = 0 }: { pages: StoryPage[]; onClose: () => void; start?: number }) {
  const [index, setIndex] = useState(start)
  return <StoryViewer title="Si ndihesh sot?" subtitle="e hënë, 9 nëntor" counter={`${index + 1} / ${pages.length}`} pages={pages} index={index} onIndex={setIndex} onClose={onClose} />
}

const info = (key: string): StoryPage => ({ key, label: key, children: <p>{`Faqja ${key}`}</p> })
const asking: StoryPage = { key: 'q', label: 'Pyetja', open: true, children: <button type="button">Përgjigje</button> }

afterEach(async () => {
  cleanup()
  await act(() => language.set('sq'))
})

describe('StoryViewer', () => {
  it('shiritat: një për çdo story, i mbushuri për të parat; lexuesi dëgjon "Story 2 nga 3" dhe titullin', () => {
    render(<Host pages={[info('a'), info('b'), info('c')]} onClose={() => undefined} start={1} />)
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuetext', 'Story 2 nga 3: b')
    const fills = [...bar.querySelectorAll('span')].map((span) => span.className.includes('bg-foreground'))
    expect(fills).toEqual([true, true, false])
    expect(screen.getByRole('status')).toHaveTextContent('Story 2 nga 3: b')
    expect(screen.getByText('2 / 3')).toBeInTheDocument()
  })

  it('prekja në gjysmën e djathtë kalon përpara, në të majtën mbrapa; në të fundit mbyll', async () => {
    const onClose = vi.fn()
    render(<Host pages={[info('a'), info('b')]} onClose={onClose} />)
    const area = screen.getByText('Faqja a').parentElement!
    area.getBoundingClientRect = () => ({ left: 0, width: 390, top: 0, right: 390, bottom: 800, height: 800, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.click(area, { clientX: 300 })
    expect(screen.getByText('Faqja b')).toBeInTheDocument()
    const next = screen.getByText('Faqja b').parentElement!
    next.getBoundingClientRect = area.getBoundingClientRect
    fireEvent.click(next, { clientX: 50 })
    expect(screen.getByText('Faqja a')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
    const again = screen.getByText('Faqja a').parentElement!
    again.getBoundingClientRect = area.getBoundingClientRect
    fireEvent.click(again, { clientX: 300 })
    fireEvent.click(screen.getByText('Faqja b').parentElement!, { clientX: 300 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('rrëshqitja majtas kalon përpara, djathtas mbrapa, dhe nuk bën edhe prekje', () => {
    render(<Host pages={[info('a'), info('b'), info('c')]} onClose={() => undefined} start={1} />)
    const area = screen.getByText('Faqja b').parentElement!
    fireEvent.pointerDown(area, { clientX: 300, clientY: 400 })
    fireEvent.pointerUp(area, { clientX: 100, clientY: 410 })
    fireEvent.click(area, { clientX: 100 })
    expect(screen.getByText('Faqja c')).toBeInTheDocument()
    const last = screen.getByText('Faqja c').parentElement!
    fireEvent.pointerDown(last, { clientX: 100, clientY: 400 })
    fireEvent.pointerUp(last, { clientX: 300, clientY: 400 })
    expect(screen.getByText('Faqja b')).toBeInTheDocument()
  })

  it('me zgjedhje të hapura: pa prekje dhe pa rrëshqitje; butoni "Story i mëparshëm" kthen mbrapa', async () => {
    render(<Host pages={[info('a'), asking, info('c')]} onClose={() => undefined} start={1} />)
    const area = screen.getByRole('button', { name: 'Përgjigje' }).parentElement!
    area.getBoundingClientRect = () => ({ left: 0, width: 390, top: 0, right: 390, bottom: 800, height: 800, x: 0, y: 0, toJSON: () => ({}) })
    fireEvent.click(area, { clientX: 300 })
    fireEvent.pointerDown(area, { clientX: 300, clientY: 400 })
    fireEvent.pointerUp(area, { clientX: 50, clientY: 400 })
    fireEvent.keyDown(area, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: 'Përgjigje' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Story i mëparshëm' }))
    expect(screen.getByText('Faqja a')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Story i mëparshëm' })).not.toBeInTheDocument()
  })

  it('prekja e një butoni brenda nuk e kalon story-n', async () => {
    const press = vi.fn()
    render(<Host pages={[{ key: 'x', label: 'x', children: <button type="button" onClick={press}>Hap</button> }, info('b')]} onClose={() => undefined} />)
    await userEvent.click(screen.getByRole('button', { name: 'Hap' }))
    expect(press).toHaveBeenCalled()
    expect(screen.queryByText('Faqja b')).not.toBeInTheDocument()
  })

  it('"×" dhe Escape mbyllin; tastet ← → kalojnë', async () => {
    const onClose = vi.fn()
    render(<Host pages={[info('a'), info('b')]} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowRight' })
    expect(screen.getByText('Faqja b')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'ArrowLeft' })
    expect(screen.getByText('Faqja a')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Mbyll' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('fokusi hyn te dialogu dhe Tab rri brenda', async () => {
    render(
      <>
        <button type="button">Jashtë</button>
        <Host pages={[{ key: 'x', label: 'x', children: <button type="button">Brenda</button> }]} onClose={() => undefined} />
      </>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Mbyll' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Brenda' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Mbyll' })).toHaveFocus()
    await userEvent.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Brenda' })).toHaveFocus()
  })

  it('lëvizja e reduktuar: asnjë klasë animacioni ose tranzicioni te shikuesi (shtypja e butonave është e përbashkët dhe motion-safe)', () => {
    render(<Host pages={[info('a'), info('b')]} onClose={() => undefined} />)
    const classes = [...screen.getByRole('dialog').querySelectorAll(':not(button)')].map((node) => node.getAttribute('class') ?? '').join(' ')
    expect(classes).not.toMatch(/animate-|transition|duration-/)
  })

  it('anglisht', async () => {
    await act(() => language.set('en'))
    render(<Host pages={[info('a'), info('b')]} onClose={() => undefined} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuetext', 'Story 1 of 2: a')
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })
})
