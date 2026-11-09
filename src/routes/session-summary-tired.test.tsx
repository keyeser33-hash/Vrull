import { render } from '@testing-library/react'
import { setDayAttribute } from '@/lib/day-mode'
import { RecordHero } from './session-summary'

// Mbyllja në ditë të lodhur (V50): pa festim, ndaj edhe shkëndijat statike të rekordit mungojnë (numri mbetet).
vi.mock('@/data/app-data', () => ({ store: {}, useLocalQuery: () => undefined }))

const record = { exerciseName: 'Bench Press', e1rmKg: 82.5, gainKg: 2.5, weightKg: 70, reps: 8, setNumber: 3 } as never

describe('rekordi te mbyllja', () => {
  afterEach(() => setDayAttribute('normal'))

  it('ditë normale: shkëndijat e prushit rrethojnë numrin', () => {
    const { container } = render(<RecordHero record={record} />)
    expect(container.querySelectorAll('svg rect, svg circle, svg path').length).toBeGreaterThan(0)
  })

  it('ditë e lodhur: asnjë shkëndijë, numri i rekordit mbetet', () => {
    setDayAttribute('tired')
    const { container, getByText } = render(<RecordHero record={record} />)
    expect(container.querySelector('svg')).toBeNull()
    expect(getByText('82,5')).toBeInTheDocument()
  })
})
