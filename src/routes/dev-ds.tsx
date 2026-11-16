import { type ReactNode, useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FactCard } from '@/components/ui/fact-card'
import { Icon } from '@/components/ui/icons'
import { InsightCard } from '@/components/ui/insight-card'
import { ListRow } from '@/components/ui/list-row'
import { ProgressBar } from '@/components/ui/progress-bar'
import { QuickAdd } from '@/components/ui/quick-add'
import { RirPicker } from '@/components/ui/rir-picker'
import { RollingNumber } from '@/components/ui/rolling-number'
import { StatTile } from '@/components/ui/stat-tile'
import { Stepper } from '@/components/ui/stepper'
import { surfaceClass } from '@/components/ui/surface'
import { TabBar, type TabBarItem } from '@/components/ui/tab-bar'
import { WeekStrip, type WeekDay } from '@/components/ui/week-strip'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { THEMES, type Theme } from '@/lib/theme'

// Faqja e brendshme e sistemit Vrull (/dev/ds): komponentët në OLED, Natë dhe Ditë njëra pas tjetrës,
// secila me data-theme. Nuk ka lidhje nga app-i dhe nuk kalon nga porta. Prova e pamjes në 390 px:
// scripts/ds-screens.mjs. Tekstet e komponentëve vijnë nga katalogu (ndjekin gjuhën); titujt e
// faqes dhe të dhënat e shembullit (nga sistemi i dizajnit) mbeten këtu, se faqja nuk është për
// përdoruesin.

const SWATCHES = [
  ['background', 'bg-background'],
  ['surface', 'bg-surface'],
  ['surface-2', 'bg-surface-2'],
  ['border', 'bg-border'],
  ['foreground', 'bg-foreground'],
  ['muted-foreground', 'bg-muted-foreground'],
  ['subtle', 'bg-subtle'],
  ['track', 'bg-track'],
  ['ember', 'bg-ember'],
  ['ember-text', 'bg-ember-text'],
  ['data', 'bg-data'],
  ['sand', 'bg-sand'],
  ['success', 'bg-success'],
  ['danger', 'bg-danger'],
  ['insight', 'bg-insight'],
  ['insight-border', 'bg-insight-border'],
  ['volume-1', 'bg-volume-1'],
  ['volume-2', 'bg-volume-2'],
  ['volume-3', 'bg-volume-3'],
  ['mark', 'bg-mark'],
] as const

const TYPE = [
  ['type-display-hero', '62,5'],
  ['type-display-xl', '1 660'],
  ['type-display-l', 'Bench Press'],
  ['type-display-m', 'Dita e gjoksit'],
  ['type-display-s', 'Gjoks, triceps'],
  ['type-title', 'Sfida: 4 seanca'],
  ['type-label', 'Ngjyrat'],
  ['type-body-l', 'Herën e kaluar 60 × 13'],
  ['type-body', '9 ushtrime. Bench Press: synim 62,5 kg.'],
  ['type-body-strong', 'Mëngjesi'],
  ['type-caption', 'Faza 1 · Stërvitja 1 · ~65 min'],
] as const

const TABS = [
  { id: 'sot', label: 'tab.today', icon: 'sot' },
  { id: 'programi', label: 'tab.programme', icon: 'programi' },
  { id: 'ushqimi', label: 'tab.food', icon: 'pjata' },
  { id: 'progresi', label: 'tab.progress', icon: 'progresi' },
  { id: 'miqte', label: 'tab.friends', icon: 'miqte' },
] as const

const WEEK: WeekDay[] = [
  { key: '2', letter: 'H', name: 'e hënë 2', day: 2, state: 'done', onSelect: () => {} },
  { key: '3', letter: 'M', name: 'e martë 3', day: 3, state: 'done', onSelect: () => {} },
  { key: '4', letter: 'M', name: 'e mërkurë 4', day: 4, state: 'rest' },
  { key: '5', letter: 'E', name: 'e enjte 5', day: 5, state: 'done', onSelect: () => {} },
  { key: '6', letter: 'P', name: 'e premte 6', day: 6, state: 'rest' },
  { key: '7', letter: 'Sh', name: 'e shtunë 7', day: 7, state: 'rest' },
  { key: '8', letter: 'D', name: 'e diel 8', day: 8, state: 'planned', today: true },
]

export function DesignSystemPage() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="flex flex-col gap-1 px-4 pt-[calc(var(--safe-top)+20px)] pb-4">
        <h1 className="m-0 type-display-m">Sistemi Vrull</h1>
        <p className="m-0 type-caption text-muted-foreground">Komponentët në tri temat. Faqe e brendshme, pa lidhje nga app-i.</p>
      </header>
      {THEMES.map((theme) => (
        <ThemeShowcase key={theme} theme={theme} />
      ))}
    </main>
  )
}

function ThemeShowcase({ theme }: { theme: Theme }) {
  const { t } = useI18n()
  const id = useId()
  const [kg, setKg] = useState(62.5)
  const [reps, setReps] = useState(9)
  const [rir, setRir] = useState<number | null>(2)
  const [food, setFood] = useState('')
  const [kcal, setKcal] = useState(1380)
  const tabs: TabBarItem[] = TABS.map((tab) => ({ ...tab, label: t(tab.label), to: '/dev/ds' }))

  return (
    <section data-theme={theme} aria-labelledby={id} className="flex flex-col gap-6 bg-background px-4 pt-6 pb-10 text-foreground">
      <h2 id={id} className="m-0 type-display-l">
        {t(`settings.theme.${theme}`)}
      </h2>

      <Group title="Ngjyrat">
        <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0">
          {SWATCHES.map(([name, swatch]) => (
            <li key={name} className="flex min-w-0 flex-col gap-1">
              <span aria-hidden className={cn('h-10 rounded-md border border-border', swatch)} />
              <span className="truncate text-xs leading-[1.2] text-muted-foreground">{name}</span>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Tipografia">
        <div className="flex flex-col gap-2">
          {TYPE.map(([style, sample]) => (
            <p key={style} className={cn('m-0', style)}>
              {sample}
            </p>
          ))}
        </div>
      </Group>

      <Group title="Butonat">
        <Button variant="primary" size="xl">
          Ruaj setin
        </Button>
        <Button variant="primary" size="lg" className="w-full">
          Fillo stërvitjen
        </Button>
        <Button variant="primary" size="lg" tired className="w-full">
          Ritëm i butë
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" ground="page">
            Tjetër
          </Button>
          <Button variant="outline">Si zakonisht</Button>
          <Button variant="ghost">Ngrohja</Button>
          <Button variant="secondary" ground="page" size="icon" aria-label="Foto e pjatës">
            <Icon name="kamera" size={22} />
          </Button>
        </div>
        <div className="flex flex-col gap-3 rounded-xl bg-ember p-4 text-on-ember">
          <p className="m-0 type-title">Plotëso makrot</p>
          <p className="m-0 type-body">Mbyll proteinat: 84 g.</p>
          <Button variant="ink" size="lg" className="w-full">
            Shto të trija
          </Button>
        </div>
      </Group>

      <Group title="Regjistrimi">
        <Stepper
          label="Seti 1"
          weight={kg}
          reps={reps}
          weightStep={2.5}
          canLowerWeight={kg > 0}
          canLowerReps={reps > 0}
          onWeightStep={(direction) => setKg((value) => Math.max(0, value + direction * 2.5))}
          onRepsStep={(direction) => setReps((value) => Math.max(0, value + direction))}
        />
        <RirPicker value={rir} onChange={setRir} />
      </Group>

      <Group title="Të dhënat">
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Gati" value="78%" ariaLabel="Gatishmëria 78 përqind" onSelect={() => {}} />
          <StatTile label="Proteina" value="96 g" ariaLabel="Proteina 96 gramë" tone="data" onSelect={() => {}} />
          <StatTile label="Uji" value="1,2 L" ariaLabel="Uji 1,2 litra" onSelect={() => {}} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <ProgressBar label="Proteina" value={96} target={180} unitName="gramë" />
          <ProgressBar label="Karbohidr." value={120} target={340} unitName="gramë" tone="data" />
          <ProgressBar label="Yndyrat" value={92} target={80} unitName="gramë" tone="sand" />
        </div>
        <WeekStrip days={WEEK} />
        {/* Numri që rrotullohet (E2-23): vetëm shifrat që ndryshojnë, 200 ms, 40 ms mes shifrave. */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <span className="flex items-end gap-2">
            <RollingNumber value={kcal} className="type-display-xl" />
            <span className="pb-1 type-caption text-muted-foreground">kcal mbeten</span>
          </span>
          <span className="flex gap-2">
            <Button variant="secondary" ground="page" onClick={() => setKcal((value) => Math.max(0, value - 470))}>
              −470
            </Button>
            <Button variant="secondary" ground="page" onClick={() => setKcal((value) => value + 470)}>
              +470
            </Button>
          </span>
        </div>
      </Group>

      <Group title="Inteligjenca">
        <InsightCard>Edhe 1 përsëritje dhe ke rekord të ri: e1RM 83 kg.</InsightCard>
        <InsightCard
          tone="tired"
          actions={
            <>
              <Button variant="primary" tired>
                Prano
              </Button>
              <Button variant="outline">Jo sot</Button>
            </>
          }
        >
          <strong>Gatishmëria 54%.</strong> Propozoj sot −1 set për ushtrim dhe RIR 3.
        </InsightCard>
        <FactCard
          fact="Një gram proteinë ose karbohidrat jep rreth 4 kcal, një gram yndyrë rreth 9. Prandaj 10 g arra kanë më shumë kalori se 10 g gjizë."
          source="USDA, faktorët Atwater"
          context="Gjizë"
          more="Faktorët Atwater: 4 kcal për gram proteinë dhe karbohidrat, 9 për yndyrën."
          href="https://fdc.nal.usda.gov"
          onDismiss={() => {}}
        />
      </Group>

      <Group title="Listat">
        <ul className={cn(surfaceClass, 'm-0 list-none rounded-xl px-4 py-1')}>
          <ListRow name="Mëngjesi" detail="Tërshërë, qumësht, banane" value="520" onSelect={() => {}} />
          <ListRow name="Dreka" detail="Byrek me spinaq, kos" value="720" onSelect={() => {}} />
          <ListRow name="Para stërvitjes" detail="17:00" onSelect={() => {}} action={<Button variant="outline">Si zakonisht</Button>} />
        </ul>
      </Group>

      <Group title="Ushqimi">
        <QuickAdd value={food} onChange={setFood} onSubmit={() => setFood('')} onPhoto={() => {}} onBarcode={() => {}} />
        <QuickAdd value="" onChange={() => {}} onSubmit={() => {}} onPhoto={() => {}} onBarcode={() => {}} aiLimitReached />
      </Group>

      <Group title="Navigimi">
        <TabBar items={tabs} active="sot" className="-mx-4" />
      </Group>
    </section>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-3">
      <h3 id={id} className="m-0 type-label text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  )
}
