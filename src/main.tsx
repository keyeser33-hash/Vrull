import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { startData } from '@/data/app-data'
import { Capacitor } from '@capacitor/core'
import { nativeUpdater } from '@/lib/app-updater-native'
import { registerBackButton } from '@/lib/back-button'
import { shareLanguageWithAndroid } from '@/lib/native-language'
import { nativeRestAlarm } from '@/lib/rest-alarm'
import { setRestAlarm } from '@/lib/use-rest-timer'
import { applyTheme, readTheme } from '@/lib/theme'
import { applyLanguage, language } from '@/i18n/language'
import '@/styles/app.css'

applyTheme(readTheme())
// `lang` i faqes (index.html: "sq") ndjek gjuhën e ruajtur para vizatimit të parë.
applyLanguage(language.get())
registerBackButton()
if (Capacitor.isNativePlatform()) {
  setRestAlarm(nativeRestAlarm)
  // Njoftimi pas përditësimit del pa app-in, në gjuhën e fundit të app-it.
  shareLanguageWithAndroid(language, nativeUpdater.setLanguage)
}
void startData()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
