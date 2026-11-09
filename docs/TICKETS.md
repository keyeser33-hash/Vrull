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

### v2 (SPEC §0)

Detyrat e çdo etape shkruhen këtu në fillim të saj, me kriteret e pranimit, nga seksionet e rishkruara të specifikimit.

| ID | Detyra | Varet nga |
|---|---|---|
| V2-D1 | Tri drejtime vizuale me emër dhe logo; përdoruesi zgjedh | – |
| V2-D2 | Sistemi i dizajnit i drejtimit të zgjedhur | V2-D1 |
| V2-D3 | Të gjitha ekranet e v2 në sistemin e ri | V2-D2 |
| V2-E1 | Etapa 1 (0.20.0): sistemi i ri, dy gjuhët, stërvitja, ndërtuesi, PDF me AI, videot e formës, 3D | V2-D3 |
| V2-E2 | Etapa 2 (0.21–0.23): objektivat personale, Plani im, uji, rikujtuesit e zgjuar, dita e humbur, suplementet e mia; kutia e AI-së dhe trajneri; motivimi, pamja e re dhe lëvizja | V2-E1 |
| V2-E3 | Etapa 3 (0.40.0): uji sipas motit, gjendja dhe gatishmëria, zakonet, Health Connect, raporti PDF | V2-E1 |
| V2-E4 | Etapa 4 (0.50.0): miqtë, ftesat, sfidat, ndarja, kartat | V2-E1 |
| V2-E5 | Etapa 5 (0.60.0): app-i në Galaxy Watch | V2-E3 |

### Etapa 1 · 0.20.0 (plani i 08.11.2026)

**Mënyra e punës.** Sesioni kryesor është orkestruesi: mban planin, ndan detyrat, rishikon çdo ndryshim dhe e bashkon te `main`. Çdo detyrë e bën një nënagjent në një `git worktree` më vete, në degën `e1/<ID>`, dhe kthen përmbledhjen me rezultatet e provave. Logjika pa UI ndërtohet me prova përpara kodit. Çdo varësi e re verifikohet para instalimit. Ekranet ndjekin kanavacën "Vrull · Ekranet" dhe sistemin e dizajnit Vrull (me "Rregullat e temave"). Nuk ka publikim deri te V2-E1-16; prova në emulator vetëm kur ndryshon pjesa native (E1-08, E1-12, E1-13) dhe në fund. Të dhënat e v1 në telefonin e përdoruesit duhet të kalojnë të paprekura në v2.

| ID | Detyra | Varet nga |
|---|---|---|
| V2-E1-01 | Sistemi Vrull në kod: tokenat, fontet, komponentët, roja e dizajnit | – |
| V2-E1-02 | Dy gjuhët: katalogu sq/en, formatet, zgjedhja te Cilësimet | – |
| V2-E1-03 | Spike muzika: kontrolli i app-it të muzikës dhe burimi i tempos | – |
| V2-E1-04 | Logjika e progresit: peshat e javës, pragu i rekordit, pesha pa e1RM, rregullat e programeve të tua | – |
| V2-E1-05 | Korniza: tab-et, kreu, Cilësimet, Pamja, temat, sfondet, migrimi i të dhënave të v1 | E1-01, E1-02 |
| V2-E1-06 | Sot | E1-05 |
| V2-E1-07 | Seanca: seti, pushimi, ushtrimet, mbyllja, rekordi | E1-05, E1-04 |
| V2-E1-08 | Seti nga njoftimi | E1-07 |
| V2-E1-09 | Programi: Shortcut to Size, ushtrimi, biblioteka, krijo ushtrim, peshat e javës | E1-05, E1-04 |
| V2-E1-10 | Ndërtuesi i programeve me shabllone dhe nivelet e slotit | E1-09 |
| V2-E1-11 | Importi i programit nga PDF me AI dhe kufiri mujor | E1-10 |
| V2-E1-12 | Muzika "Trupi në ritëm" | E1-03, E1-07, E1-14 |
| V2-E1-13 | Videot e formës | E1-07 |
| V2-E1-14 | Trupi 3D: ngjyrat e Vrullit, shtresat, sipas matjeve, shto matjen | E1-05 |
| V2-E1-15 | Historiku dhe seanca e kaluar, ndryshimi i një seti | E1-05 |
| V2-E1-16 | Lëshimi 0.20.0: rishikimi, provat, emulatori, publikimi | të gjitha |
| V2-E1-17 | Hyrja dhe emri Vrull: hyrja, marrja e të dhënave, hapat e parë, emri i app-it | E1-05 |
| V2-E1-18 | Pastrimi pas valës B: një burim për peshat e javës dhe kohëzgjatjen, emrat e përbashkët, fotot e ushtrimeve, ikona e app-it, provat nën ngarkesë | E1-06, E1-07, E1-09, E1-14, E1-15, E1-17 |

**Pas rishikimit të E1 (08.11.2026), për fillimin e Etapës 2.** Rishikimi në tri boshtet mbi pjesët me rrezik (native, të dhënat dhe sinkronizimi, Supabase, `src/lib`) u ndreq te 0.20.0: kufiri i AI-së me rezervim dhe kostoja e stream-it të ndërprerë (me prova, `program-import/handler.ts`), videot pa u lexuar të gjitha në kujtesë, id-ja e qëndrueshme e peshave të javës, "nuk u gjet" i tempos, gjuha te rikujtuesit, `onResume` një herë, kontrolli i tipeve të funksioneve te `npm run lint`. Mbeten, si detyrë e parë pastrimi e E2: një helper për `numberOrNull` (5 kopje) dhe `settingsRow` (5 kopje), një fabrikë për cilësimet e sinkronizuara (gjuha dhe sfondi), `describeSync` pa përdorues, `label` vetëm shqip te `weekWeightsView`, kopjet `follow()`/`text()` te `SessionMusic.java` dhe `MusicPlugin.java`, ngjyra `EMBER` nga `@color/notification_ember`, kodet e gabimeve të importit në një vend (`shared.ts`), një tip për `{ blockName, blockWeeks, week, run }`, `programmeHome` sipas fjalorit; prova e2e me Supabase për `week_weights`, `form_videos` dhe `ai_usage`.

## V2-E1-01 · Sistemi Vrull në kod

- `globals.css` me tokenat e Vrullit për OLED, Natë dhe Ditë (përfshirë `track`, `model-light`, `volume-1..3`), nga `tokens.json` i sistemit të dizajnit; asnjë token i Omal nuk mbetet.
- Barlow dhe Barlow Condensed të paketuara në app (OFL), që app-i të mos presë rrjetin.
- Komponentët e sistemit: Button (52 / 58 px), Stepper, ListRow, StatTile, InsightCard, FactCard, ProgressBar, WeekStrip, TabBar, RirPicker, QuickAdd; ikonat me vijë 2 px.
- `DESIGN.md` zëvendësohet nga rregullat e Vrullit; `CLAUDE.md` dhe `scripts/check-design.mjs` përditësohen (prushi në vend të amber-it, pa hex në komponentë).

**Pranimi:** `npm run build`, `npm test`, `npm run lint` kalojnë; një faqe e brendshme me komponentët në tri temat, me provë pamjeje në 390 px; kontrasti ≥ 4,5:1 në çdo temë.

## V2-E1-02 · Dy gjuhët

- Katalog sq/en, `t()` me çelësa, shqipja parazgjedhje; emrat e ushtrimeve mbeten në anglisht.
- Formatet me `Intl` sipas gjuhës: numrat, datat, njësitë me hapësirë që nuk thyhet; shumësi me rregullat e shumësit.
- Zgjedhja e gjuhës te Cilësimet; `lang` i faqes ndjek gjuhën. Termat sipas SPEC §0.3a (Gjuhët).

**Pranimi:** prova për formatet dhe shumësin në të dyja gjuhët; ndërrimi i gjuhës ndryshon tekstet pa rinisje.

## V2-E1-03 · Spike muzika

- Android 13+ (Galaxy): `NotificationListenerService` + `MediaSessionManager.getActiveSessions`; çfarë jep Spotify dhe YouTube Music (titulli, artisti, kohëzgjatja, pozicioni, play/pause/para/mbrapa, radha e këngëve).
- **Pyetja kryesore:** a mund të nxirret përpara "kënga e setit" kur app-i i muzikës nuk e jep radhën? Nëse jo: zgjidhja e ndershme (p.sh. Vrull sugjeron "Kalo te kënga e radhës, 136 BPM" dhe e bën vetëm me prekjen e përdoruesit).
- Burimi i tempos: kushtet, atribuimi, kufijtë, kostoja; "Prek ritmin" si rezervë.

**Pranimi:** `docs/research/muzika.md` me burimet; V29 te SPEC përditësohet me atë që del e mundur.

## V2-E1-04 · Logjika e progresit

- Peshat e javës së radhës sipas §7, që përdoruesi i pranon ose i ndryshon (V23); pesha pa e1RM = pesha e fundit; pragu i rekordit për peshën e zgjedhur.
- Rregullat e programeve të tua: pragu i RIR-së dhe shtesa e peshës, nivelet e slotit (gjithë programi, blloku, java).

**Pranimi:** prova me shembujt e kanavacës: Bench Press 62,5 × 12 → e1RM 87,5, rekord +1,5; Java 3 → 67,5 kg × 6–8; pulpat → pesha e fundit; 12 përsëritje si prag te 62,5 kg.

## V2-E1-05 · Korniza

- Tab-et Sot, Programi, Ushqimi, Progresi, Miqtë (Miqtë bosh deri te Etapa 4; Ushqimi i v1 në stilin e ri); butoni "Profili dhe cilësimet" te kreu.
- Cilësimet e reja: Pamja (OLED, Natë, Ditë; sfondi "I plotë" ose "Vija shpejtësie"), Gjuha, Përditësimi.
- Migrimi i të dhënave të v1 te v2 pa humbje (seancat, setet, matjet, ushqimi), me provë.

**Pranimi:** të gjitha ekranet e v1 hapen në sistemin e ri në tri temat; prova e migrimit kalon me një kopje të të dhënave të v1.

## V2-E1-06 · Sot

Sipas bordeve Sot dhe Sot · Ditë e lodhur (gjendja e ditës vjen në Etapën 3; deri atëherë vetëm pamja energjike). **Pranimi:** ekrani përputhet me bordin në 390 px dhe në tri temat.

## V2-E1-07 · Seanca

- Seti me numrat e mëdhenj, "Herën e kaluar", pragu i rekordit, rest-pause si segmente; pushimi 90 s me −15 / +15 dhe njoftim; lista e ushtrimeve; mbyllja me rekordet dhe lëvizjen e rekordit (me "lëvizje të reduktuar").
- Vendi për mini-player-in e muzikës (E1-12).

**Pranimi:** një seancë e plotë e Stërvitjes 1 regjistrohet pa internet dhe sinkronizohet; rekordi del në moment.

## V2-E1-08 · Seti nga njoftimi

Njoftimi i seancës me veprime: ruaj setin me peshën dhe përsëritjet e propozuara, ndrysho, kapërce pushimin; edhe në ekranin e kyçur. **Pranimi:** në emulator, një set i ruajtur nga njoftimi del te seanca dhe sinkronizohet.

## V2-E1-09 · Programi

Ekrani i programit me ditët e javës, faqja e ushtrimit (foto bardh e zi, grafiku i e1RM-së, historia, video), biblioteka me filtrat, "Krijo ushtrim", "Peshat e javës". **Pranimi:** përputhen me bordet; ushtrimi i krijuar përdoret në një program dhe numërohet te volumi.

## V2-E1-10 · Ndërtuesi i programeve

Programet e mia, ndërtimi nga shabllonet, redaktori i ditës me tërheqje, sloti me nivelet, rregulli i progresit; motori i programit i mbështet programet e përdoruesit (prova përpara kodit). **Pranimi:** një program Sipër/poshtë 4 ditë ndërtohet, stërvitet dhe progreson sipas rregullit.

## V2-E1-11 · PDF me AI

- Edge Function në Supabase që lexon PDF-në me AI; çelësi i AI-së është secret i Supabase që e shton përdoruesi (§19), kurrë në app.
- Ushtrimet e pasigurta pyeten (Po / alternativa / tjetër); drafti hapet te ndërtuesi.
- Kostoja ruhet për përdorues dhe muaj; te €10 AI ndalet deri në muajin tjetër (V25).

**Pranimi:** PDF-ja e Shortcut to Size kthehet në draft programi; kostoja e importit shfaqet dhe ruhet.

## V2-E1-12 · Muzika "Trupi në ritëm"

Sipas spike-ut E1-03: lidhja dhe leja, player-i, pushimi, dita e lodhur, "Prek ritmin", mini-player-i te seanca; trupi pulson me BPM-në, me "lëvizje të reduktuar". **Pranimi:** në emulator me një app muzike prove, kënga shfaqet, kontrollet punojnë dhe pulsi ndjek tempon.

## V2-E1-13 · Videot e formës

Regjistrimi nga seanca, ruajtja në telefon dhe në Supabase Storage (private, RLS), shikimi dhe fshirja; mesazhi kur afrohet kufiri i hapësirës (V27). **Pranimi:** një video ruhet pa internet dhe ngarkohet kur kthehet rrjeti; vetëm pronari e sheh.

## V2-E1-14 · Trupi 3D

Ngjyrat e Vrullit dhe drita nga `model-light`; volumi me `volume-1..3`; shtresat (muskujt e thellë, TH-19); trupi sipas matjeve; "Shto matjen". **Pranimi:** trupi duket njësoj si në bordet e tri temave; matja e re ndryshon trupin sipas matjeve.

## V2-E1-15 · Historiku

Historiku i seancave sipas javëve, seanca e kaluar me setet dhe rekordet, ndryshimi i një seti që rillogarit e1RM-në dhe rekordet. **Pranimi:** përputhet me bordet; ndryshimi i një seti sinkronizohet.

## V2-E1-17 · Hyrja dhe emri Vrull

Shtuar më 08.11.2026: hyrja dhe hapat e parë mbetën jashtë kornizës (E1-05) dhe pa detyrë. Sipas bordeve Hyrja · Hyr, Hapja, Gjuha dhe pesha, Ditët dhe oraret, Programi: hyrja (pa "Kam një kod ftese", që vjen me Etapën 4), marrja e të dhënave, katër hapat e parë me gjuhën te hapi 1; te "Zgjidh programin" Shortcut to Size, kurse "Ndërto timin" dhe "Importo nga PDF" shtohen kur të jenë gati E1-10 dhe E1-11. Emri Vrull kudo ku përdoruesi e sheh: emri i app-it në Android, njoftimi i përditësimit (në gjuhën e app-it), skedari i eksportit, hyrja; `appId` mbetet `al.traininghub.app`. **Pranimi:** përputhen me bordet në tri temat dhe në dy gjuhët; një përdorues i v1 hyn dhe i gjen të dhënat; një përdorues i ri kalon hapat e parë dhe nis te Java 0.

## V2-E1-18 · Pastrimi pas valës B

Shtuar më 08.11.2026, pas bashkimit të valës B. Pesha e javës e një sloti del nga një funksion i vetëm për Sot, seancën, Programin dhe njoftimin (E1-08); kohëzgjatja "~65 min" nga një formulë e vetme; tema e ditës ("Dita e gjoksit") dhe pajisjet te emrat e domenit; fotot e ushtrimeve (`ExercisePhoto`) kudo ku bordet i tregojnë (historiku, Sot, mbyllja e seancës); ikona e app-it, ikona e njoftimeve dhe favicon-i me shenjën e Vrullit; provat e ekraneve që dështojnë nën ngarkesë bëhen të qëndrueshme; kodi që mbeti pa përdorim hiqet. **Pranimi:** për të njëjtin slot, Sot, seanca dhe Programi tregojnë të njëjtën peshë dhe kohëzgjatje (provë); `npm test` i plotë kalon tri herë rresht.

## V2-E1-16 · Lëshimi 0.20.0

Rishikimi i kodit në tri boshtet, provat e plota dhe e2e me Supabase, prova në emulator me përditësimin v1 → v2 dhe të dhënat e v1, publikimi në app-releases dhe njoftimi i përditësimit brenda app-it. **Pranimi:** të gjitha kontrollet jeshile; përdoruesi e merr 0.20.0 nga app-i.

**Veprimet e përdoruesit për këtë etapë:** çelësi i AI-së si secret i Supabase (E1-11); instalimi i 0.20.0 dhe një seancë prove në telefon.

**Gjendja (08.11.2026):** 0.20.0 u publikua (GitHub Release dhe përditësimi brenda app-it, "Çfarë ka të re" nga `docs/whats-new/0.20.0.txt`), pas provës në emulator në të gjitha pjesët dhe rishikimit në tri boshtet (ndreqjet te "Pas rishikimit të E1"). Migrimet dhe RLS (133/133) në Supabase; funksionet `program-import` dhe `song-tempo` me JWT. Importi nga PDF u provua me çelësin e vërtetë dhe PDF-në e Shortcut to Size (08.11.2026, me përdorues prove të përkohshëm, i fshirë pas provës): 3 faza × 4 javë, 4 ditë me 9/10/7/8 slote, 67 ushtrime (29 të shënuara si të pasigurta për t'u parë), 86 s, €0,25, kostoja e ruajtur një herë. Mbeten te përdoruesi: çelësi `GETSONGBPM_API_KEY` si secret, lista `docs/PROVA-NE-TELEFON.md` në telefon, dhe (sipas dëshirës) titulli i Release-it v0.20.0 "Vrull 0.20.0" me dorë; workflow-i i jep titullin Vrull nga versioni tjetër.


### Etapa 2 · 0.21, 0.22, 0.23 (plani i 08.11.2026)

**Mënyra e punës.** Tri versione të vogla, secili me bordet e dizajnit para kodit: bordet → komentet e përdoruesit → kodi me prova përpara (logjika pa UI) → rishikimi në tri boshtet → prova në emulator vetëm për pjesët native që ndryshuan (`skip` për të tjerat) → pyetet përdoruesi → publikimi. Lexo `docs/MESIMET.md` para çdo detyre. Çdo tabelë e re: migrim, `TABLES`/`INDEXES`, version i ri te `db.ts`, RLS e provuar. Çdo veçori me AI provohet me të dhëna të vërteta para lëshimit. Muzika është në pauzë (V45).

| ID | Detyra | Varet nga |
|---|---|---|
| V2-E2-00 | Pastrimi i E1 (lista te "Pas rishikimit të E1") | – |
| V2-E2-01 | Bordet e dizajnit 0.21 | – |
| V2-E2-02 | Kalkulatori i objektivave (logjika) | – |
| V2-E2-03 | Faqja Objektivat dhe hapi te hapat e parë | E2-01, E2-02 |
| V2-E2-04 | Kontrolli javor | E2-02, E2-03 |
| V2-E2-05 | Plani im | E2-01, E2-02 |
| V2-E2-06 | Oraret e vakteve | E2-01, E2-05 |
| V2-E2-07 | Uji | E2-01 |
| V2-E2-08 | Rikujtuesit e zgjuar | E2-05, E2-06, E2-07 |
| V2-E2-09 | Dita e humbur | E2-01 |
| V2-E2-10 | Suplementet e mia dhe etiketa me AI | E2-01 |
| V2-E2-11 | Lëshimi 0.21.0 | E2-00 … E2-10 |
| V2-E2-12 | Bordet e dizajnit 0.22 | E2-11 |
| V2-E2-13 | Kutia e AI-së: ushqimi, uji, suplementet | E2-12 |
| V2-E2-14 | Kutia e AI-së: setet | E2-13 |
| V2-E2-15 | Trajneri | E2-13 |
| V2-E2-16 | Foto e ushqimit, makrot e shpejta, të fundit, të preferuarat, "Si dje" | E2-12 |
| V2-E2-17 | Kufiri i AI-së për person dhe Admini | E2-13 |
| V2-E2-18 | Lëshimi 0.22.0 | E2-12 … E2-17 |
| V2-E2-19 | Bordet e dizajnit 0.23 | E2-18 |
| V2-E2-20 | Qëllimet javore dhe "Mirë se u ktheve" | E2-19 |
| V2-E2-21 | Rekordet, përmbledhja e së dielës, distinktivët | E2-19, E2-20 |
| V2-E2-22 | Pamja e re: Sot, Ushqimi, Seanca, Progresi | E2-19 |
| V2-E2-23 | Lëvizja | E2-22 |
| V2-E2-24 | Lëshimi 0.23.0 | E2-19 … E2-23 |

## V2-E2-00 · Pastrimi i E1

Lista te "Pas rishikimit të E1", si detyrë e parë e etapës, pa ndryshuar sjelljen. **Pranimi:** `npm test`, `npm run lint`, `npm run build` kalojnë; provat e2e të reja për `week_weights`, `form_videos` dhe `ai_usage` kalojnë me përdorues prove të përkohshëm, i fshirë pas provës.

**Gjendja (09.11.2026):** gati. `settingsRow` dhe `syncedSetting` (gjuha, sfondi) te `data/settings-row.ts`; `numberOrNull` te `lib/number.ts`; `describeSync` u hoq (ekrani përdor `syncSummary`, provat e kohës kaluan atje); `weekWeightsView` jep `block: ProgramWeek` në vend të tekstit shqip; tipi `ProgramWeek` te `program/types.ts`; `programmeHome` → `activeProgramHome` ("Programi aktiv"); kodet e gabimeve të importit te `shared.ts` (`IMPORT_ERRORS`); `MusicPlugin.text` dhe `switchTo` për të dy klasat Java; ngjyra e njoftimeve nga `@color/notification_ember`. Provat e2e (7/7) kaluan me përdorues të përkohshëm, i fshirë pas provës; pastrimi i tyre nuk prek më `ai_usage`, që app-i nuk e shkruan. Java kontrollohet nga build-i i Android-it te prova e lëshimit.

## V2-E2-01 · Bordet e dizajnit 0.21

Borde të shpejta në stilin Vrull, në tri temat, shqip, në 390 px: faqja Objektivat (me "Di yndyrën time"), hapi i objektivave te hapat e parë, karta e kontrollit javor te Sot, Plani im (vakti, ndërrimi i ushqimit, porcioni, shto/hiq vakt), oraret e vakteve, karta e ujit te Sot, njoftimi i vaktit me dy butona (edhe në ekranin e kyçur), dita e humbur te Sot dhe te java, "Shto suplement" me "Fotografo etiketën". **Pranimi:** përdoruesi i komenton; ndryshimet shkruhen te SPEC para kodit.

**Gjendja (08.11.2026):** 12 bordet janë te kanavaca "Training Hub v2 · Vrull", faqja "0.21 · Ushqimi dhe dita" (OLED, shqip, me numrat e përdoruesit); presin komentet. Temat Natë dhe Ditë dhe anglishtja vijnë pas komenteve, që të mos përsëriten ndryshimet.

**Gjendja (09.11.2026):** përdoruesi i pranoi bordet pa ndryshime ("me bordet jam ok"). Bordet e Natës, të Ditës dhe në anglisht nuk u bënë veç: ekranet e ndërtuara u kontrolluan në 390 px në tri temat dhe dy gjuhët (QA në shfletues, pa scroll anësor, prekjet 44 px), që zë vendin e tyre për 0.21.

## V2-E2-02 · Kalkulatori i objektivave

Logjika pa UI te `src/nutrition/`, me prova përpara kodit, sipas Shtojcës C: Mifflin-St Jeor, Cunningham me yndyrën, US Navy nga perimetrat, aktiviteti, dita e stërvitjes, ritmi, makrot, kufijtë, rrumbullakimi, mirëmbajtja e njohur. **Pranimi:** shembulli i Shtojcës C del saktë (2 630 / 2 930 kcal, 176 g P, 79 g Y, 304 / 379 g K); kufijtë (1 500 / 1 200 kcal, karbohidratet ≥ 50 g, yndyra ≥ 20%) kanë prova; të njëjtat hyrje japin të njëjtat numra në të dy gjuhët.

**Gjendja (08.11.2026):** gati: `src/nutrition/calculator.ts` (`calculateTargets`, `navyBodyFat`) me 17 prova përpara kodit, të kontrolluara me mutacion (stërvitja 3,4 kcal/kg, yndyra 20%, 7 700 kcal/kg, kufiri i kalorive). Ekranet ende përdorin `nutritionTargets` deri te E2-03.

## V2-E2-03 · Faqja Objektivat

Sipas bordit dhe §9: Ushqimi › Objektivat, hapi te hapat e parë për përdoruesit e rinj, fushat e reja te `user_settings` (gjinia, viti i lindjes, gjatësia, aktiviteti, qëllimi, ritmi, proteina dhe yndyra g/kg, mirëmbajtja e njohur), të sinkronizuara. "Ruaj" vlen nga sot; objektivat e ruajtura të ditëve të kaluara mbeten. Përdoruesi ekzistues pa këto fusha sheh te Ushqimi një kartë "Llogarit objektivat e tua" dhe deri atëherë objektivat e vjetra. **Pranimi:** pas "Ruaj", Sot dhe Ushqimi tregojnë objektivat e reja; dje mbetet me të vjetrat (provë); shqip dhe anglisht; tri temat në 390 px.

**Gjendja (09.11.2026):** kodi dhe provat gati: `data/targets-profile.ts` (profili, `targetsFor`, `saveTargetsProfile` që rillogarit objektivat e ruajtura nga sot), `routes/nutrition-targets.tsx` (faqja, fletët e yndyrës dhe të mirëmbajtjes), hapi 4 nga 5 te hapat e parë me "Më vonë", ftesa dhe lidhja te Ushqimi. Migrimi `20261109090000_user_settings_targets.sql` pret përdoruesin (SQL Editor; `apply_migration` u refuzua). Mbetet kontrolli i pamjes në 390 px në tri temat, bashkë me ekranet e tjera të 0.21 para lëshimit.

## V2-E2-04 · Kontrolli javor

Logjika pa UI (pesha trend, mirëmbajtja e vërtetë, propozimi me gjysmën e diferencës dhe ±150 kcal, kushtet 4 ditë + 1 peshim) dhe karta te Sot dhe te Objektivat; pranimi ruhet si korrigjim me datë, i sinkronizuar. **Pranimi:** prova me javë sintetike: shtim i ngadaltë → +kcal, shtim i shpejtë → −kcal, të dhëna të pakta → pa propozim; "Po" ndryshon objektivat nga sot, "Jo tani" e heq kartën deri të hënën tjetër.

**Gjendja (09.11.2026):** kodi dhe provat gati: logjika `nutrition/weekly-check.ts` (pesha trend, mirëmbajtja e vërtetë me të njëjtën energji për kg si kalkulatori, ditët e regjistruara me ≥ 50% të objektivit, propozimi), `data/weekly-check.ts` (java e rishikuar, vendimi te tabela e re `weekly_checks`, Dexie versioni 7), korrigjimet e pranuara te objektivat (`targets-profile.ts`: `adjustments`, `withAdjustment`, karbohidratet ≥ 50 g) dhe rillogaritja e objektivave të ruajtura nga dita e pranimit. Karta `routes/weekly-check-card.tsx` te Sot dhe te Objektivat, me grafikun e 14 ditëve; te Objektivat edhe rreshti "Korrigjimet javore" dhe historia. Emri në kod dhe në anglisht është "weekly check/review", jo "check-in" (fjalori; check-in-i i mëngjesit është tjetër gjë). Migrimi `20261109120000_weekly_checks.sql` pret përdoruesin.

## V2-E2-05 · Plani im

Plani i përdoruesit për ditën e stërvitjes dhe të pushimit, nga shablloni i Jimit (tabelat `meal_templates` dhe `recipe_items` ose tabelë e re, sipas asaj që i përshtatet më mirë sinkronizimit). Shkallëzimi i porcioneve te objektivat me rrumbullakimin në njësi (logjika me prova përpara), ndërrimi i ushqimit (zëvendësimet e PDF-së së pari, pastaj ushqimet me makro të afërta), ndryshimi i porcionit, shto/hiq artikull dhe vakt, "Kthe planin e Jimit". "Regjistro <vaktin>" te Ushqimi regjistron artikujt e Planit tim. **Pranimi:** me objektivat e shembullit totali i Planit tim bie brenda ±5% te kcal dhe ±10 g te proteina (provë); një ndërrim ruhet dhe sinkronizohet; plani i ditës së pushimit nuk prek atë të stërvitjes.

**Gjendja (09.11.2026):** kodi dhe provat gati. Logjika: `nutrition/my-plan.ts` (`jimPlan`, `scalePlan` me dy faktorë për ushqimet me proteinë dhe të tjerat, rrumbullakimi në njësi dhe një kalim që e afron totalin te të katër makrot; `jimSwaps` sipas llojit të ushqimit, porcioni që mban proteinën ose kaloritë). Për përdoruesin: stërvitje 2 881 kcal / 177 P / 383 K / 80 Y (objektivi 2 930 / 176 / 379 / 79), pushim 2 594 / 177 / 306 / 81. Ruajtja: `data/my-plan.ts` te `meal_templates` (një rresht për vakt dhe lloj dite, `items` jsonb; skema e v1 mjafton, pa migrim); ndryshimi i parë ruan gjithë ditën, që vaktet e tjera të mos lëvizin më vetë. Faqja `routes/my-plan.tsx` (Ushqimi › Plani im): totali kundrejt objektivave, vaktet, fleta e vaktit (porcioni me hapin e njësisë, hiq, ndërro, shto ushqim, "Ruaj vaktin") dhe fleta e ndërrimit (ushqimet e Jimit, ushqimet e përdoruesit, kërkimi, ndryshimi në kcal); "Kthe planin e Jimit" me konfirmim. "Regjistro" te Ushqimi regjistron artikujt e Planit tim. Ndryshim nga bordi: "Shto vakt" dhe "Hiq vaktin" nuk dalin këtu, sepse numri i vakteve jeton te Oraret e vakteve (V35, nga nesër); faqja ka lidhjen "Oraret e vakteve".

**Gjendja (09.11.2026, pas rishikimit):** zëvendësimet e PDF-së u shtuan (`nutrition/pdf-swaps.ts`: 53 ushqime në gjashtë lista, makrot nga USDA SR Legacy, artikujt `pdf:<çelësi>`; `pdfSwaps`, `pdfFoodOptions`) dhe dalin të parat te fleta e ndërrimit; "Shto ushqim" i gjen me kërkim. Rregulli "brenda objektivave" kaloi te `nutrition/my-plan.ts` (`withinPlanTargets`) me provë.

## V2-E2-06 · Oraret e vakteve

Sipas §9 dhe bordit: zgjedhja e numrit të vakteve (3–9), lëvizja dhe heqja e secilit, ora e stërvitjes për çdo ditë (jo vetëm e ditës së parë, siç bën sot `settings.tsx`), ndryshimi nga dita tjetër. Rregulli i vaktit pranë stërvitjes mbetet. Dita e ushqimit ndërrohet 3 orë para zgjimit (V46): një funksion i vetëm jep "datën e ushqimit" për një çast dhe e përdorin Ushqimi, regjistrimi, uji, suplementet, rikujtuesit dhe dita e humbur. Defekti i 0.20 ishte te Ushqimi, jo te rikujtuesit: me gjumin pas mesnate "Para gjumit" (00:30) dilte "Pa regjistruar" gjithë ditën dhe dita ndërrohej në mesnatë. Rikujtuesit e kishin datën e duhur me një rregull "ora para 04:00 = nesër", që tani zëvendësohet nga minutat e orarit (`ScheduledMeal.minutes`). **Pranimi:** prova të logjikës për 3, 5 dhe 9 vakte, për stërvitjen në mëngjes dhe në mbrëmje, dhe për gjumin pas mesnate (zgjimi 08:20, gjumi 01:00: "Para gjumit" del në 00:30 të ditës tjetër kalendarike, por i përket ditës së ushqimit që mbaron); orari i ri del te Ushqimi dhe te rikujtuesit nga dita tjetër.

**Gjendja (09.11.2026):** kodi dhe provat gati: `nutrition/food-day.ts` (V46), minutat e vakteve te orari dhe te rikujtuesit, `data/schedule-settings.ts` (ora e stërvitjes për çdo ditë, plani i vakteve nga nesër me planin e mëparshëm për sot), faqja `routes/meal-times.tsx` (Ushqimi › Oraret e vakteve) dhe lidhja te Ushqimi. Migrimi `20261109110000_user_settings_meal_plan.sql` pret përdoruesin. Fleta "Oraret" te Cilësimet mbetet si ishte (një orë për të gjitha ditët).

## V2-E2-07 · Uji

Tabela e re e ujit (ml, ora, data), karta te Sot me një prekje dhe "Kthe mbrapsht", totali te Ushqimi, objektivi sipas §9. **Pranimi:** një gotë ruhet pa internet dhe sinkronizohet; objektivi ndryshon me llojin e ditës; prekja 44 px, tri temat.

**Gjendja (09.11.2026):** kodi dhe provat gati: `nutrition/water.ts` (objektivi), `data/water.ts`, tabela `water_logs` (Dexie versioni 6, migrimi `20261109100000_water_logs.sql` pret përdoruesin), karta te Sot me "Kthe mbrapsht" për 6 s, totali te Ushqimi. Data e ditës kalon te dita e ushqimit (V46) me E2-06.

## V2-E2-08 · Rikujtuesit e zgjuar

Sipas §13 (V37): pa rikujtues për atë që është regjistruar (edhe pas sinkronizimit), butonat te njoftimi, kufiri ditor dhe bashkimi, orët e qeta, uji sipas ritmit, heshtja pas 3 ditëve të injoruara. Butonat ndjekin modelin e `SessionActionReceiver` (E1-08): PendingIntent i qartë, veprimi ruhet në radhë native, app-i e zbaton sapo hapet ose kthehet, njoftimi bëhet "U regjistrua"; punojnë edhe me ekran të kyçur. **Pranimi:** prova të planit për çdo rregull; në emulator (pjesë e re e provës së Android-it, `rikujtuesit`): "Hëngra si në plan" nga ekrani i kyçur regjistron vaktin dhe rikujtuesi tjetër i tij nuk vjen; "Shty 30 min" e rikthen njoftimin.

**Gjendja (09.11.2026):** kodi dhe provat gati: plani `reminders/plan.ts` (kufiri 4 sipas përparësisë, pa të regjistruarat, uji sipas ritmit, orët e qeta, të heshturit, butonat dhe teksti pas prekjes, trupat nga Plani im, vaktet pas mesnate kur planifikohet pas 00:00), `reminders/ignored.ts` (3 ditë të injoruara), `data/reminders.ts` (cilësimet te jsonb, të dhënat, heshtja), `data/reminder-actions.ts` (zbatimi i radhës, "Kthe mbrapsht"), plugin-i native `RemindersPlugin`/`ReminderNotifier`/`ReminderReceiver` (alarmet, butonat, shtyrja, radha, ditari, rinisja pas ndezjes; kompilohet me gradle lokalisht), Cilësimet › Rikujtuesit (uji, orët e qeta, "Ndize përsëri") dhe pjesa `rikujtuesit` te prova e Android-it (ekrani i kyçur, procesi i vrarë, shtyrja, kthe mbrapsht). Mbetet: prova e Android-it në CI.

**Gjendja (09.11.2026, pas rishikimit):** butonat lexojnë rikujtuesin që njoftimi tregon (`shown` te `ReminderNotifier`), jo listën e re: plani i ri u jep id-të të tjerëve dhe shtyrja që ra hiqet nga lista. "U regjistrua" mbetet me "Kthe mbrapsht" deri në 10 minuta edhe kur plani i ri heq njoftimet e vaktit; "Kthe mbrapsht" hyn gjithnjë në radhë. Zbatimet njëkohësisht rreshtohen; plani rinovohet pas çdo sinkronizimi. Uji: një rikujtues në ditë edhe me një planifikim të dytë; heshtja e ujit kur nuk u regjistrua asnjë gotë. Dita e humbur te rikujtuesi përdor rregullin e Sot (`missedYesterday`) dhe kërkon program me stërvitje. Prova e Android-it shton shtyrjen që vjen sërish dhe id-në e ripërdorur.

## V2-E2-09 · Dita e humbur

Sipas §13 (V38): gjendja "E humbur" te java (Sot, Programi), karta dhe njoftimi i mëngjesit "Dje nuk u stërvite. Stërvitja N sot?", "Po" e bën sot ditë stërvitjeje (lloji i ditës, objektivat, orari), "Jo" e lë. **Pranimi:** prova me kalendarë: një ditë e humbur, dy rresht, dita e humbur e shtunë me javën që mbyllet; treguesi nuk lëviz pa seancë.

**Gjendja (09.11.2026):** kodi dhe provat gati: logjika `program/missed-day.ts` (dita e humbur, pyetja e sotme, ditët rresht), `data/missed-day.ts` (seancat, llojet e ditëve me dorë, "Po"/"Jo" si lloji i ditës së sotme, pa tabelë të re), gjendja "E humbur" te java e Sot me legjendën, karta `routes/missed-day-card.tsx`, "E humbur: …" te stërvitja e radhës te Programi, njoftimi i mëngjesit te `reminders/plan.ts`. Ditët e stërvitjes te java marrin unazën `subtle` të bordit, që legjenda të përputhet.

## V2-E2-10 · Suplementet e mia

Sipas §10: "Shto suplement" me dorë, makrot për lugë dhe regjistrimi te ushqimi për pluhurin e proteinës, ndryshimi dhe heqja; funksioni `supplement-label` (Supabase, JWT, kufiri dhe rezervimi i AI-së si te `program-import`, logjika në modul pa Deno me prova, `tsc` i funksioneve) që lexon foton e etiketës. Fotoja nuk ruhet. `ai_usage.feature` ka nevojë për vlerën e re (`supplement_label`) me migrim. **Pranimi:** etiketa e vërtetë e një whey-i lexohet saktë (provë me përdorues të përkohshëm, si te importi); pa internet fleta punon me dorë; "E mora" te proteina shton makrot te vakti një herë.

**Gjendja (09.11.2026):** kodi dhe provat gati: `data/supplements.ts` (shto, ndrysho, hiq; proteina me makro për lugë dhe "Numëroje te ushqimi": "E mora" shton te vakti një regjistrim me ushqimin e suplementit, një herë, edhe nga rikujtuesi), evidenca "E panjohur", faqja `routes/supplement-editor.tsx` (me dorë, "Fotografo etiketën", "Nga etiketa" me fushat e palexuara, pa internet), lidhjet te fleta e suplementeve, rreshti "Etiketat e suplementeve" te Cilësimet › AI, dhe funksioni `supplement-label` (logjika dhe rrjedha pa Deno me prova, një kufi me importin; prova kontrollon që modeli, çmimet, kursi dhe kufiri janë të njëjta). Migrimi `20261109130000_supplements_custom.sql` pret përdoruesin; pas tij: vendosja e funksionit dhe prova me etiketë të vërtetë me përdorues të përkohshëm.

**Gjendja (09.11.2026, pas migrimeve):** katër migrimet e 0.21 u zbatuan nga përdoruesi (kontrolluar me lexim: tabelat me RLS dhe katër politikat, kolonat, kufizimet, indekset; këshilluesi i sigurisë pa gjë të re). Funksioni `supplement-label` u vendos (v1, verify_jwt). Prova me një përdorues të përkohshëm: një etiketë whey e vizatuar (Nutrition Facts, për lugë dhe për 100 g, kJ dhe kcal) u lexua 8 nga 8 (emri, proteinë, 1 lugë, 30 g, 113 kcal, 26 g proteinë, 1,2 g karbohidrate, 0,3 g yndyrë) për 2,7 s dhe 0,004 €; një foto pa etiketë kthen `not_label` (422) me koston e ruajtur; pa hyrje 401. Mbetet: etiketa e vërtetë e whey-t të përdoruesit, nga telefoni pas lëshimit.

## V2-E2-11 · Lëshimi 0.21.0

Rishikimi në tri boshtet, provat e plota, prova në emulator (pjesët e reja dhe `instalimi`), `docs/whats-new/0.21.0.txt`, pyetet përdoruesi, publikimi. **Pranimi:** të gjitha kontrollet jeshile; përdoruesi e merr 0.21.0 nga app-i.

## V2-E2-12 · Bordet e dizajnit 0.22

Kutia e AI-së te Sot (shkrimi, mikrofoni i tastierës, pyetja kur mungon diçka, përmbledhja për konfirmim), trajneri, foto e ushqimit, makrot e shpejta, të fundit dhe të preferuarat, "Si dje", kufiri te Admini. **Pranimi:** përdoruesi i komenton para kodit.

## V2-E2-13 · Kutia e AI-së: ushqimi, uji, suplementet

Funksioni `log-parse` (JWT, kufiri, rezervimi, prompt caching me kontekstin e përdoruesit: Plani im, ushqimet dhe porcionet e tij, suplementet, të shpeshtat, shembuj në shqip) kthen një draft me ushqime (me gramë dhe vakt), ujë dhe suplemente; pyet vetëm kur mungon ora ose sasia; përmbledhja te Sot konfirmohet me një prekje dhe çdo rresht ndryshohet ose hiqet. **Pranimi:** mesazhi shembull i përdoruesit (08.11.2026, proteina në 07:00, tostet dhe vezët në 12:00, gjysmë pule dhe panetone në darkë, kreatina) jep regjistrimet e duhura pas një konfirmimi (provë me AI-në e vërtetë); pa internet kutia thotë që kërkon rrjet dhe ruan tekstin.

## V2-E2-14 · Kutia e AI-së: setet

Po ajo kuti regjistron sete te seanca e sotme ose e kaluar ("dje bëra 3×10 Bench 60 kg"), me përmbledhjen dhe konfirmimin; ushtrimet përputhen me programin dhe bibliotekën, të pasigurtat pyeten. **Pranimi:** setet e konfirmuara dalin te seanca dhe rillogarisin e1RM-në dhe rekordet; provë me AI-në e vërtetë.

## V2-E2-15 · Trajneri

Pyetjet e lira te po ajo kuti marrin përgjigje të shkurtra nga të dhënat e përdoruesit (objektivat, ushqimi i ditës, plani, stërvitjet e fundit), pa këshilla mjekësore. **Pranimi:** "Sa proteinë më mbetet sot?" dhe "Çfarë stërvitje kam nesër?" përgjigjen saktë nga të dhënat; kostoja numërohet te kufiri.

## V2-E2-16 · Ushqimi më i shpejtë

Foto e ushqimit me AI (vlerësim, gjithmonë me konfirmim), makrot e shpejta (kcal dhe makro pa ushqim), të fundit dhe të preferuarat me një prekje, "Si dje" për një vakt. **Pranimi:** secila regjistron me ≤ 2 prekje pas hapjes së vaktit; foto provohet me të dhëna të vërteta.

## V2-E2-17 · Kufiri i AI-së për person

Kufiri mujor për person (pronari €40, miqtë €10) në server, i ndryshueshëm nga pronari te Admini; kostot e të gjitha funksioneve me AI numërohen bashkë. **Pranimi:** prova e rezervimit me 50 kërkesa paralele për çdo funksion të ri; RLS: një mik nuk e ndryshon kufirin e vet.

## V2-E2-18 · Lëshimi 0.22.0

Si E2-11. **Pranimi:** përdoruesi e merr 0.22.0 nga app-i.

## V2-E2-19 · Bordet e dizajnit 0.23

Qëllimet javore, "Mirë se u ktheve", banderola e rekordit, përmbledhja e së dielës me kartën për ndarje, distinktivët, pamja e re e katër ekraneve, shembujt e lëvizjes (video të shkurtra ose prototip). **Pranimi:** përdoruesi i komenton para kodit.

## V2-E2-20 · Qëllimet javore

Sipas V43: stërvitja sipas programit, ushqimi ≥ 5 ditë nga 7, uji; një ditë rezervë për fazë; "Mirë se u ktheve" pas një pushimi, pa faj. **Pranimi:** prova të logjikës për javë të plota, me ditë rezervë dhe pas pushimit.

## V2-E2-21 · Festimet dhe distinktivët

Banderola e rekordit te seanca, përmbledhja e së dielës (stërvitjet, volumi, rekordet, ushqimi, uji) me kartë për ndarje si imazh, distinktivët me rregulla të qarta. **Pranimi:** karta ndahet nga Android-i; distinktivët jepen një herë dhe sinkronizohen.

## V2-E2-22 · Pamja e re

Sot, Ushqimi, Seanca dhe Progresi sipas bordeve, me komponentët e Vrullit. **Pranimi:** tri temat, dy gjuhët, 390 px pa scroll anësor, prekjet 44 px (`ds-screens` dhe provat e ekraneve).

## V2-E2-23 · Lëvizja

Sipas V44: kalimi rresht → detaj, numrat që rrotullohen, dridhjet e shkurtra, shtypja 100 ms, festimet vetëm te rekordet dhe qëllimet; "lëvizje e reduktuar" i fik. Pa librari të re, ose me një të verifikuar. **Pranimi:** me "lëvizje e reduktuar" asgjë nuk lëviz (provë); asnjë animacion nuk vonon një prekje.

## V2-E2-24 · Lëshimi 0.23.0

Si E2-11. **Pranimi:** përdoruesi e merr 0.23.0 nga app-i.

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

**Gjendja (08.11.2026):** të katër funksionet te figura 2D (0.12.0) dhe te modeli 3D (0.14.0); muskujt e ushtrimit në 3D te ekrani i ushtrimit dhe te seanca, fokusi me emrin e muskulit dhe zmadhimi me dy gishta (0.15.0); volumi kundrejt objektivit 10–20 sete në javë, me setet e çdo pjese të grupit (0.16.0). Pas tij: shtresat e muskujve.

## TH-20 · Videot

- Fusha e linkut, nxjerrja e ID-së, shfaqja me `youtube-nocookie.com`, butoni për app-in e YouTube.

**Pranimi:** linket `youtu.be`, `youtube.com/watch` dhe `shorts` shfaqen saktë.

## TH-21 · QA dhe rishikimi

- Kalim i plotë në telefon: Java 0, një javë e Fazës 1, një ditë ushqimi, rikujtuesit, 3D; rishikim i kodit kundrejt specifikimit.
