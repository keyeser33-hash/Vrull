// Videoja e një ushtrimi (SPEC §12): përdoruesi ngjit link-un; app-i nxjerr ID-në dhe e luan
// nga youtube-nocookie.com. Vetëm link-e https të YouTube; çdo gjë tjetër refuzohet.

const ID = /^[A-Za-z0-9_-]{11}$/
const HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'])

export function youtubeId(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' || !HOSTS.has(parsed.hostname)) return null
  const candidate =
    parsed.hostname === 'youtu.be'
      ? parsed.pathname.slice(1)
      : parsed.pathname === '/watch'
        ? (parsed.searchParams.get('v') ?? '')
        : (/^\/(?:shorts|embed)\/([^/]+)/.exec(parsed.pathname)?.[1] ?? '')
  return ID.test(candidate) ? candidate : null
}

export const embedUrl = (id: string) => `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`
export const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`
