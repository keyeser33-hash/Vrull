import { cva } from 'class-variance-authority'

// Butonat e Vrullit (DESIGN.md › Butonat). Barlow Condensed uppercase nga stili, teksti në sentence
// case. `primary` (prushi) është veprimi i vetëm kryesor i ekranit: "Fillo stërvitjen", "Ruaj setin",
// "Mbyll stërvitjen"; 52 px në karta (`lg`), 58 px në fund të ekranit (`xl`), `tired` në ditë të
// lodhura. Çdo madhësi që preket ka të paktën 44 px. Shtypja (SPEC §0.3c, E2-23): 100 ms, .97 → 1, ease-out,
// pa kërcim; me "lëvizje të reduktuar" pa shkallëzim (`motion-safe:`). `ease-vrull` mbetet për hyrjet
// e kartave dhe festimet.
export const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 font-display font-bold whitespace-nowrap uppercase tracking-[0.02em] select-none transition-transform duration-100 ease-out motion-safe:active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground',
  {
    variants: {
      variant: {
        primary: 'bg-ember font-extrabold text-on-ember',
        // I mbushur: `surface-2` brenda kartës, `surface` mbi sfondin e faqes (ground="page").
        secondary: 'border border-surface-border text-foreground',
        outline: 'border border-border bg-transparent text-foreground',
        ghost: 'bg-transparent text-foreground',
        // Butoni i errët mbi kartën me prush, me tekst fiks në çdo temë.
        ink: 'bg-ink text-on-ink',
        // Emrat e v1 (Omal UI v2), që ekranet e v1 të hapen deri sa të rishikohen (E1-05 … E1-15).
        // Kod i ri nuk i përdor (roja e dizajnit).
        default: 'bg-foreground text-background',
        brand: 'bg-ember font-extrabold text-on-ember',
        destructive: 'bg-danger text-background',
        'on-panel': 'bg-foreground text-background',
        panel: 'bg-surface-2 text-foreground',
      },
      size: {
        default: 'h-touch rounded-sm px-4 text-lg',
        lg: 'h-button rounded-md px-6 text-[22px]',
        xl: 'h-button-l w-full rounded-md px-7 text-2xl',
        icon: 'size-touch rounded-sm px-0',
        // v1: `md` merr 44 px; `sm` (32 px) mbetet vetëm te ekranet e v1.
        md: 'h-touch rounded-sm px-4 text-lg',
        sm: 'h-8 rounded-sm px-3 text-sm',
      },
      ground: { card: '', page: '' },
      tired: { true: '', false: '' },
    },
    compoundVariants: [
      { variant: 'secondary', ground: 'card', class: 'bg-surface-2' },
      { variant: 'secondary', ground: 'page', class: 'bg-surface' },
      { variant: 'primary', tired: true, class: 'bg-sand' },
    ],
    defaultVariants: { variant: 'default', size: 'default', ground: 'card', tired: false },
  },
)
