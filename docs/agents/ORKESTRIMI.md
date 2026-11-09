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
   Hapi mbaron kur `npm test` kalon dhe çdo agjent ka ku të shtojë pa krijuar.
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
   Orkestruesi pret me `gh run watch <id> --exit-status` në sfond. Kur prova bie, niset `vrull-ci-reader` dhe përsëritet vetëm pjesa që ra. Prova e plotë niset vetëm para lëshimit.
9. **Mbyllja e valës.** Gjendja shkruhet te `docs/TICKETS.md`, dhe çdo gabim që kushtoi kohë shkruhet te `docs/MESIMET.md`.

## Forma e brief-it

```
Detyra: <ID> · <një fjali>
Lexo vetëm: SPEC §<x> (rreshtat a–b), TICKETS <ID>, DESIGN.md › <seksioni>, GLOSSARY: <termat>, bordet: <emrat>
Vendimet e ngrira: <Vxx: një rresht secili>
Ekzistojnë tashmë: <ndihmësit dhe komponentët, me shtegun>
Skedarët e orkestruesit: <hyrjet e regjistruara te i18n, router, tables>
Provat: <skedarët>; prova e Android-it prek: <pjesët ose "asgjë">
Commit-et mbarojnë me: <rreshtat e atribuimit të sesionit>
Raporti: deri në 300 fjalë
```

## Lëshimi

Një version i ri del vetëm në fund të etapës, me miratimin e përdoruesit. Para tij migrimet duhet të jenë në Supabase (SQL Editor) dhe të verifikuara me SELECT. Hapat: `docs/INSTALL.md`, pika 6. Push-i i një tag-u nga sesioni refuzohet (403). Lëshimi niset me versionin te `package.json` në `main`.

## Kostot

- Actions: plani Free jep $12 në muaj (~2 000 minuta Linux), me rinisje më 1 të muajit. Një provë e plotë kushton 16–19 min, dhe një lëshim rreth 24.
- Tokenat: agjenti nis bosh dhe paguan kontekstin e vet, ndaj brief-i jep §-të, jo SPEC-un e plotë (142 KB). Cache-i i agjentit skadon pas 5 minutash, ndaj pritjet e gjata i mban orkestruesi.
