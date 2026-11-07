import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'
import { Capacitor } from '@capacitor/core'

// Skaneri i barkodit (TH-15): skaneri i Google Play Services përmes ML Kit. Nuk kërkon leje
// kamere; herën e parë moduli mund të jetë ende duke u shkarkuar nga Google Play.

export type ScanResult = { state: 'found'; code: string } | { state: 'cancelled' } | { state: 'installing' } | { state: 'error' }

export const canScanBarcode = () => Capacitor.isNativePlatform()

export async function scanBarcode(): Promise<ScanResult> {
  try {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable()
    if (!available) {
      void BarcodeScanner.installGoogleBarcodeScannerModule().catch(() => {})
      return { state: 'installing' }
    }
    const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE] })
    const code = barcodes[0]?.rawValue
    return code ? { state: 'found', code } : { state: 'cancelled' }
  } catch (error) {
    // Mbyllja e skanerit pa kod vjen si gabim "canceled".
    return /cancel/i.test(String((error as Error)?.message ?? error)) ? { state: 'cancelled' } : { state: 'error' }
  }
}
