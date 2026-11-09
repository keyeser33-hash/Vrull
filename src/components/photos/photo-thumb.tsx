import { useEffect, useState } from 'react'
import { photos } from '@/data/app-data'
import type { PhotoRef } from '@/data/photos'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'

// Fotoja e progresit si imazh (SPEC §8): bajtët lexohen nga telefoni, ose shkarkohen një herë nga
// bucket-i. E përbashkët për faqen e fotove dhe Makinën e kohës. Gjatë leximit një vend bosh; kur
// skedari nuk ka ardhur ende nga telefoni tjetër, e thotë me fjalë.

/** Adresa `blob:` e fotos: `undefined` gjatë leximit, `null` kur skedari mungon ende. */
function usePhotoUrl(photo: PhotoRef | undefined) {
  const [state, setState] = useState<{ id: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!photo) return
    let cancelled = false
    let created: string | null = null
    void photos.data(photo).then((data) => {
      if (cancelled) return
      created = data ? URL.createObjectURL(new Blob([data], { type: 'image/jpeg' })) : null
      setState({ id: photo.id, url: created })
    })
    return () => {
      cancelled = true
      if (created) URL.revokeObjectURL(created)
    }
  }, [photo])
  return photo && state?.id === photo.id ? state.url : undefined
}

/** Fotoja pa tekst alternativ: emrin (poza, data) e thotë elementi që e mban. */
export function PhotoThumb({ photo, className }: { photo: PhotoRef; className?: string }) {
  const { t } = useI18n()
  const url = usePhotoUrl(photo)
  if (url === undefined) return <span aria-hidden className={cn('block bg-surface-2', className)} />
  if (url === null) return <span className={cn('flex items-center justify-center p-2 text-center type-caption text-muted-foreground', className)}>{t('photos.waiting')}</span>
  return <img src={url} alt="" className={cn('object-cover', className)} />
}
