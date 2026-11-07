import { cva } from 'class-variance-authority'

// Variantet e Omal UI v2. Në Training Hub `brand` (amber) i përket vetëm veprimit kryesor
// të ekranit ("Fillo stërvitjen", "Ruaj setin", "Mbyll stërvitjen"): një për ekran.
export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        brand: 'bg-brand text-brand-foreground hover:bg-brand-hover',
        outline:
          'border border-input bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:opacity-85',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-90',
        // Mbi `panel` (i errët në çdo temë): veprimi kryesor dhe ai dytësor (DESIGN.md, pika 5).
        'on-panel': 'bg-panel-foreground text-panel hover:opacity-90',
        panel: 'bg-panel-button text-panel-foreground hover:opacity-90',
      },
      size: {
        default: 'h-11 px-5',
        md: 'h-10 px-5',
        sm: 'h-8 px-4 text-[13px]',
        icon: 'size-11 px-0',
        // Veprimi kryesor i ekraneve të stërvitjes: 56 px, në gjerësi të plotë (SPEC §14).
        xl: 'min-h-14 w-full px-6 text-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)
