import { readFileSync } from 'node:fs'
import type { CapacitorConfig } from '@capacitor/cli'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

const config: CapacitorConfig = {
  // appId nuk ndryshon më pas: Android e njeh përditësimin nga ky id dhe nga çelësi i nënshkrimit.
  appId: 'al.traininghub.app',
  appName: 'Vrull',
  webDir: 'dist',
  backgroundColor: '#000000',
  // Open Food Facts kërkon që app-i të njihet (SPEC §9); pa të dhëna personale.
  appendUserAgent: `TrainingHub/${version}`,
  android: {
    // Përmbajtja nga http:// nuk lejohet; gjithçka vjen nga app-i ose përmes https.
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      // WebView 140+ shkon nga cepi në cep dhe env(safe-area-inset-*) jep vlerat e sakta;
      // në WebView më të vjetër Capacitor shton vetë hapësirën rreth tij.
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
  },
}

export default config
