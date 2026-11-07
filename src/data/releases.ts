// Versionet e app-it te bucket-i privat app-releases (SPEC §3b, TH-23): latest.json dhe APK-ja,
// të lexuara me sesionin e përdoruesit.

interface StorageError {
  message: string
  statusCode?: string
}

export interface ReleaseStorage {
  download(path: string): Promise<{ data: Blob | null; error: StorageError | null }>
  createSignedUrl(path: string, seconds: number): Promise<{ data: { signedUrl: string } | null; error: StorageError | null }>
}

const SIGNED_URL_SECONDS = 600

export function createReleaseRemote(storage: ReleaseStorage) {
  return {
    /** latest.json si JSON i papërpunuar; null para versionit të parë në bucket. */
    async latest(): Promise<unknown> {
      const { data, error } = await storage.download('latest.json')
      if (error) {
        if (error.statusCode === '404' || /not found/i.test(error.message)) return null
        throw new Error(error.message)
      }
      return data ? JSON.parse(await data.text()) : null
    },
    async downloadUrl(apk: string) {
      const { data, error } = await storage.createSignedUrl(apk, SIGNED_URL_SECONDS)
      if (error || !data) throw new Error(error?.message ?? 'Lidhja e shkarkimit mungon')
      return data.signedUrl
    },
  }
}
