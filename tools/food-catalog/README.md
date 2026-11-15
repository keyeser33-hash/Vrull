# Ndërtimi i Listës së Vrullit (`tools/food-catalog/`)

Kthen tabelat e hapura të ushqimeve në rreshta të njëtrajtshëm (për 100 g pjesë të ngrënshme) për `food_catalog`. Plani: `docs/agents/PLANI-LISTA-E-VRULLIT.md`; rregullat: SPEC §0.3h; burimet: `docs/research/food-sources.md`. Burimet: USDA FoodData Central (Foundation Foods, SR Legacy, FNDDS; branded jo) dhe, nga vala 2, Ciqual 2025.

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
- `ciqual.mjs`: leximi i Ciqual (XML) dhe rregullat e energjisë dhe të vlerave të veçanta (te komenti i skedarit). `common.mjs`: ndihmësit e përbashkët të burimeve të reja.
- `check.mjs`: roja (ID unike, burim, licencë, version; kcal brenda 15 % të 4P+4K+9Y ose `kcal_flag`; asnjë vlerë negative ose mbi 100 g; porcionet me gram > 0).
- `build.mjs`: `catalog.jsonl` dhe `summary.json` (numri për burim, të hequrit, rregulluarit, shënimet e rojës, madhësia dhe madhësia e ngjeshur me gzip). Del me kod 1 kur roja ka gabime. Asgjë nuk shkruhet te `src/`.

## Rregullat që duhen ditur

- Energjia: Foundation 2048, pastaj 2047, pastaj 1008; SR Legacy 1008; FNDDS 208 (te FNDDS kolona `nutrient_id` mban numrin e lëndës, jo ID-në).
- Karbohidratet janë "by difference"; një rresht pa to hiqet (nuk zëvendësohet me "by summation"). Deri në -1 g rrumbullakohen në 0 (e numëruar te `adjusted`).
- Vlerat nuk përzihen mes burimeve: një rresht vjen nga një dataset.
- Ciqual: kcal nga konstanta 328 (Rregullorja EU 1169/2011), proteina 25003 (kur mungon, 25000), karbohidratet 31000 (pa fibrat, ndryshe nga USDA), yndyra 40000, fibrat 34100. "traces" dhe "< x" bëhen 0, "-" është i munguar (fibrat null; një makro ose energji që mungon e heq rreshtin). `name_en` = `alim_nom_eng`, `name_source` = `alim_nom_fr` kur ndryshon.
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

Prodhuar nga Claude (AI); rishikohet nga Andi
