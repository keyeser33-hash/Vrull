# Plani: Lista e Vrullit (V2-E3-27)

Rregullat: SPEC §0.3h (V59). Burimet dhe licencat: `docs/research/food-sources.md` (me vendimet e pronarit, §12). Kodi nis pas miratimit të bordeve të 0.42 dhe pas migrimit në Supabase.

## Çfarë ndërtohet

1. **Ndërtimi i listës** (`tools/food-catalog/`, si `tools/exercise-library/`): një skript për çdo burim e kthen skedarin e shkarkuar në rreshta të njëjtë: burimi, ID-ja origjinale, emri anglisht (dhe emri i burimit), grupi, kcal, proteina, karbohidratet, yndyrat, fibrat për 100 g pjesë të ngrënshme, porcionet kur burimi i ka, licenca, versioni. Shkarkimet nuk hyjnë në repo; skripti mban URL-në dhe sha256 e çdo skedari.
2. **Bashkimi:** i njëjti ushqim në disa burime mbahet një herë sipas radhës USDA (Foundation, SR Legacy, FNDDS), Ciqual, CoFID, Livsmedelsverket, Frida; të tjerët ruhen te `also_in`. Vlerat nuk përzihen mes burimeve.
3. **Emrat shqip:** përkthim nga anglishtja, i shënuar "i pakontrolluar"; rreth 1 000 ushqimet më të zakonshme kontrollohen të parat (nga Admini ose në rishikim).
4. **Pjatat shqiptare:** recetë bazë me gramët e përbërësve nga lista; makrot llogariten; burimi "Vrull, recetë"; Admini i kontrollon (V31). Burimi i recetës shënohet për çdo pjatë.
5. **Supabase:** tabelat `food_catalog` (lexim për përdoruesit e kyçur, pa shkrim nga app-i) dhe `food_products` (produktet e Open Food Facts dhe të etiketave, pa emrin e kujt e shtoi te leximi). Migrimi i jepet pronarit si SQL; `TABLES`, `INDEXES` dhe versioni i ri te `db.ts`.
6. **Telefoni:** versioni i listës vjen me app-in (punon pa internet që në nisje) dhe përditësohet me **Versionin e listës**; kërkimi bëhet në telefon, pa rrjet.
7. **Faqja "Burimet"** te Cilësimet, me atribuimet që kërkon secila licencë (USDA, ANSES, Crown copyright/OGL, Livsmedelsverket, DTU, Open Food Facts).

## Rojet dhe provat

- Për çdo burim: provë me një skedar të vogël shembull (rreshtat e pritur, njësitë, energjia).
- Roja e listës: ID unike; çdo rresht ka burim, licencë dhe version; kcal brenda 15% të 4·P + 4·K + 9·Y ose i shënuar; asnjë vlerë negative; porcionet me gram.
- Madhësia: masim listën e ngjeshur dhe kohën e kërkimit në telefon para se ta vendosim në app.

## Valët

| Vala | Puna | Kush |
|---|---|---|
| 1 | Skeleti i ndërtimit, USDA (3 burimet), roja dhe provat | `vrull-builder` |
| 2 | Ciqual, CoFID, Livsmedelsverket, Frida (paralel, një për burim) | `vrull-builder` × 4 |
| 3 | Bashkimi, radha e të zakonshmeve, emrat shqip | orkestruesi + agjentë përkthimi |
| 4 | Recetat e pjatave shqiptare me burimet e tyre | agjentë kërkimi + rishikues |
| 5 | Migrimi, kopja në telefon, kërkimi, faqja "Burimet" | `vrull-builder` |

## Gjendja

- **Vala 1 (15.11.2026, b484f74):** `tools/food-catalog/` me shkarkimin (URL, versioni, sha256 te `sources.json`), leximin e USDA-së, rojën dhe 31 prova. Ndërtimi i vërtetë [V]: Foundation 2026-04-30 377 rreshta (91 pa kcal, 1 pa makro), SR Legacy 2018-04 7 793, FNDDS 2024-10-31 5 431; gjithsej 13 601; roja 0 gabime dhe 834 shënime `kcal_flag`; `catalog.jsonl` 5,2 MB, 0,5 MB me gzip. Energjia: Foundation 2048 → 2047 → 1008, SR Legacy 1008, FNDDS lënda 208 (dokumentimi i FDC-së, "Energy"). Foundation 2026-10-29 te faqja zyrtare vjen pa `food.csv`, `food_nutrient.csv` dhe `food_portion.csv`, ndaj përdoret 2026-04-30 deri sa USDA ta ndreqë. Karbohidratet deri në −1 g bëhen 0 dhe numërohen; më poshtë rreshti hiqet. Migrimi lejon deri në 950 kcal (USDA ka yndyra me 902).

- **Vala 2 (15.11.2026, 9a7411f, de3a8be, 5beea77):** Ciqual 2025 (2025-11-03) 3 323 rreshta, CoFID 2021 2 820, Livsmedelsverket (2026-06-29) 2 605. Ndërtimi i plotë [V, `summary.json`]: 22 349 rreshta, roja 0 gabime dhe 1 447 `kcal_flag`, 7,9 MB, 0,8 MB me gzip. Frida 5.5 nuk u bë: shkarkimi zyrtar ridrejtohet te `s3q.ait.dtu.dk:9000`, që rrjeti i kësaj sesioni nuk e arrin; skedari (XLSX, 12,3 MB, DOI 10.11583/DTU.29500682) mund ta japë pronari. Për valën 3: karbohidratet e USDA ("by difference") përfshijnë fibrat, ato të Ciqual, CoFID dhe Livsmedelsverket jo; fibra e CoFID mungon te rreth gjysma e rreshtave; alkooli i CoFID (për 100 ml) u la jashtë.

## Pyetjet që mbeten për ndërtimin

- Përkthimi i emrave: me agjentët e kësaj sesioni (pa çelës API) apo me një funksion të Supabase brenda kufirit të AI-së.
- Sa ushqime hyjnë në app: e gjithë lista apo vetëm një pjesë, pasi të masim madhësinë.

Prodhuar nga Claude (AI); rishikohet nga Andi
