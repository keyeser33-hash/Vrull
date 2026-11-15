import { type ChangeEvent, useRef } from 'react'
import { useNavigate } from 'react-router'
import { aiMonth } from '@/data/ai-usage'
import { store, useLocalQuery } from '@/data/app-data'
import { mealName, nameInSentence } from '@/i18n/domain'
import { useI18n } from '@/i18n/use-i18n'
import { compressPhoto } from '@/lib/image'
import { useOnline } from '@/lib/use-online'
import type { MealKey } from '@/nutrition/meals'

/** Foto e pjatës: 1 568 px, si etiketa (rreth 300 KB), pastaj te kutia e AI-së. */
const PHOTO_MAX_PX = 1568

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  return btoa(binary)
}

/**
 * Foto e pjatës (V2-E2-16): zgjedhësi i kamerës dhe dërgimi te kutia e AI-së me vaktin dhe ditën, që fotoja
 * të mos varet nga fjalët. Kthen input-in e fshehur (që ekrani e vendos diku) dhe `open`.
 */
export function useMealPhoto(date: string, meal: MealKey) {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const online = useOnline()
  const input = useRef<HTMLInputElement>(null)
  const limit = useLocalQuery(async () => (await aiMonth(store)).reached, [])
  async function photo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const { data } = await compressPhoto(file, PHOTO_MAX_PX, 0.85)
    navigate('/kutia', { state: { photo: { mediaType: 'image/jpeg', data: toBase64(data) }, text: t('food.photo.message', { meal: nameInSentence(mealName(t, meal), lang) }), target: { date, meal } } })
  }
  return {
    disabled: !online || !!limit,
    limitReached: !!limit,
    open: () => input.current?.click(),
    input: <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => void photo(event)} />,
  }
}
