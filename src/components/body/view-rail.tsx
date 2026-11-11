import { VIEW_ANGLES, type ViewAngle } from '@/body/model-camera'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Shina e këndeve të modelit 3D (SPEC §11, V53; bordi "Katër këndet e shinës"): Para, 3/4, Anash,
// Mbrapa, poshtë djathtas mbi model, në vend të "Shiko mbrapa". Butona 44 px mbi `background` me kufi
// `subtle`, që të lexohen mbi modelin në çdo temë; i zgjedhuri mbushje `foreground`. Kur pamja është
// mes dy këndeve (pas një zvarritjeje ose fokusi), asnjë nuk është i zgjedhur.

export function ViewRail({ selected, onSelect }: { selected: ViewAngle | null; onSelect: (angle: ViewAngle) => void }) {
  const { t } = useI18n()
  return (
    <div role="radiogroup" aria-label={t('bodyModel.angle.label')} className="absolute right-2 bottom-2 flex flex-col gap-0.5 rounded-lg border border-subtle bg-background p-1">
      {VIEW_ANGLES.map(({ id }) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={selected === id}
          aria-label={id === 'threeQuarter' ? t('bodyModel.angle.threeQuarter.name') : undefined}
          onClick={() => onSelect(id)}
          className={cn(
            'h-11 min-w-11 rounded-md px-1 font-display text-sm font-bold uppercase outline-none focus-visible:outline-2 focus-visible:outline-foreground',
            selected === id ? 'bg-foreground text-background' : 'text-muted-foreground',
          )}
        >
          {t(`bodyModel.angle.${id}`)}
        </button>
      ))}
    </div>
  )
}
