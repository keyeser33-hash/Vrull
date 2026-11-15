# Burimet e hapura të ushqimeve për Listën e Vrullit

Data e kontrollit: 2026-11-15. Vetëm fakte; asnjë kod nuk u ndryshua.

Shenjat: [V] = e lexova vetë te faqja primare (URL pranë). [S] = gjykimi im. Çfarë nuk u verifikua, thuhet hapur. Nuk jam jurist; as pronari. Tekstet e licencave janë cituar, jo interpretuar si këshillë ligjore.

## 1. USDA FoodData Central

- Botuesi: U.S. Department of Agriculture. Faqja e shkarkimeve: https://fdc.nal.usda.gov/download-datasets [V, 2026-11-15].
- Foundation Foods: 10/2026; CSV 4,1 MB zip, 35 MB. SR Legacy: 04/2018 (versioni i fundit); CSV 6,7 MB zip, 54 MB. FNDDS 2021-2023: 10/2024; CSV 200 MB zip, 1,6 GB. Branded Foods: 10/2026; CSV 432 MB zip, 3 GB. Të gjitha: 463 MB zip, 3,1 GB [V, faqja e shkarkimeve].
- Përditësimi: Foundation sipas çdo versioni; Branded çdo muaj në aplikacion/API, shkarkim i ri çdo gjashtë muaj; FNDDS çdo dy vjet; SR Legacy nuk përditësohet më [V, https://fdc.nal.usda.gov/faq/].
- Licenca: "USDA FoodData Central data are in the public domain and they are not copyrighted." dhe "They are published under CC0 1.0 Universal (CC0 1.0)." [V, https://fdc.nal.usda.gov/api-guide]. Nuk kërkohet leje; kërkohet të emërtohet FoodData Central si burim. Citimi i sugjeruar: "U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov." [V, po aty]. Faqja e shkarkimeve dhe FAQ nuk e përmbajnë këtë tekst.
- Gjuha: vetëm anglisht [S]. Nuk ka fushë shqipe.
- Numri i ushqimeve: nuk e verifikova nga faqja primare. Do të numërohet në import.
- Fusha (kcal, proteina, yndyra, karbohidrate, fibra): ekzistojnë si llëndë ushqyese në ato dataset-e; fushat nuk u lexuan në dokumentacion këtu [S].
- Pesha e porcioneve: faqja e dokumentimit nuk e përshkruan tabelën e porcioneve [V, https://fdc.nal.usda.gov/data-documentation/]. Nuk e verifikova. Prova me API (DEMO_KEY) u kufizua nga limiti; mbetet për t'u kontrolluar në skedarët CSV.
- Provë me API kërkimi (Foundation, SR Legacy, FNDDS), 2026-11-15 [V]: "feta" gjendet (Cheese, feta; Cheese, Feta; Cheese, feta, whole milk, crumbled); "kefir" gjendet (Kefir, lowfat, plain, LIFEWAY). Kërkimet "yogurt", "white beans", "spinach pie" nuk dhanë rezultat të besueshëm (përgjigje bosh ose "Spinach, creamed"); është i paqartë, jo provë mungese. "burek", "ajvar": asnjë rezultat.
- Branded Foods: 3 GB të pazipuara, produkte amerikane [S]. Për një përdorues në Shqipëri vlera është e vogël dhe kostoja në Supabase/telefon e madhe. Rekomandim: jo [S].

## 2. ANSES Ciqual 2025 (Francë)

- Publikuar 2025-11-19, versioni 1, DOI 10.57745/RDMHWY; skedarët datuar 2025-11-03 [V, Dataverse API: https://entrepot.recherche.data.gouv.fr/api/datasets/:persistentId/?persistentId=doi:10.57745/RDMHWY].
- Licenca: "etalab 2.0" (Licence Ouverte), lidhja https://spdx.org/licenses/etalab-2.0.html [V, API-ja e mësipërme]. Kushtet e Etalab 2.0 nuk i lexova këtu; ajo licencë kërkon në përgjithësi të përmendet burimi [S, e paverifikuar].
- Ushqime: 3484, 74 përbërës [V, https://www.anses.fr/fr/content/table-ciqual-une-nouvelle-version-enrichie-et-plus-representative]. Numri 3484 `<ALIM>` e konfirmova në skedarin XML [V].
- Emrat: `alim_nom_fr` dhe `alim_nom_eng` (anglisht) [V, skedari alim_2025_11_03.xml, lexuar vetë]. Emër shqip: jo.
- Formati: XML (compo 69 MB, alim 1,6 MB), XLSX 1,5 MB, XLS 4,5 MB, PDF dokumentimi [V, Dataverse API]. Faqja: https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY (robots bllokon leximin automatik; skedarët i lexova përmes API-së).
- Përditësimi: versioni i mëparshëm 2020 [V, anses.fr, po ajo faqe]; çdo disa vjet [S].
- Porcione: nuk ka skedar porcionesh në listën e skedarëve [V, API]. Vetëm për 100 g.
- Fushat: kcal, proteina, karbohidrate, yndyra, fibra janë ndër 74 përbërësit [S, nuk i listova këtu].
- Prova në emrat anglisht [V]: "Feta-type cheese" (disa), "Yogurt, Greek-style", "Milk kefir", "Tzatziki", "Baklava", "Moussaka", "Bread, pita", "Vine leaf stuffed ... dolmas". Asnjë për burek, ajvar, fasulye; "haricot" ka 36 hyrje frëngjisht. Mbulim i mirë për Mesdheun, i dobët për Ballkanin.

## 3. UK CoFID (McCance and Widdowson)

- Versioni i fundit: 19 mars 2021 (më parë 2015, 2019) [V, https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid].
- Licenca: "All content is available under the Open Government Licence v3.0, except where otherwise stated" [V, po aty]. Përmban "© Crown copyright". OGL v3.0 kërkon atribuim [S, e paverifikuar këtu].
- Formati: Excel, 4,42 MB, plus skedar "old foods" 634 KB, plus PDF udhëzues [V].
- Numri i ushqimeve: nuk thuhet në faqe [V]. Porcione: faqja nuk e thotë; nuk e verifikova. Emrat: anglisht britanik [S].
- Përditësimi: i parregullt, çdo 2 deri 4 vjet [V, datat].

## 4. Frida (DTU Food, Danimarkë)

- Frida 5.5, e publikuar 2026-01-19 [V, figshare API: https://api.figshare.com/v2/articles/29500682; DOI 10.11583/DTU.29500682].
- Licenca: "CC BY 4.0" (https://creativecommons.org/licenses/by/4.0/) [V, API-ja e figshare]. Kujdes: faqja e DTU Orbit shton: "All rights are reserved, including those for text and data mining, AI training, and similar technologies" dhe "For all open access content, the relevant licensing terms apply" [V, https://orbit.dtu.dk/en/datasets/f55019c6-9d39-444b-b427-2a0fb4d1fff9/]. Kjo kërkon vendim ose shqyrtim; fleta Readme e skedarit ka tekstin e të drejtave e citimit dhe nuk e lexova.
- Skedarët: XLSX 12,3 MB, ODS 12,6 MB, dokumentim anglisht dhe danisht PDF [V]. Fletët: Data_Table, Data_Normalised, Food, FoodGroup, Parameter, Source [V].
- Numri: faqja e DTU thotë "more than 1,000 foods" (mund të jetë i vjetruar) [V, https://www.food.dtu.dk/english/About-us/Facilities-and-infrastructure/Food-Data-database-on-nutrients-in-food]. Emra anglisht në të dhëna: nuk e verifikova (FAO e liston "English, Danish": https://www.fao.org/food-composition/tables-and-databases/detail/(denmark--2024)-danish-food-composition-table/en [V]). Porcione: jo e verifikuar.

## 5. Tabela të tjera kombëtare

- Suedi, Livsmedelsverket: "The data is published under the Creative Commons Attribution 4.0 license." Duhet kredituar Livsmedelsverket. Rreth 2 500 ushqime, JSON/API, emër anglisht (britanik), 50+ lëndë ushqyese [V, https://www.livsmedelsverket.se/en/about-us/open-data/food-composition-data/]. Kandidat i mirë [S].
- Zvicër (opendata.swiss): kushte "terms_by" (https://opendata.swiss/terms-of-use#terms_by); asnjë emër licence, burimi XLS tregon "Error", gjuhët bosh [V, https://ckan.opendata.swiss/dataset/naehrwerte_lebensmittel]. Duhet verifikuar para përdorimit.
- Kanada CNF 2015: Crown copyright; skedari "may be downloaded and used without further permission"; citim "Canadian Nutrient File, Health Canada, 2015"; vlerat nuk ndryshohen [V, https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/copyright-guidelines-canadian-nutrient-file.html]. Faqja është e arkivuar. CSV 2,9 MB zip [V, https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/canadian-nutrient-file-2015-download-files.html]. Jo licencë e hapur standarde; "pa ndryshuar vlerat" ka rrezik për bashkim [S].
- Australi AFCD Release 3: 1 588 ushqime, faqja 23 dhjetor 2025 [V, https://www.foodstandards.gov.au/science-data/food-nutrient-databases/afcd/about-afcd]. Marrëveshja e licencës: "You may distribute the Work only under the terms of this Licence Agreement", pa sublicencim, kërkohet "a statement that the Work is based on Australian data" [V, https://foodstandards.gov.au/science-data/monitoringnutrients/afcd/datauserlicenceagreement]. Jo licencë standarde; nuk përshtatet lehtë [S]. Jo përfshirë.
- Holandë NEVO 2025/9.0: jo e hapur. "The user is not allowed to charge (end)users", nuk lejohet "amendment", citim "Based on data from NEVO online version 2025/9.0, RIVM, Bilthoven." [V, https://www.rivm.nl/sites/default/files/2025-11/Conditions-of-use-NEVO-online-2025-dataset_0.pdf]. Jo.
- Norvegji (Matvaretabellen): faqja nuk jep licencë, as emra anglisht ushqimesh [V, https://www.mattilsynet.no/en/food-and-beverages/matvaretabellen/about-the-data-in-the-norwegian-food-composition-table]. E paverifikuar.
- Finlandë Fineli: faqja e THL e liston si të dhëna të hapura por nuk jep licencë as shkarkim [V, https://avoindata.suomi.fi/data/en/dataset/thl-n-avoin-data]; faqja fineli.fi ktheu 403 (Cloudflare). E paverifikuar.
- Italia CREA/BDA, Greqia, Turqia, Serbia, Kroacia: nuk i verifikova. Kërkimi për CREA/BDA dha vetëm faqe të papërdorura; për të tjerat nuk gjeta burim të hapur në kohën e dhënë. Mos supozo.

## 6. Shqipëria dhe Kosova

- Hoxha et al., Proceedings (MDPI) 2024: tabela e parë shqiptare, 75 ushqime, 2 219 regjistrime, 48 përbërës, pesë gatime tradicionale. Artikulli është CC BY, por e thotë se të dhënat janë "available on request from the corresponding author" [V, https://www.mdpi.com/2504-3900/91/1/269]. Licenca e artikullit nuk e bën bazën të hapur [S]. Nuk ka skedar të shkarkueshëm që gjeta.
- Nga kërkimi (titujt vetëm, nuk i lexova): konferenca UBT 2020 "Further effort for building Albanian food composition database, and its enrichment with Kosovo food composition data" dhe një PDF FAO për Shqipërinë (fao.org/docrep/pdf/008/a0205m/Albania.pdf). Licenca e panjohur.
- Për Kosovën nuk gjeta tabelë të hapur. [V për atë që gjeta; mungesa është kufizim i kërkimit tim.]

## 7. Open Food Facts (OFF)

- Licencat: "The Open Food Facts database is available under the Open Database License (ODbL)"; përmbajtjet nën "Database Contents License (DbCL)"; imazhet "Creative Commons Attribution ShareAlike" (CC-BY-SA) [V, https://world.openfoodfacts.org/data dhe https://world.openfoodfacts.org/terms-of-use]. Imazhet mund të kenë elemente me të drejta të treta [V].
- Atribuimi: të përmendet licenca dhe autorësia "Open Food Facts with a link to https://openfoodfacts.org" [V, terms-of-use]. Tekst shembull: "Contains data from Open Food Facts, available under the Open Database License." [V, /data].
- Share-alike: "Derivative works must be shared under the same conditions." [V, terms-of-use]. Faqja e mbështetjes: "The two conditions are attribution and share-alike"; kombinimi me baza të tjera: rezultati duhet të lëshohet si e hapur [V, https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api; ky është përmbledhje e WebFetch, jo citat].
- Teksti i ODbL 1.0 (https://opendatacommons.org/licenses/odbl/1-0/) [V]: "Collective Database" është baza "in unmodified form as part of a collection of independent databases" dhe nuk konsiderohet Derivative Database; 4.5(a): "You are not required to license Collective Databases under this License if You incorporate this Database"; 4.4: "Any Derivative Database that You Publicly Use must be only under the terms of" ODbL ose të ngjashme. Pra ndryshimi Collective/Derivative vendos nëse Lista e Vrullit duhet të jetë e hapur. Vendim i nevojshëm; unë nuk e vendos (faqja e mbështetjes është më e rreptë se teksti).
- Dump-et: CSV tab, UTF-8 gzip (~0,9 GB të ngjeshura, ~9 GB të pazipuara), JSONL gz, Parquet (Hugging Face), MongoDB gz, delta ditore; gjeneruar çdo natë [V, https://world.openfoodfacts.org/data]. Mbi disa qindra produkte duhet dump, jo API [V, https://openfoodfacts.github.io/openfoodfacts-server/api/].
- Limitet: "15 req/min/IP address for all read product queries"; "10 req/min/IP address for all search queries"; për facet nuk ka limit të dokumentuar; duhet User-Agent i personalizuar; mos përdor kërkimin për search-as-you-type [V, faqja API]. Caching: nuk trajtohet; dokumentacioni nxit instancë lokale e dump ditor [V].
- Numri për Shqipërinë dhe Kosovën (API v2 search, 2026-11-15, test) [V]: countries_tags_en=albania: 1 211 produkte; kosovo (kod xk / en:kosovo): 345 produkte. Është numër produktesh me barkod, jo ushqimesh gjenerike.
- Përshtatja [S]: OFF jep produkte të paketuara me vlera për 100 g, jo ushqime bazë ose porcione të sakta. Cilësia varion. Vlen për barkod dhe produkte shqiptare.

## 8. Përmbledhje

| Burimi | Licenca | Ushqime | Emra anglisht? | Porcione? | Përfshi? |
|---|---|---|---|---|---|
| USDA Foundation + SR Legacy + FNDDS | CC0 1.0 | të pa numëruara | po (vetëm anglisht) | e paverifikuar | po |
| USDA Branded | CC0 1.0 | shumë (3 GB) | po | e paverifikuar | jo [S] |
| Ciqual 2025 | etalab 2.0 | 3 484 | po (`alim_nom_eng`) | jo | po |
| UK CoFID 2021 | OGL v3.0 | nuk thuhet | po | e paverifikuar | po (prioritet i ulët) |
| Frida 5.5 | CC BY 4.0 (por njoftim "all rights reserved ... AI training") | >1 000 (faqja) | e paverifikuar | e paverifikuar | duhet vendim |
| Livsmedelsverket | CC BY 4.0 | ~2 500 | po | e paverifikuar | po (pas provës) |
| Zvicër | e paqartë | e panjohur | e paverifikuar | e paverifikuar | jo (deri sa verifikohet) |
| Kanada CNF 2015 | Crown copyright | e panjohur | po [S] | e paverifikuar | jo |
| AFCD R3 | licencë e veçantë | 1 588 | po [S] | e paverifikuar | jo |
| NEVO | jo e hapur | e panjohur | jo | e paverifikuar | jo |
| Norvegji, Fineli, CREA, të tjerat | e paverifikuar | - | - | - | jo (nuk verifikohet) |
| Shqipëri (Hoxha 2024) | të dhënat me kërkesë | 75 | po (dygjuhësh) | jo | duhet vendim (kontakt me autorët) |
| Open Food Facts | ODbL + DbCL; imazhe CC BY-SA | 1 211 AL, 345 XK | po | jo | duhet vendim |

## 9. Rendi i sugjeruar [S]

1. USDA Foundation Foods, pastaj SR Legacy, pastaj FNDDS (CC0, pa kushte). Foundation është kryesori; SR Legacy e plotëson; FNDDS jep ushqime të përgatitura dhe, nëse kontrollohet, porcione.
2. Ciqual 2025 për Evropën (feta, kefir, tzatziki, baklava, moussaka), me emra anglisht.
3. CoFID dhe Livsmedelsverket për boshllëqet; Frida vetëm pas vendimit.
4. Ushqime shqiptare: asnjë burim i hapur nuk mbulon burek, flija, tavë kosi, ajvar. Duhet futur me dorë nga pronari, me burimin "Vrull" [S].
5. OFF vetëm për produkte me barkod, në tabelë të ndarë.
- Dublikatët: një hyrje për ushqim, me burim të preferuar sipas rendit më sipër dhe lidhje (`also_in`) me hyrjet e tjera; asnjë shkrirje e vlerave nga burime të ndryshme [S].
- Çdo rresht ruan: burimin, ID-në origjinale, licencën, versionin dhe datën e importit [S]. Faqe "Burimet" në app me atribuimet e kërkuara (USDA, ANSES, Crown copyright/OGL, etj.) [S].

## 10. Pyetje vetëm për pronarin

1. Open Food Facts: duam ODbL në bazën tonë? Nëse po, a e publikojmë Listën e Vrullit si të hapur, apo e mbajmë OFF si bazë të veçantë të pandryshuar (Collective Database)? Aplikacioni u shpërndahet shokëve: a llogaritet si "Public Use" [S, e pavendosur]?
2. Frida: e pranojmë, apo i shkruajmë DTU për sqarim mbi njoftimin "all rights reserved ... AI training"?
3. Shqipëria: i shkruajmë autorëve të Hoxha et al. për të dhënat dhe lejen?
4. Ushqimet shqiptare që mungojnë: kush i jep vlerat (receta bazë me përbërësit nga burimet e mësipërme, Admini sipas V31, apo një ushqyes)?
5. Branded Foods të USDA: jo, apo pjesë (p.sh. vetëm marka globale)?
6. Atribuimet: pranohet faqe "Burimet" në Cilësime?

## 11. Kontrolli i orkestruesit (2026-11-15)

- Limitet e Open Food Facts: faqja e API-së sot thotë "15 req/min/IP address for all read product queries" dhe "10 req/min/IP address for all search queries", dhe për kërkimin: "don't use it for a search-as-you-type feature, you would be blocked very quickly" [V, https://openfoodfacts.github.io/openfoodfacts-server/api/]. Një përmbledhje e kërkimit në internet e së njëjtës faqe tregonte më herët "100 req/min" për leximin e produkteve; vlen teksti i sotëm i faqes. Kjo e mbështet vendimin e §0.3h: Open Food Facts vetëm me prekje ose barkod.
- Livsmedelsverket: "The data is published under the Creative Commons Attribution 4.0 license.", "The Swedish Food Agency must be stated as the source.", rreth 2 500 ushqime, emri anglisht te `/api/v1/livsmedel` [V, faqja e §5].
- Pyetja 4 u rishkrua: versioni i agjentit përmendte një person që nuk ka lidhje me app-in.

## 12. Vendimet e pronarit (2026-11-15)

- A. Open Food Facts: tabelë më vete, e pandryshuar, me atribuim; të dhënat u jepen kujt i kërkon me ODbL.
- B. Frida 5.5: po, me CC BY 4.0.
- C. Tabela e Hoxha dhe kolegëve (2024): jo.
- D. Pjatat shqiptare: recetë bazë nga përbërësit e Listës së Vrullit, me burimin "Vrull, recetë", të kontrolluara nga Admini.

Prodhuar nga Claude (AI); rishikohet nga Andi
