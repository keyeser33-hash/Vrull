import { saveImageToGallery, shareImage } from './gallery-native'

// Karta e javës jashtë app-it (V43, SPEC §0.3c): "Ruaj në galeri" me GalleryPlugin (MediaStore; `denied` kur
// Android-i 9 e më i vjetër s'e dha lejen) dhe "Ndaj" me menynë e Android-it (mbyllja pa zgjedhur nuk
// është gabim). Në shfletues të dyja shkarkojnë PNG-në. Plugin-et imitohen.

const native = vi.hoisted(() => ({
  isNative: true,
  saveImage: vi.fn(),
  writeFile: vi.fn(async () => ({ uri: 'file:///cache/vrull-java-2026-11-02.png' })),
  share: vi.fn(),
}))

vi.mock('@capacitor/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@capacitor/core')>()),
  Capacitor: { isNativePlatform: () => native.isNative },
  registerPlugin: () => ({ saveImage: native.saveImage }),
}))
vi.mock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: { writeFile: native.writeFile } }))
vi.mock('@capacitor/share', () => ({ Share: { share: native.share } }))

const NAME = 'vrull-java-2026-11-02.png'
const PNG = btoa('PNG')

describe('karta e javës në telefon', () => {
  beforeEach(() => {
    native.isNative = true
    native.saveImage.mockReset()
    native.share.mockReset()
    native.writeFile.mockClear()
  })

  it('"Ruaj në galeri": e ruajtur, ose `denied` kur Android-i s\'e dha lejen', async () => {
    native.saveImage.mockResolvedValueOnce({ saved: true })
    expect(await saveImageToGallery(PNG, NAME)).toBe('saved')
    expect(native.saveImage).toHaveBeenCalledWith({ data: PNG, name: NAME })
    native.saveImage.mockResolvedValueOnce({ saved: false, denied: true })
    expect(await saveImageToGallery(PNG, NAME)).toBe('denied')
  })

  it('"Ndaj": menyja me PNG-në nga cache; mbyllja pa zgjedhur kthen false, një gabim tjetër jo', async () => {
    native.share.mockResolvedValueOnce({})
    expect(await shareImage(PNG, NAME, 'Ndaj javën')).toBe(true)
    expect(native.writeFile).toHaveBeenCalledWith({ path: NAME, data: PNG, directory: 'CACHE' })
    expect(native.share).toHaveBeenCalledWith({ title: 'Vrull', files: ['file:///cache/vrull-java-2026-11-02.png'], dialogTitle: 'Ndaj javën' })
    native.share.mockRejectedValueOnce(new Error('Share canceled'))
    expect(await shareImage(PNG, NAME, 'Ndaj javën')).toBe(false)
    native.share.mockRejectedValueOnce(new Error('No app can handle the files'))
    await expect(shareImage(PNG, NAME, 'Ndaj javën')).rejects.toThrow('No app can handle the files')
  })

  it('në shfletues të dyja shkarkojnë PNG-në me emrin e saj', async () => {
    native.isNative = false
    const clicks: string[] = []
    // jsdom nuk i ka; mbeten, se lidhja hiqet 1 s më vonë.
    Object.assign(URL, { createObjectURL: () => 'blob:karta', revokeObjectURL: vi.fn() })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(`${this.download} ${this.getAttribute('href')}`)
    })
    try {
      expect(await saveImageToGallery(PNG, NAME)).toBe('downloaded')
      expect(await shareImage(PNG, NAME, 'Ndaj javën')).toBe(true)
      expect(clicks).toEqual([`${NAME} blob:karta`, `${NAME} blob:karta`])
      expect(native.saveImage).not.toHaveBeenCalled()
      expect(native.share).not.toHaveBeenCalled()
    } finally {
      click.mockRestore()
    }
  })
})
