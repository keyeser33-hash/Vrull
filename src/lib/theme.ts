// Tema e app-it, me emrat e Vrullit: OLED (parazgjedhje), Natë (`dark`) dhe Ditë (`light`). Vlerat
// e ruajtura mbeten ato të v1, që zgjedhja e përdoruesit të kalojë e paprekur. OLED mban edhe
// klasën `dark`; blloku `.oled` te globals.css vjen i fundit dhe fiton.

import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core'
import { safeStorage } from './safe-storage'

// Plugin-i lokal i app-it: android/app/src/main/java/al/traininghub/app/WindowBackgroundPlugin.java.
interface WindowBackgroundPlugin {
  setColor(options: { color: string }): Promise<void>
}
const WindowBackground = registerPlugin<WindowBackgroundPlugin>('WindowBackground')

export const THEMES = ['oled', 'dark', 'light'] as const
export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'oled'
const STORAGE_KEY = 'th-theme'
// Emrat e temave janë te katalogu: `settings.theme.<tema>` (i18n/sq.ts).

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

export function readTheme(): Theme {
  const saved = safeStorage.getItem(STORAGE_KEY)
  return isTheme(saved) ? saved : DEFAULT_THEME
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  root.classList.toggle('dark', theme !== 'light')
  root.classList.toggle('oled', theme === 'oled')

  // Shiriti i statusit merr ngjyrën e sfondit nga tokenat, pa ngjyrë të shkruar në kod.
  const meta = document.querySelector('meta[name="theme-color"]')
  const background = getComputedStyle(root).getPropertyValue('--background').trim()
  if (meta && background) meta.setAttribute('content', background)

  syncSystemBars(theme, background)
}

// Në Android, ora dhe bateria lart duhet të lexohen mbi sfondin e temës: ikona të çelëta mbi
// OLED dhe të errët, të errëta mbi temën e çelët. Në WebView para versionit 140, Android e
// vendos faqen poshtë shiritave dhe pas tyre duket dritarja, ndaj edhe ajo merr sfondin e temës.
// SystemBars.setStyle e kthen dritaren në ngjyrën e nisjes, prandaj ngjyra vendoset pas tij.
function syncSystemBars(theme: Theme, background: string) {
  if (!Capacitor.isNativePlatform()) return
  const style = theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark
  SystemBars.setStyle({ style })
    .catch(() => {
      // Pa plugin-in, ikonat mbeten si në nisje; tema e app-it nuk varet prej tyre.
    })
    .then(() => {
      const color = toHex6(background)
      return color ? WindowBackground.setColor({ color }) : undefined
    })
    .catch(() => {
      // Ngjyrë e panjohur ose plugin që mungon: dritarja mbetet e zezë si në nisje.
    })
}

// Android (Color.parseColor) pranon vetëm formën me gjashtë shifra; build-i i shkurton tokenat
// në tre shifra kur munden (e zeza e OLED-it del me tre).
function toHex6(value: string) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return value
  if (/^#[0-9a-f]{3}$/i.test(value)) {
    return `#${[...value.slice(1)].map((digit) => digit + digit).join('')}`
  }
  return ''
}

export function saveTheme(theme: Theme) {
  applyTheme(theme)
  // Pa ruajtje (p.sh. modalitet privat), tema vlen për këtë seancë.
  safeStorage.setItem(STORAGE_KEY, theme)
}
