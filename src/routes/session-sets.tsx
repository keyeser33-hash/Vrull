import type { SetRecord } from '@/data/training'
import { useI18n } from '@/i18n/use-i18n'
import { editable, setValue } from './session-format'

// Setet e ushtrimit te seanca (0.23, SPEC §0.3c; bordet "Seanca" dhe "Pushimi · banderola e rekordit"):
// çipat sipër setit (i ruajturi me vlerën, rekordi i dalluar, i tanishmi me vijë, të tjerët me synimin)
// dhe rreshtat e seteve të ruajtura te pushimi me etiketën "rekord". Prekja e një seti të ruajtur hap
// fletën "Ndrysho setin" (`set-edit-sheet.tsx`). Rekordi i çdo seti në kohën e vet vjen nga
// `sessionSetRecords` (§6: e1RM-ja, ose pesha më e madhe për ato përsëritje).

/**
 * Setet e ruajtura të ushtrimit te pushimi (bordi "Pushimi"): më i riu sipër, "Seti 2 · 22,5 × 9", etiketa
 * "rekord" kur seti ishte rekord, dhe "Ndrysho" 44 px që hap fletën e setit. Pushimi nuk ndalet.
 */
export function SavedSets({ sets, records, onEdit }: { sets: SetRecord[]; records: ReadonlyMap<string, unknown>; onEdit: (set: SetRecord) => void }) {
  const texts = useI18n()
  const { t } = texts
  if (sets.length === 0) return null
  return (
    <section aria-label={t('session.saved.title')} className="flex flex-col divide-y divide-border border-y border-border">
      {[...sets].reverse().map((set) => (
        <div key={set.id} className="flex min-h-12 items-center justify-between gap-2">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm leading-[1.35]">
            <span className="text-muted-foreground">{t('session.setLabel', { set: set.setNumber })}</span>
            <span className="tabular-nums">{setValue(set, texts)}</span>
            {records.has(set.id) ? (
              <span className="flex h-[22px] items-center rounded-[6px] border border-insight-border px-[7px] text-xs font-semibold text-ember-text">{t('session.chip.record')}</span>
            ) : null}
          </span>
          {editable(set) ? (
            <button
              type="button"
              aria-label={t('session.saved.editLabel', { set: set.setNumber, value: setValue(set, texts, { unit: true }) })}
              onClick={() => onEdit(set)}
              className="h-touch min-w-touch shrink-0 rounded-sm px-1 text-sm leading-[1.35] font-semibold underline underline-offset-[3px]"
            >
              {t('session.saved.edit')}
            </button>
          ) : null}
        </div>
      ))}
    </section>
  )
}
