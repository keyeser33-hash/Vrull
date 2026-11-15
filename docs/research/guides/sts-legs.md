# Provat e grupit sts-legs (agjenti i kërkimit F1, 15.11.2026)

Skedari i të dhënave: `src/program/guides/sts-legs.json`. Ky skedar është për kontrolluesin; nuk hyn në app. Prova: `GUIDE_FILE=sts-legs.json npx vitest run src/program/exercise-guides.test.ts` kalon (9/9).

Shënim për ndershmërinë e provave. Fjalitë e burimit poshtë janë tre llojesh:
- **[V]** = fjalë për fjalë nga abstrakti i marrë me Europe PMC API (`resultType=core`) ose nga teksti i plotë i Europe PMC (Wilk "Key Points", Kinoshita 2023), më 15.11.2026.
- **[D]** = e lexuar te faqja e hapur me WebFetch më 15.11.2026; WebFetch kthen përmbledhje, jo tekst fjalë për fjalë, ndaj fjalia është e burimit në përmbajtje dhe jo gjithmonë citat i saktë. Kur WebFetch dha thonjëza, janë ato; përndryshe shënohet "përmbledhje". Kontrolluesi duhet ta hapë lidhjen.
- **[S]** = gjykim i agjentit (përkthim, ose lidhje mes dy burimeve), jo pohim i burimit.

## Ushtrimet

Vlera e `exercise` është ID-ja e njohur nga `shortcut-to-size.ts` (`Squat`, `Front Squat`, `Leg Press`, `One-Leg Leg Press`, `Leg Extension`, `Standing Calf Raise`, `Leg Press Calf Raise`, `Seated Calf Raise`). Brief-i e shkruante të parin "Squat (me shufër në shpinë)"; ajo vlerë nuk ekziston dhe prova do të binte, ndaj u përdor `Squat` (shih pyetjet).

## Kredencialet e ekspertëve

- **Jim Stoppani, PhD.** Titulli vërtetohet nga Human Kinetics, jo nga faqja e tij: "He received his doctorate in exercise physiology with a minor in biochemistry from the University of Connecticut." dhe "After graduation, he served as a postdoctoral research fellow at Yale University School of Medicine." (https://us.humankinetics.com/blogs/human-kinetics-podcast/an-encyclopedia-of-knowledge-dr-jim-stoppani-discusses-training-methods-for-hypertrophy-strength-and-fatloss, [D] thonjëza nga WebFetch). Faqet e tij te jimstoppani.com janë shënuar "Written By Jim Stoppani, PhD": Squat Master Class (përditësuar 26.08.2021), Leg Press Master Class (26.08.2021), Lean On the Leg Extension (03.01.2025), Exercises for Bigger, Stronger Legs (28.09.2023), Standing Calf Raises for Best Growth (13.04.2024). Videot e tij (Smith machine calf raise, seated calf raise, "Squat Biomechanics", "Lean Back Leg Extensions") NUK u hapën (shih "Burimet që nuk u hapën").
- **Dan Austin (MSCC) dhe Bryan Mann (PhD, CSCS).** Autorët e "Powerlifting, 2nd edition" (Human Kinetics). Nga faqja e librit te HK ([D], përmbledhje): Austin, "MSCC", bachelor te Newberry College, master te Austin Peay State University, assistant director of sport performance te University of South Carolina; Mann, "PhD and CSCS ... through the NSCA", assistant clinical professor of kinesiology and sport science te University of Miami. https://us.humankinetics.com/products/powerlifting-2nd-edition
- **Heather Cherry, NBC-HWC, IC-FHS, CPT, NTP**, Content Strategist te NASM, autore e artikullit "Calf Training" ([D]). Titulli i saj është i një strategjisteje përmbajtjeje, jo i një studiuesi; burimi është organizata NASM (shih pyetjet).
- **Sabrena Jo, Ph.D.**, senior director of science and research te ACE, autore e "Get Stronger Calves with These 5 Exercises" ([D]).
- **Studimet** (rishikuar nga kolegët, Europe PMC): Hartmann, Wirth, Klusemann 2013 (PMID 23821469); Escamilla 2001 (11194098); Kubo, Ikebukuro, Yata 2019 (31230110); Yanagisawa dhe kolegët 2021 (33038028); Gullett, Tillman, Gutierrez, Chow 2009 (19002072); Larsen dhe kolegët 2025 leg press (40113586) dhe leg extension (39699974); Kinoshita, Maeo dhe kolegët 2026 (41630124) dhe 2023 (PMC10753835); Kassiano dhe kolegët 2023 (37015016); Riemann, Limbaugh, Eitner, LeFavi 2011 (20581696); Wilk, Zając, Tufano 2021 (PMC8310485); Androulakis Korakakis dhe kolegët 2023 (38249086). Nuk kërkohet titull ekspertësh.
- **Mayo Clinic.** Organizatë mjekësore e pranuar nga brief-i; faqja e videos "Knee extension with weight machine" nuk ka autor të emërtuar (flasin Dr. Laskowski dhe Nicole Campbell pa kredenciale), referenca: "Medical review (expert opinion). Mayo Clinic, Rochester, Minn. July 25, 2012" ([D]).

## Tempo (të gjitha ushtrimet)

- Tempo 2 s poshtë, 1 s lart: parazgjedhja e brief-it. Pohimi "ulja më e ngadaltë me ngritjen më të shpejtë duket më e mira": **Wilk, Zając dhe Tufano, 2021** (https://europepmc.org/articles/PMC8310485), "Key Points" te teksti i plotë [V]: "it seems that the most favorable is a combination of slower eccentric movements, paired with faster concentric movements."
- "Një përsëritje zgjat 2–8 s": **Androulakis Korakakis dhe kolegët, 2023** (https://europepmc.org/article/MED/38249086) [V]: "one should employ a ROM that emphasizes training at long muscle lengths while also employing a repetition tempo between 2 and 8 s."
- Te ushtrimet e kavilles `downS` = ulja e thembrave (2 s, brenda "2-to-3-second lowering" të NASM); te Leg Extension `downS` = ulja e peshës dhe `upS` = ngritja e jastëkut; te leg press `downS` = kthimi i platformës drejt trupit. Breathing e thotë drejtimin me fjalë.
- Kujdes: te Seated Calf Raise, Standing Calf Raise dhe Leg Press Calf Raise tempo e kavilles mbështetet vetëm te parazgjedhja dhe te NASM (uljen 2–3 s); asnjë studim i hapur nuk e mat tempon e kavilles.

## 1. Squat (shufër në shpinë)

**Përgatitja** (ace_back_squat, nasm_squat, stoppani_squat)
- NASM Guide to Squats and Deadlifts (PDF, https://trainer.nasm.org/hubfs/NASM_Free%20Guide_Squats%20and%20Deadlifts.pdf), [D] përmbledhje: "Set the rack so the barbell sits at roughly chest height. Set the safety pins at an appropriate height, or use a spotter if you lack safety pins."; "Position your feet 'slightly wider than hip-width apart'"; "brace your core before descending"; bar high (upper trapezius) ose low (posterior deltoid).
- ACE, Back Squat (https://www.acefitness.org/resources/everyone/exercise-library/11/back-squat/) [D]: "Set a barbell in a rack just below shoulder height"; grip "wider than shoulder-width apart"; "Lift the chest and squeeze the shoulder blades together"; "place the feet slightly wider than shoulder-width apart." **Kontradiktë e vogël:** lartësia e raftit (ACE "pak nën shpatulla", NASM "rreth lartësisë së gjoksit") dhe këmbët (ACE "pak më gjerë se shpatullat", NASM "pak më gjerë se ijët"); teksti i thotë të dyja me emrat (NASM "around chest height" / ACE "just below shoulder-height"; NASM "slightly wider than hip-width" / ACE "a little wider than shoulder-width"). Zgjedhja i mbetet vendimmarrësit.
- Stoppani, Squat Master Class [D]: shufra e lartë "sits at the top of the upper traps"; e ulët "a few inches lower"; "Push the chest out slightly so the back arches naturally."

**Lëvizja** (ace_back_squat, nasm_squat, stoppani_squat)
- NASM [D]: "A well-performed squat has equal hip and ankle flexion, achieved by bending the knees and hips at about the same rate."; "Track the knees over the second and third toes"; "Do not let your knees collapse inward toward each other."; thellësia "depends on your flexibility, strength, and goals".
- ACE [D]: "Sit back into the hips, keeping the back straight and chest up"; squat "until the hips are 'below the knees'"; "press through the feet into the ground and push the hips forward".
- Stoppani [D]: "Descend until 'your thighs reach at least parallel with the floor'"; "The heels should stay on the floor throughout the squat."

**Tempo dhe fryma** (wilk, korakakis, nasm_squat): NASM [D]: "take a deep diaphragmatic breath, hold it, and brace your core. Exhale forcefully as you ascend."

**Sinjalet:** shkurtime nga përgatitja dhe lëvizja më sipër [S] mbi [D].

**Gabimet**
- Shpina rrumbullakoset: Stoppani [D]: rounding under load "very dangerous for the health of your spine".
- Thembrat ngrihen: Stoppani [D]: "Heels lifting and knees moving forward past the toes signal that the center of gravity has moved too far forward." (përmbledhje); çoje ijën pas: "pushing the butt back on the descent to keep the center of gravity back."
- Gjunjët brenda: NASM [D] si më sipër. Kraharori: ACE "Keep the chest up during the descent." [D]. Shpejtësia: NASM [D]: "Start light to refine technique, and avoid excessive speed or momentum."

**Këshillat**
- Stoppani [D]: shufra e lartë "keeps the torso more upright and emphasizes the quads"; e ulët "shifts more work to the glutes and hamstrings"; "Heavier loads (above roughly 80% of 1RM) tend to emphasize glutes and hamstrings."
- Hartmann 2013 (https://europepmc.org/article/MED/23821469) [V]: "Contrary to commonly voiced concern, deep squats do not contribute increased risk of injury to passive tissues." dhe "Provided that technique is learned accurately under expert supervision and with progressive training loads, the deep squat presents an effective training exercise".
- Escamilla 2001 (https://europepmc.org/article/MED/11194098) [V]: "For athletes with healthy knees, performing the parallel squat is recommended over the deep squat, because injury potential to the menisci and cruciate and collateral ligaments may increase with the deep squat." Gjithashtu [V]: "the parallel squat was not injurious to the healthy knee."
- **KONTRADIKTË:** Hartmann (squat-i i thellë nuk shton rrezikun për indet pasive) kundrejt Escamilla (rekomandon paralelin mbi të thellin, rrezik i mundshëm për menisqet dhe ligamentet). Të dy janë te udhëzuesi, secili me emrin; zgjedhja kush del (ose të dyja) i mbetet personit që vendos.
- Kubo 2019 (https://europepmc.org/article/MED/31230110) [V]: "The volumes of knee extensor muscles significantly increased by 4.9 ± 2.6% in FST (p < 0.001) and 4.6 ± 3.1% in HST"; "relative increases in adductor (p = 0.026) and gluteus maximus (p = 0.008) muscle volumes were significantly greater in FST than in HST." Numrat e adduktorëve dhe gluteus: FST 6,2% / 6,7%, HST 2,7% / 2,2% [V].
- Yanagisawa 2021 (https://europepmc.org/article/MED/33038028) [V]: "Lower lumbar intervertebral disks are subject to greater mechanical stress during high-load parallel back squat exercise, which may result from smaller lumbar lordosis and anterior pelvic tilt angles at the bottom position during parallel squat." (13 subjekte, 80% e 1RM, Smith machine.) Kufizim: Smith machine, 13 të rinj, një seancë.

**Siguria**
- NSCA, Standard 3.2 (PDF, WebFetch, përmbledhje [D]): "In conjunction with appropriate safety equipment (e.g., power racks), attentive spotting must be provided" "for participants performing activities in which free weights are supported on the trunk or moved over the head/face". Standardi nuk e emërton squat-in; kuptimi për squat-in (shufra mbi trup) është [S]. https://dxpprod.nsca.com/globalassets/education/nsca_strength_and_conditioning_professional_standards_and_guidelines.pdf
- NASM PDF [D]: "The spotter should be positioned behind you"; "Communicate with your spotter about the level of assistance you require"; "If lifting heavy, always use a spotter or safety equipment such as safety bars or a squat rack."; ngrohja "light cardio for 5-10 minutes", "warm-up set of 8-10 reps".
- NASM, Corrective Exercise Red Flags [D]: "Localized fatigue or burning during high effort sets" (e zakonshme); "Sharp or sudden pain is a signal to stop exercising"; "Stop training and recommend medical evaluation" (gudulisje, mpirje). ACSM, A Road Map to Effective Muscle Recovery [D, citat i saktë nga WebFetch]: "You should stop participation in any exercise activity that causes pain." (shënim: NASM nuk e përdor fjalën "normale"; teksti shqip thotë "e zakonshme", që pasqyron "often reported during training and typically resolve with rest")

**Pak histori:** null (asnjë burim historik i hapur).

## 2. Front Squat

**Përgatitja** (nasm_squat, hk_austin, stoppani_legs)
- HK, Austin dhe Mann, Powerlifting 2nd ed. (https://us.humankinetics.com/blogs/excerpt/learn-this-foundational-exercise-front-squat) [D, përmbledhje]: "holding the bar in either a clean grip or with the arms crossed"; bërrylat lart (të rrëzuara, shufra rrëshqet); këmbët "about shoulder-width apart, with toes pointed forward or turned out slightly"; "Shrugging the shoulders can create a shelf for the bar."
- Stoppani, Exercises for Bigger, Stronger Legs [D]: "rest the bar across the front delts, keep the chest up and back flat".
- Raft/pina: NASM PDF i squat-it me shufër në shpinë (burimi i vetëm i hapur për raft/pina); teksti e thotë hapur që vjen nga ai PDF dhe jo nga burim për front squat.

**Lëvizja** (hk_austin, ace_front_db, nasm_dbfront)
- HK [D]: "Push the hips back slightly"; kraharori "upright throughout the entire descent"; "Once the crease of the hips goes below the crest of the knee."; gjunjët "in line with the ankles".
- ACE, Front Squat (me dumbbell; faqja e ACE për front squat është vetëm me dumbbell, https://www.acefitness.org/education-and-resources/lifestyle/exercise-library/22/front-squat) [D]: ulja "until your thighs are parallel or nearly parallel to the floor, your heels begin to lift, or your torso starts to round forward"; "Your hips and torso should rise together while your heels stay flat and your knees stay over your second toes."; "Exhale and drive through your heels".
- NASM, Dumbbell Front Squat (https://www.nasm.org/resource-center/exercise-library/dumbbell-front-squat) [D]: "Take a deep breath, brace your core, and initiate the squat by pushing your hips back and bending your knees."; "Stand tall at the top, fully extending your hips and knees." Të dyja faqet janë me dumbbell; përdoren vetëm për parime të përbashkëta (gjunjët, trupi, frymëmarrja), jo për mbajtjen e shufrës.

**Gabimet:** bërrylat që bien: HK [D]; NASM dumbbell [D]: "Allowing the elbows to drop, which causes the dumbbells to fall forward and increases spinal flexion"; "Letting the knees cave inward (valgus)"; "Rounding the upper back instead of maintaining thoracic extension". ACE [D]: "Move your shins forward while keeping your heels down, then bring your torso more upright" "but do so from the hips and not through the low back." (përmbledhje + citat i shkurtër.)

**Këshillat**
- Stoppani [D]: "front squats place a higher proportion of tension on the quads versus the glutes as compared to back squats"; trupi më vertikal "relieves some spinal strain for people with lower back issues" (përmbledhje).
- Gullett 2009 (https://europepmc.org/article/MED/19002072) [V]: "The front squat was as effective as the back squat in terms of overall muscle recruitment, with significantly less compressive forces and extensor moments." dhe "front squats may be advantageous compared with back squats for individuals with knee problems such as meniscus tears".
- **KONTRADIKTË:** Stoppani thotë se front squat-i jep më shumë tension te kuadricepsi relativisht me glutet; Gullett [V]: "bar position did not influence muscle activity" (EMG). Të dyja janë te udhëzuesi, secila me emrin; zgjedhja i mbetet vendimmarrësit.
- HK [D]: "Again, pay special attention to the heels. At this point, they might be able to remain flat on the ground." (teksti i tipit është vetëm kjo fjali).

**Siguria:** NSCA 3.2 (shufra mbi trup, [D] si më sipër); NASM PDF për fillimin me peshë të lehtë; pika e dhimbjes si te Squat.

**Pak histori:** null.

## 3. Leg Press

**Përgatitja dhe lëvizja** (ace_lp, nasm_lp, stoppani_lp)
- ACE, Seated Leg Press (https://www.acefitness.org/resources/everyone/exercise-library/154/seated-leg-press/) [D]: "Slowly exhale while pushing the resistance plate away" (frymëmarrja); "Adjust the seat and foot position so your knees bend to about 90 degrees"; "Exhale as you press the plate away"; "Do not hyperextend (lock-out) your knees."; "Keep your butt on the seat pad and your low back neutral."; "Don't let your upper thighs press into your ribcage on the return."; "Keep your heels pressed into the plate."
- NASM, Leg Press (https://www.nasm.org/resource-center/exercise-library/leg-press) [D]: "Sit on the leg press machine with your back and head firmly against the backrest."; "Position your feet hip-width apart and release the safety bars."; "driving through your feet without locking out your knees"; "avoid jerky or uncontrolled descent"; kujdes: knees collapsing "poor motor control"; "Don't lock out your knees at the top, since that removes tension and stresses the joint."
- Stoppani, Leg Press Master Class (https://www.jimstoppani.com/training/leg-press) [D]: këmbët "around shoulder-width apart"; "come down to where your upper legs and lower legs are at 90 degrees"; "if your butt is coming off the bench" (rrezik për shpinën); kokën në jastëk (rrezik për qafën); "Drive through the heels to reduce knee stress"; këmbët më poshtë = më shumë kuadriceps; "the leg press limits hip extension, so it isn't a glute or hamstring builder."
- **Kontradiktë e vogël:** gjerësia e këmbëve: NASM "hip-width", Stoppani "shoulder-width"; teksti jep "nga gjerësia e ijëve deri te ajo e shpatullave".

**Këshillat**
- Larsen 2025, leg press (https://europepmc.org/article/MED/40113586) [V]: "These findings suggest that both knee flexion ROMs are similarly effective for promoting quadriceps femoris muscle hypertrophy over a relatively short training-period in resistance-trained individuals." (5–100° kundrejt 5–154 ± 7,8°; leg press njëkëmbësh, 23 pjesëmarrës, 8 javë.)
- Kinoshita 2026 (https://europepmc.org/article/MED/41630124) [V]: "LP induces significant hypertrophy in the gluteus maximus and adductor magnus while producing similar vasti and overall QF growth as KE"; "(+7.1% vs +4.9%)" për gjithë QF; gluteus maximus "+15.4%", adductor magnus "+6.2%".
- **KONTRADIKTË:** Stoppani: leg press-i "isn't a glute or hamstring builder" kundrejt Kinoshita 2026: leg press-i rriti gluteus maximus +15,4%. Të dyja janë te udhëzuesi; zgjedhja i mbetet vendimmarrësit. (Kinoshita: të pastërvitur, 12 javë, 70% e 1RM-së, një studim.)

**Siguria:** ACE/Stoppani/NASM si më sipër; pesha e tepërt: Stoppani [D] "Overloading the machine often causes form breakdown"; NASM [D] "Excess weight can cause your knees to collapse inward."

**Pak histori:** null.

## 4. One-Leg Leg Press

- NASM, Single-Leg Press (https://www.nasm.org/resource-center/exercise-library/single-leg-press) [D]: "Put one foot on the platform and move the other off it."; platforma "hip-width apart, with the knee bent near 90 degrees"; "without locking out your knee at full extension"; "Focus on controlled pushing and quadriceps contraction throughout the movement."; "Complete all repetitions on one leg before switching to the other leg."; kujdes: "Failing to address bilateral asymmetries before progressing to heavier loads."; "Descending too far beyond 90 degrees of knee flexion".
- Stoppani, Leg Press Master Class [D, dy fjali të sakta nga WebFetch]: "I find the one-legged leg press to be a slightly safer variation than two legs." dhe "Using the one-legged version is a great way to focus on each leg individually and minimize this issue."; në përmbledhje: "the non-working leg helps anchor the hips to the seat."
- Larsen 2025 (unilateral, [V]) dhe Kinoshita 2026 ("17 untrained adults", [V]; një këmbë LP, tjetra KE): si te Leg Press. Tempo si më sipër; frymëmarrja: ACE [D]: "Slowly exhale while pushing the resistance plate away" (teksti ka vetëm nxjerrjen).
- Kufizim: asnjë studim nuk krahason një këmbë me dy këmbë për hipertrofi te burimet e hapura; "më i sigurt" është vetëm gjykimi i Stoppanit.

**Pak histori:** null.

## 5. Leg Extension

Grady Health Library u hoq (nuk pranohet). Burim i ri i pranuar: Mayo Clinic. Ushtrimi mbetet mbi minimumet (setup 3, steps 2, breathing 2, cues 4, mistakes 3, safety 2).

**Përgatitja, lëvizja, gabimet, siguria** (mayo_le, stoppani_le)
- Mayo Clinic, Knee extension with weight machine (https://www.mayoclinic.org/healthy-lifestyle/fitness/multimedia/knee-extension/vid-20084686) [D, citate nga WebFetch]: "Position the pad on the tops of your ankles."; "Slowly move your lower legs upwards until your knees are nearly straight."; "Then slowly return to the starting position."; "do not lock your knees when they are extended."; "be careful to return all the way to the starting position."; "Shorter movements do not target the quadriceps effectively and can place too much stress on your knees."; "To reduce stress on your knees, move the pad upward, onto your lower legs."; "For most people, one set of 12 to 15 repetitions is adequate."
- **Mospërputhje e brendshme e Mayo:** jastëku "mbi kyçet" (fillim) kundrejt "ngjite mbi pjesën e poshtme të këmbëve për të ulur stresin në gjunjë"; teksti i thotë të dyja si instruksione të Mayo-s.
- Stoppani, Lean On the Leg Extension [D]: "your knee joint is still lined up with the machine's axis of rotation."; "you'll need to scoot your butt forward on the seat to achieve the 40-degree angle."; "only the rectus femoris muscle crosses the hip joint."
- Çdo rresht që mbështetej vetëm te Grady u hoq (jastëku mbi kyçe "jo mbi tibie", mos harko belin, 10–12 përsëritje, mos lër pllakën të pushojë).
- Tempo 2/1 dhe frymëmarrja: vetëm tempo (Wilk, Korakakis); asnjë burim i hapur për frymën.

**Këshillat**
- Stoppani [D]: "leaning back about 40 degrees during leg extensions could be the key to significantly boosting your quad size" kundrejt pozicionit të zakonshëm "at 90 degrees". Teksti e thotë me fjalët e tij; këndi i ijës NUK i atribuohet atij.
- Larsen 2025, hip flexion (https://europepmc.org/article/MED/39699974) [V]: "'extreme' evidence supporting a hypertrophic response favouring the 40° hip angle for the rectus femoris"; "'strong' evidence supporting no difference in hypertrophic response for the vastus lateralis"; "we suggest training with a reduced hip flexion". Këndi i ijës është i Larsen-it (fleksion i ijës 40° kundrejt 90°); teksti i shkruan veç Stoppanin dhe Larsen-in dhe nuk thotë se janë i njëjti kënd.
- Kinoshita 2026 [V]: "Seventeen untrained adults"; "Rectus femoris volume gains were greater for KE than LP (+13.2% vs +1.1%, P ≤ 0.001)"; "KE is essential for effectively targeting the rectus femoris".
- Stoppani, Exercises for Bigger, Stronger Legs [D]: "your toes are angled out to the sides" (për "teardrop"). Pohim i Stoppanit; asnjë studim i hapur nuk e provon.

**Pak histori:** null.

## 6. Standing Calf Raise

**Përgatitja dhe lëvizja** (ace_calf_mach, ace_jo, nasm_calf, ace_calf_bar)
- NASM, Calf Training (Heather Cherry) (https://www.nasm.org/resource-center/blog/training/calf-training-how-to-program-this-stubborn-muscle-group-for-clients) [D, citate nga WebFetch]: gastrocnemius "works best with straight knees"; soleus "takes over when the knee is bent"; "full stretch at the bottom (heels below the toes on an elevated surface)"; "a controlled 2-to-3-second lowering"; pauza poshtë "the single most valuable cue" (heq "Achilles bounce"); "Expect working loads to drop once form improves."
- ACE, Calf Raises (me shufër, https://www.acefitness.org/resources/everyone/exercise-library/51/calf-raises/) [D]: "Press the toes into the ground while lifting the heels up."; "slowly roll the heels back down to the floor"; pauza lart dhe poshtë. **Kujdes:** kjo është varianti me shufër në shpinë, jo makina; u përdor vetëm për lëvizjen e thembrave.
- ACE, Calf Raise (makinë, https://www.acefitness.org/education-and-resources/lifestyle/exercise-library/294/calf-raise) [D]: "Set the weight to a suitable level before you begin"; "Place the ball of each foot on the platform."; "press through the toes as far as possible, keeping legs straight". Kjo makinë ka këmbët drejt përpara (stil leg press), jo në këmbë; përdoret për peshën dhe topin e këmbës.
- ACE, Sabrena Jo, PhD [D]: "Make sure the balls of the feet are securely on top of the step."; thembrat "off the edge"; "lowering and raising the heels off the edge of a step".
- Nuk u gjet burim i hapur për pajisjen e makinës në këmbë (jastëkët e shpatullave); setup-i përmban vetëm çfarë e mbështesin burimet.

**Këshillat**
- Stoppani, Standing Calf Raises for Best Growth (https://jimstoppani.com/training/standing-calf-raises-for-best-growth) [D]: "exhibited more than double the growth compared to its counterpart engaged in seated calf raises" dhe "may be the better of the two choices to maximize calf muscle growth". Faqja është pjesërisht pas pagese; u lexua vetëm pjesa e dukshme. Teksti shqip e thotë "studim japonez" si te faqja; studimi nuk lidhet me emër.
- Kinoshita 2023 (https://europepmc.org/articles/PMC10753835) [V]: "The changes in muscle volume were significantly greater for the standing than seated condition leg in the lateral gastrocnemius (12.4% vs. 1.7%), medial gastrocnemius (9.2% vs. 0.6%), and whole triceps surae (5.6% vs. 2.1%) (p ≤ 0.011), but similar between legs in the soleus (2.1% vs. 2.9%, p = 0.410)." Teksti i plotë [V]: "The LG and MG are biarticular muscles crossing the knee joint, and are lengthened more in a knee-extended than knee-flexed position". 14 të rritur të pastërvitur, një studim.
- Riemann 2011 (https://europepmc.org/article/MED/20581696) [V]: "The ER position prompted significantly greater MG activation than LG during both phases, whereas the IR position elicited significantly greater LG activation than MG." dhe "this study cannot predict whether muscle-activation differences between foot positions will translate into greater training adaptations".
- NASM Red Flags dhe ACSM: si te Squat.

**Pak histori:** null.

## 7. Leg Press Calf Raise

- NASM, Leg Press Calf Raise (https://www.nasm.org/resource-center/exercise-library/leg-press-calf-raise) [D, citate nga WebFetch]: "Sit on the leg press machine with your back and head firmly against the backrest."; "Position your feet hip-width apart and release the safety bars."; "Raise your heels by plantarflexing your ankles, pushing the platform down with your toes."; "Stop just short of full heel contact to maintain continuous muscular tension."; gabime: "Jerky or uncontrolled movements, reducing time under tension"; "Not achieving full range of motion, limiting calf muscle activation".
- ACE, Calf Raise (makinë) [D]: topi i këmbës në platformë, "keeping legs straight", pesha para fillimit.
- Kassiano 2023 (https://europepmc.org/article/MED/37015016) [V]: "INITIAL ROM elicited greater medial gastrocnemius increases than FULL ROM and FINAL ROM (INITIAL ROM = +15.2% vs. FULL ROM = +6.7% and FINAL ROM = +3.4%; p ≤ 0.009)." Kampion: 42 gra të reja, 8 javë, ngritje në makinë leg press horizontale. Lëvizja "initial" = nga -25° deri 0° (kyçi nga i zgjatur deri në 90° me tibien).
- Kinoshita 2023 [V]: si te Standing (fjalia "Këtu: mbaji këmbët të drejta" u hoq, sepse ishte përfundimi im).
- **Mospërputhje:** NASM Leg Press Calf Raise ("Not achieving full range of motion, limiting calf muscle activation") kundrejt Kassiano 2023 (pjesa e zgjatur +15,2% kundrejt +6,7% me lëvizje të plotë). Teksti i thotë të dyja me emrat.
- Stoppani, Exercises for Bigger, Stronger Legs [D]: toes in "the muscle activity of the outer calves was significantly greater than the inner head"; "at least four sets – two sets with your toes pointed in and two sets with toes pointed forward". Faqja bashkon dy artikuj të vjetër; pohimi mbështetet nga Riemann 2011 [V] (por Riemann nuk e përmend kokën "e brendshme" kundrejt "të jashtme" me të njëjtat fjalë; ai flet për MG kundrejt LG).

**Pak histori:** null.

## 8. Seated Calf Raise

- NASM, Calf Training [D]: soleus "takes over when the knee is bent"; "Bent-knee work, such as seated calf raises, targets the soleus" (përmbledhje); "a complete program includes both" (përmbledhje).
- Kinoshita 2023 [V], metoda: "standing/knee-extended versus seated/knee 90°-flexed plantarflexion (calf-raise) training"; rezultati: soleus "(2.1% vs. 2.9%, p = 0.410)" (në këmbë kundrejt ulur); gastrocnemius ulur "(12.4% vs. 1.7%)" anësor dhe "(9.2% vs. 0.6%)" medial.
- ACE, Sabrena Jo [D]: ngritje ulur "Sit on a chair or weight bench with both feet on a step and the heels hanging off of the edge."; "Slowly lower the heels below the edge of the step and then raise them as high as possible."; pesha "across the tops of the thighs" vlen për dumbbell/pllakë; nuk u përdor te setup-i i makinës (asnjë burim për makinën).
- Stoppani, Exercises for Bigger, Stronger Legs [D, përmbledhje]: "Seated calf raises are recommended to 'blast the deeper soleus muscles'" (në seksionin rest-pause/drop set). Videoja e tij e Seated Calf Raise nuk u hap.
- Nuk u gjet burim i hapur për pajisjen e makinës ulur; setup-i përmban vetëm gjunjët 90° (Kinoshita) dhe thembrat jashtë buzës (ACE Jo).

**Pak histori:** null.

## Burimet që nuk u hapën

- YouTube (nuk hapet me WebFetch): videot e Stoppanit për Smith machine standing calf raise (Gti0nc0E2jI), "Maximize Calf Muscle Growth: Why Standing Calf Raises Outperform Seated" (LeHbTzaxV6Q), "How/Why To Do Seated Calf Raise" (--NKtIuvghI), "Squat Biomechanics" (GiJTdjJNgG0), "Lean Back Leg Extensions" (iOc1X_Q0n5M); videot e NASM dhe Squat University. Asnjë pohim nuk mbështetet te to; orkestruesi mund t'i lexojë përshkrimet me shfletues.
- NASM exercise library: faqet "barbell-back-squat", "barbell-front-squat", "leg-extension", "seated-calf-raise", "standing-calf-raise" ktheheshin "client_error" (nuk u hapën). Artikulli NASM "Front Squat or Back Squat" dhe "Full or Partial Back Squat" u ridrejtuan te lista e ushtrimeve (nuk u lexuan).
- ACE, Seated Leg Extension (faqet 183): hapet, por pa udhëzime (vetëm pajisja dhe niveli). Grady Health Library: hapur, por nuk pranohet dhe u hoq.
- NSCA PDF: me curl "Site is not accessible"; u lexua vetëm me WebFetch (përmbledhje).
- PubMed/PMC: nuk u përdorën (abstraktet dolën nga Europe PMC API). Kong, Kipp, Kim 2026 (Back vs. Front Squats, JSCR, PMID 42987186): abstrakt jo i disponueshëm, nuk u përdor.
- Stoppani, Standing Calf Raises for Best Growth: pjesa pas pagese nuk u lexua.

## Pohimet e hequra

- Squat: "Smith machine nuk e zëvendëson squat-in me shufër" (Stoppani) hoqa, sepse nuk lidhet me këtë ushtrim. Ndryshimi i nivelit të shufrës nga kënde konkrete: hoqa, sepse Stoppani jep "a few inches".
- Leg Extension: tempo "deri në dështim, edhe mbi 20 përsëritje" (Stoppani) hoqa, sepse është këshillë programi, jo teknikë; dhe një rekomandim fryme (asnjë burim i hapur).
- Calf raises (të gjitha): frymëmarrja nuk ka burim të hapur (vetëm tempo); setup-i i pajisjes (jastëkët) u hoq sepse nuk ka burim të hapur; "soleusi punon vetëm ulur" u hoq (Kinoshita: soleusi u rrit njësoj në të dyja).
- Leg Press Calf Raise: plani "25–30 përsëritje" (artikulli i Stoppanit 2011 pa nënshkrim, faqja training-research-update-june-10-2011) u hoq, sepse artikulli nuk ka autor.
- Leg Press: "gjunjët nuk shkojnë përtej gishtave" nuk u shkrua (asnjë burim i hapur nuk e mbështet për këtë ushtrim).
- Çdo "Pak histori": hequr (null) për të gjitha tetë ushtrimet.

## Pyetjet e hapura

1. **Emri i `exercise` për squat-in:** brief-i e jepte "Squat (me shufër në shpinë)", por ID-ja e njohur është `Squat`; u përdor `Squat`.
2. **Dy kontradikta që mbetën te udhëzuesi:** (a) Squat: Hartmann (squat i thellë pa rrezik shtesë) kundrejt Escamilla (parallel mbi të thellin); (b) Front Squat: Stoppani (më shumë tension te kuadricepsi) kundrejt Gullett (aktivizim muskulor i njëjtë); (c) Leg Press: Stoppani (nuk ndërton gluteus) kundrejt Kinoshita 2026 (gluteus maximus +15,4%). Kush vendos nëse del vetëm njëra?
3. **Leg Extension, këndi i ijës:** teksti i shkruan veç Stoppanin ("leaning back about 40 degrees") dhe Larsen-in (fleksion ijë 40° kundrejt 90°); nuk pretendon se janë i njëjti kënd.
5. **Heather Cherry (NASM)** është "Content Strategist", jo ekspert i titulluar; burimi është organizata NASM. Pranohet për gastrocnemius kundrejt soleus (të cilën e mbështet edhe Kinoshita)?
6. **ACE Calf Raises** (shufër në shpinë) dhe **ACE Calf Raise** (makinë me këmbë drejt përpara) nuk janë makinat e programit (në këmbë me jastëkë; ulur); u përdorën vetëm për parimet e përbashkëta.
7. **Lartësia e raftit** (ACE "pak nën shpatulla" kundrejt NASM "rreth gjoksit") dhe **këmbët** (ACE kundrejt NASM): dy burime, teksti i bashkon; vendimi te kontrolluesi.
