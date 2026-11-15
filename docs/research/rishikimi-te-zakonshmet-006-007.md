# Rishikimi i të zakonshmeve të Listës së Vrullit (rank 502–700)

Çfarë u kontrollua: 199 hyrjet e `tools/food-catalog/common/006.json` (100) dhe `007.json` (99), dega `feat/lista-te-zakonshmet-4`, me rreshtin `preferred` dhe çdo `also` të lexuar nga `/tmp/food-out/catalog-all.jsonl` me skriptet te `/tmp/review3/` (`join.py`, `find.py`, `similar.py`, `verify_ids.py`). Asnjë skedar i repo-s nuk u ndryshua.

Rregullat e matjes: SPEC V61 dhe §0.3h, `docs/agents/PLANI-LISTA-E-VRULLIT.md`, `tools/food-catalog/README.md` › "Të zakonshmet (V61)", dhe gabimet e `docs/research/rishikimi-te-zakonshmet-001-003.md` dhe `-004-005.md`.

Shenjat: [V] = e parë me skript ose mjet në këtë sesion; [S] = gjykimi im; [D] = e thënë në një dokument (me seksionin). Hyrjet në rregull dhe `also` që thjesht mungojnë nuk renditen.

[V] `node tools/food-catalog/common-list.mjs /tmp/food-out/catalog-all.jsonl`: 699 të zakonshme, 0 gabime, 13 shënime, asnjë te 006–007 (as `includes_fiber_preferred`). [V] Çdo ID e propozuar më poshtë ekziston te `catalog-all.jsonl` dhe nuk përdoret nga asnjë hyrje tjetër (përveç atyre që janë tashmë te e njëjta hyrje).

## 1. Përputhje të gabuara

Modeli kryesor këtu është `reason` që nuk është i vërtetë: thotë se USDA ose SR nuk e ka ushqimin, por katalogu e ka (#506, #516, #519, #537, #538, #605, #607, #617, #665, #679). Vërtetimi nuk e kap, sepse rreshti më i preferuar nuk është anëtar i hyrjes.

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 502 | soup-chicken | [V] I preferuari është lëng pule (stock), kurse `also` ciqual-25901 është supë pule me perime. | Hiqe ciqual-25901. | i mundshëm |
| 503 | soup-chicken-noodle | [V] I preferuari usda-fdc-171543 është supa e koncentruar (48 kcal), jo si hahet; SR ka usda-fdc-172909 "prepared with equal volume water" (24 kcal). #506 dhe #505 e përjashtojnë të koncentruarën me `reason`. | `preferred` usda-fdc-172909, 2709149 (53 kcal) jashtë; ose `preferred` usda-fdc-2709149 me `reason` ("supa e shtëpisë; SR vetëm e konservuar") dhe 171543 jashtë. | i sigurt |
| 505 | soup-bean | [V] `reason` "SR ka vetëm supat e konservuara të koncentruara" nuk është i saktë: SR ka usda-fdc-172903 (fasule të zeza, e holluar), 172904 (me mish derri, e holluar), 171144 (me proshutë, gati). Zgjedhja mund të mbetet. | `reason`: "SR ka vetëm supa fasulesh të zeza ose me mish". | i mundshëm |
| 506 | soup-tomato | [V] `reason` nuk është i vërtetë: SR usda-fdc-171176 "Soup, tomato, canned, prepared with equal volume water" (32/0,7/7/0,2) ka pothuajse vlerat e FNDDS-it të preferuar (34/0,6/7,1/0,3). | `preferred` usda-fdc-171176; `also` 2709759, ciqual-25914, cofid-17-636; pa `reason`. | i sigurt |
| 508 | soup-cream-mushroom | [V] I preferuari usda-fdc-171155 është supa e koncentruar (79 kcal); SR ka usda-fdc-174540 "prepared with equal volume low fat (2%) milk" (65 kcal), si livsmedelsverket-494 ("heated w/ milk", 64). | `preferred` usda-fdc-174540; `also` 2710107, livsmedelsverket-494; 171155 jashtë. | i sigurt |
| 516 | beef-stew-potatoes | [V] `reason` "USDA ka vetëm gjellën portorikane" nuk është i vërtetë: FNDDS usda-fdc-2706592 "Stew, beef" (107) dhe SR usda-fdc-173330 "Beef stew, canned entree" (99). I preferuari është sjömansbiff suedez me birrë. | `preferred` usda-fdc-2706592 me `reason` ("SR ka vetëm gjellën e konservuar"); `also` cofid-19-473 (105); livsmedelsverket-2092 jashtë. | i sigurt (`reason`); i mundshëm (zgjedhja) |
| 519 | peppers-stuffed-meat-rice | [V] `reason` "USDA nuk ka speca të mbushur" nuk është i vërtetë: FNDDS usda-fdc-2709073 "Stuffed pepper, with rice and meat" (178, Y 11,7). | Ose `preferred` usda-fdc-2709073 (cofid-19-632, 99 kcal, jashtë si ushqim tjetër), ose `reason` i saktë ("FNDDS 178 kcal, Y 11,7, larg recetës së shtëpisë"). | i sigurt |
| 520 | cabbage-rolls | [V] `also` cofid-19-631 është me mish qengji, i preferuari me mish gjedhi. | Hiqe cofid-19-631. | i mundshëm |
| 522 | vegetable-stew | [V] `also` livsmedelsverket-6934 është gjellë me patëllxhanë (tapsi), jo gjellë perimesh e përgjithshme. | Hiqe. | i mundshëm |
| 537 | potato-pan-fried | [V] `reason` "USDA ka vetëm patatet e skuqura të ngrira dhe hash brown" nuk është i saktë: FNDDS usda-fdc-2709474 "Potato, home fries, from fresh" (185, Y 11,5). | Ose `preferred` usda-fdc-2709474, ose `reason`: "FNDDS 185 kcal, Y 11,5, më e yndyrshme se Ciqual dhe Livsmedelsverket". | i mundshëm |
| 538 | pizza-vegetable | [V] `reason` flet vetëm për SR; FNDDS ka picë me djathë dhe perime (usda-fdc-2708627, restorant, 242; 2708624, e ngrirë, 240). Ciqual-25472 përfshin edhe picën "4 stinët" (me proshutë). | `preferred` usda-fdc-2708627 me `reason` ("SR ka vetëm picën me mish dhe perime"); `also` ciqual-25472. | i sigurt |
| 549 | cranberry-juice | [V] `also` usda-fdc-2709317 është "Cranberry juice blend" (përzierje lëngjesh). Foundation usda-fdc-2003594 "Cranberry juice, not fortified, from concentrate" ekziston pa `reason` (31,3 kcal kundrejt 46). | Hiqe 2709317; `reason` për Foundation ("Foundation nga koncentrati, 31 kcal, larg SR"), ose `preferred` 2003594. | i sigurt (përzierja); i mundshëm (Foundation) |
| 553 | rice-pudding | [V] `also` livsmedelsverket-655 "Risgrynsgröt" është qull orizi pa sheqer (K 13,3 kundrejt 18,1). | Zëvendësoje me ciqual-39212 "Rice pudding, vanilla, cinnamon or plain" (121). | i mundshëm |
| 585 | pollock-cooked | [V] `also` ciqual-26192 "Lieu jaune ou colin, cuit" është pollack evropian (lloj tjetër); Ciqual e ndan nga "Lieu ou colin d'Alaska" (ciqual-26006, te #382). CoFID ka cofid-16-436 "Pollock, Alaskan, flesh only, baked" (124). | Zëvendësoje ciqual-26192 me cofid-16-436. | i sigurt |
| 588 | rice-basmati-raw | [V] I preferuari ciqual-9119 është "Riz thaï ou basmati" (bashkon orizin tailandez). | `preferred` cofid-11-857 me `reason` ("USDA nuk ka basmati; Ciqual e bashkon me orizin tailandez"); ciqual-9119 jashtë. | i mundshëm |
| 591 | polenta-dry | [V] `reason` "USDA nuk ka polentë të thatë": SR usda-fdc-168867 "Cornmeal, degermed, enriched, yellow" (370/7,1/75,6/1,8) është i njëjti produkt, me vlera afër Ciqual (350/7,9/74/1,8). | `preferred` usda-fdc-168867; `also` ciqual-9614, livsmedelsverket-6872; ose `reason` i saktë. | i mundshëm |
| 600 | english-muffin | [V] I preferuari usda-fdc-172761 është muffin "wheat" (varianti me krunde); SR usda-fdc-174994 "Muffins, English, plain" ka vlerat identike me FNDDS 2707698 (227/8,9/40,7/1,7/3,5). | `preferred` usda-fdc-174994; `also` 2707698, ciqual-7257, cofid-11-541; 172761 jashtë. | i sigurt |
| 605 | french-toast | [V] `reason` "SR ka vetëm french toast të ngrirë dhe shkopinjtë" nuk është i vërtetë: SR usda-fdc-174998 "French toast, prepared from recipe, made with low fat (2%) milk" (229). | `preferred` usda-fdc-174998, FNDDS te `also`; ose `reason`: "SR pa fibra të njohura". | i sigurt |
| 607 | brioche | [V] I preferuari ciqual-7210 "Pain de mie brioché" është bukë sanduiçi në feta, jo briosh; `reason` "USDA nuk ka briosh" nuk është i vërtetë: FNDDS usda-fdc-2707682 "Brioche" (427, Y 27,5). | `preferred` ciqual-7746 "Brioche (average)" (363) me `reason` ("FNDDS 427 kcal, Y 27,5, larg briosheve të Ciqual"); ciqual-7210 jashtë. | i sigurt |
| 617 | candy-hard | [V] `reason` nuk është i vërtetë: SR usda-fdc-167990 "Candies, hard" ka vlerat identike me FNDDS (394/0/98/0,2). `also` ciqual-31094 është karamele e fortë me yndyrë (Y 7,1). | `preferred` usda-fdc-167990; `also` 2710360, ciqual-31059 "Hard candy and lollipop"; ciqual-31094 jashtë. | i sigurt |
| 618 | candy-gummy | [V] FNDDS "Candy, gummy" ka vlerat identike me SR usda-fdc-167989 "gumdrops, starch jelly pieces" (396, P 0: me niseshte). Emri thotë xhelatinë; sheqerkat me xhelatinë kanë P 5–6,5 (ciqual-31060 "Jelly candy", 339; cofid-17-107 "Fruit gums/jellies", 324). | Ose `preferred` usda-fdc-167989 me `also` 2710359 dhe emri "Sheqerka me niseshte (gumdrops)"; ose `preferred` ciqual-31060 me `reason` ("USDA ka vetëm sheqerkat me niseshte"), `also` cofid-17-107, emri "Sheqerka me xhelatinë (gummy)". | i mundshëm |
| 620 | pudding-vanilla | [V] `also` livsmedelsverket-1770 "Vaniljpudding" (P 3,7, Y 8,4) është krem me vezë; i preferuari (P 1,5, Y 3,8) është puding i gatshëm. | Hiqe. | i mundshëm |
| 624 | hard-cider | [V] `also` livsmedelsverket-1903 është "Cider vol. % 1" (1 % alkool, K 10,1). | Hiqe. | i sigurt |
| 626 | vegetable-juice-mixed | [V] `also` livsmedelsverket-503 është lëng perimesh i fermentuar, kurse i preferuari është kokteil perimesh me domate. | Hiqe. | i mundshëm |
| 661 | quail-egg-raw | [V] `also` usda-fdc-2707178 është "Quail egg, canned" (gjendje tjetër; vlerat identike me SR). | Hiqe. | i mundshëm |
| 665 | byrek-spinach | [D] SPEC §0.3h › "Pjatat shqiptare": byreku bëhet recetë e Vrullit (V31). [V] I preferuari cofid-15-840 "Pie, spinach" (K 8,6, Y 13,3) është pite britanike; `reason` "USDA nuk ka byrek me spinaq" nuk është i vërtetë: FNDDS usda-fdc-2708729 "Spanakopita" (212/8,3/9,4/15,2); edhe livsmedelsverket-6948 "Börek m. spenat fetaost" (207). | Vendos Andi: hyrja hiqet dhe byreku mbetet recetë (V31); ose `preferred` usda-fdc-2708729, `also` livsmedelsverket-6948, cofid-15-840 jashtë. Fjalia e SPEC-ut "asnjë tabelë e hapur nuk ka byrek" nuk vlen më për Livsmedelsverket. | i sigurt |
| 667 | fried-rice-meatless | [V] `also` usda-fdc-2708952 është "Rice, fried, NFS"; FNDDS ka usda-fdc-2708951 "Rice, fried, meatless" me vlera identike. | Zëvendësoje me usda-fdc-2708951. | i mundshëm |
| 677 | banana-dried | [V] SR usda-fdc-173945 "Bananas, dehydrated, or banana powder" ka P/K/Y/F identike me ciqual-13089 (3,9/78,4/1,8/9,9); `reason` e quan vetëm pluhur. | `preferred` usda-fdc-173945; `also` ciqual-13089, livsmedelsverket-600. | i mundshëm |
| 678 | pomegranate-juice | [V] `also` ciqual-2039 është lëng i freskët dhe cofid-14-341 "juice drink"; i preferuari është në shishe. Ciqual ka ciqual-2017 "pure juice" me vlera identike me SR (54). | Zëvendësoje ciqual-2039 me ciqual-2017; cofid-14-341 jashtë. | i sigurt (2017); i mundshëm (CoFID) |
| 679 | fruit-salad-fresh | [V] `reason` flet vetëm për SR; FNDDS ka usda-fdc-2709288 "Fruit salad, fresh or raw, including citrus fruits, no dressing" (56), që vjen para CoFID. | `preferred` usda-fdc-2709288; `also` cofid-14-333, livsmedelsverket-638; pa `reason`. | i sigurt |
| 690 | chorizo-cooked | [V][S] `also` cofid-19-516 "Chorizo" (395, P 24) është çorizo spanjolle e tharë, jo salsiçe e freskët e skuqur. | Hiqe. | i mundshëm |
| 697 | cottage-cheese-fruit | [V] `also` usda-fdc-2705751 ka Y 2 kundrejt Y 3,9 të SR "creamed" (përqindje tjetër yndyre). | Hiqe. | i mundshëm |
| 699 | chocolate-syrup | [V] I preferuari usda-fdc-170681 është markë ("Syrup, NESTLE, chocolate"); markat e USDA mbeten jashtë [D] PLANI › Gjendja, vala 3 pjesa e dytë. SR ka usda-fdc-174117 "Beverages, chocolate syrup" (279/2,1/62,5/1,1, F 2,6). | `preferred` usda-fdc-174117; `also` 2710276; 170681 jashtë. | i sigurt |

## 2. Emrat shqip

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 516, 517, 556, 557, 558, 564, 570, 686, 688, 691 | — | [V] "viçi" për mish gjedhi. Te 001–005 "gjedhi" është mishi i lopës (beef: #31, #165, #179, #283, #468–470) dhe "viçi" veal-i (#32, #181, #360, #361, #471); #560 "Mëlçi vici" del pranë #179 "Mëlçi gjedhi". | "gjedhi": "Veshka gjedhi", "Zemër gjedhi", "Biftek gjedhi (T-bone)", "Fileto gjedhi, e pagatuar", "Dhjamë gjedhi", "Rosto gjedhi në feta", "Pastërma gjedhi", "Gjellë me mish gjedhi dhe patate", "Mish gjedhi me oriz". | i sigurt |
| 559, 560 | veal-chop-grilled, veal-liver-cooked | [S] "vici" pa ç; "Kotelet" u ndreq te rishikimi i parë (#182, #185), dhe #361 thotë "Bërxollë viçi". | "Bërxollë viçi, e pjekur në skarë"; "Mëlçi viçi, e gatuar". | i sigurt |
| 537 | potato-pan-fried | [S] "(feta)" ngatërrohet me djathin (gabim i #101, #286, #480). | "Patate të skuqura në tigan, në feta". | i sigurt |
| 550 | yogurt-vanilla-low-fat | [S] "vaniljë" (gabim i #137); #620 thotë "vanilje". | "Kos me vanilje, me pak yndyrë". | i sigurt |
| 582 | shrimp-breaded-fried | [S] "Karkalec" pa "deti" (gabim i #42, #119). | "Karkalec deti i panuar dhe i skuqur". | i sigurt |
| 603, 695 | crackers-wholewheat, rice-crackers | [S] "Krisur" (gabim i #209). | "Krakera integrale"; "Krakera orizi". | i sigurt |
| 644 | pistachios-roasted | [S] "Fëstëkë", kurse #130 u ndreq në "Fistikë". | "Fistikë të pjekur, pa kripë". | i sigurt |
| 650 | soybeans-raw | [S] Njëjës; #438 u ndreq në "Fasule soje, të ziera". | "Fasule soje, të thata". | i sigurt |
| 549 | cranberry-juice | [S] "Boronicë" është boronica e zezë (#129); cranberry është #399 "Boronica të kuqe (cranberry)". | "Lëng boronicash të kuqe (cranberry)". | i sigurt |
| 580 | cod-salted-boiled | [S] "Bakall" është dyqanxhiu; peshku i kripur është bakalla. E njëjta fjalë te `reason`. | "Bakalla (merluc i kripur), e zier". | i sigurt |
| 661 | quail-egg-raw | [V] Wiktionary: "thëllëzë" = partridge, jo quail. [S] Quail shqip është shkurtë. | "Vezë shkurte (quail), të pagatuara". | i sigurt |
| 662, 687 | duck-egg-raw, duck-fat | [S] Gjinorja e "rosë" është "rose" (si "mish rose"). | "Vezë rose, të pagatuara"; "Dhjamë rose". | i sigurt |
| 693 | mozzarella-part-skim | [V] "Mocarelë", kurse #111 "Mocarela". | "Mocarela me pak yndyrë". | i sigurt |
| 566 | chicken-drumstick-raw | [V] "Kofshë e poshtme pule", kurse #163 e quan drumstick-un "Këmbë pule". | "Këmbë pule me lëkurë, e pagatuar". | i sigurt |
| 558 | beef-tripe-cooked | [S] "Ishkembe" është turqisht; "tripa" janë zorrët, jo stomaku. | "Shkembë gjedhi, e zier". | i mundshëm |
| 653 | cumin-seed | [V] Wiktionary: "qimnon" = cumin (Cuminum cyminum); "kimion" nuk është forma standarde. | "Qimnon (farë)". | i mundshëm |
| 563, 568 | chicken-ground-raw, turkey-ground-93-raw | [V] "Mish i grirë pule/gjeldeti", kurse #31, #177, #184, #186 thonë "Mish X i grirë"; "93 %" kundrejt "90%" te #31. | "Mish pule i grirë, i pagatuar"; "Mish gjeldeti i grirë (93% pa yndyrë), i pagatuar". | i mundshëm |
| 645 | cashew-butter | [V] "kaju", kurse #131 "Shqeme (kaxhu)". | "Gjalpë shqemeje". | i mundshëm |
| 694 | cream-cheese-fat-free | [V] "kremoz", kurse #168 "Djathë krem". | "Djathë krem pa yndyrë". | i mundshëm |
| 672, 673, 674, 675 | pears-canned-syrup, cherries-sweet-canned, mandarin-canned, apricots-canned-syrup | [S] #423 dhe #424 u ndreqën në "Komposto…"; #674 "në kuti" kundrejt "të konservuara" kudo tjetër. | "Komposto dardhe"; "Komposto qershie"; "Komposto mandarine (në lëng)"; "Komposto kajsie". | i mundshëm |
| 521, 522 | ratatouille, vegetable-stew | [S] Dy hyrje me të njëjtin emër ("Ratatuj (tavë me perime)", "Tavë me perime"); tava piqet në furrë, këto janë gjellë. | #521 "Ratatuj (gjellë frënge me perime)"; #522 "Gjellë me perime". | i mundshëm |
| 511 | rice-pilaf | [S] "Pilaf me oriz" përsërit orizin: pilafi është oriz. | "Pilaf orizi". | i mundshëm |
| 539 | olives-green-stuffed | [V] "jeshilë", kurse #70 "Ullinj të gjelbër". | "Ullinj të gjelbër të mbushur me spec". | i mundshëm |
| 502 | soup-chicken | [S] "lëng pule shtëpie" pa nyje. | "Supë pule (lëng pule i shtëpisë)". | i mundshëm |

## 3. Vlera të dyshimta

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 566 | chicken-drumstick-raw | [V] Foundation jep 130 kcal dhe Y 5,9, kurse SR 161/9,2 dhe Ciqual 155/9,2 (si #24 feta). | `preferred` usda-fdc-172373 me `reason` ("Foundation Y 5,9, larg SR dhe Ciqual"), ose lëre dhe shënoje. | i mundshëm |
| 664 | gnocchi-potato | [V] FNDDS jep K 16,2 dhe Y 6,3 (135 kcal), kurse njokët e ziera të Ciqual K 34,1 dhe Y 2,1 (178). | `preferred` ciqual-25510 "Gnocchi, from potato, cooked" me `reason` ("FNDDS K 16, Y 6,3, larg njokeve të ziera"). | i mundshëm |
| 619 | nougat-almonds | [V] SR "nougat, with almonds" ka Y 1,7 dhe K 89,1; nugati me arra te burimet e tjera ka Y 10–14 (usda-fdc-2710355 444/13,3; ciqual-31127 437/13,9; cofid-17-814 413/10,2). | `preferred` usda-fdc-2710355 me `reason` ("SR Y 1,7, larg nugatit me arra"), `also` ciqual-31127, cofid-17-814; ose lëre dhe shënoje. | i mundshëm |

## 4. Dyfishime

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 544, 71 | orange-navel, orange-raw | [V] I njëjti ushqim: #71 ka Foundation usda-fdc-746771 "Oranges, raw, navels", #544 Foundation usda-fdc-327501 me të njëjtin emër dhe vlera identike (47/0,9/9,8/0,2/2). | Hiqe #544; usda-fdc-327501 dhe usda-fdc-169917 te `also` e #71. | i sigurt |

## Vërejtje jashtë katër llojeve (nuk numërohen)

- Grupi: #515, #516, #517, #572, #573 (pjata me mish) janë te "Mish", kurse pjatat e tjera të përbëra (#373, #391, #498, #514, #519, #520) te "Të tjera".
- #639 "Hren i përgatitur": "hren" është fjalë sllave, por nuk gjeta burim për emrin shqip ([V] Wiktionary e jep "rrikë" si rrepë), ndaj nuk e numëroj.
- #541–543 (mollë red delicious, granny smith, gala) qëndrojnë pranë #12 "Mollë": nuk janë dyfishime (lloje të ndryshme), por për një përdorues shqiptar mund të mjaftojë #12.

## Numri i gjetjeve

| Lloji | Gjithsej | I sigurt | I mundshëm |
|---|---|---|---|
| 1. Përputhje të gabuara | 33 | 17 | 16 |
| 2. Emra shqip | 24 (40 hyrje) | 14 | 10 |
| 3. Vlera të dyshimta | 3 | 0 | 3 |
| 4. Dyfishime | 1 | 1 | 0 |
| **Gjithsej** | **61** | **32** | **29** |

Te lloji 1, gjetjet me një pjesë të sigurt dhe një të mundshme (#516, #549, #678) numërohen si "i sigurt", si te dy rishikimet e mëparshme.

Prodhuar nga Claude (AI); rishikohet nga Andi
