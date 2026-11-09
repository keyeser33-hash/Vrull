# Prova në telefon pas një versioni të ri

Rreth 10 minuta, një herë pas çdo versioni që ndryshon pjesën native (0.20.0 i pari). Prova në emulator (`android-smoke.yml`) i kalon të gjitha këto me kamerë virtuale dhe një app muzike prove; këtu provohen me telefonin, kamerën dhe muzikën e vërtetë. Kur një hap nuk shkon, shkruaj hapin dhe çfarë pe: kjo bëhet provë e re (docs/MESIMET.md).

## 1. Përditësimi (2 min)

- [ ] Te 0.16.0: përditësimi te Cilësimet (ose njoftimi i versionit të ri) → shkarkohet dhe instalohet.
- [ ] Njoftimi "Vrull u përditësua" del.
- [ ] App-i hapet te Sot pa hyrje të re; seanca e hapur, matjet, ushqimi dhe fotot e mëparshme janë aty.

## 2. Seanca dhe njoftimi (3 min)

- [ ] "Fillo stërvitjen", ruaj një set: pushimi nis.
- [ ] Kyçe telefonin: "Pushimi mbaroi" vjen në kohë, me ekran të fikur.
- [ ] Nga njoftimi me ekran të kyçur: "Ruaj setin" kalon te seti tjetër pa shkyçur telefonin.
- [ ] Hape app-in: seti i ruajtur nga njoftimi është aty, me orën e prekjes.

## 3. Videoja e formës (2 min)

- [ ] Ikona e kamerës te seanca: Android-i kërkon lejen e kamerës një herë.
- [ ] Regjistro 5 s, "Ruaj te seti": videoja luhet te ushtrimi.
- [ ] Gjatë regjistrimit shtyp Home, pastaj kthehu: regjistrimi është ndalur dhe mbajtur ("Regjistruar 0:0…"), kamera hapet sërish. Drita e kamerës nuk mbetet ndezur kur app-i është në sfond.
- [ ] "Ndërro kamerën" kalon te kamera e përparme.
- [ ] Me mënyrën e aeroplanit: videoja ruhet; kur kthehet rrjeti, ngarkohet.

## 4. Muzika (2 min)

- [ ] Te seanca: "Lidh muzikën tënde" → "Qasja te njoftimet" → ndize Vrullin → kthehu: karta ikën.
- [ ] Luaj diçka në Spotify ose YouTube Music: kënga dhe tempo (BPM) dalin te seanca.
- [ ] "Kënga tjetër" te seanca e ndërron këngën.
- [ ] Te njoftimi i seancës: pauzë, luaj, para dhe mbrapa punojnë, edhe me ekran të kyçur.

## 5. Pjesa tjetër (1 min)

- [ ] Trupi 3D vizatohet dhe rrotullohet (emulatori shpesh nuk ka WebGL).
- [ ] Progresi › Trupi › matjet › "Makina e kohës" (me të paktën dy matje): "Luaj nga fillimi" kalon ndalesat pa ngecur, edhe me "Thekso ndryshimin"; modeli rrotullohet gjatë luajtjes.
- [ ] Cilësimet › Gjuha › English: njoftimi i seancës kalon në anglisht.
- [ ] Butoni mbrapa i Android-it kthen te faqja e mëparshme; te Sot e çon app-in në sfond.
