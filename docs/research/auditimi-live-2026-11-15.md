# Auditimi live i Vrull (15.11.2026, versioni 0.24.0)

Shenjat: [V] parë live ose në kod, [S] gjykimi im, [A] nga auditimi statik i agjentit (`docs/research/auditimi-statik.md`, me file:line). Rëndësia: P1 e prishur ose e gabuar për përdoruesin, P2 e papërfunduar ose e pa-njëtrajtshme, P3 lustrim.

## Si u bë

- Build-i i app-it nga `main`, me Supabase-n e imituar si te prova e Android-it (`VITE_SUPABASE_URL=https://smoke.invalid`, përgjigjet e imituara nga një skript në faqe). Asnjë kërkesë nuk arriti te projekti i vërtetë.
- Chrome pa ekran në kontejner, 390 × 844, zona kohore e Tiranës. U kaluan:
  - hapat e parë;
  - "Si në plan" te Ushqimi, dy gota ujë, gjendja e ditës, fillimi i stërvitjes dhe seanca;
  - 33 rrugë × 3 tema × 2 gjuhë (198 pamje).
- Kontrollet automatike në çdo pamje: shiriti anësor, prekjet nën 44 px, teksti shqip kur gjuha është anglisht, gabimet e konsolës.
- Shfletuesi i brendshëm u përdor për bordet e kanavacës. Build-i i app-it nuk u publikua si artifakt që të hapej atje, sepse nuk mund ta lexoja të gjithë (6,9 MB, 200 skedarë) para publikimit.

## Çfarë është në rregull [V]

- Asnjë shirit anësor, asnjë gabim konsole dhe asnjë prekje nën 44 px në 198 pamjet; elementet 1 × 1 px janë input-e të fshehura brenda etiketave.
- Anglishtja është e plotë: asnjë tekst shqip në 32 ekranet; përjashtim `/dev/ds`, faqe e brendshme.
- Tema Ditë dhe Natë vizatohen pa probleme te Sot, Programi, Ushqimi, Progresi dhe Cilësimet.
- Çdo rrugë hapet; lidhjet e brendshme të gjitha çojnë diku [A].

## Gjetjet

| # | Gjetja | Rëndësia | Ku |
|---|---|---|---|
| 1 | Fushat e orës te Oraret e vakteve janë të prera ("07:(", "11:(") dhe tregojnë "06:00 PM" në një app me 24 orë | P1 | `meal-times.tsx:169,243,259`; edhe `settings-reminders.tsx:157` [V] |
| 2 | Një adresë e gabuar tregon "Unexpected Application Error! 404 Not Found", anglisht dhe pa stil | P2 | `App.tsx:4`, `router.tsx` pa `errorElement` [V][A] |
| 3 | Dy "Java" në të njëjtin ekran: kreu "Java 0" (programi), rripi "Java 1" (qëllimet); te Programi "JAVA 0" dhe "java 1 nga 13" | P2 | Sot, Qëllimet, Programi, editori [V] |
| 4 | Uji: Sot "2,75 L", Qëllimet "2,8 L" dhe "3,3 L" për të njëjtin objektiv | P2 | `week-goals.tsx:101` (1 dhjetore) [V] |
| 5 | Pesha te hapi 1 ("80,0") dhe viti i lindjes ("1996") duken si vlera, por janë shembuj; "Vazhdo" jep gabim | P2 | hapat e parë, Objektivat [V] |
| 6 | Tab-et e Progresit: Trupi dhe Historiku hapen me shigjetë mbrapa dhe titull tjetër, Përmbledhja dhe Arritjet si faqe kryesore | P2 | Progresi [V] |
| 7 | Tre lloje kreu (titull i madh; titull i vogël në mes te "Importo nga PDF" dhe "Programi · Struktura"; Kutia) dhe katër shigjeta mbrapa | P2 | [V][A D2] |
| 8 | "Fillo stërvitjen e parë" çaktivizohet pa shenjë gjatë fillimit; në shfletues pa leje njoftimesh nuk vazhdon kurrë, me leje zgjat 4–6 s | P2 | `today.tsx:195–205, 259` [V; koha mbetet për t'u matur në telefon] |
| 9 | Seti i parë nis me 0 kg dhe "Ruaj setin" është aktiv | P2 | seanca [V] |
| 10 | Faqja e ditës së programit (Stërvitja 1) nuk ka "Fillo" | P2 | `/programi/:block/:week/:day` [V] |
| 11 | "Sipas matjeve" është pothuajse bosh: një kartë dhe një buton, pa modelin | P2 | `/progresi/trupi/matjet` [V] |
| 12 | Paketa kryesore e JS 824 kB, mbi rojën 800 kB të `vite.config.ts` | P2 | build [V] |
| 13 | Dy butona prush mund të dalin bashkë te Sot (dita e humbur dhe fillimi) | P2 | `today.tsx`, `missed-day-card.tsx:54` [A; nuk u pa live] |
| 14 | V14, V30, V31 pa tiket; V7, V12, V16, V26, V45 vetëm me borde | P2 | `TICKETS.md` [A] |
| 15 | Pas gotës së ujit, totali ndryshon pas 1,5–3 s dhe njoftimi tregon fillimisht totalin e vjetër | P2 | Sot [V në kontejner; duhet matur në telefon] |
| 16 | Karta thotë "Katër pyetje", fleta ka pesë rreshta (edhe orët e gjumit) | P3 | Gjendja e ditës [V] |
| 17 | "Hapat 2 dhe 3 nga 5" në një ekran | P3 | hapat e parë [V] |
| 18 | "Fotot e progresit" përsëritet si titull dhe si titull seksioni | P3 | `/progresi/fotot` [V] |
| 19 | Shkurtimet e arritjeve nuk kuptohen ("U7" ushqimi, "L7" uji) | P3 | Arritjet [V] |
| 20 | Të fundit te Shto ushqim tregojnë kcal për 100 g, jo për porcion (e zgjidh 0.42) | P3 | `add-food.tsx` [V] |
| 21 | Dy stile çipash në të njëjtën formë | P3 | Shto suplement [V] |
| 22 | Kutia e AI-së: shembulli i vogël lart, ekrani bosh | P3 | `/kutia` [V] |
| 23 | Fjalori: "check-in" dhe "produkt" | P3 | `readiness.ts:37`, `food.ts:200` [A] |
| 24 | Numri i ushtrimeve: app-i 739, SPEC 876 dhe 689 | P3 | Biblioteka, SPEC §0.3g, TICKETS E3-24 [V] |
| 25 | Hapat e parë nisin nga hapi 1 kur app-i rihapet | P3 | [V] |
| 26 | "Prano peshat" aktiv kur të 9 ushtrimet janë "pa sugjerim" | P3 | Peshat e javës [V] |

Për t'u kontrolluar në telefon, sepse Supabase-i i imituar nuk i ka këto të dhëna:
- kufiri i AI-së del 10 € për pronarin (V42: 40 €);
- lista e Adminit "nuk u ngarkua";
- koha e fillimit të stërvitjes dhe e përditësimit të ujit.

## Rekomandimet [S]

- **Rregullime të vogla në kod**, me provat: 1, 2, 4, 5, 9, 12, 16, 18, 23. Ora: zgjedhës i vetë app-it me 24 orë, ose `fmt.time` mbi fushë, me gjerësi që mban "23:00".
- **Vendime dizajni** për bordet e radhës:
  - 3: rripi i javës të thotë "Kjo javë · 9–15 nëntor", jo "Java 1";
  - 6 dhe 7: një model i vetëm për kreun e nën-faqeve dhe tab-et e Progresit pa shigjetë;
  - 8, 10 dhe 11: veprimet dhe gjendjet bosh;
  - 19, 21 dhe 22.
- **Dokumentet**: 14 dhe 24, me vendimin e pronarit për V31.

Prodhuar nga Claude (AI); rishikohet nga Andi
