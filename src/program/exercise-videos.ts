import { youtubeId } from '@/lib/youtube'

// Videot YouTube të zgjedhura për ushtrimet (SPEC §0.3g, §12), të njëjta për çdo përdorues, prandaj
// vijnë me app-in dhe jo nga baza në cloud. Çelësi është ID-ja e free-exercise-db (library.json);
// ushtrimet pa ID në bibliotekë marrin çelës kur shkruhet udhëzuesi i tyre (V2-E3-21).
// Burimet: organizata ose autorë me titull të verifikueshëm (PhD, CSCS, MD, DPT; §0.3g).
// Çdo video u hap me built-in browser: titulli, kanali dhe kohëzgjatja nga ytInitialPlayerResponse
// (lengthSeconds, si e tregon player-i), dhe luajtja brenda app-it (playableInEmbed).

export interface ExerciseVideo {
  /** ID-ja e YouTube (11 shenja). */
  id: string
  /** Titulli si në YouTube. */
  title: string
  /** Kanali si në YouTube. */
  channel: string
  /** Organizata ose autori me titull që e bën videon burim të pranuar. */
  author: string
  seconds: number
  /** Sekonda ku nis demonstrimi. */
  startS: number
  /** Data e kontrollit me shfletues. */
  checked: string
}

export interface ExerciseVideos {
  /** "Shiko videon" te lëvizja dhe te faqja e ushtrimit. */
  main: ExerciseVideo
  /** "Më shumë video", poshtë udhëzuesit (deri në 3). */
  more: ExerciseVideo[]
}

export const EXERCISE_VIDEOS: Record<string, ExerciseVideos> = {
  'Barbell_Bench_Press_-_Medium_Grip': {
    main: {
      id: 'CayG6UYqL8g',
      title: 'How to do a Barbell Bench Press | Proper Form & Technique | NASM',
      channel: 'National Academy of Sports Medicine (NASM)',
      author: 'NASM',
      seconds: 25,
      startS: 0,
      checked: '2026-11-15',
    },
    more: [
      {
        id: '1FWDde2IEPg',
        title: 'The Bench Press Prescription: An in-depth guide on how to BENCH!',
        channel: 'Barbell Medicine',
        author: 'Jordan Feigenbaum, MD',
        seconds: 1042,
        startS: 0,
        checked: '2026-11-15',
      },
      {
        id: '8d9kbkAuZGI',
        title: 'Stop Losing Strength With These Bench Press Mistakes!',
        channel: 'Squat University',
        author: 'Dr. Aaron Horschig, DPT, CSCS',
        seconds: 442,
        startS: 0,
        checked: '2026-11-15',
      },
      {
        id: 'QU-_Du-Zk3I',
        title: '5 Tips To Fix Shoulder Pain (BENCH PRESS)',
        channel: 'Squat University',
        author: 'Dr. Aaron Horschig, DPT, CSCS',
        seconds: 681,
        startS: 0,
        checked: '2026-11-15',
      },
    ],
  },
}

/** Videot e zgjedhura të ushtrimit sipas ID-së së bibliotekës; null kur nuk ka. */
export function curatedVideos(libraryId: string | null): ExerciseVideos | null {
  return (libraryId && EXERCISE_VIDEOS[libraryId]) || null
}

/** Videoja që luan "Shiko videon": linku i përdoruesit (§12) zë vendin e të zgjedhurit. */
export function mainVideoId(libraryId: string | null, userUrl: string | null): string | null {
  return (userUrl ? youtubeId(userUrl) : null) ?? curatedVideos(libraryId)?.main.id ?? null
}
