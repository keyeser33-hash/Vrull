import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

// Butoni mbrapa i Android-it. Pa këtë dëgjues, plugin-i App nuk bën asgjë në fillim të historisë.
// Kthehet te faqja e mëparshme; në fillim të historisë e çon app-in në sfond, si app-et e tjera
// të Android-it, pa e mbyllur, që një stërvitje e hapur dhe timer-i të mos humbasin.
export function registerBackButton(win: Window = window) {
  if (!Capacitor.isNativePlatform()) return
  void App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) win.history.back()
    else void App.minimizeApp()
  })
}
