# Training Hub · Specifikimi v1.4

Data: 07.11.2026 (v1.2 pas rishikimit përfundimtar; v1.3 me detajet e Android-it nga TH-02; v1.4 me vendimet e dizajnit dhe radhën e ekraneve). Burimet: programi "Jim Stoppani's 12-Week Shortcut to Size" (PDF në projekt), vendimet e seancës së pyetjeve (Q1–Q18) të së njëjtës ditë dhe krahasimi i tri drejtimeve të dizajnit në kanavasin "Training Hub · Drejtimet e dizajnit". Ky dokument është burimi i së vërtetës për ndërtimin; çdo ndryshim vendimi shkruhet këtu.

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
- **3D:** three.js përmes `@react-three/fiber`. Modeli është një GLB i gjeneruar nga një skript i përsëritshëm në `tools/anatomy/` (shih §11).
- **Varësitë:** çdo paketë e re verifikohet para instalimit (autenticiteti, mirëmbajtja, licenca).

## 3a. Hyrja e parë

1. Hyrja me email dhe fjalëkalim (llogaria krijohet te paneli i Supabase; hyrja kërkon internet vetëm këtë herë).
2. Pesha e trupit sot (kg), e nevojshme për objektivat e ushqimit.
3. Ditët e stërvitjes (parazgjedhje: e hënë, e martë, e enjte, e premte) dhe ora e zakonshme e stërvitjes.
4. Ora e zgjimit dhe e gjumit, për rikujtuesit.
5. Programi aktiv: Shortcut to Size, duke nisur nga Java 0.

Çdo hap ndryshohet më vonë te cilësimet (Profili: pesha e sotme, ditët, ora e stërvitjes, zgjimi, gjumi; Llogaria: dalja). Lejet e njoftimeve kërkohen në stërvitjen e parë, kur nevojiten, jo këtu.

Pas hyrjes, para hapave, app-i merr të dhënat ekzistuese nga Supabase ("Po merren të dhënat e tua"; pa internet: "Provo përsëri"), që një instalim i ri të mos i përsërisë hapat dhe të mos krijojë një profil të dytë. Me profilin të plotësuar në telefon, app-i hapet direkt te Sot edhe pa internet. Hapi 5 krijon skeletin e Shortcut to Size (Java 0 dhe Fazat 1–3, me 4 ditët) dhe treguesin te Java 0 · Stërvitja 1; ushtrimet i shton TH-07. Dalja nga llogaria bëhet vetëm në telefon dhe nuk fshin të dhënat lokale. Porta e rrugëve: `src/routes/gate.tsx`, faza: `src/data/phase.ts`.

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

Editori lejon krijimin, kopjimin dhe ndryshimin e çdo pjese: kopjo javën, kopjo bllokun, ndrysho ushtrimin e një sloti vetëm për një bllok. Zëvendësimi i një ushtrimi kur mungon pajisja bëhet këtu.

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

## 8. Matjet dhe grafikët

- **Matjet:** pesha e trupit (çdo ditë, opsionale), % e yndyrës (me dorë), perimetrat në cm: qafa, shpatullat, gjoksi, beli, vithet, krahu (M/D), parakrahu (M/D), kofsha (M/D), pulpa (M/D).
- **Fotot e progresit:** para, anash, mbrapa. Kompresohen në telefon dhe ruhen në bucket privat të Supabase.
- **Grafikët:** e1RM për çdo ushtrim, volumi javor për muskul (sete), pesha e trupit me mesatare 7-ditore, perimetrat, përputhja me objektivat e ushqimit.
- **Eksporti:** te cilësimet, "Eksporto të dhënat" nxjerr një skedar JSON me gjithçka (pa fotot). Plani falas i Supabase nuk ka backup automatik ditor, ndaj ky është rrjeti i sigurisë.

## 9. Ushqimi

- **Objektivat** (Q15): nga totalet e ditës shembull të Jimit (180 lb = 81,65 kg), të shkallëzuara sipas peshës, duke përdorur mesataren 7-ditore të peshës së trupit (ose peshën e fundit kur ka më pak se 3 matje). Shih Shtojcën C. Dita llogaritet "stërvitje" nëse është ditë stërvitjeje te cilësimet ose nëse u regjistrua stërvitje atë ditë; përdoruesi e ndryshon me një prekje.
- **Ditari:** vaktet sipas planit (Mëngjesi 1, Mëngjesi 2, Snack paradite, Dreka, Snack pasdite, Darka, Para gjumit, plus Para/Gjatë/Pas stërvitjes në ditë stërvitjeje). Çdo regjistrim: ushqimi, gramët, vakti, data.
- **Burimet e ushqimeve:**
  - Open Food Facts për produktet me barkod (skaner në kamerë), me User-Agent `TrainingHub/<versioni>` pa të dhëna personale;
  - USDA FoodData Central për ushqimet e përgjithshme, përmes Edge Function që pranon vetëm kërkesa me sesion të vlefshëm;
  - ushqimet e përdoruesit (makro për 100 g) dhe recetat (përbërës me gramë, peshë totale, porcione), të ruajtura për ripërdorim.
- **Shablloni i Jimit** (Q18): çdo vakt i planit regjistrohet me një prekje dhe pastaj ndryshohet. Listat e zëvendësimeve të PDF-së (mishrat, bulmetrat, drithërat, perimet, frutat, karbohidratet pas stërvitjes) shfaqen si alternativa për artikullin përkatës.
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

## 11. Modeli 3D i trupit

- **Burimi (verifikuar 07.11.2026):** BodyParts3D, Database Center for Life Science.
  - Versioni 4.0, CC BY 4.0, OBJ me 99% më pak poligone, një skedar për çdo element me emër dhe FMA ID. Mbulon muskujt kryesorë (pectoralis major, tri pjesët e deltoid, biceps, triceps, trapezius, rhomboid, teres major, infraspinatus, serratus, external oblique, glutes, quadriceps, hamstrings, adductors, gastrocnemius, soleus, tibialis anterior, erector spinae).
  - Latissimus dorsi dhe rectus abdominis mungojnë te 4.0. Merren nga versioni 3.0 (STL, CC BY-SA 2.1 Japan, pasqyra `Kevin-Mattheus-Moerman/BodyParts3D` në GitHub) dhe thjeshtohen.
- **Pipeline-i** (`tools/anatomy/`, i përsëritshëm): zgjidh elementet sipas tabelës së muskujve (Shtojca D) → bashko majtas/djathtas sipas çelësit → thjeshto (meshoptimizer) → GLB me një nyje me emër për çdo çelës → kompresim. Objektivi: ≤ 5 MB, rrotullim i rrjedhshëm në një telefon Android mesatar.
- **Funksionet** (Q14):
  1. **Muskujt e ushtrimit:** te çdo ushtrim, muskujt kryesorë dhe ndihmës theksohen me dy nivele.
  2. **Harta javore:** çdo muskul ngjyroset sipas seteve të javës (kryesor = 1, ndihmës = 0,5), me legjendë.
  3. **Prek muskulin:** emri në shqip dhe latinisht, funksioni me një fjali, ushtrimet e bibliotekës për të.
  4. **Gjendja e rikuperimit:** sipas orëve nga stërvitja e fundit ku muskuli ishte kryesor: < 48 orë "I lodhur", 48–72 "Pothuajse gati", > 72 "Gati". Gjendja shkruhet me fjalë, jo vetëm me ngjyrë.
- **Muskujt e një ushtrimi:** çdo ushtrim ka listat e çelësave kryesorë dhe ndihmës. Për ushtrimet e bibliotekës nxirren nga grupet e free-exercise-db sipas Shtojcës D; për ushtrimet e Shortcut to Size vendosen saktë sipas Shtojcës E (p.sh. Dumbbell Lateral Raise theksohet vetëm te `deltoid_lateral`, jo te i gjithë deltoidi). Përdoruesi mund t'i ndryshojë.
- **Biblioteka e ushtrimeve:** free-exercise-db (domain publik, 800+ ushtrime me muskuj kryesorë/ndihmës dhe foto) + ushtrime të përdoruesit. Ushtrimet e PDF-së që mungojnë (p.sh. Band Roundhouse Elbow, One-Arm High Cable Curl, Standing Pulldown) shtohen si ushtrime të përdoruesit me muskujt e tyre.
- **Atribuimi** shfaqet te ekrani "Rreth": BodyParts3D, © The Database Center for Life Science, CC BY 4.0; pjesët nga versioni 3.0 nën CC BY-SA 2.1 Japan.

## 12. Videot

Çdo ushtrim ka një fushë për link YouTube. App-i nxjerr ID-në e videos dhe e shfaq brenda ushtrimit me `youtube-nocookie.com`; nëse përfshirja dështon, butoni hap app-in e YouTube.

## 13. Rikujtuesit

Njoftime lokale, të planifikuara në telefon. Cilësimet mbajnë: orën e zgjimit, orën e stërvitjes për çdo ditë stërvitjeje, orën e gjumit.

- **Ditët e stërvitjes:** në mëngjes, "Sot: Java 2 · Stërvitja 3" sipas treguesit të radhës.
- **Vaktet dhe suplementet:** sipas orarit të planit. Mëngjesi 1 në zgjim, Mëngjesi 2 30–60 min më vonë, shake-u 10–15 min para stërvitjes, molla brenda 30 min para, vakti pas stërvitjes brenda 30 min pas, shake-u dhe ZMA para gjumit. Nëse stërvitja bie afër një vakti, vakti zëvendësohet me atë para stërvitjes dhe vakti i radhës vjen 1 orë pas vaktit pas stërvitjes (rregulli i PDF-së).
- **Matjet javore:** një herë në javë (parazgjedhje e diel në mëngjes): peshë, perimetra, foto.

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

`programs`, `program_blocks`, `program_days`, `program_slots`, `slot_prescriptions` (JSON i tipizuar sipas §4), `exercises` (biblioteka + të përdoruesit, `video_url`, `primary_muscles`, `secondary_muscles`, `equipment`), `program_state` (treguesi i radhës), `workout_sessions`, `set_logs` (me segmente), `one_rm_overrides`, `body_measurements`, `progress_photos`, `foods` (cache + të përdoruesit), `recipes`, `recipe_items`, `meal_templates`, `diary_entries`, `nutrition_targets`, `supplements`, `supplement_logs`, `user_settings` (ditët dhe oraret e stërvitjes, zgjimi, gjumi, hapat e peshave sipas pajisjes, tema, rikujtuesit). Çdo tabelë ka `user_id`, `updated_at`, `deleted_at`, RLS. Kohët ruhen në UTC; dita e ditarit dhe e stërvitjes ruhet si datë lokale (`YYYY-MM-DD`, zona e telefonit), që një vakt pas mesnate të mos kalojë në ditën e gabuar.

Skema jeton te `supabase/migrations/`. Kolonat e përbashkëta: `id` (UUID nga telefoni), `user_id`, `created_at`, `updated_at` (koha e ndryshimit në telefon), `deleted_at` (fshirje e butë) dhe `server_updated_at` (vendoset nga serveri në çdo shkrim; kursori i tërheqjes për sinkronizimin). Një version më i vjetër se ai në server nuk e mbishkruan (trigger-i `private.sync_touch`). Politikat lejojnë vetëm pronarin (`TO authenticated` + `user_id = auth.uid()`); `anon` nuk ka asnjë grant. Vlerat e mbyllura kontrollohen në bazë: vaktet (`meal_key`), çelësat e muskujve të Shtojcës D (`muscle_keys`), llojet e recetës dhe të teknikës. Prova e izolimit: `supabase/tests/rls_isolation.sql`.

## 16. Jashtë planit

Play Store, iOS, përdorues të tjerë ose ndarje, superset-e dhe qarqe, deload automatik, sinkronizim me ora inteligjente, trajner me AI.

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
- **Modeli 3D:** pjesët nga versioni 3.0 kanë rezolucion të lartë (rreth 10 MB për muskul) dhe duhen thjeshtuar fort; duhet kontrolluar që përputhen në pozicion me versionin 4.0. Me radhën e ekraneve sipas navigimit, ky rrezik zbulohet i fundit. Nëse modeli nuk arrin objektivin (≤ 5 MB, rrotullim i rrjedhshëm), Trupi kalon në figurë 2D përpara dhe mbrapa, si ajo e ekranit Sot.
- **APK jashtë Play Store:** Android kërkon leje për "instalim nga burime të panjohura" një herë.
- **Verifikimi i zhvilluesve nga Google:** nga shtatori 2026 në disa vende dhe globalisht nga 2027, telefonat Android të certifikuar instalojnë vetëm app-e të regjistruara nga zhvillues të verifikuar. Zgjidhja për këtë app: llogaria falas "limited distribution" te Android Developer Console (vetëm email, deri në 20 pajisje), ku regjistrohen `al.traininghub.app` dhe çelësi i nënshkrimit. Pa të, instalimi mbetet i mundur me "advanced flow" ose ADB.
- **Open Food Facts** ka mbulim të pjesshëm për produktet shqiptare; ushqimet e përdoruesit e mbulojnë boshllëkun.
- **Mbrojtja nga fjalëkalimet e rrjedhura** (HaveIBeenPwned) është vetëm në planin Pro, ndaj këshilltari i sigurisë mban një paralajmërim për të. Rreziku është i vogël: ka një llogari të vetme, regjistrimet janë të mbyllura dhe fjalëkalimi zgjidhet nga përdoruesi. Ky është i vetmi paralajmërim i pranuar.
- **Pauzimi i Supabase:** projekti falas pauzohet pas 7 ditësh pa aktivitet (p.sh. një pushim pa stërvitje). App-i vazhdon pa internet; projekti rikthehet nga paneli i Supabase me të dhënat të paprekura, dhe sinkronizimi rifillon vetë.
- **Saktësia e timer-it:** prodhuesit e telefonave (Samsung, Xiaomi etj.) kufizojnë punën në sfond. Nëse njoftimi vonon edhe me alarmet e sakta, app-i kërkon përjashtimin nga optimizimi i baterisë.

## 19. Veprimet që varen nga përdoruesi

- Lejo "instalimin e app-eve të panjohura" për shfletuesin ose skedarët, një herë, për APK-në.
- Lejo njoftimet dhe alarmet e sakta kur i kërkon app-i.
- Merr një çelës falas për USDA FoodData Central (api.data.gov) për detyrën TH-15.
- Te paneli i Supabase: krijo llogarinë tënde (Authentication → Users → Add user, me "Auto Confirm User") dhe çaktivizo "Allow new users to sign up".
- Shto në GitHub secret-et e nënshkrimit `TH_KEYSTORE_BASE64` dhe `TH_KEYSTORE_PASSWORD` dhe ruaj një kopje rezervë të çelësit (`docs/INSTALL.md`, pika 1). Proxy-i i sesionit nuk lejon shkrimin e secret-eve.
- Për çdo version të ri: shkarko APK-në nga Releases dhe përditëso app-in. Release-in e krijon vetë workflow-i (`docs/INSTALL.md`, pika 6).
- Kur rregulli i Google-it të vlejë në vendin tënd: regjistro app-in me llogarinë falas "limited distribution" (`docs/INSTALL.md`, pika 5).

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
