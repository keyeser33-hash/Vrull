import { isLanguage, type Language, language as appLanguage, type LanguageStore } from '@/i18n/language'
import { syncedSetting } from './settings-row'
import type { LocalStore } from './store'

// Gjuha te cilësimet e sinkronizuara (SPEC V22): `user_settings.language`, si rikujtuesit dhe
// dita e matjes. Telefoni mban edhe kopjen e vet (i18n/language.ts), që app-i të nisë në gjuhën
// e duhur para hyrjes dhe pa pritur bazën. Rregullat: `syncedSetting`.

const setting = syncedSetting<Language>('language', isLanguage)

/** Gjuha e ruajtur te cilësimet, ose null kur nuk ka rresht ose rreshti nuk e ka ende. */
export const savedLanguage = (store: LocalStore) => setting.saved(store)

/** Zgjedhja e përdoruesit te Cilësimet; pa rresht hyn te rreshti kur ai krijohet (adoptSavedLanguage). */
export const chooseLanguage = (store: LocalStore, next: Language, phone: LanguageStore = appLanguage) => setting.choose(store, next, phone)

/** Në nisje dhe pas çdo sinkronizimi. */
export const adoptSavedLanguage = (store: LocalStore, phone: LanguageStore = appLanguage) => setting.adopt(store, phone)
