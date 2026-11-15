# Provat e grupit sts-hinge (agjenti i kërkimit F2, 15.11.2026)

Skedari i të dhënave: `src/program/guides/sts-hinge.json`. Ky skedar është për kontrolluesin; nuk hyn në app.

Shënim për ndershmërinë e provave. Fjalitë e burimit poshtë janë të tri llojeve:
- **[V]** = fjalë për fjalë nga teksti i faqes (HTML i marrë me curl), nga Europe PMC API (abstrakt ose tekst i plotë) ose nga PDF-ja e ACE (pdftotext). Të hapura më 15.11.2026.
- **[D]** = e lexuar te faqja e hapur me WebFetch më 15.11.2026; WebFetch ktheu përmbledhje, jo tekst fjalë për fjalë.
- **[S]** = gjykim i agjentit (përkthim ose bashkim i dy fjalive të burimit), jo pohim i burimit.

## Çfarë ka ndryshuar pas kontrollit

Skedari ka 3 ushtrime: Romanian Deadlift, Lying Leg Curl, Seated Leg Curl. Hip Thrust-et e barkut u hoqën (shih §4–6). Hequr edhe: fjalitë "Këtu: ..." nën Korakakis (përfundime të agjentit), dhe nuk ka më këshilla me Escamilla, Francis ose Stoppani për abs.

## Kredencialet e ekspertëve

- **Jim Stoppani, PhD.** Titulli vërtetohet nga Human Kinetics, jo nga kanali i tij: "He received his doctorate in exercise physiology with a minor in biochemistry from the University of Connecticut. After graduation, he served as a postdoctoral research fellow at Yale University School of Medicine" (https://us.humankinetics.com/blogs/human-kinetics-podcast/an-encyclopedia-of-knowledge-dr-jim-stoppani-discusses-training-methods-for-hypertrophy-strength-and-fatloss, [V], hapur 15.11.2026). Faqet e tij që përdoren mbajnë "Written By Jim Stoppani, PhD" ([V]).
- **Pete McCall.** Autor i dy artikujve ACE; burimi është organizata ACE (artikuj ekspertësh të faqes së tyre), jo titulli personal. Titulli i tij nuk u kërkua veçmas.
- **Peter Francis, Ph.D.** (nuk përdoret më) Drejtues i studimit të porositur nga ACE, San Diego State University: "Led by Peter Francis, Ph.D." ([V], PDF-ja e ACE, f. 9; "This study was conducted by Peter Francis, Ph.D., and Jennifer Davis, M.A., at the San Diego State University"). Burimi është organizata ACE.
- **Maeo, Huang, Wu, Sakurai, Kusagawa, Sugiyama, Kanehisa, Isaka.** Studim i rishikuar nga kolegët, Medicine and Science in Sports and Exercise 2021;53(4) (PMID 33009197, DOI 10.1249/mss.0000000000002523, PMC7969179). Nuk kërkohet titull ekspertësh.
- **Escamilla, Babb, DeWitt, Jew, Kelleher, Burnham, Busch, D'Anna, Mowbray, Imamura.** Studim i rishikuar nga kolegët, Physical Therapy 2006;86(5):656–671 (PMID 16649890, DOI 10.1093/ptj/86.5.656).
- **Androulakis Korakakis, Wolf, Coleman, Burke, Piñero, Nippard, Schoenfeld.** Rishikim narrativ i rishikuar nga kolegët, JFMK 2023 (PMID 38249086).
- **Wilk, Zając, Tufano.** Rishikim, Sports Medicine 2021 (PMC8310485).
- **Bret Contreras, Squat University (Aaron Horschig, DPT, CSCS).** Nuk u përdorën: Contreras nuk lidhet me hip thrust-in e barkut; videoja e Squat University për RDL është YouTube dhe nuk hapet (shih raportin).

## Tempo (të gjitha ushtrimet)

`downS` = faza ekscentrike (muskuli zgjatet), `upS` = faza koncentrike; parazgjedhja 2 dhe 1. Te RDL ulja e shufrës është ekscentrike; te curl-et kthimi i peshës (shtrirja e gjurit) është ekscentrike, kurbimi koncentrik; te hip thrust-et e barkut ulja e shtyllës dhe e legenit është ekscentrike, ngritja koncentrike.

- **Wilk, Zając dhe Tufano, 2021, Sports Medicine** (https://europepmc.org/articles/PMC8310485), teksti i plotë, "Key Points" [V]: "Neither isolated slow nor fast movement tempos are more effective for muscle hypertrophy, but it seems that the most favorable is a combination of slower eccentric movements, paired with faster concentric movements."
- **Androulakis Korakakis dhe kolegët, 2023, JFMK** (https://europepmc.org/article/MED/38249086), abstrakti [V]: "We recommend that when trying to maximize hypertrophy, one should employ a ROM that emphasizes training at long muscle lengths while also employing a repetition tempo between 2 and 8 s."
- Pohimi i app-it: "poshtë 2 s, lart 1 s" (Wilk, drejtimi) dhe "një përsëritje zgjat nga 2 deri në 8 s" (Korakakis).

## 1. Romanian Deadlift

**Përgatitja** (nasm_rdl, ace_rdl, ace_tech)
- NASM, Romanian Deadlift Barbell (https://www.nasm.org/resource-center/exercise-library/romanian-deadlift-barbell) [V]: "Stand with feet hip-width apart with the barbell resting across your thighs. Maintain a neutral spine and engage your core to prepare for the movement."
- NASM [V]: "Hold the barbell with a slightly wider than shoulder-width grip. Draw your shoulders back and down and position your arms just outside your thighs with a neutral grip."
- ACE, Technique Series (https://www.acefitness.org/prosourcearticle/5767/ace-technique-series-romanian-deadlift) [V]: "Use a pronated (palms-down) grip to firmly grasp a barbell with the hands approximately shoulder-width apart. Maintain a slight bend in the knees with the feet hip-width apart."
- **Kundërshtim i vogël (grip):** NASM thotë "slightly wider than shoulder-width", ACE "approximately shoulder-width apart". Udhëzuesi thotë "rreth gjerësisë së shpatullave ose pak më të gjerë" (të dyja); orkestruesi mund ta zgjedhë njërën.
- ACE Technique Series [V]: "Lift the chest and pull the shoulder blades down toward the back pockets to maintain extension of the spine"; "Cue the client to keep his or her chin tucked into the neck"; "Instruct the client to look toward the floor, as looking at a mirror can create stress in the cervical spine."
- ACE Technique Series [V]: "use a squat rack to rest the barbell at thigh-to-waist height when starting, as opposed to trying to lift the weight up from the floor."
- ACE, Romanian Deadlift, biblioteka (https://www.acefitness.org/resources/everyone/exercise-library/317/romanian-deadlift/) [V]: "Holding a barbell with both hands so that it rests on the front of the thighs, keep a slight bend in both knees and a straight back."

**Lëvizja** (nasm_rdl, ace_rdl, ace_tech)
- ACE biblioteka [V]: "Push the hips back while lowering the weight towards the floor until feeling some tension along the back of the legs." Dhe: "To return to standing, push the heels into the floor and pull the knees backwards, keeping the bar very close to the body."
- ACE Technique Series [V]: "Coach the client to lower until tension is felt in the back of the thighs—probably when the bar gets to about knee height or, if the client has more flexibility in the hamstrings, to about mid-shin." NASM [V]: "Descend until you feel adequate hamstring stretch, typically when the barbell reaches mid-shin height."
- NASM [V]: "Drive your hips forward to stand upright, maintaining hamstring tension throughout. Stop just short of full hip extension at the top to maintain continuous tension in the posterior chain."
- ACE Technique Series [V]: "Do NOT allow the client to round the back or extend the knees while lowering the weight."

**Tempo dhe fryma** (wilk, korakakis). Pa burim të hapur për kohën e frymëmarrjes te RDL: ACE dhe NASM nuk thonë kur merret ajri. Udhëzuesi ka vetëm dy rreshta tempoje, pa rresht frymëmarrjeje (brief-i kërkon 1–4 rreshta për `breathing`; mbahen dy). Raportuar si boshllëk.

**Sinjalet** (nasm_rdl, ace_rdl, ace_tech): shkurtime të përgatitjes dhe lëvizjes më sipër [S]. "Ijët mbrapa" = "Push the hips back" (ACE); "Shufra ngjitur me kofshët" = "keep the bar against the body the entire time" (Gentilcore, cituar te ACE Technique Series [V]).

**Gabimet**
- NASM, Common Mistakes [V]: "Rounding the lower back excessively, which removes spinal stability and increases injury risk"; "Bending the knees too much, which converts the exercise into a squat variation"; "Jerky movements or excessive momentum, which reduces hamstring tension and time under tension"; "Using excessive weight that compromises form or spinal position"; "Not achieving adequate hamstring stretch, which reduces eccentric stimulus and hamstring development."
- ACE Technique Series [V]: "the farther the bar hovers away from the body, the greater the stress placed on the lower back" (Tony Gentilcore, C.S.C.S., cituar nga ACE); "looking at a mirror can create stress in the cervical spine."

**Këshillat**
- Stoppani, Top to Bottom Legs (https://www.jimstoppani.com/training/top-to-bottom-legs) [V]: "Romanians, on the other hand, force you to use less weight than standard deads, but place even greater emphasis on the posterior leg muscles, as all of the movement is hip extension."
- Gentilcore: fjalia "the farther the bar hovers away from the body, the greater the stress placed on the lower back" është e Tony Gentilcore, C.S.C.S., e cituar nga ACE ("Tony Gentilcore, C.S.C.S., a Boston-based strength and conditioning coach", [V]); titulli nuk u vërtetua veçmas, udhëzuesi e shënon "sipas ACE".
- ACE Technique Series [V]: "When the client can perform 10 to 15 good hip hinges while maintaining a stable spine and demonstrating appropriate range of motion through the hips, he or she will be ready to perform the RDL with external resistance." Dhe: "slide or glide it down their thighs."
- ACE, The Deadlift and Romanian Deadlift, 2021 (https://www.acefitness.org/resources/pros/expert-articles/7963/what-is-the-difference-between-romanian-deadlift-vs-deadlift/) [V]: "While a weight belt can help support the lumbar spine, it should only be used with heavy weights. When learning the exercises, use lighter weights to allow the deep core muscles to stabilize the spine." Dhe: "When performing maximal loads for three or fewer reps, however, a belt is advised for support."
- Korakakis 2023 (tempo më sipër). Këshilla "Këtu: ..." e agjentit u hoq; mbetet vetëm Korakakis te tempo.
- ACE Technique Series [V]: "There is another version of the RDL that focuses on keeping the legs straight with knees fully extended. This is an extremely advanced version designed to place more load directly into the hamstrings ... and should only be practiced by experienced lifters with excellent body control."

**Siguria**
- ACE Technique Series [V]: "Placing the lumbar spine under load while it is in a flexed position could be a potential mechanism for injury." Dhe për mësimin: "The barbell version of the RDL is an advanced progression."
- NASM, Corrective Exercise Red Flags (https://www.nasm.org/resource-center/blog/corrective-exercise-red-flags) [V]: "Sharp or sudden pain is a signal to stop exercising and decide whether continued training is right."
- ACSM, A Road Map to Effective Muscle Recovery [D]: "You should stop participation in any exercise activity that causes pain."

## 2. Lying Leg Curl

**Përgatitja dhe lëvizja** (nasm_lying, ace_prone)
- NASM, Lying Leg Curl (https://www.nasm.org/resource-center/exercise-library/lying-leg-curl) [V]: "Lie face down on the leg curl machine with your legs extended and the pad positioned just above your ankles. Ensure your hips remain on the machine throughout the movement."
- NASM [V]: "Position both legs under the pad with your knees bent at approximately 90 degrees. Engage your core and position your hands on the machine for stability."
- NASM [V]: "Curl the pad upward by flexing your hamstrings, bringing your heels toward your glutes while maintaining controlled movement." Dhe: "Extend your legs to return to the starting position with control ... Stop just short of full extension to maintain continuous muscular tension."
- ACE, Prone Lying Hamstrings Curl (https://www.acefitness.org/resources/everyone/exercise-library/131/prone-lying-hamstrings-curl/) [V]: "Exhale and curl (bend) your knee, bringing your heel towards your buttock without moving your thigh ..., lifting your hips off the mat or arching your low back." Dhe: "The point where you notice your hips or low-back beginning to move indicates that you have reached the limits of movement in your joint." Dhe: "By engaging (lightly contracting) your abdominal muscles, this will help prevent hip hiking and low-back hyper-extension."
- **Kufizim:** faqja ACE është për curl të shtrirë me kabllo, jo për makinë; udhëzuesi e shënon qartë te setup 4 dhe breathing 3 ("Sipas ACE, për curl-in e shtrirë me kabllo"). U përdor vetëm për ijët, belin, kufirin e lëvizjes dhe frymën ("Exhale and curl", "Inhale and slowly return"), që vlejnë për çdo curl të shtrirë.

**Tempo dhe fryma** (wilk, korakakis, ace_prone): tempo si më sipër; ACE [V]: "Exhale and curl ... Inhale and slowly return your leg back to your starting position."

**Gabimet** (nasm_lying, ace_prone)
- NASM [V]: "Using excessive weight that compromises form or causes jerky movements"; "Not achieving full range of motion, which limits hamstring activation"; "Moving too quickly without controlling concentric and eccentric phases equally"; "Allowing the hips to shift or rotate during the movement."
- ACE [V]: "There is often a tendency to hike the hips upwards or extend the low back (increasing the low back arch) during this exercise."

**Këshillat**
- **Maeo dhe kolegët, 2021** (https://europepmc.org/article/MED/33009197), abstrakti [V]: "Training-induced increases in muscle volume were greater in Seated-Leg versus Prone-Leg for the whole hamstrings (+14% vs +9%) and each biarticular (+8%-24% vs +4%-19%), but not monoarticular (+10% vs +9%), hamstring muscle." Metoda [V]: "Twenty healthy adults conducted seated leg curl training with one leg (Seated-Leg) and prone with the other (Prone-Leg), at 70% one-repetition maximum (1RM), 10 repetitions per set, 5 sets per session, 2 sessions per week for 12 wk." Përfundimi [V]: "Hamstrings muscle size can be more effectively increased by seated than prone leg curl training, suggesting that training at long muscle lengths promotes muscle hypertrophy, but both are similarly effective in reducing susceptibility to muscle damage." Numrat u morën nga abstrakti i Europe PMC (ose teksti i plotë PMC7969179); nuk u ndryshuan.
- Këshilla "Këtu: ..." e agjentit u hoq.
- **Kundërshtim i vogël me NASM:** FAQ i NASM te Lying Leg Curl thotë [V]: "The prone lying position allows greater range of motion and isolated hamstring activation compared to seated variations." Maeo 2021 nuk mat lëvizjen ose aktivizimin, por madhësinë e muskulit dhe e gjen curl-in e ulur më të mirë. Udhëzuesi nuk e ka përdorur pohimin e FAQ të NASM.

**Siguria** (ace_prone, nasm_red, acsm_road): ACE për ijët/belin [V] si më sipër; NASM dhe ACSM si te RDL.

## 3. Seated Leg Curl

- NASM, Seated Leg Curl (https://www.nasm.org/resource-center/exercise-library/seated-leg-curl) [V]: "Sit on the leg curl machine with your back firmly against the backrest. Adjust the seat so the pad sits just above your ankles and position your feet on the platform."
- NASM [V]: "Position both legs under the pad with your knees bent at approximately 90 degrees. Engage your core and position your hands on the machine for stability and support."
- NASM [V]: "Curl the pad downward by flexing your hamstrings, bringing your heels toward your glutes while maintaining controlled movement. Focus on hamstring contraction throughout the exercise." Dhe: "Extend your legs to return to the starting position with control ... Stop just short of full extension to maintain continuous muscular tension throughout the set."
- NASM, Common Mistakes [V]: "Using excessive weight that causes jerky movements or compromises form"; "Not achieving full range of motion, which limits hamstring activation and development"; "Moving too quickly without controlling both concentric and eccentric phases equally"; "Allowing the hips to shift or rotate during the movement."
- **Fryma:** NASM nuk e jep; udhëzuesi ka vetëm tempon (Wilk, Korakakis), pa rresht për ajrin.
- **Këshilla (Maeo 2021):** numrat si te Lying Leg Curl [V]. Shpjegimi i mekanizmit [V], abstrakti i tekstit të plotë: "The biarticular hamstrings are lengthened more in a seated (hip-flexed) than prone (hip-extended) position." Dhe Figura 1 [V]: "the three biarticular hamstrings (BFL, ST, and SM) operate at longer muscle lengths during the seated than prone condition, while there is no difference in the monoarticular BFS."
- Siguria: NASM Red Flags dhe ACSM, si më sipër.

## 4–6. Hip Thrust, Weighted Hip Thrust, Smith Machine Hip Thrust: HEQUR nga skedari

Kontrolluesi e kërkoi heqjen: asnjë burim i pranuar nuk e përshkruan lëvizjen e hip thrust-it të barkut, ndaj tri ushtrimet nuk plotësojnë minimumet (setup, steps, cues, mistakes). Kontrolli i PDF-së së programit (pdftotext, 14 faqe): vetëm renditja në stërvitje dhe shënimi te Weighted Hip Thrust ("*Perform the hip thrust while holding a medicine ball or dumbbell between your feet, or while wearing ankle weights"), pa përshkrim lëvizjeje. Lidhja e Bodybuilding.com për programin ktheu 404 (15.11.2026). Stoppani i radhit hip thrust-et si ushtrim të veçantë nga reverse crunch-i ("hanging leg raises ..., hanging knee raises, reverse crunches, hip thrusts", 5 Rules of Ab Training), prandaj ACE Reverse Crunch, Francis (109%, 240%) dhe Escamilla (reverse crunch i pjerrët 30°) nuk u përdorën për to. Përshkrimet e videove të lexuara nga orkestruesi (YifOemw7tR4, yuhDu2CVjko, WInKXaLzHOk) japin vetëm një sinjal ose asnjë teknikë. Pohimi te SPEC §5 (këmbët shtyjnë shufrën) mbetet pa burim.

## Pyetje të hapura

1. Hip Thrust-et e barkut kërkojnë një burim të pranuar për lëvizjen (videot e Stoppani-t pa përshkrim teknike); pa të, mbeten pa udhëzues.
2. Fryma te RDL dhe te Seated Leg Curl: pa burim; `breathing` ka vetëm tempon.
3. Titulli CSCS i Tony Gentilcore nuk u vërtetua nga burim i pavarur.
