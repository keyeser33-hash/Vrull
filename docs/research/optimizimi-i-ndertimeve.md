# Optimizimi i ndërtimeve: minutat e GitHub Actions, tokenat e Claude Code dhe aftësitë publike

Shënim kërkimi, 9 nëntor 2026. Faktet kanë burimin me numër [n], dhe URL-të janë në fund. Të gjitha burimet u lexuan më 9.11.2026. Shenjat në tekst:

- **Fakt**: e thotë burimi parësor.
- **Matje**: e lexova vetë nga API-ja e GitHub-it për `keyeser33-hash/Vrull` (vetëm lexim) ose nga repo-ja [46].
- **Përfundim**: arsyetimi im mbi faktet dhe matjet.
- **Rekomandim**: propozimi im. Asnjë skedar tjetër nuk u ndryshua, asnjë workflow nuk u nis dhe asnjë cilësim i GitHub-it nuk u prek.

---

## Përmbledhja

1. **Plani Free nuk jep më "2 000 minuta", por $12 në muaj.** Kuota e përfshirë llogaritet në para. Linux 2-core kushton $0,006/min, pra $12 ≈ 2 000 minuta Linux. Çdo job rrumbullakohet lart në minutë të plotë. Kuota rinis më 1 të muajit, 00:00 UTC. Pa metodë pagese, përdorimi bllokohet kur mbaron kuota [1][2][3][6].
2. **Vrull harxhoi ~1 724 minuta të faturueshme në 2,3 ditë (7–9 nëntor), ≈ $10,3.** Para bllokimit në 18:10 UTC të 9 nëntorit kishte ~1 655 minuta (≈ $9,93). Kjo është pak nën $12, ndaj pjesa tjetër ka ardhur nga diku tjetër dhe nuk e vërtetova dot nga (§1.4) [46].
3. **Prova e Android-it mori 60 % të minutave.** Prej tyre, 630 minuta ishin nisje të dështuara (37 % e totalit). Edhe 432 minuta kanë ardhur nga nisjet në çdo push, që u hoqën më 8 nëntor [46].
4. **CI-ja u nis 31 herë për commit-e vetëm me dokumente (103 minuta).** Me `paths-ignore` këto nisje nuk ndodhin. Të gjitha 162 nisjet e CI-së ishin push te `main` [14][46].
5. **Artifact-et zënë ~487 MiB nga 500 MB e planit Free.** 100 artifact-e të provës dhe 20 APK, që janë edhe te Release-i dhe te Supabase-i. Kjo hapësirë ndahet me Packages dhe faturohet sipas orëve [1][20][21][46].
6. **Budget-i ose metoda e pagesës vendosin nëse vazhdon apo ndalet.** Kur shtohet metoda e pagesës, minutat mbi kuotën paguhen. Një budget me "Stop usage when budget limit is reached" e ndalon shpenzimin te shuma e caktuar. Njoftimet e kuotës vijnë te 90 % dhe 100 % [1][4][5].
7. **Fusha `billable` e API-së `/timing` jep sot 0.** Endpoint-i është "closing down". Për minutat e vërteta duhet faqja e përdorimit ose usage report [10][11][46].
8. **Te Claude Code, më e lirë del zgjedhja e modelit për çdo sub-agent.** Mjeti Agent pranon `model: sonnet|haiku|opus`. Çmimet e API-së: Opus 5.5 $4/$20, Sonnet 5.5 $2/$10, Haiku 5.5 $0,10/$0,50 për MTok. Sub-agjentët kanë kontekst dhe cache të vetin, ndaj çdo sub-agent paguan vetë për ngarkimin e kontekstit [27][28][34].
9. **Edhe skedarët që lexon çdo agjent kushtojnë.** CLAUDE.md (61 rreshta) është brenda kufirit prej 200 rreshtash [30]. Por SPEC.md ka ~140 KB, dhe në këtë sesion çdo agjent mban në kontekst rreth 100 aftësi dhe disa qindra emra mjetesh MCP që nuk kanë lidhje me Vrull [26][29].
10. **Nga aftësitë publike, ia vlen të shqyrtohen:** `skill-creator` (Anthropic), `typescript-lsp` dhe `session-report` (plugin-e zyrtare), `improve-tests` dhe `diagnosing-bugs` (supermatt), `android/skills` për orën dhe `capawesome-team/skills` për Capacitor. Të gjitha duhen verifikuar si varësi. `orchestrate` i supermatt nuk punon në cloud, sepse kërkon Herdr [36]–[45].

---

## 1. Çfarë ndodhi me minutat (matje nga repo-ja)

### 1.1 Të dhënat

**Matje** [46]: repo-ja `keyeser33-hash/Vrull` u krijua më 7.11.2026 në 09:29 UTC dhe është private. Të gjitha 287 nisjet e nëntorit janë midis 7.11 12:53 UTC dhe 9.11 20:04 UTC, pra rreth 55 orë (2,3 ditë), jo 1–9 nëntor. Mora 308 job-et e tyre, me të gjitha përpjekjet (`filter=all`). Minutat e faturueshme i vlerësova si shumë e kohës së çdo job-i (`completed_at − started_at`), e rrumbullakuar lart në minutë sipas [2].

| Workflow | Job-e | Minuta reale | Minuta të faturueshme (vlerësim) | Shënim |
|---|---:|---:|---:|---|
| Prova e Android-it (`android-smoke.yml`) | 98 | 985 | **1 033** | 59 job-e të dështuara |
| CI (`ci.yml`) | 161 | 422 | **502** | 162 nisje, të gjitha push te `main`; 21 të anuluara |
| APK për Android (`android-release.yml`) | 49 | 155 | **189** | `plan` 24 × 1 min, `apk` 21 job-e / 99 min, `smoke` i thirrur 4 / 66 min |
| **Gjithsej** | **308** | **1 562** | **1 724 ≈ $10,34** | me $0,006/min [1] |

**Prova e Android-it** sipas përfundimit dhe nisjes (minuta të faturueshme):

| | Push (deri 8.11 13:25 UTC) | Me dorë (`workflow_dispatch`) | Gjithsej |
|---|---:|---:|---:|
| Sukses | 165 | 128 | 293 |
| Dështim | 198 | 432 | **630** |
| Anuluar | 69 | 41 | 110 |
| **Gjithsej** | **432** | **601** | 1 033 |

**Koha e një prove të plotë sot**: 13 nisje të suksesshme me workflow-in aktual zgjatën 7,9–18,5 min, dhe ato pa `skip` ~16–18,5 min. Mediana e hapave: ndërtimi i v2 dhe v3 2,0 min, nisja e emulatorit 2,9 min (përfshin `sdkmanager --install`, krijimin e AVD-së, nisjen dhe `sleep 30`). Prova vetë zgjat deri në 12,1 min. Hapat `setup-java` (cache-i i Gradle-s) zgjatin 0,2 min, dhe v1 vjen nga cache-i për 0 min.

**CI sipas asaj që ndryshoi commit-i** (skedarët e commit-it të fundit të push-it kundrejt prindit të parë, me `git diff` lokal):

| Ndryshimi | Nisje | Minuta të faturueshme |
|---|---:|---:|
| Kod (88 commit-e të thjeshta + 16 merge) | 104 | 321 |
| Vetëm `docs/**` ose `*.md` | 31 | **103** |
| Vetëm `scripts/android-smoke*`, workflow-i i provës, `android-test/` (± dokumente) | 27 | 78 |

**Artifact-et e gjalla**: 120 artifact-e, gjithsej ≈ 487 MiB. 100 janë `android-smoke` (316 MiB, ruajtja 14 ditë) dhe 20 janë `TrainingHub-<versioni>` (171 MiB, ruajtja 30 ditë).

**Bllokimi i 9 nëntorit**: dy nisje në 18:10:28 UTC (CI dhe Prova) mbaruan me `failure` brenda një minute, me **0 job-e**. Përpjekja e parë e nisjes së 18:12 kishte një job me 0 ms. Përpjekja e dytë e saj nisi në 18:54 UTC dhe punoi, pra bllokimi zgjati rreth 45 minuta. API-ja nuk kishte check run për to, ndaj mesazhi i saktë i UI-së nuk u lexua.

### 1.2 Kujdes me matjet

- Faktet e sakta të faturimit nuk i pashë. Endpoint-et e faturimit të llogarisë janë jashtë asaj që lejon ky sesion. Vlerësimi im mund të ndryshojë nga raporti i GitHub-it.
- **Fakt** [11]: `GET …/runs/{id}/timing` thotë se "This endpoint is in the process of closing down". **Matje**: më 9.11.2026 ai ktheu `billable.UBUNTU.total_ms: 0` dhe `duration_ms: 0` për çdo job, edhe në repo private me runner GitHub. Fusha `run_duration_ms` është ende e mbushur. Pra fushat `billable` nuk janë më të besueshme.

### 1.3 Përfundim: ku shkuan minutat

- Rreth 25 % (432 min) erdhi nga prova në çdo push. Ky shkak është hequr: commit-i `410f86e` i 8.11 e la provën vetëm me dorë dhe para lëshimit.
- Rreth 37 % (630 min) ishin prova të dështuara. Sipas `docs/MESIMET.md`, shumica nuk vinin nga app-i: skripti kërkonte tekste të vjetra (MESIMET r. 10 dhe 23), afate, ose emulatori. Ky është leva më e madhe që mbetet.
- CI-ja është e lirë për nisje (~3 min), por niset shpesh. 31 % e minutave të saj ishin për dokumente.
- Me ritmin e 7–9 nëntorit (~750 min/ditë), një muaj do të ishte rreth 22 000 minuta ≈ $135. Pa provën në push del rreth $100. Këto janë ekstrapolime të përafërta: ritmi i një jave lëshimesh nuk është ritmi i çdo jave.

### 1.4 Pse u bllokua para $12 (nuk u vërtetua)

Sipas vlerësimit tim, para bllokimit Vrull kishte ~$9,93, jo $12. Shpjegimet e mundshme, pa provë:

- Repo të tjera private të së njëjtës llogari kanë përdorur minuta më 1–7 nëntor. Repo-ja duket se ka trashëguar historinë e një repo-je të mëparshme (tag-u `v0.16.0`). Kuota është për llogarinë, jo për repo-në [1].
- Faturimi i GitHub-it e mat job-in pak më gjatë se `started_at`→`completed_at` (p.sh. përgatitjen e runner-it).
- Përdorim tjetër nga e njëjta kuotë, si "cloud sandbox compute" ose Copilot code review [1].

Përgjigjen e saktë e jep faqja Billing → Usage, ose një usage report me filtër për Actions [10].

---

## 2. GitHub Actions për një repo private në GitHub Free (2026)

### 2.1 Faktet

**Kuota dhe çmimet**
- Plani Free përfshin **$12 USD "included compute usage" në muaj, 500 MB artifact storage** (të ndara me Packages) dhe **10 GB cache për repo**. "The included compute usage is expressed as a monetary amount, not a fixed number of minutes" [1]. Faqja e çmimeve thotë ende "2,000 CI/CD minutes/month" [6]. Nuk ka kundërshti: $12 / $0,006 = 2 000 min Linux.
- Çmimet për minutë [1][2]: Linux 2-core x64 $0,006, Linux 1-core $0,002, Linux arm64 $0,005, Windows $0,010, macOS $0,062. Shumëzuesit e vjetër (×2, ×10) janë zëvendësuar nga çmimi i secilit SKU. Faqja e metrikave i përmend ende "minute multipliers", por lidhja çon te tabela e çmimeve [13].
- **Rrumbullakimi**: "GitHub rounds the minutes and partial minutes each job uses up to the nearest whole minute" [2]. Kur një job i ri-nisur dështon, numërohen të dy [1]. Reusable workflow-et faturohen te workflow-i që i thërret [13].
- **Larger runners** janë vetëm për organizata në Team ose Enterprise Cloud dhe kërkojnë metodë pagese [1][2]. Për një llogari personale nuk janë opsion.
- Runner-at standardë në repo publike dhe runner-at self-hosted janë falas dhe nuk prekin kuotën [1][13][22].

**Cikli dhe bllokimi**
- Cikli i përdorimit me matje: "starts at 00:00:00 UTC on the first day of each month" dhe mbaron në fund të muajit. Kuota e përfshirë "resets to the full amount at the start of each billing cycle" [3]. Për Vrull, rinisja e radhës është **1.12.2026 00:00 UTC**.
- "If your account does not have a valid payment method on file, usage is blocked once you consume the included compute usage" [1]. E njëjta vlen për artifact-et dhe Packages [21].
- Me metodë pagese, përdorimi shtesë faturohet, dhe budget-et mund ta kufizojnë [1].

**Budget dhe njoftime**
- Te llogaria personale: Settings → Billing → Budgets and alerts → New budget → Product-level → Actions, me scope llogarinë ose një repo. Opsioni **"Stop usage when budget limit is reached"** e ndal përdorimin. Pa të vjen vetëm email-i: "usage **will not** be stopped". Njoftimet e budget-it vijnë te 75/90/100 % [5].
- Një budget i ri numëron vetëm përdorimin pas krijimit, ndaj muaji i parë mund ta kalojë kufirin [4].
- "Included usage alerts" (90 % dhe 100 % e kuotës falas) janë njoftime më vete dhe ndizen te e njëjta faqe [4][5].

**Ndryshimet e 2026**
- **1.1.2026**: çmimet e runner-ave GitHub ranë "by up to 39%" [7][8]. Sipas njoftimit, kuotat falas mbetën po ato [7].
- **Tarifa $0,002/min për runner-at self-hosted** (e planifikuar për 1.3.2026) **u shty**: "We're postponing the announced billing change for self-hosted GitHub Actions to take time to re-evaluate our approach". Data e re nuk jepet [7][9]. Faqja e faturimit sot i quan runner-at self-hosted falas [1].
- Endpoint-et "Get workflow usage" dhe "Get workflow run usage" (`/timing`) janë "closing down" (njoftimi i 2.2.2025). Zëvendësimi është usage endpoint-i i platformës së faturimit dhe usage report-i, i vetmi që ka hollësitë e workflow-it [10][11].

**Mjetet e workflow-it**
- `paths` / `paths-ignore` vlejnë vetëm për `push` dhe `pull_request`, dhe jo për tag-et. Një push me mbi 1 000 commit-e ose me diff që skadon niset gjithmonë [14].
- Një workflow i kapërcyer nga filtri ose nga `[skip ci]` e lë check-un "Pending", dhe kjo bllokon PR-të që e kërkojnë [14][15].
- `[skip ci]`, `[ci skip]`, `[no ci]`, `[skip actions]`, `[actions skip]` ose trailer-i `skip-checks: true` kapërcejnë të gjitha workflow-et `push`/`pull_request` të atij commit-i [15].
- `timeout-minutes` ka parazgjedhje 360 [14]. `concurrency` ka tani opsionin `queue: max`, që nuk lejohet bashkë me `cancel-in-progress: true` [14].
- Cache-i: hyrjet pa akses mbi 7 ditë fshihen, kufiri është 10 GB për repo, dhe një run lexon cache-in e degës së vet ose të degës kryesore [16]. `actions/cache` shkruan vetëm kur job-i mbaron me sukses [16]. MESIMET r. 14 e pa këtë në praktikë.
- `actions/download-artifact` merr artifact-e nga një run tjetër me `run-id` dhe `github-token` [19]. `retention-days` vendos ruajtjen për çdo artifact [20].

**Gradle**
- `gradle/actions/setup-gradle` v6 ka dy mënyra cache-i [17]:
  - **Enhanced** (parazgjedhje): "proprietary", me Gradle Technologies Terms of Use. Falas për repo publike, "Free Preview" për ato private, dhe "We plan to introduce usage-based pricing for large-scale commercial organizations".
  - **Basic** (`cache-provider: basic`, MIT): "the same caching strategy as `actions/setup-java` with `cache: gradle`".
- Dokumenti i tyre thotë të mos përdoret `setup-java` `cache: gradle` bashkë me `setup-gradle` [17].

**Emulatori**
- README-ja e `ReactiveCircus/android-emulator-runner` (Apache-2.0, commit i fundit 26.8.2026) rekomandon runner-at Ubuntu me KVM. Për nisje më të shpejtë sugjeron cache të AVD-së me snapshot: një hap krijon snapshot-in kur cache-i mungon, dhe nisjet e tjera përdorin `-no-snapshot-save` [18].

**Runner-at self-hosted**
- Janë falas te GitHub, por mirëmbajtja dhe makina janë përgjegjësia jote. Nuk kanë "a clean instance for every job" [22].
- Siguria: "Self-hosted runners … can be persistently compromised by untrusted code in a workflow". Edhe në repo private, kushdo që mund të hapë PR (zakonisht kush ka lexim) mund ta komprometojë runner-in dhe të arrijë secret-et. Rekomandohen runner-at ephemeral/JIT, që bëjnë "at most one job" [23].

### 2.2 Rekomandimet për Vrull, sipas ndikimit

Vlerësimet e kursimit janë për një periudhë si 7–9 nëntori.

**R1. Më pak nisje të dështuara të provës.** Kursimi i mundshëm është disa qindra minuta. Kjo është leva më e madhe.
- Para çdo `workflow_dispatch`, një kontroll i lirë statik në CI ose lokalisht: çdo tekst që `scripts/android-smoke.mjs` pret (`waitFor`, emrat e butonave) duhet të ekzistojë te katalogu `src/i18n`. Kështu kapet dështimi që MESIMET r. 10 dhe 23 e regjistroi dy herë, ekrani i ridizajnuar me skript të vjetër, në sekonda në vend të 8–18 minutave. (Përfundim. Nuk e provova.)
- Rregulli që ekziston (`skip` për pjesët e paprekura, vetëm pjesa që dështoi) mbetet. Prova e plotë niset vetëm në fund.
- `timeout-minutes: 60` mund të ulet në ~30, sepse nisja më e gjatë e suksesshme ishte 18,5 min. Kjo kufizon humbjen kur provës i ngec diçka (MESIMET r. 20: 33 min).
- Container-i i sesionit cloud të Claude-it nuk ka `/dev/kvm` (matje), ndaj emulatori nuk niset dot aty. Prova që ka nevojë për emulator mbetet te Actions ose te një runner self-hosted (R8).

**R2. CI-ja të mos niset për dokumente.** Kursimi ~100 min, ~6 % e totalit. Propozim, i pazbatuar:

```yaml
# .github/workflows/ci.yml
on:
  push:
    branches: [main]
    paths-ignore:
      - 'docs/**'
      - '**/*.md'
  pull_request:
    paths-ignore:
      - 'docs/**'
      - '**/*.md'
```

Kontrollova që `npm run lint` (`scripts/check-design.mjs` lexon vetëm `src/`) dhe provat nuk lexojnë skedarë `.md` ose `docs/`. Përmendjet te `music-*.test.ts` janë vetëm komente. `docs/whats-new/*.txt` e lexon vetëm `android-release.yml`, i cili ka filtrin e vet `paths`.

Kujdes: `[skip ci]` në një commit versioni kapërcen edhe lëshimin, sepse `android-release.yml` niset me `push` [15]. Për dokumentet, `paths-ignore` është më i sigurt se `[skip ci]`.

**R3. Më pak push-e te `main`, të grupuara.** 21 nisje të anuluara dhe 16 merge të veçanta tregojnë push-e të njëpasnjëshme. `cancel-in-progress` ndal nisjen e vjetër, por minutat e saj deri te anulimi paguhen [1]. Orkestratori mund të bëjë push një herë në fund të valës, pasi provat lokale të kenë kaluar. Ato bëhen gjithsesi në sesion.

**R4. Lëshimet vetëm në pikat kryesore.** Çdo lëshim kushton `plan` + prova (~17–18 min) + `apk` (~5 min) ≈ 24 minuta. Në 2,3 ditë pati 21 build-e APK. Vendimi i v2 për lëshime vetëm në pika kryesore e ul këtë (burimi është kujtesa e projektit, jo repo-ja). Rekomandim plotësues: job-i `apk` e përsërit `lint` dhe `test` që CI-ja sapo bëri për të njëjtin SHA. Ai mund ta kontrollojë statusin e CI-së për `GITHUB_SHA` dhe të bëjë vetëm `build`. Kursimi është ~2 min për lëshim, i vogël.

**R5. Ruajtje më e shkurtër e artifact-eve.** Hapësira është ~487 MiB nga 500 MB.
- `retention-days: 3` për `TrainingHub-*`, sepse APK-ja është edhe te Release-i dhe te Supabase-i.
- `retention-days: 3–5` për `android-smoke`. Pamjet e ekranit mund të ngarkohen vetëm kur prova dështon, ndërsa `report.json` gjithmonë.

Fshirja ul hapësirën që nga ai moment, por jo atë që është mbledhur tashmë këtë muaj [1].

**R6. Budget dhe njoftime.** Te Budgets and alerts: ndiz "Included usage alerts" (90/100 %). Nëse është shtuar metodë pagese, krijo një budget Actions me "Stop usage" te një shumë e vogël, p.sh. $10–15 në muaj [4][5]. Me $0,006/min, $10 janë ~1 650 minuta shtesë. Mos krijo budget-e që mbivendosen (produkt + SKU), sepse i pari që mbaron bllokon gjithçka [5].

**R7. Cache-i i AVD-së dhe Gradle-s: përparësi e ulët.**
- Gradle-s i duhen 0,2 min për cache dhe ~1 min për build, ndaj kalimi te `setup-gradle` sjell pak. Mënyra Enhanced është gjithashtu proprietare dhe në "Free Preview" për repo private [17]. Mbaje `setup-java` `cache: gradle`.
- Snapshot-i i AVD-së [18] fiton të shumtën ~1–2 min nga 2,9 min të nisjes, dhe vetëm nëse imazhi dhe snapshot-i hyjnë në 10 GB bashkë me cache-in e npm-së, të Gradle-s dhe të v1 [16]. Prova ndryshon edhe `config.ini` dhe kamerën virtuale. Para kësaj, mat sa e madhe del dosja `~/.android/avd`. (Përfundim. Nuk u mat.)
- `sleep 30` pas nisjes dhe instalimi i imazhit në çdo nisje mund të maten veç e veç me një nisje me kohë për hap.

**R8. Runner self-hosted vetëm për provën: opsion, jo hapi i parë.** Do t'i hiqte provën nga kuota, falas sot [1][9]. Por:
- emulatori x86_64 kërkon Linux me KVM (në Mac Apple Silicon duhet imazh arm64);
- kodi që shkruajnë agjentët ekzekutohet në makinën tënde [23];
- tarifa e shtyrë mund të kthehet [7].

Nëse bëhet: një VM e veçantë, runner ephemeral/JIT [23], vetëm job-i `smoke` (pa secret-et e nënshkrimit) dhe `runs-on: [self-hosted, linux, x64]`.

**R9. Matja.** Faqja e GitHub-it Billing → Usage, ose usage report-i CSV, jep minutat sipas repo-së dhe workflow-it [10]. API-ja `/timing` nuk vlen më për këtë.

---

## 3. Claude Code: tokenat dhe kostoja

Burimi: harta e dokumenteve [25] (`docs.anthropic.com/.../claude_code_docs_map.md` ridrejton te `code.claude.com`), pastaj faqet e veçanta.

### 3.1 Faktet

**Numrat zyrtarë**
- "the average cost is around $13 per developer per active day and $150-250 per developer per month, with costs remaining below $30 per active day for 90% of users", në përdorim enterprise [26].
- Agent teams përdorin "approximately 7x more tokens than standard sessions when teammates run in plan mode" [26].

**Si harxhohen tokenat**
- Çdo kërkesë dërgon gjithë bisedën. Prompt caching e lexon pjesën e pandryshuar me çmimin e cache-it, por pas skadimit të cache-it gjithçka përpunohet nga e para [26][28].
- Auto-compaction dhe `/compact` e përmbledhin bisedën. `/compact` është vetë një kërkesë e madhe, ndërsa `/clear` "costs nothing" [26][32].

**Sub-agjentët**
- Çdo sub-agent ka "its own context window" dhe kërkesat e veta, që numërohen te i njëjti limit [27].
- Një sub-agent jo-fork nis me: prompt-in e vet, mesazhin e detyrës, **gjithë hierarkinë e CLAUDE.md**, git status dhe aftësitë e parangarkuara. Nuk e sheh historinë e bisedës kryesore [27].
- Sub-agjenti nuk e lexon cache-in e prindit: "Its first request doesn't read the parent's cache", dhe e ndërton të vetin [28].
- Një **fork** e trashëgon bisedën dhe cache-in e prindit, ndaj "a fork costs less than a fresh subagent for tasks that need the same context" [27][28].
- "a fresh subagent first has to gather context your conversation already had, so it can end up *slower*" [32].
- Rezultatet e shumë sub-agjentëve kthehen në bisedën kryesore dhe e mbushin atë. Duhen kërkuar përmbledhje të shkurtra [27][32].
- Kufijtë: 20 sub-agjentë njëkohësisht, deri në 3 nivele brenda njëri-tjetrit [27].

**Modeli për çdo sub-agent**
- Fusha `model` pranon `sonnet`, `opus`, `haiku`, `fable`, një ID të plotë ose `inherit`. Mjeti Agent pranon gjithashtu parametrin `model` (vetëm alias) për një thirrje [27].
- Radha e zgjedhjes: parametri i thirrjes → `model` i përkufizimit → `CLAUDE_CODE_SUBAGENT_MODEL` → modeli kryesor. `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1` i detyron të gjithë [27].
- `opusplan` përdor Opus në plan mode dhe Sonnet në ekzekutim [33].
- Udhëzimi zyrtar: "Sonnet handles most coding tasks well and costs less than Opus. Reserve Opus for complex architectural decisions … For simple subagent tasks, specify `model: haiku`" [26]. Sub-agjenti me të njëjtin model "is not a smarter answer" [32].
- Edhe `effort` mund të vendoset për çdo sub-agent. Mendimi i zgjeruar faturohet si output dhe nuk fiket dot në Opus/Sonnet/Haiku 5.5. Me `effort` më të ulët ulet kostoja [26][27].

**Çmimet e API-së** (për MTok) [34]:

| Modeli | Input | Output | Cache read | Shënim |
|---|---:|---:|---:|---|
| Opus 5.5 | $4 | $20 | $0,20 | 0,05× e input-it |
| Sonnet 5.5 | $2 | $10 | $0,10 | 0,05× e input-it |
| Haiku 5.5 | $0,10 | $0,50 | $0,01 | për prompt ≤100k |

Shkrimi në cache kushton 1,25× (5 min) ose 2× (1 orë) [34].

**Prompt caching në Claude Code** [28]
- Me abonim, biseda kryesore ka TTL 1 orë, kurse sub-agjentët 5 min, përveç nëse vendoset `subagentPromptCacheTtl`.
- Ndërrimi i modelit e prish cache-in. Ndryshimi i effort-it e ruan cache-in në modelet 5.5 me abonim ose API key.
- Sesionet paralele në të njëjtën dosje mund ta lexojnë cache-in e njëri-tjetrit.

**CLAUDE.md**
- Ngarkohet në çdo sesion dhe te çdo sub-agent [27][30]. Synimi është "under 200 lines per CLAUDE.md file". Importet `@` "don't reduce its context cost" [30].
- Procedurat për një pjesë të punës duhen kaluar te aftësitë ose te rregullat me `paths:` [26][30].

**Aftësitë (progressive disclosure)**
- Para përdorimit, në kontekst janë vetëm emri dhe përshkrimi, "~100 tokens per Skill". Udhëzimet ngarkohen kur aftësia niset ("Under 5k tokens"), dhe skedarët e tjerë vetëm kur lexohen [35].
- Në Claude Code, përshkrimi + `when_to_use` priten te 1 536 shenja. E gjithë lista ka buxhet 1 % të dritares së kontekstit [29].
- Përmbajtja e një aftësie të nisur "stays in context across turns". Pas compaction ri-futet deri në 5 000 tokena për aftësi dhe 25 000 gjithsej [29][31].
- Çdo aftësi në listë "adds to your context on every turn, whether or not Claude ever uses it". `/skill-doctor` tregon koston e secilës [29].
- Mjetet MCP janë "deferred by default": në kontekst hyjnë emrat dhe udhëzimet e serverit. Serverët e papërdorur duhen fikur, dhe CLI-të (`gh`) janë "more context-efficient" [26].

**Mjetet e matjes**
- `/usage` ndan përdorimin sipas aftësive, sub-agjentëve, plugin-eve dhe MCP-ve, dhe sugjeron ndryshime kur një sjellje kalon 10 % [26][32].
- `/context` tregon çfarë zë vend në kontekst [31].
- Në këtë mjedis ka edhe aftësinë `explain-usage`.

### 3.2 Matje në këtë sesion

Si sub-agent, në kontekstin tim fillestar pashë:

- listën e rreth 100 aftësive, shumica pa lidhje me Vrull: ligjore, financë, të dhëna, Slack, product-management dhe ato të agjencisë së udhëtimit;
- disa qindra emra mjetesh MCP të shtyra (Higgsfield, Jotform, Mobbin, Google Calendar, remote-devices etj.), me udhëzimet e serverëve.

Sipas [26][29], këto hyjnë në çdo kërkesë të çdo agjenti. Numrin e saktë të tokenave nuk e mata dot, sepse `/context` nuk është në dispozicion brenda sub-agjentit.

Madhësia e dokumenteve të projektit (vlerësim i përafërt, 3–4 shenja për token):

| Skedari | Madhësia | Tokena (përafërsisht) |
|---|---:|---:|
| CLAUDE.md | 7,5 KB | ~2k |
| docs/SPEC.md | 142 KB | ~35–47k |
| docs/TICKETS.md | 54 KB | ~13–18k |
| DESIGN.md, GLOSSARY.md, MESIMET.md | 16–19 KB secili | ~4–6k secili |

### 3.3 Rekomandimet për orkestratorin e Vrull

**C1. Modeli sipas punës, me parametrin `model` te thirrja e Agent-it [27].**
- Orkestratori, planifikimi dhe aksi Adversarial i rishikimit: Opus.
- Zbatimi i një tiketi me specifikim të qartë, aksi Standards dhe aksi Spec: `sonnet`.
- Punë mekanike: `haiku`. Kjo përfshin leximin e log-ut të CI-së, gjetjen e rreshtit `Error:` sipas MESIMET r. 11, inventarin e skedarëve, kontrollin e lidhjeve dhe teksteve, dhe shtimin e një rreshti te MESIMET.
- Si parazgjedhje mund të vendoset `CLAUDE_CODE_SUBAGENT_MODEL=sonnet` te `.claude/settings.json` i projektit, **pa** `..._FORCE`. Kështu orkestratori mund të kërkojë ende `opus` kur i duhet [27].
- Në përqindje: Sonnet kushton gjysmën e Opus, dhe Haiku 1/40 [34]. Si i peshon abonimi modelet ndaj limitit nuk e gjeta në burim parësor.

**C2. Delegimi me tregues, jo "lexo SPEC-un".** Detyra e sub-agjentit duhet të përmendë § dhe rreshtat e SPEC/TICKETS që i duhen. Rregullat që duhet t'i dijë patjetër shkruhen te mesazhi [27]. Mund të shtohet një indeks te krye i SPEC.md, ose SPEC-u të ndahet sipas zonave. Kjo shmang 35–47k tokena për çdo sub-agent që e lexon të gjithë. (Përfundim.)

**C3. Raporte të shkurtra** (≤200–400 fjalë, siç bën tashmë supermatt `code-review`) dhe output-i i gjatë mbahet te sub-agjenti [27][32]. Për `npm test`, hook-u zyrtar shembull filtron vetëm dështimet [26], ose mund të përdoret `vitest` me reporter-in `dot`.

**C4. Hiq ngarkesën që nuk lidhet me Vrull.** Në sesionet e Vrull, fik plugin-et dhe connector-ët pa lidhje (Higgsfield, Jotform, financë, ligjore, Slack…). Aftësitë e rralla mund të vendosen te `skillOverrides` si `"name-only"` [29]. Para dhe pas, mat me `/context`, `/skill-doctor` dhe `/usage` [26][29]. Nuk e verifikova nëse sesionet cloud i lejojnë të gjitha këto cilësime për projekt.

**C5. Cache-i dhe pritjet.**
- Sub-agjentët kanë TTL 5 min [28]. Një sub-agent që pret 15–20 minuta për provën e Android-it dhe pastaj vazhdon e përpunon gjithë kontekstin nga e para.
- Prova mund të ndiqet nga orkestratori me një pritje të lehtë (Monitor ose `gh run watch` në sfond), dhe pastaj të niset një sub-agent i ri ose të vazhdojë ai i vjetri me një mesazh të shkurtër. Përndryshe mund të vendoset `subagentPromptCacheTtl: "1h"`, që e ka shkrimin 2× [28][34].
- Modeli dhe effort-i zgjidhen në fillim të sesionit [28].

**C6. Fork kur konteksti është i njëjtë, sub-agent i ri kur puna është e veçuar** [27][28]. Për worktree-t paralele me tiketa të veçanta duhet sub-agent i ri me brief të shkurtër. Për një detyrë anësore që i duhet gjithë biseda, fork-u është më i lirë.

**C7. `/clear` midis pikave kryesore dhe `/compact` me fokus te pushimet natyrale** [26][31]. Agent teams duhen shmangur (~7× tokena) [26].

**C8. Rishikimi me tre akse vetëm te bashkimet e mëdha.** Çdo aks është sub-agent me diff-in dhe standardet, plus validatorët e gjetjeve. Kostoja rritet me numrin e rishikimeve, jo me madhësinë e diff-it. `jury` (3–5 sub-agjentë) duhet ruajtur për vendime të rralla. (Përfundim.)

---

## 4. Aftësitë dhe plugin-et publike

Kriteret: kush e mban, licenca, aktiviteti (commit-i i fundit) dhe përshtatja me Vrull. Sipas [35], aftësitë janë udhëzime dhe kod. Merren vetëm nga burime të besuara dhe auditohen para përdorimit, njësoj si varësitë (rregulli i CLAUDE.md, `supermatt:dependency-vetting`).

### 4.1 Anthropic

| Aftësia / plugin-i | Çfarë bën | Mirëmbajtja / licenca | Përshtatja me Vrull |
|---|---|---|---|
| `anthropics/skills` › **skill-creator** | Krijon dhe përmirëson aftësi; evals me sub-agjentë të izoluar, kohë dhe tokena [29][36] | Anthropic, Apache-2.0; commit-i i fundit i repo-së 6.11.2026 [36] | **E mirë.** Për të kthyer procedurat e gjata në aftësi të projektit (p.sh. "prova e Android-it", "lëshimi") dhe për t'i mbajtur jashtë CLAUDE.md [26] |
| `anthropics/skills` › **webapp-testing** | Testim web me **Python** Playwright dhe `with_server.py` [36] | Apache-2.0; ndryshimi i fundit i dosjes 6.5.2026 | **E dobët.** Repo-ja është Node, ka `ds-screens.mjs` me Chrome headless dhe `supermatt:qa` |
| `anthropics/skills` › **claude-api** | Udhëzime për Claude API (modelet, caching, workflows) [36] | Apache-2.0; përditësim tetor 2026 | **Mesatare.** Për veçoritë me AI të app-it (kutia e AI-së, importi) |
| `anthropics/skills` › frontend-design | Drejtim vizual | Apache-2.0 | E instaluar tashmë; Vrull ka DESIGN.md të vetin |
| `claude-plugins-official` › **typescript-lsp** | Language server për TS/JS; "go to definition" në vend të grep + leximeve [26][37] | Anthropic; kërkon binarin `typescript-language-server` (varësi që duhet verifikuar) | **E mirë** për kursimin e leximeve në një repo TS kaq të madhe |
| `claude-plugins-official` › **session-report** | Raport HTML i tokenave, cache-it, sub-agjentëve dhe aftësive nga transkriptet lokale [37] | Anthropic | **E mirë** për C1–C5, nëse transkriptet janë në dispozicion në sesionin cloud (nuk u verifikua) |
| `claude-plugins-official` › claude-md-management, code-review, pr-review-toolkit | Auditim i CLAUDE.md; rishikim PR-je me shumë agjentë [37] | Anthropic | **E ulët.** Mbivendoset me supermatt `code-review` dhe `writing-for-agents` |
| `claude-plugins-official` › playwright (external) | Playwright MCP, `npx @playwright/mcp@latest` [37] | Microsoft; versioni `@latest` nuk është i fiksuar | **E ulët.** Vetë Microsoft thotë se CLI + SKILL është "more token-efficient" për coding agents [44] |
| `claude-plugins-official` › github (external) | MCP i GitHub-it, me PAT [37] | GitHub | **E ulët.** `gh` është tashmë aty, dhe CLI-të janë më të lira në kontekst [26] |

### 4.2 supermatt (aftësitë e Matt Pocock)

Burimi: `/root/.claude/plugins/synced/…/eb9bad6a-…/` [38]. `plugin.json` thotë "supermatt" v0.22.0, autorët "Leonid Svyatov and Matt Pocock", licenca MIT, repo `github.com/svyatov/supermatt`. CHANGELOG-u ka versionin e fundit më 17.10.2026. Plugin-i ka 39 aftësi. Në këtë sesion shfaqen 13 prej tyre.

| Aftësia | Çfarë bën | Përshtatja me Vrull |
|---|---|---|
| **tdd** | Red-green-refactor, prova integrimi | **E mirë.** CLAUDE.md e kërkon për logjikën pa UI |
| **code-review** | 3 akse (Standards, Spec, Adversarial), çdo aks me lexuesin e vet, me validator | **Në përdorim.** Shih C1 dhe C8 për modelin dhe shpeshtësinë |
| **qa** | Provon ndryshimin në program: CLI me tmux, web me shfletues | **E mirë** për web-in në 390 px. Emulatori nuk niset në cloud |
| **diagnosing-bugs** | Cikël diagnoze për defekte të vështira | **E mirë** për dështimet e provës së Android-it, para "flaky" |
| **improve-tests** | Mat suitën, heq provat pa vlerë, shkurton setup-in, dhe çdo prerje e provon me mutacion | **E mirë**, por e nisur me dorë (`disable-model-invocation: true`). CI ka >1 000 prova dhe ~3 min. Kërkon makinë të qetë, pa agjentë paralelë |
| **dependency-vetting** | Verifikon një paketë para instalimit | **E mirë.** Përputhet me rregullin e CLAUDE.md, edhe për aftësitë e këtij seksioni |
| **resolving-merge-conflicts** | Zgjidh konfliktet duke ndjekur arsyen e çdo ane | **E mirë** për worktree-t paralele (MESIMET "Bashkimet") |
| **writing-for-agents**, **domain-modeling**, **research** | CLAUDE.md dhe aftësitë; GLOSSARY dhe ADR; kërkimi | **Në përdorim** ose të dobishme |
| **retro**, **handoff** | Retrospektivë sesioni; dokument kalimi për agjentin tjetër | **Mesatare.** Retro ushqen MESIMET |
| **implement-spec**, **to-tickets** | Spec → tiketa → worktree paralele në një degë integrimi | **Mesatare.** Mbivendoset me orkestratorin ekzistues |
| **orchestrate** | Korsi paralele në Herdr dhe worktree | **Nuk përshtatet.** Kërkon "Herdr integration" dhe njoftim me `osascript` (macOS) |
| **ship-pr** | Commit, PR, riparim i CI-së "within bounded attempts", squash merge | **Kujdes.** `ci.yml` niset për `pull_request` dhe për `push`, ndaj kalimi në PR e dyfishon CI-në. Riparimi i CI-së harxhon minuta |
| **jury** | 3–5 sub-agjentë votojnë | **Vetëm për vendime të rralla**, sepse kushton |
| grilling, prototype, codebase-design, improve-architecture | Faza e dizajnit dhe arkitektura | Sipas nevojës |

### 4.3 GitHub Actions, Android, Capacitor, Playwright

| Burimi | Çfarë bën | Mirëmbajtja / licenca | Përshtatja |
|---|---|---|---|
| `github/awesome-copilot` › **github-actions-efficiency** [39] | Auditim i workflow-eve; rregulla mbrojtëse ("Does not hide required validation"); 3 ndryshimet kryesore sipas minutave të kursyera | GitHub, MIT | **Mesatare.** Për një auditim të ri pas ndryshimeve. Ky shënim mbulon tashmë 6 kandidatët e tij |
| `ionic-team/capacitor-skills` [40] | Gjenerues plugin-esh Capacitor, migrim Cordova→Capacitor, migrim UIScene (iOS), build actions për OutSystems | Ionic, blog 3.6.2026; commit-i i fundit 31.7.2026; **pa skedar LICENSE në rrënjë** (matje) | **E ulët–mesatare.** Gjeneruesi i plugin-eve mund të ndihmojë për plugin-e të reja native (Health Connect, ora). Licenca e paqartë → pyetje para përdorimit |
| `capawesome-team/skills` [41] | Përmirësime Capacitor (4→8), plugin-e, njoftime push, `capacitor-android-dex-optimization`, si dhe aftësi për shërbimet e tyre cloud | Capawesome, MIT; commit-i i fundit 4.11.2026 | **Mesatare.** Për përmirësime dhe plugin-e. Kujdes nga anshmëria e shitësit (`capawesome-cloud`) |
| `android/skills` [42] | Aftësi zyrtare Android: `wear-compose-m3`, `agp-9-upgrade`, `testing-setup`, `android-intent-security`, `android-permissions-security`, `edge-to-edge`, `android-cli` | Google, Apache-2.0; commit-i i fundit 9.11.2026 | **Mesatare.** E dobishme për app-in e orës (Wear OS) dhe për auditimin e sigurisë së receiver-ave dhe plugin-eve native. Shumica janë për Compose, jo për WebView/Capacitor |
| Playwright **test agents** (`npx playwright init-agents --loop=claude`) [43] | Planner, generator dhe healer krijojnë prova Playwright Test | Microsoft | **E ulët–mesatare.** Shton Playwright Test dhe dosjet `specs/`, `tests/`: një varësi e re. "Healer" mund ta kapërcejë një provë kur mendon se veçoria është e prishur [43]. Kjo nuk përputhet me rregullin "shiko pamjen e ekranit para se ta quash flaky" |
| `microsoft/playwright-cli` + SKILL [45] | CLI Playwright me aftësi, "Token-efficient" | Microsoft, Apache-2.0; commit-i i fundit 9.11.2026 | **Mesatare.** Për QA web në cloud, më lirë se MCP. Instalimi `@latest` duhet fiksuar në një version të verifikuar |

---

## 5. Çfarë nuk u vërtetua dhe pyetjet e hapura

- **Minutat e faturuara nga GitHub.** Vlerësimi im (1 724 min, $10,34) vjen nga koha e job-eve. Usage report-i i llogarisë nuk ishte i arritshëm nga ky sesion.
- **Pse bllokimi ndodhi rreth $9,93 dhe jo $12** (§1.4). Nuk e di nëse repo të tjera private, metoda e matjes ose produkte të tjera e mbushën kuotën.
- **Çfarë bëri përdoruesi për ta zgjidhur** (metodë pagese? budget?). Nisjet vazhduan në 18:54 UTC. Nëse u shtua metodë pagese, minutat mbi kuotë tani paguhen dhe R6 bëhet urgjent.
- **Mesazhi i saktë i UI-së për nisjet me 0 job-e.** API-ja nuk ktheu check run.
- **Data e re e tarifës për runner-at self-hosted** [7][9].
- **Si i peshon abonimi i Claude-it modelet ndaj limitit të përdorimit.** Çmimet e API-së [34] janë vetëm tregues.
- **Sa tokena saktësisht shton lista e aftësive dhe e mjeteve MCP në këtë sesion.** Duhet `/context` në sesionin kryesor.
- **Kursimi i snapshot-it të AVD-së dhe i `setup-gradle` Enhanced për këtë workflow.** Nuk u mat.
- **Nëse sesionet cloud lejojnë fikjen e connector-ëve të llogarisë për një projekt** (C4).

## 6. Hapat që i takojnë përdoruesit

1. Te github.com → Settings → Billing → Budgets and alerts: ndiz "Included usage alerts". Nëse ke metodë pagese, krijo një budget Actions me "Stop usage" [5].
2. Te Billing → Usage: shiko nëse ka repo të tjera që harxhojnë minuta këtë muaj.
3. Vendos për R1–R5 (ndryshime te workflow-et, në një degë të veçantë) dhe për C1–C4 (cilësimet e Claude Code dhe udhëzimet e orkestratorit).

---

## Burimet

Të gjitha u lexuan më 9.11.2026.

1. GitHub Docs, "GitHub Actions billing": https://docs.github.com/en/billing/concepts/product-billing/github-actions
2. GitHub Docs, "Actions runner pricing": https://docs.github.com/en/billing/reference/actions-runner-pricing
3. GitHub Docs, "Billing cycles": https://docs.github.com/en/billing/concepts/billing-cycles
4. GitHub Docs, "Budgets and alerts": https://docs.github.com/en/billing/concepts/budgets-and-alerts
5. GitHub Docs, "Setting up budgets to control spending on metered products": https://docs.github.com/en/billing/how-tos/set-up-budgets
6. GitHub, Pricing: https://github.com/pricing
7. GitHub Changelog, 16.12.2025, "Update to GitHub Actions pricing" (me shtyrjen): https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/
8. GitHub Changelog, 1.1.2026, "Reduced pricing for GitHub-hosted runners usage": https://github.blog/changelog/2026-01-01-reduced-pricing-for-github-hosted-runners-usage/
9. GitHub Resources, "2026 pricing changes for GitHub Actions": https://github.com/resources/insights/2026-pricing-changes-for-github-actions
10. GitHub Changelog, 2.2.2025, "Actions Get workflow usage and Get workflow run usage endpoints closing down": https://github.blog/changelog/2025-02-02-actions-get-workflow-usage-and-get-workflow-run-usage-endpoints-closing-down
11. GitHub REST, "Get workflow run usage": https://docs.github.com/en/rest/actions/workflow-runs#get-workflow-run-usage
12. GitHub Docs, "Viewing job execution time": https://docs.github.com/en/actions/how-tos/monitor-workflows/view-job-execution-time
13. GitHub Docs, "Billing and usage" (Actions): https://docs.github.com/en/actions/concepts/billing-and-usage
14. GitHub Docs, "Workflow syntax" (`paths`, Git diff comparisons, `timeout-minutes`, `concurrency.queue`): https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
15. GitHub Docs, "Skipping workflow runs": https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs
16. GitHub Docs, "Dependency caching reference": https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
17. gradle/actions: README, `docs/setup-gradle.md`, `DISTRIBUTION.md` (v6.4.1; commit-i i fundit 9.11.2026): https://github.com/gradle/actions
18. ReactiveCircus/android-emulator-runner, README (commit-i i fundit 26.8.2026): https://github.com/ReactiveCircus/android-emulator-runner
19. actions/download-artifact, README: https://github.com/actions/download-artifact
20. GitHub Docs, "Store and share data with workflow artifacts": https://docs.github.com/en/actions/tutorials/store-and-share-data
21. GitHub Docs, "GitHub Packages billing": https://docs.github.com/en/billing/concepts/product-billing/github-packages
22. GitHub Docs, "Self-hosted runners": https://docs.github.com/en/actions/concepts/runners/self-hosted-runners
23. GitHub Docs, "Secure use reference" (self-hosted runners, JIT): https://docs.github.com/en/actions/reference/security/secure-use
24. GitHub Docs, "Actions limits": https://docs.github.com/en/actions/reference/limits
25. Hartat e dokumenteve: https://docs.anthropic.com/en/docs/claude-code/claude_code_docs_map.md (→ code.claude.com) dhe https://docs.claude.com/en/docs_site_map.md (→ platform.claude.com/llms.txt)
26. Claude Code, "Manage costs effectively": https://code.claude.com/docs/en/costs
27. Claude Code, "Create custom subagents": https://code.claude.com/docs/en/sub-agents
28. Claude Code, "How Claude Code uses prompt caching": https://code.claude.com/docs/en/prompt-caching
29. Claude Code, "Extend Claude with skills": https://code.claude.com/docs/en/skills
30. Claude Code, "Store instructions and memories" (CLAUDE.md): https://code.claude.com/docs/en/memory
31. Claude Code, "Explore the context window": https://code.claude.com/docs/en/context-window
32. Claude Code, "Best practices": https://code.claude.com/docs/en/best-practices
33. Claude Code, "Model configuration": https://code.claude.com/docs/en/model-config
34. Claude API, "Pricing": https://platform.claude.com/docs/en/about-claude/pricing
35. Claude API, "Agent Skills overview": https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview
36. anthropics/skills (commit 2c5958e, 6.11.2026): https://github.com/anthropics/skills
37. anthropics/claude-plugins-official (commit 0412be7, 6.11.2026): https://github.com/anthropics/claude-plugins-official
38. supermatt v0.22.0 (kopja lokale e plugin-it; `plugin.json`, `LICENSE`, `CHANGELOG.md`, `skills/*/SKILL.md`): https://github.com/svyatov/supermatt
39. github/awesome-copilot, `skills/github-actions-efficiency/SKILL.md`: https://github.com/github/awesome-copilot/blob/main/skills/github-actions-efficiency/SKILL.md
40. Ionic, "Introducing Official Capacitor Skills" (3.6.2026): https://ionic.io/blog/introducing-official-capacitor-skills, dhe https://github.com/ionic-team/capacitor-skills
41. capawesome-team/skills: https://github.com/capawesome-team/skills
42. android/skills: https://github.com/android/skills
43. Playwright, "Test agents": https://playwright.dev/docs/test-agents, dhe burimi `docs/src/test-agents-js.md` te https://github.com/microsoft/playwright
44. microsoft/playwright-mcp, README: https://github.com/microsoft/playwright-mcp
45. microsoft/playwright-cli, README: https://github.com/microsoft/playwright-cli
46. Matje: GitHub REST API (vetëm lexim) për `keyeser33-hash/Vrull`: runs, jobs (`filter=all`), `/timing`, artifacts, rreth 21:00 UTC të 9.11.2026. Plus `git diff` lokal te `/home/claude/training-hub` dhe leximi i `.github/workflows/*.yml`, `CLAUDE.md`, `docs/MESIMET.md`.
