// Komponenti i ikonave të Vrullit: vijë 2 px në rrjetë 24 px, `currentColor`, pa mbushje (përveç
// pikës së një shenje). Shtigjet: icon-paths-vrull.ts (sistemi), icon-paths.ts dhe icon-paths-app.ts
// (ikonat e v1, deri sa ekranet të marrin ikonat e Vrullit). Ikona pa tekst ka gjithnjë `label`.
import { ICONS, type IconName as LegacyIconName } from './icon-paths'
import { APP_ICONS } from './icon-paths-app'
import { VRULL_ICONS } from './icon-paths-vrull'

export type IconName = LegacyIconName | keyof typeof APP_ICONS | keyof typeof VRULL_ICONS
const PATHS: Record<IconName, string> = { ...ICONS, ...APP_ICONS, ...VRULL_ICONS }

export function Icon({ name, size = 24, label, className = '' }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={'ic shrink-0 ' + className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  )
}
