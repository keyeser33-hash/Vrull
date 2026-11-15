import * as achievements from './areas/achievements'
import * as ai from './areas/ai'
import * as body from './areas/body'
import * as builder from './areas/builder'
import * as domain from './areas/domain'
import * as entry from './areas/entry'
import * as food from './areas/food'
import * as history from './areas/history'
import * as lighter from './areas/lighter'
import * as music from './areas/music'
import * as notify from './areas/notify'
import * as photos from './areas/photos'
import * as programme from './areas/programme'
import * as progress from './areas/progress'
import * as readiness from './areas/readiness'
import * as reminders from './areas/reminders'
import * as box from './areas/box'
import * as checkin from './areas/checkin'
import * as daymode from './areas/daymode'
import * as admin from './areas/admin'
import * as session from './areas/session'
import * as today from './areas/today'
import * as sot from './areas/sot'
import * as videos from './areas/videos'
import * as week from './areas/week'
import * as foodday from './areas/foodday'
import * as foodsearch from './areas/foodsearch'
import type { Messages, TranslationOf } from './translate'

// Katalogu shqip: burimi i çelësave. Korniza dhe ekranet e v1 janë këtu (base, me anglishten te en.ts);
// zonat e Etapës 1 kanë skedarin e tyre te areas/, me të dyja gjuhët. Tipet kërkojnë çdo çelës në të dyja.
// Çelësat sipas vendit ku shfaqen ('login.title'); termat e fjalorit te 'tab.*' dhe 'term.*'.
// Emrat e ushtrimeve nuk hyjnë këtu: mbeten në anglisht në të dyja gjuhët.

export const base = {
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

  // Korniza (V2-E1-05) dhe veprimet e përbashkëta.
  'shell.mainNav': 'Kryesore',
  'shell.profile': 'Profili dhe cilësimet',
  'shell.offline': 'Pa internet',
  'shell.offlineSaved': 'Ndryshimet ruhen në telefon',
  'shell.offlinePending': { one: '{count} ndryshim pret sinkronizimin', other: '{count} ndryshime presin sinkronizimin' },
  'notFound.title': 'Kjo faqe nuk ekziston',
  'notFound.text': 'Adresa nuk shkon te asnjë ekran i app-it.',
  'notFound.action': 'Kthehu te Sot',
  'crash.title': 'Diçka nuk shkoi',
  'crash.text': 'Ekrani nuk u hap dot. Rifillo app-in dhe provo përsëri.',
  'crash.action': 'Rifillo',
  'common.close': 'Mbyll',
  'common.cancel': 'Anulo',
  'common.retry': 'Provo përsëri',
  'common.save': 'Ruaj',
  'common.back': 'Mbrapa',
  'common.signOut': 'Dil nga llogaria',

  // Ditët e javës (1 = e hënë), për zgjedhjen e ditëve dhe cilësimet.
  'day.1': 'E hënë',
  'day.2': 'E martë',
  'day.3': 'E mërkurë',
  'day.4': 'E enjte',
  'day.5': 'E premte',
  'day.6': 'E shtunë',
  'day.7': 'E diel',
  'day.short.1': 'Hën',
  'day.short.2': 'Mar',
  'day.short.3': 'Mër',
  'day.short.4': 'Enj',
  'day.short.5': 'Pre',
  'day.short.6': 'Sht',
  'day.short.7': 'Die',
  'form.time.earlier': '{label} {minutes} minuta më herët',
  'form.time.later': '{label} {minutes} minuta më vonë',

  // Miqtë: bosh deri te Etapa 4 (V2-E4).
  'friends.emptyTitle': 'Stërvitu bashkë me miqtë',
  'friends.emptyIntro': 'Me një version të ardhshëm, këtu shfaqen:',
  'friends.invites': 'Ftesat',
  'friends.invitesText': 'Miku hyn me një kod ftese që vlen 7 ditë.',
  'friends.challenges': 'Sfidat',
  'friends.challengesText': 'Javore të gatshme ose të krijuara nga një mik, me renditje.',
  'friends.shared': 'Stërvitjet dhe rekordet',
  'friends.sharedText': 'Miqtë shohin stërvitjet, rekordet dhe vargjet. Pesha, matjet dhe ushqimi mbeten të tuat.',

  // Progresi: tekstet e ekranit janë te areas/progress.ts; kthimi te Progresi nga ekranet brenda tij.
  'body.backToProgress': 'Mbrapa te Progresi',

  // Figura e trupit (hyrja, Sot).
  'body.front': 'Përpara',
  'body.back': 'Mbrapa',

  // Gabimet e hyrjes (data/auth.ts). Tekstet e hyrjes dhe të hapave të parë: areas/entry.ts.
  'auth.emailMissing': 'Shkruaj emailin.',
  'auth.passwordMissing': 'Shkruaj fjalëkalimin.',
  'auth.wrongCredentials': 'Emaili ose fjalëkalimi nuk është i saktë.',
  'auth.notConfirmed': 'Llogaria nuk është konfirmuar ende.',
  'auth.tooManyAttempts': 'Shumë përpjekje radhazi. Prit pak minuta dhe provo përsëri.',
  'auth.offline': 'Hyrja kërkon internet. Lidhu dhe provo përsëri.',
  'auth.serverDown': 'Serveri nuk po përgjigjet. Provo përsëri pas pak.',
  'auth.failed': 'Hyrja nuk u krye. Provo përsëri.',

  // Gjendja e sinkronizimit (Cilësimet).
  'sync.syncing': 'Po sinkronizohet',
  'sync.never': 'Ende pa sinkronizim',
  'sync.justNow': 'tani',
  'sync.minutesAgo': 'para {minutes} min',
  'sync.hoursAgo': { one: 'para {count} ore', other: 'para {count} orësh' },
  'sync.on': 'më {date}, {time}',
  'sync.signedOut': 'Hyr në llogari që të dhënat të ruhen edhe në Supabase.',
  'sync.rejected': {
    one: '{count} ndryshim nuk u pranua nga serveri. Mbetet në telefon.',
    other: '{count} ndryshime nuk u pranuan nga serveri. Mbeten në telefon.',
  },
  'sync.failed': 'Sinkronizimi nuk u krye. Provohet përsëri vetë.',
  'sync.pending': { one: '{count} ndryshim pret dërgimin', other: '{count} ndryshime presin dërgimin' },

  // Gjendja e sinkronizimit në një rresht (Cilësimet › Sinkronizimi).
  'sync.okTitle': 'I sinkronizuar',
  'sync.offlineDetail': 'Ndryshimet ruhen në telefon dhe dërgohen kur të kthehet rrjeti.',
  'sync.errorTitle': 'Nuk u sinkronizua',
  'sync.signedOutTitle': 'Pa llogari',

  // Cilësimet (bordi "Cilësimet"; seksionet e etapave të tjera mungojnë deri atëherë).
  'settings.title': 'Cilësimet',
  'settings.profile': 'Profili',
  'settings.weightToday': 'Pesha sot',
  'settings.noWeight': 'Pa peshë',
  'settings.trainingDays': 'Ditët e stërvitjes',
  'settings.schedule': 'Oraret',
  'settings.scheduleDetail': '{training} · zgjimi {wake} · gjumi {sleep}',
  'settings.appearance': 'Pamja',
  'settings.theme': 'Tema',
  'settings.theme.oled': 'OLED',
  'settings.theme.dark': 'Natë',
  'settings.theme.light': 'Ditë',
  'settings.background': 'Sfondi',
  'settings.background.solid': 'I plotë',
  'settings.background.speed_lines': 'Vija shpejtësie',
  'settings.language': 'Gjuha',
  'settings.languageHint': 'Emrat e ushtrimeve mbeten në anglisht.',
  'settings.notifications': 'Njoftimet',
  'settings.reminders': 'Rikujtuesit',
  'settings.remindersOff': 'Të gjithë të fikur',
  'settings.restTimer': 'Timer-i i pushimit',
  'settings.batteryUnrestricted': 'Bateria pa kufizime',
  'settings.removeBatteryLimit': 'Hiq kufizimin e baterisë',
  'settings.sync': 'Sinkronizimi',
  'settings.syncNow': 'Sinkronizo tani',
  'settings.export': 'Eksporto të dhënat',
  'settings.exporting': 'Po përgatitet',
  'settings.exportHint': 'Kopja JSON përmban çdo tabelë, pa fotot. Ruaje diku jashtë telefonit.',
  'settings.exportFailed': 'Eksporti nuk u krye. Provo përsëri.',
  'settings.version': 'Versioni',
  'settings.appVersion': 'Vrull {version}',
  'settings.checksItself': 'Kontrollohet vetë',
  'settings.sources': 'Burimet dhe licencat',
  'settings.signOut': 'Dil',
  'settings.signOutNote': 'Dalja nuk fshin të dhënat në telefon.',
  'settings.signOutText': 'Të dhënat mbeten në telefon. Për të hyrë përsëri duhet internet.',
  'settings.signOutPending': 'Ndryshimet që presin dërgohen pasi të hysh.',
  'settings.backToSettings': 'Mbrapa te Cilësimet',

  // Profili te Cilësimet: fletët e peshës, ditëve dhe orareve.
  'profile.weight': 'Pesha',
  'profile.weightSaved': 'Ruhet si matja e sotme. Historia e peshës shfaqet te Progresi.',
  'profile.weightInvalid': 'Shkruaj një peshë mes 30 dhe 300 kg, p.sh. 80,5.',
  'profile.daysInvalid': 'Zgjidh të paktën një ditë stërvitjeje.',
  'profile.daysHint': 'Radha e programit nuk ndryshon: ecën kur mbyll një stërvitje.',
  'profile.trainingTime': 'Ora e stërvitjes',
  'profile.wake': 'Zgjimi',
  'profile.sleep': 'Gjumi',
  'profile.saveFailed': 'Ndryshimi nuk u ruajt. Provo përsëri.',

  // Pamja (bordi "Pamja"): tema, sfondi, gjuha. "Pamja ndjek gjendjen" vjen me Etapën 3.
  'appearance.themeHint': 'OLED: e zeza e plotë. Natë: më e butë. Ditë: e çelët.',
  'appearance.backgroundHint': 'Të dyja punojnë me çdo temë. Vijat shfaqen vetëm në sfond, kurrë pas tekstit.',

  // Rikujtuesit (SPEC §13): Cilësimet › Rikujtuesit dhe njoftimet, te areas/reminders.ts.

  // Burimet dhe licencat (SPEC §11, §9).
  'sources.program.use': 'Programi 12-javor, ushqimi dhe suplementet e ditës shembull.',
  'sources.program.license': 'Jim Stoppani, Bodybuilding.com. Për përdorim personal.',
  'sources.anatomy.use': 'Modeli 3D i muskujve te Trupi, i thjeshtuar për telefonin.',
  'sources.anatomy.license':
    'BodyParts3D, (c) The Database Center for Life Science, CC BY 4.0 (versioni 4.0). Latissimus dorsi dhe rectus abdominis vijnë nga versioni 3.0, CC BY-SA 2.1 Japan, prandaj modeli i app-it shpërndahet me CC BY-SA 2.1 Japan.',
  'sources.exercises.use': 'Biblioteka e ushtrimeve me muskujt kryesorë e ndihmës, dhe fotot e ushtrimeve.',
  'sources.exercises.license': 'yuhonas/free-exercise-db, Unlicense (domain publik).',
  'sources.off.use': 'Produktet me barkod dhe vlerat e tyre ushqyese.',
  'sources.off.license': 'Të dhënat nën Open Database License (ODbL), (c) kontribuesit e Open Food Facts.',
  'sources.usda.use': 'Ushqimet e përgjithshme dhe makrot e shabllonit të Jimit.',
  'sources.usda.license': 'U.S. Department of Agriculture, Agricultural Research Service. Domain publik (CC0 1.0).',
  'sources.fonts.use': 'Shkronjat e app-it.',
  'sources.fonts.license': 'Jeremy Tribby, SIL Open Font License 1.1.',

  // Përditësimi brenda app-it (SPEC §3b; bordi "Përditësimi").
  'update.title': 'Përditësimi',
  'update.versionTitle': 'Versioni {version}',
  'update.ready': 'Versioni {version} është gati',
  'update.readyShort': '{version} është gati',
  'update.summary': 'Ke {current}. Shkarkimi: {size}.',
  'update.youHave': 'Ke {version}.',
  'update.current': 'Ke versionin e fundit, {version}.',
  'update.whatsNew': 'Çfarë ka të re',
  'update.howItWorks': 'Si shkon',
  'update.stepDownload': 'Shkarkimi',
  'update.stepDownloadIdle': 'Nis kur prek Përditëso',
  'update.stepDownloadDone': 'Shkarkuar',
  'update.stepPermission': 'Leja e Android-it · vetëm herën e parë',
  'update.stepPermissionText': 'Android-i hap "Instalo app të panjohura". Aktivizo "Lejo nga ky burim" dhe kthehu këtu.',
  'update.stepInstall': 'Instalimi',
  'update.stepInstallText': 'Në Android 12 e lart pa dritare konfirmimi. App-i mbyllet për pak dhe rihapet nga njoftimi i përditësimit. Të dhënat mbeten.',
  'update.update': 'Përditëso',
  'update.allowInstall': 'Lejo instalimin',
  'update.installing': 'Po instalohet. App-i mbyllet për pak; hape përsëri nga njoftimi i përditësimit.',
  'update.checkNow': 'Kontrollo tani',
  'update.of': '{done} nga {total}',
  'update.detail.available': 'Shiko çfarë ka të re',
  'update.detail.permission': 'Lejo instalimin nga app-i',
  'update.detail.downloading': 'Po shkarkohet · {percent}',
  'update.detail.installing': 'Po instalohet',
  'update.detail.failed': 'Përditësimi nuk u krye',
  'update.detail.checking': 'Po kontrollohet',
  'update.detail.current': 'I fundit',
  'update.failure.check': 'Kontrolli nuk u krye. Shiko internetin dhe provo përsëri.',
  'update.failure.download': 'Shkarkimi nuk u krye. Shiko internetin dhe provo përsëri.',
  'update.failure.mismatch': 'Skedari i shkarkuar nuk përputhet me versionin, ndaj nuk u instalua. Provo përsëri.',
  'update.failure.install': 'Android-i nuk e instaloi përditësimin. Provo përsëri.',

  // Komponentët e sistemit Vrull (src/components/ui).
  'ui.ai': 'Shpjeguar nga AI',
  'ui.stepper.summary': { one: '{weight} kg, {count} përsëritje', other: '{weight} kg, {count} përsëritje' },
  'ui.stepper.labelled': '{label}: {summary}',
  'ui.stepper.repsUnit': { one: 'përsëritje', other: 'përsëritje' },
  'ui.stepper.lowerWeight': 'Ul peshën me {step} kg',
  'ui.stepper.raiseWeight': 'Rrit peshën me {step} kg',
  'ui.stepper.lowerReps': 'Ul përsëritjet',
  'ui.stepper.raiseReps': 'Rrit përsëritjet',
  'ui.stepper.editWeight': 'Shkruaj peshën, {weight} kg',
  'ui.stepper.editReps': 'Shkruaj përsëritjet, {reps}',
  'ui.rir.legend': 'Sa të kishin mbetur (RIR)',
  'ui.rir.orMore': '{value} ose më shumë',
  'ui.fact.title': 'A e dije?',
  'ui.fact.source': 'Burimi: {source}',
  'ui.fact.more': 'Më shumë',
  'ui.fact.next': 'Tjetër',
  'ui.progress.spoken': '{label} {value} nga {target} {unit}',
  'ui.progress.spokenOver': '{label} {value} nga {target} {unit}, mbi objektiv',
  'ui.progress.over': 'mbi objektiv',
  'ui.week.label': 'Java',
  'ui.week.today': 'Sot, {day}',
  'ui.week.done': '{day}, e bërë',
  'ui.week.rest': '{day}, pushim',
  'ui.week.planned': '{day}, stërvitje',
  'ui.week.next': '{day}, stërvitja e radhës',
  'ui.week.missed': '{day}, e humbur',
  'ui.week.legend.done': 'E bërë',
  'ui.week.legend.missed': 'E humbur',
  'ui.week.legend.planned': 'Stërvitje',
  'ui.week.legend.rest': 'Pushim',
  'ui.quickAdd.title': 'Shto shpejt',
  'ui.quickAdd.label': 'Me fjalë: shkruaj çfarë hëngre',
  'ui.quickAdd.placeholder': 'p.sh. 2 vezë dhe një fetë bukë',
  'ui.quickAdd.photo': 'Foto e pjatës',
  'ui.quickAdd.barcode': 'Skano barkodin',
  'ui.quickAdd.aiLimit': 'Kufiri i këtij muaji u arrit',
} as const satisfies Messages

/** Zonat me skedarin e tyre (src/i18n/areas): çdo çelës jeton në një pjesë të vetme (catalog.test.ts). */
export const AREAS = { today, sot, session, programme, body, history, entry, domain, builder, videos, ai, music, notify, food, photos, progress, reminders, box, admin, achievements, week, checkin, readiness, lighter, daymode, foodday, foodsearch }

export const sq = {
  ...base,
  ...today.sq,
  ...sot.sq,
  ...session.sq,
  ...programme.sq,
  ...body.sq,
  ...history.sq,
  ...entry.sq,
  ...domain.sq,
  ...builder.sq,
  ...videos.sq,
  ...ai.sq,
  ...music.sq,
  ...notify.sq,
  ...food.sq,
  ...photos.sq,
  ...progress.sq,
  ...reminders.sq,
  ...box.sq,
  ...admin.sq,
  ...achievements.sq,
  ...week.sq,
  ...checkin.sq,
  ...readiness.sq,
  ...lighter.sq,
  ...daymode.sq,
  ...foodday.sq,
  ...foodsearch.sq,
} as const satisfies Messages

/** Forma e çdo gjuhe tjetër: çdo çelës i shqipes, tekst ose shumës si te shqipja. */
export type Translation = TranslationOf<typeof sq>
