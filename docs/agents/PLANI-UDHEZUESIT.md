# Plani i udhëzuesve dhe videove të ushtrimeve

Vendimi i përdoruesit (15.11.2026, 06:10): udhëzuesi i plotë i §0.3g për të gjitha ushtrimet, jo vetëm për 66 të Shortcut to Size; nisja me valën 0. Rregullat e përmbajtjes: SPEC §0.3e, §0.3g. Brief-i i përbashkët i agjentëve: `docs/agents/BRIEF-UDHEZUESI.md`.

## Sa është (15.11.2026)

| | Ushtrime | Videot | Udhëzuesit |
|---|---|---|---|
| Shortcut to Size | 66 | 65 (`exercise-videos.ts`) | 1 tekst i kontrolluar (Bench Press), pa skedar |
| Biblioteka pa Shortcut to Size | 689 | 0 | 0 |

Biblioteka (`library.json`, 739) mban vetëm kategoritë strength, powerlifting, olympic weightlifting, strongman dhe plyometrics; 50 ushtrime janë edhe te Shortcut to Size.

## Rolet

| Puna | Kush | Modeli |
|---|---|---|
| Plani, skeleti, bashkimi, provat, commit-et | orkestruesi | Opus |
| Videot: kërkimi dhe kontrolli me skript në built-in browser, një grup në herë | orkestruesi | Opus |
| Kërkimi dhe shkrimi i udhëzuesve, 6–12 ushtrime me të njëjtën lëvizje | `general-purpose`, deri në 5 paralel | Sonnet |
| Kontrolli i burimeve të një grupi (agjent që nuk e ka parë punën) | `vrull-reviewer` | Sonnet |

## Hapat e një grupi

1. **Brief-i**: ushtrimet e grupit, skedari i daljes `src/program/guides/<grupi>.json`, skedari i provave `docs/research/guides/<grupi>.md` (pohimi, lidhja, fjalia e burimit).
2. **Kërkimi**: agjenti hap çdo burim, shkruan me fjalët e veta dhe e mbyll kur `GUIDE_FILE=<grupi>.json npx vitest run src/program/exercise-guides.test.ts` kalon.
3. **Kontrolli**: `vrull-reviewer` hap çdo lidhje te këshillat dhe siguria dhe rreth 30% të tjerave; çdo mospërputhje ndreqet ose pohimi hiqet.
4. **Bashkimi**: orkestruesi lexon shqipen, nis provat, bën commit me `[skip ci]`, shkruan KOSTOT dhe MESIMET.
5. **Videot e grupit** (vetëm biblioteka): skripti te built-in browser, rregullat e `exercise-videos.ts`; orkestruesi sheh vetëm rastet e paqarta.

## Valët

**Vala 0 (E3-21, për 0.40): 65 ushtrimet e Shortcut to Size** pas Bench Press, në 8 grupe:

| Grupi | Skedari | Ushtrimet |
|---|---|---|
| A | `sts-chest.json` | Bench Press (konvertim i tekstit të kontrolluar), Incline Bench Press, Incline Dumbbell Press, Reverse-Grip Incline Dumbbell Press, Incline Dumbbell Flye, Incline Cable Flye, Dumbbell Flye, Cable Crossover, Close-Grip Bench Press |
| B | `sts-triceps.json` | Triceps Pressdown, Lying Triceps Extension, Cable Lying Triceps Extension, Cable Overhead Triceps Extension, Dumbbell Overhead Triceps Extension, One-Arm Overhead Cable Triceps Extension |
| C | `sts-back.json` | Dumbbell Bent-Over Row, Seated Cable Row, Wide-Grip Pulldown, Behind-Neck Pulldown, Reverse-Grip Pulldown, Standing Pulldown, Straight-Arm Pulldown |
| D | `sts-biceps.json` | Barbell Curl, Preacher Curl, Dumbbell Incline Curl, Incline Cable Curl, One-Arm High Cable Curl, Behind-Back Cable Curl, Dumbbell Concentration Curl |
| E | `sts-shoulders.json` | Dumbbell Shoulder Press, Dumbbell Lateral Raise, One-Arm Cable Lateral Raise, One-Arm Cable Front Raise, High Cable Rear Delt Fly, Bent-Over Lateral Raise, Smith Machine Upright Row, Dumbbell Upright Row, Dumbbell Shrug, Barbell Shrug, One-Arm Smith Machine Shrug |
| F1 | `sts-legs.json` | Squat, Front Squat, Leg Press, One-Leg Leg Press, Leg Extension, Standing Calf Raise, Leg Press Calf Raise, Seated Calf Raise |
| F2 | `sts-hinge.json` | Romanian Deadlift, Lying Leg Curl, Seated Leg Curl, Hip Thrust, Weighted Hip Thrust, Smith Machine Hip Thrust |
| G | `sts-abs.json` | Crunch, Weighted Crunch, Cable Crunch, Machine Crunch, Hanging Leg Raise, Plank, Oblique Crunch, Cable Oblique Crunch, Cable Woodchopper, Band Roundhouse Elbow, Dumbbell Side Bend, Side Plank |

Raundi 1: A, B, C, D, E. Raundi 2: F1, F2, G.

**Valët e bibliotekës (E3-24)**, sipas muskulit kryesor, secila e ndarë në grupe me të njëjtën lëvizje: biceps 50 (piloti: mat koston para të tjerave), triceps 69, gjoksi 79, shpatullat 119, shpina (lats dhe mesi) 61, kuadricepsi 119, hamstring-et dhe vithet 75, barku 85, të tjerat (pulpat, trapezi, parakrahu, qafa, beli, aduktorët, abduktorët) 82.

## Kostot dhe kufijtë

- Kostoja e përafërt: vala 0 rreth 2–3 milionë tokena; biblioteka me udhëzuesin e plotë rreth 3 herë më shumë se varianti i shkurtër, pra rreth 40–50 milionë; videot rreth 2 milionë. Piloti i bicepsit e mat; çdo grup shkruan rreshtin e vet te `KOSTOT.md`.
- 0 minuta Actions: të dhënat dhe dokumentet shkojnë me `[skip ci]`.
- Të dhënat nuk shihen në telefon pa kodin e Mëso-s dhe të faqes së ushtrimit (0.40) dhe të seancës (0.41).
