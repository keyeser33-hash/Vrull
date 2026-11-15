# Rishikimi i të zakonshmeve të Listës së Vrullit (rank 702–1000)

Çfarë u kontrollua: 299 hyrjet e `tools/food-catalog/common/008.json` (100), `009.json` (100) dhe `010.json` (99), dega `feat/lista-te-zakonshmet-5` (35f7e83), me rreshtin `preferred` dhe çdo `also` (299 + 82 rreshta) të lexuar nga `/tmp/food-out/catalog-all.jsonl` me skriptet te `/tmp/review4/` (`lib.py`, `join.py`, `find.py`, `similar.py`, `identical.py`, `dups.py`, `show.py`, `verify_ids.py`). Asnjë skedar i repo-s nuk u ndryshua.

Rregullat e matjes: SPEC V61; `docs/agents/PLANI-LISTA-E-VRULLIT.md`; `tools/food-catalog/README.md` › "Të zakonshmet (V61)"; gabimet e `docs/research/rishikimi-te-zakonshmet-001-003.md`, `-004-005.md`, `-006-007.md`.

Shenjat: [V] = e parë me skript në këtë sesion; [S] = gjykimi im; [D] = e thënë në një dokument (me seksionin). Hyrjet në rregull dhe `also` që thjesht mungojnë nuk renditen.

[V] `node tools/food-catalog/common-list.mjs /tmp/food-out/catalog-all.jsonl`: 997 të zakonshme, 0 gabime, 14 shënime, të gjitha te 001–007 (asnjë te 008–010). [V] Çdo ID e propozuar ekziston dhe nuk përdoret nga asnjë hyrje tjetër, përveç atyre që lirohen nga një hyrje që propozohet të hiqet (e shënuar).

Ndryshimet që prekin 001–007 janë shënuar **(ndryshim te 001–007)**.

## 1. Përputhje të gabuara

Dy modele: rreshti i SR Legacy ose Foundation që ka vlerat identike me FNDDS-in e zgjedhur (11 hyrje; `identical.py`), dhe `reason` që nuk është i vërtetë ose nuk mbulon burimin që kapërcen.

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 723 | pork-shoulder-raw | [V] `also` ciqual-28009 ka P 24,8 dhe Y 12,1, kurse i preferuari (me dhjamë) P 17,2 dhe Y 18: duket shpatull e pastruar. | Hiqe ciqual-28009. | i mundshëm |
| 746, 747, 748 | lamb-leg-lf-roasted, lamb-shoulder-lf-raw, lamb-shoulder-lf-roasted | [V] Emri dhe çelësi thonë "me dhjamë", por të tre të preferuarit janë "separable lean only"; #746 bëhet kështu dyfishim i #381 ("Kofshë qengji pa dhjamë, e pjekur"). | `preferred` usda-fdc-174312 (258 kcal, Y 16,5), usda-fdc-172496 (264, Y 21,5), usda-fdc-174325 (276, Y 20); të njëjtat "lean and fat, trimmed to 1/4" fat, choice". | i sigurt |
| 750, 751 | lamb-liver-raw, lamb-kidney-raw | [V] Të preferuarit janë "Lamb, New Zealand, imported"; SR ka rreshtat e përgjithshëm, dhe #561 (mëlçia e gatuar) përdor të përgjithshmin. | `preferred` usda-fdc-172531 (mëlçi) dhe usda-fdc-174354 (veshka). | i mundshëm |
| 754 | brains-cooked | [V] FNDDS "Brains" ka vlerat identike me SR usda-fdc-168624 "Beef, … brain, cooked, simmered" (151/11,7/1,5/10,5). | `preferred` usda-fdc-168624, 2706159 te `also`; emri "Tru gjedhi, i zier". | i sigurt |
| 758 | luncheon-meat | [V] `also` usda-fdc-2706211 është "Spam" (markë; vlerat e SR "pork with ham … includes Spam", Y 26,6 kundrejt 30,3). | Hiqe. | i sigurt |
| 772 | cod-steamed | [V] `reason` "SR ka vetëm merlucin e Paqësorit" nuk është i vërtetë: SR usda-fdc-171956 "Fish, cod, Atlantic, cooked, dry heat" është i preferuari i #296. | Hiqe hyrjen (variant i #296), ose `reason` "SR ka merlucin atlantik vetëm të pjekur (#296)". | i sigurt |
| 779 | mackerel-canned | [V][S] I preferuari është "jack mackerel" (Trachurus, shkrapë), lloj tjetër nga skumbri i konservuar që shitet (Scomber); Ciqual ka skumbrin në ujë të kripur. | `preferred` ciqual-26123 me `reason` ("USDA ka vetëm jack mackerel"), USDA jashtë; ose emri "Shkrapë e konservuar (jack mackerel)". | i mundshëm |
| 782 | shrimp-canned | [V] SR usda-fdc-171972 "Crustaceans, shrimp, mixed species, canned" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-171972; `also` 2706367, cofid-16-247. | i sigurt |
| 791 | mozzarella-fresh | [V] `reason` flet vetëm për USDA; Ciqual (që vjen para CoFID) ka ciqual-19590 "Mozzarella au lait de vache" (227 kcal). | `preferred` ciqual-19590 me të njëjtin `reason`; `also` cofid-12-360, livsmedelsverket-2255. | i sigurt |
| 794 | yogurt-soy | [V] `reason` thotë "vetëm SILK me fruta", por SR ka edhe usda-fdc-175227 "SILK Plain soy yogurt"; përfundimi mbetet (markë). | `reason`: "SR ka vetëm kosin e soje SILK (markë)". | i mundshëm |
| 795 | coffee-creamer | [V] SR usda-fdc-171261 "Cream substitute, liquid, with hydrogenated vegetable oil and soy protein" ka vlerat identike (136/1/11,4/10). | `preferred` usda-fdc-171261; `also` 2705600. | i sigurt |
| 815 | noodles-egg-dry | [V] `also` ciqual-9863 janë petë aziatike; Ciqual ka ciqual-9821 "Pâtes sèches, aux oeufs, crues" (381/15,2/68/4,7), afër SR-së. | Zëvendësoje me ciqual-9821; shto cofid-11-715. | i mundshëm |
| 822 | bread-roll-white | [V] Përzihen dinner rolls amerikane me yndyrë (SR, Y 6,5, 310 kcal) me panine të buta (FNDDS Y 3,9; CoFID Y 2,6, 254 kcal). | `preferred` usda-fdc-2707654 me `reason` ("SR ka vetëm dinner rolls me yndyrë"), `also` cofid-11-1006; 172793 jashtë. | i mundshëm |
| 834 | crackers-cheese | [V] `also` ciqual-38410 është sfoliatë me djathë (524 kcal, Y 29,6), produkt tjetër. | Hiqe. | i mundshëm |
| 838 | cereal-honey | [V] `also` ciqual-32129 është misër i fryrë me mjaltë (P 5,8, K 87,3, Y 1,4), produkt tjetër nga FNDDS (P 8, Y 5,7). | Hiqe. | i mundshëm |
| 844 | pepper-yellow | [V] Foundation usda-fdc-2258589 "Peppers, bell, yellow, raw" (me fibra) ekziston dhe nuk është zgjedhur. | `preferred` usda-fdc-2258589; `also` 169383. | i sigurt |
| 845 | tomato-cherry | [V] Foundation ka usda-fdc-321360 "Tomatoes, grape, raw" (lloj shumë i afërt) dhe CoFID cofid-13-519 "Tomatoes, cherry, raw"; i preferuari Ciqual nuk ka `reason`. | `reason` ("Foundation ka vetëm domatet grape") dhe `also` cofid-13-519; ose `preferred` 321360. | i mundshëm |
| 859 | asparagus-canned | [V] `also` livsmedelsverket-404 është shparg i bardhë (P 0,9); USDA-ja është shparg jeshil (P 2,1). | Hiqe. | i mundshëm |
| 861 | peas-canned | [V] I preferuari është "seasoned, solids and liquids" (me erëza, me lëngun); SR ka usda-fdc-170013 "canned, drained solids" (68 kcal), identik me FNDDS 2709961. | `preferred` usda-fdc-170013 (me të njëjtin `reason` për Foundation); `also` 2709961, livsmedelsverket-413; 170014 jashtë. | i sigurt |
| 863 | portobello | [V] Foundation usda-fdc-2003598 "Mushroom, portabella" ekziston dhe nuk është zgjedhur. | `preferred` usda-fdc-2003598; `also` 169255. | i sigurt |
| 867 | greek-salad | [V] `reason` flet vetëm për FNDDS; Ciqual (ciqual-26262, anëtar) dhe CoFID (cofid-15-871) vijnë para Livsmedelsverket. | `preferred` ciqual-26262 me `reason` ("FNDDS pa salcë"); `also` livsmedelsverket-529 (cofid-15-871, 131 kcal, mund të shtohet). | i sigurt |
| 874 | white-beans-canned | [V] `also` livsmedelsverket-3761 janë "stora vita bönor" (fasule të mëdha, butter beans), lloj tjetër. | Hiqe. | i mundshëm |
| 875 | kidney-beans-canned | [V] I preferuari (84 kcal) është me lëngun e kutisë, kurse cofid-13-660 është i kulluar (100); SR ka usda-fdc-174285 "red, canned, drained solids" (124). | `preferred` usda-fdc-174285; `also` cofid-13-660, livsmedelsverket-3816; 173741 jashtë. | i mundshëm |
| 876 | hash-brown-fresh | [V] SR ka usda-fdc-170036 "Potatoes, hash brown, home-prepared" (265 kcal), pa `reason` për FNDDS-in (190). | Shih lloji 5 (heqje); nëse mbahet, `preferred` 170036 ose `reason`. | i mundshëm |
| 877 | hash-brown-fast-food | [V] `reason` "SR ka vetëm McDonald's" nuk është i vërtetë: SR usda-fdc-173273 "Fast foods, potatoes, hash browns, round pieces or patty" ka vlerat identike. | Shih lloji 5; nëse mbahet, `preferred` 173273, pa `reason`. | i sigurt |
| 879 | fries-oven | [V] SR usda-fdc-169264 "Potatoes, french fried, all types, … frozen, home-prepared, oven heated" ka vlerat identike. | `preferred` usda-fdc-169264; `also` 2709460. | i sigurt |
| 887 | pizza-thin-frozen | [V] SR usda-fdc-170373 "Pizza, cheese topping, thin crust, frozen, cooked" ka vlerat identike. | `preferred` usda-fdc-170373; `also` 2708612. | i sigurt |
| 889 | pizza-stuffed-crust | [V] SR usda-fdc-170773 "Fast Food, Pizza Chain, 14" pizza, cheese topping, stuffed crust" (pa markë) ka vlerat identike. | Shih lloji 5; nëse mbahet, `preferred` 170773. | i sigurt |
| 901 | cookie-choc-sandwich | [V][S] Rreshti është biskotë me copëza çokollate me mbushje kremi; emri thotë "krem çokollate". Biskota e zakonshme e këtij lloji (tip Oreo) është SR usda-fdc-172718. | `preferred` usda-fdc-172718, emri "Biskota kakaoje me mbushje kremi (tip Oreo)"; 174095 dhe 2707912 jashtë. | i mundshëm |
| 902 | cake-angel-food | [V] SR usda-fdc-172695 "Cake, angelfood, dry mix, prepared" ka vlerat identike. | Shih lloji 5; nëse mbahet, `preferred` 172695. | i sigurt |
| 907 | choc-chips | [V] SR usda-fdc-167976 "Candies, semisweet chocolate" ka vlerat identike (480/4,2/58/30/5,9). | `preferred` usda-fdc-167976; `also` 2710333. | i sigurt |
| 915 | peanut-brittle | [V] SR usda-fdc-169586 "Candies, peanut brittle, prepared-from-recipe" ka vlerat identike. | `preferred` usda-fdc-169586; `also` 2710357. | i sigurt |
| 931 | tomato-puree | [V] Foundation usda-fdc-2685582 "Tomato, puree, canned" (34,8 kcal, F 2) ekziston dhe nuk është zgjedhur. | `preferred` usda-fdc-2685582; `also` 170546. | i sigurt |
| 992 | choc-cream-filled | [V] SR usda-fdc-167978 "Candies, sweet chocolate coated fondant" ka vlerat identike; mbushja është fondant (sheqer), jo krem. | `preferred` usda-fdc-167978; `also` 2710344; emri "Çokollatë me mbushje fondant". | i sigurt |

## 2. Emrat shqip

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 99 | beef-ground-cooked | [V] Me #729 dhe #730 "(80% pa yndyrë)", #99 (90/10) mbetet pa përqindje dhe dy hyrjet duken njësoj. **(ndryshim te 001–007)** | "Mish gjedhi i grirë (90% pa yndyrë), i pjekur". | i sigurt |
| 724, 725 | pork-loin-lf-raw, pork-loin-lf-roasted | [V] "Kurriz derri", kurse #359 dhe #100 e quajnë të njëjtën copë "Fileto derri" (e ndrequr te rishikimi 004–005). | "Fileto derri me dhjamë, e pagatuar"; "Fileto derri me dhjamë, e pjekur". | i sigurt |
| 732 | beef-sirloin-raw | [V] "Biftek sirloin", kurse #165 "Biftek gjedhi (sirloin)". | "Biftek gjedhi (sirloin), i pagatuar". | i mundshëm |
| 738 | beef-round-eye-roasted | [S] "Rosto" është femërore (rostoja). | "Rosto gjedhi (eye of round), e pjekur". | i sigurt |
| 740 | beef-chuck-pot-roast | [S] "Rosto … e zier" kundërthënëse; rreshti është shpatull e gatuar ngadalë në tavë (si #178, por me dhjamë). | "Mish gjedhi (shpatull) me dhjamë, i zier në tavë", ose hiqe pranë #178. | i mundshëm |
| 758 | luncheon-meat | [V] Rreshti është mish derri; emri nuk e thotë. | "Mish derri i konservuar (luncheon meat)". | i mundshëm |
| 771, 772 | cod-fried, cod-steamed | [V] "Merluc" është hake (#193); cod është "Merluc atlantiku" (#37, #296). | "Merluc atlantiku, i skuqur"; "Merluc atlantiku, i zier në avull". | i sigurt |
| 795, 947 | coffee-creamer, cream-light | [V][S] Dy hyrje "krem … për kafe": #795 është zëvendësues bimor, #947 krem qumështi 19%; ngatërrohen. | "Krem kafeje bimor (creamer), i lëngshëm"; "Krem qumështi i lehtë (20% yndyrë)", si #113 dhe #551. | i mundshëm |
| 805 | rice-parboiled-cooked | [S] "parboiled" është anglisht. | "Oriz i avulluar (parboiled), i zier". | i mundshëm |
| 832 | melba-toast | [S] "Bukë e thatë" shqip do të thotë bukë bajate. | "Peksimet (melba toast)". | i mundshëm |
| 835 | puff-pastry | [V][S] "Brumë petash" ngatërrohet me petët e byrekut; rreshti është sfoliatë e ngrirë, e papjekur. | "Brumë sfoliatë (puff pastry), i papjekur". | i mundshëm |
| 836 | crepe | [S] "Krep të thjeshtë" nuk përputhet në numër. | "Krep i thjeshtë". | i sigurt |
| 879 | fries-oven | [S] "Të skuqura në furrë" kundërthënëse. | "Patate fri të ngrira, të pjekura në furrë". | i mundshëm |
| 895, 896 | egg-muffin-sausage, egg-muffin-bacon | [D] Rishikimi 001–003 › Emrat (#160): suxhuku është sallam i tharë, salsiçja e freskët është "salsiçe"; bacon është "Bekon" (#161), muffin-i "Muffin anglez" (#600). | "Sandviç me vezë dhe salsiçe, në muffin anglez"; "Sandviç me vezë dhe bekon, në muffin anglez". | i sigurt |
| 899 | biscotti | [S] "Biskota biskotti" përsërit të njëjtën fjalë (si "Salcë salsa" te 004–005). | "Biskoti (biskota italiane me bajame)". | i mundshëm |
| 900 | brownie-icing | [V] "Brauni", kurse #367 "Brownie". | "Brownie me glazurë". | i sigurt |
| 912 | candy-licorice | [S] "Hithër" është hithra (Urtica), jo jamballia. | "Sheqerka me jamballi (liquorice)". | i sigurt |
| 915 | peanut-brittle | [S] "Karamel" është sheqeri i djegur; ëmbëlsira me kikirikë shitet si krokant. | "Krokant me kikirikë". | i mundshëm |
| 916 | fruit-leather | [S] "Lëkurë frutash" është kalk. | "Pestil frutash (fruit leather)". | i mundshëm |
| 942 | pumpkin-seeds-roasted | [V] Rreshti është fara të plota me lëvozhgë, kurse #254 "Fara kungulli" janë thelbet; varianti me kripë (usda-fdc-168601, vlera identike) mungon. | "Fara kungulli me lëvozhgë, të pjekura"; shto usda-fdc-168601 te `also`. | i mundshëm |
| 949 | kohlrabi-cooked | [S] "Kolrabi" nuk është emri i zakonshëm. | "Lakër rrepë (kolrabi), e zier". | i mundshëm |
| 974 | flour-spelt | [V] "spelte", kurse #596 "Shpelt (spelt)". | "Miell shpelti, integral". | i mundshëm |
| 976 | flour-rice-brown | [D] Rishikimi 001–003 › Emrat (#106): "kaf/kafe" për orizin u bë "integral" (#106, #589). | "Miell orizi integral". | i sigurt |
| 987, 988 | rice-black-raw, rice-red-raw | [V] "i thatë", kurse orizi i pagatuar kudo tjetër është "i pagatuar" (#46, #588, #589, #597). | "Oriz i zi, i pagatuar"; "Oriz i kuq, i pagatuar". | i mundshëm |

## 3. Vlera të dyshimta

Pesë rreshtat e parë janë modeli i `includes_fiber_preferred` [D] (README › "Të zakonshmet (V61)": `preferred` pa fibra, ndërsa një rresht tjetër i USDA-së i ka ≥ 2 g/100 g); vërtetimi nuk i kap, sepse emri i rreshtit me fibra ndryshon.

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 813 | oats-steel-cut | [V] Foundation pa fibra: K 69,8 përfshin rreth 10 g fibra (SR usda-fdc-169705 "Oats": K 55,7, F 10,6); ushqimi është i njëjti me #50. | Hiqe (#50 e mbulon); nëse mbahet, `preferred` usda-fdc-169705 me `reason` ("Foundation pa fibra"), `also` 2346397. | i sigurt |
| 843 | sweet-potato-raw | [V] Foundation pa fibra (K 17,3); SR usda-fdc-168482 ka F 3 (vlerat identike me ciqual-4101). | `preferred` usda-fdc-168482 me `reason`; `also` 2346404, ciqual-4101, cofid-13-463. | i sigurt |
| 941 | chestnuts-raw | [V] SR "raw, peeled" pa fibra (K 44,2); SR usda-fdc-170574 "raw, unpeeled" dhe ciqual-15024 kanë F 8,1 (K 37). | `preferred` usda-fdc-170574 me `reason`; `also` ciqual-15024, livsmedelsverket-1563; 170575 jashtë. | i sigurt (rregulli); i mundshëm (cili rresht) |
| 976 | flour-rice-brown | [V] Foundation pa fibra (K 75,5); SR usda-fdc-168898 "Rice flour, brown" ka F 4,6. | `preferred` usda-fdc-168898 me `reason`; `also` 1104812. | i sigurt |
| 984 | flour-bread | [V] Foundation pa fibra (K 72,8); SR usda-fdc-168896 "Wheat flour, white, bread, enriched" ka F 2,4. | `preferred` usda-fdc-168896 me `reason`; `also` 790146, ciqual-9436 (shih edhe lloji 5, l). | i sigurt |
| 985 | flour-pastry | [V] Foundation pa fibra (K 77,2); USDA nuk ka tjetër, Ciqual ciqual-9440 "T45 pour pâtisserie" ka F 2,5. | `preferred` ciqual-9440 me `reason`, ose hiqe (variant i #45). | i mundshëm |
| 862 | green-beans-canned | [V] Foundation pa fibra (K 4,1); `also` SR usda-fdc-169143 ka F 1,9 (K 2,3), nën pragun 2 g. | `preferred` usda-fdc-169143 me `reason`; `also` 321611. | i mundshëm |
| 912 | candy-licorice | [V] FNDDS ka vlerat e sheqerkave me niseshte (identike me usda-fdc-167989 të #618: P 0, Y 0); jamballia e Ciqual dhe Livsmedelsverket ka P 3,6–5,1 dhe miell. | `preferred` ciqual-31112 me `reason`, `also` livsmedelsverket-7000; ose hiqe (shih lloji 5). | i mundshëm |
| 798 | gelato-vanilla | [V] FNDDS ka vlerat identike me SR usda-fdc-167573 "Ice creams, vanilla, rich" (Y 16,2); xhelatoja zakonisht ka më pak yndyrë. | Hiqe (#137 e mbulon), ose lëre dhe shënoje. | i mundshëm |
| 997 | cookie-almond | [V] FNDDS ka vlerat identike me SR usda-fdc-174967 "Cookies, shortbread" (pa bajame). | `preferred` ciqual-24614 "Biscuit sec croquant aux amandes" me `reason`, ose hiqe. | i mundshëm |

## 4. Dyfishime

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 733, 165 | beef-sirloin-broiled, beef-sirloin-cooked | [V] Të dyja janë top sirloin pa dhjamë, i pjekur (188 dhe 165 kcal), me emra pothuajse të njëjtë ("Biftek sirloin, i pjekur" / "Biftek gjedhi (sirloin), i pjekur"). | Hiqe #733 (opsionale: usda-fdc-168635 te `also` e #165, **ndryshim te 001–007**). | i sigurt |
| 755, 360 | veal-leg-raw, veal-cutlet-raw | [V] E njëjta copë (kofshë viçi, top round) e pagatuar, vlera pothuajse identike (107/21,3/1,8 dhe 107/22,1/2,1). | Hiqe #755; usda-fdc-175269 te `also` e #360 **(ndryshim te 001–007)**. | i sigurt |
| 888, 151 | pizza-thick-frozen, pizza-cheese | [V] FNDDS i #888 ka vlerat identike me usda-fdc-170317, të preferuarin e #151. | Hiqe #888; 2708613 te `also` e #151 **(ndryshim te 001–007)**. | i sigurt |
| 914, 617 | candy-lollipop, candy-hard | [V] FNDDS "lollipop" ka vlerat identike me SR "Candies, hard" (#617), që ka edhe ciqual-31059 "Hard candy and lollipop"; [S] edhe emri "Llokum" është lokumi. | Hiqe #914; 2710361 te `also` e #617 **(ndryshim te 001–007)**. | i sigurt |
| 917, 916 | fruit-snacks, fruit-leather | [V] FNDDS "fruit snacks" ka vlerat identike me SR "fruit leather, rolls", të preferuarin e #916. | Hiqe #917 (2710367 te `also` e #916). | i sigurt |
| 932, 226 | tomato-sauce-canned, tomato-sauce | [V] SR usda-fdc-170054 "Tomato products, canned, sauce" ka vlerat identike me usda-fdc-169074, `also` e #226 "Salcë domateje". | Hiqe #932; 170054 te `also` e #226 **(ndryshim te 001–007)**. | i sigurt |
| 975, 279 | semolina-fine, semolina-dry | [V] I njëjti griz (366/13,3/68,3/1,8 dhe 360/12,7/68,9/1,1); #279 përdor SR, ndërsa Foundation vjen para. | Hiqe #975; #279 `preferred` usda-fdc-2003589, `also` 169715, ciqual-9610 **(ndryshim te 001–007)**. | i sigurt |
| 989, 255 | flax-ground, flaxseed | [V][S] Fara liri e bluar dhe e plotë janë i njëjti ushqim për përdoruesin. | Hiqe #989. | i mundshëm |
| 777, 582 | shrimp-fried, shrimp-breaded-fried | [V][S] Të dyja janë karkalec i veshur dhe i skuqur (K 11,9 dhe 27,3); emrat nuk dallohen. | Hiqe #777. | i mundshëm |
| 913, 617 | candy-mint, candy-hard | [V] FNDDS "mint" ka vlerat e sheqerkave të forta (394/0/98,3/0,1). | Hiqe #913. | i mundshëm |
| 878, 537 | home-fries, potato-pan-fried | [V] #537 është "home fries, from fresh", #878 "home fries, ready-to-heat": e njëjta patate e skuqur në tigan për përdoruesin. | Hiqe #878. | i mundshëm |
| 803, 804, 511 | rice-butter, rice-oil, rice-pilaf | [V][S] Oriz i zier me gjalpë (147, Y 2,6) ose vaj (151, Y 3,1) është pilafi i #511 (137, Y 3). | Hiqi #803 dhe #804. | i mundshëm |
| 763, 286 | turkey-breast-deli, turkey-ham-sliced | [S] Gjoksi i gjeldetit në feta shitet si "proshutë gjeldeti"; përdoruesi nuk i dallon (106 dhe 134 kcal). | Hiqe #763. | i mundshëm |

## 5. Ushqime të rralla në Shqipëri ose variante që përdoruesi nuk i dallon

Të gjitha [S]; propozimi është heqja. Kur hyrja ka edhe një gjetje te lloji 1–3, ajo vlen vetëm nëse hyrja mbahet.

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 882–886, 998, 999 | taco-* (6), taco-salad-meat | Shtatë hyrje me tako; ushqimi meksikan është i rrallë (#497 burrito ekziston). | Hiqi, ose mbaj vetëm #882. | i mundshëm |
| 892, 893, 894 | jambalaya, biryani-chicken, bibimbap | Pjata të rralla në Shqipëri. | Hiqi. | i mundshëm |
| 895, 896, 897 | egg-muffin-sausage, egg-muffin-bacon, egg-salad-sandwich | Sanduiçë fast-food amerikane që nuk shiten në Shqipëri. | Hiqi. | i mundshëm |
| 889, 890 | pizza-stuffed-crust, pizza-extra-cheese | Variante pice që përdoruesi nuk i dallon nga #151. | Hiqi. | i mundshëm |
| 876, 877, 881 | hash-brown-fresh, hash-brown-fast-food, potato-skins | Hash brown-i ekziston te #409; lëkurët e patateve janë të rralla. | Hiqi. | i mundshëm |
| 902, 904, 908, 918 | cake-angel-food, cake-boston-cream, choc-fudge, candy-taffy | Ëmbëlsira amerikane të rralla. | Hiqi. | i mundshëm |
| 900, 905 | brownie-icing, cake-choc-white-icing | Variante të #367 dhe #326. | Hiqi. | i mundshëm |
| 950, 952, 958, 962, 965, 966, 967 | rutabaga, mustard-greens, enoki, bamboo-shoots, plantain (3) | Perime që nuk shiten zakonisht; #967 ka edhe "e pjekur" dy herë me dy kuptime. | Hiqi. | i mundshëm |
| 871, 873, 937, 940 | lima-beans-cooked, mung-cooked, walnuts-black, peanuts-boiled | Bishtajore dhe arra të rralla (arra e zezë është lloj amerikan). | Hiqi. | i mundshëm |
| 980, 981, 983, 986, 987, 988 | flour-cassava, masa-harina, flour-quinoa, farro-raw, rice-black-raw, rice-red-raw | Miell dhe drithëra të rralla. | Hiqi. | i mundshëm |
| 825, 828, 829, 830 | bread-italian, bread-potato, bread-egg, bread-sprouted | Bukë që nuk dallohen nga #43, #365, ose nuk shiten (challah, bukë me grurë të mbirë). | Hiqi. | i mundshëm |
| 945, 946, 948, 984, 985 | oil-sunflower-oleic, butter-whipped, evaporated-milk-nonfat, flour-bread, flour-pastry | Variante që etiketa nuk i thotë ose që nuk shiten; mielli shitet si "tip 00/0/500", jo bread/pastry. | Hiqi (për #984, #985 shih edhe lloji 3). | i mundshëm |
| 841, 855, 856, 857, 951, 953, 956, 960, 961 | potato-baked-flesh, broccoli-frozen, peas-frozen, green-beans-frozen, summer-squash-cooked, shiitake-stirfried, corn-white-cooked, tomato-roma, spinach-baby | Variante të #102, #140, #108, #236, #150, #536, #420, #57, #62 me vlera të afërta; si rukola "baby" te 004–005 (#345). | Hiqi. | i mundshëm |
| 713, 734, 735 | chicken-wing-meat-roasted, beef-porterhouse, beef-strip-broiled | Krahu pa lëkurë nuk hahet kështu (#176 ekziston me lëkurë); porterhouse është T-bone (#564); strip "prime" (Y 22,1) është shkallë amerikane. | Hiqi. | i mundshëm |
| 970, 971, 972 | currants-zante, blueberries-dried, raisins-seeded | Fruta të thata të rralla; stafidhet me fara nuk dallohen nga #126. | Hiqi. | i mundshëm |
| 934 | tamari | Salcë e rrallë pranë #274. | Hiqe. | i mundshëm |

## Vërejtje jashtë pesë llojeve (nuk numërohen)

- Grupi: #801 (akullore me lëng frutash) dhe #795 (zëvendësues bimor) janë te "Qumësht dhe bulmet"; #840–842 dhe #876–881 (pjata me patate) te "Perime", kurse #103 te "Të tjera".
- [S] #126, #369, #601, #970 dhe #972 shkruajnë "Stafida"; forma standarde duket "stafidhe". Nuk e numëroj, sepse nuk e verifikova në një fjalor.

## Numri i gjetjeve

| Lloji | Gjithsej | I sigurt | I mundshëm |
|---|---|---|---|
| 1. Përputhje të gabuara | 34 (37 hyrje) | 20 | 14 |
| 2. Emra shqip | 24 (30 hyrje) | 9 | 15 |
| 3. Vlera të dyshimta | 10 | 5 | 5 |
| 4. Dyfishime | 13 | 7 | 6 |
| 5. Të rralla ose variante | 16 (66 hyrje) | 0 | 16 |
| **Gjithsej** | **97** | **41** | **56** |

Te lloji 3, #941 numërohet "i sigurt" sipas pjesës së sigurt, si te rishikimet e mëparshme. Ndryshimet te 001–007: #99, #151, #165 (opsionale), #226, #279, #360, #617.

Prodhuar nga Claude (AI); rishikohet nga Andi
