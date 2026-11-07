# Training Hub · Detyrat

Burimi: `docs/SPEC.md`. Çdo detyrë mbyllet kur kalojnë kriteret e pranimit. Logjika pa UI (TH-06, TH-07, TH-10, TH-14) ndërtohet me teste përpara kodit. Radha ndjek §17 të specifikimit. Detyrat me **D1** janë minimumi për ditën e parë në palestër.

| ID | Detyra | Varet nga | D1 |
|---|---|---|---|
| TH-01 | Skeleti i projektit dhe Omal UI v2 | – | D1 |
| TH-02 | Capacitor Android dhe APK nga GitHub Actions | TH-01 | D1 |
| TH-03 | Skema e Supabase, RLS, Auth, Storage | – | D1 |
| TH-04 | Ruajtja lokale dhe sinkronizimi | TH-01, TH-03 | D1 |
| TH-22 | Hyrja e parë | TH-03, TH-04 | D1 |
| TH-23 | Përditësimi brenda app-it | TH-02, TH-03 | |
| TH-05 | Spike 3D: pipeline-i i modelit dhe shikuesi minimal | TH-01 | |
| TH-06 | Motori i programit | TH-01 | D1 |
| TH-07 | Shortcut to Size, Java 0 dhe biblioteka e ushtrimeve | TH-06 | D1 |
| TH-08 | Ekrani "Sot" dhe seanca e stërvitjes | TH-04, TH-07 | D1 |
| TH-09 | Timer-i i pushimit me njoftim native | TH-02, TH-08 | D1 |
| TH-10 | e1RM, pesha e sugjeruar, rekordet | TH-08 | D1 |
| TH-11 | Editori i programeve | TH-06, TH-07 | |
| TH-12 | Matjet dhe fotot e progresit | TH-04 | |
| TH-13 | Grafikët e progresit | TH-10, TH-12 | |
| TH-14 | Objektivat e ushqimit dhe ditari bazë | TH-04 | |
| TH-15 | Open Food Facts me barkod, USDA përmes Edge Function | TH-14 | |
| TH-16 | Recetat, shablloni i Jimit, zëvendësimet | TH-14, TH-15 | |
| TH-17 | Suplementet | TH-14 | |
| TH-18 | Rikujtuesit | TH-09, TH-16, TH-17 | |
| TH-19 | Modeli 3D: katër funksionet | TH-05, TH-10 | |
| TH-20 | Videot e YouTube | TH-07 | |
| TH-21 | QA në telefon dhe rishikimi përfundimtar | të gjitha | |

---

## TH-01 · Skeleti i projektit dhe Omal UI v2

- Vite + React + TypeScript, Tailwind v4, variantet e butonave të Omal UI v2 (cva, si shadcn), Vitest, oxlint.
- `globals.css` dhe `DESIGN.md` nga Omal UI v2 në repo; tema OLED si parazgjedhje; Inter; `tabular-nums`.
- Navigimi poshtë me pesë vende: Sot, Programi, Ushqimi, Progresi, Trupi (ekrane bosh).
- `CLAUDE.md` që tregon `docs/SPEC.md` dhe `DESIGN.md` si burime dhe rregullat e dizajnit (pa hex në komponentë, një veprim amber për ekran).

**Pranimi:** `npm run build` dhe `npm test` kalojnë; tri temat funksionojnë; në 390 px nuk ka scroll anësor.

## TH-02 · Capacitor Android dhe APK nga GitHub Actions

- Capacitor me platformën Android.
- Workflow që ndërton APK release të nënshkruar dhe e publikon si GitHub Release në çdo tag `v*`.
- Çelësi i nënshkrimit ruhet si secret i repo-s; nëse sesioni nuk i shton dot secret-et, `docs/INSTALL.md` jep hapat për përdoruesin.
- Manifesti deklaron `POST_NOTIFICATIONS` dhe `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`.
- `docs/INSTALL.md`: instalimi i parë dhe përditësimet në telefon.

- Ikonë adaptive (me variant njëngjyrësh), nisje e zezë pa ndezje të bardhë, ekran nga cepi në cep me shiritat e sistemit sipas temës, butoni mbrapa i Android-it.

**Pranimi:** APK-ja instalohet në telefonin e përdoruesit, hapet, dhe një version i ri instalohet mbi të vjetrin pa humbur të dhëna.

## TH-03 · Skema e Supabase, RLS, Auth, Storage

- Migrime për tabelat e §15, me `user_id`, `updated_at`, `deleted_at` dhe RLS në secilën.
- Auth me email dhe fjalëkalim; llogaria e vetme krijohet nga paneli i Supabase dhe regjistrimet e reja çaktivizohen që në fillim.
- Bucket privat `progress-photos` me rrugë `<user_id>/...` dhe RLS te `storage.objects`.
- Datat e ditarit dhe të stërvitjes si datë lokale; kohët në UTC (§15).

**Pranimi:** këshilltari i sigurisë i Supabase pa paralajmërime (përveç mbrojtjes nga fjalëkalimet e rrjedhura, që në planin falas nuk ekziston, SPEC §18); një test vërteton që një përdorues tjetër nuk sheh asnjë rresht dhe asnjë foto; regjistrimi i një llogarie të re refuzohet.

## TH-04 · Ruajtja lokale dhe sinkronizimi

- Dexie me të njëjtat tabela; çdo shkrim lokal së pari.
- Motori i sinkronizimit: dërgon rreshtat e ndryshuar, merr më të rejat, fshirje e butë, fiton ndryshimi i fundit.
- "Eksporto të dhënat" te cilësimet: JSON me të gjitha tabelat.

**Pranimi:** një set i regjistruar pa internet del në Supabase kur kthehet rrjeti; teste për konfliktet dhe fshirjet; eksporti përmban çdo tabelë.

Prova reale: `src/data/sync.e2e.test.ts`, me një përdorues prove të përkohshëm (`E2E_EMAIL`, `E2E_PASSWORD`), që fshihet pas provës.

## TH-23 · Përditësimi brenda app-it

- Bucket-i privat `app-releases` (vetëm lexim nga app-i); workflow-i i Release-it ngarkon APK-në dhe `latest.json` me `SUPABASE_SECRET_KEY`.
- Kontrolli në hapje, në rikthim dhe kur kthehet interneti (6 orë mes kontrolleve automatike); rreshti te Sot, "Versioni" te Cilësimet, fleta me "Çfarë ka të re" dhe "Përditëso".
- Plugin-i native: shkarkimi me SHA-256, instalimi me `PackageInstaller` pa dritare konfirmimi pas lejes së parë; njoftimi pas përditësimit.

**Pranimi:** prova në emulator shkarkon me plugin-in një skedar HTTPS me SHA-256 të saktë dhe refuzon një të gabuar; e përditëson v1 → v2 nga vetë app-i, pa dritare konfirmimi, dhe refuzon një APK me SHA-256 të gabuar; të dhënat dhe tema mbeten; vjen njoftimi "Training Hub u përditësua" dhe APK-ja fshihet. Në telefon: 0.15.0 me dorë, 0.16.0 nga app-i.

## TH-22 · Hyrja e parë

- Hapat e SPEC §3a: hyrja, pesha, ditët dhe ora e stërvitjes, zgjimi dhe gjumi, programi aktiv.
- Çdo vlerë ndryshohet më vonë te cilësimet.

**Pranimi:** pas instalimit të ri, hyrja e parë përfundon në më pak se dy minuta dhe ekrani Sot tregon "Java 0 · Stërvitja 1"; pa internet pas hyrjes, app-i hapet direkt te Sot.

Prova në emulator e kalon gjithë rrugën me Supabase të imituar (build-i i provës përdor `VITE_SUPABASE_URL=https://smoke.invalid`), përfshirë përditësimin v1 → v2 dhe hapjen pa internet.

## TH-05 · Spike 3D

- `tools/anatomy/`: merr BodyParts3D 4.0 (OBJ 99%) dhe latissimus dorsi + rectus abdominis nga 3.0, të shkarkuara me dorë nga arkivi zyrtar (adresa te koka e `build.mjs`); zgjedh elementet sipas Shtojcës D; bashkon majtas/djathtas; thjeshton; nxjerr GLB me një nyje për çdo çelës.
- Ekran zhvillimi me modelin që rrotullohet dhe tregon emrin e muskulit të prekur.

**Pranimi:** GLB ≤ 5 MB me të gjithë çelësat e Shtojcës D, pjesët e 3.0 të pozicionuara saktë, rrotullim i rrjedhshëm në telefon, atribuimi i shkruar.

**Gjendja (07.11.2026, versioni 0.14.0):** GLB 1,92 MB me 34 çelësa; lats dhe rectus të kontrolluar me pamje nga përpara, mbrapa dhe anash. Në vend të ekranit të zhvillimit, modeli hyri drejt te Trupi pas zgjedhjes "2D / 3D", ku prekja e muskulit hap fletën e tij. Atribuimi: Cilësimet, "Burimet dhe licencat". Rrotullimi në telefonin e përdoruesit: i rrjedhshëm (07.11.2026).

## TH-06 · Motori i programit

- Modul TypeScript pa UI: tipat e recetave të §4 (`rep_ladder`, `timed`, `percent_1rm`, `linear`, `rpe`/`rir`), teknikat, pushimet.
- Nga programi dhe treguesi i radhës nxjerr planin e seancës; kalimi përpara dhe "Kapërce".
- Programi aktiv, ndërrimi i programeve me treguesin e secilit, ndryshimet që vlejnë nga stërvitja e radhës, gjendja "Përfunduar" dhe rinisja (§4).

**Pranimi:** teste për çdo lloj recete, për kalimin ndërmjet javëve dhe blloqeve, për fundin e programit dhe rinisjen.

## TH-07 · Shortcut to Size, Java 0, biblioteka

- free-exercise-db si bibliotekë; ushtrimet që mungojnë shtohen me muskujt e tyre.
- Çelësat e muskujve të çdo ushtrimi të programit sipas Shtojcës E; emrat e njëjtë bashkohen (§5).
- Programi si të dhëna sipas §5 dhe Shtojcave A dhe B, me Java 0 në fillim.

**Pranimi:** një test krahason çdo javë dhe fazë të programit me Shtojcat A dhe B, rresht për rresht; çdo ushtrim i programit ka çelësat e Shtojcës E; Java 0 ka setet e §5.

## TH-08 · Ekrani "Sot" dhe seanca

- Karta "Stërvitja e radhës", fillimi i seancës, regjistrimi i seteve (peshë, përsëritje ose sekonda, RPE/RIR, shënim), segmentet e rest-pause dhe drop set-it.
- Mbyllja e seancës e çon treguesin përpara; një seancë e ndërprerë vazhdon.
- "Ndrysho ushtrimin për këtë fazë" direkt nga seanca.

**Pranimi:** një seancë e plotë e Javës 0 dhe e Fazës 1 Java 3 (drop set) regjistrohet pa internet.

## TH-09 · Timer-i i pushimit

- Njoftim lokal në fund të pushimit, me zë dhe dridhje; anulohet kur nis seti tjetër; 15 s për rest-pause.
- Kërkesa e lejeve të njoftimeve dhe të alarmeve të sakta; nëse vonesa vazhdon, kërkesa për përjashtim nga optimizimi i baterisë.

**Pranimi:** me ekran të kyçur, njoftimi vjen brenda 2 sekondave nga koha.

## TH-10 · e1RM, pesha e sugjeruar, rekordet

- §7 i plotë: Epley, 28 ditë, vlera me dorë, rrumbullakimi sipas pajisjes, referenca e fazës së kaluar, pesha e drop set-it nga java 1.

**Pranimi:** teste për llogaritjet; seanca tregon sugjerimin dhe referencën.

## TH-11 · Editori i programeve

- Krijo, kopjo, ndrysho programe, blloqe, ditë, slote; redaktorë për pesë llojet e recetave; teknika sipas javës; kopjo javën ose bllokun; ndrysho ushtrimin vetëm për një bllok.

**Pranimi:** Shortcut to Size mund të rikrijohet nga zero me editorin dhe del i njëjtë me programin e gatshëm; një program 5/3/1 i thjeshtë funksionon.

## TH-12 · Matjet dhe fotot

- Format e §8; fotot kompresohen dhe ngarkohen në bucket-in privat, me radhë pritjeje pa internet.

**Pranimi:** matjet dhe fotot sinkronizohen dhe shfaqen në një telefon tjetër pas hyrjes.

## TH-13 · Grafikët

- e1RM për ushtrim, volumi javor për muskul, pesha me mesatare 7-ditore, perimetrat, përputhja me objektivat.

**Pranimi:** grafikët pasqyrojnë saktë të dhënat e testit; lexohen në tri temat.

## TH-14 · Objektivat dhe ditari

- Formula e Shtojcës C, dita e pushimit ose e stërvitjes, vaktet, ushqimet e përdoruesit, totalet kundrejt objektivave, shënimi për proteinën.

**Pranimi:** për 80 kg dalin vlerat e shembullit të Shtojcës C.

## TH-15 · Burimet e ushqimeve

- Open Food Facts sipas barkodit (skaner) dhe kërkimit, me User-Agent pa të dhëna personale; USDA përmes Edge Function me çelësin si secret, që pranon vetëm kërkesa me sesion; ushqimet e përdorura ruhen lokalisht.

**Pranimi:** një produkt i skanuar dhe një ushqim i përgjithshëm shtohen në ditar; pa internet gjenden ushqimet e përdorura më parë.

## TH-16 · Recetat, shablloni, zëvendësimet

- Recetat me përbërës dhe porcione; vaktet e Jimit si shabllone me një prekje; listat e zëvendësimeve të PDF-së.

**Pranimi:** dita shembull e Jimit regjistrohet me shtatë prekje dhe totali afrohet me 3100 kcal.

## TH-17 · Suplementet

- Tabela e §10, checklist ditore, etiketat e evidencës, çaktivizimi.

**Pranimi:** suplementet e ditës së stërvitjes dhe të pushimit dalin sipas orarit.

## TH-18 · Rikujtuesit

- Cilësimet e orareve; planifikimi i §13, përfshirë rregullin e vaktit afër stërvitjes; riplanifikimi kur ndryshojnë oraret.

**Pranimi:** njoftimet e një dite stërvitjeje dhe të një dite pushimi vijnë në kohët e pritshme.

## TH-19 · Modeli 3D: katër funksionet

- Muskujt e ushtrimit, harta javore, prek muskulin, gjendja e rikuperimit, në skedën Trupi dhe te çdo ushtrim.

**Pranimi:** pas një seance, harta dhe gjendja e rikuperimit ndryshojnë si pritet; gjendjet shkruhen me fjalë.

**Gjendja (07.11.2026):** të katër funksionet te figura 2D (0.12.0) dhe te modeli 3D (0.14.0); muskujt e ushtrimit në 3D te ekrani i ushtrimit dhe te seanca, fokusi me emrin e pjesës dhe zmadhimi me dy gishta (0.16.0). Pas tyre: volumi kundrejt intervalit javor dhe shtresat e muskujve.

## TH-20 · Videot

- Fusha e linkut, nxjerrja e ID-së, shfaqja me `youtube-nocookie.com`, butoni për app-in e YouTube.

**Pranimi:** linket `youtu.be`, `youtube.com/watch` dhe `shorts` shfaqen saktë.

## TH-21 · QA dhe rishikimi

- Kalim i plotë në telefon: Java 0, një javë e Fazës 1, një ditë ushqimi, rikujtuesit, 3D; rishikim i kodit kundrejt specifikimit.
