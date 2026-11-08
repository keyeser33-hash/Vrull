import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from '@/components/ui/icons'

// Gjendja bosh e një ekrani kryesor (bordi "Gjendje · Bosh"): një fjali e madhe, çfarë do të dalë
// këtu si listë me numra, dhe veprimi kryesor poshtë (kur ka). Një rresht me `to` hap vendin e vet.

export interface EmptyItem {
  title: string
  text: string
  to?: string
}

export function EmptyState({ title, intro, items, action, caption }: { title: string; intro: string; items: EmptyItem[]; action?: ReactNode; caption?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-[18px]">
      <div className="flex flex-col gap-3">
        <h2 className="type-display-l">{title}</h2>
        <p className="type-body text-muted-foreground">{intro}</p>
      </div>
      <ol className="flex flex-col border-t border-border">
        {items.map((item, index) => {
          const body = (
            <>
              <span aria-hidden className="w-7 shrink-0 font-display text-[22px] leading-[1.1] font-bold text-muted-foreground tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="type-title">{item.title}</span>
                <span className="type-caption text-muted-foreground">{item.text}</span>
              </span>
              {item.to ? <Icon name="hap" size={18} className="shrink-0 self-center text-muted-foreground" /> : null}
            </>
          )
          return (
            <li key={item.title} className="border-b border-border">
              {item.to ? (
                <Link to={item.to} className="flex min-h-touch items-baseline gap-3.5 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground">
                  {body}
                </Link>
              ) : (
                <div className="flex items-baseline gap-3.5 py-3">{body}</div>
              )}
            </li>
          )
        })}
      </ol>
      {action ? (
        <div className="mt-auto flex flex-col gap-2.5 pt-2">
          {action}
          {caption ? <span className="text-center type-caption text-muted-foreground tabular-nums">{caption}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
