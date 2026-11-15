# Ndërtimi i Listës së Vrullit (`tools/food-catalog/`)

Kthen tabelat e hapura të ushqimeve në rreshta të njëtrajtshëm (për 100 g pjesë të ngrënshme) për `food_catalog`. Plani: `docs/agents/PLANI-LISTA-E-VRULLIT.md`; rregullat: SPEC §0.3h; burimet: `docs/research/food-sources.md`. Burimet: USDA FoodData Central (Foundation Foods, SR Legacy, FNDDS; branded jo) dhe, nga vala 2, Ciqual 2025, CoFID 2021 dhe Livsmedelsverket.

Shkarkimet nuk hyjnë në repo; `sources.json` mban URL-në, versionin dhe sha256 të çdo skedari.

## Ekzekutimi

```
NODE_USE_ENV_PROXY=1 node tools/food-catalog/download.mjs /tmp/food-src [id ...]
node tools/food-catalog/build.mjs /tmp/food-src /tmp/food-out [--list-version N]
node tools/food-catalog/check.mjs /tmp/food-out/catalog.jsonl
npx vitest run tools/food-catalog
```

- `download.mjs`: shkarkon nga faqet zyrtare të burimeve (URL te `sources.json`), kontrollon sha256 (herën e parë e shkruan aty), nuk shkarkon dy herë, shpaketon zip-et te `<dosja>/<id>/`; me id në fund shkarkon vetëm ato burime. `NODE_USE_ENV_PROXY=1` vetëm pas proxy-t.
- `usda.mjs`: leximi i tre datasets dhe rregulli i energjisë (te komenti i skedarit).
- `ciqual.mjs`, `cofid.mjs`: leximi i Ciqual (XML) dhe i CoFID (Excel) me rregullat e energjisë dhe të vlerave të veçanta (te komenti i skedarit). `livsmedelsverket.mjs`: shkarkimi nga API zyrtare (paketa JSON, rreth 5 200 kërkesa, 4 njëkohësisht) dhe leximi i saj. `xlsx.mjs`: lexuesi minimal i XLSX me `unzip -p`, pa varësi të reja. `common.mjs`: ndihmësit e përbashkët të burimeve të reja.
- `check.mjs`: roja (ID unike, burim, licencë, version; kcal brenda 15 % të 4P+4K+9Y ose `kcal_flag`; asnjë vlerë negative ose mbi 100 g; porcionet me gram > 0).
- `build.mjs`: `catalog.jsonl` dhe `summary.json` (numri për burim, të hequrit, rregulluarit, shënimet e rojës, madhësia dhe madhësia e ngjeshur me gzip). Del me kod 1 kur roja ka gabime. Asgjë nuk shkruhet te `src/`.

## Rregullat që duhen ditur

- Energjia: Foundation 2048, pastaj 2047, pastaj 1008; SR Legacy 1008; FNDDS 208 (te FNDDS kolona `nutrient_id` mban numrin e lëndës, jo ID-në).
- Karbohidratet janë "by difference"; një rresht pa to hiqet (nuk zëvendësohet me "by summation"). Deri në -1 g rrumbullakohen në 0 (e numëruar te `adjusted`).
- Vlerat nuk përzihen mes burimeve: një rresht vjen nga një dataset.
- Ciqual: kcal nga konstanta 328 (Rregullorja EU 1169/2011), proteina 25003 (kur mungon, 25000), karbohidratet 31000 (pa fibrat, ndryshe nga USDA), yndyra 40000, fibrat 34100. "traces" dhe "< x" bëhen 0, "-" është i munguar (fibrat null; një makro ose energji që mungon e heq rreshtin). `name_en` = `alim_nom_eng`, `name_source` = `alim_nom_fr` kur ndryshon.
- CoFID: kcal = KCALS (protein 4, yndyrë 9, karbohidrat të disponueshëm 3,75, alkool 7), karbohidratet CHO (monosaharid, pa fibrat; 100–106 g bëhen 100, e numëruar), fibra vetëm AOAC (pa të, null; NSP nuk e zëvendëson). "Tr" = 0, "N" = i munguar. Pijet alkoolike (grupi Q, për 100 ml) dhe dy ushqimet me kodin e dyfishtë 13-669 hiqen.
- Livsmedelsverket: kcal = ENERC me njësi kcal, PROT, CHO (të disponueshëm), FAT, FIBT, vetëm vlerat "per 100 g edible portion" (matrisenhetkod W); `varde` siç është (BL dhe LZ janë 0); makro e munguar heq rreshtin; yndyra 100–105 g (vajra) bëhet 100. `name_en` nga `sprak=2`, `name_source` suedisht kur ndryshon; grupi nga faseta LanguaL "A. PRODUCT TYPE". Pa porcione.
- `kcal_flag`: rreshti hyn, por kcal del jashtë 15 % të 4P+4K+9Y (alkool, fibra e lartë, Atwater specifik).
- Kufiri i kcal te roja është 950 (yndyrat e pastra dalin 902); migrimi i `food_catalog` duhet të lejojë të njëjtin kufi.

## Licenca dhe atribuimi

### USDA FoodData Central (CC0-1.0)

USDA FoodData Central është e hapur me CC0 1.0 Universal (https://fdc.nal.usda.gov/api-guide): nuk kërkohet leje ose atribuim. Citimi i rekomanduar, që e përdor faqja "Burimet" e app-it:

> U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov.

### Ciqual 2025, ANSES (etalab-2.0)

Dataset: Table de composition nutritionnelle des aliments Ciqual 2025, versioni 1 (publikuar 2025-11-19, skedarët e 2025-11-03), DOI 10.57745/RDMHWY, https://entrepot.recherche.data.gouv.fr/dataset.xhtml?persistentId=doi:10.57745/RDMHWY. Licenca e datasetit: "etalab 2.0" (Licence Ouverte 2.0, https://spdx.org/licenses/etalab-2.0.html). Kushti, nga teksti i licencës:

> Sous réserve de : mentionner la paternité de l'« Information » : sa source (au moins le nom du « Concédant ») et la date de dernière mise à jour de l'« Information » réutilisée. [...] Cette mention de paternité ne confère aucun caractère officiel à la « Réutilisation » de l'« Information », et ne doit pas suggérer une quelconque reconnaissance ou caution par le « Concédant »...

Citimi i datasetit (Dataverse): "Du Chaffaut, Laure; Oseredczuk, Marine; Gauvreau-Béziat, Julie, 2025, \"Table de composition nutritionnelle des aliments Ciqual 2025\", https://doi.org/10.57745/RDMHWY, Recherche Data Gouv, V1". Faqja "Burimet" shkruan: Anses, Table Ciqual 2025, përditësuar 2025-11-03 (skedarët) / 2025-11-19 (publikimi), pa sugjeruar miratim nga Anses.

### UK CoFID 2021 (OGL-3.0)

Dataset: McCance and Widdowson's The Composition of Foods Integrated Dataset 2021, Public Health England, përditësuar 19.03.2021, https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid. Faqja zyrtare: "All content is available under the Open Government Licence v3.0, except where otherwise stated", "© Crown copyright". Faqja nuk jep një fjali atribuimi të veçantë, ndaj vlen ajo e licencës (https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/):

> acknowledge the source of the Information in your product or application by including or linking to any attribution statement specified by the Information Provider(s) and, where possible, provide a link to this licence; If the Information Provider does not provide a specific attribution statement, you must use the following: Contains public sector information licensed under the Open Government Licence v3.0.

Faqja "Burimet" shkruan: "Contains public sector information licensed under the Open Government Licence v3.0. McCance and Widdowson's The Composition of Foods Integrated Dataset 2021, Public Health England, © Crown copyright 2021", me lidhjen te licenca.

### Livsmedelsverket, Livsmedelsdatabasen (CC-BY-4.0)

Dataset: The Swedish Food Composition Database, API https://dataportal.livsmedelsverket.se/livsmedel/api/v1 (versionet e ushqimeve: 2026-06-29), faqja https://www.livsmedelsverket.se/en/about-us/open-data/food-composition-data/. Teksti i faqes zyrtare:

> The data is published under the Creative Commons Attribution 4.0 license. This means that you have permission to use and distribute our open data and create processing. The Swedish Food Agency must be stated as the source.

Faqja "Burimet" shkruan: "The Swedish Food Agency (Livsmedelsverket), Livsmedelsdatabasen (Swedish Food Composition Database)", me lidhjen te licenca CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/) dhe shënimin se vlerat janë përpunuar (rrumbullakime, makro te kufizuara te 100 g).

Prodhuar nga Claude (AI); rishikohet nga Andi
