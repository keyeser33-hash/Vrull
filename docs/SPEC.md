# Training Hub · Specifikimi v1

Data: 07.11.2026. Burimet: programi "Jim Stoppani's 12-Week Shortcut to Size" (PDF në projekt) dhe vendimet e seancës së pyetjeve (Q1–Q18) të së njëjtës ditë. Ky dokument është burimi i së vërtetës për ndërtimin; çdo ndryshim vendimi shkruhet këtu.

## 1. Qëllimi

Një aplikacion personal për Android që e çon përdoruesin, fillestar në palestër, nëpër Shortcut to Size dhe programe të tjera që shkruan vetë, dhe mban gjithçka që lidhet me progresin: stërvitjet, peshat, matjet e trupit, ushqimin dhe suplementet. Një përdorues, falas, funksionon pa internet.

## 2. Vendimet

| # | Vendimi |
|---|---|
| Platforma | App Android i paketuar si APK me Capacitor, i instaluar jashtë Play Store. Kod web: React + Vite + TypeScript. |
| Të dhënat | Lokale-së-pari (IndexedDB në telefon), sinkronizim me Supabase (projekti `training-hub`, Frankfurt). |
| Q1 | Supabase në llogarinë e re, organizata `andinora94@gmail.com's Org`, ref `hxwkyhfqcadtipkpopnq`. |
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
| Njësitë | kg, cm. Ditët e stërvitjes: e hënë, e martë, e enjte, e premte (ndryshohen te cilësimet). |
| Gjuha | UI në shqip. Emrat e ushtrimeve mbeten në anglisht, si në PDF dhe në bibliotekë. |

## 3. Platforma dhe arkitektura

- **Klienti:** React + Vite + TypeScript, Tailwind v4 me tokenat e Omal UI v2 (`globals.css` i sistemit të dizajnit), komponentë shadcn.
- **Paketimi:** Capacitor Android. Plugin-et: njoftime lokale, dridhje (haptics), skaner barkodi, kamera për fotot. APK-ja ndërtohet nga GitHub Actions dhe publikohet si GitHub Release; përditësimi është instalim i APK-së së re mbi të vjetrën, me të njëjtin çelës nënshkrimi (ruhet si secret në repo).
- **Ruajtja lokale:** Dexie (IndexedDB). Çdo veprim shkruan fillimisht lokalisht; asnjë ekran nuk pret rrjetin.
- **Sinkronizimi:** çdo rresht ka `id` (UUID i krijuar në telefon), `updated_at`, `deleted_at`. Dërgohen rreshtat e ndryshuar, merren ato më të reja se sinkronizimi i fundit. Konfliktet: fiton ndryshimi më i fundit (një përdorues, një telefon).
- **Supabase:** Postgres me RLS (`user_id = auth.uid()` në çdo tabelë), Auth me email dhe fjalëkalim, Storage me bucket privat për fotot, Edge Function si ndërmjetës për USDA FoodData Central (çelësi si secret).
- **3D:** three.js përmes `@react-three/fiber`. Modeli është një GLB i gjeneruar nga një skript i përsëritshëm në `tools/anatomy/` (shih §11).
- **Varësitë:** çdo paketë e re verifikohet para instalimit (autenticiteti, mirëmbajtja, licenca).

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

## 5. Shortcut to Size si të dhëna

Programi futet si program i parë, i gatshëm, sipas Shtojcës A. Rregullat:

- **Shkallët e përsëritjeve** (java 1 → 4 e çdo faze):
  - ushtrimet kryesore dhe ndihmëse: 12–15, 9–11, 6–8, 3–5;
  - pulpat: 25–30, 15–20, 10–14, 6–9;
  - barku: 20–30 (vazhdo deri në dështim nëse mundesh më shumë), 15–19, 10–14, 6–9.
- **Setet:** 4 sete për Bench Press, Dumbbell Bent-Over Row, Barbell Curl, Dumbbell Shoulder Press, shrug-et, Squat, Romanian Deadlift dhe pulpat. 3 sete për të gjitha të tjerat, përfshirë Triceps Pressdown dhe barkun.
- **Teknika:** javët 1–2 rest-pause në setin e fundit të çdo ushtrimi (deri në dështim, 15 s pushim, vazhdo deri në dështim). Javët 3–4 drop set në setin e fundit (deri në dështim, ul te pesha e javës 1 të fazës për atë ushtrim, vazhdo deri në dështim).
- **Pesha mbetet e njëjtë** në të gjitha setet e një ushtrimi brenda seancës. Minimumi i intervalit duhet arritur.
- **Ushtrimi i parë i çdo grupi** (Bench Press, Triceps Pressdown, Dumbbell Bent-Over Row, Barbell Curl, Dumbbell Shoulder Press, Squat, Romanian Deadlift) mbetet i njëjtë për 12 javët. Ndihmësit ndryshojnë sipas fazës. Ushtrimet e barkut ndryshojnë sipas javës (Shtojca B).
- **Java 0:** stërvitjet e Fazës 1, Java 1, me 2–3 sete, 12–15 përsëritje, pa rest-pause dhe pa dështim (lër 2–3 përsëritje në rezervë). Qëllimi: teknika dhe gjetja e peshës për 12–15. Peshat e Javës 0 ushqejnë sugjerimet e Javës 1.

## 6. Regjistrimi i stërvitjes

- Ekrani i seancës tregon slotet me radhë, recetën e javës, peshën e sugjeruar dhe referencën e fazës së kaluar.
- Për çdo set: pesha, përsëritjet (ose sekondat), RPE/RIR kur receta e kërkon, shënim. Seti i fundit me rest-pause ose drop set ka segmente (pesha dhe përsëritjet e secilit).
- Pas çdo seti nis timer-i i pushimit. Kur mbaron, vjen njoftim me zë dhe dridhje edhe me ekran të kyçur. Gjatë rest-pause, timer-i është 15 s.
- Rekordet personale (peshë më e madhe për një numër përsëritjesh, e1RM më e lartë) shënohen në moment.
- Seanca mund të ndërpritet dhe të vazhdohet; mbyllja e saj e çon treguesin përpara.

## 7. 1RM dhe pesha e sugjeruar

- **e1RM** me formulën Epley: `pesha × (1 + përsëritjet / 30)`, vetëm nga setet e drejta me 1–15 përsëritje (jo segmentet e rest-pause ose drop set-it).
- **1RM aktuale** e një ushtrimi: më e larta nga 28 ditët e fundit. Përdoruesi mund ta vendosë me dorë; vlera e tij vlen derisa një seancë e re të japë më shumë.
- **Pesha e sugjeruar** për një interval përsëritjesh: `1RM / (1 + kufiri i sipërm / 30)`, e rrumbullakosur poshtë sipas pajisjes (shufër 2,5 kg; dumbbell 2 kg; kabëll dhe makineri 5 kg; ndryshohen te cilësimet).
- **Referenca e fazës së kaluar:** pesha dhe përsëritjet e së njëjtës javë në fazën e mëparshme, plus intervali +2,5–9 kg nga programi.
- Për `percent_1rm`, pesha llogaritet nga 1RM aktuale. Ushtrim pa histori: pa sugjerim, me tekstin "Zgjidh peshën ku mbyll X–Y përsëritje".

## 8. Matjet dhe grafikët

- **Matjet:** pesha e trupit (çdo ditë, opsionale), % e yndyrës (me dorë), perimetrat në cm: qafa, shpatullat, gjoksi, beli, vithet, krahu (M/D), parakrahu (M/D), kofsha (M/D), pulpa (M/D).
- **Fotot e progresit:** para, anash, mbrapa. Kompresohen në telefon dhe ruhen në bucket privat të Supabase.
- **Grafikët:** e1RM për çdo ushtrim, volumi javor për muskul (sete), pesha e trupit me mesatare 7-ditore, perimetrat, përputhja me objektivat e ushqimit.

## 9. Ushqimi

- **Objektivat** (Q15): nga totalet e ditës shembull të Jimit (180 lb = 81,65 kg), të shkallëzuara sipas peshës. Shih Shtojcën C. Dita llogaritet "stërvitje" nëse është ditë stërvitjeje te cilësimet ose nëse u regjistrua stërvitje atë ditë; përdoruesi e ndryshon me një prekje.
- **Ditari:** vaktet sipas planit (Mëngjesi 1, Mëngjesi 2, Zemër mëngjesi, Dreka, Pasditja, Darka, Para gjumit, plus Para/Gjatë/Pas stërvitjes në ditë stërvitjeje). Çdo regjistrim: ushqimi, gramët, vakti, data.
- **Burimet e ushqimeve:**
  - Open Food Facts për produktet me barkod (skaner në kamerë);
  - USDA FoodData Central për ushqimet e përgjithshme, përmes Edge Function;
  - ushqimet e përdoruesit (makro për 100 g) dhe recetat (përbërës me gramë, peshë totale, porcione), të ruajtura për ripërdorim.
- **Shablloni i Jimit** (Q18): çdo vakt i planit regjistrohet me një prekje dhe pastaj ndryshohet. Listat e zëvendësimeve të PDF-së (mishrat, bulmetrat, drithërat, perimet, frutat, karbohidratet pas stërvitjes) shfaqen si alternativa për artikullin përkatës.
- **Shënim në ekranin e objektivave:** proteina e Jimit është rreth 3,3–4,1 g/kg; studimet tregojnë se fitimi në muskul nuk rritet ndjeshëm mbi rreth 1,6–2,2 g/kg.

## 10. Suplementet

Lista e planit, me orarin dhe dozën, regjistrohet si checklist ditore:

| Suplementi | Kur | Doza (PDF) | Evidenca |
|---|---|---|---|
| Protein powder | Mëngjesi 1, Pasditja, Para gjumit, shake-u i stërvitjes | 1–2 scoop | Ushqim; e mirë kur mbush objektivin |
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
  - Versioni 4.0, CC BY 4.0, OBJ me 99% më pak poligone, një skedar për çdo element me emër dhe FMA ID. Mbulon muskujt kryesorë (pectoralis major, tri pjesët e deltoid, biceps, triceps, trapezius, rhomboid, teres major, infraspinatus, serratus, obliques, glutes, quadriceps, hamstrings, adductors, gastrocnemius, soleus, tibialis anterior, erector spinae).
  - Latissimus dorsi dhe rectus abdominis mungojnë te 4.0. Merren nga versioni 3.0 (STL, CC BY-SA 2.1 Japan, pasqyra `Kevin-Mattheus-Moerman/BodyParts3D` në GitHub) dhe thjeshtohen.
- **Pipeline-i** (`tools/anatomy/`, i përsëritshëm): zgjidh elementet sipas tabelës së muskujve (Shtojca D) → bashko majtas/djathtas sipas çelësit → thjeshto (meshoptimizer) → GLB me një nyje me emër për çdo çelës → kompresim. Objektivi: ≤ 5 MB, rrotullim i rrjedhshëm në një telefon Android mesatar.
- **Funksionet** (Q14):
  1. **Muskujt e ushtrimit:** te çdo ushtrim, muskujt kryesorë dhe ndihmës theksohen me dy nivele.
  2. **Harta javore:** çdo muskul ngjyroset sipas seteve të javës (kryesor = 1, ndihmës = 0,5), me legjendë.
  3. **Prek muskulin:** emri në shqip dhe latinisht, funksioni me një fjali, ushtrimet e bibliotekës për të.
  4. **Gjendja e rikuperimit:** sipas orëve nga stërvitja e fundit ku muskuli ishte kryesor: < 48 orë "I lodhur", 48–72 "Pothuajse gati", > 72 "Gati". Gjendja shkruhet me fjalë, jo vetëm me ngjyrë.
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
- Ngjyra brand (amber) i përket një veprimi kryesor për ekran: "Ruaj setin", "Fillo stërvitjen", "Mbyll stërvitjen". Përdoret edhe si shenjë (fill grafikësh, nënvizimi aktiv). Asnjëherë tekst amber.
- Gjendjet shkruhen gjithmonë me fjalë. Pa emoji dhe pa pikëçuditje në tekst.
- Referenca nga Mobbin (Hevy, Strong, MyFitnessPal) për regjistrimin e seteve, timer-in dhe ditarin.
- Navigimi poshtë: Sot, Programi, Ushqimi, Progresi, Trupi.

## 15. Tabelat kryesore

`programs`, `program_blocks`, `program_days`, `program_slots`, `slot_prescriptions` (JSON i tipizuar sipas §4), `exercises` (biblioteka + të përdoruesit, `video_url`, `primary_muscles`, `secondary_muscles`, `equipment`), `program_state` (treguesi i radhës), `workout_sessions`, `set_logs` (me segmente), `one_rm_overrides`, `body_measurements`, `progress_photos`, `foods` (cache + të përdoruesit), `recipes`, `recipe_items`, `meal_templates`, `diary_entries`, `nutrition_targets`, `supplements`, `supplement_logs`, `reminder_settings`. Çdo tabelë ka `user_id`, `updated_at`, `deleted_at`, RLS.

## 16. Jashtë planit

Play Store, iOS, përdorues të tjerë ose ndarje, superset-e dhe qarqe, deload automatik, sinkronizim me ora inteligjente, trajner me AI.

## 17. Radha e ndërtimit

1. Themelet: skeleti i projektit, tokenat e Omal UI v2, Capacitor dhe APK nga GitHub Actions, Dexie, skema e Supabase me RLS, Auth, sinkronizimi.
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

## 18. Rreziqe dhe pikat e hapura

- **Mospërputhje në PDF:** teksti thotë 0,5 g yndyrë/lb, ndërsa dita shembull ka 110 g për 180 lb (0,61 g/lb). Specifikimi ndjek totalet e ditës shembull, që përputhen me kaloritë (Shtojca C).
- **Modeli 3D:** pjesët nga versioni 3.0 kanë rezolucion të lartë (rreth 10 MB për muskul) dhe duhen thjeshtuar fort; duhet kontrolluar që përputhen në pozicion me versionin 4.0.
- **APK jashtë Play Store:** Android kërkon leje për "instalim nga burime të panjohura" një herë.
- **Open Food Facts** ka mbulim të pjesshëm për produktet shqiptare; ushqimet e përdoruesit e mbulojnë boshllëkun.

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
