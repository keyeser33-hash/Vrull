// A vizaton dot WebView-i 3D. Jashtë modulit të modelit, që kontrolli të mos ngarkojë three.js.

let cached: boolean | undefined

export function webglAvailable() {
  if (cached === undefined) {
    try {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
      cached = Boolean(context)
      // Konteksti i provës lirohet menjëherë: WebView-i lejon pak kontekste njëkohësisht.
      context?.getExtension('WEBGL_lose_context')?.loseContext()
    } catch {
      cached = false
    }
  }
  return cached
}
