# Mësimet nga gabimet

Çdo gabim që kushton kohë shkruhet këtu, me rregullin që e shmang herën tjetër. Lexoje para një detyre të re; shto një rresht kur një gabim përsëritet ose kur një provë dështon për arsye që nuk ishte te app-i.

Formati: **çfarë ndodhi** → **rregulli**.

## Prova e Android-it (emulatori te GitHub Actions)

- Prova e plotë zgjat ~15 min dhe nisej nga e para për çdo ndreqje të vogël (16 nisje të kuqe për një degë) → prova ndahet në pjesë (`skip` / `SMOKE_SKIP`); pas një dështimi niset vetëm pjesa që dështoi, prova e plotë vetëm në fund.
- Prova te `main` mbeti e kuqe që nga vala A, sepse UI ndryshoi te Vrull dhe skripti kërkonte ende tekstet e v1 → kur ndryshon një ekran që prova e prek, skripti ndryshon në të njëjtin ndryshim; prova nuk niset në çdo push te `main`, vetëm me dorë dhe para lëshimit.
- Rreshtat `ERROR: could not get idle state` vijnë nga uiautomator gjatë animacioneve → nuk janë shkaku; shkaku është rreshti `Error:` i fundit.
- Një provë që dështon disa herë në të njëjtin hap nuk është gjithmonë emulatori: Home gjatë videos ishte defekt i vërtetë (pamja e ekranit e tregoi: regjistrimi vazhdonte) → para se ta quash "të paqëndrueshme", shih pamjen e ekranit të gabimit. Ato që emulatori nuk i bën dot (kamera e vërtetë, Spotify, telefon i vërtetë) janë te `docs/PROVA-NE-TELEFON.md`.
- Prova tregonte vetëm gabimin e parë, pastaj ndalej → pjesët pas bazës (A–C) e shënojnë gabimin, e kthejnë app-in te Sot dhe vazhdojnë; një nisje tregon të gjitha gabimet. `skip` te "Run workflow" (ose `SMOKE_SKIP`) kapërcen pjesët që nuk preken.
- v1 ndërtohej nga tag-u në çdo nisje (4 min), edhe pse nuk ndryshon kurrë → APK-ja e v1 ruhet në cache sipas tag-ut. `actions/cache` e ruan vetëm kur puna mbaron e gjelbër: pas një çelësi të ri, nisja e parë e gjelbër e mbush. APK-ja e ruajtur pa çelësin debug me të cilin u nënshkrua e prishi përditësimin v1 → v2 (çdo runner ka çelës debug tjetër) → workflow-i krijon vetë çelësin debug të provës dhe e ruan te `apks/` me v1; një hap krahason nënshkrimet e v1, v2 dhe v3 para emulatorit, që gabimi të dalë në minutën e 6-të, jo në të 15-tën. Çelësi te `~/.android/debug.keystore` nuk u përdor nga Gradle në runner (kontrolli i nënshkrimeve e tregoi në minutën e 3-të) → çelësi i jepet Gradle-s drejtpërdrejt me `-Pandroid.injected.signing.*`, edhe v1-it të tag-ut, dhe nënshkrimet krahasohen me gjurmën e çelësit të provës.
- Home gjatë regjistrimit të videos: WebView-ja e Android-it nuk e dha `visibilitychange` dhe kamera vazhdoi të regjistronte në sfond → gjendja përpara/sfond vjen vetëm nga `onAppVisibility` (`lib/app-visibility.ts`: visibilitychange + pause/resume i Capacitor-it), jo nga `visibilitychange` vetëm.
- Ekrani i kyçur i sapozgjuar nuk i tregon menjëherë njoftimet; butoni kërkohej një herë dhe prova dështonte rastësisht → elementet e ekranit priten me `waitFor`, nuk kërkohen një herë. E njëjta për gjendjen native pas një prekjeje (SharedPreferences që shkruan receiver-i): lexohet me `waitFor`.
- Kur një pjesë dështon, njoftimet e saj mbeten ("Pushimi mbaroi") dhe e shtyjnë njoftimin e seancës poshtë, i palosur → pjesa që prek rreshtin e muzikës fsheh (snooze) njoftimet e tjera të app-it para se të nisë; çdo pjesë i përgatit vetë kushtet që i duhen.
- Rikujtuesi i provës, i vendosur drejt te plugin-i, zëvendësohej nga planifikimi i vetë app-it (hapja, sinkronizimi, prekjet e zbatuara) para se procesi të vritej → prova pret që lista të mos ndryshojë 4 s, vret procesin menjëherë pas planifikimit dhe e kontrollon listën pas vrasjes. Kur app-i jeton, dëgjuesi e zbaton prekjen menjëherë: rezultati kontrollohet te baza, jo te radha.
- Pjesa e rikujtuesve priste PIN-in nga pjesa e njoftimit; kur ajo u kapërcye me `skip`, ekrani nuk u kyç dhe prova dështoi → një pjesë me ekran të kyçur thërret vetë `ensurePin()`; një pjesë e re provohet edhe e vetme, me të tjerat të kapërcyera.
- Prova qëndroi 33 min pa dalë pas një hapjeje të app-it: `fetch` te socket-i i WebView-së dhe hapja e WebSocket-it nuk kishin afat, dhe `waitFor` nuk e ndalon një thirrje që nuk kthehet kurrë → çdo pritje jashtë (fetch, WebSocket, adb) ka afatin e vet; `waitFor` mat vetëm ciklin.
- WebView-ja e nisur për herë të parë pas ndezjes së emulatorit nuk iu përgjigj CDP-së brenda 15 s ("Log.enable pa përgjigje") → lidhja me WebView-në provohet deri në 3 herë dhe përpjekjet shënohen te raporti.
- Prova kapi defekte të vërteta native (numrat nga JS-i si Long, jo Integer) → provat native shkruhen me numra që vijnë nga JS-i, jo vetëm me Integer.

## Provat (Vitest)

- Gjithë provat (>1 000) varen më shumë se 600 s kur një gabim runtime bllokon një ekran → pas një merge nis fillimisht provat e skedarëve të prekur, pastaj të gjitha.
- Prova që varet nga rreshti i lënë nga prova e mëparshme (`form-video.test`) → çdo provë pastron tabelat që lexon (`db[table].clear()`), fixture-t kanë të gjitha fushat që lexon ekrani.
- Prova që dështon vetëm kur punojnë disa agjentë njëkohësisht → nis vetëm atë skedar përsëri para se ta quash gabim; afatet jetojnë te `src/test/setup.ts` dhe `vite.config.ts`, jo te secila provë.

- `program-import.test` dështonte rastësisht: kontrollonte thirrjen e AI-së menjëherë pas gjendjes "AI po e lexon", që del para thirrjes → një thirrje async pritet me `vi.waitFor`, nuk supozohet nga gjendja e ekranit.

- Një ekran me skelet (kreu del para të dhënave) dështonte rastësisht: `findByRole` gjente kreun e skeletit, që zëvendësohej menjëherë → prova pret fillimisht një element që vjen nga baza, pastaj kontrollon kreun.

## Bashkimet (merge) e degëve paralele

- Çelësa të dyfishtë te `icon-paths-vrull.ts` (TS1117) dhe një rresht i humbur te `session.tsx` (`lastSlot`) pas merge-ve → pas çdo merge: `tsc`, pastaj provat e skedarëve në konflikt, pastaj të gjitha.
- Konflikte te `docs/SPEC.md` → zgjidhen duke mbajtur shtesat e të dyja anëve (word-diff), jo një anë.

## Logjika

- Dy shkrime në të njëjtin milisekondë humbnin gjatë sinkronizimit → `updated_at` rritet gjithmonë (`nextTimestamp`); çdo defekt sinkronizimi fillon me provën që dështon.
- "Rekord +105 kg" te pulpat pa e1RM të mëparshme → rregulli jeton në një vend (`e1rmRecord`), jo në filtra te çdo ekran.

## Supabase

- `apply_migration` me `drop policy`/`revoke` u anulua automatikisht → migrime të tilla i jepen përdoruesit si skedar SQL për SQL Editor që në fillim.
- Edhe një `alter table … add column` me `apply_migration` u refuzua (09.11.2026, baza e prodhimit) → çdo migrim i ri i jepet përdoruesit si skedar te `supabase/migrations/` për SQL Editor, ose aplikohet vetëm pasi ai e lejon shprehimisht; asnjë lëshim nuk shkon para se migrimi të jetë në Supabase, sepse sinkronizimi i rreshtave me kolonat e reja refuzohet.
- Historia e migrimeve merrte orën e aplikimit si version → pas aplikimit, versioni dhe emri vendosen sipas skedarit lokal.
- Prova e RLS-it me MCP: `format('%s', boolean)` jep `t`/`f`, jo `true`/`false` → numëro sipas `t`/`f`; prova niset si një bllok `do` që mbaron me `raise exception`, që asgjë të mos mbetet në bazë.

## Rishikimi i kodit

- Kufiri i kostos së AI-së kontrollohej para thirrjes dhe kostoja shkruhej pas saj (deri në 140 s): kërkesa paralele e kapërcenin pa fund → çdo kufi që mbron para rezervon para se të nisë punën (`program-import/handler.ts`); prova nis 50 kërkesa njëkohësisht dhe kontrollohet me mutacion (pa rezervim, prova duhet të bjerë).
- Edge Functions nuk kishin kontroll tipesh (Deno nuk është në ambient) → `tsc -p supabase/functions/tsconfig.json` me `deno-shim.d.ts` është pjesë e `npm run lint`; logjika e funksionit rri në module pa Deno, që Vitest t'i provojë.
- Një cikël sinkronizimi lexonte çdo video të telefonit në kujtesë → mbi tabelat me skedarë, kërkimet bëhen me indekset dhe skedari lexohet vetëm kur duhet, një nga një.
- Dy vendime njëkohësisht krijonin dy rreshta me id të rastit, që indeksi unik i serverit i refuzonte përgjithmonë → rreshtat që kanë një çelës natyror unik marrin id nga ai çelës (`weekWeightId`). Një id nga çelësi natyror bie mbi rreshtin e fshirë (fshirja është e butë) → `store.put(..., { revive: true })` e kthen; prova e plotë e kapi, provat e skedarit jo.
- Provat që imitojnë kthimin në app me një `visibilitychange` "visible" pa "hidden" para tij nuk janë realiste → kthimi provohet me të dy hapat (`backFromSettings` te `music.test.tsx`).
- Pranimi i importit me AI u provua vetëm me një fixture të plotë; me PDF-në e vërtetë dhe `effort: low` AI-ja ktheu 4 nga 9 slotet e ditës së parë (13 nga 66 ushtrime) → çdo veçori me AI provohet me të dhënat e vërteta para lëshimit (`scripts`/prova me përdorues të përkohshëm), jo vetëm me fixture. Me `medium` dhe udhëzimin për plotësinë: 9/10/7/8 slote, 67 ushtrime, 86 s, €0,25.

- Prova e kalimit nga v1 krijon të dhënat e v1 me kodin e v2 mbi bazën e v1; kur një lexim i zakonshëm (objektivat te `logTemplateMeal`) nisi të lexonte tabelën e re `weekly_checks`, prova ra pa faj të app-it → faza v1 përdor `v1StoreFor`, që tabelat që v1 nuk i kishte i lexon bosh.
- Prova e Android-it ra në 01:22 UTC te "Ushqimi tregon vaktin e v1": dita e ushqimit (V46) ndërrohet 3 orë para zgjimit, ndaj para saj Ushqimi tregon ditën e djeshme → kontrollet që varen nga ora e ditës e llogaritin vetë ditën e ushqimit (`foodDayIsYesterday` te android-smoke.mjs).
- Një `<input>` brenda fletës (`Sheet`, kolonë flex me `min-h-0` dhe scroll) u ngushtua në 21 px kur lista ishte e gjatë: fushat dhe kontrollet me lartësi fikse brenda fletës marrin `shrink-0`; QA në 390 px (prekjet nën 44 px) e kap.
- Fshirja e përdoruesit të provës me `execute_sql` kërkon konfirmimin e përdoruesit; kur ai nuk ishte aty, përdoruesi mbeti → përdoruesi i përkohshëm krijohet vetëm kur përdoruesi është i pranishëm, dhe SQL-ja e fshirjes i jepet gati që ta zbatojë vetë nëse konfirmimi nuk vjen.
- Rishikimi i 0.21 gjeti defekte që provat nuk i kapnin, sepse provonin një gjendje, jo një ndryshim mes dy gjendjeve: butoni i njoftimit kërkonte rikujtuesin sipas id-së te lista, por plani i ri u jep id-të të tjerëve dhe shtyrja që ra hiqet nga lista e saj → një buton vepron mbi atë që njoftimi tregon (`shown` te `ReminderNotifier`), jo mbi atë që lista ka tani; një rregull "një herë në ditë" provohet edhe me një planifikim të dytë pas pikës së parë.
- Një fletë që ndryshon një vlerë (ora e stërvitjes te Cilësimet) rishkruante gjithë fushën (`training_times` për çdo ditë) dhe fshinte orët e veçanta që ruante një ekran tjetër (Oraret e vakteve) → një ruajtje shkruan vetëm atë që përdoruesi ndryshoi; kur dy ekrane shkruajnë të njëjtën fushë, prova ruan nga njëri dhe lexon nga tjetri.
- Proteina me "Numëroje te ushqimi" dhe pluhuri i planit numëroheshin dy herë → një sasi që mund të vijë nga dy rrugë (plani, suplementi) ka një rregull të vetëm që vendos kush e numëron (`mealPowder`), me provë për të dy radhët.
- Vlerat që llogarit telefoni (mirëmbajtja e kontrollit javor) mund të dalin jashtë `check`-ut të serverit dhe rreshti refuzohej përgjithmonë → çdo vlerë e llogaritur që shkon te një kolonë me kufij kontrollohet para shkrimit (bosh kur del jashtë), me provë me të dhëna ekstreme.

## AI-ja

- Kutia e AI-së (log-parse, 09.11.2026), me AI-në e vërtetë: me Haiku 5.5 dhe `effort: low` mesazhi i parë kushtoi 0,001 € (cache-i shkruhet, ~1 200 tokena dalje), i njëjti kontekst pas tij 0,0001–0,0006 € (cache-i lexohet, 4 175 tokena). Përgjigja te pyetja ("dy feta") ktheu vetëm rreshtin e përgjigjur → udhëzimi e kërkon shprehimisht, dhe app-i e bashkon me draftin sipas emrit; zgjedhjet (1/2/3 feta) plotësohen në telefon pa thirrje të re.
- `npx prettier --write` pa konfigurim (repo-ja nuk ka Prettier) i ktheu skedarët në thonjëza dyshe me pikëpresje dhe rreshta 80 → mos e nis; stili i repo-s (pa pikëpresje, thonjëza teke, rreshta të gjatë) mbahet me dorë, oxlint e kontrollon.
- Shembulli i udhëzimeve kishte vetëm kcal_100 për panetonen; AI-ja e kopjoi pa proteinë, karbohidrate e yndyrë dhe funksioni e hodhi ushqimin te "nuk e kuptova" → shembujt në prompt janë të plotë si skema; prova me AI-në e vërtetë niset pas çdo ndryshimi të udhëzimeve (`ONLY=1,10 node scripts/ai-box-trial.mjs`, vetëm rastet e prekura).
