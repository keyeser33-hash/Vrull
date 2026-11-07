# Training Hub

App personal Android për palestrën (Shortcut to Size, ushqimi, matjet, modeli 3D). Një përdorues, funksionon pa internet, sinkronizon me Supabase.

## Burimet

- `docs/SPEC.md`: e vërteta për çfarë ndërtohet. Çdo ndryshim vendimi shkruhet aty.
- `docs/TICKETS.md`: radha e detyrave dhe kriteret e pranimit.
- `DESIGN.md`: Omal UI v2. Lexoje para se të shkruash UI.

## Komandat

- `npm run dev`: serveri lokal.
- `npm test`: Vitest (jsdom).
- `npm run lint`: oxlint + roja e dizajnit (`scripts/check-design.mjs`).
- `npm run build`: kontrolli i tipave + build.
- `npx cap sync android`: kopjon `dist` te projekti Android (`android/`). APK-ja dhe Release-i: `docs/INSTALL.md`, pika 6.
- `E2E_EMAIL=… E2E_PASSWORD=… npx vitest run src/data/sync.e2e.test.ts`: sinkronizimi kundrejt Supabase të vërtetë, me një përdorues prove të përkohshëm (pa këto, prova kapërcehet).

## Rregullat

- Teksti i UI në shqip, sentence case, pa emoji dhe pa pikëçuditje. Emrat e ushtrimeve mbeten në anglisht.
- Ngjyrat vijnë vetëm nga tokenat e `src/styles/globals.css` (kopje e pandryshuar e Omal UI v2). Asnjë hex, `rgb()` ose `text-brand` në komponentë; `npm run lint` dhe testet i kapin.
- Përshtatja e DESIGN.md për këtë app: `brand` (amber) i përket veprimit kryesor të ekranit ("Fillo stërvitjen", "Ruaj setin", "Mbyll stërvitjen"), një për ekran. Rregullat e "Rezervo" dhe të parave te DESIGN.md nuk vlejnë këtu.
- Çdo gjë që preket ka 44 px; ekranet kontrollohen në 390 px pa scroll anësor dhe në tri temat (OLED është parazgjedhja).
- Lokale-së-pari: asnjë ekran nuk pret rrjetin.
- Logjika pa UI (motori i programit, e1RM, ushqimi) ndërtohet me teste përpara kodit.
- Çdo varësi e re verifikohet para instalimit (burimi, mirëmbajtja, licenca).

## Struktura

- `src/components/ui`: komponentët e Omal UI v2 (ikonat, butonat), sipas modelit shadcn (cva + `cn`). Shtohen me dorë: `npx shadcn` mos u përdor, sepse mbishkruan tokenat te `globals.css`.
- `src/components/layout`: korniza, navigimi poshtë, kokat e faqeve.
- `src/routes`: ekranet. `src/router.tsx`: rrugët; `routes/gate.tsx` është i vetmi vend që vendos rrugën sipas fazës (hyrja, marrja e të dhënave, hapat e para, app-i).
- `src/components/forms`, `src/components/ui/field.tsx`: fushat dhe zgjedhja e ditëve sipas Omal UI v2.
- `src/lib`: logjika e përbashkët (tema, `cn`, butoni mbrapa).
- `src/program`: logjika e programit pa UI dhe pa bazë: motori (`engine.ts`), Shortcut to Size si të dhëna, biblioteka e ushtrimeve (`library.json`, nga `tools/exercise-library/build.mjs`).
- `src/nutrition`: logjika e ushqimit pa UI: objektivat (Shtojca C), orari i vakteve (§13), shablloni i Jimit me makrot e ushqimeve.
- `src/reminders`: plani i rikujtuesve pa UI (§13); njoftimet në telefon: `lib/reminders-native.ts`.
- `src/data`: baza lokale (Dexie) dhe sinkronizimi. Ekranet lexojnë dhe shkruajnë vetëm përmes `store` nga `app-data.ts`; asnjë ekran nuk thërret Supabase direkt. Programi dhe stërvitjet: `training.ts`; editori: `program-editor.ts`; ushqimi: `nutrition.ts`. Një tabelë e re: migrim i ri, `TABLES` dhe `INDEXES` te `tables.ts` (testi i krahason me migrimet), dhe version i ri te `db.ts` kur ndryshojnë indekset.
