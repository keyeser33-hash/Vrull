# Orkestrimi i një etape

Si ndërtohet një etapë e Vrull me nënagjentë: nga bordet e miratuara te lëshimi. Lexoje para se të nisësh agjentë. Parimi është te SPEC §0.1 ("Orkestruesi me nënagjentë") dhe vendimi te V48. Arsyet dhe matjet janë te `docs/research/optimizimi-i-ndertimeve.md`.

## Rolet dhe modeli

| Roli | Agjenti (`subagent_type`) | Modeli |
|---|---|---|
| Orkestruesi: plani, skedarët e përbashkët, bashkimet, vendimet | sesioni kryesor | Opus |
| Një tiket në worktree | `vrull-builder` | Sonnet; `model: opus` vetëm për një tiket me arkitekturë të re |
| Akset Standards dhe Spec, validatori i gjetjeve | `vrull-reviewer` | Sonnet |
| Aksi Adversarial | `vrull-adversary` | Opus |
| Një nisje e dështuar e Actions | `vrull-ci-reader` | Haiku |
| Kërkim ose inventar me shumë skedarë | `Explore` | Haiku me `model: haiku` |

Një fork përdoret për një detyrë anësore që i duhet biseda e tanishme. Një agjent i ri përdoret për punë të veçuar me brief.

## Hapat e një vale

1. **Plani.** Ndaj tiketat e etapës në valë. Për çdo tiket shëno skedarët që prek. Dy tiketa që prekin të njëjtin skedar shkojnë në valë të ndryshme, ose i bashkon një agjent. Hapi mbaron kur çdo skedar i prekur ka një pronar.
2. **Skeleti i valës.** Orkestruesi bën vetë një commit te `main` me pjesët e përbashkëta, dhe vetëm pastaj nisen agjentët:
   - zonat `i18n` (skedari te `areas/`, `AREAS`, bashkimet e `sq.ts`/`en.ts`);
   - rrugët te `router.tsx`;
   - migrimet bashkë me `TABLES`/`INDEXES` dhe versionin e `db.ts`;
   - komponentët që i duhen më shumë se një tiketi.
   Skeleti merr push para nisjes, sepse worktree-t e agjentëve mund të nisin nga dega në server. Hapi mbaron kur `npm test` kalon, skeleti është te `origin/main`, dhe çdo agjent ka ku të shtojë pa krijuar.
3. **Brief-i.** Një për çdo agjent, me formën e mëposhtme. Hapi mbaron kur brief-i emërton çdo § të SPEC-ut që i duhet tiketit dhe çdo ndihmës që ekziston për të.
4. **Nisja.** Agjentët `vrull-builder` nisen paralelisht, deri në 5, në sfond. Ndërkohë orkestruesi përgatit valën tjetër ose QA-në.
5. **Bashkimi.** Degët bashkohen një nga një (aftësia `resolving-merge-conflicts`). Pas çdo bashkimi nisen `tsc` dhe provat e skedarëve në konflikt. Në fund nisen `npm run lint`, `npm test` dhe `npm run build`. Hapi mbaron kur të tria janë të gjelbra te `main` lokal.
6. **Rishikimi sipas rrezikut.**
   - Vala prek sinkronizimin, bazën, native-n, AI-në ose ka mbi ~1 500 rreshta: aftësia `code-review` me tri akse (`vrull-reviewer` ×2, `vrull-adversary`) dhe validatorin `vrull-reviewer`.
   - Vala tjetër: një `vrull-reviewer` me akset Standards dhe Spec bashkë.
   Hapi mbaron kur çdo gjetje P0–P2 ka një provë që bie pa rregullimin dhe rregullimin.
7. **Push-i.** Një push te `main` në fund të valës, pasi hapi 5 ka kaluar lokalisht. Dokumentet nuk e nisin CI-në.
8. **Prova e Android-it.** CI-ja kontrollon tekstet e skriptit (`src/test/smoke-texts.test.ts`). Emulatori niset vetëm kur vala prek native-n ose një ekran që prova e prek, dhe vetëm për pjesët e prekura:
   `gh workflow run android-smoke.yml -R keyeser33-hash/Vrull -f skip=<pjesët e paprekura>`
   Para nisjes: `node scripts/actions-usage.mjs --month --check <minutat e pjesëve, 20 për provën e plotë>`. Kur del me kodin 1, prova nuk niset: orkestruesi i tregon përdoruesit minutat që mbeten (Kostot).
   Orkestruesi pret me `gh run watch <id> --exit-status` në sfond. Kur prova bie, niset `vrull-ci-reader` dhe përsëritet vetëm pjesa që ra. Pas dy rënieve të së njëjtës pjesë, e treta nuk niset pa shkakun nga artifact-i (pamja e ekranit, logcat-i, `report.json`). Prova e plotë niset vetëm para lëshimit, dhe atë e nis vetë lëshimi; një provë e plotë me dorë menjëherë para tij paguhet dy herë.
9. **Retro.** Mblidh dështimet e valës:
   - nisjet e kuqe (`gh run list -R keyeser33-hash/Vrull --created ">=<data>" --status failure`);
   - gjetjet P0–P2 të rishikimit;
   - korrigjimet e përdoruesit;
   - "Mësimet" e raporteve të agjentëve.
   Për secilin dështim:
   - kur nuk ka mësim te `docs/MESIMET.md`, shto një rresht;
   - kur mësimi ekzistonte, ngjite një shkallë (MESIMET, krye).
   Shkruaj gjendjen te `docs/TICKETS.md` dhe një rresht te `docs/agents/KOSTOT.md`:
   - tokenat e agjentëve (shuma e `subagent_tokens`);
   - minutat (`node scripts/actions-usage.mjs --since <data>`);
   - provat e Android-it;
   - gjetjet;
   - rojet e reja.
   Hapi mbaron kur çdo dështim ka mësimin ose rojën e vet.

## Forma e brief-it

```
Detyra: <ID> · <një fjali>
Lexo vetëm: SPEC §<x> (rreshtat a–b), TICKETS <ID>, DESIGN.md › <seksioni>, GLOSSARY: <termat>, bordet: <emrat>
Vendimet e ngrira: <Vxx: një rresht secili>
Ekzistojnë tashmë: <ndihmësit dhe komponentët, me shtegun>
Skedarët e orkestruesit: <hyrjet e regjistruara te i18n, router, tables>
Provat: <skedarët>; prova e Android-it prek: <pjesët ose "asgjë">
Para fillimit: `git log --oneline -3` duhet të tregojë <commit-in e skeletit>; përndryshe `git merge --ff-only origin/main`
Shkrimi: Write/Edit dhe komanda të thjeshta (worktree-ja refuzon heredoc-et e përbëra)
Commit-et mbarojnë me: <rreshtat e atribuimit të sesionit>
Raporti: deri në 300 fjalë, me "Mësimet": çfarë kushtoi kohë dhe pse, deri në 3 rreshta
```

## Mbyllja e etapës

Para versionit të fundit të etapës lexo `docs/MESIMET.md` të tërë:
- shkurto rreshtat që kanë rojë;
- bashko rreshtat që thonë të njëjtën gjë;
- hiq ato që nuk vlejnë më.
Krahaso rreshtat e `docs/agents/KOSTOT.md` me etapën e kaluar. Kur një kosto rritet, shkaku shkruhet si mësim.

## Lëshimi

Një version i ri del vetëm në fund të etapës, me miratimin e përdoruesit. Para tij migrimet duhet të jenë në Supabase (SQL Editor) dhe të verifikuara me SELECT. Hapat: `docs/INSTALL.md`, pika 6. Push-i i një tag-u nga sesioni refuzohet (403). Lëshimi niset me versionin te `package.json` në `main`, pasi `node scripts/actions-usage.mjs --month --check 30 --release` del me kodin 0 (lëshimi përdor rezervën prej 60 minutash që kontrollet e tjera nuk e prekin). Release-i kontrollohet me `gh api repos/keyeser33-hash/Vrull/releases/tags/vX.Y.Z`, sepse `gh release view` përdor GraphQL, që sesioni e refuzon.

## Kostot

- Actions: plani Free jep $12 në muaj (~2 000 minuta Linux), me rinisje më 1 të muajit. Pa një mënyrë pagese, kur mbarojnë Actions ndalet deri në muajin tjetër. Një provë e plotë kushton 16–19 min, një lëshim 24–30, dhe një nisje e CI-së 3–4.
- Gjendja e muajit: `node scripts/actions-usage.mjs --month` (vlerësim; fatura është te Settings › Billing › Usage). Kur minutat mbeten pak, një push që nuk prek app-in (skriptet, mjetet), i kontrolluar lokalisht me `npm run lint`, merr `[skip ci]` te mesazhi i commit-it. Kur nuk mjaftojnë as për lëshimin, vendimi i takon përdoruesit: pritet muaji tjetër, ose shtohet një mënyrë pagese me kufi.
- Tokenat: agjenti nis bosh dhe paguan kontekstin e vet, ndaj brief-i jep §-të, jo SPEC-un e plotë (142 KB). Cache-i i agjentit skadon pas 5 minutash, ndaj pritjet e gjata i mban orkestruesi.
