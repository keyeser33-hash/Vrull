import { Capacitor, registerPlugin } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { APP_NAME } from './app-name'

// Karta e javës jashtë app-it (V43, SPEC §0.3c): "Ndaj" me menynë e ndarjes së Android-it
// (@capacitor/share, si kopja JSON te `data/share-export.ts`) dhe "Ruaj në galeri" te Pictures/Vrull
// me MediaStore (GalleryPlugin.java). Në shfletues të dyja shkarkojnë PNG-në.

interface GalleryPlugin {
  /** Ruan PNG-në te Pictures/Vrull; `denied` kur Android-i 9 e më i vjetër s'e dha lejen e ruajtjes. */
  saveImage(options: { data: string; name: string }): Promise<{ saved: boolean; denied?: boolean }>
}

const Gallery = registerPlugin<GalleryPlugin>('Gallery')

export type SaveResult = 'saved' | 'downloaded' | 'denied'

function download(base64: string, name: string) {
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: 'image/png' }))
  const link = Object.assign(document.createElement('a'), { href: url, download: name })
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** "Ruaj në galeri": te Pictures/Vrull në telefon, shkarkim në shfletues. */
export async function saveImageToGallery(base64: string, name: string): Promise<SaveResult> {
  if (!Capacitor.isNativePlatform()) {
    download(base64, name)
    return 'downloaded'
  }
  const result = await Gallery.saveImage({ data: base64, name })
  return result.saved ? 'saved' : 'denied'
}

/** "Ndaj": menyja e Android-it me PNG-në nga cache; false kur përdoruesi e mbyll pa zgjedhur. */
export async function shareImage(base64: string, name: string, title: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    download(base64, name)
    return true
  }
  const { uri } = await Filesystem.writeFile({ path: name, data: base64, directory: Directory.Cache })
  try {
    await Share.share({ title: APP_NAME, files: [uri], dialogTitle: title })
    return true
  } catch (error) {
    // Mbyllja e menysë pa zgjedhur nuk është gabim.
    if (error instanceof Error && /cancel/i.test(error.message)) return false
    throw error
  }
}
