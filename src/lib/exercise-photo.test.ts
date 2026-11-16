import { bundledPhotoUrl, loadPhoto, type PhotoCache, remotePhotoUrl } from './exercise-photo'

// Fotot e ushtrimeve (SPEC §0.3a, V10): ato të Shortcut to Size janë në app; të tjerat merren nga
// free-exercise-db kur ka internet dhe ruhen në telefon. Pa to: "Pa foto", kurrë një foto e shpikur.

function memoryCache(): PhotoCache & { saved: Map<string, Blob> } {
  const saved = new Map<string, Blob>()
  return {
    saved,
    match: async (url) => saved.get(url) ?? null,
    put: async (url, blob) => void saved.set(url, blob),
  }
}

const toUrl = (blob: Blob) => `blob:${blob.size}`

describe('fotot e ushtrimeve', () => {
  it('ushtrimi i Shortcut to Size ka foton në app', () => {
    expect(bundledPhotoUrl('Barbell_Bench_Press_-_Medium_Grip')).toBe('/exercise-photos/Barbell_Bench_Press_-_Medium_Grip.jpg')
    expect(bundledPhotoUrl('Arnold_Dumbbell_Press')).toBeNull()
  })

  it('burimi në internet është i fiksuar te commit-i i bibliotekës', () => {
    expect(remotePhotoUrl('Arnold_Dumbbell_Press')).toBe(
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/Arnold_Dumbbell_Press/0.jpg',
    )
  })

  it('foto e dytë (fundi i lëvizjes): në app për Shortcut to Size, 1.jpg te free-exercise-db për të tjerat', async () => {
    expect(bundledPhotoUrl('Barbell_Curl', 'end')).toBe('/exercise-photos/Barbell_Curl-end.jpg')
    expect(bundledPhotoUrl('Arnold_Dumbbell_Press', 'end')).toBeNull()
    expect(remotePhotoUrl('Arnold_Dumbbell_Press', 'end')).toBe(
      'https://raw.githubusercontent.com/yuhonas/free-exercise-db/f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5/exercises/Arnold_Dumbbell_Press/1.jpg',
    )
    const cache = memoryCache()
    const fetchPhoto = vi.fn(async () => new Blob(['end'], { type: 'image/jpeg' }))
    expect(await loadPhoto('Barbell_Curl', { online: true, cache, fetchPhoto, toUrl }, 'end')).toBe('/exercise-photos/Barbell_Curl-end.jpg')
    expect(await loadPhoto('Arnold_Dumbbell_Press', { online: true, cache, fetchPhoto, toUrl }, 'end')).toBe('blob:3')
    expect(fetchPhoto).toHaveBeenCalledWith(remotePhotoUrl('Arnold_Dumbbell_Press', 'end'))
    expect(cache.saved.has(remotePhotoUrl('Arnold_Dumbbell_Press'))).toBe(false)
  })

  it('foto në app nuk kërkon rrjetin', async () => {
    const fetchPhoto = vi.fn()
    const src = await loadPhoto('Barbell_Curl', { online: true, cache: memoryCache(), fetchPhoto, toUrl })
    expect(src).toBe('/exercise-photos/Barbell_Curl.jpg')
    expect(fetchPhoto).not.toHaveBeenCalled()
  })

  it('me internet merret një herë dhe ruhet; pastaj vjen nga telefoni edhe pa internet', async () => {
    const cache = memoryCache()
    const fetchPhoto = vi.fn(async () => new Blob(['jpeg'], { type: 'image/jpeg' }))
    expect(await loadPhoto('Arnold_Dumbbell_Press', { online: true, cache, fetchPhoto, toUrl })).toBe('blob:4')
    expect(fetchPhoto).toHaveBeenCalledWith(remotePhotoUrl('Arnold_Dumbbell_Press'))
    expect(cache.saved.has(remotePhotoUrl('Arnold_Dumbbell_Press'))).toBe(true)

    fetchPhoto.mockClear()
    expect(await loadPhoto('Arnold_Dumbbell_Press', { online: false, cache, fetchPhoto, toUrl })).toBe('blob:4')
    expect(fetchPhoto).not.toHaveBeenCalled()
  })

  it('pa internet dhe pa kopje, ose kur shkarkimi dështon: pa foto', async () => {
    const fetchPhoto = vi.fn(async () => {
      throw new Error('404')
    })
    expect(await loadPhoto('Arnold_Dumbbell_Press', { online: false, cache: memoryCache(), fetchPhoto, toUrl })).toBeNull()
    expect(fetchPhoto).not.toHaveBeenCalled()
    expect(await loadPhoto('Arnold_Dumbbell_Press', { online: true, cache: memoryCache(), fetchPhoto, toUrl })).toBeNull()
    // Pa Cache Storage (p.sh. shfletues i vjetër) foto shfaqet, por nuk ruhet.
    const once = vi.fn(async () => new Blob(['jpg']))
    expect(await loadPhoto('Arnold_Dumbbell_Press', { online: true, cache: null, fetchPhoto: once, toUrl })).toBe('blob:3')
  })
})
