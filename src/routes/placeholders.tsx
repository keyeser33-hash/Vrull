import { EmptyCard, PageHeader } from '@/components/layout/page'

export function ProgramPage() {
  return (
    <>
      <PageHeader title="Programi" />
      <EmptyCard title="Programet e tua">
        Shortcut to Size dhe programet që krijon në editor, me javët, ditët dhe ushtrimet.
      </EmptyCard>
    </>
  )
}

export function NutritionPage() {
  return (
    <>
      <PageHeader title="Ushqimi" />
      <EmptyCard title="Ditari i ushqimit">
        Vaktet sipas planit, kërkimi i ushqimeve, barkodi dhe recetat e tua.
      </EmptyCard>
    </>
  )
}

export function ProgressPage() {
  return (
    <>
      <PageHeader title="Progresi" />
      <EmptyCard title="Grafikët dhe matjet">
        Forca për çdo ushtrim, pesha e trupit, perimetrat dhe fotot e progresit.
      </EmptyCard>
    </>
  )
}

export function BodyPage() {
  return (
    <>
      <PageHeader title="Trupi" />
      <EmptyCard title="Modeli 3D">
        Muskujt e çdo ushtrimi, harta javore dhe gjendja e rikuperimit.
      </EmptyCard>
    </>
  )
}
