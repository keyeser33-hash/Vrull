import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { FoodTile } from '@/components/food/food-tile'
import { portionLabel } from '@/components/food/food-labels'
import { BackButton } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { ProgressTrack } from '@/components/ui/progress-bar'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { addItem, loadBasket, saveBasket } from '@/data/basket'
import { fillView, proposalBasketItems } from '@/data/fill-foods'
import { foodName, portionText, supplementName } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { type FillItem, type FillProposal, type FillStatus, fillMacros } from '@/nutrition/fill-macros'
import { gramsText, kcalText } from './nutrition-format'

// Ushqimi › Plotëso makrot (V2-E3-28c, SPEC §0.3h, bordi "Ushqimi · Plotëso makrot"): deri në 3 propozime për proteinën që
// mbetet, të llogaritura në telefon (`nutrition/fill-macros.ts`), pa AI dhe pa rrjet. Çdo kartë ka kaloritë dhe proteinën,
// burimin, artikujt, sa e mbush proteinën dhe "Shto në shportë": artikujt hyjnë te shporta e vaktit të radhës dhe hapet
// rishikimi i shportës te "Shto ushqim". Faqja vetëm lexon; asgjë nuk shkruhet para atij veprimi.

const EMPTY: Record<Exclude<FillStatus, 'ok'>, { title: 'foodday.fill.emptyDone' | 'foodday.fill.emptyKcal' | 'foodday.fill.emptyFoods'; hint: 'foodday.fill.emptyDoneHint' | 'foodday.fill.emptyKcalHint' | 'foodday.fill.emptyFoodsHint' }> = {
  proteinDone: { title: 'foodday.fill.emptyDone', hint: 'foodday.fill.emptyDoneHint' },
  noKcal: { title: 'foodday.fill.emptyKcal', hint: 'foodday.fill.emptyKcalHint' },
  noFoods: { title: 'foodday.fill.emptyFoods', hint: 'foodday.fill.emptyFoodsHint' },
}

export function FillMacrosPage() {
  const i18n = useI18n()
  const { t, fmt } = i18n
  const navigate = useNavigate()
  const [busy, setBusy] = useState<number | null>(null)
  const view = useLocalQuery(async () => {
    const now = store.now()
    return { ...(await fillView(store, now)), now }
  }, [])
  const result = view?.left ? fillMacros(view.left, view.foods) : null
  const header = (
    <header className="flex items-start gap-1">
      <BackButton label={t('foodday.fill.back')} fallback="/ushqimi" className="-ml-2" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 pt-2">
        <h1 className="type-display-m">{t('foodday.fill.title')}</h1>
        {view?.left ? (
          <p className="type-caption text-muted-foreground tabular-nums">
            {t('foodday.fill.remaining', { kcal: kcalText(i18n, Math.max(0, view.left.kcal)), protein: fmt.number(Math.max(0, Math.round(view.left.proteinG))), time: fmt.time(view.now) })}
          </p>
        ) : null}
      </div>
    </header>
  )
  if (!view) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div aria-hidden className="h-56 rounded-lg bg-surface" />
      </div>
    )
  }

  const itemName = (item: FillItem) => (item.food.source === 'supplement' ? supplementName(t, item.food.name) : foodName(t, item.food))
  const itemAmount = (item: FillItem) => {
    const grams = gramsText(i18n, item.grams)
    const amount = item.food.unit ? portionText(t, fmt, { count: item.count, unit: item.food.unit }) : portionLabel(i18n, { grams: item.grams, servings: null, servingG: item.food.servingG, servingLabel: item.food.servingLabel })
    return amount === grams ? grams : t('foodday.fill.itemAmount', { amount, grams })
  }

  async function add(proposal: FillProposal, index: number) {
    if (busy !== null || !view) return
    setBusy(index)
    try {
      const items = await proposalBasketItems(store, proposal)
      saveBasket(items.reduce(addItem, loadBasket()))
      navigate(`/ushqimi/shto/${view.meal}?ndrysho=shporta`)
    } finally {
      setBusy(null)
    }
  }

  const empty = (title: string, hint: string, action?: { to: string; label: string }) => (
    <section className={`${surfaceClass} flex flex-col gap-1.5 rounded-lg p-4`}>
      <h2 className="type-body-strong">{title}</h2>
      <p className="type-caption text-muted-foreground">{hint}</p>
      {action ? (
        <Link to={action.to} className="flex min-h-11 items-center text-sm font-semibold text-ember-text">
          {action.label}
        </Link>
      ) : null}
    </section>
  )

  return (
    <div className="flex flex-col gap-4">
      {header}
      {!result ? (
        empty(t('foodday.fill.emptyTargets'), t('foodday.fill.emptyTargetsHint'), { to: '/ushqimi/objektivat', label: t('food.targets.title') })
      ) : result.proposals.length === 0 ? (
        result.status === 'ok' ? (
          empty(t('foodday.fill.emptyFit'), t('foodday.fill.emptyFitHint'))
        ) : (
          empty(t(EMPTY[result.status].title), t(EMPTY[result.status].hint))
        )
      ) : (
        <ul aria-label={t('foodday.fill.proposals')} className="flex flex-col gap-3">
          {result.proposals.map((proposal, index) => {
            const total = Math.round(view.left!.proteinG)
            const full = proposal.coverage >= 1 - 1e-9 || Math.round(proposal.proteinG) >= total
            const kcalLeft = kcalText(i18n, proposal.kcalLeft)
            const names = proposal.items.map(itemName).join(', ')
            return (
              <li key={proposal.items.map((item) => item.food.foodId).join('+')} className={`${surfaceClass} flex flex-col gap-2.5 rounded-lg p-3.5`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-2xl leading-none font-extrabold tabular-nums">
                    {t('foodday.fill.card', { kcal: kcalText(i18n, proposal.kcal), protein: fmt.number(Math.round(proposal.proteinG)) })}
                  </span>
                  <span className="text-[13px] text-muted-foreground">{t(`foodday.fill.source.${proposal.source}`)}</span>
                </div>
                <ul className="flex flex-col">
                  {proposal.items.map((item) => (
                    <li key={item.food.foodId} className="flex min-h-10 items-center gap-2.5">
                      <FoodTile size="sm" />
                      <span className="min-w-0 flex-1 text-[15px]">{itemName(item)}</span>
                      <span className="text-sm whitespace-nowrap text-muted-foreground tabular-nums">{itemAmount(item)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] text-muted-foreground tabular-nums">
                    {full ? t('foodday.fill.covers', { kcal: kcalLeft }) : t('foodday.fill.coversPart', { protein: fmt.number(Math.round(proposal.proteinG)), total: fmt.number(total), kcal: kcalLeft })}
                  </span>
                  <ProgressTrack ratio={proposal.coverage} />
                </div>
                <Button variant="secondary" size="lg" className="w-full text-[17px]" disabled={busy !== null} aria-label={t('foodday.fill.addLabel', { foods: names })} onClick={() => void add(proposal, index)}>
                  <Icon name="shto" size={18} />
                  {t('foodday.fill.add')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      {result && result.proposals.length > 0 ? <p className="type-caption text-muted-foreground">{t('foodday.fill.note')}</p> : null}
    </div>
  )
}
