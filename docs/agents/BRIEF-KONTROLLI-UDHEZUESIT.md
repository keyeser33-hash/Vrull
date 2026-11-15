# Brief-i i kontrollit: burimet e një grupi udhëzuesish

Ky brief vlen për `vrull-reviewer` që kontrollon një grup udhëzuesish pasi agjenti i kërkimit ka mbaruar. Ti nuk e ke parë punën; mos u mbështet te raporti i agjentit, vetëm te skedarët dhe te burimet.

## Çfarë lexon

- `src/program/guides/<grupi>.json`: udhëzuesit (forma te `src/program/exercise-guides.ts`).
- `docs/research/guides/<grupi>.md`: për çdo pohim, lidhja dhe fjalia e burimit.
- `docs/agents/BRIEF-UDHEZUESI.md`: rregullat që duhej të ndiqte agjenti (burimet e pranuara, gjuha, seksionet).

## Çfarë kontrollon

1. **Çdo lidhje te `tips`, `safety` dhe `history`, dhe rreth 30% e të tjerave** (të paktën një pohim nga çdo seksion i çdo ushtrimi): hape me WebFetch.
   - Lidhja hapet dhe është burimi që thotë `label` (autori ose organizata, titulli, viti).
   - Fjalia e skedarit të provave ekziston te faqja dhe e mbështet pohimin në shqip dhe anglisht.
2. **Titujt e ekspertëve** (PhD, CSCS, MD, DPT…): vërtetohen nga një burim tjetër, jo nga bio-ja e vet. Kur nuk vërtetohen, gjetje.
3. **Burimet e ndaluara**: Wikipedia, blogje, forume, rrjete sociale, trajnerë pa titull, faqe që shesin, prodhues makinash.
4. **Numrat dhe emrat** (kënde, përqindje, vite, emra autorësh) janë si te burimi.
5. **Kopjimi**: asnjë fjali e udhëzuesit nuk është e kopjuar fjalë për fjalë nga burimi.
6. **Gjuha**, vetëm kur e sheh gjatë kontrollit: termi kundër `GLOSSARY.md`, anglishtja që nuk përputhet me shqipen.

## Raporti

Një rresht për çdo gjetje, me rëndësinë:

- **P1**: pohim i pambështetur ose i gabuar, burim i ndaluar, titull i pavërtetuar.
- **P2**: `label` që nuk përputhet me burimin, lidhje që nuk hapet, numër i pasaktë.
- **P3**: gjuha.

Forma: `P1 · <ushtrimi> · <fusha dhe numri, p.sh. tips 2> · <problemi> · <prova: lidhja dhe fjalia që gjete>`.

Në fund: sa lidhje hape, sa pohime kontrollove, dhe ushtrimet pa asnjë gjetje. Mos ndrysho asnjë skedar.
