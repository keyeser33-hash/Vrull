// Tema e app-it: light, dark ose OLED (parazgjedhje). OLED mban edhe klasën `dark`,
// që çdo utility `dark:` të vlejë; blloku `.oled` te globals.css vjen i fundit dhe fiton.

import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

export const THEMES = ['oled', 'dark', 'light'] as const
export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'oled'
const STORAGE_KEY = 'th-theme'

export const THEME_LABELS: Record<Theme, string> = {
  oled: 'OLED',
  dark: 'E errët',
  light: 'E çelët',
}

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

export function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return isTheme(saved) ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  root.classList.toggle('dark', theme !== 'light')
  root.classList.toggle('oled', theme === 'oled')

  // Shiriti i statusit merr ngjyrën e sfondit nga tokenat, pa ngjyrë të shkruar në kod.
  const meta = document.querySelector('meta[name="theme-color"]')
  const background = getComputedStyle(root).getPropertyValue('--background').trim()
  if (meta && background) meta.setAttribute('content', background)

  syncSystemBars(theme)
}

// Në Android, ora dhe bateria lart duhet të lexohen mbi sfondin e temës:
// ikona të çelëta mbi OLED dhe të errët, të errëta mbi temën e çelët.
function syncSystemBars(theme: Theme) {
  if (!Capacitor.isNativePlatform()) return
  const style = theme === 'light' ? SystemBarsStyle.Light : SystemBarsStyle.Dark
  SystemBars.setStyle({ style }).catch(() => {
    // Pa plugin-in, shiritat mbeten si në nisje; tema e app-it nuk varet prej tyre.
  })
}

export function saveTheme(theme: Theme) {
  applyTheme(theme)
  try {
    window.localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Ruajtja mund të mungojë (p.sh. modalitet privat); tema vlen për këtë seancë.
  }
}
