# Kostot sipas valës

Retro e çdo vale shton një rresht këtu (`docs/agents/ORKESTRIMI.md`, hapi 9). Krahasimi mes valëve tregon nëse mënyra e punës po përmirësohet. Kur një kosto rritet, shkaku shkruhet si mësim te `docs/MESIMET.md`.

Matjet:
- **tokenat**: shuma e `subagent_tokens` te njoftimet e agjentëve, pa orkestruesin;
- **minutat**: `node scripts/actions-usage.mjs --since <fillimi i valës>`, vlerësim nga koha e job-eve;
- **prova e Android-it**: nisjet që kaluan dhe ato që ranë;
- **gjetjet**: P0–P2 të rishikimit.

| Vala | Data | Tokenat e agjentëve | Minutat e Actions | Prova e Android-it (kaluan / ranë) | Gjetjet P0–P2 | Mësime / roje të reja |
|---|---|---|---|---|---|---|
| 0.21–0.23 (gjithë periudha) | 7–9.11.2026 | 0.23: rreth 4,15 milionë, të gjitha me Opus; 45 % rishikimi dhe riparimi | Rreth 1 724; 37 % prova që ranë | 98 nisje, 59 ranë | 0.23: 5 P2 (dhe 7 P3) | 5 mësime për punën me agjentë; roja `smoke-texts.test.ts` |
| Lëshimi 0.23.0 | 9.11.2026, 20:04–21:05 | Rreth 0 (orkestruesi vetëm) | Rreth 84 (porta e parë ra: 22) | 1 / 1 | – | Mësimi `triggerEvent`; gabimet e provës me `[pas: …]` |
| Bordet e 0.24 (E3-01) | 9.11.2026, 23:10–23:35 | Rreth 427 mijë, tre agjentë me Sonnet, me ndreqjet | 0 | – | – | Mësimi për elementet e përbashkëta të bordeve |
| Vala e gatishmërisë (E3-02 … E3-07) | 9–10.11.2026, 22:30–00:40 | Rreth 2,2 milionë: ndërtimi 0,89 (4 agjentë, Sonnet), rishikimi 0,80 (2 Sonnet, 1 Opus), ndreqjet 0,53 (2 Sonnet) | Rreth 45, vetëm CI | – (pa native; prova shkon me valën e Health Connect) | 1 P1, 10 P2, të gjitha me provë që bie para ndreqjes | 5 mësime; roja `clock-guard.test.ts` |
| Trupi 3D dhe lëshimi 0.24.0 (E3-10, E3-11) | 11.11.2026, 01:25–02:53 | 0 (pa agjentë; sesioni kryesor) | Rreth 44: lëshimi 30, CI 7, dy nisje të anuluara 7 | 1 / 0 (porta e lëshimit, e para me valën e gatishmërisë) | Pa rishikim me agjentë; provat e reja me 16 mutacione, të gjitha të kapura | 3 mësime (ora e fiksuar pa të dhëna të fiksuara, dy alarme të rreme të QA-së, java kalendarike te të dhënat e provës) |
| Bordet e Mëso (E3-12) | 15.11.2026, 02:05–02:20 | Rreth 540 mijë, tre agjentë me Sonnet, me dy ndreqje me SendMessage | 0 | – | – | 4 mësime (datat e historisë, numrat e bordit, `read_file` me `project/`, PubMed pa WebFetch) |
| Kuizi si story dhe Sot me story (E3-12) | 15.11.2026, 02:21–02:40 | Rreth 306 mijë, dy agjentë me Sonnet | 0 | – | – | Bordet shihen me built-in browser pas publikimit (ORKESTRIMI › Bordet e dizajnit) |
| Sot i ri (E3-19, bordet) | 15.11.2026, 02:41–02:55 | Rreth 201 mijë, një agjent me Sonnet | 0 | – | – | Numrat e bordeve nga një tabelë e vetme te brief-i (ORKESTRIMI › Bordet e dizajnit) |
| Sot unik, variantet A dhe B (E3-19) | 15.11.2026, 02:58–03:05 | Rreth 139 mijë, një agjent me Sonnet | 0 | – | – | Numrat e ditës nga logjika e app-it (`mealSchedule`) te tabela e brief-it |
| Rishikimi kritik dhe dizajni final 0.40 (E3-12, E3-19) | 15.11.2026, 03:35–03:50 | Dy agjentë me Sonnet (gjashtë borde të Sot-it me B, vargu i Mëso-s dhe muskujt EN); tokenat e tyre nuk u ruajtën | 0 | – | – | 2 mësime (përsëritjet e javës te brief-i, menuja ▷) |
| Bordet e seancës së re dhe udhëzuesi i Bench Press (E3-20) | 15.11.2026, 04:05–04:35 | Rreth 684 mijë, katër agjentë me Sonnet (kërkimi 150, seanca 203, pushimi dhe lëvizja 176, faqja e ushtrimit 155), plus kontrolli i burimeve nga orkestruesi | 0 | – | – | 3 mësime (karta që zgjatet, prushi dhe vjollca si dekor, emri i gabuar në draftin e kërkimit) |
| Kontrolli i dytë i burimeve të udhëzuesit (E3-20) | 15.11.2026, 05:03–05:10 | Rreth 165 mijë (një agjent me Sonnet që përditësoi dy bordet) plus kërkimi i orkestruesit | 0 | – | – | 1 mësim (rekomandimi nga rishikimet, jo nga protokolli i një studimi) |
| Burimet e reja dhe videot në YouTube (E3-20) | 15.11.2026, 05:12–05:25 | Vetëm orkestruesi, pa agjentë (kërkimi, dy bordet e udhëzuesit me skript, katër borde të tjera); tokenat nuk u matën | 0 | – | – | 2 mësime (metadata e YouTube nga built-in browser; paneli i fshehur) |
