import type { Messages, TranslationOf } from '../translate'

// Fotot e progresit (SPEC §8; V2-E1-16b): seksioni te Progresi, faqja me të gjitha dhe fleta e fotos.
// Çelësat: 'photos.*'. Pozat (`Pose`): para, anash, mbrapa.
// Një skedar për zonë, që detyrat paralele të mos prekin të njëjtin skedar; sq.ts dhe en.ts i bashkojnë.

export const sq = {
  'photos.title': 'Fotot e progresit',
  'photos.all': 'Të gjitha',
  'photos.pose.front': 'Para',
  'photos.pose.side': 'Anash',
  'photos.pose.back': 'Mbrapa',
  // Te faqja me të gjitha, vendi i një poze që mungon atë ditë.
  'photos.missing.front': 'Pa foto para',
  'photos.missing.side': 'Pa foto anash',
  'photos.missing.back': 'Pa foto mbrapa',
  'photos.latest': 'E fundit: {date}.',
  'photos.hint': 'Në të njëjtin vend dhe dritë çdo herë, që ndryshimi të duket.',
  'photos.none': 'Ende pa foto.',
  // Foto e sinkronizuar nga një telefon tjetër, para se skedari të ngarkohet.
  'photos.waiting': 'Pret ngarkimin nga telefoni tjetër',
  'photos.saving': 'Po ruhet',
  'photos.saveFailed': 'Foto nuk u ruajt. Provo përsëri.',
  'photos.retake': 'Bëj foto të re sot',
  'photos.delete': 'Fshi foton',
  'photos.deleteText': 'Foto fshihet nga ky telefon dhe nga llogaria.',
  'photos.confirmDelete': 'Po, fshije',
} as const satisfies Messages

export const en: TranslationOf<typeof sq> = {
  'photos.title': 'Progress photos',
  'photos.all': 'See all',
  'photos.pose.front': 'Front',
  'photos.pose.side': 'Side',
  'photos.pose.back': 'Back',
  'photos.missing.front': 'No front photo',
  'photos.missing.side': 'No side photo',
  'photos.missing.back': 'No back photo',
  'photos.latest': 'Latest: {date}.',
  'photos.hint': 'Same place and light every time, so the change shows.',
  'photos.none': 'No photos yet.',
  'photos.waiting': 'Waiting for the upload from the other phone',
  'photos.saving': 'Saving',
  'photos.saveFailed': 'The photo wasn’t saved. Try again.',
  'photos.retake': 'Take a new photo today',
  'photos.delete': 'Delete photo',
  'photos.deleteText': 'The photo is deleted from this phone and from your account.',
  'photos.confirmDelete': 'Yes, delete it',
}
