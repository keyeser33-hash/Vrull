# Mësimet nga gabimet

Çdo gabim që kushton kohë shkruhet këtu, me rregullin që e shmang herën tjetër. Lexoje para një detyre të re; shto një rresht kur një gabim përsëritet ose kur një provë dështon për arsye që nuk ishte te app-i.

Formati: **çfarë ndodhi** → **rregulli**.

## Prova e Android-it (emulatori te GitHub Actions)

- Prova e plotë zgjat ~15 min dhe nisej nga e para për çdo ndreqje të vogël (16 nisje të kuqe për një degë) → prova ndahet në pjesë (`--stage`); pas një dështimi niset vetëm pjesa që dështoi, prova e plotë vetëm në fund.
- Prova te `main` mbeti e kuqe që nga vala A, sepse UI ndryshoi te Vrull dhe skripti kërkonte ende tekstet e v1 → kur ndryshon një ekran që prova e prek, skripti ndryshon në të njëjtin ndryshim; prova nuk niset në çdo push te `main`, vetëm me dorë dhe para lëshimit.
- Rreshtat `ERROR: could not get idle state` vijnë nga uiautomator gjatë animacioneve → nuk janë shkaku; shkaku është rreshti `Error:` i fundit.
- Disa gjëra emulatori nuk i bën besueshëm (kamera virtuale me Home, Spotify, telefon i vërtetë i kyçur) → kalojnë te lista e provës në telefon, jo në cikle të pafundme në CI.
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
