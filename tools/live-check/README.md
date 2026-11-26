# Provat live në 390 px

Mjetet që orkestratori dhe `vrull-builder` përdorin për të parë ekranet në Chrome pa ekran, me Supabase të rremë dhe pa rrjet.

- `build.sh`: build me `VITE_SUPABASE_URL=https://smoke.invalid`, kopjon `mock.js` në `index.html` dhe nis `serve.mjs` (porta 4173, `LIVE_PORT` e ndryshon). Shtyp skriptin që shërbehet dhe atë të build-it: duhet të jenë i njëjti (MESIMET: një server i huaj në portë shërbeu build-in e vjetër).
- `mock.js`: Supabase i rremë në shfletues (hyrja, REST, Storage, funksionet `log-parse`, `exercise-explain` etj.). `window.__explainStatus = 500` e bën shpjegimin të dështojë.
- `cdp.mjs`: `open()` nis Chrome me profil të përhershëm (`LIVE_PROFILE`, parazgjedhja `/tmp/live/profile`) në 390 × 844 dhe kthen `go`, `click`, `evaluate`, `waitFor`, `shot`, `sleep`, `errors`, `close`. `waitFor` do një shprehje boolean (`!!document.querySelector(...)`).
- `reset.mjs`: pastron gjendjen e ditës (story-t e para, check-in-i).

Shënime:
- Një profil i ri ose një portë e re nis nga hyrja dhe hapat e para: kaloji në një skript të vetëm, sepse çdo origjinë ka IndexedDB-në e vet.
- Gjuha ndërrohet te `/cilesimet/pamja` (gjuha e profilit mbishkruan `localStorage`).
- Shembull: `node -e "import('./tools/live-check/cdp.mjs').then(async ({ open }) => { const b = await open(); await b.go('/'); await b.shot('/tmp/sot.png'); await b.close() })"`.
