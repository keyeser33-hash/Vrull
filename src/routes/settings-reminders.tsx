import { useEffect, useId, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChoiceRow, Group, Row, SwitchRow } from '@/components/layout/list-group'
import { BackHeader } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { WEEK_DAYS } from '@/components/forms/week-days'
import { planRemindersNow, store, useLocalQuery } from '@/data/app-data'
import { readProfile } from '@/data/profile'
import { MAX_DAILY_REMINDERS, reminderSettings, type ReminderSettings, setMeasurementDay, setQuietHours, setReminderToggle, unmuteReminders } from '@/data/reminders'
import { Button } from '@/components/ui/button'
import { inputClass } from '@/components/ui/field-styles'
import { localDate } from '@/lib/calendar'
import { cn } from '@/lib/cn'
import { useI18n } from '@/i18n/use-i18n'
import { reminderPermission, type ReminderPermission, requestReminderPermission } from '@/lib/reminders-native'
import type { MutableKind } from '@/reminders/plan'

// Rikujtuesit (SPEC §13), nga Cilësimet › Njoftimet: leja e njoftimeve kur mungon, çfarë njofton
// telefoni, dita e matjes javore (në fletë, ?ndrysho=matja) dhe, me rikujtuesit e zgjuar (V37), uji,
// orët e qeta (?ndrysho=qete) dhe llojet e heshtura vetë me "Ndize përsëri".

const TOGGLES = ['training', 'meals', 'supplements', 'water', 'measurements'] as const satisfies readonly (keyof ReminderSettings['toggles'])[]
const MUTED_ORDER: readonly MutableKind[] = ['meal', 'supplements', 'water']

export function RemindersPage() {
  const { t } = useI18n()
  const settings = useLocalQuery(() => reminderSettings(store), [])
  const profile = useLocalQuery(() => readProfile(store), [])
  const [permission, setPermission] = useState<ReminderPermission | null>(null)
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  useEffect(() => {
    const check = () => void reminderPermission().then(setPermission)
    check()
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [])
  const day = settings ? t(`day.${settings.measurementDay}` as 'day.7') : ''

  return (
    <div className="flex flex-col gap-3.5">
      <BackHeader title={t('settings.reminders')} back={t('settings.backToSettings')} fallback="/cilesimet" />
      {settings ? (
        <>
          <Group>
            {permission === 'prompt' || permission === 'denied' ? (
              <Row
                label={t('reminders.allow')}
                detail={t(permission === 'denied' ? 'reminders.allowDenied' : 'reminders.allowPrompt')}
                onClick={() =>
                  void requestReminderPermission().then(async (granted) => {
                    setPermission(granted ? 'granted' : await reminderPermission())
                    if (granted) await planRemindersNow()
                  })
                }
                action
              />
            ) : null}
            {TOGGLES.map((key) => (
              <SwitchRow
                key={key}
                label={t(`reminders.${key}`)}
                detail={t(`reminders.${key}Detail`)}
                checked={settings.toggles[key]}
                onChange={(on) => void setReminderToggle(store, key, on)}
              />
            ))}
          </Group>
          {MUTED_ORDER.some((kind) => settings.muted[kind]) ? (
            <Group title={t('reminders.mutedTitle')}>
              {MUTED_ORDER.filter((kind) => settings.muted[kind]).map((kind) => (
                <div key={kind} className="flex min-h-[52px] items-center gap-3 border-b border-border py-1.5 pr-3 pl-4 last:border-b-0">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="type-body-strong">{t(`reminders.muted.${kind}`)}</span>
                    <span className="type-caption text-muted-foreground">{t('reminders.mutedDetail')}</span>
                  </span>
                  <Button variant="outline" className="shrink-0" onClick={() => void unmuteReminders(store, kind, localDate(new Date()))}>
                    {t('reminders.unmute')}
                  </Button>
                </div>
              ))}
            </Group>
          ) : null}
          <Group>
            <Row
              label={t('reminders.quiet')}
              detail={profile ? t('reminders.quietSleep', { sleep: profile.sleepTime, wake: profile.wakeTime }) : undefined}
              value={settings.quiet ? t('reminders.quietRange', { from: settings.quiet.from, to: settings.quiet.to }) : t('reminders.quietNone')}
              onClick={() => setParams({ ndrysho: 'qete' })}
            />
            <Row label={t('reminders.measurementDay')} value={day} onClick={() => setParams({ ndrysho: 'matja' })} />
          </Group>
          <p className="px-1 text-[13px] leading-[1.4] text-muted-foreground">
            {t('reminders.smartNote', { count: MAX_DAILY_REMINDERS, sleep: profile?.sleepTime ?? '', wake: profile?.wakeTime ?? '' })}
          </p>
        </>
      ) : (
        <div aria-hidden className="h-80 rounded-lg bg-surface" />
      )}
      {params.get('ndrysho') === 'matja' && settings ? (
        <Sheet title={t('reminders.measurementDay')} description={t('reminders.measurementDayHint')} onClose={() => navigate(-1)}>
          <fieldset className="flex flex-col overflow-hidden rounded-lg border border-border">
            <legend className="sr-only">{t('reminders.measurementDay')}</legend>
            {WEEK_DAYS.map((entry) => (
              <ChoiceRow
                key={entry.value}
                name="measurement-day"
                value={String(entry.value)}
                label={t(`day.${entry.value}`)}
                checked={settings.measurementDay === entry.value}
                onChange={() => void setMeasurementDay(store, entry.value).then(() => navigate(-1))}
              />
            ))}
          </fieldset>
        </Sheet>
      ) : null}
      {params.get('ndrysho') === 'qete' && settings ? <QuietSheet current={settings.quiet} onClose={() => navigate(-1)} /> : null}
    </div>
  )
}

/** Intervali i qetë (V37): njoftimet që bien brenda tij vijnë në fund të tij. */
function QuietSheet({ current, onClose }: { current: ReminderSettings['quiet']; onClose: () => void }) {
  const { t } = useI18n()
  const [from, setFrom] = useState(current?.from ?? '12:00')
  const [to, setTo] = useState(current?.to ?? '14:00')
  const fromId = useId()
  const toId = useId()
  const valid = from !== to && /^\d{2}:\d{2}$/.test(from) && /^\d{2}:\d{2}$/.test(to)
  return (
    <Sheet
      title={t('reminders.quiet')}
      description={t('reminders.quietHint')}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" size="xl" disabled={!valid} onClick={() => void setQuietHours(store, { from, to }).then(onClose)}>
            {t('reminders.quietSave')}
          </Button>
          {current ? (
            <Button variant="ghost" onClick={() => void setQuietHours(store, null).then(onClose)}>
              {t('reminders.quietRemove')}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {[
          { id: fromId, label: t('reminders.quietFrom'), value: from, set: setFrom },
          { id: toId, label: t('reminders.quietTo'), value: to, set: setTo },
        ].map((field) => (
          <label key={field.id} htmlFor={field.id} className="flex flex-col gap-1.5">
            <span className="type-caption text-muted-foreground">{field.label}</span>
            <input
              id={field.id}
              type="time"
              value={field.value}
              onChange={(event) => event.target.value && field.set(event.target.value)}
              className={cn(inputClass, 'text-center font-display text-xl font-extrabold tabular-nums')}
            />
          </label>
        ))}
      </div>
    </Sheet>
  )
}
