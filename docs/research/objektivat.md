# Targets calculator for Vrull: how apps and current science set calories and macros

Research note, 8 November 2026. Facts come with sources (URLs at the end, numbered [n]). Anything marked **Design proposal** or **My analysis** is my own suggestion, not a published finding.

Today Vrull scales Jim's sample day by bodyweight (`src/nutrition/targets.ts`, SPEC Shtojca C): training day 3700 kcal / 335 P / 340 C / 110 F at 81.65 kg, and rest day 3100 / 265 / 260 / 110. At 88 kg that gives a training day of **3988 kcal, 361 g protein (4.1 g/kg), 366 g C, 119 g F** and a rest day of **3341 kcal, 286 g P, 280 g C, 119 g F**.

---

## 1. Inputs the leading apps ask for

| App | Required | Optional / how unknown body fat is handled | Activity model | Goal & rate |
|---|---|---|---|---|
| **MacroFactor** | No primary source lists the exact onboarding fields. The docs imply sex, age, height, weight, activity, goal and rate. | You choose a body-composition category or enter BF%. Protein scales with lean mass, which comes from weight plus that category [5]. You can enter a manual starting expenditure or ~30 days of earlier data [4]. | The first estimate is the Cunningham BMR times custom activity multipliers that keep daily life and exercise separate [2][4]. Newer MacroFactor BMR equations "extend" Cunningham and Oxford/Henry and add athlete status and deficit state; the coefficients are not published [9]. | Rate is a % of bodyweight per week [5]. The bulking table is in §3 [7]. |
| **RP Diet Coach** | Diet type (fat loss, muscle gain, maintenance), body type, activity level (4 levels), and for each day: number of workouts, intensity (light/moderate/hard), meals (4–6), workout shake [12] | Body fat is **chosen from photos**. Men: 1 = <15%, 2 = 15–22%, 3 = 22–30%, 4 = >30%. It is used "to help gauge lean mass and protein needs". RP advises against using home-scale readings [12][14]. | Workouts and intensity are set per day, so macros differ by day. The docs give no formula. | Diet length 6–9 weeks for a first diet, ≤16 weeks maximum. Loss ≤1% BW per week [12][13]. |
| **Carbon Diet Coach** | Goal (lose, gain, maintain, reverse), sex, birthday, weight, goal weight, lifestyle and exercise, weekly rate, diet preference [17] | BF% is a yes/no question. On "no", you pick from **estimation images**. You can also enter known maintenance calories, which skips the estimate [17]. | A "modified Müller equation". Protein comes from lean body mass, and carbs and fat split the rest by diet preference [15]. | The coach suggests a recommended range (numbers not public) [17]. |
| **Cronometer** | Age, sex, height, weight | Custom fixed BMR is possible [19][20]. | **Mifflin-St Jeor** by default. Activity is *added* as a fraction of BMR: sedentary +0.2, light +0.375, moderate +0.5, very +0.9. Logged or tracker exercise is added separately and reduces the baseline to avoid double counting. TEF is an optional toggle, off by default [19][20]. | Weekly rate in 0.2 lb steps [22]. Default macro ratio P:C:F is 25:45:30, or fixed grams [21]. |
| **MyFitnessPal** | Age, sex, height, weight, "normal daily activity level", weekly goal [23] | No body fat input. Goal weight does not change the calculation [23]. | The formula is not named in its support article. Strength exercise is not counted, and only logged cardio is added ("net calories") [23]. | Weekly loss or gain goal. "We do not recommend women consume fewer than 1200 calories per day, or men fewer than 1500" [23]. |
| **Yazio** | Sex, age, height, weight, activity level, goal [24] | — | **Mifflin-St Jeor** × PAL. The activity level covers the **work routine only**: Low 1.25, Moderate 1.38, High 1.52, Very high 1.65. New users default to 1.36 (men). Tracked workouts are added on top [24][25]. | Default 0.5 kg/week = 375 kcal/day; maximum 1 kg/week = 750 kcal/day [24]. That implies ~5250 kcal per kg. |
| **Lose It!** | Its help-centre page could not be fetched (permission timeout), so it is **not verified** here. | | | |

**Patterns**
- Every app requires sex, age, height and weight.
- Body fat is **never strictly required**. The coaching apps (MacroFactor, RP, Carbon) replace a number with a category or a photo picker and use it mainly for lean mass and protein.
- The better apps (Yazio, Cronometer, MacroFactor) **separate daily-life activity from workouts**.
- The coaching apps express rate as % BW per week and re-fit targets every week.

## 2. Energy formulas and TDEE

### BMR / RMR equations (male / female)
- **Mifflin-St Jeor (1990)** [27]: men `10·kg + 6.25·cm − 5·age + 5`; women `… − 161`. It was derived from 498 adults aged 19–78. In the ADA systematic review it was the most reliable of the common equations: "predicting RMR within 10% of measured in more nonobese and obese individuals than any other equation" with "the narrowest error range". Older and ethnic-minority adults were underrepresented [28].
- **Oxford/Henry (2005)** [29], kcal/day, W in kg, H in m:
  - Men 18–30: `14.4W + 313H + 113`. Men 30–60: `11.4W + 541H − 137`.
  - Women 18–30: `10.4W + 615H − 282`. Women 30–60: `8.18W + 502H − 11.6`.
  - Built from 10,552 BMR values with the Italian data removed. It gives lower BMR than Schofield/FAO.
  - MacroFactor ranks Oxford/Henry first when BF% is unknown and Mifflin "probably the second-best" [8].
- **Cunningham** [30][31]: 1980 `500 + 22·LBM`; 1991 `370 + 21.6·FFM`. **Katch-McArdle is the same as the 1991 equation** [8].
  - MacroFactor calls it the best choice when BF% is known to within about 5%, and suggests averaging Cunningham with Oxford when you are only semi-confident in BF%. Cunningham probably overestimates over age 60 [8].
  - In recreational athletes (18–35 y), Cunningham predicted RMR accurately, while Mifflin, Harris-Benedict, WHO, Schofield and Owen were under 50% accurate (within ±10%) [32]. Weight-based equations underestimate trained, muscular people.
- **Size of the error.** For a good equation, roughly a two-thirds chance the true BMR is within ±150–200 kcal and 95% within ±300–400 kcal [8]. MacroFactor warns that its starting estimate can be off by "400-500kcals (or more)" for an individual [4].

### Estimating body fat when it is unknown
- **Deurenberg (1991)** from BMI [33]: adult `BF% = 1.2·BMI + 0.23·age − 10.8·sex(M=1) − 5.4`, SEE 4.1%. It overestimates in obese people.
- **US Navy tape** (see §5) is an alternative.

### Activity / TDEE
- **FAO/WHO/UNU (2004) PAL bands** [34]: sedentary or light 1.40–1.69 (e.g. urban office workers), active 1.70–1.99, vigorous 2.00–2.40. One hour a day of moderate exercise raises PAL from about 1.55 to 1.75.
- **Classic multipliers** (1.2 / 1.375 / 1.55 / 1.725 / 1.9, labelled by exercise days per week) mix job activity and exercise into one number. Yazio and Cronometer split them instead, as in §1.
- **Session cost of resistance training** (2024 Compendium of Physical Activities [35]): 3.5 MET for "multiple exercises, 8–15 reps"; 5.0 for squats/deadlifts; 6.0 for "power lifting or body building, vigorous effort". Net cost ≈ (MET − 1) × kg × hours. *My analysis:* at 88 kg and 60–75 min with MET 3.5–5, that is roughly 220–440 kcal, so ~300 kcal is a reasonable middle value (≈3.4 kcal/kg per session).

### Adaptive TDEE (MacroFactor model)
- **Principle.** Expenditure = intake − (trend weight change × energy density). If predicted weight change differs from observed change, the estimate moves [1][3].
- **Energy density** [1]:
  - Fat ≈ 39.5 MJ/kg (about 9,400 kcal/kg); lean ≈ 7.6 MJ/kg (about 1,800 kcal/kg).
  - The "3500 kcal/lb" rule (≈7,700 kcal/kg) implicitly assumes 78% fat and 22% lean.
  - V3 switched to "mirrored" assumptions for gain and loss. For bulking, MacroFactor assumes gains are about 50% fat and 50% lean, so 0.5 lb/week needs only ~150–180 kcal/day of surplus [6][5].
  - Hall (2008): the 3500 rule overestimates the energy per kg for leaner people [36].
- **Timing**:
  - The estimate starts updating on about day 3 [3] and "about 2-3 weeks to dial in" [4]. It stabilises after 3–4 weeks [3] (14–30 days per [2]).
  - Targets change at a **weekly check-in**, and each week is "its own self-contained unit": no payback for overeating [2][5].
- **Minimum data**:
  - Goal adjustments need nutrition logged on ≥4 of 7 days (7 ideal) and weight at least once per 7 days (≥3 ideal) [5].
  - The older help text required 6 of 7 nutrition days for continuous updates [4]. V3 pauses only when more than 3 of 7 days are missing, and it estimates intake on unlogged days (error ~13% on average) [1].
  - Partial logging is the main cause of error [3].
- **Smoothing.** Recommendations move less than expenditure does: a 500 kcal drop in expenditure might change targets by only 200–300 kcal. Confidence rises after 3–4 weeks of consistent data [5].
- **Trend weight** is a recency-weighted moving average, with missing days filled by linear interpolation. MacroFactor advises weighing daily or at least 3 times a week [11]. The classic Hacker's Diet uses an exponential moving average with smoothing constant 0.9, so today's reading counts for about 10% of the trend [37].
- **Accuracy** (MacroFactor's own analysis of 748 users, predictive validity rather than doubly-labelled water) [3]:
  - After 3–4 weeks, monthly error was 60–240 kcal/day (median 135).
  - Formula TDEE over the same period: median ~300 kcal/day (~12% of TDEE), and errors grew over time from metabolic adaptation.
  - The algorithm beat the formula for about 94% of users.
- **Carbon** works the same way at a high level [15][16][18]:
  - The weekly check-in compares logged intake with targets and progress with the goal rate.
  - Targets are held when logging is partial, adjustments are small ("No big cuts"), and there is a calorie floor.
  - A weekly Calorie Planner lets users move calories between days.

## 3. Goal settings

### Lean bulk
- **MacroFactor bulking table**, % BW per week (Conservative / Happy medium / Aggressive / Very aggressive) [7]. When in doubt it suggests Conservative to Happy medium, held for a long time.
  - Beginner (strength up ≥2% per week; rarely true after 3–6 months): 0.2 / 0.5 / 0.8 / 1.0.
  - Intermediate: 0.15 / 0.325 / 0.575 / 0.8.
  - Experienced: 0.1 / 0.15 / 0.35 / 0.6.
- **Iraki et al. 2019** (off-season review) [38]: surplus ~10–20% and gain ~**0.25–0.5% BW per week** for novice and intermediate lifters, more conservative for advanced lifters.
- **Helms et al. 2023** (RCT, trained lifters, 8 weeks) [39]: maintenance vs +5% vs +15% energy. Faster weight gain mainly raised skinfolds (R² 0.49), with weak evidence for extra biceps growth. The published abstract gives HIGH a bench 1-RM advantage; the preprint said MOD, so read the details carefully.
- **Garthe 2013** (elite athletes) [40]: a planned surplus (~3585 vs 2964 kcal) raised weight more (3.9% vs 1.5%) and fat mass much more (+15% vs +3%), but **lean mass gains did not differ**.
- **Hatamoto 2024** [41]: +40% vs +10% energy for 6 weeks gave more body protein (+0.44 kg vs 0), and the extra protein tracked fat gain (r = 0.82).
- **Slater 2019** [42]: the optimal surplus is unknown and textbook "tissue energy" maths ignores the cost of synthesis and adaptive thermogenesis.
- **ISSN diets position stand** [43]: gaining lean mass is "driven by a sustained caloric surplus"; size and training status shape what is gained.

### Fat loss
- 0.5–1% BW per week for lean lifters [44]. RP caps loss at 1% per week [13].
- Murphy & Koehler 2022 meta-regression: a deficit of ~500 kcal/day **prevented** lean-mass gains. Avoid deficits >500 kcal/day when muscle gain is wanted [45].

### Recomposition
- Most realistic for **beginners, detrained people and those with higher body fat**. Less likely for very lean or very experienced lifters [10].
- Usually done at maintenance or a slight deficit. MacroFactor caps a recomp at the top of its "recommended" range, and fat loss works best at ≤1 lb per week [10].

## 4. Macros

### Protein
- **ISSN 2017** [45a]:
  - 1.4–2.0 g/kg/day "is sufficient for most exercising individuals".
  - 2.3–3.1 g/kg/day may be needed to keep lean mass in deficits.
  - Above 3 g/kg may help fat loss in trained people.
  - Per meal: 0.25 g/kg or 20–40 g, every 3–4 h, with 700–3000 mg leucine. Pre-sleep casein 30–40 g.
- **Morton 2018** (49 RCTs, 1863 people) [46]: no further fat-free-mass gain beyond **1.62 g/kg/day** (95% CI 1.03–2.20). The authors note "it may be prudent to recommend ~2.2 g/kg/d" for people trying to maximise gains.
- **Nunes 2022** (74 RCTs) [47]: extra protein gives small additional lean-mass gains in people under 65 eating ≥1.6 g/kg/day with resistance training.
- **Tagawa 2021** [48]: lean mass rises dose-dependently. The slope flattens above 1.3 g/kg (0.39 vs 0.12 kg per +0.1 g/kg).
- **Distribution.** Schoenfeld & Aragon 2018: 0.4 g/kg per meal over ≥4 meals, up to 0.55 g/kg per meal at 2.2 g/kg/day [49]. Iraki: 0.40–0.55 g/kg per meal over 3–6 meals [38]. Trommelen 2023: 100 g in one dose gave a larger and longer (>12 h) response than 25 g [50], so the per-meal "cap" is softer than once thought.
- **Lean mass instead of bodyweight.** Helms 2014: 2.3–3.1 g/kg **of lean mass** during contest dieting [44]. Carbon, RP and MacroFactor all base protein on lean mass [15][14][5].
- **Context for Vrull.** Jim's day gives 3.25–4.1 g/kg. SPEC §9 already notes that gains plateau around 1.6–2.2 g/kg.

### Fat
- Iraki: 0.5–1.5 g/kg/day in the off-season [38]. Helms: 15–30% of kcal during a cut [44].
- RP never drops fat below 15% of kcal and keeps ≥5 g fat and ≥5 g carbs per meal [13]. MacroFactor has a physiological fat floor, and carbs absorb further cuts [5].
- Whittaker & Wu 2021: low-fat diets lowered total and free testosterone in men (SMD ~−0.38) [51]. A corrigendum was published later (2025/26) and I did not read it.

### Carbs
- Carbs are the **remainder**. Iraki suggests ≥3–5 g/kg/day for lifters [38].
- Henselmans 2022 (49 studies): carb intake "is unlikely" to change strength-training performance in the fed state for workouts of up to ~10 sets per muscle group. Higher volumes might benefit [52].

### Training vs rest days (carb cycling)
- **Evidence.** No direct evidence (none found) that cycling beats constant intake for hypertrophy at equal weekly energy. The rationale is fuelling and matching the extra session cost.
- **How apps do it**:
  - MacroFactor's "calorie shifting" moves energy toward training days; its help says this covers what most people want from carb cycling, and the app is "adherence-neutral" if you swap carbs for fat [10a].
  - Carbon uses a weekly budget across days [18].
  - Avatar: "you don't need to eat less on non-workout days unless you choose to" [53].
  - RP sets workouts per day [12].
  - Jim's template keeps fat the same and raises protein and carbs on training days (+600 kcal).

## 5. Measurements worth adding

### Waist and neck (US Navy, Hodgdon & Beckett 1984) [54]
- **Formula**:
  - Men: density = 1.032 − 0.191·log10(abdomen at navel − neck) + 0.155·log10(height). Women use abdomen at the natural waist + hip + neck, with their own coefficients. %fat = 495/density − 450, all in cm.
  - The common metric form for men is `495 / (1.0324 − 0.19077·log10(waist − neck) + 0.15456·log10(height)) − 450`.
  - SEE 3.5% for men and 3.7% for women against underwater weighing.
- **Limitations.** It is population-specific (developed on young, mostly white personnel) and overpredicts BF in strong women with larger waists [54].
- **Vrull already stores** neck, waist and hips (SPEC §11, "Matjet"), so Navy BF% can be computed with no new input.

### Smart scale (BIA)
- Weight readings are accurate (median error 0–0.3 kg). Body fat was "globally underestimated" by 2.2–4.4 kg against DXA, and the authors say the scales "should not be used routinely to assess body composition" [55].
- If used, keep to the same device under the same conditions. RP also advises against home-scale readings [14].

### Progress photos
- MacroFactor tracks up to three views (front, side, back) and up to 21 circumference metrics, including waist-to-height and waist-to-hip ratios. They are **progress indicators only; the algorithm uses intake and scale weight** [56]. I found no outcome studies.

### Weighing frequency
- Daily weighing (vs 5.4 days a week) went with more weight loss and more weight-control behaviours in one RCT analysis [57]. A systematic review found regular self-weighing was linked to weight loss and **not** to depression or anxiety [58].
- For an adaptive algorithm, daily is ideal and ≥3 times a week, spread out, is the minimum [4][11]. Daily noise (water, glycogen, gut contents) is why apps show a trend line [2][37].

## 6. Safety and honest presentation

- **Calorie floors.** Do not go below 1200 kcal (women) or 1500 kcal (men) except under a health professional [59][23]. NHLBI suggests deficits of 300–500 or 500–1000 kcal/day for overweight adults [60].
- **Other guardrails**:
  - Loss ≤1% BW per week [13][44].
  - Fat ≥15–20% of kcal [13].
  - Never cut protein. RP takes cuts from fat and carbs only [13].
  - RP diets last ≤16 weeks, and RP stops further loss below BMI 17 [13].
  - Deficits >500 kcal/day are a problem if muscle gain matters [45].
- **Honesty about estimates**:
  - Call the first number a "rough estimate" that "will change" [2], with a plausible range: two-thirds within ±150–200 kcal for BMR, more for TDEE [8].
  - Expect 2–3 weeks before a data-driven estimate settles [4].
  - Change targets only at weekly check-ins, in small steps [5][16].
  - Hold targets when logging is partial [16].
  - Show the reason for each change (Carbon explains each adjustment in the check-in report [18]).

---

## 7. Worked example: man, 185 cm, 88 kg, 4 training days a week, lean bulk

**Assumptions (Design proposal)**:
- Desk job with ~6–8k steps, giving a non-exercise multiplier of **1.4**. This sits between Yazio Moderate 1.38, Cronometer Lightly active 1.375 (TEF excluded) and the FAO lower bound of 1.40.
- Shortcut to Size session of ~60–75 min, about **+300 kcal** on training days (§2).
- Gain energy of **5600 kcal/kg**, the ~50/50 fat/lean assumption [1][6].
- Protein 2.0 g/kg, fat 0.9 g/kg (both the same every day), carbs as the remainder.
- BMI 25.7.

**BMR (kcal/day)**

| | Age 25 | Age 35 |
|---|---|---|
| Mifflin-St Jeor | **1916** | **1866** |
| Oxford/Henry | 1959 | 1867 |
| Deurenberg BF% (estimate) | 20.4% | 22.7% |
| Cunningham 1991 / Katch-McArdle with Deurenberg FFM | 1883 | 1839 |
| Cunningham 1991 with Navy BF (hypothetical waist 90 / neck 39 cm, giving 18.3%) | 1923 | 1923 |
| Cunningham 1980 with Deurenberg FFM | 2041 | 1996 |

The equations agree within about ±60 kcal, except Cunningham 1980, which is about 150 higher. Ten years of age changes Mifflin by only 50 kcal, so a default age of 30 is acceptable when age is unknown.

**TDEE (from Mifflin)**

| | Age 25 | Age 35 |
|---|---|---|
| Rest day (BMR × 1.4) | 2683 | 2613 |
| Training day (+300) | 2983 | 2913 |
| Weekly average (4 training + 3 rest) | **2854** | **2784** |
| Check: classic ×1.55 ("moderate, 3–5 days") | 2970 | 2893 |
| Check: classic ×1.375 | 2635 | 2566 |

**Targets**

| Rate | Surplus | | Age 25 | Age 35 |
|---|---|---|---|---|
| **0.25% BW/wk** (0.22 kg/wk, ~0.95 kg/month; suggested start) | +176 kcal (≈6% of TDEE) | Training day | **3160 kcal**: P 176 g · F 79 g · C 435 g (4.9 g/kg) | **3090 kcal**: P 176 · F 79 · C 418 |
| | | Rest day | **2860 kcal**: P 176 · F 79 · C 360 (4.1 g/kg) | **2790 kcal**: P 176 · F 79 · C 343 |
| | | Weekly average | 3030 | 2960 |
| **0.5% BW/wk** (0.44 kg/wk; MacroFactor "happy medium" for beginners) | +352 kcal (≈12%) | Training day | 3335: P 176 · F 79 · C 479 | 3265: P 176 · F 79 · C 462 |
| | | Rest day | 3035: P 176 · F 79 · C 404 | 2965: P 176 · F 79 · C 387 |

- Fat is 21–26% of kcal, above the 20% floor.
- Carbs are ≥3.9 g/kg, which meets Iraki's ≥3–5 g/kg.
- Protein of 176 g is 2.0 g/kg, inside the 1.6–2.2 g/kg range. With 4 meals that is 44 g per meal ≈ 0.5 g/kg per meal.

**Comparison with today's Jim scaling (My analysis)**
- Jim's 4/3 weekly average at 88 kg is **3711 kcal/day**, about 860–930 kcal above the estimated average TDEE.
- That surplus implies about 1.1 kg/week (≈1.2–1.3% BW/week) at 5600 kcal/kg, or about 0.8 kg/week at 7700 kcal/kg. Both are above MacroFactor's "very aggressive" beginner rate (1%) and well above Iraki's 0.25–0.5%.
- With ±300–500 kcal of TDEE uncertainty, Jim's numbers can still suit a very active person. Weekly check-ins would show which case applies.

---

## 8. Recommendation for Vrull (Design proposal)

1. **Inputs** (one "Objektivat" step in onboarding, editable at Ushqimi › Objektivat):
   - Required:
     - sex (formula only)
     - birth year (if skipped, age 30)
     - height
     - weight (the existing 7-day average)
     - day-to-day activity outside the gym (4 options with step hints, or Health Connect steps when connected)
     - training days (taken from the programme)
     - goal (build muscle / recomp / lose fat / maintain) and rate (3 presets)
   - Optional:
     - BF%, entered by hand, computed with the Navy formula from the neck, waist and hips already measured, or from a scale (labelled "low accuracy")
     - known maintenance calories
2. **Formula.**
   - BMR is Mifflin-St Jeor. When BF% is known, use Cunningham 1991 (370 + 21.6·FFM), or average the two when BF% is only an estimate.
   - Rest day = BMR × activity factor (1.3 / 1.4 / 1.55 / 1.7).
   - Training day = rest + session cost (≈3.4 kcal/kg, or (MET 4 − 1) × kg × h).
   - Surplus or deficit = rate × kg × 5600 (gain) or 7700 (loss) / 7.
   - Defaults: beginner bulk 0.25% per week; fat loss 0.5% per week, capped at 1% and at 500 kcal/day if muscle gain matters; recomp at maintenance.
3. **Macros.**
   - Protein 2.0 g/kg (slider 1.6–2.2; 2.3–3.1 g/kg FFM on a cut). For high BF%, base it on FFM.
   - Fat 0.9 g/kg, with a floor of max(0.6 g/kg, 20% kcal).
   - Carbs are the remainder, with a warning below 3 g/kg on a bulk.
   - Training and rest days keep the same protein and fat; carbs carry the session difference, so the weekly average is unchanged.
   - Jim's meal plan stays as a one-tap **template scaled to these targets**, and "Plani i Jimit" remains a selectable source.
4. **Adaptation.**
   - Run a weekly check-in from day 14, when the last 7 days have ≥4 logged food days and ≥3 weigh-ins. Otherwise hold the targets and say why.
   - Trend weight: EMA with α = 0.1 and interpolated gaps.
   - Observed TDEE = average intake − Δtrend × ρ / days over 14–21 days.
   - Blend: new = old + 0.5 × (observed − old), with the target change capped at ±150 kcal per week. Show the reason.
   - *My analysis:* with this feedback loop, the equilibrium rate is right whatever ρ is chosen; ρ only sets how fast the targets react.
5. **Page placement**:
   - Ushqimi › Objektivat: inputs, numbers, "vlerësim ±300 kcal" (estimate ±300 kcal), and the formula shown.
   - The weekly check-in card on Sot (Today) or Progresi › Trupi.
   - Measurement prompts for waist and neck (and hips for women) in Trupi, every 2–4 weeks.
   - The calorie floors and loss cap from §6 apply in every mode.

---

## Sources

1. MacroFactor, Expenditure V3: https://macrofactor.com/expenditure-v3/
2. MacroFactor, Algorithms and core philosophy: https://macrofactor.com/macrofactors-algorithms-and-core-philosophy/
3. MacroFactor, Algorithm accuracy: https://macrofactor.com/algorithm-accuracy/
4. MacroFactor help, Interpreting energy expenditure: https://help.macrofactorapp.com/FAQ/interpet_energy_expenditure
5. MacroFactor help #222, Goal adjustments: https://help.macrofactorapp.com/en/articles/222-how-does-macrofactor-make-adjustments-for-a-weight-gain-or-weight-loss-goal
6. MacroFactor help #199, Smaller bulking surpluses: https://help.macrofactorapp.com/en/articles/199-why-does-macrofactor-recommend-smaller-surpluses-for-bulking-than-i-expected
7. MacroFactor, How fast should you gain weight when bulking: https://macrofactor.com/bulking-calculator/
8. MacroFactor, Best BMR equations: https://macrofactor.com/best-bmr-equations/
9. MacroFactor, BMR calculator: https://macrofactor.com/bmr-calculator/
10. MacroFactor, Recomposition: https://macrofactor.com/recomposition/
10a. MacroFactor help #30, Refeeds, diet breaks, carb cycling: https://help.macrofactorapp.com/en/articles/30-does-macrofactor-support-refeeds-diet-breaks-or-carb-cycling
11. MacroFactor help, Weight trend: https://help.macrofactorapp.com/dashboard/weight_trend/
12. RP Diet Coach docs, Diet setup: https://docs.rpstrength.com/docs/diet-coach-app/overview/diet-setup/
13. RP Diet Coach docs, Keeping you safe: https://docs.rpstrength.com/docs/diet-coach-app/overview/keeping-you-safe/
14. RP help, Body fat percentage: https://help.rpstrength.com/hc/en-us/articles/34653038357655-What-is-your-body-fat-percentage
15. Carbon help, How Carbon sets and adjusts your macros: https://help.joincarbon.com/en/articles/14005628-how-carbon-sets-and-adjusts-your-macros
16. Carbon help, Weekly check-in: https://help.joincarbon.com/en/articles/6004812-weekly-check-in-in-carbon-how-it-works-and-what-to-expect
17. Carbon help, Initial goal: https://help.joincarbon.com/en/articles/6040890-how-to-create-your-initial-goal
18. Carbon, How it works: https://www.joincarbon.com/how-it-works
19. Cronometer support, Energy targets: https://support.cronometer.com/hc/en-us/articles/31974307318420
20. Cronometer support, Energy expenditure: https://support.cronometer.com/hc/en-us/articles/33132110153492
21. Cronometer support, Macro ratios: https://support.cronometer.com/hc/en-us/articles/33180387429908
22. Cronometer blog, Profile and targets update: https://cronometer.com/blog/macro-targets-revamp/
23. MyFitnessPal support, Initial goals: https://support.myfitnesspal.com/hc/en-us/articles/360032625391-How-does-MyFitnessPal-calculate-my-initial-goals
24. Yazio help, Calorie goal: https://help.yazio.com/hc/en-us/articles/4410156873233-How-does-Yazio-calculate-my-calorie-goal
25. Yazio help, Activity level: https://help.yazio.com/hc/en-us/articles/360005363638-Which-activity-level-should-I-choose
27. Mifflin et al. 1990, AJCN: https://doi.org/10.1093/ajcn/51.2.241
28. Frankenfield et al. 2005, JADA systematic review: https://doi.org/10.1016/j.jada.2005.02.005
29. Henry 2005, Oxford equations, Public Health Nutr (Table 15): https://doi.org/10.1079/PHN2005801
30. Cunningham 1980, AJCN: https://doi.org/10.1093/ajcn/33.11.2372
31. Cunningham 1991, AJCN: https://doi.org/10.1093/ajcn/54.6.963
32. ten Haaf & Weijs 2014, PLoS One: https://doi.org/10.1371/journal.pone.0108460
33. Deurenberg et al. 1991, Br J Nutr: https://doi.org/10.1079/bjn19910073
34. FAO/WHO/UNU 2004 Human energy requirements, ch. 5 (Tables 5.2–5.3): https://www.fao.org/4/y5686e/y5686e07.htm ; ch. 7: https://www.fao.org/4/y5686e/y5686e09.htm
35. 2024 Adult Compendium of Physical Activities, conditioning exercise: https://pacompendium.com/conditioning-exercise
36. Hall 2008, Int J Obes: https://doi.org/10.1038/sj.ijo.0803720
37. Walker, The Hacker's Diet, Signal and noise: https://www.fourmilab.ch/hackdiet/e4/signalnoise.html
38. Iraki et al. 2019, Sports (off-season bodybuilders): https://doi.org/10.3390/sports7070154
39. Helms et al. 2023, Sports Med Open: https://doi.org/10.1186/s40798-023-00651-y
40. Garthe et al. 2013, Eur J Sport Sci: https://doi.org/10.1080/17461391.2011.643923
41. Hatamoto et al. 2024, Clin Nutr: https://doi.org/10.1016/j.clnu.2024.09.035
42. Slater et al. 2019, Front Nutr: https://doi.org/10.3389/fnut.2019.00131
43. Aragon et al. 2017, ISSN position stand on diets and body composition: https://doi.org/10.1186/s12970-017-0174-y
44. Helms, Aragon, Fitschen 2014, JISSN contest prep: https://doi.org/10.1186/1550-2783-11-20
45. Murphy & Koehler 2022, Scand J Med Sci Sports: https://doi.org/10.1111/sms.14075
45a. Jäger et al. 2017, ISSN position stand on protein and exercise: https://doi.org/10.1186/s12970-017-0177-8
46. Morton et al. 2018, BJSM: https://bjsm.bmj.com/content/52/6/376 (doi 10.1136/bjsports-2017-097608)
47. Nunes et al. 2022, J Cachexia Sarcopenia Muscle: https://doi.org/10.1002/jcsm.12922
48. Tagawa et al. 2021, Nutr Rev: https://doi.org/10.1093/nutrit/nuaa104
49. Schoenfeld & Aragon 2018, JISSN: https://doi.org/10.1186/s12970-018-0215-1
50. Trommelen et al. 2023, Cell Rep Med: https://doi.org/10.1016/j.xcrm.2023.101324
51. Whittaker & Wu 2021, J Steroid Biochem Mol Biol: https://doi.org/10.1016/j.jsbmb.2021.105878 (corrigendum: https://doi.org/10.1016/j.jsbmb.2025.106880)
52. Henselmans et al. 2022, Nutrients: https://doi.org/10.3390/nu14040856
53. Avatar Nutrition help, Eating less on non-workout days: https://avatarnutrition.freshdesk.com/support/solutions/articles/19000075231-should-i-be-eating-less-on-non-workout-days-
54. National Academies (IOM), Body composition and physical performance, ch. 2 (Navy equations, Table 2-1): https://www.nationalacademies.org/read/6104/chapter/4
55. Frija-Masson et al. 2021, JMIR mHealth uHealth (smart scales vs DXA): https://mhealth.jmir.org/2021/4/e22487
56. MacroFactor, Body metrics and progress photos: https://macrofactor.com/body-metrics/
57. Steinberg et al. 2015, J Acad Nutr Diet: https://doi.org/10.1016/j.jand.2014.12.011
58. Zheng et al. 2015, Obesity: https://doi.org/10.1002/oby.20946
59. Harvard Health, Calorie counting made easy: https://www.health.harvard.edu/staying-healthy/calorie-counting-made-easy
60. NHLBI Clinical Guidelines (archived): https://webarchive.library.unt.edu/eot2008/20080920160643/http:/www.nhlbi.nih.gov/guidelines/obesity/e_txtbk/txgd/4311.htm

**Could not be read in this session:**
- PubMed and PMC pages showed a captcha, so abstracts were taken from Europe PMC instead.
- The Lose It! help centre and the ACSM/AND/DC 2016 full text (journals.lww.com) timed out on permission. The ACSM carbohydrate bands by training load are therefore not quoted.
- The Frankenfield "within 10%" percentages are from the full text, which was not read; only the abstract wording is used.
