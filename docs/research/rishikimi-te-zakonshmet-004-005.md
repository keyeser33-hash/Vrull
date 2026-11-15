# Rishikimi i të zakonshmeve të Listës së Vrullit (rank 299–500)

Çfarë u kontrollua: 202 hyrjet e `tools/food-catalog/common/004.json` (102) dhe `005.json` (100), me rreshtin `preferred` dhe çdo `also` të lexuar nga `/tmp/food-out/catalog-all.jsonl` me skriptet te `/tmp/review2/` (`join.py`, `find.py`, `checks.py`, `verify_ids.py`). Asnjë skedar i repo-s nuk u ndryshua.

Rregullat e matjes: SPEC V61, `docs/agents/PLANI-LISTA-E-VRULLIT.md`, `tools/food-catalog/README.md` › "Të zakonshmet (V61)" dhe gabimet e `docs/research/rishikimi-te-zakonshmet-001-003.md`.

Shenjat: [V] = e parë në rreshtat e katalogut me skript në këtë sesion; [S] = gjykimi im (gjuha, njohja e ushqimit). Hyrjet në rregull dhe `also` që thjesht mungojnë nuk renditen.

[V] `node tools/food-catalog/common-list.mjs /tmp/food-out/catalog-all.jsonl`: 499 të zakonshme, 0 gabime; 11 shënimet janë të gjitha të 001–003, asnjë te 004–005. [V] Çdo ID e propozuar më poshtë ekziston te `catalog-all.jsonl` dhe nuk përdoret nga asnjë hyrje tjetër e 001–005.

## 1. Përputhje të gabuara

Shumica e gjetjeve këtu janë një model i vetëm: vërtetimi e kontrollon radhën e burimeve vetëm mes anëtarëve të hyrjes, ndaj një rresht i SR Legacy ose Foundation që nuk u zgjodh nuk shihet (si #103, #151, #280 te rishikimi i parë). Kur vlerat janë identike me të preferuarin, gjetja shënohet "i sigurt".

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 301, 302 | hamburger, cheeseburger | [V] I preferuari është FNDDS NFS, por SR ka "Fast foods, hamburger; single, regular patty; plain" (297 kcal) dhe "cheeseburger; single, regular patty; plain" (308), pa `reason`. | `preferred` usda-fdc-170693 dhe usda-fdc-170690, FNDDS te `also`; ose `reason`. | i mundshëm |
| 303 | pizza-pepperoni | [V] I preferuari është FNDDS me brumë të hollë; SR ka usda-fdc-172096 "Pizza, pepperoni topping, regular crust, frozen, cooked", rreshtin që #151 përdor për picën me djathë. | `preferred` usda-fdc-172096; `also` usda-fdc-2708636 (medium crust), livsmedelsverket-764; 2708635 jashtë. | i mundshëm |
| 304 | pizza-ham | [V] `also` cofid-11-1013 është pica me proshutë dhe ananas, ciqual-26274 është pica me proshutë të papërpunuar (speck), jo me proshutë të gatuar. | Hiqi të dy. | i sigurt (ananasi); i mundshëm (speck) |
| 305 | beer | [V] SR usda-fdc-168746 "Alcoholic beverage, beer, regular, all" ka vlerat identike me FNDDS-in e preferuar; `also` livsmedelsverket-1902 është birrë e lehtë 3,5 %. | `preferred` usda-fdc-168746; `also` 2710616, livsmedelsverket-1906 (mund të shtohet ciqual-5001); 1902 jashtë. | i sigurt (radha); i mundshëm (3,5 %) |
| 311 | hot-chocolate | [V] `also` usda-fdc-2705472 "Hot chocolate / cocoa, NFS" ka P 1,8 kundrejt 3,5 të preferuarit (NFS përfshin edhe atë me ujë). | Hiqe; nëse duhet një FNDDS, usda-fdc-2705473 (made with whole or 2% milk). | i mundshëm |
| 314 | chicken-nuggets | [V] SR usda-fdc-170718 "Fast foods, chicken, breaded and fried, boneless pieces, plain" ka vlerat identike me FNDDS NFS; `also` ciqual-36027 (paketuar, Y 11,6 kundrejt 20,4) duket i papjekur. | `preferred` usda-fdc-170718; `also` 2706092, 2706096; ciqual-36027 jashtë. | i sigurt (radha); i mundshëm (Ciqual) |
| 319 | sandwich-ham-cheese | [V][S] `also` ciqual-25547 është croque-monsieur (i thekur, me gjalpë/beshamel), sanduiç tjetër nga "Ham sandwich on white, with cheese". | Hiqe, ose hyrje më vete "Tost me proshutë dhe djathë". | i mundshëm |
| 320 | hot-dog-bun | [V] I preferuari është Ciqual, por FNDDS ka usda-fdc-2707056 "Hot dog sandwich, NFS, on white bun" (296 kcal), pa `reason`. | `preferred` usda-fdc-2707056; `also` ciqual-25403. | i mundshëm |
| 323 | pancakes | [V] SR ka usda-fdc-175009 "Pancakes, plain, prepared from recipe" (pa fibra), por FNDDS-i i preferuar nuk ka `reason`. | `reason` ("SR pa fibra të njohura"), me 175009 te `also` nëse pranohet. | i mundshëm |
| 324 | cookies-choc-chip | [V] SR usda-fdc-172716 "Cookies, chocolate chip, commercially prepared, regular, higher fat, enriched" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-172716; `also` 2707909, cofid-11-815, livsmedelsverket-1621. | i sigurt |
| 326 | chocolate-cake | [V] I preferuari usda-fdc-2707873 "Snack cake, chocolate" ka vlerat identike me SR 174942 "snack cakes, creme-filled" (kek industrial me krem), jo tortë; `also` livsmedelsverket-3591 është kladdkaka (kek i dendur). | `preferred` usda-fdc-174934 "Cake, chocolate, commercially prepared with chocolate frosting"; `also` usda-fdc-2707866, ciqual-23585; 2707873 dhe livsmedelsverket-3591 jashtë. | i sigurt |
| 327 | doughnut | [V] SR ka usda-fdc-174992 "Doughnuts, cake-type, plain, sugared or glazed" (426 kcal, makro pothuajse si FNDDS NFS), pa `reason`. | `preferred` usda-fdc-174992; FNDDS te `also`. | i mundshëm |
| 328 | muffin | [V] Dy `also` të Livsmedelsverket janë dy produkte (shtëpie 350 kcal, Y 17,4; amerikane 431, Y 24,2); SR ka usda-fdc-172764 "Muffins, plain, prepared from recipe" pa `reason`. | Mbaj një rresht të Livsmedelsverket; `reason` për FNDDS NFS ose `preferred` 172764. | i mundshëm |
| 329 | ice-cream-chocolate | [V] `also` cofid-12-511 është akullore "luxury, with chocolate/caramel" (262 kcal), produkt tjetër. | Hiqe. | i mundshëm |
| 331 | cola-diet | [V] I preferuari usda-fdc-174850 është kola diet pa kafeinë; SR usda-fdc-175099 (me kafeinë) ka vlerat identike me FNDDS 2710542 "Soft drink, cola, diet". | `preferred` usda-fdc-175099; `also` usda-fdc-2710542, cofid-17-505, livsmedelsverket-1831. | i sigurt |
| 334 | juice-pineapple | [V] SR usda-fdc-169947 "Pineapple juice, canned or bottled, unsweetened" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-169947; `also` 2709329, ciqual-2073, livsmedelsverket-660, cofid-14-286. | i sigurt |
| 335 | juice-grapefruit | [V] I preferuari është lëng në shishe (Foundation), kurse 4 nga 5 `also` janë lëng i shtrydhur i freskët (usda-fdc-173039, 2709176, ciqual-2025, livsmedelsverket-649). | Mbaj shishen (si #124, #253) dhe hiq të freskëtit, ose hyrje më vete "Lëng grejpfruti i shtrydhur" me 173039. | i mundshëm |
| 336 | smoothie-fruit | [V] FNDDS NFS ka vlerat e "with whole fruit and dairy" (P 2,3, Y 1,1); `also` ciqual-2500 është vetëm fruta (P 0,6). | `preferred` usda-fdc-2709334 "Fruit smoothie, with whole fruit, no dairy" me ciqual-2500; ose emri "Smoothie me fruta dhe kos" pa Ciqual. | i mundshëm |
| 338 | oat-milk | [V] I preferuari është Ciqual pa `reason`, por Foundation ka usda-fdc-2257046 "Oat milk, unsweetened, plain, refrigerated" dhe FNDDS usda-fdc-2705412 "Oat milk". | `preferred` usda-fdc-2257046; `also` 2705412, ciqual-18899, livsmedelsverket-700. | i sigurt |
| 339 | coconut-milk-cooking | [V] SR usda-fdc-170172 "Nuts, coconut milk, raw (liquid expressed…)" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-170172; `also` 2707568, ciqual-18041, livsmedelsverket-1590. | i sigurt |
| 345 | arugula | [V] I preferuari është rukola "baby" (Foundation, P 1,6), lloj i veçantë si stafidhet e arta te #126; SR dhe FNDDS janë rukola e zakonshme (P 2,6). | `preferred` usda-fdc-169387 me `reason` ("Foundation ka vetëm rukolën baby"); `also` 2709791, livsmedelsverket-2561 (mund të shtohet ciqual-20217); 2710822 jashtë. | i mundshëm |
| 349 | mango-dried | [V] I preferuari është mango e thatë me sheqer (K 76,2, F 2,4); `also` livsmedelsverket-6994 (K 64, F 9,2) duket pa sheqer. | Hiqe livsmedelsverket-6994; emri "Mango e thatë, e ëmbëlsuar". | i mundshëm |
| 352 | tuna-raw | [V] Lloje të përziera: i preferuari dhe ciqual-26068 janë skipjack, usda-fdc-2706308 ka vlerat e yellowfin-it, livsmedelsverket-7156 është yellowfin; #192 (i pjekuri) është bluefin. | Një lloj: bluefin si #192 (`preferred` usda-fdc-173706, `also` ciqual-26069), ose yellowfin (`preferred` usda-fdc-175159, `also` 2706308, ciqual-26064, livsmedelsverket-7156, cofid-16-399); skipjack jashtë. | i sigurt (përzierja); i mundshëm (cili lloj) |
| 362 | egg-scrambled | [V] `also` usda-fdc-2707205 është "Egg omelet or scrambled egg, no added fat" (si ciqual-22505 te #96, që u hoq), kurse SR-ja e preferuar ka qumësht dhe yndyrë; cofid-12-963 është pa qumësht. | Hiqe 2707205; cofid-12-963 jashtë (CoFID ka edhe cofid-12-945 me qumësht, Y 21,2). | i sigurt (2707205); i mundshëm (CoFID) |
| 364 | bagel | [V] SR usda-fdc-174899 "Bagels, plain, enriched…" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-174899; `also` 2707684, ciqual-7258, cofid-11-970. | i sigurt |
| 365 | baguette | [V] I preferuari është Ciqual ("Pain blanc, p.sh. baguette, boule"), por SR ka usda-fdc-172675 "Bread, french or vienna" (272 kcal), pa `reason`. | `preferred` usda-fdc-172675; `also` 2707610, ciqual-7001, livsmedelsverket-200. | i mundshëm |
| 366 | waffle | [V] Përzihen vaflet e ngrira (i preferuari) me ato të shtëpisë (usda-fdc-175039, cofid-11-1130, Y 14–15 kundrejt 9,7). | Mbaj të ngrirat (175038, 2708312); 175039 dhe cofid-11-1130 jashtë ose hyrje më vete. | i mundshëm |
| 367 | brownie | [V] SR usda-fdc-172713 "Cookies, brownies, commercially prepared" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-172713; `also` 2707904, ciqual-23032, livsmedelsverket-5833. | i sigurt |
| 368 | apple-pie | [V] SR ka usda-fdc-175011 "Pie, apple, commercially prepared" (237 kcal, afër CoFID 245), pa `reason`. | `preferred` usda-fdc-175011, ose `reason`. | i mundshëm |
| 373 | lasagna-meat | [V] SR ka usda-fdc-172114 "Lasagna with meat sauce, frozen, prepared" (135 kcal), pa `reason`. | `preferred` usda-fdc-172114, ose `reason`. | i mundshëm |
| 383 | sole-raw | [V] SR usda-fdc-174196 është "flatfish (flounder and sole species)" me P 12,4; gjuhëza (Solea solea) është ciqual-26058 (P 18). | `preferred` ciqual-26058 me `reason` ("USDA ka vetëm peshq të sheshtë të përzier"); 174196 jashtë. | i mundshëm |
| 384 | hamburger-bun | [V] SR ka usda-fdc-172796 "Rolls, hamburger or hotdog, plain" (279 kcal), pa `reason`. | `preferred` usda-fdc-172796; `also` 2707657, livsmedelsverket-3818. | i mundshëm |
| 391 | spaghetti-meat-sauce | [V] I preferuari është Livsmedelsverket, por SR ka usda-fdc-167680 "Restaurant, Italian, spaghetti with meat sauce" (121 kcal), pa `reason`. | `preferred` usda-fdc-167680; `also` livsmedelsverket-858. | i mundshëm |
| 393 | pretzels | [V] SR usda-fdc-167555 "Snacks, pretzels, hard, plain, salted" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-167555; `also` 2708247, 2708248, ciqual-38107, livsmedelsverket-1585. | i sigurt |
| 394 | tortilla-chips | [V] SR usda-fdc-167558 "Snacks, tortilla chips, plain, white corn, salted" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-167558; `also` 2708202, ciqual-38417, cofid-17-644. | i sigurt |
| 409 | hash-browns | [V] SR usda-fdc-170044 "Potatoes, hash brown, frozen, plain, prepared, pan fried" ka pothuajse të njëjtat vlera me FNDDS NFS (219/2,7/25,3/11,6 kundrejt 217/2,6/25/11,5). | `preferred` usda-fdc-170044; `also` 2709477 (2709483 "from fresh", K 17, mund të dalë jashtë). | i sigurt |
| 416 | vegetables-mixed-frozen-cooked | [V] I preferuari është "with salt", ndërsa SR ka usda-fdc-170472 "without salt" (rregulli "pa kripë kur ekziston"). | `preferred` usda-fdc-170472; `also` 2710013; 170142 jashtë. | i sigurt |
| 420 | corn-sweet-cooked | [V] I preferuari është "with salt", ndërsa SR ka usda-fdc-169999 "without salt" me vlera identike. | `preferred` usda-fdc-169999. | i sigurt |
| 423, 424 | peaches-canned, fruit-cocktail-canned | [V] Të preferuarit janë "drained", kurse cofid-14-189 dhe cofid-14-097 janë "whole contents" (me shurupin). | Hiqi të dy rreshtat e CoFID. | i mundshëm |
| 425 | applesauce | [V] SR ka usda-fdc-167773 "Applesauce, canned, sweetened" (76 kcal, si FNDDS 75), pa `reason`. | `preferred` usda-fdc-167773; `also` 2709216. | i mundshëm |
| 432 | cinnamon | [V] I preferuari është Ciqual, por SR ka usda-fdc-171320 "Spices, cinnamon, ground" me të njëjtat makro. | `preferred` usda-fdc-171320; `also` ciqual-11025, livsmedelsverket-2306. | i sigurt |
| 445 | lychee-raw | [V] SR usda-fdc-169086 "Litchis, raw" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-169086; `also` 2709240, cofid-14-142, livsmedelsverket-2569. | i sigurt |
| 446 | passion-fruit-raw | [V] SR usda-fdc-169108 "Passion-fruit, (granadilla), purple, raw" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-169108; `also` 2709248, livsmedelsverket-579. | i sigurt |
| 457 | caesar-dressing | [V] SR usda-fdc-169055 "Salad dressing, caesar dressing, regular" ka vlerat identike me FNDDS-in e preferuar. | `preferred` usda-fdc-169055; `also` 2710199, ciqual-11248. | i sigurt |
| 472 | lobster-cooked | [V] SR ka usda-fdc-174209 "Crustaceans, lobster, northern, cooked, moist heat" (89 kcal), pa `reason`. | `preferred` usda-fdc-174209; `also` 2706349, cofid-16-332, livsmedelsverket-1393. | i mundshëm |
| 474 | herring-raw | [V] I preferuari është harenga e Paqësorit (195 kcal), ndërsa SR ka usda-fdc-175116 "Fish, herring, Atlantic, raw" (158), lloji i Ciqual dhe i Livsmedelsverket. | `preferred` usda-fdc-175116; `also` ciqual-26011, livsmedelsverket-1241 (mund të shtohet cofid-16-175); 173669 jashtë. | i sigurt |
| 475 | surimi | [V] Emri thotë shkopinj gaforreje, por i preferuari "Fish, surimi" është pasta e peshkut (P 15,2); `also` livsmedelsverket-2035 ka P 0,8 dhe K 23,5, vlera që nuk përputhen me asnjë surimi. | `preferred` usda-fdc-174203 "crab, imitation, made from surimi"; `also` usda-fdc-2706568, ciqual-26046; 173702 dhe livsmedelsverket-2035 jashtë. | i sigurt |
| 477 | pork-liver-raw | [V] I preferuari është Ciqual, por SR ka usda-fdc-167862 "Pork, … liver, raw" (134 kcal), pa `reason`; mëlçitë e tjera (#179, #180) janë të gatuara. | `preferred` usda-fdc-167862; `also` ciqual-40119, livsmedelsverket-1449. Mundësisht e gatuara: usda-fdc-167863. | i sigurt (radha); i mundshëm (gjendja) |
| 479 | liver-pate | [V][S] Rreshtat janë liverwurst ("Liver sausage"), jo pate; katalogu ka pate mëlçie. | Ose emri "Salsiçe me mëlçi derri (liverwurst)", ose `preferred` usda-fdc-172930 "Pate, liver, not specified, canned" me cofid-19-317 dhe ciqual-8305. | i mundshëm |
| 482 | milk-powder-whole | [V] I preferuari është Ciqual, por SR ka usda-fdc-173454 "Milk, dry, whole" (496 kcal), pa `reason`. | `preferred` usda-fdc-173454; `also` ciqual-19021, livsmedelsverket-4537. | i sigurt |
| 485 | sparkling-wine | [V] I preferuari është Ciqual, por FNDDS ka usda-fdc-2710687 "Wine, sparkling" (75 kcal), pa `reason`. | `preferred` usda-fdc-2710687; `also` ciqual-5207, ciqual-5201. | i sigurt |
| 486 | caffe-latte | [V] I preferuari është Livsmedelsverket, por FNDDS ka usda-fdc-2710386 "Coffee, Latte" (43 kcal), pa `reason`. | `preferred` usda-fdc-2710386; `also` livsmedelsverket-2816. | i sigurt |
| 489 | milkshake-vanilla | [V] `also` cofid-12-591 është milkshake nga pluhuri me qumësht (86 kcal), jo milkshake i trashë. | Hiqe; nëse duhet, ciqual-39001 "Milkshake, from fast food". | i mundshëm |
| 492 | custard | [V] SR ka usda-fdc-169595 "Desserts, egg custard, baked" (104 kcal), pa `reason`. | `preferred` usda-fdc-169595; `also` 2705682, cofid-12-573. | i mundshëm |
| 494 | cereal-bar | [V] `also` livsmedelsverket-2072 është bar me çokollatë, kurse hyrja është bar me fruta. | Hiqe. | i sigurt |
| 495 | onion-rings | [V] I preferuari (Foundation) është pjekur në furrë (289 kcal), kurse `also` usda-fdc-2710055 është i skuqur (352, Y 19,8). | Hiqe 2710055 dhe shto usda-fdc-170415 (SR, po në furrë); ose hyrje e skuqur me SR 170697. | i mundshëm |
| 496 | falafel | [V] `reason` thotë se USDA nuk ka fibra, por FNDDS usda-fdc-2707408 ka F 4,8 (me 514 kcal dhe Y 41,2, larg të tjerëve); `also` ciqual-25590 është i paketuar (211 kcal) kundrejt atij të gatshëm (252). | `reason`: "SR pa fibra; FNDDS 514 kcal, larg Ciqual dhe Livsmedelsverket"; ciqual-25590 jashtë. | i mundshëm |

## 2. Emrat shqip

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 315 | chicken-breast-fried-breaded | [V][S] "me petë" do të thotë me fletë brumi; rreshti është i panuar dhe me lëkurë. | "Gjoks pule me lëkurë, i panuar dhe i skuqur". | i sigurt |
| 346 | tzatziki | [S] Shqip thuhet xaxiki. | "Xaxiki". | i sigurt |
| 359 | pork-loin-raw | [S] "lomo" nuk është shqip; #100 e quan "Fileto derri". | "Fileto derri, e pagatuar". | i sigurt |
| 362 | egg-scrambled | [S] "të përziera në tigan" është kalk; shqip thuhet "vezë të trazuara". | "Vezë të trazuara". | i sigurt |
| 372 | bran-flakes | [S] "Kornfleks" janë flokë misri; bran flakes janë krunde gruri. | "Drithëra mëngjesi me krunde gruri (bran flakes)". | i sigurt |
| 388 | millet-cooked | [S] "Meli" është trajta e shquar; hyrjet e tjera janë në trajtën e pashquar. | "Mel, i zier". | i sigurt |
| 393 | pretzels | [S] "kripore" është vendi ku nxirret kripa. | "Pretzel të kripur". | i sigurt |
| 399 | cranberries-raw | [S] Mospërputhje: "Boronica" (shumës, si #129) me "e kuqe" (njëjës). | "Boronica të kuqe (cranberry)". | i sigurt |
| 424 | fruit-cocktail-canned | [S] "Kompost" është pleh organik; frutat në shurup janë komposto. | "Komposto frutash (fruit cocktail)". | i sigurt |
| 438 | soybeans-cooked | [S] Bishtajoret në shumës (rregull i rishikimit të parë); "Soje, e zier" është njëjës. | "Fasule soje, të ziera". | i sigurt |
| 471 | veal-shank-raw | [S] "kërcell" është bishti i bimës; pjesa e këmbës është kërci. | "Kërci viçi (për zierje), i pagatuar". | i sigurt |
| 476 | fish-sticks | [V][S] "Shkopinj … të ngrira" nuk përputhet në gjini, dhe rreshti është "frozen, prepared" (i gatuar). | "Shkopinj peshku, të gatuar". | i sigurt |
| 480 | pepperoni | [S] "(feta)" ngatërrohet me djathin feta (gabim i rishikimit të parë, #101, #286). | "Pepperoni, në feta". | i sigurt |
| 495 | onion-rings | [S] "rruaza" janë kokrrat e gjerdanit; rrathët janë unaza. | "Unaza qepe të skuqura" (ose "të pjekura në furrë", sipas gjetjes 1 › #495). | i sigurt |
| 308 | spirit-40 | [S] "Pije e distiluar" është term teknik. | "Raki ose vodka (40% alkool)". | i mundshëm |
| 316 | chicken-wing-raw | [S] Shumës, kurse #176 "Krah pule me lëkurë, i pjekur" është njëjës. | "Krah pule me lëkurë, i pagatuar". | i mundshëm |
| 343, 379 | mascarpone, gruyere | [S] "è" nuk është në alfabetin shqip; djathërat e tjerë përshtaten (Mocarela, Parmixhano, Rikotë). | "Maskarpone"; "Djathë grujer". | i mundshëm |
| 347 | salsa | [S] "Salcë salsa" përsërit të njëjtën fjalë. | "Salsa meksikane (salcë domateje me spec djegës)". | i mundshëm |
| 360 | veal-cutlet-raw | [S] "Fileto" zakonisht është bonfileja; rreshti është eskalop nga kofsha. | "Eskalop viçi, i pagatuar". | i mundshëm |
| 363 | egg-poached | [S] "poche" pa theks është frëngjisht e cunguar. | "Vezë poshe". | i mundshëm |
| 368 | apple-pie | [S] Forma standarde është "pite". | "Pite me mollë". | i mundshëm |
| 377 | blue-cheese | [S] "Djathë blu" është kalk. | "Djathë me myk blu". | i mundshëm |
| 381 | lamb-leg-roasted | [V] Rreshti është "lean only", si #33 "Kofshë qengji pa dhjamë", por emri nuk e thotë. | "Kofshë qengji pa dhjamë, e pjekur". | i mundshëm |
| 382 | pollock-raw | [S] "Pollok" nuk është shqip; te tregu shitet si merluc. | "Merluc i Alaskës (pollock), i pagatuar". | i mundshëm |
| 389 | buckwheat-raw | [S] "Hikërr" është femërore (hikrra). | "Hikërr, e pagatuar". | i mundshëm |
| 400 | currant-red-raw | [S] Shqip thuhet rrush frëngu. | "Rrush frëngu i kuq". | i mundshëm |
| 402 | brussels-sprouts | [S] Shqip thuhet "lakër Brukseli". | "Lakër Brukseli". | i mundshëm |
| 403 | fennel-raw | [S] Koka e fenikulit në treg shitet si finok; "mares" nuk njihet gjerësisht. | "Finok". | i mundshëm |
| 418 | potato-salad | [V][S] Rreshti i SR ka majonezë dhe vezë; sallata shqiptare e patateve zakonisht bëhet me vaj. | "Sallatë patatesh me majonezë". | i mundshëm |
| 423 | peaches-canned | [S] Shqip thuhet komposto. | "Komposto pjeshke". | i mundshëm |
| 434, 435 | pecans, macadamia | [S] "Pekan", "Makadamia" vetëm nuk kuptohen; #444 thotë "Arra braziliane". | "Arra pekan"; "Arra makadamia". | i mundshëm |
| 436 | pine-nuts | [S] Shqip thuhet "fara pishe". | "Fara pishe (pinoli)". | i mundshëm |
| 439 | split-peas-cooked | [S] #166 dhe #440 thonë "të thata". | "Bizele të thata, të ziera". | i mundshëm |
| 446 | passion-fruit-raw | [S] "Fruta e pasionit" është kalk; në Shqipëri njihet si marakuja. | "Marakuja (fruta e pasionit)". | i mundshëm |
| 462 | hot-sauce | [S] "Tabasco" është markë, rreshti është i përgjithshëm. | "Salcë djegëse". | i mundshëm |
| 475 | surimi | [S] Gjinorja e "gaforre" është "gaforreje". | "Surimi (shkopinj gaforreje)". | i mundshëm |
| 481 | turkey-bacon | [V] Rreshti është i gatuar (microwaved); #161 e thotë "i gatuar". | "Bekon gjeldeti, i gatuar". | i mundshëm |
| 498 | gyro-sandwich | [S] Në Shqipëri pita me gjiro quhet sufllaqe. | "Sufllaqe me gjiro". | i mundshëm |

## 3. Vlera të dyshimta

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 435 | macadamia | [V] Foundation jep Y 64,9 dhe K 16,5, kurse SR dhe Livsmedelsverket Y 75,8 dhe K 5,2 (karbohidratet tri herë më shumë). | `preferred` usda-fdc-170178 me `reason`, ose lëre dhe shënoje (si #24 feta). | i mundshëm |
| 444 | brazil-nuts | [V] Foundation jep Y 57,4 dhe K 15,7, kurse SR Y 67,1 dhe K 4,2, Livsmedelsverket Y 67,8 dhe K 0. Më i butë, i njëjti model te #436 pine-nuts (K 14,7 kundrejt 9,4). | `preferred` usda-fdc-170569 me `reason`, ose lëre dhe shënoje. | i mundshëm |

## 4. Dyfishime

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 84, 427 | tangerine-raw, clementine-raw | [V] Rreshtat e përzier ndahen mes dy hyrjeve: ciqual-13024 "Clementine or Mandarin" është te #84, livsmedelsverket-560 "clementin mandarin tangerin satsumas" te #427. | Të dy rreshtat e përzier te e njëjta hyrje (ose jashtë të dyjave). | i mundshëm |

## Vërejtje jashtë katër llojeve (nuk numërohen)

- Radha e burimeve: 28 gjetje te lloji 1 janë rreshta të SR Legacy, Foundation ose FNDDS që ekzistojnë, por nuk janë anëtarë të hyrjes. `validateCommon` nuk mund t'i kapë. Një shënim i ri te vërtetimi (rreshti USDA me `name_en` të ngjashëm dhe kcal brenda 5 % të të preferuarit nga burim më i ulët) do t'i kapte ato me vlera identike.
- Grupi `group` nuk përputhet: #339 Qumësht kokosi (për gatim) është te "Pije"; #393 Pretzel është te "Sheqer dhe ëmbëlsira", kurse #394 Çipsa misri te "Të tjera"; #375 Raviolë është te "Drithëra dhe bukë", kurse #373, #374, #391 te "Të tjera"; #409 Hash brown është te "Perime", kurse #103 Patate të skuqura te "Të tjera".

## Numri i gjetjeve

| Lloji | Gjithsej | I sigurt | I mundshëm |
|---|---|---|---|
| 1. Përputhje të gabuara | 57 (59 hyrje) | 29 | 28 |
| 2. Emra shqip | 38 (40 hyrje) | 14 | 24 |
| 3. Vlera të dyshimta | 2 | 0 | 2 |
| 4. Dyfishime | 1 | 0 | 1 |
| **Gjithsej** | **98** | **43** | **55** |

Te lloji 1, gjetjet me një pjesë të sigurt dhe një të mundshme (#304, #305, #314, #352, #362, #477) numërohen si "i sigurt", si te rishikimi i parë.

Prodhuar nga Claude (AI); rishikohet nga Andi
