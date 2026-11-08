import { cameraConstraints, cameraErrorReason, clipTime, pickVideoType } from './form-camera'

describe('kamera e videos së formës', () => {
  it('zgjedh MP4 kur WebView-i e regjistron (Chrome 126+), përndryshe WebM', () => {
    expect(pickVideoType(() => true)).toEqual({ mimeType: 'video/mp4;codecs=avc1', type: 'video/mp4' })
    expect(pickVideoType((mime) => mime === 'video/mp4')).toEqual({ mimeType: 'video/mp4', type: 'video/mp4' })
    expect(pickVideoType((mime) => mime.startsWith('video/webm'))).toEqual({ mimeType: 'video/webm;codecs=vp9', type: 'video/webm' })
    expect(pickVideoType((mime) => mime === 'video/webm')).toEqual({ mimeType: 'video/webm', type: 'video/webm' })
    expect(pickVideoType(() => false)).toBeNull()
  })

  it('kërkon vetëm videon (pa zë), 720p me 30 kuadro, me kamerën e zgjedhur', () => {
    expect(cameraConstraints('environment')).toEqual({
      audio: false,
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
    })
    expect(cameraConstraints('user').video).toMatchObject({ facingMode: { ideal: 'user' } })
  })

  it('arsyeja kur kamera nuk hapet: leja, mungesa e kamerës, ose WebView pa regjistrim', () => {
    expect(cameraErrorReason(new DOMException('x', 'NotAllowedError'))).toBe('denied')
    expect(cameraErrorReason(new DOMException('x', 'SecurityError'))).toBe('denied')
    expect(cameraErrorReason(new DOMException('x', 'NotFoundError'))).toBe('unavailable')
    expect(cameraErrorReason(new DOMException('x', 'NotReadableError'))).toBe('unavailable')
    expect(cameraErrorReason(new Error('çfarëdo'))).toBe('unavailable')
  })

  it('koha e videos: 0:24, 1:00, me sekonda të plota', () => {
    expect(clipTime(0)).toBe('0:00')
    expect(clipTime(24.2)).toBe('0:24')
    expect(clipTime(59.6)).toBe('0:59')
    expect(clipTime(60)).toBe('1:00')
    expect(clipTime(75)).toBe('1:15')
  })
})
