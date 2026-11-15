# Brief-i i përbashkët: udhëzuesi i ushtrimit

Ky brief vlen për çdo agjent që shkruan udhëzues ushtrimesh. Brief-i i nisjes të jep grupin, ushtrimet dhe dy skedarët e daljes. Lexo këtë skedar të plotë para se të nisësh.

## Çfarë dorëzon

1. `src/program/guides/<grupi>.json`: `{ "group": "<grupi>", "guides": [ ... ] }`, një objekt `ExerciseGuide` për çdo ushtrim, me formën te `src/program/exercise-guides.ts`. Çelësi `exercise` është emri i ushtrimit si te brief-i i nisjes.
2. `docs/research/guides/<grupi>.md`: për çdo ushtrim dhe çdo pohim, lidhja e burimit dhe fjalia e burimit që e mbështet (deri në 25 fjalë, në gjuhën e burimit), plus kredencialet e çdo eksperti dhe ku i vërtetove. Ky skedar është për kontrolluesin; nuk hyn në app.
3. Raporti përfundimtar (tekst): ushtrimet e bëra, burimet që nuk u hapën, pohimet që hoqe, pyetjet e hapura, mësimet.

Puna mbaron kur `npx vitest run src/program/exercise-guides.test.ts` kalon. Mos prek skedarë të tjerë. Mos bëj commit ose push.

## Modeli

`docs/research/guides/bench-press.md` është teksti i Bench Press i kontrolluar tri herë me përdoruesin: shih seksionet, gjatësinë, tonin dhe rreshtat "Burimi". Shkruaj çdo ushtrim në të njëjtin nivel.

## Seksionet (SPEC §0.3g)

| Fusha | Çfarë ka | Sa |
|---|---|---|
| `tempo` | Sekondat poshtë dhe lart. Pa burim të posaçëm për ushtrimin: 2 poshtë, 1 lart (Wilk, Zając dhe Tufano 2021; Korakakis, Schoenfeld dhe kolegët 2023, si te modeli). Mbajtjet (plank): `null` | – |
| `setup` | Pajisja, pozicioni, kapja | 2–6 |
| `steps` | Lëvizja hap pas hapi | 2–6 |
| `breathing` | Tempo me fjalë dhe fryma | 1–4 |
| `cues` | Fjali shumë të shkurtra; të parat 3 janë më të rëndësishmet, sepse dalin te seanca | 3–6, deri në 40 shenja secila |
| `mistakes` | Gabimet e zakonshme dhe pse dëmtojnë | 3–8 |
| `tips` | Këshilla të avancuara; `who` është emri i ekspertit, studimit ose organizatës si te modeli. Kur Jim Stoppani (autori i Shortcut to Size) ka shkruar ose filmuar për ushtrimin, këshilla e tij del e para | 0–6 |
| `safety` | Kur ndalon, roja, alternativa kur dhemb | 1–5 |
| `history` | "Pak histori": vetëm me burim historik të pranuar, përndryshe `null` | 0–1 |
| `sources` | Çelësi i shkurtër → `label` (si del te "Burimi"), `url` (https), `checked` (data kur e hape, `2026-11-15`) | çdo burim i përdorur, asnjë i tepërt |

Çdo seksion ka `sources` jo bosh. Një pohim pa burim të hapur nuk hyn.

## Burimet (SPEC §0.3e, §0.3g)

- **Pranohen:** organizatat (NSCA, ACSM, ACE, NASM, NIH, EFSA); studimet e rishikuara nga kolegët dhe rishikimet e tyre; ekspertët me titull të verifikueshëm (PhD, CSCS, MD, DPT ose i ngjashëm), te libri, artikulli ose kanali i tyre zyrtar. Për "Pak histori": edhe revistat me redaksi dhe institucionet kulturore (p.sh. Iron Game History).
- **Titulli i ekspertit** vërtetohet nga një burim tjetër (universiteti, organizata, botuesi), jo vetëm nga emri i kanalit ose bio-ja e vet.
- **Nuk pranohen:** Wikipedia, blogje, forume, rrjete sociale, trajnerë pa titull, faqe që shesin, përmbledhje të AI-së, prodhuesit e makinave.
- **Rekomandimet** vijnë nga rishikimet dhe deklaratat e organizatave, jo nga protokolli i një studimi të vetëm (MESIMET: tempo 2/2 nga një protokoll studimi).
- **Emrat** shkruhen saktësisht si te burimi; mos shpik emra, vite ose numra (MESIMET: emri i gabuar te drafti i kërkimit). Kur nuk e gjen, hiqe pohimin dhe shkruaje te raporti.
- **Mos e mbush nga kujtesa.** Çdo burim hapet me WebFetch ose WebSearch në këtë punë.

## Gjuha

- Shqip: sentence case, pa pikëçuditje dhe pa emoji, në vetën e dytë njëjës ("Ule shufrën"), me fjalët e `GLOSSARY.md`. Emrat e ushtrimeve mbeten në anglisht. Numrat me presje dhjetore (62,5), njësitë me hapësirë (kg, s, °).
- Anglisht: anglishte britanike (favour, programme), përkthim besnik i shqipes, jo tekst tjetër.
- Shkruaj me fjalët e tua; mos kopjo fjali nga burimi. Citatet shkojnë vetëm te skedari i provave.
- Rreshti nuk e kalon 280 shenja; sinjali 40.

## Kur ngec

- Burimi nuk hapet: provo një herë me WebSearch për të njëjtin dokument; pastaj shkruaje te raporti dhe vazhdo pa të.
- Prova bie: lexo mesazhin (`setup 2 sq: nis me shkronjë të vogël`) dhe ndreq vetëm atë fushë.
