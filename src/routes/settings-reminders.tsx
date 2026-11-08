import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { ChoiceRow, Group, Row, SwitchRow } from '@/components/layout/list-group'
import { BackHeader } from '@/components/layout/page'
import { Sheet } from '@/components/layout/sheet'
import { WEEK_DAYS } from '@/components/forms/week-days'
import { planRemindersNow, store, useLocalQuery } from '@/data/app-data'
import { reminderSettings, setMeasurementDay, setReminderToggle } from '@/data/reminders'
import { useI18n } from '@/i18n/use-i18n'
import { reminderPermission, type ReminderPermission, requestReminderPermission } from '@/lib/reminders-native'
import type { ReminderToggles } from '@/reminders/plan'

// Rikujtuesit (SPEC §13), nga Cilësimet › Njoftimet: leja e njoftimeve kur mungon, çfarë njofton
// telefoni dhe dita e matjes javore (në fletë, ?ndrysho=matja).

const TOGGLES = ['training', 'meals', 'supplements', 'measurements'] as const satisfies readonly (keyof ReminderToggles)[]

export function RemindersPage() {
  const { t } = useI18n()
  const settings = useLocalQuery(() => reminderSettings(store), [])
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
          <Group>
            <Row label={t('reminders.measurementDay')} value={day} onClick={() => setParams({ ndrysho: 'matja' })} />
          </Group>
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
    </div>
  )
}
