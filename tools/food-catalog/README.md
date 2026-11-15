# Ndërtimi i Listës së Vrullit (`tools/food-catalog/`)

Kthen tabelat e hapura të ushqimeve në rreshta të njëtrajtshëm (për 100 g pjesë të ngrënshme) për `food_catalog`. Plani: `docs/agents/PLANI-LISTA-E-VRULLIT.md`; rregullat: SPEC §0.3h; burimet: `docs/research/food-sources.md`. Vala 1: vetëm USDA FoodData Central (Foundation Foods, SR Legacy, FNDDS). Branded jo.

Shkarkimet nuk hyjnë në repo; `sources.json` mban URL-në, versionin dhe sha256 të çdo skedari.

## Ekzekutimi

```
NODE_USE_ENV_PROXY=1 node tools/food-catalog/download.mjs /tmp/food-src
node tools/food-catalog/build.mjs /tmp/food-src /tmp/food-out [--list-version N]
node tools/food-catalog/check.mjs /tmp/food-out/catalog.jsonl
npx vitest run tools/food-catalog
```

- `download.mjs`: shkarkon nga faqja zyrtare e USDA-së, kontrollon sha256 (herën e parë e shkruan te `sources.json`), nuk shkarkon dy herë, shpaketon te `<dosja>/<id>/`. `NODE_USE_ENV_PROXY=1` vetëm pas proxy-t.
- `usda.mjs`: leximi i tre datasets dhe rregulli i energjisë (te komenti i skedarit).
- `check.mjs`: roja (ID unike, burim, licencë, version; kcal brenda 15 % të 4P+4K+9Y ose `kcal_flag`; asnjë vlerë negative ose mbi 100 g; porcionet me gram > 0).
- `build.mjs`: `catalog.jsonl` dhe `summary.json` (numri për burim, të hequrit, rregulluarit, shënimet e rojës, madhësia dhe madhësia e ngjeshur me gzip). Del me kod 1 kur roja ka gabime. Asgjë nuk shkruhet te `src/`.

## Rregullat që duhen ditur

- Energjia: Foundation 2048, pastaj 2047, pastaj 1008; SR Legacy 1008; FNDDS 208 (te FNDDS kolona `nutrient_id` mban numrin e lëndës, jo ID-në).
- Karbohidratet janë "by difference"; një rresht pa to hiqet (nuk zëvendësohet me "by summation"). Deri në -1 g rrumbullakohen në 0 (e numëruar te `adjusted`).
- Vlerat nuk përzihen mes burimeve: një rresht vjen nga një dataset.
- `kcal_flag`: rreshti hyn, por kcal del jashtë 15 % të 4P+4K+9Y (alkool, fibra e lartë, Atwater specifik).
- Kufiri i kcal te roja është 950 (yndyrat e pastra dalin 902); migrimi i `food_catalog` duhet të lejojë të njëjtin kufi.

## Licenca dhe atribuimi

USDA FoodData Central është e hapur me CC0 1.0 Universal (https://fdc.nal.usda.gov/api-guide): nuk kërkohet leje ose atribuim. Citimi i rekomanduar, që e përdor faqja "Burimet" e app-it:

> U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019. fdc.nal.usda.gov.

Prodhuar nga Claude (AI); rishikohet nga Andi
