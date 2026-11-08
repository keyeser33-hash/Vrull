import type { Language, LanguageStore } from '@/i18n/language'

/**
 * Android-i shfaq disa njoftime pa app-in (p.sh. "Vrull u përditësua" pas përditësimit, që e nis
 * AppReplacedReceiver.java), ndaj e mban gjuhën e app-it te SharedPreferences: dërgohet në nisje
 * dhe në çdo ndërrim. Pa vlerë (p.sh. pas përditësimit nga v1), Android-i përdor shqipen.
 */
export function shareLanguageWithAndroid(store: Pick<LanguageStore, 'get' | 'subscribe'>, send: (lang: Language) => Promise<unknown>) {
  const share = () => {
    // Njoftimi mbetet në shqip kur plugin-i dështon; app-i nuk pret.
    send(store.get()).catch(() => undefined)
  }
  share()
  return store.subscribe(share)
}
