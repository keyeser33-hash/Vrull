import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Tone } from '@/body/model-math'

// Muskujt e një ushtrimi te modeli 3D (SPEC §11, funksioni 1). Modeli zëvendësohet me një stub
// që tregon ngjyrën, anën, fokusin dhe përmbajtjen mbi të.
const gl = vi.hoisted(() => ({ available: true }))
vi.mock('@/lib/webgl', () => ({ webglAvailable: () => gl.available }))
vi.mock('@/components/body/body-model', () => ({
  default: (props: {
    paint: (key: string) => Tone | null
    onPick: (key: string | null) => void
    focus?: string[] | null
    face?: string[]
    overlay?: React.ReactNode
    label: string
  }) => (
    <div>
      <div role="img" aria-label={props.label}>
        <p>{`përballë ${props.face?.join(' ')}`}</p>
        <p>{props.focus ? `fokusi ${props.focus.join(' ')}` : 'pa fokus'}</p>
        {['pectoralis_major_sternocostal', 'triceps_brachii', 'gastrocnemius'].map((key) => (
          <button key={key} type="button" onClick={() => props.onPick(key)}>
            {`${key} ${props.paint(key)?.token ?? 'pa'} ${props.paint(key)?.alpha ?? 0}`}
          </button>
        ))}
      </div>
      {props.overlay}
    </div>
  ),
}))

const bench = { name: 'Bench Press', primary: ['pectoralis_major_sternocostal'], secondary: ['triceps_brachii', 'deltoid_anterior'] }

async function renderSheet() {
  const { ExerciseMusclesSheet } = await import('./exercise-muscles')
  const onClose = vi.fn()
  render(<ExerciseMusclesSheet exercise={bench} onClose={onClose} />)
  return screen.getByRole('dialog', { name: 'Muskujt e Bench Press' })
}

describe('muskujt e ushtrimit në 3D', () => {
  beforeEach(() => {
    gl.available = true
  })

  it('kryesorët me brand, ndihmësit të zbehtë, të tjerët pa ngjyrë; modeli kthehet nga kryesorët', async () => {
    const sheet = await renderSheet()
    const model = await within(sheet).findByRole('img', { name: 'Muskujt e Bench Press' })
    expect(model).toHaveTextContent('përballë pectoralis_major_sternocostal')
    expect(within(model).getByText('pectoralis_major_sternocostal --ember 1')).toBeInTheDocument()
    expect(within(model).getByText('triceps_brachii --muted-foreground 0.6')).toBeInTheDocument()
    expect(within(model).getByText('gastrocnemius pa 0')).toBeInTheDocument()
    expect(within(sheet).getByRole('list', { name: 'Legjenda' })).toHaveTextContent('Kryesor')
  })

  it('emrat e muskujve: prekja e njërit e fokuson te modeli dhe thotë rolin e tij', async () => {
    const user = userEvent.setup()
    const sheet = await renderSheet()
    const model = await within(sheet).findByRole('img', { name: 'Muskujt e Bench Press' })
    await user.click(within(sheet).getByRole('button', { name: 'Tricepsi' }))
    expect(model).toHaveTextContent('fokusi triceps_brachii')
    expect(within(sheet).getByRole('group', { name: 'Muskuli i zgjedhur' })).toHaveTextContent('Tricepsi · Ndihmës')
    expect(within(sheet).getByRole('button', { name: 'Tricepsi' })).toHaveAttribute('aria-pressed', 'true')
    // Prekja te modeli i një muskuli që s'punon këtu e thotë.
    await user.click(within(model).getByText(/^gastrocnemius/))
    expect(within(sheet).getByRole('group', { name: 'Muskuli i zgjedhur' })).toHaveTextContent('Gastroknemiusi · Nuk punon te ky ushtrim')
    await user.click(within(sheet).getByRole('button', { name: 'Hiq fokusin' }))
    expect(model).toHaveTextContent('pa fokus')
  })

  it('pa WebGL tregon figurën 2D me të njëjtët muskuj', async () => {
    gl.available = false
    const sheet = await renderSheet()
    // Figura 2D (SVG), jo modeli.
    expect(within(sheet).getByRole('img', { name: 'Muskujt e Bench Press' }).tagName.toLowerCase()).toBe('svg')
    expect(sheet).not.toHaveTextContent('përballë')
  })
})
