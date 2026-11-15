import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

/**
 * Fusha e orës: ora shfaqet gjithmonë me 24 orë (`fmt.time`), pavarësisht gjuhës së telefonit, dhe nuk pritet kurrë;
 * zgjedhësi është `<input type="time">` i vërtetë i padukshëm mbi tekstin, që prekja hap zgjedhësin e telefonit.
 * `id`/`aria-label` shkojnë te input-i. Kutia (`className`) mban kufirin, 44 px dhe shkronjat.
 */
export function TimeField({
  id,
  value,
  onChange,
  label,
  className,
  align = 'center',
}: {
  id?: string
  value: string
  onChange: (time: string) => void
  /** Emri i fushës kur nuk ka `<label htmlFor>`. */
  label?: string
  className?: string
  align?: 'center' | 'start'
}) {
  const { fmt } = useI18n()
  const match = /^(\d{1,2}):(\d{2})/.exec(value)
  const shown = match ? fmt.time(new Date(2000, 0, 1, Number(match[1]), Number(match[2]))) : '--:--'
  return (
    <span
      className={cn(
        'relative flex h-touch min-w-0 items-center tabular-nums has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-foreground',
        align === 'center' ? 'justify-center' : 'justify-start',
        className,
      )}
    >
      <span aria-hidden="true" data-time-text className="pointer-events-none whitespace-nowrap">
        {shown}
      </span>
      <input
        id={id}
        type="time"
        aria-label={label}
        value={value}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      />
    </span>
  )
}
