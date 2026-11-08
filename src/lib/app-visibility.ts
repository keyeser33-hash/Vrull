import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'

/**
 * Thërret `listener(false)` kur app-i del në sfond dhe `listener(true)` kur kthehet përpara, një herë për
 * çdo ndryshim. WebView-ja e Android-it nuk e jep gjithmonë `visibilitychange` kur shtypet Home (prova në
 * emulator: regjistrimi i videos vazhdoi në sfond), ndaj në telefon vlejnë edhe pause/resume i Capacitor-it;
 * cili sinjal vjen i pari, ai vendos. Kthen funksionin që i heq të dy dëgjuesit.
 */
export function onAppVisibility(listener: (visible: boolean) => void): () => void {
  let visible = document.visibilityState !== 'hidden'
  let stopped = false
  const set = (next: boolean) => {
    if (stopped || next === visible) return
    visible = next
    listener(next)
  }
  const onChange = () => set(document.visibilityState !== 'hidden')
  document.addEventListener('visibilitychange', onChange)
  const handles = Capacitor.isNativePlatform() ? [App.addListener('pause', () => set(false)), App.addListener('resume', () => set(true))] : []
  return () => {
    stopped = true
    document.removeEventListener('visibilitychange', onChange)
    for (const handle of handles) void handle.then((value) => value.remove())
  }
}
