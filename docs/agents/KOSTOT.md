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
| Videot e Bench Press te të dhënat e app-it (E3-20, E3-23) | 15.11.2026, 05:28–05:40 | Vetëm orkestruesi, pa agjentë (kontrolli me built-in browser, provat dhe moduli, bordet); tokenat nuk u matën | 0 ([skip ci], provat lokale 1 649) | – | – | 2 mësime (kohëzgjatja nga player-i; ID-ja e tiketës) |
| Videot e 66 ushtrimeve të Shortcut to Size (E3-23) | 15.11.2026, 05:40–06:20 | Vetëm orkestruesi, pa agjentë: rreth 290 kërkime dhe 146 faqe videosh në built-in browser me skript, moduli me provat; tokenat nuk u matën | 0 ([skip ci], provat lokale 1 651) | – | – | 2 mësime (prezantuesi te RP; miniaturat e NASM) |
| Videot e 3 ushtrimeve të mbetura (E3-23) | 15.11.2026, 06:05–06:40 | Vetëm orkestruesi: rreth 20 kërkime dhe 10 faqe videosh në built-in browser, 6 kërkime për titujt e autorëve; tokenat nuk u matën | 0 ([skip ci]) | – | – | – |
| Udhëzuesit e Shortcut to Size, vala 0 (E3-21) | 15.11.2026, 06:10–08:10 | Rreth 3,9 milionë: 8 agjentë kërkimi me Sonnet (rreth 2,4 me ndreqjet) dhe 8 kontrollues `vrull-reviewer` (rreth 1,5); orkestruesi lexoi me shfletues rreth 30 përshkrime videosh | 0 ([skip ci]) | – | 19 P1, rreth 80 P2 | 4 mësime (Wilk nga teksti i plotë, kuptimi i fushave, skedarët e përkohshëm, përkufizimi i ushtrimit) |
| Sot i ri, vala 1 (E3-34a) | 15.11.2026, 23:05 – 16.11.2026, 01:15 | Rreth 380 mijë (`vrull-builder` me Sonnet) plus kontrolli i orkestruesit në 390 px | CI 1 (e gjelbër) | – | 3 të gjetura në 390 px (java 0/1, uji pas 2–4 s, "Pa program" gjatë leximit) | 2 mësime |
| Sot i ri, story-t (E3-34b) dhe "Vetëm sot" (V64) | 16.11.2026, 01:20–03:30 | Rreth 300 mijë (`vrull-builder` me Sonnet); V64 nga orkestruesi | CI 2, prova e Android-it 1 (të gjelbra) | – | – | – |
| Faktet e Mëso-s (E3-34c) | 16.11.2026, 04:10–05:40 | Rreth 2,9 milionë: 10 agjentë kërkimi me Sonnet (rreth 1,75 me ndreqjet) dhe 6 kontrollues `vrull-reviewer` (rreth 0,95) për 100 fakte | 0 | – | 1 P1, rreth 25 P2, rreth 40 P3 | – |
| Faqja e ushtrimit dhe lëvizja (E3-34d-1) | 16.11.2026, 04:15–04:40 | Rreth 300 mijë (`vrull-builder` me Sonnet) | CI 1, prova e Android-it 1 (të gjelbra) | – | – | 1 mësim (`git add` emërtimisht) |
| Seanca me tabelën (E3-34d-2) | 16.11.2026, 05:00–06:25 | Rreth 670 mijë (`vrull-builder` me Opus: arkitekturë e re e seancës) | CI 1, prova e Android-it 1 (të gjelbra) | – | – | – |
| Mëso, kodi (E3-34c) | 16.11.2026, 06:50–08:15 | Agjenti i parë u ndal nga rinisja e serverit pas 47 min (pa raport); i dyti mbaroi me rreth 200 mijë | 0 | – | – | 1 mësim (rinisja pa raport) |
| Boshllëqet e bordeve (E3-34e) dhe rishikimi | 16.11.2026, 11:40–13:05 | Rreth 360 mijë (`vrull-builder` me Sonnet); rishikimi rreth 610 mijë (`vrull-reviewer` ×2 rreth 350, `vrull-adversary` rreth 255) | 0 deri te push-i | – | 5 P2, rreth 10 P3 | 2 roja (`story-viewer.test.tsx` për ←, prova e `postpone` me numëruesin) |
