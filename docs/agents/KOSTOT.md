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
