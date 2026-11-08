import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { currentI18n } from '@/i18n'
import { APP_NAME } from '@/lib/app-name'
import { currentUserId, db } from './app-data'
import { buildExport, exportFileName } from './export'

/**
 * Përgatit kopjen JSON dhe ia jep përdoruesit: në Android me menynë e ndarjes (Drive, Skedarët,
 * email), në shfletues si shkarkim. Kthen false kur përdoruesi e mbyll menynë pa zgjedhur.
 */
export async function shareExport(): Promise<boolean> {
  const file = await buildExport(db, { version: __APP_VERSION__, userId: currentUserId() })
  const name = exportFileName(new Date())
  const json = JSON.stringify(file, null, 2)

  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = Object.assign(document.createElement('a'), { href: url, download: name })
    link.click()
    URL.revokeObjectURL(url)
    return true
  }

  const { uri } = await Filesystem.writeFile({ path: name, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 })
  try {
    await Share.share({ title: APP_NAME, files: [uri], dialogTitle: currentI18n().t('settings.export') })
    return true
  } catch (error) {
    // Mbyllja e menysë pa zgjedhur nuk është gabim.
    if (error instanceof Error && /cancel/i.test(error.message)) return false
    throw error
  }
}
