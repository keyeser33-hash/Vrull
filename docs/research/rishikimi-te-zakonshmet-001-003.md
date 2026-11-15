# Rishikimi i të zakonshmeve të Listës së Vrullit (rank 1–298)

Çfarë u kontrollua: 298 hyrjet e `tools/food-catalog/common/001–003.json`, me rreshtin `preferred` dhe çdo `also` (gjithsej 735 rreshta: 298 + 437) të lexuar nga `/tmp/food-out/catalog-all.jsonl` me një skript Python jashtë repo-s (`/tmp/review-work/join.py`, `checks.py`, `find.py`). Asnjë skedar i repo-s nuk u ndryshua.

Rregullat e matjes: SPEC V61 dhe §0.3h, `docs/agents/PLANI-LISTA-E-VRULLIT.md`, `tools/food-catalog/README.md` › "Të zakonshmet (V61)".

Shenjat: [V] = e parë në rreshtat e katalogut me skript në këtë sesion; [S] = gjykimi im (gjuha, njohja e ushqimit). Hyrjet në rregull dhe `also` që mungojnë (p.sh. një rresht i Ciqual që mund të shtohej) nuk renditen.

## 1. Përputhje të gabuara

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 7 | cottage-cheese-low-fat | [V] `also` usda-fdc-173417 është gjizë me 1% yndyrë (72 kcal, Y1), kurse i preferuari është me 2% (Y2,3). | Hiqe usda-fdc-173417. | i mundshëm |
| 39 | sea-bream-raw | [V] I preferuari është CoFID, por Ciqual (që vjen para CoFID) ka koce: ciqual-26088 (e fermës) dhe ciqual-26080 (e egër). "Bream, Sea" i CoFID mund të jetë një lloj tjetër. | `preferred` ciqual-26088 (kocja në Shqipëri është kryesisht e fermës); `also` livsmedelsverket-4612 (gilt-head sea bream, i papërpunuar); cofid-16-006 jashtë ose me `reason`. | i sigurt (radha); i mundshëm (lloji i CoFID) |
| 44 | cornbread | [V][S] Rreshti është cornbread amerikane me qumësht 2%, sheqer dhe yndyrë; "bukë misri" shqiptare bëhet me miell misri, ujë dhe kripë. | Emri "Bukë misri amerikane (cornbread)", ose bukë misri si recetë e Vrullit (V31). | i mundshëm |
| 64 | cabbage-green-raw | [V] `also` ciqual-20069 "Chou vert" është lakra jeshile e savojës, jo lakra e zakonshme me kokë. | Zëvendësoje me ciqual-20116 "Chou blanc, cru"; shto livsmedelsverket-370 "Vitkål". | i mundshëm |
| 96 | egg-fried | [V] `also` ciqual-22505 "Oeuf au plat, sans matière grasse" është skuqur pa yndyrë (157 kcal, Y10,4); USDA-ja e ka me yndyrë (196 kcal, Y14,8). | Hiqe ciqual-22505. | i sigurt |
| 99 | beef-ground-cooked | [V] I gatuari është 80/20, kurse i papërpunuari (#31) është 90% pa yndyrë: i njëjti emër, mish tjetër. | `preferred` usda-fdc-171793 (90/10, patty, pan-broiled, 204 kcal), ose emri "(80% pa yndyrë)". | i mundshëm |
| 103 | french-fries | [V] I preferuari është FNDDS, por SR Legacy ka usda-fdc-170698 "Fast foods, potato, french fried in vegetable oil" (312 kcal), pa `reason`. | Ose `reason` ("FNDDS NFS përfaqëson patatet e skuqura në shtëpi"), ose SR 170698. | i mundshëm |
| 109 | milk-skim | [V] `also` usda-fdc-169868 është qumësht i pasuruar me kalcium; ekziston SR usda-fdc-171269 me të njëjtin përshkrim si i preferuari. | Zëvendësoje 169868 me usda-fdc-171269. | i sigurt |
| 120 | coffee-brewed | [V] `also` cofid-17-154 është kafe "weak"; CoFID ka cofid-17-833 "Coffee, infusion, average". | Zëvendësoje me cofid-17-833. | i mundshëm |
| 122 | tea-black | [V] `also` usda-fdc-2710517 është çaj i ftohtë (iced); FNDDS ka usda-fdc-2710488 "Tea, hot, leaf, black". | Zëvendësoje me usda-fdc-2710488. | i mundshëm |
| 126 | raisins | [V] I preferuari është stafidhe të arta (golden, me sulfit), një variant i veçantë; ekziston usda-fdc-168165 "Raisins, dark, seedless". CoFID dhe Livsmedelsverket janë stafidhe të zakonshme. | `preferred` usda-fdc-168165; 168164 jashtë. | i sigurt |
| 145 | olives-black | [V] `also` livsmedelsverket-402 janë ullinj të zinj në vaj (142 kcal); USDA-ja janë ullinj në shëllirë (116 kcal). | Hiqe livsmedelsverket-402. | i mundshëm |
| 151 | pizza-cheese | [V] I preferuari është Ciqual, por SR ka usda-fdc-170317 "Pizza, cheese topping, regular crust, frozen, cooked" (jo markë), pa `reason`. | `preferred` usda-fdc-170317, ose `reason`. | i mundshëm |
| 153 | cornflakes | [V] I preferuari është Ciqual, por FNDDS ka usda-fdc-2708453 "Cereal, corn flakes, plain", pa `reason`. | Ose `preferred` 2708453, ose `reason`; mund të shtohet cofid-11-745 (unfortified). | i mundshëm |
| 158 | kefir | [V] I preferuari (FNDDS, Y1) është kefir me pak yndyrë; ciqual-19865 (Y3,4) dhe livsmedelsverket-142 (3%) janë kefir i plotë. | `preferred` ciqual-19865 me `reason` ("USDA ka vetëm kefir me pak yndyrë"), `also` livsmedelsverket-142; 2705394 jashtë ose hyrje më vete. | i sigurt |
| 160 | sausage-pork-cooked | [V] `also` ciqual-30701 "Saucisson pur porc cuit" është sallam i gatuar, jo salsiçe e freskët e skuqur në tigan. | Hiqe ciqual-30701. | i mundshëm |
| 166 | lentils-raw | [V] `also` cofid-13-657 janë thjerrëza të kuqe të ndara (F17,4); USDA-ja janë thjerrëza të zakonshme. | Zëvendësoje me cofid-13-089 (green and brown, whole, dried, raw); shto livsmedelsverket-884. | i sigurt |
| 173 | cheese-processed | [V] I preferuari është FNDDS; SR usda-fdc-171289 "Cheese product, pasteurized process, American" ka të njëjtat vlera, pa `reason`. | `preferred` usda-fdc-171289, ose `reason`. | i mundshëm |
| 190 | mortadella | [V] I preferuari usda-fdc-173856 "Bologna, pork" dhe `also` 2706176 "Bologna" janë bologna amerikane, jo mortadelë. Katalogu ka mortadelën. | `preferred` usda-fdc-174573 "Mortadella, beef, pork"; `also` usda-fdc-2706182, ciqual-30789. | i sigurt |
| 191 | frankfurter | [V] I preferuari është frankfurter vetëm me mish lope; Ciqual dhe CoFID janë frankfurter i zakonshëm (derri). SR ka usda-fdc-172968 "Frankfurter, meat". | `preferred` usda-fdc-172968. | i mundshëm |
| 199 | flour-corn | [V] `also` ciqual-9545 është miell misri i rafinuar (vlerat njësoj si usda-fdc-169695 "degermed"), kurse i preferuari është me drithë të plotë. | Hiqe ciqual-9545 (ose hyrje më vete "Miell misri i rafinuar" me 169695, ciqual-9545, livsmedelsverket-1933). | i sigurt |
| 206 | muesli | [V] ciqual-32004 "Muesli (average)" përfshin musli krokante (Y14,3); cofid-11-780 është musli zvicerane (Y6,3). | Zgjidh llojin: për musli zvicerane `preferred` ciqual-32138 me cofid-11-780 dhe livsmedelsverket-2024. | i mundshëm |
| 208 | biscuit-plain | [V] I preferuari është Livsmedelsverket, por SR ka usda-fdc-171867 "Cookies, Marie biscuit". | `preferred` usda-fdc-171867; `also` livsmedelsverket-1614. | i sigurt |
| 209 | cracker | [V] `also` cofid-11-820 dhe livsmedelsverket-1611 janë "cream crackers" (Y16–22), jo saltine (Y11,8). | Hiqi të dy, ose hyrje më vete. | i mundshëm |
| 261 | hazelnut-spread | [V] `also` cofid-17-659 është "Chocolate spread" pa lajthi; CoFID ka cofid-17-687 "Chocolate nut spread". | Zëvendësoje me cofid-17-687. | i mundshëm |
| 268 | lemonade | [V][S] Ciqual-18010 "Limonade, sucrée" është pije e gazuar franceze; limonada shqiptare është lëng limoni me ujë dhe sheqer. | `preferred` usda-fdc-173217 "Lemonade, frozen concentrate, white, prepared with water"; ciqual-18010 jashtë ose me emër "Pije e gazuar me limon". | i mundshëm |
| 270 | omelette | [V] `also` livsmedelsverket-1229 është omletë me krem (237 kcal). SR ka usda-fdc-172185 "Egg, whole, cooked, omelet", që sipas radhës vjen para Ciqual. | Zëvendësoje 1229 me livsmedelsverket-1230 (me ujë); `preferred` usda-fdc-172185 ose `reason`. | i sigurt (kremi); i mundshëm (radha) |
| 271 | milk-chocolate-drink | [V] `also` cofid-12-535 (Y1,5) është me qumësht gjysmë të skremuar; i preferuari është me qumësht të plotë (Y3,4). | Hiqe cofid-12-535. | i mundshëm |
| 274 | soy-sauce | [V] I preferuari është tamari (vetëm soje), lloj i veçantë. Salca e zakonshme është shoyu: usda-fdc-174277, me vlera njësoj si FNDDS 2707442 "Soy sauce". | `preferred` usda-fdc-174277; `also` usda-fdc-2707442, livsmedelsverket-909. | i sigurt |
| 280 | peanuts-roasted | [V] I preferuari është FNDDS, por SR ka usda-fdc-174262 "Peanuts, all types, dry-roasted, with salt" (vlera njësoj). | `preferred` usda-fdc-174262; `also` usda-fdc-2707517. | i sigurt |
| 291 | pasta-wholewheat-cooked | [V] I preferuari është makarona me 51% grurë integral; ekziston usda-fdc-168910 "Pasta, whole-wheat, cooked" dhe FNDDS 2708358 me të njëjtat vlera. | `preferred` usda-fdc-168910; `also` usda-fdc-2708358. | i sigurt |

## 2. Emrat shqip

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 55, 56, 108, 204, 236 | lentils-cooked, chickpeas-cooked, peas-green-cooked, noodles-egg-cooked, green-beans-cooked | [S] Drejtshkrimi: "të zjera" nuk është forma standarde. | "të ziera" (Thjerrëza, të ziera; Qiqra, të ziera; Bizele, të ziera; Petë me vezë, të ziera). | i sigurt |
| 137 | ice-cream-vanilla | [S] Drejtshkrimi: "vaniljë". | "Akullore me vanilje". | i sigurt |
| 262 | baklava | [S] Drejtshkrimi: "Bakllavë". | "Bakllava". | i sigurt |
| 68, 236 | green-beans-raw, green-beans-cooked | [S] "Fasule jeshile" është kalk; shqip thuhet bishtaja. | "Bishtaja"; "Bishtaja, të ziera". | i sigurt |
| 230 | asparagus-raw | [S] "Asparagus" është anglisht. | "Shparg". | i sigurt |
| 42, 119 | shrimp-raw, shrimp-cooked | [S] "Karkalec" pa "deti" është karkaleci i fushës. | "Karkalec deti, i pagatuar"; "Karkalec deti, i gatuar". | i sigurt |
| 50 | oats-rolled-dry | [S] "thërrime" do të thotë copëza buke. | "Tërshërë flokë, e thatë". | i sigurt |
| 160 | sausage-pork-cooked | [S] Suxhuku është sallam i tharë me erëza; rreshti është salsiçe e freskët derri e skuqur. | "Salsiçe derri, e skuqur". | i sigurt |
| 182, 185 | pork-chop-cooked, lamb-chop-cooked | [S] "Kotelet" nuk është shqip standarde; për copën me kockë thuhet bërxollë. | "Bërxollë derri, e pjekur"; "Bërxollë qengji, e pjekur". | i sigurt |
| 209 | cracker | [S] "krisur" do të thotë i çarë. | "Krakera (saltine)". | i sigurt |
| 210 | rice-cake | [S] "Kek" është ëmbëlsirë me brumë; ky produkt shitet si galeta. | "Galeta orizi". | i sigurt |
| 243 | dates-dried | [S] "(data)" nuk është shqip. | "Hurma arabe, të thata". | i sigurt |
| 46 | rice-white-raw | [S] "Oriz i papërpunuar" mund të lexohet si oriz i paqëruar (integral). | "Oriz i bardhë, i pagatuar" (ose "i thatë", si te makaronat #48). | i mundshëm |
| 15, 28, 30–34, 36–42, 51, 52, 89, 118, 193–197, 212 (25 hyrje) | — | [S] "i papërpunuar" do të thotë i papërpunuar industrialisht ("mish i papërpunuar" kundrejt "mish i përpunuar"), jo i pagatuar. | "i pagatuar" për mishin, peshkun dhe perimet; "të papjekur" për kikirikët (#89, kundrejt #280 "të pjekur"). | i mundshëm |
| 28, 29, 30, 33, 98, 100, 163, 164, 176, 183 | — | [S] Radha e USDA-së ("Pulë, gjoks…"), jo si e thotë një shqiptar. | "Gjoks pule pa lëkurë, i pagatuar"; "Gjoks gjeldeti, i pjekur"; "Kofshë qengji pa dhjamë"; "Krah pule me lëkurë, i pjekur"; "Shpatull derri, e pjekur". | i mundshëm |
| 54, 107, 216, 231 | white-beans-cooked, kidney-beans-cooked, black-beans-cooked, okra-cooked | [S] Numri: fasulet dhe bamjet thuhen në shumës. | "Fasule të bardha, të ziera"; "Fasule të kuqe, të ziera"; "Fasule të zeza, të ziera"; "Bamje të ziera". | i mundshëm |
| 130 | pistachios | [S] "Fëstëk" në të folur përdoret edhe për kikirikun. | "Fistikë". | i mundshëm |
| 123 | cola | [S] "Kolë" nuk thuhet. | "Kola (pije e gazuar me sheqer)". | i mundshëm |
| 146 | lettuce-romaine-raw | [S] Romaine në shqip është marulja. | "Marule". | i mundshëm |
| 64 | cabbage-green-raw | [S] Lakra e zakonshme me kokë (green cabbage në SHBA) thuhet lakër ose lakër e bardhë; "lakër jeshile" të çon te kale ose savoja. | "Lakër e bardhë". | i mundshëm |
| 106, 136 | rice-brown-cooked, sugar-brown | [S] "kaf" është formë e folur. | "Oriz integral, i zier"; "Sheqer kafe". | i mundshëm |
| 279 | semolina-dry | [S] Shqip thuhet griz. | "Griz (semolinë), i thatë". | i mundshëm |
| 290 | milk-sheep | [S] Më e natyrshme është "deleje". | "Qumësht deleje". | i mundshëm |
| 267 | almond-milk | [S] Mospërputhje me #257 "Gjalpë bajamesh". | "Qumësht bajamesh". | i mundshëm |
| 121 | espresso | [S] Në Shqipëri thuhet kafe ekspres. | "Kafe ekspres". | i mundshëm |
| 110, 276 | buttermilk, yogurt-drink | [S] Në Shqipëri "dhallë" zakonisht është kosi i holluar (si ajrani, #276); #110 është buttermilk amerikane. | #110 "Buttermilk (qumësht i fermentuar me pak yndyrë)"; #276 "Dhallë (ajran)". | i mundshëm |
| 287 | provolone | [S] Kaçkavalli është djathë tjetër; vlerat janë të provolones. | "Djathë provolone". | i mundshëm |
| 101, 286 | ham-sliced, turkey-ham-sliced | [S] "(feta)" ngatërrohet me djathin feta. | "Proshutë e gatuar, në feta"; "Proshutë gjeldeti, në feta". | i mundshëm |
| 161 | bacon-cooked | [S] Emri i gjatë; në Shqipëri thuhet pançetë ose bekon. | "Bekon (pançetë e tymosur), i gatuar". | i mundshëm |
| 284 | pork-ribs-cooked | [V][S] Rreshti është "braised" (gatuar me lëng), emri thotë "të pjekura". | "Brinjë derri, të gatuara në tavë". | i mundshëm |
| 5 | american-cheese-low-fat | [V][S] Rreshti është djathë i shkrirë (pasteurized process). | "Djathë i shkrirë amerikan, me pak yndyrë". | i mundshëm |
| 98, 163 | chicken-thigh-roasted, chicken-drumstick-roasted | [V] Rreshtat janë "meat only", emri nuk e thotë. | "Kofshë pule pa lëkurë, e pjekur"; "Këmbë pule pa lëkurë, e pjekur". | i mundshëm |
| 37, 193, 296 | cod-raw, hake-raw, cod-baked | [S] Dy peshq me të njëjtin emër, të dalluar vetëm me anglisht në kllapa; në tregun shqiptar "merluc" zakonisht është hake. | Cod: "Merluc atlantiku"; hake: "Merluc". | i mundshëm |
| 7, 25 | cottage-cheese-low-fat, cottage-cheese-full-fat | [S] Gjiza shqiptare nuk është cottage cheese (kokrrat me krem). | "Djathë cottage me pak yndyrë"; "Djathë cottage". | i mundshëm |
| 18 | dressing-oil-vinegar | [V] Rreshti i USDA-së nuk thotë vaj ulliri. | "Salcë sallate me vaj dhe uthull". | i mundshëm |
| 211 | popcorn | [S] Shqip thuhet në shumës. | "Kokoshka misri". | i mundshëm |

## 3. Vlera të dyshimta

Dhjetë rreshtat e parë janë një problem i vetëm. I preferuari është një rresht i Foundation pa fibra (`carbs_note: includes_fiber`), ndaj karbohidratet përfshijnë fibrat. Kjo bie ndesh me V61 (karbohidratet pa fibrat), ndërkohë që SR Legacy ka rreshtin me fibrat e njohura.

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 50 | oats-rolled-dry | [V] K 68,7 me fibrat; SR K 57,6 (F 10,1), Ciqual K 57,7. | `preferred` usda-fdc-173904 me `reason` ("Foundation pa fibra"); `also` 2346396, ciqual-32140, livsmedelsverket-702. | i sigurt |
| 64 | cabbage-green-raw | [V] K 6,4 kundrejt 2,7–4,8 te të tjerët. | `preferred` usda-fdc-169975 me `reason`. | i sigurt |
| 77 | strawberry-raw | [V] K 8,0 kundrejt 5,7–6,2. | `preferred` usda-fdc-167762 me `reason`. | i sigurt |
| 81 | cherry-sweet-raw | [V] K 16,2 kundrejt 13,9. | `preferred` usda-fdc-171719 me `reason`. | i sigurt |
| 129 | blueberries-raw | [V] K 14,6 kundrejt 12,1. | `preferred` usda-fdc-171711 me `reason`. | i sigurt |
| 143 | cabbage-red-raw | [V] K 6,8 kundrejt 4,3–5,3. | `preferred` usda-fdc-169977 me `reason`. | i sigurt |
| 221 | lettuce-iceberg-raw | [V] K 3,4 kundrejt 1,8–2,5. | `preferred` usda-fdc-169248 me `reason`. | i sigurt |
| 229 | celery-raw | [V] K 3,3 kundrejt 1,4–2,4. | `preferred` usda-fdc-169988 me `reason`. | i sigurt |
| 249 | raspberries-raw | [V] K 12,9 kundrejt 5,4–6,4 (dyfish). | `preferred` usda-fdc-167755 me `reason`. | i sigurt |
| 278 | chickpeas-canned | [V] K 20,3 kundrejt 16,1. | `preferred` usda-fdc-173800 me `reason`. | i sigurt |
| 155 | coconut-oil | [V] 833 kcal (faktorët specifikë të Foundation), kundrejt 881–899 te 5 rreshtat e tjerë dhe te vajrat e tjerë. | `preferred` usda-fdc-171412 (892) me `reason`. | i mundshëm |
| 207 | oat-bran | [V] 246 kcal, ndërsa 4P+4K+9Y jep rreth 366; Ciqual ka 361 kcal me makro të ngjashme. | Shto ciqual-9640; mundësisht `preferred` me `reason`. | i mundshëm |
| 265 | cocoa-powder | [V] 228 kcal (faktorët e USDA-së për kakaon), ndërsa 4P+4K+9Y jep rreth 359; etiketat në BE dhe Livsmedelsverket (368 kcal, 10–15% yndyrë) janë shumë më lart. | Shto livsmedelsverket-7054; vendos cili del i pari. | i mundshëm |
| 24 | feta | [V] Foundation jep P 19,7 dhe K 5,6, kurse SR, Ciqual dhe CoFID japin P 14–16 dhe K 0,5–3,9. | `preferred` usda-fdc-173420 me `reason`, ose lëre dhe shënoje. | i mundshëm |

## 4. Dyfishime

| Rank | key | Problemi | Propozimi | Siguria |
|---|---|---|---|---|
| 27, 114 | butter, butter-unsalted | [V] Gjalpë me kripë dhe pa kripë, me vlera identike (717 kcal, P 0,9, K 0,1, Y 81,1). Në hyrjet e tjera ndryshimi i kripës bashkohet te `also` (#6, #9, #49, #53–56, #226). | Bashkoji: `preferred` usda-fdc-173430 (pa kripë, si gjalpi i zakonshëm shqiptar), `also` 173410, 2710154, cofid-17-685, livsmedelsverket-29. Ose mbaji të dyja dhe ndaje kripën kudo. | i mundshëm |

## Vërejtje jashtë katër llojeve (nuk numërohen)

Grupi `group` i disa hyrjeve nuk përputhet me ushqimin:
- #103 Patate të skuqura dhe #152 Çipsa janë te "Drithëra dhe bukë".
- #174 Margarinë dhe #114 Gjalpë pa kripë janë te "Qumësht dhe bulmet", kurse #27 Gjalpë është te "Yndyrna dhe vajra".
- #94 Lëng portokalli është te "Të tjera", kurse lëngjet e tjera janë te "Pije".
- #11 Majonezë light është te "Të tjera", kurse #154 Majonezë është te "Yndyrna dhe vajra".

## Numri i gjetjeve

| Lloji | Gjithsej | I sigurt | I mundshëm |
|---|---|---|---|
| 1. Përputhje të gabuara | 31 | 13 | 18 |
| 2. Emra shqip | 36 (76 hyrje) | 12 | 24 |
| 3. Vlera të dyshimta | 14 | 10 | 4 |
| 4. Dyfishime | 1 | 0 | 1 |
| **Gjithsej** | **82** | **35** | **47** |

Te lloji 1, #39 dhe #270 numërohen si "i sigurt" sipas pjesës së sigurt të gjetjes.

Prodhuar nga Claude (AI); rishikohet nga Andi
