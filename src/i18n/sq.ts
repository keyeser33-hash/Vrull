import type { Messages, PluralForms } from './translate'

// Katalogu shqip: burimi i çelësave. Çdo çelës i ri shtohet këtu dhe te en.ts (tipet e kërkojnë).
// Çelësat sipas vendit ku shfaqen ('login.title'); termat e fjalorit te 'tab.*' dhe 'term.*'.
// Emrat e ushtrimeve nuk hyjnë këtu: mbeten në anglisht në të dyja gjuhët.

export const sq = {
  // Tab-et dhe termat kryesorë (SPEC §0.3a, GLOSSARY.md).
  'tab.today': 'Sot',
  'tab.programme': 'Programi',
  'tab.food': 'Ushqimi',
  'tab.progress': 'Progresi',
  'tab.body': 'Trupi',
  'tab.friends': 'Miqtë',
  'term.workout': 'Stërvitja',
  'term.session': 'Seanca',
  'term.readiness': 'Gatishmëria',
  'term.hitMacros': 'Plotëso makrot',
  'term.bodyBeat': 'Trupi në ritëm',

  // Korniza dhe veprimet e përbashkëta.
  'shell.mainNav': 'Kryesore',
  'common.close': 'Mbyll',
  'common.cancel': 'Anulo',
  'common.retry': 'Provo përsëri',
  'common.signOut': 'Dil nga llogaria',

  // Figura e trupit (hyrja, Sot).
  'body.front': 'Përpara',
  'body.back': 'Mbrapa',

  // Hyrja.
  'login.tagline': 'Shortcut to Size, peshat dhe ushqimi. Edhe pa internet.',
  'login.title': 'Hyr',
  'login.intro': 'Hyr me llogarinë tënde. Interneti duhet vetëm këtë herë.',
  'login.email': 'Email',
  'login.password': 'Fjalëkalimi',
  'login.showPassword': 'Shfaq fjalëkalimin',
  'login.hidePassword': 'Fshih fjalëkalimin',
  'login.offline': 'Pa internet. Hyrja kërkon internet vetëm herën e parë.',
  'login.submit': 'Hyr',
  'login.busy': 'Po hyn',
  'auth.emailMissing': 'Shkruaj email-in.',
  'auth.passwordMissing': 'Shkruaj fjalëkalimin.',
  'auth.wrongCredentials': 'Email-i ose fjalëkalimi nuk është i saktë.',
  'auth.notConfirmed': 'Llogaria nuk është konfirmuar ende.',
  'auth.tooManyAttempts': 'Shumë përpjekje radhazi. Prit pak minuta dhe provo përsëri.',
  'auth.offline': 'Hyrja kërkon internet. Lidhu dhe provo përsëri.',
  'auth.serverDown': 'Serveri nuk po përgjigjet. Provo përsëri pas pak.',
  'auth.failed': 'Hyrja nuk u krye. Provo përsëri.',

  // Marrja e të dhënave pas hyrjes.
  'fetch.title': 'Po merren të dhënat e tua',
  'fetch.text': 'Nëse e ke përdorur Training Hub më parë, profili dhe historia jote vijnë nga Supabase.',
  'fetch.failedTitle': 'Të dhënat nuk u morën',
  'fetch.failedText':
    'Pas hyrjes duhet internet edhe për këtë hap, që profili dhe historia jote të vijnë nga Supabase. Lidhu dhe provo përsëri.',

  // Gjendja e sinkronizimit (Cilësimet).
  'sync.syncing': 'Po sinkronizohet',
  'sync.never': 'Ende pa sinkronizim',
  'sync.done': 'Sinkronizuar {when}',
  'sync.justNow': 'tani',
  'sync.minutesAgo': 'para {minutes} min',
  'sync.hoursAgo': { one: 'para {count} ore', other: 'para {count} orësh' },
  'sync.on': 'më {date}, {time}',
  'sync.offline': 'Pa internet. Ndryshimet ruhen në telefon dhe dërgohen kur të kthehet rrjeti.',
  'sync.signedOut': 'Hyr në llogari që të dhënat të ruhen edhe në Supabase.',
  'sync.rejected': {
    one: '{count} ndryshim nuk u pranua nga serveri. Mbetet në telefon.',
    other: '{count} ndryshime nuk u pranuan nga serveri. Mbeten në telefon.',
  },
  'sync.failed': 'Sinkronizimi nuk u krye. Provohet përsëri vetë.',
  'sync.pending': { one: '{count} ndryshim pret dërgimin', other: '{count} ndryshime presin dërgimin' },

  // Cilësimet (pjesa e kaluar në katalog; pjesa tjetër me V2-E1-05).
  'settings.title': 'Cilësimet',
  'settings.backToToday': 'Kthehu te Sot',
  'settings.account': 'Llogaria',
  'settings.noAccount': 'Pa llogari',
  'settings.signOut': 'Dil',
  'settings.signOutText': 'Të dhënat mbeten në telefon. Për të hyrë përsëri duhet internet.',
  'settings.signOutPending': 'Ndryshimet që presin dërgohen pasi të hysh.',
  'settings.app': 'App-i',
  'settings.theme': 'Tema',
  'settings.themeHint': 'OLED përdor të zezë të plotë dhe kursen bateri në ekranet OLED.',
  'settings.theme.oled': 'OLED',
  'settings.theme.dark': 'E errët',
  'settings.theme.light': 'E çelët',
  'settings.language': 'Gjuha',
  'settings.languageHint': 'Emrat e ushtrimeve mbeten në anglisht.',
  'settings.restTimer': 'Timer-i i pushimit',
  'settings.batteryUnrestricted': 'Bateria pa kufizime',
  'settings.removeBatteryLimit': 'Hiq kufizimin e baterisë',
} as const satisfies Messages

/** Forma e çdo gjuhe tjetër: çdo çelës i shqipes, tekst ose shumës si te shqipja. */
export type Translation = { readonly [K in keyof typeof sq]: (typeof sq)[K] extends string ? string : PluralForms }
