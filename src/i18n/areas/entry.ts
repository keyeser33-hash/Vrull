import type { Messages, TranslationOf } from '../translate'

// Hyrja dhe hapat e parë (V2-E1-17; bordet "Hyrja · Hyr", "Hapja", "Gjuha dhe pesha", "Ditët dhe oraret",
// "Programi"). Çelësat: 'entry.*'; gabimet e hyrjes ('auth.*') mbeten te baza, sepse i jep data/auth.ts.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.
// Shqipja është burimi i çelësave; anglishtja britanike ndjek të njëjtat çelësa dhe parametra.

export const sq = {
  // Hyrja. "Kam një kod ftese" vjen me Etapën 4 (bordi "Hyrja · Ftesa").
  'entry.login.title': 'Mirë se erdhe',
  'entry.login.intro': 'Hyr me emailin dhe fjalëkalimin e llogarisë tënde.',
  'entry.login.email': 'Emaili',
  'entry.login.password': 'Fjalëkalimi',
  'entry.login.showPassword': 'Shfaq fjalëkalimin',
  'entry.login.hidePassword': 'Fshih fjalëkalimin',
  'entry.login.firstTime': 'Hyrja e parë kërkon internet. Pastaj Vrull punon edhe pa të.',
  'entry.login.offline': 'Pa internet tani. Hyrja e parë kërkon internet; pastaj Vrull punon edhe pa të.',
  'entry.login.submit': 'Hyr',
  'entry.login.busy': 'Po hyn',
  'entry.login.inviteOnly': 'Llogaritë hapen vetëm me ftesë nga admini.',

  // Marrja e të dhënave pas hyrjes, para hapave të parë.
  'entry.fetch.tagline': 'Çdo set të çon përpara.',
  'entry.fetch.status': 'Po merren të dhënat e tua',
  'entry.fetch.failedTitle': 'Të dhënat nuk u morën',
  'entry.fetch.failedText':
    'Pas hyrjes, edhe ky hap kërkon internet, që profili dhe historia jote të vijnë në këtë telefon. Lidhu dhe provo përsëri.',

  // Hapat e parë: katër hapa në tri ekrane (ditët dhe oraret janë hapat 2 dhe 3).
  'entry.steps.label': 'Hapat e parë',
  'entry.steps.one': 'Hapi {step} nga {total}',
  'entry.steps.two': 'Hapat {first} dhe {second} nga {total}',
  'entry.continue': 'Vazhdo',
  'entry.saveFailed': 'Ruajtja nuk u krye. Provo përsëri.',

  // Hapi 1: gjuha ndryshon menjëherë tekstet e hapave.
  'entry.language.title': 'Gjuha dhe pesha',
  'entry.weight.hint': 'kg · prek numrin për ta shkruar',
  'entry.weight.note': 'Nga pesha dalin objektivat e ushqimit. Gjuhën dhe peshën i ndryshon kur të duash te Cilësimet.',

  // Hapat 2 dhe 3: ditët (shkronja e parë e çdo dite; emri i plotë për lexuesin e ekranit) dhe oraret.
  'entry.days.title': 'Ditët dhe oraret',
  'entry.days.letter.1': 'H',
  'entry.days.letter.2': 'M',
  'entry.days.letter.3': 'M',
  'entry.days.letter.4': 'E',
  'entry.days.letter.5': 'P',
  'entry.days.letter.6': 'Sh',
  'entry.days.letter.7': 'D',
  'entry.days.match': {
    one: '{count} ditë në javë, sa stërvitjet e {programme}. Stërvitjet ndjekin radhën: një ditë e humbur nuk kapërcen asnjë.',
    other: '{count} ditë në javë, sa stërvitjet e {programme}. Stërvitjet ndjekin radhën: një ditë e humbur nuk kapërcen asnjë.',
  },
  'entry.days.fewer': {
    one: '{count} ditë në javë për {workouts} stërvitje: stërvitjet ndjekin radhën, ndaj programi zgjat më shumë se {weeks} javë.',
    other: '{count} ditë në javë për {workouts} stërvitje: stërvitjet ndjekin radhën, ndaj programi zgjat më shumë se {weeks} javë.',
  },
  'entry.days.more': {
    one: '{count} ditë në javë për {workouts} stërvitje: stërvitjet ndjekin radhën, ndaj programi mbaron para {weeks} javëve.',
    other: '{count} ditë në javë për {workouts} stërvitje: stërvitjet ndjekin radhën, ndaj programi mbaron para {weeks} javëve.',
  },
  'entry.times.start': 'Fillimi',
  'entry.times.startDetail': {
    '=0': 'E njëjta për çdo ditë stërvitjeje. E ndryshon kur të duash te Cilësimet.',
    one: 'Për ditën e stërvitjes. E ndryshon kur të duash te Cilësimet.',
    other: 'E njëjta për të {count} ditët. E ndryshon kur të duash te Cilësimet.',
  },
  'entry.times.wakeSleep': 'Zgjimi dhe gjumi',
  'entry.times.note': 'Nga këto tri orë dalin orari i vakteve dhe rikujtuesit.',
  'entry.times.hint': 'Prek orën për ta shkruar',

  // Hapi 4. Programet e ndara nga miqtë vijnë me Etapën 4; "Ndërto timin" dhe "Importo nga PDF" me E1-10 dhe E1-11.
  // {firstBlock}: blloku i parë sipas gjuhës ("Java 0" / "Week 0"), nga programBlockName (@/i18n/domain).
  'entry.programme.title': 'Zgjidh programin',
  'entry.programme.recommended': 'I rekomanduar për fillestarë',
  'entry.programme.stsMeta': '{weeks} javë + {firstBlock} · {author}',
  'entry.programme.stsText': '{firstBlock} për teknikën, pastaj {phases} faza nga {phaseWeeks} javë, {workouts} stërvitje në javë.',
  'entry.programme.orStartOwn': 'Ose nis vetë',
  'entry.programme.footnote': 'Nis te {firstBlock} · Stërvitja 1. Programin e ndryshon më vonë te Programi.',
  'entry.programme.start': 'Fillo programin',
  'entry.programme.saving': 'Po ruhet',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'entry.login.title': 'Welcome',
  'entry.login.intro': 'Sign in with the email and password of your account.',
  'entry.login.email': 'Email',
  'entry.login.password': 'Password',
  'entry.login.showPassword': 'Show password',
  'entry.login.hidePassword': 'Hide password',
  'entry.login.firstTime': 'The first sign-in needs the internet. After that, Vrull works without it too.',
  'entry.login.offline': 'No internet right now. The first sign-in needs it; after that, Vrull works without it too.',
  'entry.login.submit': 'Sign in',
  'entry.login.busy': 'Signing in',
  'entry.login.inviteOnly': 'Accounts are opened only by invitation from the admin.',

  'entry.fetch.tagline': 'Every set moves you forward.',
  'entry.fetch.status': 'Getting your data',
  'entry.fetch.failedTitle': 'Your data did not arrive',
  'entry.fetch.failedText':
    'After signing in, this step also needs the internet, so that your profile and history can reach this phone. Connect and try again.',

  'entry.steps.label': 'First steps',
  'entry.steps.one': 'Step {step} of {total}',
  'entry.steps.two': 'Steps {first} and {second} of {total}',
  'entry.continue': 'Continue',
  'entry.saveFailed': 'Saving did not work. Try again.',

  'entry.language.title': 'Language and weight',
  'entry.weight.hint': 'kg · tap the number to type it',
  'entry.weight.note': 'Your food targets come from your weight. You can change the language and weight any time in Settings.',

  'entry.days.title': 'Days and times',
  'entry.days.letter.1': 'M',
  'entry.days.letter.2': 'T',
  'entry.days.letter.3': 'W',
  'entry.days.letter.4': 'T',
  'entry.days.letter.5': 'F',
  'entry.days.letter.6': 'S',
  'entry.days.letter.7': 'S',
  'entry.days.match': {
    one: '{count} day a week, as many as the {programme} workouts. Workouts follow the order: a missed day never skips one.',
    other: '{count} days a week, as many as the {programme} workouts. Workouts follow the order: a missed day never skips one.',
  },
  'entry.days.fewer': {
    one: '{count} day a week for {workouts} workouts: workouts follow the order, so the programme takes longer than {weeks} weeks.',
    other: '{count} days a week for {workouts} workouts: workouts follow the order, so the programme takes longer than {weeks} weeks.',
  },
  'entry.days.more': {
    one: '{count} day a week for {workouts} workouts: workouts follow the order, so the programme finishes in under {weeks} weeks.',
    other: '{count} days a week for {workouts} workouts: workouts follow the order, so the programme finishes in under {weeks} weeks.',
  },
  'entry.times.start': 'Start',
  'entry.times.startDetail': {
    '=0': 'The same for every training day. Change it any time in Settings.',
    one: 'For your training day. Change it any time in Settings.',
    other: 'The same for all {count} days. Change it any time in Settings.',
  },
  'entry.times.wakeSleep': 'Wake and sleep',
  'entry.times.note': 'Your meal times and reminders come from these three times.',
  'entry.times.hint': 'Tap the time to type it',

  'entry.programme.title': 'Choose your programme',
  'entry.programme.recommended': 'Recommended for beginners',
  'entry.programme.stsMeta': '{weeks} weeks + {firstBlock} · {author}',
  'entry.programme.stsText': '{firstBlock} for technique, then {phases} phases of {phaseWeeks} weeks, {workouts} workouts a week.',
  'entry.programme.orStartOwn': 'Or start your own',
  'entry.programme.footnote': 'You start at {firstBlock} · Workout 1. You can change the programme later in Programme.',
  'entry.programme.start': 'Start the programme',
  'entry.programme.saving': 'Saving',
}
