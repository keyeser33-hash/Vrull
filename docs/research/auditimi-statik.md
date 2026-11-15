# Auditimi statik i kodit të Vrullit (15.11.2026)

Burimi: kodi te `main` (`package.json` 0.24.0), `docs/SPEC.md`, `docs/TICKETS.md`, `GLOSSARY.md`, `CLAUDE.md`. Nuk u ndryshua asnjë skedar burimor. Shenjat: [V] kontrolluar me grep, sed ose skript te kodi; [D] thënë në dokument (me seksion); [S] gjykimi im. Rëndësia: P1 prishur ose gabim që e sheh përdoruesi; P2 e papërfunduar ose e pa-njëtrajtshme, por punon; P3 lustrim.

Rezultati kryesor: asnjë P1 nga leximi statik. Rrugët, lidhjet, Cilësimet dhe katalogu i dy gjuhëve janë të pastra. Hapësirat e vërteta janë tre: një faqe 404 që mungon, një tab (Miqtë) bosh me qëllim, dhe vendime të specifikuara pa tiket.

## Përmbledhja

| # | Gjetja | Rëndësia | Vendi |
|---|---|---|---|
| R1 | Miqtë: ekran bosh deri te Etapa 4 | P2 | `src/routes/friends.tsx:5` |
| R2 | Pa rrugë 404 dhe pa `errorElement` | P2 | `src/App.tsx:4`, `src/router.tsx:89` |
| R3 | `/dev/ds` del edhe në build-in e përdoruesit | P3 | `src/router.tsx:110` |
| S1 | V14, V30, V31 pa asnjë tiket | P2 | `docs/TICKETS.md` (mungon), `docs/SPEC.md:29,42,43` |
| S2 | V7, V12, V16, V26 (raporti PDF, kartat), V45 vetëm me bordet, pa tiket kodi | P2 | `docs/TICKETS.md:222` |
| S3 | Të lëshuarat përputhen me kodin; mungon vetëm §0.3b | P3 | `docs/SPEC.md:80,120` |
| S4 | Numërimi i versioneve: 0.40/0.41 kundrejt 0.42 | P3 | `docs/TICKETS.md:238,241`, `docs/SPEC.md:444` |
| S5 | SPEC dhe koment i vjetër thonë se Admini mungon | P3 | `docs/SPEC.md:100`, `src/routes/settings.tsx:39` |
| S6 | `tokens.json` i emëruar si burim, por nuk është në repo | P3 | `CLAUDE.md:28`, `DESIGN.md:3` |
| C1 | Përmbledhja e rikujtuesve te Cilësimet harron "javën" | P3 | `src/routes/settings.tsx:48` |
| I1 | Njësia `kcal` e shkruar direkt në JSX | P3 | `src/routes/targets-parts.tsx:74` |
| G1 | "check-in" te Gjendja e ditës, kundër rregullit të fjalorit | P3 | `src/i18n/areas/readiness.ts:37` |
| G2 | "produkt" për kërkim sipas emrit | P3 | `src/i18n/areas/food.ts:200` |
| U1 | `QuickAdd` dhe `FactCard` nuk përdoren nga asnjë ekran | P3 | `src/components/ui/quick-add.tsx:9`, `fact-card.tsx:13` |
| U2 | Butona të çaktivizuar pa shpjegim | P3 | `src/routes/today.tsx:259,325`, `week-share.tsx:96` |
| N1 | Ekrani Shto ushqim thërret Open Food Facts direkt | P3 | `src/routes/add-food.tsx:19` |
| E1 | Faqja e ushtrimit fsheh historinë kur nuk ka | P3 | `src/routes/exercise.tsx:280` |
| D1 | Dy butona prush mund të dalin bashkë te Sot | P2 | `src/routes/today.tsx:96,259`, `missed-day-card.tsx:54` |
| D2 | Katër mënyra të shigjetës mbrapa | P3 | `week-parts.tsx`, `body-measure.tsx:156`, `program-editor.tsx:122` |
| D3 | 241 madhësi teksti me px në vend të `type-*` | P3 | `src/routes/*.tsx` (p.sh. `settings-reminders.tsx:93`) |

## 1. Rrugët

Të gjitha rrugët në `src/router.tsx` ngarkojnë një modul të vërtetë. Asnjë ekran nuk thotë "së shpejti", "coming soon" ose vetëm një titull [V: grep i tekstit; leximi i `friends.tsx`, `moved.tsx`]. Çdo objektiv `to=`, `navigate(` dhe `href=` te `src` përputhet me një rrugë të `router.tsx` [V: përfshirë `/progresi/${metric.key}`, që e kap `progresi/:metric`]. `/trupi` çon te `/progresi/trupi` me `Moved` (`router.tsx:70`: `{ path: 'trupi', element: <Moved to="/progresi/trupi" />`).

- **R1 (P2).** `src/routes/friends.tsx:5`: `// Miqtë (V2-E1-05): bosh deri te Etapa 4 (ftesat, sfidat, progresi i ndarë).` Ekrani tregon `EmptyState` me tri pika. Është qëllimisht ashtu [D: SPEC §0.3a, "Korniza", rreshti 100: "Miqtë kanë gjendje bosh deri te Etapa 4"], por tab-i është i dukshëm në tab-bar-in e pesë ekraneve.
- **R2 (P2).** `src/App.tsx:4`: `const router = createBrowserRouter(routes)`. `router.tsx` nuk ka `path: '*'` dhe asnjë `errorElement` ose ErrorBoundary nuk ekziston te `src` [V: grep]. Një adresë e gabuar, ose një lidhje nga njoftimi që i ka ndryshuar rruga, tregon faqen e gabimit të React Router. `MetricPage` merr vetë çelësin e panjohur (`progress.tsx:253`, `if (!metric) return ...progress.noMetric`).
- **R3 (P3).** `router.tsx:110`: `{ path: '/dev/ds', ...screen(() => import('@/routes/dev-ds'), ...` Pa kusht `import.meta.env.DEV`, pa lidhje nga app-i. [S] Është faqe zhvillimi; mjafton ta dini që hapet në telefon me adresën.

## 2. SPEC kundrejt kodit

**Të lëshuara dhe të gjetura në kod** [V]: V6/V42 kufijtë 10 € dhe 40 € (`supabase/functions/_shared/ai.ts:16`, migrimi `20261109140000_ai_limits_favorites.sql:34`); V36 uji 250 ml dhe 35 ml/kg (`src/nutrition/water.ts:6,7`); V43 dhjetë arritjet (`src/progress/achievements.ts:27`, `ACHIEVEMENT_KEYS` me 10 çelësa, siç e thotë SPEC §0.3c); V46 ndërrimi 180 min (`src/nutrition/food-day.ts:5`); V50 gatishmëria (`routes/readiness-*.tsx`); V53 shina e këndeve (`components/body/view-rail.tsx`); V38 dita e humbur (`routes/missed-day-card.tsx`); V40/V41 kutia dhe trajneri (`routes/ai-box.tsx`, `data/ai-coach.ts`); V22 dy gjuhët; V42 Admini (`routes/admin-ai.tsx`).

**Të specifikuara, pa u ndërtuar** (jo gabime) [D: SPEC §0.2, §0.4; TICKETS]:
- V56 Mëso: V2-E3-12 … E3-18 (nuk ka tabelë `learn_events`, rrugë Mëso, kuiz) [V].
- V57 Sot i ri: V2-E3-19 (nuk ka story-t te `today.tsx`) [V].
- V58 Seanca e re, udhëzuesi: V2-E3-20 … E3-24 (0.40.0 dhe 0.41.0).
- V59 Ushqimi i ri, Lista e Vrullit: V2-E3-26 … E3-28 (0.42.0); `food_catalog` dhe `food_products` nuk ekzistojnë [V].
- V55 kartat e mentorit: tabela `mentor_notes` sinkronizohet (`src/data/tables.ts:42`), por asnjë ekran nuk e lexon; SPEC V55 thotë që kartat vijnë me versionin tjetër.
- V13/V18/V5/V11 miqtë: V2-E4 (0.50.0). V4/V16/V17 ora: V2-E5 (0.60.0).

Gjetje:
- **S1 (P2).** Tre vendime nuk kanë tiket: V14 (lista me 150 ushqime), V30 (foto dhe ikona të ushqimeve), V31 (faqet e Adminit për listën vendase, Draft → Gati → Publikuar). `grep -nE "V31|V14|V30" docs/TICKETS.md` nuk gjen asgjë. V2-E3-27 e V2-E3-28 mbulojnë vetëm "Lista e Vrullit" të V59 [V]. Cilësimet › Admini ka vetëm Kufirin e AI-së (`admin-ai.tsx`). Zgjidhja i takon Andit: ose V31 futet te E3-27, ose hiqet nga SPEC.
- **S2 (P2).** `docs/TICKETS.md:222`: `| V2-E3-08 | Bordet e Health Connect, ujit sipas motit, zakoneve dhe raportit PDF ...` Është tiket vetëm për borde. Nuk ka tiket kodi për V7 (zakonet, gjumi, hapat), V12 (uji sipas motit), V16 (Health Connect), V26 (raporti PDF mujor dhe kartat e rekordit e seancës; është ndërtuar vetëm karta e javës, `routes/week-share.tsx`), V45 (luajtësi MP3). `src/nutrition/water.ts:4` ende thotë "Moti vjen me Etapën 3".
- **S3 (P3).** `docs/SPEC.md` ka §0.3a (rreshti 80) dhe pastaj §0.3c (rreshti 120). Seksioni §0.3b nuk ekziston dhe asnjë dokument nuk e përmend.
- **S4 (P3).** Dy burime nuk pajtohen. SPEC §0.4 rreshti 3 dhe `TICKETS.md:238` (V2-E3-25): "Lëshimi 0.40.0 dhe 0.41.0". `TICKETS.md:241` (V2-E3-28): "0.42.0", dhe `SPEC.md:444`: "nga 0.42.0". Titulli `SPEC.md:1` dhe `:3` thotë "v2.0 · 08.11.2026", por dokumenti mban V59 të 15.11.2026. Vendimin e ka Andi.
- **S5 (P3).** `SPEC.md:100`: "ora dhe Health Connect, Admini dhe 'Pamja ndjek gjendjen' shtohen me etapat e tyre". Kodi i ka Adminin (`settings.tsx:108`, `session.admin`) dhe "Pamja ndjek gjendjen" (`settings-appearance.tsx:78`). Komenti `settings.tsx:39` thotë njësoj. Dokumenti dhe komenti janë të vjetruar, jo kodi.
- **S6 (P3).** `CLAUDE.md:28` dhe `DESIGN.md:3` e quajnë `tokens.json` burim; `find . -name tokens.json` jashtë `node_modules` nuk gjen asgjë [V]. Ai jeton te sistemi i dizajnit jashtë repo-s.

## 3. Cilësimet dhe Admini

Çdo rresht te `settings.tsx` çon në rrugë që ekziston: `/cilesimet/pamja`, `/cilesimet/rikujtuesit`, `/cilesimet/admin`, `/cilesimet/ai` (`AiUsageGroup`), ose hap fletë me `?ndrysho=` [V]. Çelësat shkruajnë te `store`: `setReminderToggle` (`settings-reminders.tsx:65`), `setFollowDayState` (`settings-appearance.tsx:78`), `chooseBackground` (:67), `chooseLanguage` (:108), `saveTheme` (:45), `setQuietHours`, `setMeasurementDay`, `updateProfile`. `admin-ai.tsx` ruan me `aiAdminRemote.setLimit` nga `app-data`.

- **C1 (P3).** `settings.tsx:48`: `const REMINDER_ORDER ... ['training', 'meals', 'supplements', 'water', 'measurements']` dhe `settings-reminders.tsx:22` ka gjashtë çelësa me `'week'`. Rreshti "Rikujtuesit" te Cilësimet nuk e liston kurrë përmbledhjen e javës, edhe kur është e ndezur. Katalogu ka `reminders.list.week` (`reminders.ts:70`) [V].
- Nuk ka rresht pa destinacion dhe asnjë çelës pa ruajtje.

## 4. i18n

- JSX pa tekst të gjetur: asnjë tekst shqip ose anglisht si literal te `src/routes` dhe `src/components` [V: grep i teksteve mes etiketave dhe i atributeve `aria-label`, `title`, `placeholder`, `alt`]. Përjashtimet janë URL shembull (`exercise.tsx:419`, `exercise-create.tsx:266`: `placeholder="https://youtu.be/…"`) dhe emra burimesh (`settings.tsx:273-278`).
- **I1 (P3).** `targets-parts.tsx:74`: `<span className="text-sm text-muted-foreground">kcal</span>`. Njësia nuk kalon nga `fmt`/katalogu, ndryshe nga `today.food.kcal`.
- Gabimet `throw new Error('Lidhja e shkarkimit mungon')` (`releases.ts:29`), `'Foto nuk u shkarkua'` (`app-data.ts:176`), `'Videoja nuk u shkarkua'` (`app-data.ts:319`) janë shqip dhe jashtë katalogut, por nuk shfaqen te UI [V: `.message` lexohet vetëm te `login.tsx:41`, ku vjen nga `t('auth.…')`]. P3, nuk bën dëm.
- Anglishtja: krahasova çdo çelës `sq` me `en` (skript me `jiti`, jashtë repo-s): 0 vlera angleze me shkronja ë/ç ose fjalë shqipe. 96 çelësa kanë tekst identik; të gjithë janë të ligjshëm (formate `{kcal} kcal`, njësi, emra latinë të muskujve, `OLED`, `AMRAP`, `Clif Bar`, `rest-pause`) [V]. Nuk ka çelës me përkthim të munguar.

## 5. Emërtimi kundrejt fjalorit

Në vlerat shqipe nuk del "dieta", "menyja", "log" si emër, "chat", "streak", "readiness", "mood", "badge", "player", "widget", "katalog", "databazë" [V: skript mbi katalog]. "Receta" del vetëm për slotin (`builder.*`), siç e do fjalori [D: GLOSSARY, Receta]. Anglishtja përdor "streak", "readiness", "mood": ato janë termat angleze të fjalorit, jo shkelje.

- **G1 (P3).** `readiness.ts:37`: `'readiness.day.empty': '{date}, pa check-in'`. GLOSSARY, Kontrolli javor, `_Avoid_: check-in` (rreshti 262). Por GLOSSARY, Gjendja e ditës, e përkufizon veten me "Check-in-i i mëngjesit" (rreshti 379). Dy rreshta të fjalorit nuk pajtohen; vendimin e ka Andi.
- **G2 (P3).** `food.ts:200`: `'Asnjë produkt me këtë emër te {source}.'` GLOSSARY, Ushqimi, `_Avoid_: produkt, kur nuk ka barkod` (rreshti 288). Kërkimi është sipas emrit.

## 6. TODO, vendmbajtës, butona të çaktivizuar

- `TODO`, `FIXME`, `XXX`, `HACK`, `not implemented`, `coming soon`: 0 gjetje te `src` pa testet [V].
- Funksione me të dhëna të ngurtësuara: asnjë gjetur. Provat përdorin `src/test/fake-remote.ts`, që nuk hyn në build.
- **U1 (P3).** `components/ui/quick-add.tsx:9` (`export function QuickAdd`) dhe `fact-card.tsx:13` (`export function FactCard`) nuk importohen nga asnjë ekran, vetëm nga `dev-ds` [V]. [S] Janë ndërtuar përpara V59 (fusha "Çfarë hëngre?") dhe V56 (karta "A e dije?").
- **U2 (P3).** Butona të çaktivizuar pa fjali shpjeguese: `today.tsx:259` dhe `:325` (`disabled={busy || workout.exercises === 0}`), `week-share.tsx:96` (`disabled={!ready || busy}`), `login.tsx:120` (`disabled={busy || !email.trim() || !password}`). Te `nutrition.tsx:216` (`meal.template.length === 0`) shpjegimi ekziston (`food.noTemplate`).

## 7. Gjendjet bosh dhe pa internet

- Ekranet nuk thërrasin Supabase direkt [V: te `routes` nuk ka `@supabase`, `createClient`, `.functions.invoke`]. `fetch(` ekziston vetëm te `components/body/body-scene.ts:43` për `body.glb`, që është në APK. Thirrjet AI shkojnë te remote-t e `app-data` (`ai-box.tsx:108`, `supplement-editor.tsx:154`, `admin-ai.tsx:28`, `program-import.tsx:78`) dhe kanë gjendje pa internet (`admin.ai.offline`, `box.sendOffline`).
- **N1 (P3).** `add-food.tsx:19`: `import { type ExternalFood, offProduct, offSearch } from '@/nutrition/off'`. Ekrani thërret Open Food Facts vetë, jo nga `store`. Rregulli i `CLAUDE.md` ("Struktura › `src/data`") flet për Supabase, ndaj [S] nuk e shkel shkronjë për shkronjë; ka gjendje `offline` dhe `error` (`add-food.tsx:38`).
- Listat që kanë gjendje bosh: biblioteka (`library.tsx:126`), historiku, fotot, Progresi (`EmptyState`), Miqtë, vaktet.
- **E1 (P3).** `exercise.tsx:280`: `if (sessions.length === 0) return null`. Faqja e ushtrimit pa histori nuk thotë asgjë; pjesa thjesht zhduket.

## 8. Dizajni në kod

- Rojet: asnjë hex, `rgb()`, paletë Tailwind ose `dark:` te `routes` dhe `components` [V]. Nuk ka variante v1 (`default`, `brand`, `panel`) në përdorim; `LEGACY_FILES` është bosh (`scripts/check-design.mjs:26`).
- Prekjet: `size="sm"` (32 px) nuk përdoret askund. `h-8`, `size-8`, `size-9`, `h-[30px]` që gjeta janë dekorative (rrathët e javës `week-goals.tsx:128`, numri i ditës `history.tsx:249`, shenja e BPM `music.tsx:488`) ose brenda një etikete 44 px (çelësi `today.tsx:320`, `list-group.tsx:97`) [V: leximi i secilit]. Asnjë shkelje.
- Kreu i ekranit: tabet e mëdha përdorin `ScreenHeader` (`today.tsx`, `nutrition.tsx`, `program.tsx`, `friends.tsx`, `ProgressHeader`); ekranet e brendshme përdorin `BackHeader`.
- **D1 (P2, e mundshme; duhet provuar live).** `today.tsx:96` vizaton `MissedDayCard` me "Po" `variant="primary"` (`missed-day-card.tsx:54`), dhe karta e stërvitjes është prush kur nuk është e qetë (`today.tsx:259`: `variant={upcoming || quiet ? 'secondary' : 'primary'}`). Pyetja del kur dje ishte ditë stërvitjeje e humbur (`data/today.ts:233`), edhe kur sot është ditë stërvitjeje. Atëherë dy butona prush në një ekran, kundër `CLAUDE.md` ("një për ekran"). Kushti `quiet` vjen vetëm nga gatishmëria.
- **D2 (P3).** Shigjeta mbrapa ka katër trajta: `BackHeader` (shumica), `BackLink` (`week-summary.tsx:31`, `week-goals.tsx:32`), `BackButton` i zhveshur (`library.tsx:59`, `exercise.tsx`, `progress.tsx:262`, `body-measure.tsx:156` me `-ml-2`, `program-editor.tsx:122` me `-ml-2.5`), dhe `EditorBar`. Ekranet fqinje e vendosin shigjetën 2 px ndryshe.
- **D3 (P3).** `grep -rnE "text-\[[0-9]+px\]"` jep 241 vende (p.sh. `settings-reminders.tsx:93`: `text-[13px] leading-[1.4]`, `missed-day-card.tsx:47`: `text-[15px]`), ndërsa `CLAUDE.md` kërkon `type-*`. Madhësitë janë të ngjashme por jo të njëjta me `type-caption`.
- Butonat e ruajtjes: 14 me `primary`, një me `outline` (`week-share.tsx:96`, "Ruaj në galeri", sepse "Ndaj" është prushi; e arsyeshme). Madhësia ndryshon: `size="xl"` te shumica, `size="lg"` te `session-sheets.tsx:266` (P3).

## Për Andin

Zgjedhje që janë të tuat: S1 (V31 te cili tiket), S4 (numri i versionit 0.41 ose 0.42), G1 (a lejohet "check-in" te Gjendja e ditës), R2 (a duam faqe 404). Kjo ka të bëjë me kodin e 15.11.2026; nuk është prova e aplikacionit të ndezur.

Prodhuar nga Claude (AI); rishikohet nga Andi
