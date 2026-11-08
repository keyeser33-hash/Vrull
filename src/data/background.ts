import { type Background, background as appBackground, type BackgroundStore, isBackground } from '@/lib/background'
import { syncedSetting } from './settings-row'
import type { LocalStore } from './store'

// Sfondi te cilësimet e sinkronizuara (V2-E1-05): `user_settings.background`, si gjuha
// (data/language.ts). Telefoni mban kopjen e vet (lib/background.ts), që korniza të mos presë bazën.

const setting = syncedSetting<Background>('background', isBackground)

/** Sfondi i ruajtur te cilësimet, ose null kur nuk ka rresht ose rreshti nuk e ka ende (v1). */
export const savedBackground = (store: LocalStore) => setting.saved(store)

/** Zgjedhja te Pamja. */
export const chooseBackground = (store: LocalStore, next: Background, phone: BackgroundStore = appBackground) => setting.choose(store, next, phone)

/** Në nisje dhe pas çdo sinkronizimi. */
export const adoptSavedBackground = (store: LocalStore, phone: BackgroundStore = appBackground) => setting.adopt(store, phone)
