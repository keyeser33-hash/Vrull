import type { ReactNode } from 'react'
import { Sheet } from '@/components/layout/sheet'
import { useI18n } from '@/i18n/use-i18n'
import { cn } from '@/lib/cn'
import { clock } from '@/lib/clock'
import { useOnline } from '@/lib/use-online'
import { embedUrl, watchUrl } from '@/lib/youtube'
import type { ChosenVideo, ExerciseVideo } from '@/program/exercise-videos'
import { Icon } from './icons'
import { surfaceClass } from './surface'

// Videoja e ushtrimit (SPEC §0.3g, §12; bordi "Videoja e ushtrimit"): "Shiko videon" (butoni që faqja e
// ushtrimit dhe seanca e përdorin), ekrani i videos brenda app-it me youtube-nocookie.com dhe sekondën e
// nisjes, dhe "Më shumë video" (hapen në YouTube). Pa internet butoni e thotë dhe nuk hapet; lëvizja e
// ushtrimit punon pa të. Lidhja që shton përdoruesi zë vendin e videos së zgjedhur (`chosenVideo`).

/** Pjesët e rreshtit të burimit pa përsëritje (kanali dhe autori janë shpesh i njëjti emër). */
const joined = (parts: string[]) => [...new Set(parts)].join(' · ')

const focusRing = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground'

/** "Shiko videon" me autorin dhe kohëzgjatjen poshtë; pa internet është i çaktivizuar dhe e thotë. */
export function WatchVideoButton({ chosen, onOpen, className }: { chosen: ChosenVideo; onOpen: () => void; className?: string }) {
  const { t } = useI18n()
  const online = useOnline()
  const meta = chosen.video ? t('programme.watchMeta', { author: chosen.video.author, duration: clock(chosen.video.seconds) }) : t('programme.watchYours')
  return (
    <button
      type="button"
      disabled={!online}
      onClick={onOpen}
      className={cn(
        'flex min-h-14 min-w-0 items-center gap-2.5 rounded-lg border border-surface-border bg-surface px-3 py-1.5 text-left disabled:opacity-60',
        focusRing,
        className,
      )}
    >
      <Icon name="video" size={22} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="type-body-strong truncate">{t('programme.watch')}</span>
        <span className="type-caption text-muted-foreground">{online ? meta : t('programme.watchOffline')}</span>
      </span>
    </button>
  )
}

/** Ekrani i videos: player-i youtube-nocookie me sekondën e nisjes, titulli, burimi dhe "Hap në YouTube". */
export function ExerciseVideoSheet({ chosen, name, onClose }: { chosen: ChosenVideo; name: string; onClose: () => void }) {
  const { t } = useI18n()
  const online = useOnline()
  const { video } = chosen
  return (
    <Sheet title={t('programme.player.title')} description={name} onClose={onClose}>
      {online ? (
        <div className="aspect-video overflow-hidden rounded-lg bg-surface-2">
          <iframe
            title={t('programme.videoTitle', { name })}
            src={embedUrl(chosen.id, chosen.startS)}
            className="size-full"
            allow="encrypted-media; picture-in-picture; fullscreen"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : (
        <div className="flex aspect-video items-center justify-center rounded-lg bg-surface-2 text-muted-foreground">
          <Icon name="pa-internet" size={28} />
        </div>
      )}
      <div className="flex flex-col gap-0.5">
        <p className="type-title">{video ? video.title : t('programme.player.yours')}</p>
        <p className="type-caption text-muted-foreground">
          {video ? joined([video.author, clock(video.seconds), video.channel]) : t('programme.player.notice')}
        </p>
      </div>
      {online ? (
        <a
          href={watchUrl(chosen.id, chosen.startS)}
          target="_blank"
          rel="noreferrer"
          className={cn(surfaceClass, 'flex min-h-touch items-center justify-between gap-2 rounded-lg px-3 type-body-strong', focusRing)}
        >
          {t('programme.player.open')}
          <Icon name="jashte" size={20} className="text-muted-foreground" />
        </a>
      ) : (
        <section aria-label={t('programme.player.offlineHeading')} className="flex flex-col gap-2">
          <h3 className="type-label text-muted-foreground">{t('programme.player.offlineHeading')}</h3>
          <p className={cn(surfaceClass, 'flex items-center gap-3 rounded-lg p-3 type-body')}>
            <Icon name="pa-internet" size={22} />
            {t('programme.player.offline')}
          </p>
        </section>
      )}
    </Sheet>
  )
}

/** "Më shumë video": deri në 3, secila me titullin, kanalin, autorin dhe kohëzgjatjen; hapen në YouTube. */
export function MoreVideos({ videos, heading }: { videos: ExerciseVideo[]; heading?: ReactNode }) {
  const { t } = useI18n()
  if (videos.length === 0) return null
  return (
    <section aria-labelledby="exercise-more-videos" className="flex flex-col gap-2">
      <h2 id="exercise-more-videos" className="type-title">
        {heading ?? t('programme.moreVideos')}
      </h2>
      <ul className="flex flex-col gap-2">
        {videos.slice(0, 3).map((video) => (
          <li key={video.id}>
            <a
              href={watchUrl(video.id, video.startS)}
              target="_blank"
              rel="noreferrer"
              aria-label={t('programme.moreVideoOpen', { title: video.title })}
              className={cn(surfaceClass, 'flex min-h-16 items-center gap-3 rounded-lg px-3 py-2.5', focusRing)}
            >
              <Icon name="video" size={22} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="type-body-strong">{video.title}</span>
                <span className="type-caption text-muted-foreground">
                  {joined([video.channel, video.author, clock(video.seconds)])}
                </span>
              </span>
              <Icon name="jashte" size={20} className="text-muted-foreground" />
            </a>
          </li>
        ))}
      </ul>
      <p className="type-caption text-muted-foreground">{t('programme.moreVideosNote')}</p>
    </section>
  )
}
