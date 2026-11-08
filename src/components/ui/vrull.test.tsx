import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { language } from '@/i18n/language'
import { Button } from './button'
import { FactCard } from './fact-card'
import { InsightCard } from './insight-card'
import { ListRow } from './list-row'
import { ProgressBar } from './progress-bar'
import { QuickAdd } from './quick-add'
import { RirPicker } from './rir-picker'
import { StatTile } from './stat-tile'
import { Stepper } from './stepper'
import { TabBar } from './tab-bar'
import { WeekStrip } from './week-strip'

describe('Button', () => {
  it('kryesori është prush me tekst on-ember; në ditë të lodhur rërë', () => {
    render(
      <>
        <Button variant="primary" size="xl">
          Ruaj setin
        </Button>
        <Button variant="primary" size="lg" tired>
          Fillo stërvitjen
        </Button>
      </>,
    )
    const save = screen.getByRole('button', { name: 'Ruaj setin' })
    expect(save).toHaveClass('bg-ember', 'text-on-ember', 'h-button-l', 'uppercase')
    const tired = screen.getByRole('button', { name: 'Fillo stërvitjen' })
    expect(tired).toHaveClass('bg-sand', 'text-on-ember', 'h-button')
    expect(tired).not.toHaveClass('bg-ember')
  })

  it('dytësori merr surface-2 në kartë dhe surface mbi faqe', () => {
    render(
      <>
        <Button variant="secondary">Në kartë</Button>
        <Button variant="secondary" ground="page">
          Mbi faqe
        </Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'Në kartë' })).toHaveClass('bg-surface-2', 'h-touch')
    expect(screen.getByRole('button', { name: 'Mbi faqe' })).toHaveClass('bg-surface')
  })
})

afterEach(() => language.set('sq'))

describe('Stepper', () => {
  function Harness({ label = 'Seti 1', reps: initialReps = 9 }: { label?: string; reps?: number }) {
    const [kg, setKg] = useState(62.5)
    const [reps, setReps] = useState(initialReps)
    return (
      <Stepper
        label={label}
        weight={kg}
        reps={reps}
        weightStep={2.5}
        onWeightStep={(direction) => setKg((value) => value + direction * 2.5)}
        onRepsStep={(direction) => setReps((value) => value + direction)}
      />
    )
  }

  it('lexuesi i ekranit dëgjon peshën dhe përsëritjet; butonat i ndryshojnë', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(screen.getByRole('group', { name: 'Seti 1: 62,5 kg, 9 përsëritje' })).toBeInTheDocument()
    expect(screen.getByText('62,5')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Rrit peshën me 2,5 kg' }))
    await user.click(screen.getByRole('button', { name: 'Rrit përsëritjet' }))
    expect(screen.getByRole('group', { name: 'Seti 1: 65 kg, 10 përsëritje' })).toBeInTheDocument()
  })

  it('në anglisht: pika dhjetore dhe shumësi i "rep"', () => {
    language.set('en')
    render(<Harness label="Set 1" reps={1} />)
    expect(screen.getByRole('group', { name: 'Set 1: 62.5 kg, 1 rep' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Decrease weight by 2.5 kg' })).toHaveTextContent('−2.5')
    expect(screen.getByText('rep')).toBeInTheDocument()
  })

  it('numri që ndryshoi i fundit merr ember-text', async () => {
    const user = userEvent.setup()
    const { container } = render(<Harness />)
    const numbers = () => [...container.querySelectorAll('.type-display-hero')]
    expect(numbers().filter((node) => node.classList.contains('text-ember-text'))).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Ul përsëritjet' }))
    expect(numbers()[1]).toHaveClass('text-ember-text')
    expect(numbers()[0]).toHaveClass('text-foreground')
    await user.click(screen.getByRole('button', { name: 'Ul peshën me 2,5 kg' }))
    expect(numbers()[0]).toHaveClass('text-ember-text')
  })
})

describe('RirPicker', () => {
  it('një çip i zgjedhur në bojë, me aria-pressed', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [value, setValue] = useState<number | null>(2)
      return <RirPicker value={value} onChange={setValue} />
    }
    render(<Harness />)
    const group = screen.getByRole('group', { name: 'Sa të kishin mbetur (RIR)' })
    expect(within(group).getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(within(group).getByRole('button', { name: '4 ose më shumë' }))
    expect(within(group).getByRole('button', { name: '4 ose më shumë' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: '4 ose më shumë' })).toHaveClass('bg-foreground', 'text-background')
    expect(within(group).getByRole('button', { name: '2' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('në anglisht', () => {
    language.set('en')
    render(<RirPicker value={null} onChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Reps in reserve (RIR)' })
    expect(within(group).getByRole('button', { name: '4 or more' })).toHaveTextContent('4+')
  })
})

describe('ListRow', () => {
  it('rreshti dhe veprimi brenda tij janë dy prekje të ndara', async () => {
    const user = userEvent.setup()
    const open = vi.fn()
    const usual = vi.fn()
    render(
      <ul>
        <ListRow name="Para stërvitjes" detail="17:00" onSelect={open} action={<Button variant="outline" onClick={usual}>Si zakonisht</Button>} />
        <ListRow name="Mëngjesi" detail="Tërshërë, qumësht, banane" value="520" />
      </ul>,
    )
    await user.click(screen.getByRole('button', { name: 'Si zakonisht' }))
    expect(usual).toHaveBeenCalledOnce()
    expect(open).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Para stërvitjes' }))
    expect(open).toHaveBeenCalledOnce()
    expect(screen.getByText('520')).toHaveClass('font-display', 'tabular-nums')
  })
})

describe('StatTile dhe ProgressBar', () => {
  it('karta e thotë vlerën me fjalë të plota', () => {
    render(<StatTile label="Proteina" value="96 g" ariaLabel="Proteina 96 gramë" tone="data" />)
    expect(screen.getByRole('group', { name: 'Proteina 96 gramë' })).toBeInTheDocument()
    expect(screen.getByText('96 g')).toHaveClass('text-data')
  })

  it('mbi objektiv shiriti mbetet plot dhe e thotë me fjalë', () => {
    const { container } = render(
      <>
        <ProgressBar label="Proteina" value={96} target={180} unitName="gramë" />
        <ProgressBar label="Yndyrat" value={92} target={80} unitName="gramë" tone="sand" />
      </>,
    )
    expect(screen.getByRole('group', { name: 'Proteina 96 nga 180 gramë' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Yndyrat 92 nga 80 gramë, mbi objektiv' })).toBeInTheDocument()
    const fills = [...container.querySelectorAll<HTMLElement>('.animate-fill')]
    expect(fills.map((fill) => parseFloat(fill.style.width))).toEqual([expect.closeTo((96 / 180) * 100, 2), 100])
    expect(fills[1]).toHaveClass('bg-sand')
  })

  it('në anglisht me presjen e mijësheve', () => {
    language.set('en')
    render(<ProgressBar label="Energy" value={1240} target={2900} unitName="kcal" />)
    expect(screen.getByRole('group', { name: 'Energy, 1,240 of 2,900 kcal' })).toBeInTheDocument()
  })
})

describe('InsightCard dhe FactCard', () => {
  it('rekordi ka ikonën në ember-text; sugjerimi i gatishmërisë ka veprimet', () => {
    const { container } = render(
      <>
        <InsightCard>Edhe 1 përsëritje dhe ke rekord të ri: e1RM 83 kg.</InsightCard>
        <InsightCard tone="tired" actions={<Button variant="primary" tired>Prano</Button>}>
          Gatishmëria 54%. Propozoj sot −1 set për ushtrim dhe RIR 3.
        </InsightCard>
      </>,
    )
    expect(container.querySelector('svg')).toHaveClass('text-ember-text')
    expect(container.querySelectorAll('svg')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Prano' })).toHaveClass('bg-sand')
  })

  it('fakti ka gjithnjë burimin, ose "Shpjeguar nga AI"', () => {
    render(
      <>
        <FactCard fact="Një gram yndyrë jep rreth 9 kcal." source="USDA, faktorët Atwater" onMore={() => {}} onNext={() => {}} />
        <FactCard fact="Supet ndihmojnë me lëngjet." ai />
      </>,
    )
    const [withSource, fromAi] = screen.getAllByRole('region', { name: 'A e dije?' })
    expect(within(withSource).getByText('Burimi: USDA, faktorët Atwater')).toBeInTheDocument()
    expect(within(withSource).getByRole('button', { name: 'Tjetër' })).toBeInTheDocument()
    expect(within(fromAi).getByText('Shpjeguar nga AI')).toBeInTheDocument()
  })

  it('në anglisht', () => {
    language.set('en')
    render(<FactCard fact="One gram of fat gives about 9 kcal." source="USDA" onMore={() => {}} />)
    const card = screen.getByRole('region', { name: 'Did you know?' })
    expect(within(card).getByText('Source: USDA')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Learn more' })).toBeInTheDocument()
  })
})

describe('WeekStrip', () => {
  it('çdo ditë e thotë gjendjen; dita e bërë hap seancën', async () => {
    const user = userEvent.setup()
    const open = vi.fn()
    render(
      <WeekStrip
        days={[
          { key: 'h', letter: 'H', name: 'e hënë 2', day: 2, state: 'done', onSelect: open },
          { key: 'm', letter: 'M', name: 'e mërkurë 4', day: 4, state: 'rest' },
          { key: 'd', letter: 'D', name: 'e diel 8', day: 8, state: 'planned', today: true },
        ]}
      />,
    )
    expect(screen.getByRole('list', { name: 'Java' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'E hënë 2, e bërë' }))
    expect(open).toHaveBeenCalledOnce()
    expect(screen.getByRole('img', { name: 'E mërkurë 4, pushim' })).toHaveClass('bg-mark')
    expect(screen.getByRole('img', { name: 'Sot, e diel 8, stërvitja e radhës' })).toHaveClass('border-ember-text')
  })

  it('në anglisht, si te bordi EN', () => {
    language.set('en')
    render(
      <WeekStrip
        days={[
          { key: 'w', letter: 'W', name: 'Wednesday 4', day: 4, state: 'rest' },
          { key: 's', letter: 'S', name: 'Sunday 8', day: 8, state: 'planned', today: true },
        ]}
      />,
    )
    expect(screen.getByRole('list', { name: 'This week' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Wednesday 4, rest day' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Today, Sunday 8, next workout' })).toBeInTheDocument()
  })
})

describe('TabBar', () => {
  it('vendi aktiv ka aria-current dhe ember-text', () => {
    render(
      <MemoryRouter>
        <TabBar
          active="sot"
          items={[
            { id: 'sot', label: 'Sot', icon: 'sot', to: '/' },
            { id: 'programi', label: 'Programi', icon: 'programi', to: '/programi' },
          ]}
        />
      </MemoryRouter>,
    )
    const nav = screen.getByRole('navigation', { name: 'Kryesore' })
    expect(within(nav).getByRole('link', { name: 'Sot' })).toHaveAttribute('aria-current', 'page')
    expect(within(nav).getByRole('link', { name: 'Sot' })).toHaveClass('text-ember-text')
    expect(within(nav).getByRole('link', { name: 'Programi' })).not.toHaveAttribute('aria-current')
  })
})

describe('QuickAdd', () => {
  it('dërgon tekstin; me kufirin e AI-së foto e thotë dhe barkodi mbetet', async () => {
    const user = userEvent.setup()
    const submit = vi.fn()
    const photo = vi.fn()
    const barcode = vi.fn()
    function Harness() {
      const [text, setText] = useState('')
      return <QuickAdd value={text} onChange={setText} onSubmit={submit} onPhoto={photo} onBarcode={barcode} aiLimitReached />
    }
    render(<Harness />)
    await user.type(screen.getByLabelText('Me fjalë: shkruaj çfarë hëngre'), '2 vezë{Enter}')
    expect(submit).toHaveBeenCalledWith('2 vezë')
    await user.click(screen.getByRole('button', { name: 'Foto e pjatës' }))
    expect(photo).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Foto e pjatës' })).toHaveAccessibleDescription('Kufiri i këtij muaji u arrit')
    await user.click(screen.getByRole('button', { name: 'Skano barkodin' }))
    expect(barcode).toHaveBeenCalledOnce()
  })

  it('në anglisht, si te bordi EN', () => {
    language.set('en')
    render(<QuickAdd value="" onChange={() => {}} onSubmit={() => {}} onPhoto={() => {}} onBarcode={() => {}} />)
    const form = screen.getByRole('form', { name: 'Quick add' })
    expect(within(form).getByPlaceholderText('e.g. 2 eggs and a slice of bread')).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Photo of your meal' })).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Scan barcode' })).toBeInTheDocument()
  })
})
