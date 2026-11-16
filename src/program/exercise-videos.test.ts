import { describe, expect, it } from 'vitest'
import { EXERCISE_VIDEOS, WITHOUT_VIDEO, chosenVideo, curatedVideos, mainVideoId } from './exercise-videos'
import { SHORTCUT_TO_SIZE } from './shortcut-to-size'
import { watchUrl, youtubeId } from '@/lib/youtube'

const BENCH = { libraryId: 'Barbell_Bench_Press_-_Medium_Grip', name: 'Bench Press' }
const SIT_UP = { libraryId: '3_4_Sit-Up', name: '3/4 Sit-Up' }
const STS_IDS = SHORTCUT_TO_SIZE.exercises.map((exercise) => exercise.id)

describe('videot e zgjedhura të ushtrimeve (SPEC §0.3g)', () => {
  it('Bench Press ka videon e NASM dhe tri video më të gjata nga autorë me titull', () => {
    const videos = curatedVideos(BENCH)
    expect(videos?.main).toMatchObject({ id: 'CayG6UYqL8g', channel: 'National Academy of Sports Medicine (NASM)', seconds: 25 })
    expect(videos?.more.map((video) => video.id)).toEqual(['1FWDde2IEPg', '8d9kbkAuZGI', 'QU-_Du-Zk3I'])
    expect(videos?.more.map((video) => video.author)).toEqual([
      'Jordan Feigenbaum, MD',
      'Dr. Aaron Horschig, DPT, CSCS',
      'Dr. Aaron Horschig, DPT, CSCS',
    ])
  })

  it('ushtrimi gjendet edhe me ID-në e bibliotekës vetëm, edhe me emrin vetëm', () => {
    expect(curatedVideos({ libraryId: BENCH.libraryId, name: 'Barbell Bench Press - Medium Grip' })?.main.id).toBe('CayG6UYqL8g')
    expect(curatedVideos({ libraryId: null, name: 'Bench Press' })?.main.id).toBe('CayG6UYqL8g')
  })

  it('ushtrimi pa video të zgjedhur kthen null', () => {
    expect(curatedVideos(SIT_UP)).toBeNull()
    expect(curatedVideos({ libraryId: null, name: 'Ushtrimi im' })).toBeNull()
  })

  it('çdo hyrje është një ushtrim i Shortcut to Size', () => {
    for (const key of Object.keys(EXERCISE_VIDEOS)) expect(STS_IDS, key).toContain(key)
  })

  it('çdo ushtrim i Shortcut to Size ka videon kryesore, përveç atyre pa burim të pranuar', () => {
    const missing = STS_IDS.filter((id) => !EXERCISE_VIDEOS[id])
    expect(missing).toEqual(WITHOUT_VIDEO)
    for (const id of WITHOUT_VIDEO) expect(STS_IDS, id).toContain(id)
  })

  it('çdo video ka ID të vlefshme, autorin, kohëzgjatjen dhe datën e kontrollit', () => {
    for (const [key, entry] of Object.entries(EXERCISE_VIDEOS)) {
      expect(entry.more.length, key).toBeLessThanOrEqual(3)
      const all = [entry.main, ...entry.more]
      expect(new Set(all.map((video) => video.id)).size, key).toBe(all.length)
      for (const video of all) {
        expect(youtubeId(watchUrl(video.id)), video.id).toBe(video.id)
        expect(video.title.trim(), video.id).not.toBe('')
        expect(video.channel.trim(), video.id).not.toBe('')
        expect(video.author.trim(), video.id).not.toBe('')
        expect(Number.isInteger(video.seconds) && video.seconds > 0, video.id).toBe(true)
        expect(video.startS >= 0 && video.startS < video.seconds, video.id).toBe(true)
        expect(video.checked, video.id).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      }
    }
  })
})

describe('videoja kryesore e ushtrimit', () => {
  it('linku i përdoruesit zë vendin e të zgjedhurit', () => {
    expect(mainVideoId(BENCH, 'https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('pa link, ose me link që nuk është i YouTube, mbetet i zgjedhuri', () => {
    expect(mainVideoId(BENCH, null)).toBe('CayG6UYqL8g')
    expect(mainVideoId(BENCH, 'https://example.com/video')).toBe('CayG6UYqL8g')
  })

  it('pa video të zgjedhur dhe pa link: null', () => {
    expect(mainVideoId(SIT_UP, null)).toBeNull()
  })
})

describe('videoja që luan "Shiko videon"', () => {
  it('e zgjedhura me sekondën e nisjes; linku i përdoruesit ka përparësi; pa asnjë: null', () => {
    const chosen = chosenVideo(BENCH, null)
    expect(chosen).toMatchObject({ id: 'CayG6UYqL8g', startS: 0, mine: false })
    expect(chosen?.video?.author).toBe('NASM')
    expect(chosenVideo(BENCH, 'https://youtu.be/dQw4w9WgXcQ')).toEqual({ id: 'dQw4w9WgXcQ', startS: 0, video: null, mine: true })
    expect(chosenVideo(BENCH, 'jo link')?.id).toBe('CayG6UYqL8g')
    expect(chosenVideo(SIT_UP, null)).toBeNull()
    expect(chosenVideo({ libraryId: null, name: 'Machine Crunch' }, null)).toBeNull()
  })
})
