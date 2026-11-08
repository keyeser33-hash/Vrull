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
- Ekrani i kyçur i sapozgjuar nuk i tregon menjëherë njoftimet; butoni kërkohej një herë dhe prova dështonte rastësisht → elementet e ekranit priten me `waitFor`, nuk kërkohen një herë.
- Kur një pjesë dështon, njoftimet e saj mbeten ("Pushimi mbaroi") dhe e shtyjnë njoftimin e seancës poshtë, i palosur → pjesa që prek rreshtin e muzikës fsheh (snooze) njoftimet e tjera të app-it para se të nisë; çdo pjesë i përgatit vetë kushtet që i duhen.
- Prova kapi defekte të vërteta native (numrat nga JS-i si Long, jo Integer) → provat native shkruhen me numra që vijnë nga JS-i, jo vetëm me Integer.

## Provat (Vitest)

- Gjithë provat (>1 000) varen më shumë se 600 s kur një gabim runtime bllokon një ekran → pas një merge nis fillimisht provat e skedarëve të prekur, pastaj të gjitha.
- Prova që varet nga rreshti i lënë nga prova e mëparshme (`form-video.test`) → çdo provë pastron tabelat që lexon (`db[table].clear()`), fixture-t kanë të gjitha fushat që lexon ekrani.
- Prova që dështon vetëm kur punojnë disa agjentë njëkohësisht → nis vetëm atë skedar përsëri para se ta quash gabim; afatet jetojnë te `src/test/setup.ts` dhe `vite.config.ts`, jo te secila provë.

## Bashkimet (merge) e degëve paralele

- Çelësa të dyfishtë te `icon-paths-vrull.ts` (TS1117) dhe një rresht i humbur te `session.tsx` (`lastSlot`) pas merge-ve → pas çdo merge: `tsc`, pastaj provat e skedarëve në konflikt, pastaj të gjitha.
- Konflikte te `docs/SPEC.md` → zgjidhen duke mbajtur shtesat e të dyja anëve (word-diff), jo një anë.

## Logjika

- Dy shkrime në të njëjtin milisekondë humbnin gjatë sinkronizimit → `updated_at` rritet gjithmonë (`nextTimestamp`); çdo defekt sinkronizimi fillon me provën që dështon.
- "Rekord +105 kg" te pulpat pa e1RM të mëparshme → rregulli jeton në një vend (`e1rmRecord`), jo në filtra te çdo ekran.

## Supabase

- `apply_migration` me `drop policy`/`revoke` u anulua automatikisht → migrime të tilla i jepen përdoruesit si skedar SQL për SQL Editor që në fillim.
- Historia e migrimeve merrte orën e aplikimit si version → pas aplikimit, versioni dhe emri vendosen sipas skedarit lokal.
- Prova e RLS-it me MCP: `format('%s', boolean)` jep `t`/`f`, jo `true`/`false` → numëro sipas `t`/`f`; prova niset si një bllok `do` që mbaron me `raise exception`, që asgjë të mos mbetet në bazë.
