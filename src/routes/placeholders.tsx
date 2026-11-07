import { EmptyCard, PageHeader } from '@/components/layout/page'

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
