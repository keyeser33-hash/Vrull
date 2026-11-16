import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { language } from '@/i18n/language'
import { type ChosenVideo, chosenVideo, curatedVideos } from '@/program/exercise-videos'
import { clock } from '@/lib/clock'
import { ExerciseVideoSheet, MoreVideos, WatchVideoButton } from './exercise-video'

// Videoja e ushtrimit (SPEC §0.3g, §12): brenda app-it me youtube-nocookie dhe sekondën e nisjes, pa
// internet e thotë, lidhja e përdoruesit ka përparësi, "Më shumë video" hapen në YouTube.

const BENCH = { libraryId: 'Barbell_Bench_Press_-_Medium_Grip', name: 'Bench Press' }

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}

afterEach(() => {
  vi.restoreAllMocks()
  act(() => language.set('sq'))
})

describe('clock', () => {
  it('kohëzgjatja si e tregon player-i', () => {
    expect(clock(25)).toBe('0:25')
    expect(clock(442)).toBe('7:22')
    expect(clock(3730)).toBe('1:02:10')
  })
})

describe('WatchVideoButton', () => {
  it('"Shiko videon" me autorin dhe kohëzgjatjen; lidhja e përdoruesit e thotë', async () => {
    const onOpen = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<WatchVideoButton chosen={chosenVideo(BENCH, null)!} onOpen={onOpen} />)
    expect(screen.getByText('NASM · 0:25')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Shiko videon/ }))
    expect(onOpen).toHaveBeenCalledOnce()
    rerender(<WatchVideoButton chosen={chosenVideo(BENCH, 'https://youtu.be/dQw4w9WgXcQ')!} onOpen={onOpen} />)
    expect(screen.getByText('Lidhja që shtove')).toBeInTheDocument()
  })

  it('pa internet butoni e thotë dhe nuk hapet', async () => {
    setOnline(false)
    const onOpen = vi.fn()
    render(<WatchVideoButton chosen={chosenVideo(BENCH, null)!} onOpen={onOpen} />)
    const button = screen.getByRole('button', { name: /Shiko videon/ })
    expect(button).toBeDisabled()
    expect(screen.getByText('Videoja do internet')).toBeInTheDocument()
    await userEvent.setup().click(button)
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('anglisht', () => {
    act(() => language.set('en'))
    render(<WatchVideoButton chosen={chosenVideo(BENCH, null)!} onOpen={() => undefined} />)
    expect(screen.getByRole('button', { name: /Watch the video/ })).toBeInTheDocument()
  })
})

describe('ExerciseVideoSheet', () => {
  it('luan brenda app-it nga youtube-nocookie me sekondën e nisjes dhe jep burimin', () => {
    const chosen: ChosenVideo = { ...chosenVideo(BENCH, null)!, startS: 12 }
    render(<ExerciseVideoSheet chosen={chosen} name="Bench Press" onClose={() => undefined} />)
    const frame = screen.getByTitle('Videoja e Bench Press')
    expect(frame.getAttribute('src')).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\/CayG6UYqL8g\?.*&start=12$/)
    expect(screen.getByText('NASM · 0:25 · National Academy of Sports Medicine (NASM)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Hap në YouTube/ })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=CayG6UYqL8g&t=12s')
  })

  it('lidhja e përdoruesit luan në vend të të zgjedhurit', () => {
    render(<ExerciseVideoSheet chosen={chosenVideo(BENCH, 'https://youtu.be/dQw4w9WgXcQ')!} name="Bench Press" onClose={() => undefined} />)
    expect(screen.getByTitle('Videoja e Bench Press').getAttribute('src')).toContain('/embed/dQw4w9WgXcQ')
    expect(screen.getByText('Lidhja që shtove · YouTube')).toBeInTheDocument()
  })

  it('pa internet: pa player, e thotë që lëvizja punon pa të', () => {
    setOnline(false)
    render(<ExerciseVideoSheet chosen={chosenVideo(BENCH, null)!} name="Bench Press" onClose={() => undefined} />)
    expect(screen.queryByTitle('Videoja e Bench Press')).toBeNull()
    expect(screen.getByText('Videoja do internet. Lëvizja e ushtrimit punon edhe pa të.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Hap në YouTube/ })).toBeNull()
  })
})

describe('MoreVideos', () => {
  it('deri në 3 video me titullin, kanalin, autorin dhe kohëzgjatjen; hapen në YouTube', () => {
    const more = curatedVideos(BENCH)!.more
    render(<MoreVideos videos={more} />)
    expect(screen.getByRole('heading', { name: 'Më shumë video' })).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links[0]).toHaveAttribute('href', `https://www.youtube.com/watch?v=${more[0].id}`)
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(screen.getByText(`${more[0].channel} · ${more[0].author} · 17:22`)).toBeInTheDocument()
    expect(screen.getByText('Video në anglisht, nga autorë me titull. Duan internet.')).toBeInTheDocument()
  })

  it('kanali dhe autori i njëjtë del një herë', () => {
    render(<MoreVideos videos={curatedVideos({ libraryId: null, name: 'Cable Crunch' })!.more} />)
    expect(screen.getByText('Jim Stoppani, PhD · 3:32')).toBeInTheDocument()
  })

  it('pa video nuk del asgjë', () => {
    const { container } = render(<MoreVideos videos={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
