# Brief-i i përbashkët: udhëzuesi i ushtrimit

Ky brief vlen për çdo agjent që shkruan udhëzues ushtrimesh. Brief-i i nisjes të jep grupin, ushtrimet dhe dy skedarët e daljes. Lexo këtë skedar të plotë para se të nisësh.

## Çfarë dorëzon

1. `src/program/guides/<grupi>.json`: `{ "group": "<grupi>", "guides": [ ... ] }`, një objekt `ExerciseGuide` për çdo ushtrim, me formën te `src/program/exercise-guides.ts`. Çelësi `exercise` është emri i ushtrimit si te brief-i i nisjes.
2. `docs/research/guides/<grupi>.md`: për çdo ushtrim dhe çdo pohim, lidhja e burimit dhe fjalia e burimit që e mbështet (deri në 25 fjalë, në gjuhën e burimit), plus kredencialet e çdo eksperti dhe ku i vërtetove. Ky skedar është për kontrolluesin; nuk hyn në app.
3. Raporti përfundimtar (tekst): ushtrimet e bëra, burimet që nuk u hapën, pohimet që hoqe, pyetjet e hapura, mësimet.

Puna mbaron kur `GUIDE_FILE=<grupi>.json npx vitest run src/program/exercise-guides.test.ts` kalon (prova vetëm për skedarin tënd; agjentë të tjerë shkruajnë skedarë të tjerë njëkohësisht). Mos prek skedarë të tjerë. Mos bëj commit ose push.

## Modeli

`docs/research/guides/bench-press.md` është teksti i Bench Press i kontrolluar tri herë me përdoruesin: shih seksionet, gjatësinë, tonin dhe rreshtat "Burimi". Shkruaj çdo ushtrim në të njëjtin nivel.

## Seksionet (SPEC §0.3g)

| Fusha | Çfarë ka | Sa |
|---|---|---|
| `tempo` | `downS` = faza ekscentrike (ulja e kontrolluar e peshës, muskuli zgjatet), `upS` = faza koncentrike, pavarësisht drejtimit të shufrës. Pa burim të posaçëm: 2 dhe 1. Burimet: Wilk, Zając dhe Tufano 2021, "Key Points" te teksti i plotë (https://europepmc.org/articles/PMC8310485: kombinimi i uljes më të ngadaltë me ngritjen më të shpejtë duket më i miri për muskulin; abstrakti nuk e thotë), dhe Korakakis, Schoenfeld dhe kolegët 2023 (2–8 s për përsëritje). Mbajtjet (plank): `null`. `breathing` e thotë drejtimin me fjalë ("Tërhiqe për 1 s, lëshoje për 2 s") | – |
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
- Rreshti nuk e kalon 280 shenja; këshilla dhe "Pak histori" 560; sinjali 40.
- Kur një burim e kundërshton vetveten, ose dy burime nuk bien dakord, shkruaj të dyja fjalitë te skedari i provave dhe mos zgjidh njërën te udhëzuesi pa e thënë te raporti.
- Mos i vër një burimi një fjali që është përfundimi yt ("Pra…", "Mos e bëj…"); përfundimi pa burim nuk hyn.

## Mjetet

- Jim Stoppani: artikujt e tij te jimstoppani.com ("Written By Jim Stoppani, PhD") hapen dhe janë burimi i tij i parë; titulli vërtetohet te Human Kinetics (Encyclopedia of Muscle & Strength). Kur një video e tij duhet, shkruaje te raporti: orkestruesi e lexon përshkrimin me shfletues.
- Emrat e autorëve si te burimi: "Androulakis Korakakis dhe kolegët, 2023" (autori i parë), jo "Korakakis, Schoenfeld".
- Mayo Clinic pranohet si organizatë mjekësore.
- YouTube nuk hapet me WebFetch. Videot janë te `src/program/exercise-videos.ts`, të kontrolluara me shfletues; mos u mbështet te përmbajtja e një videoje që nuk e ke lexuar.
- PMC dhe PubMed shpesh kthejnë reCAPTCHA. Abstrakti dhe shpesh teksti i plotë dalin nga Europe PMC: `curl -s "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=DOI:<doi>&resultType=core&format=json"` (abstrakti) dhe `.../rest/<PMCID>/fullTextXML` (teksti i plotë, kur është i hapur).
- WebFetch kthen përmbledhje, jo tekst fjalë për fjalë: fjalia që shkruan te skedari i provave duhet të jetë nga teksti i burimit (Europe PMC, PDF), ose të shënohet si përmbledhje.

## Skedarët e përkohshëm

Skriptet dhe kopjet e faqeve shkojnë te `/tmp/<grupi>/` (p.sh. `/tmp/sts-legs/`), jo te një dosje e përbashkët: agjentët paralelë mbishkruajnë njëri-tjetrin.

## Kur ngec

- Burimi nuk hapet: provo një herë me WebSearch për të njëjtin dokument; pastaj shkruaje te raporti dhe vazhdo pa të.
- Prova bie: lexo mesazhin (`setup 2 sq: nis me shkronjë të vogël`) dhe ndreq vetëm atë fushë.
