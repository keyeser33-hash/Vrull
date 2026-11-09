import { safeStorage } from './safe-storage'

// Teksti i kutisë së AI-së që nuk është dërguar ende (V40, SPEC §9: pa internet teksti mbetet edhe pas
// mbylljes së app-it). Vetëm në këtë telefon: një lehtësi, jo të dhënë që sinkronizohet.
const KEY = 'vrull.box.text'

export const boxText = {
  get: (): string => safeStorage.getItem(KEY) ?? '',
  set(text: string) {
    if (text.trim()) safeStorage.setItem(KEY, text)
    else safeStorage.removeItem(KEY)
  },
}
