import { lazy, Suspense, useCallback, useState } from 'react'
import { useSearchParams } from 'react-router'
import { DEEP_ENTRIES, deepEntry, ghostKeys } from '@/body/layers'
import type { Tone } from '@/body/model-math'
import { BodyFigure } from '@/components/body/body-figure'
import { FocusChip } from '@/components/body/focus-chip'
import { SwitchRow } from '@/components/layout/list-group'
import { BackHeader } from '@/components/layout/page'
import { surfaceClass } from '@/components/ui/surface'
import { store, useLocalQuery } from '@/data/app-data'
import { layersView } from '@/data/body'
import type { I18n } from '@/i18n'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { webglAvailable } from '@/lib/webgl'
import { joinNames } from './body-format'

// Shtresat (SPEC §11, TH-19; bordi "Trupi · Shtresat"). "Muskujt e thellë" i bën mbulesat të
// tejdukshme; muskuli i thellë i zgjedhur rri në prush, kamera i afrohet dhe çipi thotë ku fshihet.
// Poshtë: zgjedhja e muskujve të thellë dhe karta me anatominë (me burim), ku punon te programi yt
// dhe setet e javës. Zgjedhja mbahet në adresë (?muskuli=id).

const BodyModel = lazy(() => import('@/components/body/body-model'))

const DEEP_TONE: Tone = { token: '--ember', alpha: 1 }
const ALL_COVERS = [...ghostKeys(true, null)]

type DeepKey = Extract<Parameters<I18n['t']>[0], `bodyModel.deep.${string}`>
const deepText = ({ t }: I18n, id: string, field: 'name' | 'where' | 'cover' | 'title' | 'text' | 'source') => t(`bodyModel.deep.${id}.${field}` as DeepKey)

export function BodyLayersPage() {
  const i18n = useI18n()
  const { t } = i18n
  const [now] = useState(() => new Date())
  const entries = useLocalQuery(() => layersView(store, now), [])
  const [params, setParams] = useSearchParams()
  const entry = deepEntry(params.get('muskuli') ?? '') ?? DEEP_ENTRIES[0]
  const [deep, setDeep] = useState(true)
  // Fokusi te muskuli i zgjedhur; "×" e heq (kamera kthehet te i gjithë trupi). `request` e afron
  // sërish kamerën kur zgjidhet i njëjti muskul pas një rrotullimi.
  const [focus, setFocus] = useState({ on: true, request: 0 })
  const [back, setBack] = useState(entry.side === 'back')
  const [three] = useState(webglAvailable)
  const paint = useCallback((key: string) => (entry.keys.includes(key) ? DEEP_TONE : null), [entry])
  const choose = (id: string) => {
    setParams((current) => (current.set('muskuli', id), current), { replace: true })
    setFocus((current) => ({ on: true, request: current.request + 1 }))
  }
  const data = entries?.find((item) => item.id === entry.id)
  const cover = deepText(i18n, entry.id, 'cover')

  return (
    <div className="flex flex-col gap-2.5">
      <BackHeader title={t('bodyModel.layers')} back={t('bodyModel.layers.back')} fallback="/progresi/trupi" />

      <div className={cn(surfaceClass, 'overflow-hidden rounded-lg')}>
        <SwitchRow label={t('bodyModel.layers.deep')} detail={t('bodyModel.layers.deepText')} checked={deep} onChange={setDeep} />
      </div>

      <section aria-label={t('bodyModel.layers.model')} className={cn(surfaceClass, 'relative h-[352px] shrink-0 overflow-hidden rounded-xl')}>
        {three ? (
          <Suspense fallback={null}>
            <BodyModel
              className="h-full"
              paint={paint}
              onPick={(key) => {
                const picked = DEEP_ENTRIES.find((item) => key && item.keys.includes(key))
                if (picked) choose(picked.id)
              }}
              focus={focus.on ? entry.keys : null}
              focusRequest={focus.request}
              shadeFocus={false}
              ghost={deep ? ALL_COVERS : []}
              overlayAt="top"
              leader
              overlay={
                focus.on ? (
                  <FocusChip
                    title={deepText(i18n, entry.id, 'name')}
                    detail={deepText(i18n, entry.id, 'where')}
                    swatch="bg-ember"
                    onClear={() => setFocus((current) => ({ ...current, on: false }))}
                  />
                ) : null
              }
              back={back}
              onBackChange={setBack}
              label={t('bodyModel.layers.model')}
            />
          </Suspense>
        ) : (
          <BodyFigure primary={entry.keys} scale={2.2} className="h-full justify-center" label={t('bodyModel.layers.model')} />
        )}
        <ul
          aria-label={t('bodyModel.legend')}
          className="pointer-events-none absolute bottom-2.5 left-2.5 flex flex-col gap-1.5 rounded-sm bg-background px-2.5 py-2 type-caption"
        >
          {deep ? (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-3.5 shrink-0 rounded-[3px] border-[1.5px] border-dashed border-foreground" />
              {t('bodyModel.layers.cover', { name: cover })}
            </li>
          ) : null}
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-3.5 shrink-0 rounded-[3px] bg-ember" />
            {t('bodyModel.layers.deepSwatch')}
          </li>
        </ul>
      </section>

      <div
        role="radiogroup"
        aria-label={t('bodyModel.layers.deep')}
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {DEEP_ENTRIES.map((item) => {
          const selected = item.id === entry.id
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => choose(item.id)}
              className={cn(
                'h-11 shrink-0 rounded-pill border px-3.5 type-body whitespace-nowrap outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
                selected ? 'border-foreground bg-foreground font-semibold text-background' : 'border-surface-border bg-surface font-medium text-foreground',
              )}
            >
              {deepText(i18n, item.id, 'name')}
            </button>
          )
        })}
      </div>

      <section aria-labelledby="layers-title" className={cn(surfaceClass, 'flex flex-col gap-1.5 rounded-lg p-3.5')}>
        <h2 id="layers-title" className="type-title">
          {deepText(i18n, entry.id, 'title')}
        </h2>
        <p className="type-body">{deepText(i18n, entry.id, 'text')}</p>
        {data ? <p className="type-caption text-muted-foreground tabular-nums">{programText(i18n, data)}</p> : null}
        <p className="type-caption text-muted-foreground">{t('ui.fact.source', { source: deepText(i18n, entry.id, 'source') })}</p>
      </section>
    </div>
  )
}

/** "Te programi yt: ndihmës te Cable Crossover, 1,5 sete këtë javë." */
function programText(i18n: I18n, data: { load: number; roles: { primary: string[]; secondary: string[] } }) {
  const { t } = i18n
  const roles = [
    data.roles.primary.length ? t('bodyModel.layers.primaryIn', { names: joinNames(i18n, data.roles.primary) }) : null,
    data.roles.secondary.length ? t('bodyModel.layers.secondaryIn', { names: joinNames(i18n, data.roles.secondary) }) : null,
  ].filter((part): part is string => part !== null)
  const sets = t('bodyModel.setsInline', { count: data.load })
  return roles.length ? t('bodyModel.layers.program', { roles: roles.join('; '), sets }) : t('bodyModel.layers.programNone', { sets })
}
