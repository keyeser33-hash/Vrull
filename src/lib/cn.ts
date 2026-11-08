import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// tailwind-merge njeh vlerat e temës së Vrullit (globals.css › @theme): madhësitë me emër
// (h-touch, h-button…), rrezja `pill` dhe stilet e tipografisë `type-*`, që një klasë e dhënë nga
// jashtë të zëvendësojë atë të komponentit në vend që të rrijnë të dyja.
const twMerge = extendTailwindMerge<'typography'>({
  extend: {
    theme: {
      spacing: ['touch', 'button', 'button-l', 'tab-bar', 'row'],
      radius: ['pill'],
    },
    classGroups: {
      typography: [
        {
          type: [
            'display-hero',
            'display-xl',
            'display-l',
            'display-m',
            'display-s',
            'title',
            'label',
            'body-l',
            'body',
            'body-strong',
            'caption',
            'tab',
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
