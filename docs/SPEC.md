# Training Hub · Specifikimi v2.0

Data: 08.11.2026. v2.0 shton vendimet e seancës së pyetjeve të 08.11.2026 (V1–V27, §0) mbi v1.4 të 07.11.2026 (v1.2 pas rishikimit përfundimtar; v1.3 me detajet e Android-it nga TH-02; v1.4 me vendimet e dizajnit dhe radhën e ekraneve). Burimet: programi "Jim Stoppani's 12-Week Shortcut to Size" (PDF në projekt), vendimet e seancave të pyetjeve (Q1–Q18 të 07.11, V1–V27 të 08.11) dhe krahasimi i tri drejtimeve të dizajnit në kanavasin "Training Hub · Drejtimet e dizajnit". Ky dokument është burimi i së vërtetës për ndërtimin; çdo ndryshim vendimi shkruhet këtu. Ku §0 ndryshon nga seksionet e v1, vlen §0 derisa seksioni përkatës të rishkruhet në etapën e vet (§0.4).

## 0. Versioni 2 (vendimet e 08.11.2026)

### 0.1 Mënyra e punës

- **Dizajni para ndërtimit.** I gjithë app-i dizajnohet dhe aprovohet para se të ndërtohet: tri drejtime vizuale me emër dhe logo (D1), sistemi i dizajnit (D2), çdo ekran (D3). Pastaj ndërtohet në etapa (§0.4).
- **Publikimet vetëm në etapa.** Një version i ri në telefon del vetëm në fund të një etape; mes etapave përdoruesi merr pamje dhe video nga app-i. Prova në emulator (`scripts/android-smoke.mjs`) bëhet në fund të etapës, jo në çdo shtytje; testet, lint-i dhe build-i mbeten në çdo shtytje.
- **Orkestruesi me nënagjentë.** Çdo etapë ndahet në module; çdo modul e ndërton një nënagjent në kopjen e vet të repo-s (worktree), me TDD dhe QA, dhe e rishikojnë agjentë që nuk e kanë parë punën. Pjesët e përbashkëta (migrimet, `tables.ts`, `db.ts`, `router.tsx`, `app-data.ts`, tokenat) ndërtohen me radhë, para moduleve që varen prej tyre.

### 0.2 Vendimet

| # | Vendimi |
|---|---|
| V1 | Për përdoruesin dhe disa miq. Secili ka llogarinë dhe të dhënat e veta; përdoruesi është admini. |
| V2 | Dizajni i plotë më parë, pastaj etapat, me publikim vetëm në fund të çdo etape (§0.1). |
| V3 | Sistem i ri vizual vetëm për Training Hub, në vend të Omal UI v2 (§0.3). |
| V4, V17 | Ora: Samsung Galaxy Watch4 ose më e re (Wear OS). |
| V5, V11 | Miqtë: shohin stërvitjet, rekordet, vargjet dhe sfidat; pesha, matjet, fotot, videot dhe ushqimi mbeten private, përveç kur përdoruesi i ndan një nga një. Programet dhe recetat ndahen me lidhje. |
| V6, V21, V25 | AI për ushqimin (tekst dhe foto e pjatës) dhe për leximin e programeve nga PDF, për çdo përdorues, me kufi €10 në muaj për person që e ndryshon admini. Kur kufiri arrihet, AI ndalet deri në muajin tjetër dhe mbeten rrugët e tjera. Rregullat në telefon (sugjerimet, të shpeshtat, kujtesat, gatishmëria) punojnë pa AI dhe pa internet. |
| V7 | Gjurmime të reja: uji, gjendja dhe gatishmëria, zakonet, dhe gjumi, hapat dhe zemra nga ora. |
| V8 | Referencat vizuale: Whoop/Oura, Apple Fitness+/Strava, Headspace/Calm, Nike Training Club. |
| V9 | Ndërtues i plotë programesh me shabllone dhe progres automatik i zgjuar (rregulla që ndryshojnë peshat dhe vëllimin sipas RIR-it dhe gatishmërisë, si sugjerim). PDF-ja e mbush ndërtuesin. |
| V10 | Ilustrimet e ushtrimeve: fotot e free-exercise-db dhe muskujt e modelit 3D, të paraqitura në stilin e ri. |
| V12 | Ide të reja: trupi 3D sipas matjeve, "Plotëso makrot", seti nga njoftimi, uji sipas motit. |
| V13 | Miqtë e marrin app-in me një lidhje shkarkimi dhe hyjnë me kod ftese; përditësimet vijnë brenda app-it (§3b). |
| V14 | Listë e gatshme me rreth 150 ushqime dhe pjata shqiptare e ballkanike, me makrot nga burime të besueshme, plus AI. |
| V15 | Rikujtuesit e ushqimit vijnë vetëm kur vakti nuk është regjistruar, me "Hëngra si zakonisht" në njoftim; në mbrëmje, një kujtesë vetëm kur mungojnë proteinat. |
| V16 | Ora: Health Connect (gjumi, hapat, zemra në qetësi; stërvitjet shkruhen edhe te Samsung Health) dhe një app në orë (Wear OS): seti nga dora, timer-i i pushimit me dridhje, ritmi i zemrës gjatë seancës. |
| V18 | Sfidat: javore të gatshme dhe të krijuara nga çdo mik. |
| V19 | Radha e etapave: stërvitja, ushqimi, gjurmimet, miqtë, ora (§0.4). |
| V20 | Sfonde të zgjedhshme për çdo temë; pamja ndjek gjendjen e ditës: më e qetë në ditë të lodhura, më e fortë në ditë me energji (ngjyrat, lëvizja, tekstet). |
| V22 | Gjuha: shqip dhe anglisht, me zgjedhje te Cilësimet; shqipja parazgjedhje. Emrat e ushtrimeve mbeten në anglisht. |
| V23 | Gatishmëria e ulët sugjeron ndryshime në seancë (p.sh. −1 set, RIR 3); përdoruesi i pranon, i ndryshon ose i injoron. Programi nuk ndryshon pa të. |
| V24 | Emër dhe logo e re, të propozuara bashkë me drejtimet vizuale. `appId` (`al.traininghub.app`) nuk ndryshon. |
| V26 | Ndarja jashtë app-it: karta (foto e një rekordi, seance ose jave), raport PDF mujor, videot e formës. Videot e YouTube mbeten (§12). |
| V27 | Videot e formës ruhen në telefon dhe në cloud (Supabase Storage, private si fotot). Plani falas ka kufi hapësire; me shumë video dhe miq duhet plani me pagesë. |
| V28 | "Mëso": përdoruesi mëson nga vetë përdorimi. Karta "A e dije?" në kontekst (Sot, pushimi mes seteve, pas regjistrimit të një ushqimi); faqja e ushtrimit (si punon, muskujt 3D, gabimet e zakonshme, pak histori) dhe e pjatës (prejardhja, makrot me fjalë); kuiz javor me 5 pyetje nga ushtrimet dhe ushqimet e asaj jave, me varg dhe arritje. Çdo fakt ka burim të verifikuar; shpjegimet me AI shënohen si të tilla dhe hyjnë te kufiri i AI-së (V25). |
| V29 | Muzika: "Trupi në ritëm" (08.11.2026, zëvendëson "Shufrën"; përditësuar po atë ditë nga spike-u E1-03, `docs/research/muzika.md`). Trupi 3D i app-it është vizualizuesi: muskujt e stërvitjes së sotme ndizen në prush dhe pulsojnë me BPM-në e këngës që luhet. Kur ka të dhëna nga ora (Etapat 3 dhe 5), pranë tempos së këngës del zemra ("138 BPM kënga · 142 zemra"), pa pretenduar se zemra ndjek muzikën. Kur fillon seti, Vrull tregon tempon e këngës që luhet dhe ofron një këngë më energjike. Kënga ndërrohet vetëm me prekjen e përdoruesit, kurrë vetë. Kur app-i i muzikës e jep radhën, oferta ka emrin dhe tempon e këngës ("Pastaj: Titulli · 136 BPM", "Luaj tani"). Kur nuk e jep, ka vetëm "Kalo këngën", pa premtuar tempon e së radhës. Gjatë pushimit, pulsi i trupit ngadalësohet në gjysmën e tempos dhe muzika nuk ndërrohet vetë; me radhë, një këngë më e qetë sugjerohet me prekje. Tempo e rekomanduar për setet: 120–140 BPM për këngë që njihen, me fjalë, 130–150 BPM për muzikë pa fjalë (Jones, Karageorghis et al. 2024; Terry et al. 2020, Psychological Bulletin); muzika gjatë pushimit mbajti më lart shpejtësinë e shufrës te Bench Press (Lehman et al. 2021, n = 10). PDF-ja e Shortcut to Size nuk jep rekomandim për muzikën. Burimi: Vrull kontrollon app-in e muzikës së përdoruesit (Spotify, YouTube Music ose çdo tjetër) përmes sesioneve të medias së Android-it, me lejen "Qasja te njoftimet" një herë. Te APK-ja e shkarkuar nga një lidhje, Android 13+ kërkon më parë "Allow restricted settings" te Info e app-it. Vrull nuk lexon asnjë njoftim. Shfaqen vetëm kontrollet që app-i i muzikës pranon: luaj, pauzë, para, mbrapa dhe pozicioni; kënga e radhës vetëm kur app-i e jep radhën. Spotify Web API dhe App Remote nuk përdoren (Premium, 5 përdorues në Development Mode, kushtet e Spotify-t). Kontrollet janë te seanca dhe te njoftimi i seancës (E1-08); në ekranin e kyçur mbeten edhe ato të vetë app-it të muzikës; në orë vijnë me Etapën 5. Tempo: kërkim automatik sipas titullit dhe artistit, dhe vlera ruhet në telefon bashkë me burimin. Radha e burimeve: GetSongBPM (falas, me lidhje të detyrueshme te GetSongBPM.com, përmes një Edge Function me çelësin si secret), pastaj AcousticBrainz (CC0, këngët deri në 2022). "Prek ritmin" vlen kur tempo nuk gjendet ose për ta korrigjuar, bashkë me ×2 dhe ÷2. Tempo e Spotify-t nuk jepet për app-et e reja (27.11.2024). Lëvizja: pulsi është ndërrim i dy pamjeve të trupit me periudhë 60/BPM. Dy pamjet renderohen një herë dhe ndërrohen me CSS, pa WebGL në çdo goditje. Pulsi ndalet kur app-i del në sfond ose ekrani fiket, dhe ndjek tempon, jo goditjet. Me "lëvizje të reduktuar", trupi rri i ndezur pa pulsuar. Ndërtohet në Etapën 1 bashkë me seancën. |
| V30 | Ushqimi: pjatat marrin foto me ngjyra, në një stil të vetëm (nga sipër ose 45°, sfond i errët, dritë e ngrohtë); vaktet e përdoruesit marrin foton e tij si kopertinë; ushqimet bazë marrin ikona vektoriale në stilin e Vrullit (24 ikona te fillimi, rrjetë 32, vijë 2 px, detajet me 50%, gjithnjë njëngjyrëshe, kurrë prush; pllakë 48 me ikonë 28 në lista). Pjata pa foto ka gjendje "pa foto" të dizajnuar. Fotot vijnë me licencë të lirë ose nga përdoruesi; çdo foto ruan burimin dhe licencën. |
| V31 | Admini: faqet e Adminit për listën vendase të ushqimeve (pjatat vendase me recetën bazë, ushqimet bazë nga USDA FoodData Central, makrot, porcionet, emrat sq/en), fotot dhe ikonat; të dukshme vetëm për Adminin, nga Cilësimet › Admini në telefon dhe e njëjta faqe në shfletues në kompjuter, plus fotografimi i një pjate nga telefoni me udhëzuesin e drejtimit artistik. Statusi Draft → Gati → Publikuar; publikimi krijon një version të ri të listës (v13 → v14) që app-et e marrin në sinkronizimin e radhës, pa përditësim të app-it; pa internet vazhdojnë me versionin që kanë. Kontrolli i makrove: kaloritë krahasohen me 4·P + 4·K + 9·Y dhe del paralajmërim mbi 10% diferencë. Çdo foto ruan burimin dhe licencën. |
| D1 | Drejtimi vizual: **B · Vrull** (08.11.2026), nga pesë drejtime (Puls, Vrull, Hap, Flaka, Arena) te kanavaca "Training Hub v2 · Drejtimet vizuale". Emri i ri i app-it: **Vrull**; logo me vijën e shpejtësisë. Ngjyrat: prush `#FF5B2E` (veprimi, tekst i errët mbi të), vjollcë `#8B7CFF` (të dhënat), rërë `#E0B48A` (ditë e lodhur), natë `#0B0B0C`, asfalt `#18181B`; Barlow Condensed për titujt dhe numrat, Barlow për tekstin. |

### 0.3 Sistemi i ri vizual

- **D1:** tri drejtime nga referencat e V8, secili me emër, logo, ngjyra, tipografi, forma, sfonde, lëvizje dhe pamjen e gjendjes, në ekranet Sot, seanca, ushqimi dhe trupi 3D. Përdoruesi zgjedh një, ose përzien.
- **D2:** sistemi i dizajnit i drejtimit të zgjedhur: tokenat për tri temat (OLED parazgjedhje), sfondet, variantet e gjendjes, tipografia, komponentët, ikonat, lëvizja (me "lëvizje e reduktuar"), kontrasti WCAG AA, 44 px për çdo prekje, 390 px pa scroll anësor.
- **D3:** çdo ekran i v2 në sistemin e ri, edhe gjendjet bosh, ngarkimi, gabimi dhe pa internet.
- Kalimi në kod bëhet në Etapën 1: `globals.css` dhe `DESIGN.md` i sistemit të ri zëvendësojnë Omal UI v2, dhe rregullat e `CLAUDE.md` dhe roja e dizajnit (`scripts/check-design.mjs`) përditësohen bashkë me to.

### 0.3a Ekranet e D3 (08.11.2026)

Ekranet janë te kanavaca "Training Hub v2 · Vrull", faqja "Vrull · Ekranet", sipas zonave: hyrja, Sot dhe seanca, programi, trupi 3D, Mëso, ushqimi, gjurmimet dhe progresi, miqtë, muzika, ora, cilësimet dhe gjendjet. Të gjitha tregojnë të njëjtën ditë (e diel, 8 nëntor 2026, Faza 1 · Java 2 · Stërvitja 1) me numra që dalin nga rregullat e këtij dokumenti; trupi 3D është renderuar nga app-i me një javë të vërtetë të programit.

Rregullat që lindën nga ekranet. Përdoruesi i miratoi më 08.11.2026, bashkë me ekranet:

- **Uji:** objektivi i ditës = 35 ml për kg peshë + 0,5 L në ditë stërvitjeje + shtesa e motit (24°C: +0,1 L). Shtesa e motit merr formulë me burim në Etapën 3.
- **Ftesa:** kodi i ftesës vlen 7 ditë dhe përdoret një herë.
- **Gatishmëria:** nën 60% ekrani Sot sugjeron seancën më të lehtë (V23); përdoruesi e pranon, e ndryshon ose e injoron.
- **Seanca:** "Ruaj setin" është veprimi kryesor; "Mbyll stërvitjen" mbetet me kontur derisa të ruhen të gjitha setet, pastaj bëhet veprimi kryesor.
- **Pragu i rekordit:** ekrani i setit thotë sa përsëritje me peshën e zgjedhur japin rekord të ri të e1RM-së (p.sh. "12 përsëritje të japin rekord të ri: e1RM 87,5 kg"), kur pragu bie brenda intervalit ose 1–2 përsëritje mbi të. Me peshën e sugjeruar (§7) rekordi kërkon gjithnjë më shumë se kufiri i sipërm, ndaj pragu shfaqet vetëm si informacion. Në kod (V2-E1-04, `recordThreshold` dhe `e1rmRecord` te `src/program/loads.ts`): pragu duhet ta kalojë, jo ta barazojë, e1RM-në më të lartë të çdo seti të mëparshëm të ushtrimit (pa ngrohjet; seti i ri me RIR 0); nuk shfaqet kur bie nën kufirin e poshtëm (atëherë çdo set i intervalit jep rekord), kur do të duheshin më shumë se 15 përsëritje, ose kur ushtrimi s'ka ende e1RM. Rekordi i setit jepet me shtesën kundrejt më të mirit të mëparshëm ("e1RM 87,5 kg, rekord +1,5").
- **Pesha pa e1RM:** një ushtrim që ka histori, por pa e1RM (setet mbi 15 përsëritje, si pulpat në Javët 1–2), merr si sugjerim peshën e fundit të përdorur, me "Herën e kaluar" pranë; nuk bie te "Zgjidh peshën ku mbyll X–Y përsëritje", që vlen vetëm për ushtrimin pa histori. Në kod (V2-E1-04): pesha e setit të punës më të fundit me peshë, edhe te seanca, edhe te "Peshat e javës".
- **Fotot e ushtrimeve** shfaqen bardh e zi, që prushi të mbetet i vetmi theks.
- **Pjatat vendase:** makrot e një pjate llogariten nga përbërësit e recetës bazë (USDA FoodData Central), dhe faqja e pjatës e thotë ("Nga përbërësit e recetës bazë").
- **Temat (D3.1):** Natë dhe Ditë u provuan te Sot, Seanca, Ushqimi dhe Trupi. Rregullat dhe tokenat e rinj (`track`, `model-light`, `volume-1..3`) janë te sistemi i dizajnit, "Rregullat e temave". Modeli 3D ndriçohet nga `model-light`, kurrë nga ngjyra e tekstit: në Ditë ajo është e zezë dhe trupi del i zi.
- **Gjuhët (D3.1):** anglishtja është britanike (Programme, 17:00, 2,900, 62.5). Numri dhe njësia lidhen me hapësirë që nuk thyhet, me `Intl` sipas gjuhës; shumësi dhe numrat rendorë me rregullat e shumësit, kurrë duke ngjitur fjalë. Në një rresht mbeten tab-et, butonat, etiketat e vogla dhe numrat; në dy rreshta lejohen titujt e ekranit dhe të kartave, teksti i kartave dhe detajet e vakteve. Uppercase vjen vetëm nga CSS; çdo faqe ka `lang` e duhur. Ditët e javës kanë emrin e plotë për lexuesin e ekranit. Një provë me pamje në 390 px edhe në anglisht. Termat kryesorë: Sot → Today, Programi → Programme, Ushqimi → Food, Progresi → Progress, Miqtë → Friends, Stërvitja → Workout, Seanca → Session, Gatishmëria → Readiness, Plotëso makrot → Hit your macros, Trupi në ritëm → Body beat. Në kod (V2-E1-02): gjuha ruhet në telefon dhe te `user_settings.language` (sinkronizohet); mijëshet ndahen edhe te numrat me katër shifra (2 900 kcal); datat "e diel, 8 nëntor" dhe "Sunday, 8 November". Chrome dhe WebView nuk e kanë shqipen në `Intl`, ndaj emrat e ditëve dhe muajve dhe rregullat e shumësit të shqipes plotësohen nga app-i sipas CLDR.

- **Korniza (V2-E1-05):** pesë tab-et Sot, Programi, Ushqimi, Progresi, Miqtë; pa tab-bar te seanca, Cilësimet dhe editorët (si te bordet). Trupi i v1 jeton brenda Progresit (`/progresi/trupi`, me "Mbrapa te Progresi"; `/trupi` çon atje). Kreu i pesë ekraneve ka logon 44 px "Profili dhe cilësimet", që hap Cilësimet. Cilësimet tregojnë vetëm atë që punon: Profili, Pamja, Njoftimet, Sinkronizimi, Versioni dhe "Dil"; AI, ora dhe Health Connect, Admini dhe "Pamja ndjek gjendjen" shtohen me etapat e tyre. Sfondi ("I plotë" / "Vija shpejtësie") sinkronizohet te `user_settings.background` (migrimi `20261108150000_user_settings_background.sql`); tema mbetet vetëm në telefon si te v1. Miqtë kanë gjendje bosh deri te Etapa 4; Progresi para setit të parë tregon bordin "Gjendje · Bosh"; pa internet, kreu i ekraneve kryesore ka rripin "Pa internet" me ndryshimet që presin. Të dhënat e v1 (baza lokale e 0.16.0 dhe rreshtat në Supabase) hapen në v2 pa humbje (`src/data/v1-upgrade.test.ts`).
- **Historiku (V2-E1-15):** te Progresi › Historiku (`/progresi/historiku`), seancat e mbyllura sipas javës së programit (xhiro, bllok, javë; e reja e para, "1 nga 4"), me kalendarin e muajit; java e kalendarit nis ditën kur nisi programi. Seanca e kaluar (`/progresi/historiku/:id`) tregon kohëzgjatjen, setet e punës, rekordet, volumin (kryesori 1, ndihmësi 0,5) dhe setet me e1RM-në; ushtrimi me rekordin më të madh hapet si kartë "Rekord i ri" me shtesën kundrejt më të mirit para seancës. Rekordet nuk ruhen: çdo set krahasohet vetëm me setet e ushtrimit para tij (`e1rmRecord`), ndaj "Ndrysho një set" (pesha, përsëritjet, RIR; numri, koha, teknika dhe segmentet mbeten) rillogarit e1RM-në, rekordet dhe peshat e propozuara kudo, edhe te një telefon tjetër pas sinkronizimit; vendimet e ruajtura te `week_weights` nuk ndryshojnë. Titulli i seancës ("Dita e gjoksit") del nga muskuli kryesor i ushtrimit të parë. "Ndaj kartën" vjen me kartat e Etapës 4 (V26). Logjika: `src/progress/history.ts`; leximet dhe ndryshimi: `src/data/history.ts`.

### 0.4 Etapat

| Etapa | Versioni | Përmbajtja |
|---|---|---|
| D | pa version | D1–D3 (§0.3), specifikimi i etapave. |
| 1 | 0.20.0 | Sistemi i ri në gjithë app-in, dy gjuhët, Sot, seanca me setin nga njoftimi, muzika ("Trupi në ritëm", V29), ndërtuesi i programeve me shabllone, progresin e zgjuar dhe PDF-në me AI, videot e formës, trupi 3D me shtresat dhe sipas matjeve. |
| 2 | 0.30.0 | Ushqimi: AI me tekst dhe foto, kufiri mujor, lista vendase me fotot dhe ikonat (V30) dhe faqet e Adminit (V31), të shpeshtat me një prekje, "Plotëso makrot", rikujtuesit e zgjuar me "Si zakonisht". |
| 3 | 0.40.0 | Uji (sipas motit), gjendja dhe gatishmëria me sugjerimet për seancën, zakonet, Health Connect, raporti PDF mujor, "Mëso" (faktet, faqet e ushtrimit dhe të pjatës, kuizi javor). |
| 4 | 0.50.0 | Miqtë: ftesat, lidhja e shkarkimit, profilet, progresi i ndarë, sfidat, programet dhe recetat e ndara, kartat. |
| 5 | 0.60.0 | App-i në Galaxy Watch (Wear OS). |

Në fillim të çdo etape, seksionet përkatëse të këtij dokumenti rishkruhen me detajet dhe kriteret e pranimit, dhe detyrat shkruhen te `docs/TICKETS.md`.

### 0.5 Çfarë ndryshon nga v1

- **§1 dhe §2 (Gjuha, Dizajni):** jo më "një përdorues" dhe "UI në shqip"; V1, V22, V3.
- **§3 (Supabase):** regjistrimet mbeten të mbyllura, por llogaritë e miqve krijohen me kod ftese (Etapa 4); RLS mbetet `user_id = auth.uid()`, plus leje leximi për të dhënat që V5 i bën të dukshme te miqtë.
- **§3b:** miqtë e marrin APK-në e parë nga një lidhje shkarkimi, jo nga GitHub Releases (repo-ja është private). Llogaria "limited distribution" e Google-it (§18) mban deri në 20 pajisje.
- **§11:** shtresat dhe trupi sipas matjeve (V12).
- **§14:** sistemi i ri vizual (§0.3) zëvendëson Omal UI v2 dhe drejtimin "Fokus".
- **§16:** miqtë, ora dhe AI për ushqimin e PDF-të hyjnë në plan; mbeten jashtë Play Store, iOS dhe trajneri AI me bisedë.

## 1. Qëllimi

Një aplikacion personal për Android që e çon përdoruesin, fillestar në palestër, nëpër Shortcut to Size dhe programe të tjera që shkruan vetë, dhe mban gjithçka që lidhet me progresin: stërvitjet, peshat, matjet e trupit, ushqimin dhe suplementet. Një përdorues, falas, funksionon pa internet.

## 2. Vendimet

| # | Vendimi |
|---|---|
| Platforma | App Android i paketuar si APK me Capacitor, i instaluar jashtë Play Store. Kod web: React + Vite + TypeScript. |
| Të dhënat | Lokale-së-pari (IndexedDB në telefon), sinkronizim me Supabase (projekti `training-hub`, Frankfurt). |
| Q1 | Supabase në llogarinë e re të përdoruesit, projekti me ref `hxwkyhfqcadtipkpopnq`. |
| Q2, Q5 | Editor i plotë programesh që në versionin e parë. |
| Q3 | Stërvitjet ndjekin radhën, jo kalendarin. Një ditë e humbur nuk kapërcen asnjë stërvitje. |
| Q4 | "Java 0" para Fazës 1: teknikë dhe gjetja e peshave. Programi bëhet 13 javë. |
| Q6, Q9 | Programet përshkruhen me rregulla. Llojet: shkallë përsëritjesh sipas javës, teknikë sipas javës, ushtrim sipas fazës ose jave, shtesë peshe sipas fazës, %1RM, progresion çdo seancë, RPE/RIR. |
| Q7, Q10 | Ditar i plotë ushqimi me kërkim dhe barkod, plus ushqime dhe receta të përdoruesit. |
| Q8 | Videon e YouTube për çdo ushtrim e shton përdoruesi (link). |
| Q11 | Timer-i i pushimit njofton me zë dhe dridhje edhe me ekran të kyçur (njoftim lokal native). |
| Q12, Q14 | Model 3D i trupit, i rrotullueshëm, me katër funksione: muskujt e ushtrimit, harta javore, prek muskulin, gjendja e rikuperimit. |
| Q13 | 1RM vlerësohet automatikisht nga setet, me mundësi ndryshimi me dorë. Prej saj del pesha e sugjeruar. |
| Q15 | Objektivat e ushqimit dalin nga formula e Jimit, veçmas për ditë pushimi dhe stërvitjeje, dhe ndjekin peshën. Ndryshohen me dorë. |
| Q16 | Palestra nis pas 3 javësh ose më vonë. Gjithçka synohet gati atë ditë. |
| Q17 | Rikujtues për suplementet dhe vaktet, ditët e stërvitjes dhe matjet javore. |
| Q18 | Plani i vakteve të Jimit është shabllon që regjistrohet me një prekje. |
| Dizajni | Drejtimi "Fokus" në të gjitha ekranet, i zgjedhur më 07.11.2026 nga tri drejtime (Tabela, Karta, Fokus). Tema OLED parazgjedhje. Ekranet ndërtohen direkt në kod sipas radhës së navigimit dhe shqyrtohen në telefon (§14, §17). |
| Njësitë | kg, cm. Ditët e stërvitjes: e hënë, e martë, e enjte, e premte (ndryshohen te cilësimet). |
| Gjuha | UI në shqip. Emrat e ushtrimeve mbeten në anglisht, si në PDF dhe në bibliotekë. |

## 3. Platforma dhe arkitektura

- **Klienti:** React + Vite + TypeScript, Tailwind v4 me tokenat e Omal UI v2 (`globals.css` i sistemit të dizajnit), komponentë shadcn.
- **Paketimi:** Capacitor Android. Plugin-et: njoftime lokale, dridhje (haptics), skaner barkodi, kamera për fotot. Lejet e Android-it: gjendja e rrjetit (`ACCESS_NETWORK_STATE`, e dhënë vetë, që app-i ta dijë kur kthehet interneti), njoftimet (`POST_NOTIFICATIONS`, kërkohet në stërvitjen e parë) dhe alarmet e sakta (`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`), pa të cilat Android mund ta vonojë njoftimin e timer-it me ekran të kyçur. APK-ja ndërtohet nga GitHub Actions dhe publikohet si GitHub Release, vetë, sa herë që në `main` vjen një version i ri te `package.json` (vendim i 07.11.2026); përditësimi është instalim i APK-së së re mbi të vjetrën, me të njëjtin çelës nënshkrimi (ruhet si secret në repo; workflow-i kontrollon gjurmën SHA-256 të certifikatës). `appId` është `al.traininghub.app` dhe nuk ndryshon më. Versioni vjen nga `package.json`; Android merr `versionCode = major × 10000 + minor × 100 + patch`. Ekrani shkon nga cepi në cep (SystemBars i Capacitor-it, `insetsHandling: native`) dhe ikonat e shiritave të sistemit ndjekin temën. Butoni mbrapa i Android-it kthen te faqja e mëparshme; në fillim të historisë e çon app-in në sfond pa e mbyllur, që një stërvitje e hapur të mos humbasë (`@capacitor/app`). Hapat për telefonin: `docs/INSTALL.md`.
- **Ruajtja lokale:** Dexie (IndexedDB). Çdo veprim shkruan fillimisht lokalisht; asnjë ekran nuk pret rrjetin.
- **Sinkronizimi:** çdo rresht ka `id` (UUID i krijuar në telefon), `updated_at`, `deleted_at`. Dërgohen rreshtat e ndryshuar, me radhën e lidhjeve (prindi para fëmijës); merren ato me `server_updated_at` pas kursorit të secilës tabelë, në faqe keyset (`server_updated_at`, `id`), paralelisht, me kursorin 60 s më herët për siguri. Konfliktet: fiton ndryshimi me `updated_at` më të ri. Një rresht që serveri e refuzon (p.sh. shkel një kontroll) veçohet dhe nuk bllokon të tjerët; mbetet në telefon dhe provohet përsëri. Kur sinkronizohet: në nisje, kur kthehet rrjeti, kur app-i vjen në plan të parë, 2 s pas shkrimit të fundit dhe çdo 5 minuta. Cilësimet tregojnë gjendjen me fjalë, sa ndryshime presin, "Sinkronizo tani" dhe "Eksporto të dhënat". Kodi: `src/data/`.
- **Supabase:** Postgres me RLS (`user_id = auth.uid()` në çdo tabelë), Auth me email dhe fjalëkalim (hyrja e parë kërkon internet, pastaj sesioni ruhet dhe app-i punon pa rrjet), Storage me bucket privat për fotot (rrugët `<user_id>/...`, RLS te `storage.objects`), Edge Function si ndërmjetës për USDA FoodData Central (çelësi si secret). Llogaria e vetme krijohet një herë nga paneli i Supabase (Authentication → Users → Add user) dhe regjistrimet e reja janë të çaktivizuara që në fillim, që askush tjetër të mos hapë llogari në projekt; app-i ka vetëm hyrjen.
- **3D:** three.js direkt, pa `@react-three/fiber`: një shikues i vetëm (`components/body/body-model.tsx`) që ngarkohet me `lazy` vetëm kur zgjidhet modeli 3D (vendim i 07.11.2026). Modeli është një GLB i gjeneruar nga një skript i përsëritshëm në `tools/anatomy/` (shih §11).
- **Varësitë:** çdo paketë e re verifikohet para instalimit (autenticiteti, mirëmbajtja, licenca).

## 3a. Hyrja e parë

1. Hyrja me email dhe fjalëkalim (llogaria krijohet te paneli i Supabase; hyrja kërkon internet vetëm këtë herë).
2. Pesha e trupit sot (kg), e nevojshme për objektivat e ushqimit.
3. Ditët e stërvitjes (parazgjedhje: e hënë, e martë, e enjte, e premte) dhe ora e zakonshme e stërvitjes.
4. Ora e zgjimit dhe e gjumit, për rikujtuesit.
5. Programi aktiv: Shortcut to Size, duke nisur nga Java 0.

Çdo hap ndryshohet më vonë te cilësimet (Profili: pesha e sotme, ditët, ora e stërvitjes, zgjimi, gjumi; Llogaria: dalja). Lejet e njoftimeve kërkohen në stërvitjen e parë, kur nevojiten, jo këtu.

Pas hyrjes, para hapave, app-i merr të dhënat ekzistuese nga Supabase ("Po merren të dhënat e tua"; pa internet: "Provo përsëri"), që një instalim i ri të mos i përsërisë hapat dhe të mos krijojë një profil të dytë. Me profilin të plotësuar në telefon, app-i hapet direkt te Sot edhe pa internet. Hapi 5 krijon skeletin e Shortcut to Size (Java 0 dhe Fazat 1–3, me 4 ditët) dhe treguesin te Java 0 · Stërvitja 1; ushtrimet i shton TH-07. Dalja nga llogaria bëhet vetëm në telefon dhe nuk fshin të dhënat lokale. Porta e rrugëve: `src/routes/gate.tsx`, faza: `src/data/phase.ts`.

## 3b. Përditësimi brenda app-it (vendim i 07.11.2026)

- **Rruga:** APK-ja jashtë Play Store, e përditësuar nga vetë app-i. Google Play (testim i brendshëm) u la mënjanë: kushton 25 $, kërkon verifikim identiteti dhe formularët e Play Console, për një app me një përdorues.
- **Publikimi:** pas Release-it në GitHub, workflow-i "APK për Android" ngarkon `TrainingHub-X.Y.Z.apk` dhe `latest.json` (versioni, APK-ja, SHA-256, madhësia, "Çfarë ka të re" nga titujt e commit-eve, data) te bucket-i privat `app-releases` i Supabase-it, me secret-in `SUPABASE_SECRET_KEY` (`scripts/publish-update.mjs`). Mbahen dy APK-të e fundit. App-i lexon vetëm (`select` për `authenticated`; regjistrimet janë të mbyllura).
- **Kontrolli:** kur hapet app-i, kur kthehet në plan të parë dhe kur kthehet interneti, të shumtën një herë në 6 orë (vlera e fundit mbahet në telefon); "Kontrollo tani" te Cilësimet nuk pret, dhe pa internet e thotë. Gabimi i kontrollit automatik nuk shfaqet; versioni i gjetur më parë mbetet dhe kontrolli provohet sërish pas 30 minutash. "Përditëso" lexon përsëri `latest.json` para shkarkimit, që një version i hequr nga bucket-i (pas dy versioneve të reja) ose i tërhequr të mos shkarkohet. `latest.json` pranohet vetëm kur APK-ja i përket versionit dhe SHA-256 ka 64 shifra hex (`src/update/updater.ts`).
- **Ekrani:** te Sot, një rresht i qetë (jo amber) "Versioni X.Y.Z është gati" kur ka version të ri; te Cilësimet, "Versioni" me gjendjen. Të dy hapin fletën me "Çfarë ka të re", madhësinë dhe "Përditëso"; shkarkimi ka shirit përparimi, dhe çdo dështim (kontrolli, shkarkimi, skedari që nuk përputhet, instalimi) thuhet me fjalë me "Provo përsëri".
- **Instalimi** (plugin-i `AppUpdater`): shkarkim me lidhje të firmosur 10-minutëshe, SHA-256 i verifikuar gjatë shkarkimit dhe përsëri para instalimit, `PackageInstaller` me `USER_ACTION_NOT_REQUIRED`. Herën e parë Android-i kërkon lejen "Instalo app të panjohura"; pas saj, në Android 12+ app-i e përditëson veten pa dritare konfirmimi (`REQUEST_INSTALL_PACKAGES` + `UPDATE_PACKAGES_WITHOUT_USER_ACTION`). Kur sistemi hap dritaren e konfirmimit ose ajo anulohet, fleta kthehet te "Përditëso" (një dritare e lënë pa përgjigje nuk e bllokon). Një instalim që nuk nis e mbyll seancën e PackageInstaller-it. Pas përditësimit, njoftimi "Training Hub u përditësua" e hap app-in dhe APK-ja e shkarkuar fshihet.
- **Kufiri:** një ndryshim në pjesën native (plugin i ri, manifest) vjen njësoj, sepse përditësohet e gjithë APK-ja. Versioni 0.15.0, që sjell përditësuesin, instalohet me dorë një herë.

## 4. Modeli i programit

Një program përbëhet nga:

- **Blloqe** (faza), secili me një numër javësh. Shortcut to Size: Java 0 (1 javë) + Faza 1, 2, 3 (nga 4 javë).
- **Ditë stërvitjeje** të përsëritura çdo javë (Shortcut to Size: 4).
- **Slote** në çdo ditë, me radhë. Një slot ka:
  - **ushtrimin**, që mund të jetë fiks, i ndryshëm sipas bllokut ose sipas javës brenda ciklit;
  - **numrin e seteve**;
  - **recetën**, njërën nga këto:
    - `rep_ladder`: interval përsëritjesh sipas indeksit të javës në cikël (p.sh. 12–15, 9–11, 6–8, 3–5), me opsionin "deri në dështim nëse mund më shumë";
    - `timed`: sekonda sipas javës dhe bllokut (plank);
    - `percent_1rm`: përqindje dhe përsëritje sipas javës (5/3/1), me opsion seti AMRAP;
    - `linear`: pesha fillestare, shtesa kur mbyllen të gjitha përsëritjet, ulja pas N dështimesh radhazi;
    - `rpe` ose `rir`: përsëritje + vlerësim i synuar;
  - **teknikën** sipas javës: asnjë, `rest_pause` (pushim 15 s), `drop_set` (pesha e drop-it = pesha e javës 1 të bllokut për këtë ushtrim, ose përqindje), `to_failure`;
  - **pushimin** mes seteve në sekonda (parazgjedhje 90 s; 60 s për barkun dhe pulpat).
- **Progresioni ndërmjet blloqeve:** shtesë peshe kundrejt së njëjtës javë të bllokut të kaluar (Shortcut to Size: +2,5–9 kg).
- **Rregulli i progresit (V9, V2-E1-04):** për programet e përdoruesit, një rregull i slotit me pragun e RIR-së dhe shtesën e peshës (p.sh. "kur çdo set arrin kufirin e sipërm me RIR ≥ 2, shto 2,5 kg"), i ruajtur si receta dhe teknika te `slot_prescriptions.progression` dhe i vendosur në çdo nivel të editorit (fiton niveli më i saktë). Kur çdo set pune i seancës së fundit të ushtrimit arrin kufirin e sipërm të intervalit të javës së kaluar (edhe në bllokun e mëparshëm) me RIR të paktën sa pragu (RIR i paregjistruar = 0), pesha propozohet sa më e rënda e asaj seance plus shtesa; përndryshe mbetet ajo peshë. Te java e parë e programit ose pa histori vlen §7. Rregulli jep vetëm propozimin e "Peshave të javës" (§7); Shortcut to Size nuk ka rregull dhe nuk ndryshon.

Editori lejon krijimin, kopjimin dhe ndryshimin e çdo pjese: kopjo javën, kopjo bllokun, ndrysho ushtrimin e një sloti vetëm për një bllok. Zëvendësimi i një ushtrimi kur mungon pajisja bëhet këtu.

**Editori (vendim i 07.11.2026, varianti A):**

- Programi › Programet (lista, program i ri, programi aktiv) dhe Programi › Ndrysho programin (blloqet, ditët, kopjo, fshi). Dita ka ushtrimet me radhë; një ushtrim ka ekranin e vet.
- Te ushtrimi zgjidhet niveli ku vlen ndryshimi: i gjithë programi, një bllok, java N e çdo blloku, ose java N e një blloku. Çdo vlerë tregon nga cili nivel vjen; fiton niveli më i saktë (blloku dhe java > blloku > java > programi). Poshtë, plani javë pas jave tregon rezultatin. "Hiq ndryshimin" e kthen vlerën te niveli më i gjerë.
- Për gjithë programin, ushtrimi, setet dhe pushimi ruhen te vetë ushtrimi i ditës; receta, teknika dhe çdo nivel tjetër ruhen si rregulla.
- "Kopjo javën" zëvendëson rregullat e javës së synuar me ato të javës burim. "Kopjo bllokun" e vendos kopjen menjëherë pas burimit, me rregullat e tij.
- Ushtrimi i ri nga biblioteka: 3 sete, pushim 90 s (60 s për barkun dhe pulpat), pa recetë. Një ushtrim me të njëjtin emër ripërdoret, që historia të mbetet bashkë.
- Programi ka të paktën një bllok dhe një ditë; programi aktiv nuk fshihet. Kur blloku shkurtohet, treguesi kalon te java e tij e fundit; kur hiqet blloku ose dita e treguesit, ai kalon te java 1 e bllokut të parë.

**Radha:** app-i mban një tregues "stërvitja e radhës" (blloku, java, dita). Treguesi kalon përpara vetëm kur një stërvitje mbyllet. Te menyja ka "Kapërce këtë stërvitje" për raste të veçanta; nuk ndodh vetvetiu.

**Programi aktiv:** vetëm një program është aktiv. Ndërrimi i tij ruan historinë dhe treguesin e secilit program. Ndryshimet në editor për programin aktiv vlejnë nga stërvitja e radhës; seancat e kaluara nuk ndryshojnë. Pas stërvitjes së fundit programi shënohet "Përfunduar" dhe ekrani Sot ofron ta rinisë nga Faza 1 (me peshat e sugjeruara nga 1RM-të e reja) ose të zgjedhë një program tjetër.

## 5. Shortcut to Size si të dhëna

Programi futet si program i parë, i gatshëm, sipas Shtojcës A. Rregullat:

- **Shkallët e përsëritjeve** (java 1 → 4 e çdo faze):
  - ushtrimet kryesore dhe ndihmëse: 12–15, 9–11, 6–8, 3–5;
  - pulpat: 25–30, 15–20, 10–14, 6–9;
  - barku: 20–30 (vazhdo deri në dështim nëse mundesh më shumë), 15–19, 10–14, 6–9.
- **Setet:** 4 sete për Bench Press, Dumbbell Bent-Over Row, Barbell Curl, Dumbbell Shoulder Press, shrug-et, Squat, Romanian Deadlift dhe pulpat. 3 sete për të gjitha të tjerat, përfshirë Triceps Pressdown dhe barkun.
- **Teknika:** javët 1–2 rest-pause në setin e fundit të çdo ushtrimi (deri në dështim, 15 s pushim, vazhdo deri në dështim). Javët 3–4 drop set në setin e fundit (deri në dështim, ul te pesha e javës 1 të fazës për atë ushtrim, vazhdo deri në dështim). Teknika vlen edhe për pulpat dhe barkun, por jo për ushtrimet me kohë (Plank, Side Plank). Nëse në një javë drop set-i ushtrimi bëhet pa peshë, zbatohet rest-pause. Për ushtrimet me llastik, drop set-i bëhet me llastikun më të lehtë.
- **Pesha mbetet e njëjtë** në të gjitha setet e një ushtrimi brenda seancës. Minimumi i intervalit duhet arritur.
- **Ushtrimi i parë i çdo grupi** (Bench Press, Triceps Pressdown, Dumbbell Bent-Over Row, Barbell Curl, Dumbbell Shoulder Press, Squat, Romanian Deadlift) mbetet i njëjtë për 12 javët. Ndihmësit ndryshojnë sipas fazës. Ushtrimet e barkut ndryshojnë sipas javës (Shtojca B).
- **Java 0:** stërvitjet e Fazës 1, Java 1, me intervalet e Javës 1 (12–15; pulpat 25–30; barku 20–30; plank-u 60 s), pa rest-pause dhe pa dështim (lër 2–3 përsëritje në rezervë, RIR 2–3). Setet: 3 për ushtrimet që në program kanë 4, 2 për të tjerat. Qëllimi: teknika dhe gjetja e peshës për 12–15. Peshat e Javës 0, me RIR-në e regjistruar, ushqejnë sugjerimet e Javës 1.
- **Hip Thrust i barkut:** Hip Thrust, Weighted Hip Thrust dhe Smith Machine Hip Thrust te barku janë ngritje e legenit e shtrirë në shpinë me këmbët lart, për pjesën e poshtme të barkut (te versioni Smith, këmbët shtyjnë shufrën lart). Nuk janë hip thrust-i i gluteve me shufër mbi kofshë. Lidhen me `rectus_abdominis`, jo me gluteus.
- **Emrat e njëjtë:** "Straight Arm Pulldown" dhe "Straight-Arm Pulldown" janë i njëjti ushtrim; po ashtu "Incline Cable Cable Flye" e PDF-së është "Incline Cable Flye". Historia e një ushtrimi mbetet e përbashkët në të gjitha fazat ku shfaqet.

## 6. Regjistrimi i stërvitjes

- Ekrani i seancës tregon slotet me radhë, recetën e javës, peshën e sugjeruar dhe referencën e fazës së kaluar.
- Për çdo set: pesha, përsëritjet (ose sekondat), RPE/RIR kur receta e kërkon, shënim. Te dumbbell-at regjistrohet pesha e një dumbbell-i; te ushtrimet me peshën e trupit, pesha shtesë (0 kur s'ka). Seti i fundit me rest-pause ose drop set ka segmente (pesha dhe përsëritjet e secilit).
- Pas çdo seti nis timer-i i pushimit. Kur mbaron, vjen njoftim me zë dhe dridhje edhe me ekran të kyçur. Gjatë rest-pause, timer-i është 15 s.
- Rekordet personale (peshë më e madhe për një numër përsëritjesh, e1RM më e lartë) shënohen në moment.
- Seanca mund të ndërpritet dhe të vazhdohet; mbyllja e saj e çon treguesin përpara.
- Nëse mungon pajisja, nga seanca hapet direkt "Ndrysho ushtrimin për këtë fazë" (e njëjta logjikë si në editor), pa dalë nga stërvitja.

## 7. 1RM dhe pesha e sugjeruar

- **e1RM** me formulën Epley: `pesha × (1 + (përsëritjet + RIR) / 30)`, ku RIR = 0 kur nuk është regjistruar. Vetëm nga setet e drejta me 1–15 përsëritje (jo segmentet e rest-pause ose drop set-it, jo ushtrimet pa peshë ose me kohë).
- **1RM aktuale** e një ushtrimi: më e larta nga 28 ditët e fundit; nëse s'ka asnjë në 28 ditë, e fundit e njohur. Përdoruesi mund ta vendosë me dorë; vlera e tij vlen derisa një seancë e re të japë më shumë.
- **Pesha e sugjeruar** për një interval përsëritjesh: `1RM / (1 + kufiri i sipërm / 30)`, e rrumbullakosur poshtë sipas pajisjes (shufër 2,5 kg; dumbbell 2 kg; kabëll dhe makineri 5 kg; ndryshohen te cilësimet).
- **Referenca e fazës së kaluar:** pesha dhe përsëritjet e së njëjtës javë në fazën e mëparshme, plus intervali +2,5–9 kg nga programi.
- Për `percent_1rm`, pesha llogaritet nga 1RM aktuale. Ushtrim pa histori: pa sugjerim, me tekstin "Zgjidh peshën ku mbyll X–Y përsëritje".
- **Peshat e javës (V23, V2-E1-04):** për javën që shqyrtohet (e treguesit kur ai është te dita e parë, sepse java e kaluar u mbyll; përndryshe java pas saj), çdo slot me peshë merr propozimin me llogarinë që e jep (p.sh. "86,0 / (1 + 11/30) = 62,9 → 62,5 kg", ose pesha e fundit, ose rregulli i progresit), "Herën e kaluar" dhe vendimin. "Prano të gjitha" i bën propozimet peshë të javës; "Më vonë" mban peshën e fundit të përdorur; një peshë e ndryshuar me dorë mbetet edhe pas tyre. Vendimet ruhen te `week_weights` për xhiron, bllokun, javën dhe slotin, dhe vlejnë vetëm për ushtrimin për të cilin u morën. Pa vendim vlen propozimi, si te v1. Logjika: `src/progress/week-weights.ts`; ruajtja: `src/data/week-weights.ts`.

## 8. Matjet dhe grafikët

- **Matjet:** pesha e trupit (çdo ditë, opsionale), % e yndyrës (me dorë), perimetrat në cm: qafa, shpatullat, gjoksi, beli, vithet, krahu (M/D), parakrahu (M/D), kofsha (M/D), pulpa (M/D).
- **Fotot e progresit:** para, anash, mbrapa. Kompresohen në telefon dhe ruhen në bucket privat të Supabase.
- **Grafikët:** e1RM për çdo ushtrim, volumi javor për muskul (sete), pesha e trupit me mesatare 7-ditore, perimetrat, përputhja me objektivat e ushqimit.
- **Ekrani (vendim i 07.11.2026, varianti A):** paneli i peshës me mesataren 7-ditore (një shifër pas presjes), ndryshimin në 4 javë dhe grafikun e 8 javëve (vija e mesatares, pikat e ditës); "Shto matjen" është veprimi kryesor. Poshtë, çdo matje me vlerën e fundit dhe ndryshimin; secila hap grafikun dhe historinë (lista është tabela e grafikut). Grafikët mbi panel përdorin --chart-1; mbi kartë ngjyrën e tekstit, sepse amber-i mbi sfondin e çelët ka kontrast 2:1.
- **Shto matjen (V2-E1-14, bordi "Trupi · Shto matjen"):** "Shto matjen" te Progresi dhe "Shto matjen e sotme" te Trupi sipas matjeve hapin `/progresi/matja`: data (sot, ose një ditë tjetër me zgjedhësin e telefonit), pesha e trupit me ±0,1 kg ("Dje 80,0 kg", "Si dje · mesatarja 7-ditore 79,8 kg") dhe krahu, gjoksi, beli, kofsha me ±0,1 cm; "Më shumë matje" hap qafën, shpatullat, vithet, parakrahun, pulpën, anën tjetër dhe % e yndyrës. Një matje e re mbushet me vlerat e fundit ("Të mbushura nga 1 nëntor") dhe ruhet ajo që shihet: fushat e dukshme me vlerë, ato të "Më shumë" vetëm kur seksioni është hapur. Një datë që ka matje (nga historia, `?data=`) mban vlerat e saj dhe një fushë e zbrazur e fshin vlerën. Ruajtja me `saveMeasurement`, një rresht për datë.
- **Forca, volumi, ushqimi (vendim i 07.11.2026):** te Progresi, "Forca · e1RM" (8 ushtrimet e fundit, me ndryshimin në 4 javë; çdo rresht hap ushtrimin me grafikun e e1RM-së), "Volumi javor" (setet e punës sipas grupit kryesor të muskujve, kjo javë dhe e kaluara) dhe "Ushqimi · 7 ditët e fundit" (kcal kundrejt objektivit të ruajtur të çdo dite, me vijën e objektivit).
- **Fotot (vendim i 07.11.2026):** te Progresi, tri pozat me foton e fundit të secilës; një pozë bosh hap kamerën (ose galerinë), një foto hapet në fletë me "Bëj foto të re sot" dhe "Fshi foton"; "Të gjitha" tregon fotot sipas datës. Foto kompresohet në telefon (ana më e gjatë 1600 px, JPEG), ruhet në telefon dhe ngarkohet te `progress-photos/<user_id>/<id>.jpg` kur ka internet (kur hapet app-i, kur kthehet interneti, kur shtohet një foto). Në një telefon tjetër shkarkohet një herë dhe ruhet. Një foto e re e së njëjtës ditë dhe pozë zëvendëson të mëparshmen.
- **Eksporti:** te cilësimet, "Eksporto të dhënat" nxjerr një skedar JSON me gjithçka (pa fotot). Plani falas i Supabase nuk ka backup automatik ditor, ndaj ky është rrjeti i sigurisë.

## 9. Ushqimi

- **Objektivat** (Q15): nga totalet e ditës shembull të Jimit (180 lb = 81,65 kg), të shkallëzuara sipas peshës, duke përdorur mesataren 7-ditore të peshës së trupit (ose peshën e fundit kur ka më pak se 3 matje). Shih Shtojcën C. Dita llogaritet "stërvitje" nëse është ditë stërvitjeje te cilësimet ose nëse u regjistrua stërvitje atë ditë; përdoruesi e ndryshon me një prekje.
- **Ditari:** vaktet sipas planit (Mëngjesi 1, Mëngjesi 2, Snack paradite, Dreka, Snack pasdite, Darka, Para gjumit, plus Para/Gjatë/Pas stërvitjes në ditë stërvitjeje). Çdo regjistrim: ushqimi, gramët, vakti, data.
- **Burimet e ushqimeve:**
  - Open Food Facts për produktet me barkod (skaner në kamerë), me User-Agent `TrainingHub/<versioni>` pa të dhëna personale;
  - USDA FoodData Central për ushqimet e përgjithshme, përmes Edge Function që pranon vetëm kërkesa me sesion të vlefshëm;
  - ushqimet e përdoruesit (makro për 100 g) dhe gatimet (përbërës me gramë, peshë totale, porcione), të ruajtura për ripërdorim. "Receta" mbetet fjala e slotit të stërvitjes (GLOSSARY.md).
- **Shablloni i Jimit** (Q18): çdo vakt i planit regjistrohet me një prekje dhe pastaj ndryshohet. Listat e zëvendësimeve të PDF-së (mishrat, bulmetrat, drithërat, perimet, frutat, karbohidratet pas stërvitjes) shfaqen si alternativa për artikullin përkatës.
- **Ekrani (vendim i 07.11.2026, sipas mockup-it C · Ushqimi):** shiriti i kcal sipër me llojin e ditës (një prekje e ndërron); paneli "Vakti i radhës" me artikujt e Jimit dhe "Regjistro <vaktin>"; dita si orar; makrot kundrejt objektivave. I radhës është vakti i parë pa regjistrim që nuk ka kaluar më shumë se 1 orë; ato që kanë kaluar dalin "Pa regjistruar".
- **Orari:** mëngjesi 1 në zgjim, mëngjesi 2 +45 min, snack-u i paraditës +3:30, dreka +6:00, snack-u i pasdites +8:30, darka +11:30, vakti para gjumit 30 min para gjumit. Në ditë stërvitjeje: vakti para 15 min para fillimit, ai pas 90 min pas fillimit; vakti që bie nga 30 min para vaktit para stërvitjes deri 30 min pas vaktit pas saj vjen 1 orë pas vaktit pas stërvitjes, dhe vaktet pas tij zhvendosen bashkë me të (asnjë pas vaktit para gjumit).
- **Makrot e shabllonit:** USDA FoodData Central (SR Legacy) për 100 g; Clif Bar dhe karamelet gummy nga etiketa. Salmoni merret i egër (142 kcal/100 g): me të dita bazë del rreth 3110 kcal, 267 g P, 108 g Y, sa totalet e PDF-së.
- **Shto ushqim (vendim i 07.11.2026, varianti A):** te fleta e një vakti, "Shto ushqim" hap një faqe me kërkimin dhe butonin e barkodit. Pa kërkim dalin ushqimet e përdorura së fundi (edhe pa internet); me kërkim, ushqimet e tua (pa dallim ë/ç) dhe pastaj Open Food Facts (nga 3 shkronja). Ushqimi hapet në fletën e sasisë: gramët (parazgjedhje porcioni ose 100 g), makrot dhe "Shto te <vakti>". Ushqimi i ri ka kcal dhe makrot për 100 g dhe porcionin opsional. Barkodi: "Skano me kamerë" hap skanerin e Google Play Services (`@capacitor-mlkit/barcode-scanning`, `scan()`, pa leje kamere; herën e parë moduli mund të jetë duke u shkarkuar), ose shkruhen shifrat me dorë. WebView-i shton `TrainingHub/<versioni>` te User-Agent-i. USDA: funksioni `usda-search` (Supabase, `verify_jwt` aktiv, kod në `supabase/functions/`) kërkon te Foundation dhe SR Legacy dhe kthen vetëm energjinë dhe makrot; çelësi `USDA_API_KEY` si secret i funksionit, pa të DEMO_KEY (rreth 30 kërkime në orë). Rezultatet e USDA dalin pas Open Food Facts, me emrin origjinal në anglisht.
- **Objektivat e ruajtura:** me regjistrimin e parë të ditës ose me ndryshimin e llojit të ditës, objektivat dhe pesha ruhen për atë datë dhe nuk ndryshojnë kur ndryshon pesha më vonë.
- **Shënim në ekranin e objektivave:** proteina e Jimit është rreth 3,3–4,1 g/kg; studimet tregojnë se fitimi në muskul nuk rritet ndjeshëm mbi rreth 1,6–2,2 g/kg.

## 10. Suplementet

Lista e planit, me orarin dhe dozën, regjistrohet si checklist ditore:

| Suplementi | Kur | Doza (PDF) | Evidenca |
|---|---|---|---|
| Protein powder | Mëngjesi 1, Snack pasdite, Para gjumit, shake-u i stërvitjes | 1–2 scoop | Ushqim; e mirë kur mbush objektivin |
| Creatine | Shake-u para/gjatë dhe pas stërvitjes | 1,5–5 g | E fortë |
| Beta-alanine | Shake-u para/gjatë dhe pas stërvitjes | 1,5–3 g | Mesatare |
| Betaine | Shake-u para/gjatë dhe pas stërvitjes | 1,5–2 g | E kufizuar |
| BCAAs | Shake-u para/gjatë dhe pas stërvitjes | 5 g | E dobët kur proteina është e lartë |
| Carnitine | Pas stërvitjes | 1–2 g | E dobët |
| Glutamine | Pas stërvitjes | 3–5 g | E dobët për muskulin |
| Dextrose ose gummy bears | Pas stërvitjes | 20–30 g / 30 copë | Ushqim (karbohidrat i shpejtë) |
| Multivitamin | Dreka | 1 dozë | Vetëm për mungesa |
| ZMA | Para gjumit | 1 dozë | E dobët pa mungesë |

Kolona e evidencës shfaqet si etiketë me fjalë. Përdoruesi mund të çaktivizojë çdo suplement.

**Ekrani (vendim i 07.11.2026):** te Ushqimi, nën çdo vakt të orarit dalin suplementet e tij ("me multivitaminë"); seksioni "Suplementet · 1 nga 5" ka checklist-ën e ditës sipas vakteve, me dozën dhe evidencën si etiketë; "Ndrysho listën" i aktivizon ose i çaktivizon. Shake-u para/gjatë/pas stërvitjes ndahet te vakti para dhe ai pas stërvitjes. Lista e §10 shtohet një herë për përdoruesin.

## 11. Modeli 3D i trupit

- **Burimi (verifikuar 07.11.2026):** BodyParts3D, Database Center for Life Science.
  - Versioni 4.0, CC BY 4.0, OBJ me 99% më pak poligone, një skedar për çdo element me emër dhe FMA ID. Mbulon muskujt kryesorë (pectoralis major, tri pjesët e deltoid, biceps, triceps, trapezius, rhomboid, teres major, infraspinatus, serratus, external oblique, glutes, quadriceps, hamstrings, adductors, gastrocnemius, soleus, tibialis anterior, erector spinae).
  - Latissimus dorsi dhe rectus abdominis mungojnë te 4.0. Merren nga versioni 3.0 (OBJ 99%, CC BY-SA 2.1 Japan) nga arkivi zyrtar (`dbarchive.biosciencedbc.jp/data/bodyparts3d/20110915/`) dhe thjeshtohen.
  - **Pozicioni (verifikuar 07.11.2026):** 3.0 dhe 4.0 kanë të njëjtin sistem koordinatash, por trungu te 4.0 është rimodeluar rreth 16 mm më poshtë. Çdo pjesë nga 3.0 zhvendoset me mesataren e diferencës 4.0 − 3.0 të fqinjëve të saj që ekzistojnë te të dyja (lats: teres major, external oblique, serratus anterior, infraspinatus; rectus: external oblique), veçmas për secilën anë.
  - **Barku:** te të dy versionet external oblique përfshin aponeurozën që mbulon rectus abdominis nga përpara, ndaj rectus nuk dukej. Pipeline-i heq trekëndëshat e external oblique që bien përpara rectus, brenda gjerësisë së tij në çdo lartësi (`_cuts` te `parts.json`).
  - **Licenca e GLB-së:** CC BY-SA 2.1 Japan, sepse përmban pjesë nga 3.0 (`public/anatomy/LICENSE.txt`).
- **Pipeline-i** (`tools/anatomy/build.mjs` me `parts.json`, i përsëritshëm): zgjidh elementet sipas tabelës së muskujve (Shtojca D) → bashko majtas/djathtas sipas çelësit → bashko kulmet e dyfishta → zhvendos pjesët e 3.0 → hiq aponeurozën mbi rectus → thjeshto (meshoptimizer, deri në 5 000 trekëndësha për çelës, 12 000 për lëkurën) → GLB me një nyje me emër për çdo çelës dhe lëkurën si siluetë. Normalet llogariten te shikuesi. Objektivi: ≤ 5 MB, rrotullim i rrjedhshëm në një telefon Android mesatar. Një pjesë, fqinj ose lëkurë që mungon e ndal build-in. **Rezultati (07.11.2026):** 34 çelësa, 83 mijë kulme, 165 mijë trekëndësha, asnjë muskul mbi 5 000; 1,92 MB pa kompresim. Bashkimi i kulmeve është kusht që kufiri të vlejë: pa të, skajet e hapura e mbanin latissimus dorsi rreth 7 000 trekëndësha edhe me kufi 1 000.
- **Funksionet** (Q14):
  1. **Muskujt e ushtrimit:** te çdo ushtrim, muskujt kryesorë dhe ndihmës theksohen me dy nivele.
  2. **Harta javore:** çdo muskul ngjyroset sipas seteve të javës (kryesor = 1, ndihmës = 0,5), me legjendë.
  3. **Prek muskulin:** emri në shqip dhe latinisht, funksioni me një fjali, ushtrimet e bibliotekës për të.
  4. **Gjendja e rikuperimit:** sipas orëve nga stërvitja e fundit ku muskuli ishte kryesor: < 48 orë "I lodhur", 48–72 "Pothuajse gati", > 72 "Gati". Gjendja shkruhet me fjalë, jo vetëm me ngjyrë.
- **Muskujt e një ushtrimi:** çdo ushtrim ka listat e çelësave kryesorë dhe ndihmës. Për ushtrimet e bibliotekës nxirren nga grupet e free-exercise-db sipas Shtojcës D; për ushtrimet e Shortcut to Size vendosen saktë sipas Shtojcës E (p.sh. Dumbbell Lateral Raise theksohet vetëm te `deltoid_lateral`, jo te i gjithë deltoidi). Përdoruesi mund t'i ndryshojë.
- **Biblioteka e ushtrimeve:** free-exercise-db (domain publik, 800+ ushtrime me muskuj kryesorë/ndihmës dhe foto) + ushtrime të përdoruesit. Ushtrimet e PDF-së që mungojnë (p.sh. Band Roundhouse Elbow, One-Arm High Cable Curl, Standing Pulldown) shtohen si ushtrime të përdoruesit me muskujt e tyre.
- **Ekrani (vendim i 07.11.2026):** katër funksionet ndërtohen fillimisht mbi figurën 2D përpara/mbrapa (rruga e §18), që të mos presin modelin 3D; spike-u 3D vjen pas, mbi të njëjtën logjikë. Te Trupi, paneli ka "Rikuperimi" dhe "Volumi javor" mbi figurë, me legjendë me fjalë; "I lodhur" me brand, "Pothuajse gati" me brand të zbehtë, "Gati" gri i qetë; volumi me katër nivele të një ngjyre (shih "Volumi kundrejt objektivit"). Poshtë, lista e muskujve me të njëjtat vlera; një muskul (në listë ose në figurë) hapet në fletë me emrin latinisht, funksionin, rikuperimin, setet e javës dhe ushtrimet e bibliotekës.
- **Modeli 3D te Trupi (vendim i 07.11.2026):** figura 2D mbetet parazgjedhja, sepse tregon përpara dhe mbrapa njëherësh; nën figurë, zgjedhja "2D / 3D" e ndërron me modelin, dhe zgjedhja mbahet në telefon. Modeli merr të njëjtat ngjyra si figura (tokeni dhe opaciteti i çdo gjendjeje, `body-format.ts`) dhe rrotullohet me zvarritje anash ose me "Shiko mbrapa"; prekja e një muskuli e fokuson (shih më poshtë) dhe "Më shumë" hap të njëjtën fletë si figura. three.js dhe GLB-ja ngarkohen vetëm kur zgjidhet 3D; pa WebGL zgjedhja nuk shfaqet.
- **Muskujt e ushtrimit dhe fokusi në 3D (vendim i 07.11.2026, TH-19):** "Shiko muskujt" te ekrani i ushtrimit dhe ikona "Muskujt e ushtrimit" te seanca hapin fletën me modelin: kryesorët me brand, ndihmësit gri (si te figura 2D), modeli kthehet vetë nga kryesorët (p.sh. Romanian Deadlift mbrapa). Poshtë, emrat e muskujve sipas rolit; prekja e njërit, ose e muskulit te modeli, e fokuson. Fokusi (edhe te Trupi): muskuli ose grupi theksohet (ndriçohet edhe kur s'ka ngjyrë), të tjerët zbehen, kamera i afrohet dhe e kthen trupin nga ana ku muskuli duket te figura 2D (krahët varen pak pas mesit të modelit, ndaj gjeometria nuk mjafton); mbi model del emri i muskulit me vlerën ose rolin, "×" që e heq, dhe vetëm te Trupi "Më shumë" që hap fletën e grupit. Prekja jashtë trupit e heq po ashtu; një prekje e re e të njëjtit muskul e afron sërish kamerën. Dy gishta zmadhojnë (1,1–3,75 m); pa WebGL, fleta tregon figurën 2D. Çdo çelës ka emrin e vet (`KEY_NAMES`): në shqip kur ka një emër të zakonshëm, përndryshe emri anatomik që përdoret në palestër (p.sh. Latissimus dorsi, Vastus lateralis).
- **Volumi kundrejt objektivit (vendim i 08.11.2026, TH-19):** objektivi është 10–20 sete pune në javë për grup muskujsh. Kufiri i poshtëm vjen nga Schoenfeld, Ogborn & Krieger 2017 (J Sports Sci 35:1073–1082): marrëdhënia është e shkallëzuar dhe ≥ 10 sete në javë dhanë rritjen më të madhe. Kufiri i sipërm vjen nga Baz-Valle et al. 2022 (J Hum Kinet 81:199–210), që rekomandon 12–20 për të stërviturit. Setet numërohen si te Pelland et al. 2026 (Sports Med 56:481–505), ku numërimi me gjysmë kishte mbështetjen më të fortë: kryesori 1, ndihmësi 0,5, një herë për grup, pa ngrohjet, në javën kalendarike (e hënë–e diel). Nivelet: "Pa sete", "Nën 10", "10–20 · objektivi", "Mbi 20"; lista tregon setet dhe gjendjen me fjalë ("Nën objektiv", "Në objektiv", "Mbi objektiv"). Fleta e grupit shton "Pjesët këtë javë" (setet e çdo çelësi, me të njëjtin numërim), me shënimin që pjesët nuk mblidhen, sepse një set i bench press-it numërohet edhe te gjoksi i sipërm (ndihmës) edhe te gjoksi i mesëm (kryesor). Setet e një ushtrimi të shtuar nga biblioteka, që di vetëm grupin (p.sh. "shoulders" jep të tria kokat e deltoidit), hyjnë te grupi dhe te fleta si "Pa ndarje sipas pjesëve", jo te pjesët. Etiketat e figurës dhe të modelit thonë setet me gjendjen ("Gjoksi, 3 sete · nën objektiv"). Te modeli 3D, çipi i një grupi me disa pjesë tregon "Gjoksi i sipërm · 1,5 nga 3 sete"; një grup me një pjesë, ose me sete pa ndarje, tregon vlerën e grupit. Java dhe dita e setit lexohen në orën e telefonit, jo në UTC: seti i së hënës 00:30 në Tiranë hyn te java e re.
- **Trupi në v2 (V2-E1-14, bordet "Trupi", "Natë · Trupi", "Ditë · Trupi"):** kur WebView-i vizaton WebGL, Trupi tregon direkt modelin 3D (zgjedhja "2D / 3D" e 07.11.2026 hiqet, si te bordi); figura 2D mbetet vetëm pa WebGL. Ngjyrat vijnë nga tokenat e Vrullit të temës, të lexuara nga CSS-i (`components/body/body-scene.ts`): muskujt mbi `surface`, drita dhe theksimi i fokusit drejt `model-light` (kurrë ngjyra e tekstit, që në Ditë e nxin trupin), volumi me `volume-1…3`, "Pa sete" me `subtle`. Çipi i muskulit rri sipër modelit ("Gjoksi i sipërm · 9,5 nga 14,5 sete", me pikën e ngjyrës, shigjetën që hap fletën dhe "×") dhe një vijë e lidh me qendrën e muskujve në fokus. Lista tregon për çdo grup gjendjen dhe vlerën; nën të, shënimi i javës ("2–8 nëntor, setet e punës. 15 grupe: 1 mbi objektiv, 8 në të, 6 nën të, si vithet dhe kofshët e pasme", dy grupet nën objektiv më afër tij) me burimin e objektivit. Emrat e grupeve, të çelësave dhe funksionet janë te katalogu (`bodyModel.*`), në të dyja gjuhët.
- **Shtresat (V2-E1-14, TH-19; bordi "Trupi · Shtresat"):** ekran më vete nga kreu i Trupit. "Muskujt e thellë" (ndezur si parazgjedhje) i bën të tejdukshme të gjitha mbulesat e `body/layers.ts`, që nuk kapin më prekjen; muskuli i thellë i zgjedhur rri në prush, të tjerët gri, kamera i afrohet. Zgjedhjet: pectoralis minor, romboidët (të dy bashkë), brachialis, soleus, infraspinatus, teres major, ngritësit e shtyllës, gluteusi i mesëm, semimembranosus. Karta e secilit: emri, anatomia me dy fjali nga Kenhub (burimi i shkruar poshtë, i lexuar më 08.11.2026), dhe "Te programi yt": ushtrimet e javës së tanishme të programit ku është kryesor ose ndihmës, me setet e javës (kryesori 1, ndihmësi 0,5).
- **Trupi sipas matjeve (V12, V2-E1-14; bordi "Trupi sipas matjeve"):** dy pamje të modelit, Java 0 dhe sot, me ndryshimin në cm në mes dhe perimetrat poshtë. Baza e çdo perimetri është vlera e fundit deri në ditën kur nisi programi aktiv (`program_state.started_at`), ose e para pas saj; "sot" është matja e fundit. Te krahu, parakrahu, kofsha dhe pulpa merret mesatarja e anëve të matura në të dyja skajet. Kolona e bazës mban emrin e bllokut të parë ("Java 0") kur baza bie në javën e nisjes, përndryshe "Matja e parë". Modeli e ndjek me raportin e perimetrit: muskujt e zonës largohen nga boshti i saj në x dhe z me të njëjtin raport, lartësia mbetet (trungu ka boshtin në mes të trupit, gjymtyrët boshtin e secilës anë; `body/body-shape.ts`). Ndryshimet e vërteta janë të vogla (0,4 cm në 34 cm = 1,2%), ndaj pamjet ndryshojnë pak; numrat e thonë. Pamjet renderohen një herë si imazhe (`components/body/body-still.ts`), që "Trupi në ritëm" (E1-12) ta përdorë për dy pamjet e pulsit.
- **Atribuimi** shfaqet te Cilësimet, "Burimet dhe licencat": BodyParts3D, © The Database Center for Life Science, CC BY 4.0; pjesët nga versioni 3.0 nën CC BY-SA 2.1 Japan, prandaj modeli i app-it shpërndahet me CC BY-SA 2.1 Japan. Po aty: Shortcut to Size, free-exercise-db, Open Food Facts (ODbL), USDA FoodData Central (CC0) dhe Inter (OFL).

## 12. Videot

Çdo ushtrim ka një fushë për link YouTube. App-i nxjerr ID-në e videos dhe e shfaq brenda ushtrimit me `youtube-nocookie.com`; nëse përfshirja dështon, butoni hap app-in e YouTube.

## 13. Rikujtuesit

Njoftime lokale, të planifikuara në telefon. Cilësimet mbajnë: orën e zgjimit, orën e stërvitjes për çdo ditë stërvitjeje, orën e gjumit.

- **Ditët e stërvitjes:** në mëngjes, "Sot: Java 2 · Stërvitja 3" sipas treguesit të radhës.
- **Vaktet dhe suplementet:** sipas orarit të planit. Mëngjesi 1 në zgjim, Mëngjesi 2 30–60 min më vonë, shake-u 10–15 min para stërvitjes, molla brenda 30 min para, vakti pas stërvitjes brenda 30 min pas, shake-u dhe ZMA para gjumit. Nëse stërvitja bie afër një vakti, vakti zëvendësohet me atë para stërvitjes dhe vakti i radhës vjen 1 orë pas vaktit pas stërvitjes (rregulli i PDF-së).
- **Matjet javore:** një herë në javë (parazgjedhje e diel në mëngjes): peshë, perimetra, foto.
- **Planifikimi (vendim i 07.11.2026):** telefoni mban rikujtuesit e 7 ditëve të ardhshme dhe i rinovon sa herë hapet app-i ose ndryshojnë oraret, stërvitja e radhës, suplementet ose lloji i një dite. Stërvitja njofton 30 min pas zgjimit ("Sot: Faza 1 · Java 2 · Stërvitja 3" për të radhës, "Sot ke stërvitje" për ditët pas saj); matja në orën e zgjimit; çdo vakt me artikujt e planit dhe suplementet e tij. Me vaktet të fikura, suplementet vijnë më vete. Te Cilësimet: çelësat e katër llojeve, dita e matjes dhe "Lejo njoftimet" kur mungon leja.

## 14. Dizajni

- Omal UI v2, tema OLED si parazgjedhje (light dhe dark mbeten të disponueshme). Kornizë 390 px, navigim me pesë vende poshtë, kontrolle 44 px, Inter, `tabular-nums` për numrat.
- Ngjyra brand (amber) i përket një veprimi kryesor për ekran: "Ruaj setin", "Fillo stërvitjen", "Mbyll stërvitjen", "Regjistro <vaktin>". Përdoret edhe si shenjë (fill grafikësh, rrethi i timer-it, seti i tanishëm, nënvizimi aktiv). Asnjëherë tekst amber.
- Gjendjet shkruhen gjithmonë me fjalë. Pa emoji dhe pa pikëçuditje në tekst.
- Navigimi poshtë: Sot, Programi, Ushqimi, Progresi, Trupi.
- **Drejtimi: Fokus** (vendim 07.11.2026). U krahasuan tri drejtime me ekranet Sot, Seanca dhe Ushqimi: A · Tabela (si Hevy, Strong), B · Karta (si Bevel, MyFitnessPal), C · Fokus (si Peloton Strength+, Ladder, Tonal). Kanavasi i krahasimit: artefakti "Training Hub · Drejtimet e dizajnit". Parimi: një gjë kryesore në ekran, numra të mëdhenj, prekje të mëdha për duar të djersitura.
  - **`panel`** (sipërfaqja që mbetet e errët në çdo temë) mban zonën kryesore: paneli "Sot", timer-in e pushimit dhe "Vakti i radhës".
  - **Madhësitë:** kontrollet e zakonshme 44 px; butonat − dhe + të seancës 52 px; veprimi amber i ekranit 56 px, i plotë në gjerësi. Titulli kryesor 30–36 px, numri i timer-it 48 px.
  - **Sot:** paneli me "Stërvitja N", grupet e muskujve, numrin e ushtrimeve dhe seteve, dhe figurën e trupit përpara dhe mbrapa me muskujt e ditës; rikuperimi i këtyre muskujve me fjalë ("Gati", "Pothuajse gati", "I lodhur") dhe ditët nga stërvitja e fundit; ushtrimi i parë me peshën e sugjeruar; "Fillo stërvitjen"; një rresht me kcal që mbeten dhe vaktin e radhës.
  - **Seanca:** një ushtrim dhe një set në ekran. Sipër: shiriti i ushtrimeve të ditës dhe butoni i listës. Emri i ushtrimit, "Seti X nga Y" me intervalin, pikat e seteve (bërë, tani, pas). Timer-i si rreth i madh me −15 s, +15 s dhe Kapërce. Pesha dhe përsëritjet me − dhe + (hapi i peshës sipas pajisjes, §7), me referencën e Javës 0 ose të fazës së kaluar poshtë tyre. "Ruaj setin X". Poshtë: "Pastaj" me ushtrimin tjetër. Seti rest-pause ose drop set regjistrohet si segmente në të njëjtin ekran.
  - **Ushqimi:** shiriti i kcal të ditës sipër; paneli "Vakti i radhës" me artikujt e planit, kcal dhe makrot, "Regjistro <vaktin>" dhe "Ndrysho"; poshtë, dita si orar vertikal me gjendjet "Regjistruar", "E radhës", "Në pritje". Suplementet shfaqen te vakti ku merren.
  - Ekranet e tjera (Programi, Progresi, Trupi, editori, cilësimet) ndjekin të njëjtin parim dhe ndërtohen direkt në kod; shqyrtimi bëhet në telefon.

## 15. Tabelat kryesore

`programs`, `program_blocks`, `program_days`, `program_slots`, `slot_prescriptions` (JSON i tipizuar sipas §4, plus rregulli i progresit `progression`, V9), `exercises` (biblioteka + të përdoruesit, `video_url`, `primary_muscles`, `secondary_muscles`, `equipment`), `program_state` (treguesi i radhës), `workout_sessions`, `set_logs` (me segmente), `one_rm_overrides`, `body_measurements`, `progress_photos`, `foods` (cache + të përdoruesit), `recipes`, `recipe_items`, `meal_templates`, `diary_entries`, `nutrition_targets`, `supplements`, `supplement_logs`, `user_settings` (ditët dhe oraret e stërvitjes, zgjimi, gjumi, hapat e peshave sipas pajisjes, tema, rikujtuesit, gjuha), `week_weights` (peshat e javës që përdoruesi pranoi, ndryshoi ose la për më vonë, V23). Çdo tabelë ka `user_id`, `updated_at`, `deleted_at`, RLS. Kohët ruhen në UTC; dita e ditarit dhe e stërvitjes ruhet si datë lokale (`YYYY-MM-DD`, zona e telefonit), që një vakt pas mesnate të mos kalojë në ditën e gabuar.

Skema jeton te `supabase/migrations/`. Kolonat e përbashkëta: `id` (UUID nga telefoni), `user_id`, `created_at`, `updated_at` (koha e ndryshimit në telefon), `deleted_at` (fshirje e butë) dhe `server_updated_at` (vendoset nga serveri në çdo shkrim; kursori i tërheqjes për sinkronizimin). Një version më i vjetër se ai në server nuk e mbishkruan (trigger-i `private.sync_touch`). Politikat lejojnë vetëm pronarin (`TO authenticated` + `user_id = auth.uid()`); `anon` nuk ka asnjë grant. Vlerat e mbyllura kontrollohen në bazë: vaktet (`meal_key`), çelësat e muskujve të Shtojcës D (`muscle_keys`), llojet e recetës dhe të teknikës. Prova e izolimit: `supabase/tests/rls_isolation.sql`.

## 16. Jashtë planit

Play Store, iOS, superset-e dhe qarqe, deload automatik, bisedë me trajner AI, përdorues publikë jashtë miqve të ftuar, sinkronizim me ora përveç Galaxy Watch (v2: miqtë, ora dhe AI për ushqimin e PDF-të janë në plan, §0).

## 17. Radha e ndërtimit

1. Themelet: skeleti i projektit, tokenat e Omal UI v2, Capacitor dhe APK nga GitHub Actions, Dexie, skema e Supabase me RLS, Auth, sinkronizimi, hyrja e parë (§3a).
2. Spike 3D: pipeline-i i modelit dhe një shikues minimal (rrezik i hershëm).
3. Motori i programit dhe Shortcut to Size + Java 0 si të dhëna, me teste.
4. Regjistrimi i stërvitjes dhe timer-i me njoftim.
5. e1RM, pesha e sugjeruar, rekordet.
6. Editori i programeve.
7. Matjet, fotot, grafikët.
8. Ushqimi: objektivat, ditari, Open Food Facts + barkod, USDA, ushqime dhe receta, shablloni i Jimit, zëvendësimet.
9. Suplementet.
10. Rikujtuesit.
11. Modeli 3D: katër funksionet.
12. Videot.

Hapat 1, 3, 4 dhe 5 janë minimumi për ditën e parë në palestër.

**Radha e ekraneve (vendim 07.11.2026), pas themeleve:** sipas navigimit, një ekran në një kohë, secili bashkë me logjikën që i duhet:

1. **Sot**, me seancën, timer-in dhe peshat e sugjeruara: TH-06, TH-07, TH-08, TH-09, TH-10. Ky është minimumi për ditën e parë në palestër.
2. **Programi**, me editorin dhe videot: TH-11, TH-20.
3. **Ushqimi**, me suplementet: TH-14, TH-15, TH-16, TH-17; pastaj rikujtuesit, TH-18.
4. **Progresi**: TH-12, TH-13.
5. **Trupi**: TH-05 (spike-u 3D) dhe TH-19.

Spike-u 3D kalon nga hapi 2 në fund (shih §18).

## 18. Rreziqe dhe pikat e hapura

- **Mospërputhje në PDF:** teksti thotë 0,5 g yndyrë/lb, ndërsa dita shembull ka 110 g për 180 lb (0,61 g/lb). Specifikimi ndjek totalet e ditës shembull, që përputhen me kaloritë (Shtojca C).
- **Modeli 3D:** madhësia dhe pozicioni i pjesëve të 3.0 u zgjidhën (§11). Mbetet rrotullimi në telefonin e vërtetë: emulatori vizaton me CPU dhe nuk e mat dot. Nëse rrotullimi s'është i rrjedhshëm, figura 2D mbetet e vetmja pamje dhe trekëndëshat për çelës ulen te pipeline-i.
- **APK jashtë Play Store:** Android kërkon leje për "instalim nga burime të panjohura" një herë.
- **Verifikimi i zhvilluesve nga Google:** nga shtatori 2026 në disa vende dhe globalisht nga 2027, telefonat Android të certifikuar instalojnë vetëm app-e të regjistruara nga zhvillues të verifikuar. Zgjidhja për këtë app: llogaria falas "limited distribution" te Android Developer Console (vetëm email, deri në 20 pajisje), ku regjistrohen `al.traininghub.app` dhe çelësi i nënshkrimit. Pa të, instalimi mbetet i mundur me "advanced flow" ose ADB.
- **Open Food Facts** ka mbulim të pjesshëm për produktet shqiptare; ushqimet e përdoruesit e mbulojnë boshllëkun.
- **Mbrojtja nga fjalëkalimet e rrjedhura** (HaveIBeenPwned) është vetëm në planin Pro, ndaj këshilltari i sigurisë mban një paralajmërim për të. Rreziku është i vogël: ka një llogari të vetme, regjistrimet janë të mbyllura dhe fjalëkalimi zgjidhet nga përdoruesi. Ky është i vetmi paralajmërim i pranuar.
- **Pauzimi i Supabase:** projekti falas pauzohet pas 7 ditësh pa aktivitet (p.sh. një pushim pa stërvitje). App-i vazhdon pa internet; projekti rikthehet nga paneli i Supabase me të dhënat të paprekura, dhe sinkronizimi rifillon vetë.
- **Muzika (V29):** nuk dihet ende nëse Spotify e jep radhën te sesioni i medias; YouTube Music ka gjasa ta japë. Pa radhë, kënga e setit mbetet "Kalo këngën" pa tempon e së radhës. Matet një herë në telefon me diagnostikimin e `docs/research/muzika.md` (§1.5), para radhës te E1-12.
- **Saktësia e timer-it:** prodhuesit e telefonave (Samsung, Xiaomi etj.) kufizojnë punën në sfond. Nëse njoftimi vonon edhe me alarmet e sakta, app-i kërkon përjashtimin nga optimizimi i baterisë.

## 19. Veprimet që varen nga përdoruesi

- Lejo "instalimin e app-eve të panjohura" për shfletuesin ose skedarët, një herë, për APK-në.
- Lejo njoftimet dhe alarmet e sakta kur i kërkon app-i.
- Merr një çelës falas për USDA FoodData Central (api.data.gov) për detyrën TH-15.
- Te paneli i Supabase: krijo llogarinë tënde (Authentication → Users → Add user, me "Auto Confirm User") dhe çaktivizo "Allow new users to sign up".
- Shto në GitHub secret-et e nënshkrimit `TH_KEYSTORE_BASE64` dhe `TH_KEYSTORE_PASSWORD` dhe ruaj një kopje rezervë të çelësit (`docs/INSTALL.md`, pika 1). Proxy-i i sesionit nuk lejon shkrimin e secret-eve.
- Për çdo version të ri: shkarko APK-në nga Releases dhe përditëso app-in. Release-in e krijon vetë workflow-i (`docs/INSTALL.md`, pika 6).
- Kur rregulli i Google-it të vlejë në vendin tënd: regjistro app-in me llogarinë falas "limited distribution" (`docs/INSTALL.md`, pika 5).
- Për AI-në (Etapa 1 dhe 2): krijo një çelës API dhe shtoje vetë si secret te Supabase (Edge Functions → Secrets); çelësi nuk kalon nëpër bisedë.
- Për tempon e muzikës (E1-12): merr një çelës falas te GetSongBPM dhe shtoje vetë si secret te Supabase (`GETSONGBPM_API_KEY`). Në telefon, lejo qasjen te njoftimet për Vrullin, dhe para saj "Allow restricted settings" te Info e app-it, kur Android-i e kërkon.
- Për videot e formës: kur hapësira e planit falas të Supabase-it mbaron, zgjidh nëse kalon në planin me pagesë.
- Për app-in në orë: aktivizo "Developer options" dhe "ADB debugging" në Galaxy Watch kur të vijë Etapa 5.

## Shtojca A · Ushtrimet sipas fazës

Numri në kllapa te "Slot" tregon setet kur janë 4; pa numër janë 3. Përsëritjet sipas §5.

**Stërvitja 1 · Gjoks, triceps, pulpa**

| Slot | Faza 1 | Faza 2 | Faza 3 |
|---|---|---|---|
| 1 (4) | Bench Press | Bench Press | Bench Press |
| 2 | Incline Bench Press | Incline Dumbbell Press | Reverse-Grip Incline Dumbbell Press |
| 3 | Incline Dumbbell Flye | Dumbbell Flye | Incline Dumbbell Flye |
| 4 | Cable Crossover | Incline Cable Flye | Cable Crossover |
| 5 | Triceps Pressdown | Triceps Pressdown | Triceps Pressdown |
| 6 | Lying Triceps Extension | Dumbbell Overhead Triceps Extension | One-Arm Overhead Cable Triceps Extension |
| 7 | Cable Overhead Triceps Extension | Cable Lying Triceps Extension | Close-Grip Bench Press |
| 8 (4, pulpa) | Standing Calf Raise | Standing Calf Raise | Standing Calf Raise |
| 9 (4, pulpa) | Seated Calf Raise | Seated Calf Raise | Seated Calf Raise |

**Stërvitja 2 · Shpinë, biceps, bark**

| Slot | Faza 1 | Faza 2 | Faza 3 |
|---|---|---|---|
| 1 (4) | Dumbbell Bent-Over Row | Dumbbell Bent-Over Row | Dumbbell Bent-Over Row |
| 2 | Wide-Grip Pulldown | Behind-Neck Pulldown | Wide-Grip Pulldown |
| 3 | Standing Pulldown | Seated Cable Row | Straight-Arm Pulldown |
| 4 | Straight-Arm Pulldown | Reverse-Grip Pulldown | Seated Cable Row |
| 5 (4) | Barbell Curl | Barbell Curl | Barbell Curl |
| 6 | Dumbbell Incline Curl | Preacher Curl | Incline Cable Curl |
| 7 | One-Arm High Cable Curl | Behind-Back Cable Curl | Dumbbell Concentration Curl |
| 8–10 | Barku, Shtojca B (Stërvitja 2) | njësoj | njësoj |

**Stërvitja 3 · Shpatulla, trapez, pulpa**

| Slot | Faza 1 | Faza 2 | Faza 3 |
|---|---|---|---|
| 1 (4) | Dumbbell Shoulder Press | Dumbbell Shoulder Press | Dumbbell Shoulder Press |
| 2 | Dumbbell Lateral Raise | Smith Machine Upright Row | Dumbbell Lateral Raise |
| 3 | One-Arm Cable Front Raise | One-Arm Cable Lateral Raise | Dumbbell Upright Row |
| 4 | High Cable Rear Delt Fly | Bent-Over Lateral Raise | Bent-Over Lateral Raise |
| 5 (4) | Dumbbell Shrug | Barbell Shrug | One-Arm Smith Machine Shrug |
| 6 (4, pulpa) | Seated Calf Raise | Seated Calf Raise | Seated Calf Raise |
| 7 (4, pulpa) | Leg Press Calf Raise | Leg Press Calf Raise | Leg Press Calf Raise |

**Stërvitja 4 · Këmbë, bark**

| Slot | Faza 1 | Faza 2 | Faza 3 |
|---|---|---|---|
| 1 (4) | Squat | Squat | Squat |
| 2 | One-Leg Leg Press | Front Squat | Leg Press |
| 3 | Leg Extension | Leg Extension | Leg Extension |
| 4 (4) | Romanian Deadlift | Romanian Deadlift | Romanian Deadlift |
| 5 | Lying Leg Curl | Seated Leg Curl | Lying Leg Curl |
| 6–8 | Barku, Shtojca B (Stërvitja 4) | njësoj | njësoj |

## Shtojca B · Barku sipas javës

Ushtrimet e barkut janë të njëjta në të tri fazat; ndryshon vetëm kohëzgjatja e plank-ut.

| Java | Stërvitja 2 | Stërvitja 4 | Përsëritjet |
|---|---|---|---|
| 1 | Hip Thrust, Crunch, Oblique Crunch | Hip Thrust, Crunch, Plank | 20–30, deri në dështim nëse mund më shumë |
| 2 | Hanging Leg Raise, Weighted Crunch, Dumbbell Side Bend | Hanging Leg Raise, Weighted Crunch, Side Plank | 15–19 |
| 3 | Weighted Hip Thrust, Cable Crunch, Cable Oblique Crunch | Weighted Hip Thrust, Cable Crunch, Cable Woodchopper | 10–14 |
| 4 | Smith Machine Hip Thrust, Machine Crunch, Band Roundhouse Elbow | Smith Machine Hip Thrust, Machine Crunch, Plank | 6–9 |

Plank dhe Side Plank (3 sete): Faza 1: 60 s (java 1, 2), 75 s (java 4). Faza 2: 75 s (java 1, 2), 90 s (java 4). Faza 3: 90 s (java 1, 2), 105 s (java 4). Weighted Hip Thrust bëhet me top medicinal ose dumbbell mes këmbëve, ose me pesha në kyçe.

## Shtojca C · Formula e ushqimit

Totalet e ditës shembull për 81,65 kg (180 lb), të pjesëtuara me peshën:

| Dita | kcal/kg | Proteina g/kg | Karbohidrate g/kg | Yndyrë g/kg |
|---|---|---|---|---|
| Pushim (3100 kcal, 265 / 260 / 110 g) | 38,0 | 3,25 | 3,18 | 1,35 |
| Stërvitje (3700 kcal, 335 / 340 / 110 g) | 45,3 | 4,10 | 4,16 | 1,35 |

Shembull për 80 kg: pushim 3037 kcal, 260 g P, 255 g K, 108 g Y; stërvitje 3625 kcal, 328 g P, 333 g K, 108 g Y. Plani i Jimit vlen pa ndryshime për 72,6–90,7 kg (160–200 lb); jashtë këtij intervali shablloni mbetet, por objektivat ndryshojnë dhe app-i tregon diferencën.

## Shtojca D · Çelësat e muskujve

| Grupi (free-exercise-db) | Çelësat në model |
|---|---|
| chest | pectoralis_major_clavicular, pectoralis_major_sternocostal, pectoralis_minor |
| shoulders | deltoid_anterior, deltoid_lateral, deltoid_posterior |
| traps | trapezius |
| lats | latissimus_dorsi |
| middle back | rhomboid_major, rhomboid_minor, teres_major, infraspinatus |
| lower back | erector_spinae (iliocostalis, longissimus) |
| biceps | biceps_brachii, brachialis |
| forearms | brachioradialis, forearm_flexors |
| triceps | triceps_brachii |
| abdominals | rectus_abdominis, external_oblique |
| glutes | gluteus_maximus, gluteus_medius |
| abductors | gluteus_medius, tensor_fasciae_latae |
| adductors | adductor_magnus, adductor_longus |
| quadriceps | rectus_femoris, vastus_lateralis, vastus_medialis |
| hamstrings | biceps_femoris, semitendinosus, semimembranosus |
| calves | gastrocnemius, soleus |
| neck | sternocleidomastoid |

Pjesët e deltoid në BodyParts3D: "clavicular part" = anterior, "acromial part" = lateral, "spinal part" = posterior.

## Shtojca E · Muskujt e ushtrimeve të Shortcut to Size

K = kryesor, N = ndihmës. Çelësat sipas Shtojcës D.

| Ushtrimi | K | N |
|---|---|---|
| Bench Press | pectoralis_major_sternocostal | pectoralis_major_clavicular, deltoid_anterior, triceps_brachii |
| Incline Bench Press, Incline Dumbbell Press | pectoralis_major_clavicular | deltoid_anterior, triceps_brachii, pectoralis_major_sternocostal |
| Reverse-Grip Incline Dumbbell Press | pectoralis_major_clavicular | triceps_brachii, deltoid_anterior |
| Incline Dumbbell Flye, Incline Cable Flye | pectoralis_major_clavicular | deltoid_anterior |
| Dumbbell Flye | pectoralis_major_sternocostal | pectoralis_major_clavicular, deltoid_anterior |
| Cable Crossover | pectoralis_major_sternocostal | pectoralis_minor, deltoid_anterior |
| Close-Grip Bench Press | triceps_brachii | pectoralis_major_sternocostal, deltoid_anterior |
| Triceps Pressdown, Lying Triceps Extension, Cable Lying Triceps Extension, Cable Overhead Triceps Extension, Dumbbell Overhead Triceps Extension, One-Arm Overhead Cable Triceps Extension | triceps_brachii | – |
| Standing Calf Raise, Leg Press Calf Raise | gastrocnemius | soleus |
| Seated Calf Raise | soleus | gastrocnemius |
| Dumbbell Bent-Over Row | latissimus_dorsi, rhomboid_major | trapezius, teres_major, deltoid_posterior, biceps_brachii, erector_spinae |
| Seated Cable Row | latissimus_dorsi, rhomboid_major | trapezius, deltoid_posterior, biceps_brachii |
| Wide-Grip Pulldown, Behind-Neck Pulldown | latissimus_dorsi | teres_major, rhomboid_major, biceps_brachii |
| Reverse-Grip Pulldown, Standing Pulldown | latissimus_dorsi | biceps_brachii, teres_major |
| Straight-Arm Pulldown | latissimus_dorsi | teres_major, triceps_brachii |
| Barbell Curl | biceps_brachii | brachialis, brachioradialis |
| Preacher Curl | biceps_brachii, brachialis | brachioradialis |
| Dumbbell Incline Curl, Incline Cable Curl, One-Arm High Cable Curl, Behind-Back Cable Curl, Dumbbell Concentration Curl | biceps_brachii | brachialis |
| Dumbbell Shoulder Press | deltoid_anterior, deltoid_lateral | triceps_brachii, trapezius |
| Dumbbell Lateral Raise, One-Arm Cable Lateral Raise | deltoid_lateral | trapezius |
| One-Arm Cable Front Raise | deltoid_anterior | pectoralis_major_clavicular |
| High Cable Rear Delt Fly, Bent-Over Lateral Raise | deltoid_posterior | rhomboid_major, trapezius, infraspinatus |
| Smith Machine Upright Row, Dumbbell Upright Row | deltoid_lateral, trapezius | deltoid_anterior, biceps_brachii |
| Dumbbell Shrug, Barbell Shrug, One-Arm Smith Machine Shrug | trapezius | – |
| Squat | rectus_femoris, vastus_lateralis, vastus_medialis, gluteus_maximus | adductor_magnus, erector_spinae, biceps_femoris |
| Front Squat | rectus_femoris, vastus_lateralis, vastus_medialis | gluteus_maximus, erector_spinae, rectus_abdominis |
| Leg Press, One-Leg Leg Press | rectus_femoris, vastus_lateralis, vastus_medialis | gluteus_maximus, adductor_magnus |
| Leg Extension | rectus_femoris, vastus_lateralis, vastus_medialis | – |
| Romanian Deadlift | biceps_femoris, semitendinosus, semimembranosus, gluteus_maximus | erector_spinae, adductor_magnus |
| Lying Leg Curl, Seated Leg Curl | biceps_femoris, semitendinosus, semimembranosus | gastrocnemius |
| Hip Thrust, Weighted Hip Thrust, Smith Machine Hip Thrust (barku) | rectus_abdominis | external_oblique |
| Crunch, Weighted Crunch, Cable Crunch, Machine Crunch, Hanging Leg Raise, Plank | rectus_abdominis | external_oblique |
| Oblique Crunch, Cable Oblique Crunch, Cable Woodchopper, Band Roundhouse Elbow | external_oblique | rectus_abdominis |
| Dumbbell Side Bend | external_oblique | erector_spinae |
| Side Plank | external_oblique | gluteus_medius, rectus_abdominis |
