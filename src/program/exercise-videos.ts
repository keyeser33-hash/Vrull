import { youtubeId } from '@/lib/youtube'
import { SHORTCUT_TO_SIZE } from './shortcut-to-size'

// Videot YouTube të zgjedhura për ushtrimet (SPEC §0.3g, §12), të njëjta për çdo përdorues, prandaj
// vijnë me app-in dhe jo nga baza në cloud. Çelësi është emri i ushtrimit te Shortcut to Size, që
// edhe 16 ushtrimet pa ID në free-exercise-db të kenë videon; ushtrimet e tjera të bibliotekës
// shtohen në valë (V2-E3-24).
// Burimet: organizata ose autorë me titull të verifikueshëm (PhD, CSCS, MD, DPT; §0.3g).
// Çdo video u hap me built-in browser: titulli, kanali dhe kohëzgjatja nga ytInitialPlayerResponse
// (lengthSeconds, si e tregon player-i), luajtja brenda app-it (playableInEmbed) dhe, te kanalet me
// disa prezantues, emri te përshkrimi. Videoja kryesore tregon të njëjtin ushtrim; kur tregon një
// variant (pajisje tjetër, një ose dy krahë), komenti sipër ushtrimit e thotë.

export interface ExerciseVideo {
  /** ID-ja e YouTube (11 shenja). */
  id: string
  /** Titulli si në YouTube. */
  title: string
  /** Kanali si në YouTube. */
  channel: string
  /** Organizata ose autori me titull që e bën videon burim të pranuar. */
  author: string
  seconds: number
  /** Sekonda ku nis demonstrimi. */
  startS: number
  /** Data e kontrollit me shfletues. */
  checked: string
}

export interface ExerciseVideos {
  /** "Shiko videon" te lëvizja dhe te faqja e ushtrimit. */
  main: ExerciseVideo
  /** "Më shumë video", poshtë udhëzuesit (deri në 3). */
  more: ExerciseVideo[]
}

const CHECKED = '2026-11-15'

/** Një burim i pranuar: kanali si në YouTube dhe autori me titull që e bën burim. */
const source =
  (channel: string, author: string) =>
  (id: string, title: string, seconds: number): ExerciseVideo => ({ id, title, channel, author, seconds, startS: 0, checked: CHECKED })

const nasm = source('National Academy of Sports Medicine (NASM)', 'NASM')
const stoppani = source('Jim Stoppani, PhD', 'Jim Stoppani, PhD')
const athleanX = source('ATHLEAN-X™', 'Jeff Cavaliere, MSPT, CSCS')
const squatU = source('Squat University', 'Dr. Aaron Horschig, DPT, CSCS')
const barbellMedicine = source('Barbell Medicine', 'Jordan Feigenbaum, MD')
// Te RP pranohet vetëm videoja ku përshkrimi e emëron Dr. Mike Israetel si prezantues.
const israetel = source('Renaissance Periodization', 'Dr. Mike Israetel, PhD')
// Klinikë fizioterapie, e themeluar nga Mike Reinold, PT, DPT, SCS, ATC, CSCS dhe Lenny Macrina, PT.
const champion = source('Champion Physical Therapy and Performance', 'Champion PT and Performance')
// J2FIT: themeluesi Michael Dewar, M.Ed. në fiziologjinë e ushtrimit (Columbia), CSCS.
const j2fit = source('Mike | J2FIT Strength & Conditioning', 'Michael Dewar, M.Ed., CSCS')
const healthspanMd = source('Robert Todd Hurst, MD, FACC, FASE - HealthspanMD', 'Robert Todd Hurst, MD')

/**
 * Ushtrimet pa video nga një burim i pranuar (kërkimi në YouTube, 15.11.2026): u gjet vetëm videoja
 * e prodhuesit të makinës, që nuk është burim i pranuar. Linku i përdoruesit (§12) vlen edhe për to.
 */
export const WITHOUT_VIDEO = ['Machine Crunch']

export const EXERCISE_VIDEOS: Record<string, ExerciseVideos> = {
  'Bench Press': {
    main: nasm('CayG6UYqL8g', 'How to do a Barbell Bench Press | Proper Form & Technique | NASM', 25),
    more: [
      barbellMedicine('1FWDde2IEPg', 'The Bench Press Prescription: An in-depth guide on how to BENCH!', 1042),
      squatU('8d9kbkAuZGI', 'Stop Losing Strength With These Bench Press Mistakes!', 442),
      squatU('QU-_Du-Zk3I', '5 Tips To Fix Shoulder Pain (BENCH PRESS)', 681),
    ],
  },
  'Incline Bench Press': {
    main: nasm('BjGLs6KGWUc', 'How to do a Incline Barbell Bench Press  | Proper Form & Technique | NASM', 24),
    more: [
      stoppani('VFbjmiAAwJE', 'Quick Tips: Incline Bench Press for better chest activation and less risk of a shoulder injury.', 82),
    ],
  },
  'Incline Dumbbell Press': {
    main: nasm('_NrQUYg7Nlc', 'How to do a Incline Dumbbell Bench Press', 15),
    more: [
      stoppani('WWqBgfF9aH4', 'Tips for Doing Incline Dumbbell Presses', 77),
    ],
  },
  'Reverse-Grip Incline Dumbbell Press': {
    main: stoppani('bxQqbnF30-8', 'Reverse-Grip Incline Dumbbell Press by Jim Stoppani', 125),
    more: [
      stoppani('O0npuvIHVyU', 'Incline Dumbbell Reverse-Grip Press Tips', 107),
    ],
  },
  'Incline Dumbbell Flye': {
    main: stoppani('OOguOwo7rvI', 'Incline Dumbbell Flyes Tip.', 180),
    more: [
      athleanX('6rr5p1jCZC4', 'Stop Doing Chest Flys - I\'m Begging You!!', 437),
    ],
  },
  // videoja kryesore: shtrirë në stol me kabllot poshtë; Champion e bën në këmbë
  'Incline Cable Flye': {
    main: j2fit('qqHFf5zI3us', 'Lying Low Cable Chest Fly | TARGET THE UPPER PECS', 45),
    more: [
      champion('2QTyEBM7zoI', 'Incline Cable Pec Fly', 24),
    ],
  },
  'Dumbbell Flye': {
    main: stoppani('rNBSb6OZJfI', 'Proper Form For Dumbbell Flyes', 194),
    more: [
      stoppani('8yP5eUWKlUc', 'Open Grip Tip for Dumbbell Flyes', 225),
      athleanX('6rr5p1jCZC4', 'Stop Doing Chest Flys - I\'m Begging You!!', 437),
    ],
  },
  'Cable Crossover': {
    main: nasm('XY6JrX1wyxk', 'How to do a Cable Crossover  | Proper Form & Technique | NASM', 23),
    more: [
      stoppani('8QGA0LYiahI', 'How To Do Cable Crossover Properly', 29),
      stoppani('mN5N58gVN1o', 'Open Grip Tip for Cable Crossover', 121),
    ],
  },
  'Close-Grip Bench Press': {
    main: nasm('LJeqLAmJLfs', 'How to do a Close Grip Bench Press  | Proper Form & Technique | NASM', 25),
    more: [
      stoppani('Ruy94BZ6FmE', 'Close-Grip Bench Press Tips by Jim Stoppani', 93),
    ],
  },
  'Triceps Pressdown': {
    main: stoppani('JthKLSzmuP8', 'Quick Tips: Triceps Pressdown', 120),
    more: [
      athleanX('7R88yqmcGrw', 'Which Triceps Pushdown is Best for Your Triceps (IT MATTERS!!)', 360),
      athleanX('REWv05om0ho', 'Stop Doing Tricep Pushdowns Like This!', 316),
    ],
  },
  'Lying Triceps Extension': {
    main: stoppani('_b0IsrjMUDQ', 'How To Do The Lying Triceps Extension Exercise', 142),
    more: [
      athleanX('Fwl0T1_giQ0', 'Stop Doing THIS Triceps Exercise (DO THIS INSTEAD!)', 418),
    ],
  },
  // videoja tregon variantin me shufër EZ; lëvizja është e njëjtë
  'Cable Lying Triceps Extension': {
    main: stoppani('_b0IsrjMUDQ', 'How To Do The Lying Triceps Extension Exercise', 142),
    more: [
      athleanX('Fwl0T1_giQ0', 'Stop Doing THIS Triceps Exercise (DO THIS INSTEAD!)', 418),
    ],
  },
  'Cable Overhead Triceps Extension': {
    main: stoppani('bEDusgF5SGQ', 'Cable Overhead Triceps Extension Tips by Jim Stoppani', 381),
    more: [
      athleanX('Fwl0T1_giQ0', 'Stop Doing THIS Triceps Exercise (DO THIS INSTEAD!)', 418),
    ],
  },
  'Dumbbell Overhead Triceps Extension': {
    main: stoppani('0h0hHCZEqQw', 'Dumbbell Overhead Triceps Tips', 166),
    more: [
      stoppani('41pqsB6ppx0', 'Build Bigger Triceps In LESS TIME! | Dumbbell Overhead Triceps Extension | Dr. Jim Stoppani', 77),
    ],
  },
  // videoja tregon variantin me dy krahë
  'One-Arm Overhead Cable Triceps Extension': {
    main: stoppani('bEDusgF5SGQ', 'Cable Overhead Triceps Extension Tips by Jim Stoppani', 381),
    more: [
      athleanX('Fwl0T1_giQ0', 'Stop Doing THIS Triceps Exercise (DO THIS INSTEAD!)', 418),
    ],
  },
  // videoja tregon variantin te Smith machine
  'Standing Calf Raise': {
    main: stoppani('Gti0nc0E2jI', 'Smith Machine Standing Calf Raise by Jim Stoppani', 54),
    more: [
      stoppani('LeHbTzaxV6Q', 'Maximize Calf Muscle Growth: Why Standing Calf Raises Outperform Seated – Dr. Jim Stoppani Explains', 220),
    ],
  },
  'Leg Press Calf Raise': {
    main: nasm('8k435cj30gc', 'How to do a Leg Press Calf Raise | Proper Form & Technique | NASM', 26),
    more: [],
  },
  'Seated Calf Raise': {
    main: stoppani('--NKtIuvghI', 'How/Why To Do Seated Calf Raise', 30),
    more: [
      stoppani('kxzr_bPqgoU', 'Smith Machine Seated Calf Rasie by Jim Stoppani', 205),
    ],
  },
  'Dumbbell Bent-Over Row': {
    main: nasm('DJfQN6xJL28', 'How to do a Dumbbell Bent Over Row', 15),
    more: [
      stoppani('Bolw1TqZD-U', 'Jim Stoppani Tips - Dumbbell Row', 247),
    ],
  },
  // videoja e bën te stacioni i pulldown-it
  'Seated Cable Row': {
    main: stoppani('3y43C1sZu94', 'How To Do Seated Rows on a Power Rack/Pulldown Station', 163),
    more: [],
  },
  'Wide-Grip Pulldown': {
    main: athleanX('SALxEARiMkw', 'How to do Lat Pulldowns (AVOID MISTAKES!)', 355),
    more: [
      stoppani('-JbIJcqZ2uk', 'Quick Tips: Wide Grip vs Close Grip Pulldown', 80),
      nasm('tbR1YseoouE', 'Which Lat Pull Grip is the Best?', 832),
      stoppani('D1vPFLn1rX4', 'Pulldown Grip Variations', 314),
    ],
  },
  'Behind-Neck Pulldown': {
    main: stoppani('NOZ37M90bSo', 'Behind-the-Neck Pulldown Safety & Tips by Jim Stoppani', 337),
    more: [
      stoppani('o8xU2nkTB9U', 'Lat Pulldowns: In Front vs Behind the Neck', 375),
    ],
  },
  'Reverse-Grip Pulldown': {
    main: stoppani('XSG-0qIq9q8', 'Lat Pulldown Tips: Overhand vs Underhand Grip by Jim Stoppani', 250),
    more: [
      nasm('tbR1YseoouE', 'Which Lat Pull Grip is the Best?', 832),
      stoppani('D1vPFLn1rX4', 'Pulldown Grip Variations', 314),
    ],
  },
  'Standing Pulldown': {
    main: stoppani('HynaSdVSKMw', 'Standing Pulldown: A Great Hybrid Exercise', 173),
    more: [],
  },
  'Straight-Arm Pulldown': {
    main: stoppani('Y0t6N0chYT4', 'Jim Stoppani Tips - Straight arm push down', 350),
    more: [
      stoppani('8in-gdRm5xE', 'Jim\'s Tip of the Day: Straight-Arm Pulldown Position Alternative', 105),
      stoppani('UJSkLGRckr0', 'One-Arm Straight-Arm Pulldown Tip', 240),
    ],
  },
  'Barbell Curl': {
    main: nasm('QciWGMjD-nM', 'How to do a Barbell Biceps Curl', 14),
    more: [
      stoppani('-YIsDosxNX8', 'Jim Stoppani Tips - Barbell Curl', 379),
      stoppani('o2M4cHjk-cA', 'How To Do The Barbell Curl Properly', 30),
    ],
  },
  'Preacher Curl': {
    main: stoppani('vngli9UR6Hw', 'Preacher Curls: Do This for Bigger Biceps | Dr. Jim Stoppani', 95),
    more: [
      nasm('t2BmBSmcjco', 'How to do a Dumbbell Preacher Curl', 17),
    ],
  },
  'Dumbbell Incline Curl': {
    main: nasm('0dT4L6Lsi80', 'How to do a Incline Dumbbell Curl', 18),
    more: [
      athleanX('DCe8f6vMe9A', 'Stop Screwing Up Incline Dumbbell Curls (PROPER FORM!)', 305),
      stoppani('z4K1AgWqwlQ', 'Incline Dumbbell Curl Tip', 57),
      stoppani('2Kl0aUo-e4A', 'Incline Dumbbell Curl Tips: Part 1 - Bench Angle', 64),
    ],
  },
  'Incline Cable Curl': {
    main: stoppani('CxXEXInM_L0', 'Incline Cable Curl by Jim Stoppani', 126),
    more: [],
  },
  // videoja tregon variantin me dy krahë
  'One-Arm High Cable Curl': {
    main: nasm('NuEXzpxehRk', 'How to do Cable Biceps Curls with Shoulder Flexed', 33),
    more: [],
  },
  'Behind-Back Cable Curl': {
    main: stoppani('Df0GjCkUh90', 'Behind-the-Back Cable Curl by Jim Stoppani', 68),
    more: [
      stoppani('bdVFIjxzoCA', 'Behind-The-Back Cable Curl Tips For Bigger Biceps', 410),
      stoppani('605JGtyHTQM', 'Impressive Biceps Peak with the Behind-The-Back Cable Curl | Dr. Jim Stoppani', 134),
    ],
  },
  'Dumbbell Concentration Curl': {
    main: stoppani('sd03XvZXPx4', 'Concentration Curl: Seated vs Standing', 121),
    more: [
      athleanX('ebqgIOiYGEY', 'Concentration Curls Aren\'t Working for You (HERE\'S WHY!)', 515),
    ],
  },
  'Dumbbell Shoulder Press': {
    main: nasm('MMjBnEBnZKM', 'How to do a Dumbbell Overhead Press', 11),
    more: [
      stoppani('BYpJT4i5xKw', 'Build Serious Mass With The Dumbbell Shoulder Press | Dr. Jim Stoppani', 144),
      athleanX('Gu1t7X2yq4M', 'Overhead Shoulder Press (3 MISTAKES!)', 228),
      stoppani('stT5ygQcHok', 'How To Do Dumbbell Shoulder Press Properly', 30),
    ],
  },
  'Dumbbell Lateral Raise': {
    main: nasm('XPPfnSEATJA', 'How to do a Dumbbell Lateral Raise', 18),
    more: [
      israetel('4hTUCDUQaNA', 'The Only Dumbbell Lateral Raise Guide You Need (For Side Delt Growth)', 560),
      stoppani('6m7JO28RqZg', 'Dumbbell Lateral Raise: Exercise Overview', 161),
      athleanX('q5sNYB1Q6aM', 'Rotator Cuff Killer (SHOULDER LATERAL RAISES!)', 478),
    ],
  },
  'One-Arm Cable Lateral Raise': {
    main: stoppani('z9fttixBwzU', 'Jim\'s Tip of the Day: Cable Lateral Raise Tweak', 235),
    more: [
      stoppani('6Y9eoZfzsq0', 'One-Arm Lateral Raise Intensity Booster Tip', 94),
      athleanX('ENsp0DEryrM', 'Which Raise is BEST for Bigger Shoulders (THIS ONE!)', 389),
    ],
  },
  // videoja tregon variantin me shtangë dore
  'One-Arm Cable Front Raise': {
    main: athleanX('T76xu0XjYTk', 'DB Front Raise Done Right (BIGGER FRONT DELTS!)', 205),
    more: [
      athleanX('mPbjfey5yHs', 'The Smartest Way to Grow Bigger Front Delts', 335),
    ],
  },
  'High Cable Rear Delt Fly': {
    main: stoppani('RfDQqZPTzt8', 'Cable Tips to Train Rear Delts', 410),
    more: [
      stoppani('HqMJu2PFrho', 'One-Arm Cable Rear Delt Flye Tip', 241),
      athleanX('dKluhLck1Zs', 'The ONLY 2 Exercises You Need for Rear Delts (NO, SERIOUSLY!)', 209),
    ],
  },
  // te NASM quhet "Bent-Over Dumbbell Rear Fly": i njëjti ushtrim
  'Bent-Over Lateral Raise': {
    main: nasm('kLW7nbw4lcY', 'How to do a Bent-Over Dumbbell Rear Fly', 28),
    more: [
      stoppani('Uqb0Bbw7YKg', 'Tips for Using Dumbbells To Train Rear Delts', 333),
    ],
  },
  'Smith Machine Upright Row': {
    main: stoppani('3FbS1VXvXcA', 'Smith Machine Upright Row', 228),
    more: [
      stoppani('uj1IhDv99fY', 'Smith Machine Upright Rows for Bigger Delts | Dr. Jim Stoppani', 150),
      nasm('CAJHqvpcx4E', 'Upright Row: Yes or No?', 903),
    ],
  },
  'Dumbbell Upright Row': {
    main: stoppani('c3XPGZ1nRe8', 'Dumbbell Upright Row Tips', 182),
    more: [
      stoppani('4FfNcRhl2_M', 'Jim\'s Tip of the Day: Dumbbell Upright Row Tips', 301),
      nasm('CAJHqvpcx4E', 'Upright Row: Yes or No?', 903),
    ],
  },
  'Dumbbell Shrug': {
    main: stoppani('QNWE_G_01m4', 'Do You Make These Mistakes During Shrugs?', 140),
    more: [
      stoppani('UyeCwEW7mbM', 'Everything You Need to Know About Shrugs | Dr. Jim Stoppani', 749),
      athleanX('eqYNJLbxRkk', 'All About Traps (COMPLETE GROWTH GUIDE!)', 659),
    ],
  },
  'Barbell Shrug': {
    main: stoppani('UyeCwEW7mbM', 'Everything You Need to Know About Shrugs | Dr. Jim Stoppani', 749),
    more: [
      stoppani('QNWE_G_01m4', 'Do You Make These Mistakes During Shrugs?', 140),
      athleanX('eqYNJLbxRkk', 'All About Traps (COMPLETE GROWTH GUIDE!)', 659),
    ],
  },
  'One-Arm Smith Machine Shrug': {
    main: stoppani('p-smq_m9prg', 'One-Arm Smith Machine Shrug', 191),
    more: [
      stoppani('0n_Moi9Eg3U', 'One-Arm Smith MachineShrug by Jim Stoppani', 360),
    ],
  },
  'Squat': {
    main: nasm('-bJIpOq-LWk', 'How to do a Barbell Back Squat', 12),
    more: [
      squatU('my0tLDaWyDU', 'How To Squat Correctly (NO BACK PAIN)', 458),
      squatU('QKKXd6celO0', 'STOP Squatting Like This! (5 Mistakes DESTROYING Your Knees & Back)', 326),
      stoppani('GiJTdjJNgG0', 'Squat Biomechanics', 550),
    ],
  },
  'Front Squat': {
    main: nasm('yr_8VuSqhmM', 'How to do a Barbell Front Squat with Clean Position', 11),
    more: [
      squatU('G-Vamqoy8qM', 'How To Front Squat With Perfect Form (Stop Making These Mistakes)', 526),
      squatU('7pyxT5hqmQY', 'How To Front Squat (WAYS TO KEEP YOUR CHEST UP!)', 438),
      squatU('LO79JuUFfvA', 'How to Front Squat WITHOUT Wrist Pain!', 339),
    ],
  },
  'Leg Press': {
    main: nasm('cDGOn-yfKJA', 'How to do a Leg Press  | Proper Form & Technique | NASM', 33),
    more: [],
  },
  'One-Leg Leg Press': {
    main: nasm('3aYsOsBA7ZE', 'How to do a Single Leg Press  | Proper Form & Technique | NASM', 38),
    more: [],
  },
  // videoja tregon variantin me trupin pak mbrapa
  'Leg Extension': {
    main: stoppani('iOc1X_Q0n5M', 'Increase Quadriceps Growth: Lean Back Leg Extensions for Bigger Gains', 257),
    more: [],
  },
  'Romanian Deadlift': {
    main: nasm('xgusDooVfKU', 'How to do a Romanian Deadlift (Barbell) | Proper Form & Technique | NASM', 19),
    more: [
      squatU('5bJEigM5iVg', 'FIX Your RDL Form! (Ultimate Romanian Deadlift Tutorial)', 431),
      stoppani('jKhhHczuxF0', 'Romanian Dedlift vs Stiff-Legged Deadlift by Jim Stoppani', 231),
    ],
  },
  'Lying Leg Curl': {
    main: nasm('lUH80pneL5w', 'How to do a Lying Leg Curl | Proper Form & Technique | NASM', 21),
    more: [
      stoppani('WxNISF4Nnp8', 'Jim Stoppani Tips - Leg Curl', 208),
    ],
  },
  'Seated Leg Curl': {
    main: nasm('_2Kd0d-JEUM', 'How to do a Seated Leg Curl  | Proper Form & Technique | NASM', 25),
    more: [
      stoppani('WxNISF4Nnp8', 'Jim Stoppani Tips - Leg Curl', 208),
    ],
  },
  'Hip Thrust': {
    main: stoppani('yuhDu2CVjko', 'Hip Thrust Tips', 129),
    more: [],
  },
  'Weighted Hip Thrust': {
    main: stoppani('yuhDu2CVjko', 'Hip Thrust Tips', 129),
    more: [],
  },
  'Smith Machine Hip Thrust': {
    main: stoppani('YifOemw7tR4', 'Smith Machine Hip Thrust', 182),
    more: [
      stoppani('8Jxty2y45Pg', 'Jim Stoppani Tips - Smith Machine Hip Thrust', 326),
      stoppani('WInKXaLzHOk', 'Smith Machine Hip Thrust by Jim Stoppani abs', 113),
    ],
  },
  'Crunch': {
    main: stoppani('jdFgmTGW8SY', 'How To Do Crunches For Better Abs!', 26),
    more: [
      athleanX('zkQWXbAP9l0', 'NEVER DO CRUNCHES LIKE THIS | 10 Most Common Mistakes!', 521),
    ],
  },
  'Weighted Crunch': {
    main: stoppani('cbwLMF7oJGI', 'How To Do Weighted Crunch', 136),
    more: [
      athleanX('zkQWXbAP9l0', 'NEVER DO CRUNCHES LIKE THIS | 10 Most Common Mistakes!', 521),
    ],
  },
  'Cable Crunch': {
    main: stoppani('vsAPBAg0fb0', 'Cable Crunch', 193),
    more: [
      stoppani('vFV78ASgsak', 'How to do the Standing Cable Crunch', 212),
    ],
  },
  'Hanging Leg Raise': {
    main: athleanX('Pr1ieGZ5atk', 'Hanging Leg Raise | HOW-TO', 275),
    more: [
      stoppani('7GtFb8yeRrc', 'How to do leg raises properly and progressively', 59),
    ],
  },
  'Plank': {
    main: nasm('mwlp75MS6Rg', 'How to do a Plank | Proper Form & Technique | NASM', 14),
    more: [
      stoppani('M1Yn8oznAjM', 'The Plank: Exercise Overview', 165),
      athleanX('ZyWEXjdAGCQ', 'The TRUTH About Planks (IT’S UGLY!)', 534),
    ],
  },
  'Oblique Crunch': {
    main: healthspanMd('AcvfBd9C2kA', 'Oblique Crunch, How to do the Oblique Crunch exercise || HealthspanMD', 51),
    more: [],
  },
  'Cable Oblique Crunch': {
    main: stoppani('e2-B7iwZm2A', 'Modified Cable Oblique Crunch by Jim Stoppani', 171),
    more: [],
  },
  'Cable Woodchopper': {
    main: champion('0JUSiPgo--A', 'Staggered Stance Cable Chop', 23),
    more: [
      champion('Pt0xzLJMpuw', 'Dynamic Cable Chop', 21),
    ],
  },
  'Band Roundhouse Elbow': {
    main: stoppani('DPnGfvTdbCM', 'Band Roundhouse Elbow by Jim Stoppani', 444),
    more: [],
  },
  // Horschig e krahason me suitcase carry
  'Dumbbell Side Bend': {
    main: squatU('7D96dK6oaP8', 'Core Stability: Side  Bends or Suitcase Carry? |#AskSquatU Show Ep. 47|', 398),
    more: [],
  },
  'Side Plank': {
    main: nasm('44ND4bOB-T0', 'How to do a Side Plank  | Proper Form & Technique | NASM', 16),
    more: [
      athleanX('ZyWEXjdAGCQ', 'The TRUTH About Planks (IT’S UGLY!)', 534),
    ],
  },
}

export interface VideoKey {
  libraryId: string | null
  name: string
}

const BY_LIBRARY_ID = new Map(
  SHORTCUT_TO_SIZE.exercises.flatMap((exercise) => (exercise.libraryId ? [[exercise.libraryId, exercise.id] as const] : [])),
)

/** Videot e zgjedhura të ushtrimit, sipas ID-së së bibliotekës ose emrit; null kur nuk ka. */
export function curatedVideos(exercise: VideoKey): ExerciseVideos | null {
  const id = (exercise.libraryId && BY_LIBRARY_ID.get(exercise.libraryId)) || exercise.name
  return EXERCISE_VIDEOS[id] ?? null
}

/** Videoja që luan "Shiko videon": linku i përdoruesit (§12) zë vendin e të zgjedhurit. */
export function mainVideoId(exercise: VideoKey, userUrl: string | null): string | null {
  return (userUrl ? youtubeId(userUrl) : null) ?? curatedVideos(exercise)?.main.id ?? null
}
