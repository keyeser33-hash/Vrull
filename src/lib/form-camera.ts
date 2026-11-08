import { FORM_VIDEO_LIMITS, type VideoType } from '@/data/form-videos'

// Kamera e videos së formës (V2-E1-13, SPEC §12): pamja e drejtpërdrejtë dhe regjistrimi brenda
// app-it, me getUserMedia dhe MediaRecorder të WebView-it, pa varësi të re. Capacitor e kalon kërkesën
// e kamerës te leja CAMERA e Android-it (BridgeWebChromeClient.onPermissionRequest). Kështu app-i
// vendos gjatësinë, rezolucionin dhe shpejtësinë e bitëve: kamera e sistemit (<input capture>) nuk merr
// kufij dhe një video 1080p prej 30 s kalon 50 MB, kufirin e një ngarkimi në planin falas.

export type Facing = 'environment' | 'user'

const CANDIDATES: readonly { mimeType: string; type: VideoType }[] = [
  { mimeType: 'video/mp4;codecs=avc1', type: 'video/mp4' },
  { mimeType: 'video/mp4', type: 'video/mp4' },
  { mimeType: 'video/webm;codecs=vp9', type: 'video/webm' },
  { mimeType: 'video/webm;codecs=vp8', type: 'video/webm' },
  { mimeType: 'video/webm', type: 'video/webm' },
]

/** MP4 kur WebView-i e regjistron (Chrome 126+, MP4 i fragmentuar), përndryshe WebM; null pa regjistrim. */
export function pickVideoType(isSupported: (mimeType: string) => boolean) {
  return CANDIDATES.find((candidate) => isSupported(candidate.mimeType)) ?? null
}

/** Vetëm videoja, pa zë (pa lejen e mikrofonit dhe më e vogël), 720p me 30 kuadro. */
export function cameraConstraints(facing: Facing): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      facingMode: { ideal: facing },
      width: { ideal: FORM_VIDEO_LIMITS.width },
      height: { ideal: FORM_VIDEO_LIMITS.height },
      frameRate: { ideal: FORM_VIDEO_LIMITS.frameRate, max: FORM_VIDEO_LIMITS.frameRate },
    },
  }
}

export type CameraErrorReason = 'denied' | 'unavailable' | 'unsupported'

export class CameraError extends Error {
  readonly reason: CameraErrorReason
  constructor(reason: CameraErrorReason) {
    super(`Kamera nuk u hap: ${reason}`)
    this.reason = reason
  }
}

/** "denied" kur leja e kamerës mungon; "unavailable" për çdo arsye tjetër (pa kamerë, e zënë). */
export function cameraErrorReason(error: unknown): CameraErrorReason {
  if (error instanceof CameraError) return error.reason
  const name = (error as { name?: string } | null)?.name
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable'
}

/** "0:24": minutat dhe sekondat e plota. */
export function clipTime(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** Një regjistrim i mbaruar, para se të ruhet. */
export interface Take {
  blob: Blob
  type: VideoType
  durationS: number
  width: number | null
  height: number | null
}

export interface Camera {
  stream: MediaStream
  facing: Facing
  /** Nis regjistrimin; te kufiri i gjatësisë thërret `onLimit` (që zakonisht thërret `stop`). */
  record(onLimit: () => void): void
  stop(): Promise<Take>
  /** Fik kamerën; një regjistrim i hapur hidhet. */
  close(): void
}

export async function openCamera(facing: Facing): Promise<Camera> {
  const format = typeof MediaRecorder === 'undefined' ? null : pickVideoType((mimeType) => MediaRecorder.isTypeSupported(mimeType))
  if (!navigator.mediaDevices?.getUserMedia || !format) throw new CameraError('unsupported')
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia(cameraConstraints(facing))
  } catch (error) {
    throw new CameraError(cameraErrorReason(error))
  }
  let recorder: MediaRecorder | null = null
  // Skedari i regjistrimit të hapur, kur MediaRecorder-i ndalet.
  let finished: Promise<Blob> | null = null
  let limit: ReturnType<typeof setTimeout> | undefined
  let startedAt = 0
  const tracks = () => stream.getTracks().forEach((track) => track.stop())
  return {
    stream,
    facing,
    record(onLimit) {
      const chunks: Blob[] = []
      const active = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: FORM_VIDEO_LIMITS.videoBitsPerSecond })
      active.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      })
      finished = new Promise((resolve) => active.addEventListener('stop', () => resolve(new Blob(chunks, { type: format.type }))))
      recorder = active
      active.start(1000)
      startedAt = performance.now()
      limit = setTimeout(onLimit, FORM_VIDEO_LIMITS.maxSeconds * 1000)
    },
    async stop() {
      clearTimeout(limit)
      const active = recorder
      const file = finished
      recorder = null
      finished = null
      if (!active || !file || active.state === 'inactive') throw new Error('Nuk ka regjistrim.')
      const durationS = Math.min((performance.now() - startedAt) / 1000, FORM_VIDEO_LIMITS.maxSeconds)
      const settings = stream.getVideoTracks()[0]?.getSettings() ?? {}
      active.stop()
      return { blob: await file, type: format.type, durationS, width: settings.width ?? null, height: settings.height ?? null }
    },
    close() {
      clearTimeout(limit)
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      recorder = null
      finished = null
      tracks()
    },
  }
}
