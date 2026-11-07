// Komponenti i ikonave të Omal UI v2. Shtigjet jetojnë te icon-paths.ts.
import { ICONS, type IconName } from './icon-paths'

export type { IconName }

export function Icon({ name, size = 24, label, className = "" }: { name: IconName; size?: number; label?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={"ic " + className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}
