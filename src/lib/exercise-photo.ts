import { type RefObject, useEffect, useState } from 'react'
import bundled from '@/program/exercise-photos.json'
import { useOnline } from './use-online'

// Fotot e ushtrimeve (SPEC §0.3a "Fotot e ushtrimeve", V10): free-exercise-db (Unlicense, domain
// publik). Ato të Shortcut to Size janë në app (tools/exercise-library/photos.mjs) dhe shfaqen pa
// internet; të tjerat merren nga i njëjti commit kur ka internet dhe ruhen në telefon (Cache Storage),
// që të mbeten edhe pa rrjet. Pa foto: vend-mbajtësi "Pa foto", kurrë një imazh i shpikur. Ekrani
// nuk e pret rrjetin: foto shfaqet kur vjen.

const BUNDLED = new Set<string>(bundled.ids)
const COMMIT = bundled.source.replace(/^free-exercise-db@/, '')
const CACHE_NAME = 'exercise-photos-v1'

/** Foto e paketuar në app, ose null kur ushtrimi s'e ka. */
export function bundledPhotoUrl(libraryId: string): string | null {
  return BUNDLED.has(libraryId) ? `${import.meta.env.BASE_URL}exercise-photos/${libraryId}.jpg` : null
}

/** Foto e parë e ushtrimit te free-exercise-db, në commit-in e bibliotekës. */
export function remotePhotoUrl(libraryId: string): string {
  return `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}/exercises/${encodeURIComponent(libraryId)}/0.jpg`
}

export interface PhotoCache {
  match(url: string): Promise<Blob | null>
  put(url: string, blob: Blob): Promise<void>
}

/** Cache Storage i shfletuesit (WebView-i i Android-it e ka), ose null kur mungon. */
export function browserPhotoCache(): PhotoCache | null {
  if (typeof caches === 'undefined') return null
  return {
    async match(url) {
      const response = await (await caches.open(CACHE_NAME)).match(url)
      return response ? response.blob() : null
    },
    async put(url, blob) {
      await (await caches.open(CACHE_NAME)).put(url, new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } }))
    },
  }
}

async function fetchPhoto(url: string): Promise<Blob> {
  const response = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error(`Foto ${response.status}`)
  return response.blob()
}

export interface PhotoDeps {
  online: boolean
  cache: PhotoCache | null
  fetchPhoto: (url: string) => Promise<Blob>
  toUrl: (blob: Blob) => string
}

/** Adresa e fotos: nga app-i, nga telefoni, ose nga interneti një herë; null kur s'ka foto. */
export async function loadPhoto(libraryId: string, deps: PhotoDeps): Promise<string | null> {
  const local = bundledPhotoUrl(libraryId)
  if (local) return local
  const url = remotePhotoUrl(libraryId)
  try {
    const saved = await deps.cache?.match(url)
    if (saved) return deps.toUrl(saved)
    if (!deps.online) return null
    const blob = await deps.fetchPhoto(url)
    await deps.cache?.put(url, blob).catch(() => undefined)
    return deps.toUrl(blob)
  } catch {
    return null
  }
}

// Një adresë për foto gjatë gjithë jetës së app-it, që lista të mos krijojë blob-e të reja në çdo vizatim.
const loaded = new Map<string, string>()

export type PhotoState = { status: 'loading' | 'missing'; src: null } | { status: 'ready'; src: string }

const MISSING: PhotoState = { status: 'missing', src: null }
const LOADING: PhotoState = { status: 'loading', src: null }

/**
 * Foto e ushtrimit për ekranet. `visible`: lista e merr foton nga interneti vetëm kur rreshti
 * duket; fotot e paketuara dhe ato të ruajtura shfaqen menjëherë. "loading" derisa të dihet, që
 * vend-mbajtësi të mos thotë "Pa foto" para kohe.
 */
export function useExercisePhoto(libraryId: string | null, visible = true): PhotoState {
  const online = useOnline()
  const known = libraryId ? (bundledPhotoUrl(libraryId) ?? loaded.get(libraryId) ?? null) : null
  const [result, setResult] = useState<{ id: string; src: string | null } | null>(null)
  useEffect(() => {
    if (!libraryId || known) return
    let cancelled = false
    void loadPhoto(libraryId, {
      online: online && visible,
      cache: browserPhotoCache(),
      fetchPhoto,
      toUrl: (blob) => URL.createObjectURL(blob),
    }).then((src) => {
      if (cancelled) return
      if (src) {
        loaded.set(libraryId, src)
        setResult({ id: libraryId, src })
      } else if (!online || visible) setResult({ id: libraryId, src: null })
    })
    return () => {
      cancelled = true
    }
  }, [libraryId, known, online, visible])
  if (!libraryId) return MISSING
  if (known) return { status: 'ready', src: known }
  if (result?.id !== libraryId) return LOADING
  return result.src ? { status: 'ready', src: result.src } : MISSING
}

/** A duket elementi në ekran (IntersectionObserver); pa të, jo: lista nuk shkarkon pa nevojë. */
export function useInView(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setInView(true)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return inView
}
