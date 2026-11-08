import type { Messages, TranslationOf } from '../translate'

// Videot e formës (V2-E1-13; bordi "Seanca · Video"). Çelësat: 'videos.*'.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.
// Shqipja është burimi i çelësave; anglishtja britanike ndjek të njëjtat çelësa dhe parametra.

export const sq = {
  // Ekrani i kamerës nga seanca.
  'videos.title': 'Video e formës',
  'videos.close': 'Mbyll kamerën',
  'videos.switch': 'Ndërro kamerën',
  'videos.camera': 'Pamja e kamerës',
  'videos.cameraLabel': 'Kamera',
  'videos.cameraHint': 'Vendose telefonin anash, që të shihet gjithë lëvizja.',
  'videos.exerciseSet': '{exercise} · Seti {set}',
  'videos.recorded': 'Regjistruar {duration}',
  'videos.recording': '{duration} / {limit}',
  'videos.recordingLabel': 'Regjistron: {duration} nga {limit}',
  'videos.record': 'Regjistro',
  'videos.stop': 'Ndalo regjistrimin',
  'videos.recordAgain': 'Regjistro përsëri',
  'videos.limitReached': 'U ndal te {limit}, gjatësia më e madhe e një videoje.',
  'videos.compare': 'Krahasimi me herën e kaluar',
  'videos.today': 'Sot',
  'videos.daySet': '{date} · Seti {set}',
  'videos.play': 'Luaj videon: {label}',
  'videos.noTake': 'Ende pa video',
  'videos.noPrevious': 'Herën e kaluar pa video',
  'videos.private': 'Private: vetëm ti i sheh. Ruhen në telefon dhe në cloud.',
  'videos.save': 'Ruaj te seti {set}',
  'videos.denied': 'Vrull nuk e hap dot kamerën. Lejo kamerën për Vrull te cilësimet e telefonit dhe provo përsëri.',
  'videos.unavailable': 'Kamera nuk u hap. Mbyll app-et e tjera që e përdorin dhe provo përsëri.',
  'videos.unsupported': 'Ky telefon nuk regjistron dot video brenda app-it.',
  'videos.tooBig': 'Videoja kalon {limit}. Regjistroje më shkurt.',
  'videos.saveFailed': 'Videoja nuk u ruajt. Provo përsëri.',
  // Hapësira e planit falas (V27).
  'videos.storageNear':
    'Fotot dhe videot zënë {used} nga {quota} e planit falas të Supabase-it. Fshi videot e vjetra te faqja e ushtrimit, ose kalo në planin me pagesë.',
  'videos.storageFull':
    'Fotot dhe videot zënë {used}, mbi {quota} e planit falas të Supabase-it, që mund ta kufizojë sinkronizimin. Fshi videot e vjetra te faqja e ushtrimit, ose kalo në planin me pagesë.',

  // Faqja e ushtrimit dhe luajtja.
  'videos.section': 'Videot e formës',
  'videos.showAll': 'Të gjitha ({count})',
  'videos.delete': 'Fshi videon',
  'videos.deleteConfirm': 'Po, fshije',
  'videos.deleteQuestion': 'Videoja fshihet nga telefoni dhe nga cloud-i.',
  'videos.waiting': 'Videoja ende nuk është ngarkuar nga telefoni tjetër.',
  'videos.offline': 'Pa internet: videoja shkarkohet kur të kthehet rrjeti.',
  'videos.loading': 'Po hapet videoja',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'videos.title': 'Form video',
  'videos.close': 'Close camera',
  'videos.switch': 'Switch camera',
  'videos.camera': 'Camera view',
  'videos.cameraLabel': 'Camera',
  'videos.cameraHint': 'Prop the phone to one side so the whole movement is in view.',
  'videos.exerciseSet': '{exercise} · Set {set}',
  'videos.recorded': 'Recorded {duration}',
  'videos.recording': '{duration} / {limit}',
  'videos.recordingLabel': 'Recording: {duration} of {limit}',
  'videos.record': 'Record',
  'videos.stop': 'Stop recording',
  'videos.recordAgain': 'Record again',
  'videos.limitReached': 'Stopped at {limit}, the longest a video can be.',
  'videos.compare': 'Compared with last time',
  'videos.today': 'Today',
  'videos.daySet': '{date} · Set {set}',
  'videos.play': 'Play video: {label}',
  'videos.noTake': 'No video yet',
  'videos.noPrevious': 'No video last time',
  'videos.private': 'Private: only you can see them. Kept on your phone and in the cloud.',
  'videos.save': 'Save to set {set}',
  'videos.denied': "Vrull can't open the camera. Allow camera access for Vrull in your phone's settings and try again.",
  'videos.unavailable': "The camera didn't open. Close any other app using it and try again.",
  'videos.unsupported': "This phone can't record video inside the app.",
  'videos.tooBig': 'The video is over {limit}. Record a shorter one.',
  'videos.saveFailed': "The video wasn't saved. Try again.",
  'videos.storageNear':
    'Photos and videos take up {used} of the {quota} on the free Supabase plan. Delete old videos on the exercise page, or move to the paid plan.',
  'videos.storageFull':
    'Photos and videos take up {used}, over the {quota} on the free Supabase plan, which may restrict syncing. Delete old videos on the exercise page, or move to the paid plan.',

  'videos.section': 'Form videos',
  'videos.showAll': 'Show all ({count})',
  'videos.delete': 'Delete video',
  'videos.deleteConfirm': 'Yes, delete it',
  'videos.deleteQuestion': 'The video is deleted from your phone and from the cloud.',
  'videos.waiting': "This video hasn't been uploaded from your other phone yet.",
  'videos.offline': "Offline: the video downloads when you're back online.",
  'videos.loading': 'Opening the video',
}
