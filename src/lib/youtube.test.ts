import { youtubeId } from './youtube'

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
