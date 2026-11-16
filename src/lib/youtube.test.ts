import { embedUrl, watchUrl, youtubeId } from './youtube'

describe('videot e YouTube (SPEC §12)', () => {
  it('nxjerr ID-në nga format e zakonshme të link-ut', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=30')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('  https://youtu.be/dQw4w9WgXcQ  ')).toBe('dQw4w9WgXcQ')
  })

  it('refuzon link-et që nuk janë video YouTube', () => {
    expect(youtubeId('https://vimeo.com/12345')).toBeNull()
    expect(youtubeId('https://www.youtube.com/watch?v=shkurt')).toBeNull()
    expect(youtubeId('https://evil.example/youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeId('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
    expect(youtubeId('jo link')).toBeNull()
  })
})

describe('sekonda e nisjes (§0.3g)', () => {
  it('embedUrl dhe watchUrl shtojnë sekondën vetëm kur është mbi zero', () => {
    expect(embedUrl('dQw4w9WgXcQ')).not.toContain('start=')
    expect(embedUrl('dQw4w9WgXcQ', 12.9)).toContain('&start=12')
    expect(embedUrl('dQw4w9WgXcQ', 12)).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ')
    expect(watchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(watchUrl('dQw4w9WgXcQ', 30)).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s')
  })
})
