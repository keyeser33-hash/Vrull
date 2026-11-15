import { type ReactNode, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { store } from '@/data/app-data'
import { startWorkout } from '@/data/training'
import { useI18n } from '@/i18n/use-i18n'
import { prepareRestNotifications, restNotificationsPrompt } from '@/lib/rest-alarm'

// Fillimi i stërvitjes (V2-E3-30; bordi "Sot · Fillimi i stërvitjes", SPEC §3a), i përbashkët për Sot,
// Programin dhe Progresin bosh. Butoni nuk zbehet gjatë fillimit: tregon një rreth që rrotullohet dhe
// "Po fillon" (me `aria-busy`), dhe pas 3 s "Po përgatis seancën". Para kërkesës së parë për lejen e
// njoftimeve del fleta "Njoftimi i pushimit" (adresa `?njoftimi=1`, që butoni mbrapa e mbyll); zgjedhja
// ruhet në telefon dhe fleta nuk del më. Pa leje (ose pa u pyetur) stërvitja nis pa njoftime.

const CHOICE_KEY = 'rest-notify-choice'
const SHEET_PARAM = 'njoftimi'
/** Pas kësaj kohe fillimi thotë se po përgatit seancën. */
export const SLOW_START_MS = 3000

export function useStartWorkout() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)
  const asking = params.get(SHEET_PARAM) === '1'

  useEffect(() => {
    if (!busy) return
    const timer = setTimeout(() => setSlow(true), SLOW_START_MS)
    return () => {
      clearTimeout(timer)
      setSlow(false)
    }
  }, [busy])

  async function run(allow: boolean) {
    // Lejet e timer-it kërkohen kur nevojiten: në stërvitjen e parë (SPEC §3a).
    if (allow) await prepareRestNotifications()
    await startWorkout(store)
    navigate('/seanca', { replace: asking })
  }

  async function start() {
    if (busy) return
    setBusy(true)
    try {
      const choice = await store.readDevice(CHOICE_KEY)
      if (choice === undefined && (await restNotificationsPrompt())) {
        setParams({ [SHEET_PARAM]: '1' })
        return
      }
      await run(choice !== 'declined')
    } finally {
      setBusy(false)
    }
  }

  async function choose(allow: boolean) {
    if (busy) return
    setBusy(true)
    try {
      await store.writeDevice(CHOICE_KEY, allow ? 'allowed' : 'declined')
      await run(allow)
    } finally {
      setBusy(false)
    }
  }

  const close = () => navigate(-1)
  const label = (idle: ReactNode): ReactNode =>
    busy ? (
      <>
        <Icon name="ngarkim" size={20} className="motion-safe:animate-spin" />
        {slow ? t('today.preparing') : t('today.starting')}
      </>
    ) : (
      idle
    )
  const sheet = asking ? (
    <Sheet
      title={t('today.notify.title')}
      description={t('today.notify.text')}
      onClose={close}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="xl" className="w-full" aria-busy={busy || undefined} onClick={() => void choose(true)}>
            {busy ? label(null) : t('today.notify.allow')}
          </Button>
          <Button variant="ghost" size="lg" className="w-full" onClick={() => void choose(false)}>
            {t('today.notify.skip')}
          </Button>
        </div>
      }
    />
  ) : null

  /** Për butonin që nis stërvitjen: `aria-busy` gjatë fillimit (pa `disabled`, që ta zbehte) dhe prekja. */
  const buttonProps = { 'aria-busy': busy || undefined, onClick: () => void start() }
  return { busy, start, label, sheet, buttonProps }
}
