import { Capacitor, registerPlugin } from '@capacitor/core'
import type { MusicBridge } from './music'

// Plugin-i lokal i app-it: android/app/src/main/java/al/traininghub/app/MusicPlugin.java. I disponueshëm
// vetëm kur ura native e shpall (app-i në Android); në shfletues muzika nuk ofrohet.

type NativeMusic = Omit<MusicBridge, 'available'>

const Music = registerPlugin<NativeMusic>('Music')

export const nativeMusicBridge: MusicBridge = {
  available: () => Capacitor.isPluginAvailable('Music'),
  getAccess: () => Music.getAccess(),
  openAccessSettings: () => Music.openAccessSettings(),
  openAppInfo: () => Music.openAppInfo(),
  getNowPlaying: () => Music.getNowPlaying(),
  control: (options) => Music.control(options),
  openApp: () => Music.openApp(),
  startListening: () => Music.startListening(),
  stopListening: () => Music.stopListening(),
  addListener: (event, listener) => Music.addListener(event, listener),
}
