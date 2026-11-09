import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { useBeatStills } from '@/components/body/beat-stills'
import { BeatBody } from '@/components/body/body-beat'
import { Sheet } from '@/components/layout/sheet'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icons'
import { InsightCard } from '@/components/ui/insight-card'
import { surfaceClass } from '@/components/ui/surface'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { type ControlResult, controlsOf, isPlaying, isYouTubeMusic, music, musicAppName, type NowPlaying, positionNow } from '@/lib/music'
import { type CurrentTempo, onResume, usePageActive, useQueueTempos, useReducedMotion } from '@/lib/music-hooks'
import { pickRestSong, pickSetSong, type Pulse, pulse as pulseOf, SET_TEMPO, wantsEnergy } from '@/lib/music-pulse'
import { emptyTaps, TAP, tap as addTap, tapTempo } from '@/lib/music-tap'
import { octave, validTempo } from '@/lib/music-tempo'
import { safeStorage } from '@/lib/safe-storage'
import type { SessionBeat } from './music-beat'
import { spokenDuration } from './session-format'
import { clock } from './training-format'

// Muzika "Trupi në ritëm" te seanca (SPEC V29, V2-E1-12; bordet "Muzika · *" dhe "Seanca"):
// - ikona te kreu i seancës (0.23; më parë mini-player-i mbi "Ruaj setin"), që hap lidhjen ose ekranin e plotë;
// - ekrani i plotë: muskujt e sotëm në prush që pulsojnë me tempon e këngës, gjysma e saj gjatë
//   pushimit, kontrollet që pranon app-i, "Pastaj" kur app-i jep radhën, ose "Kalo këngën";
// - lidhja dhe leja ("Qasja te njoftimet", "Allow restricted settings" te Android 13+);
// - "Prek ritmin" me ×2 dhe ÷2.
// Kënga ndërrohet vetëm me prekjen e përdoruesit. Pamja "Ditë e lodhur" (rëra në vend të prushit,
// tempo më e qetë) varet krejt nga gatishmëria e Etapës 3 dhe nuk ndërtohet këtu.

const LATER_KEY = 'th:music:later'

function refusalText(result: ControlResult | null, t: ReturnType<typeof useI18n>['t']) {
  if (!result) return null
  return t(result === 'no-session' ? 'music.gone' : 'music.refused')
}

const tempoLine = (beat: SessionBeat, t: ReturnType<typeof useI18n>['t']) => {
  const bpm = beat.tempo.tempo?.bpm
  return bpm ? t('music.bpm', { bpm: Math.round(bpm) }) : null
}

/**
 * Muzika te kreu i seancës (0.23, SPEC §0.3c; bordi "Seanca"): një ikonë 44 px që hap atë që hapte
 * mini-player-i: "Lidh muzikën tënde" pa leje, ekranin "Trupi në ritëm" me lejen (edhe kur s'luan asgjë,
 * që e thotë vetë). Kur luan një këngë, një pikë `ember-text` te ikona e tregon dhe emri për lexuesin e
 * ekranit mban këngën dhe tempon; "Pauzë" dhe "Kënga tjetër" janë te ekrani i plotë, një prekje larg, dhe
 * te njoftimi i seancës. Jashtë telefonit (pa plugin), para përgjigjes së parë dhe pas "Më vonë" për
 * këtë seancë: asgjë.
 */
export function MusicButton({ beat, sessionId, onOpen, onConnect }: { beat: SessionBeat; sessionId: string; onOpen: () => void; onConnect: () => void }) {
  const { t } = useI18n()
  const { status, session } = beat
  if (status === 'unavailable' || status === 'unknown') return null
  if (status === 'no-access') {
    if (safeStorage.getItem(LATER_KEY) === sessionId) return null
    return (
      <Button variant="ghost" size="icon" aria-label={t('music.connectCard')} aria-haspopup="dialog" className="rounded-pill" onClick={onConnect}>
        <Icon name="muzika" size={22} />
      </Button>
    )
  }
  const label = session
    ? t('music.open', { song: [session.title ?? t('music.untitled'), session.artist, tempoLine(beat, t)].filter(Boolean).join(', ') })
    : t('music.openIdle')
  return (
    <Button variant="ghost" size="icon" aria-label={label} aria-haspopup="dialog" className="relative rounded-pill" onClick={onOpen}>
      <Icon name="muzika" size={22} />
      {session && isPlaying(session) ? <span data-playing aria-hidden className="absolute top-2 right-2 size-2 rounded-pill bg-ember-text" /> : null}
    </Button>
  )
}

function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [enabled])
  return now
}

export interface BeatContext {
  exercise: string
  set: number
  sets: number
}

export interface BeatRest {
  remaining: number
  total: number
  /** "Seti 2 nga 4 · 62,5 × 9–11" */
  next: { exercise: string | null; text: string } | null
}

/** Dialogu i plotë mbi seancën (si kamera e videos), me fokusin brenda dhe "Escape" që mbyll. */
function Overlay({ labelledBy, children }: { labelledBy: string; children: ReactNode }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto overflow-x-hidden bg-background pt-[var(--safe-top)] pb-[var(--safe-bottom)] text-foreground"
    >
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">{children}</div>
    </div>
  )
}

/** Ekrani "Trupi në ritëm" (bordet "Muzika · Trupi në ritëm" dhe "Muzika · Pushimi"). */
export function BodyBeatScreen({
  beat,
  context,
  rest,
  onClose,
  onTap,
}: {
  beat: SessionBeat
  context: BeatContext
  rest: BeatRest | null
  onClose: () => void
  onTap: () => void
}) {
  const { t } = useI18n()
  const titleId = useId()
  const { session, tempo } = beat
  const resting = beat.phase === 'rest' && rest !== null
  const playing = session ? isPlaying(session) : false
  const now = useNow(playing)
  const controls = session ? controlsOf(session) : null
  const app = session ? (musicAppName(session) ?? t('music.musicApp')) : null
  const queueTempos = useQueueTempos(session?.queue ?? null, Boolean(controls?.queue))
  const bpm = tempo.tempo?.bpm ?? null
  // Pa radhë, kur seti fillon me një këngë nën 120 BPM ose pa tempo: vetëm "Kalo këngën".
  const offer = Boolean(session && !resting && !controls?.queue && controls?.next && wantsEnergy(bpm) && tempo.status !== 'loading')

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const subtitle = t(resting ? 'music.afterSet' : 'music.setOf', { exercise: context.exercise, set: context.set, sets: context.sets })
  const bodyLabel = beat.pulse.animate
    ? t('music.bodyPulse', { muscles: beat.muscles, bpm: Math.round(60_000 / beat.pulse.periodMs!) })
    : t('music.bodyLit', { muscles: beat.muscles })

  return (
    <Overlay labelledBy={titleId}>
      <header className="flex h-14 shrink-0 items-center gap-1 pt-1.5 pr-3 pl-1">
        <Button variant="ghost" size="icon" aria-label={t('music.close')} className="rounded-pill" onClick={onClose}>
          <Icon name="poshte" size={24} />
        </Button>
        <div className="flex min-w-0 flex-col gap-px">
          <h1 id={titleId} className="font-display text-xl leading-none font-extrabold tracking-[0.04em] uppercase">
            {t('term.bodyBeat')}
          </h1>
          <span className="truncate text-[13px] text-muted-foreground tabular-nums">{subtitle}</span>
        </div>
        {session && app ? (
          <span className="ml-auto flex h-[30px] max-w-[46%] shrink-0 items-center gap-1.5 rounded-pill border border-border px-[11px] text-[13px] text-muted-foreground">
            <span aria-hidden className={cn('size-1.5 shrink-0 rounded-pill', playing ? 'bg-success' : 'bg-subtle')} />
            <span className="truncate">{t(playing ? 'music.playingIn' : 'music.pausedIn', { app })}</span>
          </span>
        ) : null}
      </header>

      <section aria-label={t('music.todayMuscles')} className="relative mt-1 h-[394px] shrink-0 overflow-hidden">
        <div role="img" aria-label={bodyLabel} className="absolute inset-0">
          <BeatBody stills={beat.stills} pulse={beat.pulse} anchor={beat.tempo.anchor} aura rings={3} ringClassName="w-[300px] -mt-2" />
          <div className="absolute inset-x-0 top-0 h-24 bg-linear-to-b from-background from-10% to-background/0" />
          <div className="absolute inset-x-0 bottom-0 h-[180px] bg-linear-to-b from-background/0 via-background/80 via-50% to-background" />
        </div>
        <div className="absolute top-3 left-4 flex flex-col gap-1">
          <span className="font-display text-sm font-bold tracking-[0.06em] text-muted-foreground uppercase">{t('music.todayMuscles')}</span>
          <span className="text-sm font-semibold">{beat.muscles}</span>
        </div>
        {beat.stills ? (
          <Button
            variant="outline"
            size="icon"
            aria-label={t(beat.back ? 'music.turnFront' : 'music.turnBack')}
            className="absolute top-2 right-3 rounded-pill bg-background/70"
            onClick={() => beat.setBack(!beat.back)}
          >
            <Icon name="kamera-kthe" size={20} />
          </Button>
        ) : null}
        <div className="absolute inset-x-4 bottom-3.5">{resting ? <RestBlock rest={rest} /> : <TempoBlock beat={beat} onTap={onTap} />}</div>
      </section>

      <main className="flex flex-col gap-3.5 px-4 pt-3 pb-6">
        {resting ? <RestTiles bpm={bpm} pulse={beat.pulse} /> : null}
        {session ? (
          <>
            <div className={cn('flex flex-col gap-1', resting && 'gap-0.5')}>
              <h2 className={cn('font-display leading-[0.95] font-extrabold uppercase', resting ? 'truncate text-2xl' : 'text-[34px]')}>
                {session.title ?? t('music.untitled')}
              </h2>
              <p className="flex min-h-touch flex-wrap items-center gap-x-1 text-[15px] text-muted-foreground">
                {session.artist ? <span>{session.artist}</span> : null}
                {session.artist && tempo.tempo ? <span aria-hidden>·</span> : null}
                <TempoSource tempo={tempo} />
              </p>
            </div>
            <Position session={session} now={now} onSeek={controls?.seek ? (positionMs) => void beat.act('seekTo', { positionMs }) : undefined} />
            <Controls beat={beat} session={session} app={app!} onTap={onTap} compact={resting} />
            <p aria-live="polite" className="type-caption text-muted-foreground empty:hidden">
              {refusalText(beat.refusal, t)}
            </p>
            {controls?.queue && session.queue ? (
              <Queue beat={beat} queue={session.queue} tempos={queueTempos} onPlay={(id) => void beat.act('skipToQueueItem', { queueItemId: id })} />
            ) : offer ? (
              <div className={cn(surfaceClass, 'flex flex-col items-start gap-2.5 rounded-lg px-3.5 py-3')}>
                <p className="type-body tabular-nums">{bpm ? t('music.offerSlow', { bpm: Math.round(bpm) }) : t('music.offerUnknown')}</p>
                <Button variant="secondary" onClick={() => void beat.act('next')}>
                  <Icon name="kenga-para" size={18} />
                  {t('music.skip')}
                </Button>
              </div>
            ) : null}
            {isYouTubeMusic(session) ? <p className="type-caption text-muted-foreground">{t('music.youtube')}</p> : null}
          </>
        ) : (
          <div className="flex flex-col gap-1 pt-2">
            <h2 className="type-title">{t('music.idle')}</h2>
            <p className="type-body text-muted-foreground">{t('music.idleText')}</p>
          </div>
        )}
        {!resting && !offer ? (
          <InsightCard icon="metronomi">
            <span className="block">{t('music.insight')}</span>
            <span className="mt-1.5 block text-[13px] leading-[1.35] text-muted-foreground">{t('music.insightSource')}</span>
          </InsightCard>
        ) : null}
      </main>
    </Overlay>
  )
}

/** Tempo e madhe e këngës (bordi "Trupi në ritëm"); pa tempo, "Prek ritmin". */
function TempoBlock({ beat, onTap }: { beat: SessionBeat; onTap: () => void }) {
  const { t } = useI18n()
  const bpm = beat.tempo.tempo?.bpm ?? null
  if (!beat.session) return null
  if (bpm === null) {
    const status = beat.tempo.status
    return (
      <div className="flex items-end justify-between gap-3">
        <span className="type-title text-muted-foreground">
          {t(status === 'loading' ? 'music.tempoLoading' : status === 'offline' ? 'music.tempoOffline' : 'music.tempoUnknown')}
        </span>
        {status === 'loading' ? null : (
          <Button variant="secondary" ground="page" onClick={onTap}>
            <Icon name="metronomi" size={18} />
            {t('music.tap')}
          </Button>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-display-xl leading-[0.82]">{Math.round(bpm)}</span>
      <span className="flex items-center gap-[7px] type-caption text-muted-foreground">
        <span aria-hidden className="size-2 rounded-pill bg-ember" />
        {t('music.bpmSong')}
      </span>
    </div>
  )
}

/** Burimi i tempos; GetSongBPM kërkon lidhjen te GetSongBPM.com (kushtet e API-së). */
function TempoSource({ tempo }: { tempo: CurrentTempo }) {
  const { t } = useI18n()
  const value = tempo.tempo
  if (!value) return null
  if (value.source === 'getsongbpm') {
    return (
      <a href={value.url ?? 'https://getsongbpm.com'} target="_blank" rel="noreferrer" className="inline-flex min-h-touch items-center text-ember-text underline underline-offset-2">
        {t('music.source.getsongbpm')}
      </a>
    )
  }
  return <span>{t(value.source === 'acousticbrainz' ? 'music.source.acousticbrainz' : 'music.source.tap')}</span>
}

/** Pushimi te ekrani i plotë (bordi "Muzika · Pushimi"): koha që mbetet dhe seti që vjen. */
function RestBlock({ rest }: { rest: BeatRest | null }) {
  const { t } = useI18n()
  if (!rest) return null
  const fraction = rest.total > 0 ? rest.remaining / rest.total : 0
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div role="timer" aria-label={t('music.restSpoken', { left: spokenDuration(rest.remaining, t), total: spokenDuration(rest.total, t) })} className="flex flex-col gap-1.5">
          <span className="type-label text-muted-foreground tabular-nums">{t('music.rest', { total: clock(rest.total) })}</span>
          <span className="type-display-hero leading-[0.82]">{clock(rest.remaining)}</span>
        </div>
        {rest.next ? (
          <div className="flex min-w-0 flex-col items-end gap-0.5 pb-0.5 text-right">
            <span className="type-caption text-muted-foreground">{t('music.restNext')}</span>
            {rest.next.exercise ? <span className="max-w-full truncate type-body-strong">{rest.next.exercise}</span> : null}
            <NextSet text={rest.next.text} />
          </div>
        ) : null}
      </div>
      <div aria-hidden className="h-1 overflow-hidden rounded-pill bg-track">
        <div className="h-full rounded-pill bg-ember transition-[width] duration-200" style={{ width: `${fraction * 100}%` }} />
      </div>
    </div>
  )
}

/** "Seti 2 nga 4 · 62,5 × 9–11" në dy rreshta si te bordi: seti, pastaj pesha me përsëritjet më të mëdha. */
function NextSet({ text }: { text: string }) {
  const split = text.indexOf(' · ')
  if (split < 0) return <span className="type-body-strong tabular-nums">{text}</span>
  return (
    <>
      <span className="text-[17px] font-semibold tabular-nums">{text.slice(0, split)}</span>
      <span className="font-display text-[26px] leading-none font-bold tabular-nums">{text.slice(split + 3)}</span>
    </>
  )
}

/** Pushimi: tempo e këngës dhe pulsi i trupit, që bie në gjysmë. */
function RestTiles({ bpm, pulse }: { bpm: number | null; pulse: Pulse }) {
  const { t } = useI18n()
  if (bpm === null) return null
  const tile = cn(surfaceClass, 'flex flex-col gap-1 rounded-lg px-3.5 py-2.5')
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className={tile}>
        <span className="font-display text-[40px] leading-[0.95] font-extrabold tabular-nums">{Math.round(bpm)}</span>
        <span className="flex items-center gap-[7px] text-[13px] text-muted-foreground">
          <span aria-hidden className="size-2 rounded-pill bg-ember" />
          {t('music.bpmSong')}
        </span>
      </div>
      <div className={tile}>
        <span className="font-display text-[40px] leading-[0.95] font-extrabold tabular-nums">{pulse.periodMs ? Math.round(60_000 / pulse.periodMs) : Math.round(bpm / 2)}</span>
        <span className="flex items-center gap-[7px] text-[13px] text-muted-foreground">
          <Icon name="vale" size={14} />
          {t('music.restPulse')}
        </span>
      </div>
    </div>
  )
}

/** Pozicioni i këngës: rrëshqitës kur app-i pranon `seekTo`, përndryshe vetëm shiriti. */
function Position({ session, now, onSeek }: { session: NowPlaying; now: number; onSeek?: (positionMs: number) => void }) {
  const { t } = useI18n()
  const [drag, setDrag] = useState<number | null>(null)
  if (!session.durationMs) return null
  const total = Math.round(session.durationMs / 1000)
  const at = drag ?? Math.min(total, Math.round(positionNow(session, now) / 1000))
  const percent = total > 0 ? (at / total) * 100 : 0
  const commit = () => {
    if (drag === null || !onSeek) return
    onSeek(drag * 1000)
    setDrag(null)
  }
  return (
    <div className="grid grid-cols-[38px_minmax(0,1fr)_38px] items-center gap-2.5 text-[13px] text-muted-foreground tabular-nums">
      <span>{clock(at)}</span>
      {onSeek ? (
        <input
          type="range"
          min={0}
          max={total}
          step={1}
          value={at}
          aria-label={t('music.position')}
          aria-valuetext={t('music.positionValue', { at: clock(at), total: clock(total) })}
          onChange={(event) => setDrag(Number(event.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          className="h-touch w-full cursor-pointer appearance-none bg-transparent [&::-moz-range-thumb]:size-3.5 [&::-moz-range-thumb]:rounded-pill [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-foreground [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-pill [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:size-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-pill [&::-webkit-slider-thumb]:bg-foreground"
          style={{ ['--fill' as string]: `${percent}%`, background: 'linear-gradient(to right, var(--foreground) var(--fill), var(--track) var(--fill)) center / 100% 4px no-repeat' }}
        />
      ) : (
        <div
          role="progressbar"
          aria-label={t('music.position')}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={at}
          aria-valuetext={t('music.positionValue', { at: clock(at), total: clock(total) })}
          className="h-1 overflow-hidden rounded-pill bg-track"
        >
          <div className="h-full bg-foreground" style={{ width: `${percent}%` }} />
        </div>
      )}
      <span className="text-right">{clock(total)}</span>
    </div>
  )
}

/** Kontrollet që pranon app-i: "Prek ritmin", mbrapa, luaj/pauzë (prushi), para, hap app-in. */
function Controls({ beat, session, app, onTap, compact }: { beat: SessionBeat; session: NowPlaying; app: string; onTap: () => void; compact: boolean }) {
  const { t } = useI18n()
  const controls = controlsOf(session)
  const playing = isPlaying(session)
  const side = compact ? 'size-[46px]' : 'size-[60px]'
  const main = compact ? 'size-[60px]' : 'size-20'
  const spacer = <span aria-hidden className={compact ? 'size-touch' : 'size-12'} />
  return (
    <div className="flex items-center justify-between">
      <Button variant="ghost" size="icon" aria-label={t('music.tapLabel')} className={cn('rounded-pill text-muted-foreground', !compact && 'size-12')} onClick={onTap}>
        <Icon name="metronomi" size={24} />
      </Button>
      {controls.previous ? (
        <Button variant="secondary" ground="page" size="icon" aria-label={t('music.previous')} className={cn('rounded-pill', side)} onClick={() => void beat.act('previous')}>
          <Icon name="kenga-mbrapa" size={compact ? 20 : 24} />
        </Button>
      ) : (
        <span aria-hidden className={side} />
      )}
      {controls.playPause ? (
        <Button variant="primary" size="icon" aria-label={t(playing ? 'music.pause' : 'music.play')} className={cn('rounded-pill', main)} onClick={() => void beat.act(playing ? 'pause' : 'play')}>
          <Icon name={playing ? 'pauze' : 'luaj'} size={compact ? 26 : 32} />
        </Button>
      ) : (
        <span aria-hidden className={main} />
      )}
      {controls.next ? (
        <Button variant="secondary" ground="page" size="icon" aria-label={t('music.next')} className={cn('rounded-pill', side)} onClick={() => void beat.act('next')}>
          <Icon name="kenga-para" size={compact ? 20 : 24} />
        </Button>
      ) : (
        <span aria-hidden className={side} />
      )}
      {session.canOpen ? (
        <Button variant="ghost" size="icon" aria-label={t('music.openApp', { app })} className={cn('rounded-pill text-muted-foreground', !compact && 'size-12')} onClick={() => void music.openApp()}>
          <Icon name="jashte" size={22} />
        </Button>
      ) : (
        spacer
      )}
    </div>
  )
}

/** "Pastaj": këngët e radhës me tempon, kur app-i e jep radhën; prekja e luan tani. */
function Queue({ beat, queue, tempos, onPlay }: { beat: SessionBeat; queue: { id: number; title: string; artist: string | null }[]; tempos: Map<number, number | null>; onPlay: (id: number) => void }) {
  const { t } = useI18n()
  const headingId = useId()
  const songs = queue.map((entry) => ({ ...entry, bpm: tempos.get(entry.id) ?? null }))
  const current = beat.tempo.tempo?.bpm ?? null
  const pick = beat.phase === 'rest' ? pickRestSong(songs, current) : pickSetSong(songs)
  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="type-label text-muted-foreground">
          {t('music.queue')}
        </h3>
        <span className="type-caption text-muted-foreground">{t('music.queueHint')}</span>
      </div>
      <ol className="mt-0.5 flex flex-col">
        {songs.map((song) => {
          const picked = song === pick
          const forSets = song.bpm !== null && song.bpm >= SET_TEMPO.min
          const bpmText = song.bpm !== null && validTempo(song.bpm) ? Math.round(song.bpm) : null
          return (
            <li key={song.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                aria-label={t('music.queuePlay', { song: [song.title, song.artist, bpmText !== null ? t('music.bpm', { bpm: bpmText }) : null].filter(Boolean).join(', ') })}
                onClick={() => onPlay(song.id)}
                className="grid min-h-[60px] w-full grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 py-1 text-left"
              >
                <span className={cn('flex size-[52px] flex-col items-center justify-center gap-px rounded-md', picked ? 'border border-subtle bg-background' : 'bg-surface-2')}>
                  <b className="font-display text-[22px] leading-none font-extrabold tabular-nums">{bpmText ?? '–'}</b>
                  <span className="text-xs leading-none text-muted-foreground">{t('music.bpmUnit')}</span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <b className="truncate type-body-strong">{song.title}</b>
                  {song.artist ? <span className="truncate text-[13px] text-muted-foreground">{song.artist}</span> : null}
                </span>
                {bpmText !== null ? (
                  <span
                    className={cn(
                      'flex h-[30px] items-center gap-1.5 rounded-pill px-2.5 text-[13px] font-semibold',
                      picked ? 'bg-surface-2 text-foreground' : 'border border-border text-muted-foreground',
                    )}
                  >
                    {picked ? <Icon name={forSets ? 'rritje' : 'vale'} size={14} /> : null}
                    {t(forSets ? 'music.forSets' : 'music.forRest')}
                  </span>
                ) : (
                  <span />
                )}
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

/**
 * Lidhja e muzikës (bordi "Muzika · Lidhja"): çfarë bën Vrull, pastaj "Qasja te njoftimet". Kur leja
 * nuk vjen pas kthimit nga cilësimet, në Android 13+ me APK nga një lidhje, hapat e "Allow restricted
 * settings" te info e app-it.
 */
export function MusicConnectScreen({ beat, sessionId, onClose }: { beat: SessionBeat; sessionId: string; onClose: () => void }) {
  const { t } = useI18n()
  const titleId = useId()
  const [asked, setAsked] = useState(false)
  const [blocked, setBlocked] = useState<'restricted' | 'not-granted' | null>(null)
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!asked) return
    return onResume(() => {
      void music.access().then((access) => {
        if (access.granted) {
          music.restart()
          close.current()
          return
        }
        setBlocked(access.sdk !== null && access.sdk >= 33 && access.sideloaded ? 'restricted' : 'not-granted')
      })
    })
  }, [asked])

  async function connect() {
    setAsked(true)
    await music.openAccessSettings()
  }
  function later() {
    safeStorage.setItem(LATER_KEY, sessionId)
    onClose()
  }

  // Ilustrimi: trupi pulson me këngën kur ka, përndryshe me 130 BPM, mesin e tempos së seteve (pa numër në ekran).
  const active = usePageActive()
  const reducedMotion = useReducedMotion()
  const stills = useBeatStills(beat.stillsRequest)
  const illustration: Pulse = beat.pulse.animate ? beat.pulse : pulseOf({ bpm: SET_TEMPO.ideal, phase: 'set', playing: true, active, reducedMotion })
  return (
    <Overlay labelledBy={titleId}>
      <div className="flex h-12 shrink-0 items-center px-1 pt-2">
        <Button variant="ghost" size="icon" aria-label={t('common.back')} className="rounded-pill" onClick={onClose}>
          <Icon name="mbrapa" size={22} />
        </Button>
      </div>
      <div aria-hidden className="relative -mt-2 h-[262px] shrink-0 overflow-hidden">
        <BeatBody stills={stills} pulse={illustration} aura rings={3} ringClassName="w-[250px]" />
        <div className="absolute inset-x-0 top-0 h-14 bg-linear-to-b from-background to-background/0" />
        <div className="absolute inset-x-0 bottom-0 h-[110px] bg-linear-to-b from-background/0 via-background/80 to-background" />
      </div>
      <main className="flex flex-1 flex-col gap-[18px] px-4 pb-6">
        {blocked === 'restricted' ? (
          <div className="flex flex-col gap-2">
            <h1 id={titleId} className="type-display-m">
              {t('music.blocked.title')}
            </h1>
            <p className="type-body text-muted-foreground">{t('music.blocked.intro')}</p>
            <ol className="flex flex-col">
              {(['music.blocked.step1', 'music.blocked.step2', 'music.blocked.step3'] as const).map((key, index) => (
                <li key={key} className="flex min-h-row items-center gap-3 border-b border-border last:border-b-0">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-surface-2 font-display text-base font-bold tabular-nums">{index + 1}</span>
                  <span className="type-body">{t(key)}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <h1 id={titleId} className="type-display-m">
                {t('music.connect.title')}
              </h1>
              <p className="type-body text-muted-foreground">{t('music.connect.intro')}</p>
              {blocked === 'not-granted' ? (
                <p role="status" className="type-body">
                  {t('music.connect.notGranted')}
                </p>
              ) : null}
            </div>
            <ul className="flex flex-col">
              {(['music.connect.point1', 'music.connect.point2', 'music.connect.point3'] as const).map((key) => (
                <li key={key} className="flex min-h-row items-center gap-3 border-b border-border py-2 last:border-b-0">
                  <span aria-hidden className="size-2 shrink-0 rounded-pill bg-ember" />
                  <span className="type-body">{t(key)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="mt-auto flex flex-col gap-2.5">
          {blocked === 'restricted' ? (
            <>
              <Button variant="primary" size="xl" onClick={() => void music.openAppInfo()}>
                {t('music.blocked.appInfo')}
              </Button>
              <Button variant="outline" size="lg" className="text-lg" onClick={() => void connect()}>
                {t('music.connect.action')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" size="xl" onClick={() => void connect()}>
                {t('music.connect.action')}
              </Button>
              <Button variant="outline" size="lg" className="text-lg" onClick={later}>
                {t('music.connect.later')}
              </Button>
            </>
          )}
        </div>
      </main>
    </Overlay>
  )
}

/** "Prek ritmin" (bordi "Muzika · Prek ritmin"): prekjet japin tempon, ×2 dhe ÷2 e korrigjojnë. */
export function TapSheet({ beat, onClose }: { beat: SessionBeat; onClose: () => void }) {
  const { t } = useI18n()
  const [state, setState] = useState(emptyTaps)
  const [adjusted, setAdjusted] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const active = usePageActive()
  const reducedMotion = useReducedMotion()
  const tapped = tapTempo(state)
  const existing = beat.tempo.tempo?.bpm ?? null
  // Vlera në rreth: e prekura (pas ×2 / ÷2), përndryshe tempo që ka kënga.
  const value = adjusted ?? tapped.bpm ?? existing
  const canSave = value !== null && validTempo(value) && (adjusted !== null || tapped.ready)
  const session = beat.session

  function register(at: number) {
    setAdjusted(null)
    setState((current) => addTap(current, at))
  }
  async function save() {
    if (!canSave || value === null) return
    setSaving(true)
    try {
      await beat.tempo.saveTap(value, adjusted === null ? tapped.anchor : null)
      onClose()
    } finally {
      setSaving(false)
    }
  }
  // Rrethi pulson me tempon që po prek përdoruesi; ndalet në sfond dhe me "lëvizje të reduktuar".
  const tapPulse = pulseOf({ bpm: value, phase: 'set', playing: true, active, reducedMotion })
  const title = session?.title ?? t('music.untitled')
  const song = session ? (session.artist ? t('music.tap.song', { title, artist: session.artist }) : t('music.tap.songOnly', { title })) : undefined
  const shift = (direction: 'double' | 'half') => {
    if (value === null) return
    const next = octave(value, direction)
    if (next !== null) setAdjusted(next)
  }
  // Fleta hapet mbi ekranin e plotë (z-50 i dialogut): shtresa e vet e vendos sipër tij.
  return (
    <div className="relative z-[60]">
    <Sheet
      title={t('music.tap')}
      description={song}
      onClose={onClose}
      footer={
        <Button variant="primary" size="xl" disabled={!canSave || saving} onClick={() => void save()}>
          {value !== null && canSave ? t('music.tap.save', { bpm: Math.round(value) }) : t('music.tap.saveEmpty')}
        </Button>
      }
    >
      <span className="type-caption text-muted-foreground">{t(existing === null ? 'music.tap.missing' : 'music.tap.fix')}</span>
      <div className="relative flex h-[260px] items-center justify-center self-center">
        <BeatBody stills={null} pulse={tapPulse} rings={3} ringClassName="w-[220px]" />
        <button
          type="button"
          aria-label={
            value !== null
              ? t('music.tap.circleBpm', { bpm: Math.round(value), count: tapped.count, min: TAP.minTaps })
              : t('music.tap.circle', { count: tapped.count, min: TAP.minTaps })
          }
          onPointerDown={(event) => {
            event.preventDefault()
            register(performance.now())
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            register(performance.now())
          }}
          className="relative flex size-[220px] touch-manipulation flex-col items-center justify-center gap-1 overflow-hidden rounded-pill border-[1.5px] border-insight-border bg-background pb-8 select-none"
        >
          {beat.stills ? <BeatBody stills={beat.stills} pulse={tapPulse} scale={1.6} className="opacity-60" /> : null}
          <span className="relative type-display-xl">{value !== null ? Math.round(value) : '–'}</span>
          <span className="relative text-sm font-medium text-muted-foreground tabular-nums">{t('music.tap.count', { count: tapped.count, min: TAP.minTaps })}</span>
        </button>
      </div>
      <div aria-hidden className="flex justify-center gap-2.5">
        {Array.from({ length: TAP.minTaps }, (_, index) => (
          <span key={index} className={cn('size-3 rounded-pill', index < tapped.count ? 'bg-ember' : 'bg-subtle')} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" aria-label={t('music.tap.half')} disabled={value === null || octave(value, 'half') === null} className="text-xl tabular-nums" onClick={() => shift('half')}>
          ÷2
        </Button>
        <Button variant="secondary" aria-label={t('music.tap.double')} disabled={value === null || octave(value, 'double') === null} className="text-xl tabular-nums" onClick={() => shift('double')}>
          ×2
        </Button>
      </div>
      <p className="text-center type-caption text-muted-foreground">{t('music.tap.help')}</p>
    </Sheet>
    </div>
  )
}
