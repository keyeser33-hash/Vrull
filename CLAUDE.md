# Training Hub

App personal Android për palestrën (Shortcut to Size, ushqimi, matjet, modeli 3D). Një përdorues, funksionon pa internet, sinkronizon me Supabase.

## Burimet

- `docs/SPEC.md`: e vërteta për çfarë ndërtohet. Çdo ndryshim vendimi shkruhet aty.
- `docs/TICKETS.md`: radha e detyrave dhe kriteret e pranimit.
- `DESIGN.md`: sistemi i dizajnit Vrull (tokenat, temat, komponentët). Lexoje para se të shkruash UI. Komponentët në tri temat: faqja e brendshme `/dev/ds`.
- `GLOSSARY.md`: fjalori i domenit (bllok, stërvitje, seancë, slot, receta, gatim…). Emrat e rinj në UI, specifikim dhe kod ndjekin atë.

## Komandat

- `npm run dev`: serveri lokal.
- `npm test`: Vitest (jsdom).
- `npm run lint`: oxlint + roja e dizajnit (`scripts/check-design.mjs`).
- `npm run build`: kontrolli i tipave + build.
- `node scripts/ds-screens.mjs <dosja>`: prova e pamjes së `/dev/ds` në 390 px me Chrome headless (pa scroll anësor, fontet pa rrjet, prekjet 44 px), shqip dhe anglisht, me pamjet e tri temave.
- `npx cap sync android`: kopjon `dist` te projekti Android (`android/`). APK-ja dhe Release-i: `docs/INSTALL.md`, pika 6.
- `E2E_EMAIL=… E2E_PASSWORD=… npx vitest run src/data/sync.e2e.test.ts`: sinkronizimi kundrejt Supabase të vërtetë, me një përdorues prove të përkohshëm (pa këto, prova kapërcehet).

## Rregullat

- Teksti i UI në shqip, sentence case, pa emoji dhe pa pikëçuditje. Emrat e ushtrimeve mbeten në anglisht.
- Ngjyrat vijnë vetëm nga tokenat e Vrullit te `src/styles/globals.css` (vlerat e `tokens.json`; `src/styles/tokens.test.ts` i krahason dhe mat kontrastin ≥ 4,5:1 në çdo temë). Asnjë hex, `rgb()`, paletë Tailwind ose variant `dark:` në komponentë; `npm run lint` dhe testet i kapin.
- `ember` (prushi) është sfondi i veprimit kryesor të ekranit ("Fillo stërvitjen", "Ruaj setin", "Mbyll stërvitjen"), një për ekran, me tekst `on-ember`; në ditë të lodhura `sand`. Prushi si tekst, ikonë ose vijë e hollë është `ember-text`.
- Aliaset e v1 (`card`, `panel`, `brand`…) mbeten vetëm te skedarët e `LEGACY_FILES` te `scripts/check-design.mjs`: kur një ekran kalon te Vrull, hiqet nga lista; kod i ri përdor vetëm tokenat dhe komponentët e Vrullit.
- Uppercase vjen vetëm nga stilet (`type-display-*`, `type-title`, `type-label`, butonat); teksti shkruhet në sentence case. Numrat me `tabular-nums`.
- Çdo gjë që preket ka 44 px; ekranet kontrollohen në 390 px pa scroll anësor dhe në tri temat OLED, Natë, Ditë (OLED është parazgjedhja).
- Lokale-së-pari: asnjë ekran nuk pret rrjetin.
- Logjika pa UI (motori i programit, e1RM, ushqimi) ndërtohet me teste përpara kodit.
- Çdo varësi e re verifikohet para instalimit (burimi, mirëmbajtja, licenca).

## Struktura

- `src/components/ui`: komponentët e Vrullit (Button, Stepper, ListRow, StatTile, InsightCard, FactCard, ProgressBar, WeekStrip, TabBar, RirPicker, QuickAdd, ikonat), sipas modelit shadcn (cva + `cn`). Shtohen me dorë: `npx shadcn` mos u përdor, sepse mbishkruan tokenat te `globals.css`.
- `src/components/layout`: korniza (`app-shell.tsx`: tab-bar-i, rripi "Pa internet", sfondi), kreu i pesë ekraneve kryesore me butonin e profilit (`screen-header.tsx`), `BackHeader` (`page.tsx`), grupet e rreshtave, fleta, gjendja bosh (DESIGN.md › Korniza).
- `src/routes`: ekranet. `src/router.tsx`: rrugët; çdo rrugë brenda kornizës thotë tab-in aktiv me `handle: { tab }` (`null` = pa tab-bar). Tab-et: `/`, `/programi`, `/ushqimi`, `/progresi` (Trupi: `/progresi/trupi`), `/miqte`; Cilësimet: `/cilesimet`, `/cilesimet/pamja`, `/cilesimet/rikujtuesit`. `routes/gate.tsx` është i vetmi vend që vendos rrugën sipas fazës (hyrja, marrja e të dhënave, hapat e para, app-i).
- `src/components/forms`, `src/components/ui/field.tsx`: fushat dhe zgjedhja e ditëve (të v1, me tokenat e Vrullit).
- `src/lib`: logjika e përbashkët (tema, `cn`, butoni mbrapa).
- `src/program`: logjika e programit pa UI dhe pa bazë: motori (`engine.ts`), Shortcut to Size si të dhëna, biblioteka e ushtrimeve (`library.json`, nga `tools/exercise-library/build.mjs`).
- `src/nutrition`: logjika e ushqimit pa UI: objektivat (Shtojca C), orari i vakteve (§13), shablloni i Jimit me makrot e ushqimeve.
- `src/reminders`: plani i rikujtuesve pa UI (§13); njoftimet në telefon: `lib/reminders-native.ts`.
- `src/update`: përditësimi brenda app-it pa UI (`updater.ts`); plugin-i native `AppUpdaterPlugin.java`, publikimi `scripts/publish-update.mjs` (SPEC §3b).
- `tools/anatomy`: pipeline-i i modelit 3D nga BodyParts3D (`public/anatomy/body.glb`); shikuesi: `components/body/body-model.tsx`, i ngarkuar me `lazy`.
- `src/data`: baza lokale (Dexie) dhe sinkronizimi. Ekranet lexojnë dhe shkruajnë vetëm përmes `store` nga `app-data.ts`; asnjë ekran nuk thërret Supabase direkt. Programi dhe stërvitjet: `training.ts`; editori: `program-editor.ts`; ushqimi: `nutrition.ts`. Një tabelë e re: migrim i ri, `TABLES` dhe `INDEXES` te `tables.ts` (testi i krahason me migrimet), dhe version i ri te `db.ts` kur ndryshojnë indekset.

## Tekstet në dy gjuhë

Tekstet e UI-së vijnë nga katalogu `src/i18n` (SPEC V22, §0.3a); ekranet që kanë mbetur kalojnë një nga një, me detyrën e secilit.

- Një tekst i ri: çelësi në shqip (burimi i çelësave, emri sipas vendit: `login.title`) dhe i njëjti çelës në anglishten britanike (Programme, yoghurt, litres). Zonat e Etapës 1 (Sot, seanca, programi, trupi, historiku, hyrja) kanë skedarin e tyre te `src/i18n/areas/`, me të dyja gjuhët; korniza dhe pjesa tjetër te `sq.ts` dhe `en.ts`. Zonë e re: skedar te `areas/`, i shtuar te `AREAS` dhe te bashkimet e `sq.ts`/`en.ts`. Tipet dhe `catalog.test.ts` kapin çelësin që mungon, parametrin ose çelësin e dyfishtë.
- Në komponentë: `const { t, fmt } = useI18n()` (`@/i18n/use-i18n`), që ndërrimi i gjuhës t'i rivizatojë; jashtë React-it: `currentI18n()` nga `@/i18n`.
- Parametrat: `'{count} sete'` me `t('x', { count })`. Një numër te parametri formatohet sipas gjuhës (62,5 / 62.5, 2 900 / 2,900); vitet dhe kodet jepen si tekst.
- Shumësi: mesazh me forma (`{ one, other }`, `'=0'`, `ordinal: true`), që rregullat e gjuhës zgjedhin formën.
- Numrat, njësitë, datat dhe orët me `fmt`: `fmt.unit(62.5, 'kg')` (hapësirë që nuk thyhet), `fmt.date(d)` ("e diel, 8 nëntor"), `fmt.time(d)` (24 orë). Chrome dhe WebView nuk e kanë shqipen në `Intl`; `format.ts` e plotëson.
- Emrat e ushtrimeve mbeten jashtë katalogut, në anglisht në të dyja gjuhët.
- Gjuha ruhet në telefon (`i18n/language.ts`) dhe te `user_settings.language` (`data/language.ts`), që sinkronizohet. Sfondi njësoj: `lib/background.ts` dhe `user_settings.background` (`data/background.ts`). Tema mbetet vetëm në telefon (`lib/theme.ts`), si te v1.
- Provat e një ekrani të kaluar kontrollojnë edhe anglishten: `language.set('en')`, dhe `language.set('sq')` në `afterEach`.
