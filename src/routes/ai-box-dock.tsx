import { Link } from 'react-router'
import { Icon } from '@/components/ui/icons'
import { useI18n } from '@/i18n/use-i18n'
import { boxText } from '@/lib/box-text'

// Kutia e AI-së te Sot (V40; bordi V22-Sot-Kutia): poshtë, mbi tab-bar-in, gjithmonë gati. Një prekje
// hap ekranin e kutisë (`/kutia`); teksti që pret dërgimin del këtu, që të mos harrohet.
export function AiBoxDock() {
  const { t } = useI18n()
  const saved = boxText.get().trim()
  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--spacing-tab-bar)+var(--safe-bottom))] z-20 border-t border-border bg-background px-4 pt-2.5 pb-2.5">
      <Link
        to="/kutia"
        aria-label={saved ? `${t('box.dock.label')}: ${t('box.dock.saved')}` : t('box.dock.label')}
        className="mx-auto flex min-h-[52px] w-full max-w-[448px] items-center gap-3 rounded-lg border border-subtle bg-surface px-3.5 text-left"
      >
        <Icon name="shkendija" size={18} className="shrink-0 text-data" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={saved ? 'truncate type-body-l text-foreground' : 'truncate type-body-l text-muted-foreground'}>{saved || t('box.dock.placeholder')}</span>
          <span className="type-caption text-muted-foreground">{saved ? t('box.dock.saved') : t('box.dock.hint')}</span>
        </span>
        <Icon name="dergo" size={20} className="shrink-0 text-muted-foreground" />
      </Link>
    </div>
  )
}
