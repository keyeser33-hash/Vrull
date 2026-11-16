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
- [ ] Trupi 3D, drita dhe kamera (V53): te Rikuperimi dhe te Volumi javor muskujt ndriçojnë, dhe kthimi me gisht është i rrjedhshëm (pa ngecje) edhe kur shumë muskuj kanë aureolë.
- [ ] Te trupi i plotë, rrëshqitja lart-poshtë mbi model e lëviz faqen; zvarritja anash e kthen trupin. Dy gishta afrojnë te vendi ku janë; pastaj një gisht e anon kamerën edhe lart-poshtë, dhe "Pamja e plotë" kthen te fillimi.
- [ ] Shina e këndeve (Para, 3/4, Anash, Mbrapa) e kthen trupin butë; prekja e një muskuli hap kartën me vijën te muskuli, dhe "×" kthen te trupi i plotë.
- [ ] Cilësimet › Gjuha › English: njoftimi i seancës kalon në anglisht.
- [ ] Butoni mbrapa i Android-it kthen te faqja e mëparshme; te Sot e çon app-in në sfond.

## 6. Ushqimi i ri, auditimi dhe PDF-ja (0.26.0, 4 min)

- [ ] Sot, në një telefon pa lejen e njoftimeve: "Fillo stërvitjen" hap fletën "Njoftimi i pushimit"; "Lejo njoftimet" kërkon lejen e Android-it, "Jo tani, fillo pa to" e nis seancën. Butoni tregon "Po fillon" dhe nuk zbehet.
- [ ] Ushqimi: "Si në plan" te vakti i radhës shton vaktin dhe njoftimi "Zhbëj" e heq; uji +250 dhe "Zhbëj" po ashtu, pa vonesë të dukshme.
- [ ] "Çfarë hëngre?" → shkruaj "pule" → rezultatet dalin pa internet; "+" e shton në shportë; "Shto te vakti" kthen te Ushqimi me njoftimin.
- [ ] Barkodi nga fusha hap kamerën; produkti i gjetur hap sasinë.
- [ ] "Plotëso makrot": në mes të ditës thotë "Plani i ditës e mbush proteinën" (ose çfarë mungon); në mbrëmje propozon deri në 3 kombinime.
- [ ] Kutia e AI-së bosh: kufiri i muajit është 40 € për pronarin.

- [ ] Ushqimi › Objektivat: zgjidh "Plani i Jimit"; Plani im tregon "Si te PDF-ja", 3 vezë te mëngjesi 2 dhe salmon 227 g te darka.
- [ ] Me stërvitje në 18:00, vakti pas stërvitjes del rreth 19:00, dhe darka 1 orë më pas.

## 7. Sot i ri, seanca e re dhe Mëso (0.27.0, 6 min)

Para instalimit: migrimi `20261116090000_learn_events.sql` te Supabase › SQL Editor (pa të, Cilësimet dhe "A e dije?" nuk sinkronizohen).

- [ ] Sot: tre matësit në krye; prekja e ujit e rrit numrin menjëherë dhe "Zhbëj" e kthen; shtypja e gjatë hap 250, 330, 500 ml.
- [ ] Vija e ditës: prekja e një pike hap vaktin; rrëshqitja e gishtit tregon flluskën pa lëvizur faqen; shtypja e gjatë mbi darkën e lëviz dhe thotë "për sot"; nesër darka është në orën e zakonshme.
- [ ] Rripi i javës: prekja e një date të kaluar hap fletën me seancën dhe ushqimin; e nesërmja tregon stërvitjen e planifikuar.
- [ ] "Si ndihesh?": 4 pyetje si story, pastaj gatishmëria; rrethi bëhet "Gati N%". Rikujtuesi i mëngjesit hap story-n.
- [ ] Seanca: tabela me setet, "Ruaj setin" → rreshti i ruajtur dhe "Zhbëj" menjëherë; "Zhbëj" ndal pushimin dhe njoftimin e tij; prekja e një seti të kaluar e ndryshon (edhe te ushtrimi i mëparshëm nga lista).
- [ ] Gjatë pushimit: tabela poshtë unazës; karta "A e dije?" nuk e mbulon "Ruaj setin".
- [ ] "Mbyll stërvitjen" kalon nga "Kontrollo setet".
- [ ] Faqja e Bench Press: lëvizja me dy foto, "Shiko videon" luan brenda app-it, udhëzuesi me "Burimi" poshtë çdo seksioni.
- [ ] Mëso: "A e dije?" te Sot hap story-n me burimin; të dielën pas 20:00 rrethi "Kuizi"; Progresi › Mëso tregon faktet e para.
- [ ] Cilësimet › Mëso: çelësi "A e dije?" i fik kartat.
