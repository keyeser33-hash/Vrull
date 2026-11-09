# DESIGN.md

Vrull, sistemi i dizajnit i Training Hub v2 (drejtimi B, i zgjedhur më 08.11.2026; SPEC §0.2 D1, §0.3, §0.3a). Lexoje bashkë me `src/styles/globals.css` para se të shkruash UI. Burimi i vlerave: `tokens.json` dhe README-ja e sistemit të dizajnit "Vrull", me "Rregullat e temave" të matura te ekranet Natë dhe Ditë. Ekranet e miratuara janë te kanavaca "Vrull · Ekranet". Komponentët në tri temat: faqja e brendshme `/dev/ds`.

## Qëllimi

App-i i palestrës për përdoruesin dhe disa miq: stërvitja, ushqimi, trupi në 3D dhe sfidat. Energjik dhe editorial: tituj të mëdhenj të ngushtë, numra që mbushin ekranin, festime kur thyhet një rekord. **Gri dhe bojë kudo, prush vetëm aty ku duhet vepruar.** Vija e shpejtësisë te logo është lëvizja përpara.

## Zëri dhe teksti

- Shqip dhe anglisht (V22), nga katalogu `src/i18n` (shih CLAUDE.md, "Tekstet në dy gjuhë"). Emrat e ushtrimeve mbeten në anglisht.
- **Sentence case në burim.** Shkronjat e mëdha vijnë vetëm nga stilet `type-display-*`, `type-title`, `type-label` dhe nga butonat (`text-transform: uppercase`): shkruaj "Fillo stërvitjen", jo "FILLO STËRVITJEN".
- Pa emoji dhe pa pikëçuditje. Energjia vjen nga tipografia dhe lëvizja.
- Numrat me `fmt` sipas gjuhës: 62,5 kg, 2 900 kcal, 17:00, 62,5 × 10; `tabular-nums` kudo ku ndryshojnë.
- Fjali të shkurtra me veprim: "12 përsëritje të japin rekord të ri: e1RM 87,5 kg." Ditë e lodhur: e njëjta gjë, më butë: "Sot më lehtë: −1 set dhe RIR 3."

## Ngjyrat

Tokenat jetojnë vetëm te `globals.css`, në tri tema. Klasa e Tailwind-it është emri i tokenit (`bg-surface`, `text-ember-text`, `border-border`). Paleta e Tailwind-it është e hequr: `text-white` ose `bg-red-500` nuk ekzistojnë.

| Token | OLED | Natë | Ditë | Roli |
|---|---|---|---|---|
| `background` | `#000000` | `#0B0B0C` | `#F4F4F5` | Sfondi i faqes |
| `surface` | `#121214` | `#18181B` | `#FFFFFF` | Kartat, fletët; kontrollet e mbushur mbi sfondin e faqes |
| `surface-2` | `#1C1C1F` | `#222226` | `#EDEDEF` | Butonat dytësorë dhe stepper-at brenda kartës; gjurma e shiritave në kartë |
| `border` | `#27272A` | `#27272A` | `#E4E4E7` | Ndarës 1 px; kufiri i butonave me kontur |
| `foreground` | `#FAFAFA` | `#FAFAFA` | `#0B0B0C` | Teksti kryesor, numrat e mëdhenj |
| `muted-foreground` | `#A1A1AA` | `#A1A1AA` | `#52525B` | Teksti dytësor, etiketat, njësitë, placeholder-i |
| `subtle` | `#3F3F46` | `#3F3F46` | `#D4D4D8` | Vetëm dekor (× te seti, kufiri i fushave). Kurrë tekst |
| `ember` | `#FF5B2E` | = | = | Prushi: sfondi i **një** veprimi kryesor, shenjat e mbushura, volumi |
| `on-ember` | `#0B0B0C` | = | = | Teksti mbi `ember` dhe `sand` (6,4:1). Kurrë i bardhë (3,1:1) |
| `ember-text` | `#FF5B2E` | `#FF5B2E` | `#C2410C` | Prushi si tekst, ikonë ose vijë e hollë |
| `data` | `#8B7CFF` | `#8B7CFF` | `#5B4BDB` | Vjollca: të dhënat dytësore ("+2,5 kg", kufiri i AI-së, miqtë) |
| `sand` | `#E0B48A` | = | = | Rëra: zë vendin e `ember` në ditë të lodhura |
| `success` | `#4ADE80` | `#4ADE80` | `#15803D` | Vetëm gjendje, gjithnjë me fjalë |
| `danger` | `#F87171` | `#F87171` | `#B91C1C` | Gabime dhe fshirje, gjithnjë me fjalë |
| `insight` | `#1A1206` | `#1A1206` | `#FFF1EA` | Kartat e rekordit dhe të sugjerimit |
| `insight-border` | `#5A2A12` | `#5A2A12` | `#FFD2C2` | Kufiri i kartave insight (në çdo temë) |
| `scrim` | `#00000099` | = | = | Errësimi pas fletëve |
| `track` | `#27272A` | `#27272A` | `#D4D4D8` | Gjurma e shiritave dhe unazave mbi sfondin e faqes |
| `model-light` | `#FFFFFF` | = | = | Drita e modelit 3D. Kurrë `foreground` |
| `volume-1` / `-2` / `-3` | `#4C1B0E` / `#99371B` / `#FF5B2E` | `#542316` / `#9D3B20` / = | `#FFCEC0` / `#FF9D82` / = | Volumi javor: nën 10 sete, 10–20, mbi 20 |

Rregullat e temave si tokena, që komponentët të mos zgjedhin temën vetë:

| Token | OLED | Natë | Ditë | Roli |
|---|---|---|---|---|
| `surface-border` | `border` | i tejdukshëm | i tejdukshëm | Kufiri 1 px i kartave, pllakave dhe butonave të mbushur: vetëm në OLED |
| `nav` | `background` | `surface` | `surface` | Sfondi i tab-bar-it (me vijë 1 px `border` sipër në çdo temë) |
| `mark` | `surface-2` | `surface-2` | `surface` | Shenjat pa vlerë mbi faqe (ditët e pushimit te java); në Ditë `surface-2` del 1,04:1 |
| `ink` / `on-ink` | `#0B0B0C` / `#FAFAFA` | = | = | Butoni i errët mbi kartën me prush, me tekst fiks |

### Rregullat e temave

- **Kufijtë:** në OLED kartat, pllakat dhe butonat e mbushur kanë kufi 1 px; në Natë dhe Ditë jo (`surfaceClass` te `ui/surface.ts` e bën vetë). Butonat me kontur dhe kartat insight e mbajnë kufirin në çdo temë.
- **Kontrollet mbi sfondin e faqes** janë `surface` (`<Button variant="secondary" ground="page">`); brenda kartës `surface-2`.
- **Shiritat dhe unazat** mbi sfond: `track`; brenda kartës: `surface-2`.
- **Shenjat e holla me prush** (unaza e ditës së sotme, pika "E radhës", tab-i aktiv): `ember-text`; mbushjet mbeten `ember`.
- **Segmenti i zgjedhur** (çipi RIR): mbushje `foreground`, tekst `background`.
- **Zbehjet** drejt të tejdukshmes përdorin ngjyrën e kartës së temës; teksti mbi foto mbetet i bardhë mbi gradient të errët.
- **Fushat:** placeholder `muted-foreground` (vendosur te `globals.css`); lidhjet në tekst `ember-text`.
- **Pulsi i "Trupit në ritëm" në Ditë:** unazë 1,5 px `ember` rreth gjoksit; me lëvizje të reduktuar e palëvizshme.

Kontrasti: çdo çift teksti arrin 4,5:1 në çdo temë (`src/styles/tokens.test.ts` i mat të gjithë). `subtle` është vetëm dekor; `ember` mbi sfondin e Ditës del 2,8:1, prandaj vijat e holla dhe teksti marrin `ember-text`.

## Temat

OLED (parazgjedhja, e zeza e plotë), Natë dhe Ditë. Në kod emrat e ruajtur mbeten ato të v1: `oled`, `dark` (Natë), `light` (Ditë); emrat që sheh përdoruesi vijnë nga katalogu (`settings.theme.*`). `<html class="dark oled">` = OLED, `class="dark"` = Natë, pa klasë = Ditë; `lib/theme.ts` i vendos. Një pjesë e faqes merr temën e vet me `data-theme="oled" | "dark" | "light"` (faqja `/dev/ds`). Nuk ka variante `dark:`: ngjyra ndryshon vetëm përmes tokenave.

## Tipografia

- **Barlow Condensed** (600–800) për titujt, numrat dhe butonat; **Barlow** (400–700) për tekstin. Të dyja nga Fontsource (OFL-1.1), të paketuara në app (`src/styles/app.css`, latin dhe latin-ext): app-i nuk pret rrjetin.
- Një klasë mban familjen, madhësinë, rreshtin, peshën dhe uppercase-in:

| Klasa | Madhësia | Përdorimi |
|---|---|---|
| `type-display-hero` | 112 / 0,85 / 800 | Pesha dhe përsëritjet e setit |
| `type-display-xl` | 88 / 0,85 / 800 | Një numër që është vetë ekrani (kaloritë që mbeten) |
| `type-display-l` | 48 / 0,92 / 800 | Titulli i seancës dhe i ushtrimit |
| `type-display-m` | 44 / 0,95 / 800 | Titulli i ekranit |
| `type-display-s` | 34 / 0,95 / 800 | Titulli i kartës kryesore |
| `type-title` | 22 / 1,1 / 700 | Titulli i seksionit ose kartës |
| `type-label` | 16 / 1,2 / 700, 0,06em | Etiketat mbi grupe |
| `type-body-l` | 17 / 1,45 / 500 | Teksti kryesor në fletë dhe insight |
| `type-body` | 15 / 1,45 / 400 | Teksti i zakonshëm |
| `type-body-strong` | 16 / 1,4 / 600 | Emri i rreshtit në lista |
| `type-caption` | 14 / 1,35 / 400 | Detajet, data, njësitë |
| `type-tab` | 12 / 1,2 / 500 | Emrat te tab-bar-i |

- `type-display-hero` dhe `type-display-xl` kanë `tabular-nums`; numrat e tjerë e marrin me klasë. Mos i përziej me klasa që ndryshojnë të njëjtën veti (`type-caption font-bold`): zgjidh një stil tjetër ose shkruaj vetitë një nga një.
- Numrat e mëdhenj nuk kanë njësi brenda: njësia shkon poshtë ose anash në `muted-foreground` ("62,5" dhe "kg").

## Hapësira, format, prekja

- Kufiri anësor 16 px (`px-4`); gap 8–14 px mes kartave. Hapësira `space-1…8` është shkalla e Tailwind-it (`p-4` = 16 px).
- Rrezet: `rounded-sm` 10 (butonat e vegjël, inputet), `rounded-md` 12 (butonat kryesorë, stepper-at, çipat), `rounded-lg` 16 (kartat e vogla, insight), `rounded-xl` 20 (karta kryesore, fletët), `rounded-pill` (rrathët, shiritat).
- Madhësitë: `h-touch` 44 (minimumi për çdo prekje), `h-button` 52 (butoni kryesor në kartë), `h-button-l` 58 (butoni kryesor në fund të ekranit), `h-tab-bar` 72, `min-h-row` 56 (rreshtat).
- Kartat pa hije. 390 px pa scroll anësor.

## Komponentët (`src/components/ui`)

| Komponenti | Përdorimi |
|---|---|
| `Button` (`button-variants.ts`) | `primary` prush (një për ekran), `size="lg"` 52 px në kartë, `size="xl"` 58 px në fund të ekranit, `tired` në ditë të lodhura (rërë); `secondary` i mbushur (`ground="card" | "page"`); `outline` me kufi `border`; `ghost`; `ink` mbi kartën me prush; `size="icon"` 44 × 44 me `aria-label` |
| `Stepper` | Pesha × përsëritjet e setit: numrat `display-hero`, i fundit që ndryshoi në `ember-text`, katër butona 52 px |
| `RirPicker` | Pesë çipa 44 px me `aria-pressed`; i zgjedhuri në bojë, jo prush |
| `ListRow` | Rreshti 56 px brenda `<ul>`: emri, detaji, vlera djathtas; i gjithë rreshti preket, veprimi brenda ka zonën e vet |
| `StatTile` | Numri i madh me etiketë; `aria-label` me fjalë të plota; `tone="data"` |
| `ProgressBar`, `ProgressTrack` | Shiriti 6 px kundrejt objektivit: gjurma (`track` mbi faqe, `surface-2` në kartë) dhe mbushja `ember`; te Ushqimi (0.23) të tri makrot janë `ember`, emri i dallon; `data` dhe `sand` mbeten për shiritat e tjerë (kufiri i AI-së `data`); mbi 100% e thotë me fjalë |
| `Expand` (`expand.tsx`) | Rreshti → detaji: lista hapet në vend, 250 ms ease-out (rreshti i rrjetës 0fr → 1fr); e mbyllur jashtë lexuesit të ekranit dhe radhës së Tab-it; butoni mban `aria-expanded` |
| `RollingNumber` (`rolling-number.tsx`) | Numri që ndryshon: `value` dhe `format` (parazgjedhja `fmt.number`); teksti është ai i `fmt`, shifrat që ndryshuan rrotullohen (Lëvizja); lexuesi i ekranit dëgjon vetëm vlerën e fundit |
| `InsightCard` | Rekordi ose sugjerimi (`insight`), gatishmëria e ulët (`tired`, me "Prano" dhe "Jo sot"); një në ekran |
| `FactCard` | "A e dije?" me burim ose "Shpjeguar nga AI" |
| `WeekStrip` | Java me rrathë 34 px: e bërë prush, sot me unazë `ember-text`, pushim `mark`; çdo rreth e thotë gjendjen |
| `TabBar` | Navigimi 72 px, aktivi `ember-text` 700 me `aria-current="page"` |
| `QuickAdd` | "Me fjalë", foto e pjatës dhe barkodi; me kufirin e AI-së foto e thotë |
| `Icon` | Vijë 2 px në rrjetë 24, `currentColor`; ikonat e reja te `icon-paths-vrull.ts` |
| `VrullMark` (`logo.tsx`) | Shenja e Vrullit: katror `ember` (rreze 14) me V-në dhe dy vijat e shpejtësisë në `on-ember`, si `assets/Logos/vrull-mark.svg`; dekorative |
| `ExercisePhoto` (`exercise-photo.tsx`) | Foto e ushtrimit sipas `library_id`: bardh e zi, 72 × 48 (`row`) ose 44 (`square`); pa foto "Pa foto", gjatë pritjes vetëm ikona; dekorative pranë emrit |

Tekstet e komponentëve vijnë nga katalogu (`ui.*`); numrat i formatojnë vetë me `fmt`.

### Korniza (`src/components/layout`, V2-E1-05)

| Pjesa | Përdorimi |
|---|---|
| `AppShell` | Rripi "Pa internet" sipër (`OfflineBanner`), ekrani, `TabBar` poshtë; sfondi "Vija shpejtësie". Tab-i aktiv vjen nga `handle: { tab }` i rrugës (`router.tsx`); `null` = pa tab-bar (cilësimet, editorët, shtimi) |
| `ScreenHeader` | Kreu i pesë ekraneve kryesore: rreshti i vogël (`caption`), titulli `display-m`, fjalia poshtë; djathtas veprimet e ekranit dhe `ProfileButton` (logo 36 px në 44 px, "Profili dhe cilësimet", hap `/cilesimet`) |
| `BackHeader`, `BackButton` (`page.tsx`) | Ekranet brenda një vendi: shigjeta 44 px dhe titulli `display-m`; mbrapa kthehet aty nga erdhi përdoruesi, ose te `fallback` kur ekrani është i pari në histori |
| `Group`, `Row`, `LinkRow`, `SwitchRow`, `ChoiceRow` | Grupet e rreshtave (Cilësimet): etiketa `label`, karta `rounded-lg`, rreshta 52 px me vlerën dhe shigjetën; çelësi i ndezur në bojë |
| `Sheet` | Fleta: `surface`, cepat 20 px, doreza, titulli `display-s` me `description` poshtë, "Mbyll" 44 px; `footer` mban veprimin kryesor jashtë pjesës që lëviz; `hero` vë një shenjë të madhe mbi titull dhe e qendërzon kreun (bordi "Arritjet · detaji") |
| `ProgressTabs` (`progress-tabs.tsx`) | Tab-et e Progresit: Trupi · Përmbledhja · Historiku · Arritjet, lidhje 44 px në një shirit `surface`; i zgjedhuri mbushje `foreground` me tekst `background` (V44) |
| `EmptyState` | Gjendja bosh (bordi "Gjendje · Bosh"): fjalia `display-l`, lista me numra (një rresht me `to` hap vendin e vet), veprimi kryesor poshtë |

## Ikonat

Vijë 2 px në rrjetë 24 px, cepa dhe nyje të rrumbullakëta, pa mbushje (përveç pikës së një shenje, që merr `currentColor`). Aktive te tab-bar-i në `ember-text`. Ikona pa tekst ka gjithnjë `aria-label`. Ikonat e ushqimit (V30): njëngjyrëshe, kurrë prush.

## Lëvizja

E qetë dhe me qëllim (SPEC §0.3c, E2-23; bordi "Lëvizja e 0.23"): pak momente lëvizin, çdo gjë tjetër rri; festimi vetëm te rekordet dhe qëllimet. **Asnjë animacion nuk vonon një prekje:** veprimi ndodh në prekje, lëvizja vjen pas.

| Koha | Çfarë | Si |
|---|---|---|
| 100 ms | Shtypja e çdo butoni | `.97 → 1`, ease-out, pa kërcim (`button-variants.ts`: `duration-100 ease-out motion-safe:active:scale-[0.97]`) |
| 150 ms | Ndryshimi i gjendjes: çip, çelës, shenjë, shigjeta e rreshtit që hapet | ease-out |
| 200 ms | Numrat që ndryshojnë (kcal, proteina, uji, setet) rrotullohen, 40 ms mes shifrave nga e majta; shifrat e njëjta rrinë (`RollingNumber`) | ease-out; rritja lart, zbritja poshtë |
| 250 ms | Rreshti → detaji (zgjerohet në vend), banderola e rekordit, tab-et | ease-out |
| 320 ms | Shiritat mbushen nga e majta (`animate-fill`) dhe ndjekin vlerën e re (`ProgressTrack`) | ease-out |
| 600 ms | Festimi: rekordi te mbyllja, qëllimi i arritur, java e plotë; një herë | `ease-vrull` |

- **`ease-vrull`** (`cubic-bezier(.34,1.56,.64,1)`, me kërcim) vetëm për hyrjet e kartave dhe festimet; çdo gjë tjetër ease-out, pa kërcim.
- **Dridhjet:** e lehtë te "Ruaj setin", e mesme te qëllimi, e rëndë te rekordi.
- **Ditë e lodhur:** 360 ms pa kërcim, pa festime.
- **Lëvizje e reduktuar:** asgjë nuk lëviz, vetëm zbehje 120 ms; dridhjet mbeten. `globals.css` e zbaton për çdo element (animacionet mbarojnë menjëherë dhe pa vonesë, tranzicionet vetëm `opacity`), `RollingNumber` vetëm zbeh shifrat e reja, shtypja nuk shkallëzohet (`motion-safe:`). `src/styles/motion.test.ts` e kontrollon, edhe që asnjë `active:scale-` të mos jetë pa `motion-safe:`.

## Gjendja e ditës

Check-in-i dhe gatishmëria (V7, V20) zgjedhin pamjen: **energik** (parazgjedhje: `ember`, festime, "Shko fort") ose **i lodhur** (`sand` në vend të `ember` vetëm te veprimi i sotëm, pa festime, "Ritëm i butë"). Historia nuk ndryshon ngjyrë. Programi nuk ndryshon pa konfirmimin e përdoruesit (V23).

## Sfondet

Për çdo temë: **I plotë** (`background`) ose **Vija shpejtësie** (vija prushi 115°, 16%, çdo 14 px, vetëm në sfond, kurrë pas tekstit të gjatë). Emrat e temave nuk përdoren si emra sfondesh.

Në kod (V2-E1-05): zgjedhja është te Cilësimet › Pamja, ruhet te `user_settings.background` (`solid` | `speed_lines`, sinkronizohet) dhe në telefon (`lib/background.ts`), që korniza ta vizatojë pa pritur bazën. Korniza vendos `bg-speed-lines` pas 320 px të sipërme të faqes dhe e zbeh poshtë me `mask-fade-down` (të dyja te `globals.css`): vijat bien pas kreut dhe titullit, jo pas paragrafëve. Mostra te Pamja i tregon të plota.

## Modeli 3D, fotot, Mëso

- Modeli i trupit ndriçohet nga `model-light`, kurrë nga `foreground` (në Ditë do të dilte i zi); edhe theksimi i muskulit në fokus shkon drejt `model-light`. Muskujt pa vlerë `muted-foreground` mbi `surface`, kryesorët `ember`, ndihmësit gri; volumi me `volume-1…3`, "Pa sete" me `subtle`; mbulesat e Shtresave gri të tejdukshme. Tokenat lexohen nga CSS-i (`components/body/body-scene.ts`), kurrë hex në kod. Çipi i muskulit rri sipër modelit, mbi `background` me kufi `subtle`, me vijën `foreground` te muskuli (bordi "Trupi").
- Makina e kohës (V52): ndryshimi i një zone nga baza është `data` në tri shkallë, njësoj te modeli, figura 2D dhe legjenda: nën 1% `data/35`, 1–3% `data/65`, mbi 3% `data`; zona pa ndryshim mbetet gri. Parashikimi (teksti nën datë, shenja e fundit e rrëshqitësit) është `data`. Rrëshqitësi i kohës (`.time-range` te `globals.css`) rri mbi sfondin e faqes: gjurma `track` 6 px, doreza 28 px `foreground` me unazë `background`, lartësia 44 px; shenjat e ndalesave poshtë gjurmës, të kaluarat `foreground`, të tjerat `subtle`. Data e ndalesës rri mbi modelin, jo sipër tij.
- Fotot e ushtrimeve bardh e zi (`grayscale`); foto që mungon: vend-mbajtës `surface-2` me "Pa foto", kurrë imazh i shpikur.
- Kartat "A e dije?" (`FactCard`): etiketa në `data`, burimi gjithnjë i pranishëm.

## Si e zbaton një agjent

1. Lexo këtë skedar dhe `globals.css`. Përdor klasat e tokenave dhe komponentët e `src/components/ui`; **asnjë hex, `rgb()`, paletë Tailwind ose `dark:`**.
2. Një veprim kryesor për ekran: `<Button variant="primary">`. Para se ta shtosh, numëro prushin në ekran: një buton dhe disa shenja.
3. Prushi si tekst ose vijë e hollë: `ember-text`. Mbi `ember` ose `sand`: `text-on-ember`.
4. Ngjyrë e re: shtoje te të tri blloqet e temave te `globals.css` (dhe te `@theme inline`), me vlerën dhe rolin këtu, dhe një çift te `tokens.test.ts` nëse mban tekst.
5. Çdo prekje 44 px; kontrollo ekranin në 390 px dhe në OLED, Natë dhe Ditë (`node scripts/ds-screens.mjs` për komponentët).
6. Fokusi: vijë 2 px `foreground`, 2 px larg; mos e hiq.
7. Tekstet nga katalogu `src/i18n`, në sentence case.

## Aliaset e v1

Ekranet e v1 përdornin emrat e Omal UI v2. `globals.css` i mban si alias drejt tokenave të Vrullit, vetëm për skedarët e `LEGACY_FILES` te `scripts/check-design.mjs`. Kur një ekran kalon te Vrull (E1-05 … E1-15), hiqet nga lista; kur lista mbetet bosh, hiqen edhe aliaset. Që nga V2-E1-16b (0.20.0) lista është bosh: asnjë skedar nuk i përdor, dhe roja nuk i lejon askund; aliaset dhe variantet e v1 të butonave presin heqjen nga `globals.css` dhe `button-variants.ts`.

| v1 | Vrull |
|---|---|
| `card`, `popover`, `panel` | `surface` |
| `muted`, `secondary`, `accent`, `skeleton`, `panel-button`, `success-soft`, `destructive-soft` | `surface-2` |
| `primary` / `primary-foreground` | `foreground` / `background` |
| `brand`, `chart-1` / `brand-foreground` | `ember` / `on-ember` |
| `brand-soft`, `selected`, `warning-soft` | `insight` |
| `border-subtle`, `panel-border` | `border` |
| `input` | `subtle` |
| `ring`, `warning`, `*-foreground` mbi sipërfaqe | `foreground` |
| `panel-muted-foreground` | `muted-foreground` |
| `destructive` / `destructive-foreground` | `danger` / `background` |
| `chart-track` | `track` |
| `overlay` | `scrim` |

Variantet e v1 të butonave (`default`, `brand`, `destructive`, `on-panel`, `panel`, madhësitë `md` dhe `sm`) mbeten te `button-variants.ts` vetëm për këto ekrane.
