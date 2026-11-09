// Ikonat e sistemit Vrull (rrjet 24 px, vijë 2 px, cepa të rrumbullakëta), nga parapamjet e
// komponentëve të sistemit të dizajnit: tab-bar-i, shtimi i ushqimit dhe karta e rekordit.
export const VRULL_ICONS = {
  sot: '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  programi: '<path d="M4 9v6M20 9v6M7 7v10M17 7v10M7 12h10"/>',
  pjata: '<circle cx="11" cy="13" r="7"/><path d="M18 4v16M15 4v5h6V4"/>',
  progresi: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  miqte: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20v-3a6 6 0 0 1 12 0v3M15 20v-2a4 4 0 0 1 6-3.5"/>',
  kamera: '<rect x="3" y="7" width="18" height="13" rx="3"/><circle cx="12" cy="13.5" r="3.5"/><path d="M9 7l1.5-3h3L15 7"/>',
  'barkodi-vija': '<path d="M4 6v12M8 6v12M11 6v12M15 6v12M19 6v12"/>',
  kupa: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/>',
  // Korniza dhe cilësimet (bordet "Cilësimet", "Pamja", "Përditësimi", "Pa internet").
  mbrapa: '<path d="M15 5l-7 7 7 7"/>',
  hap: '<path d="M9 6l6 6-6 6"/>',
  zgjedhur: '<path d="M5 12l5 5L20 7"/>',
  'mbyll-vrull': '<path d="M6 6l12 12M18 6L6 18"/>',
  'shkarko-vrull': '<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/>',
  // Trupi 3D (V2-E1-14): shtresat, matja me shirit, rrotullimi i modelit, data, hapja e një seksioni.
  shtresat: '<path d="M12 4l8 4-8 4-8-4z"/><path d="M4 12l8 4 8-4M4 16l8 4 8-4"/>',
  matja: '<rect x="3" y="8" width="18" height="8" rx="2"/><path d="M7 8v3M11 8v4M15 8v3M19 8v4"/>',
  rrotullo: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4h4"/>',
  kalendari: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  poshte: '<path d="M6 9l6 6 6-6"/>',
  'pa-internet':
    '<path d="M3 3l18 18"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 4.3-2.6"/><path d="M19 12.9a10 10 0 0 0-2.2-1.6"/><path d="M2 9.3a15 15 0 0 1 4-2.6"/><path d="M22 9.3A15 15 0 0 0 11 5.1"/><path d="M12 20h.01"/>',
  // Seanca (bordet "Seanca" dhe "Ushtrimet"): lista e ushtrimeve, muskujt e ushtrimit, ndërrimi.
  muskujt: '<circle cx="12" cy="6" r="3"/><path d="M6 21v-6a6 6 0 0 1 12 0v6"/>',
  nderro: '<path d="M7 4L3 8l4 4"/><path d="M3 8h14"/><path d="M17 12l4 4-4 4"/><path d="M21 16H7"/>',
  // Programi, ushtrimi, biblioteka dhe peshat e javës (bordet "Prog-*", V2-E1-09).
  libri: '<path d="M5 5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2z"/><path d="M5 20a2 2 0 0 0 2 1h12v-3"/>',
  laps: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  kerko: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  video: '<rect x="3" y="5" width="18" height="14" rx="4"/><path d="M10 9l5 3-5 3z"/>',
  jashte: '<path d="M14 5h5v5M19 5l-8 8M18 14v5H5V6h5"/>',
  rritje: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  'kamera-foto': '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  // Ndërtuesi i programeve (bordet "Ndërto", "Dita", "Sloti", "Hyrja · Programi").
  doreza: '<path d="M6 9h12M6 15h12"/>',
  'me-shume': '<circle cx="5" cy="12" r="1" class="ac"/><circle cx="12" cy="12" r="1" class="ac"/><circle cx="19" cy="12" r="1" class="ac"/>',
  nderto: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M17.5 14v7M14 17.5h7"/>',
  // Videot e formës (bordet "Seanca" dhe "Seanca · Video", V2-E1-13).
  'kamera-video': '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  'kamera-kthe': '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 20v-4h-4"/>',
  luaj: '<path d="M8 5.5v13l10.5-6.5z"/>',
  kyc: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  // Importi nga PDF dhe Cilësimet › AI (bordet "Importo nga PDF", "Cilësimet · AI", V2-E1-11).
  skedari: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  pyetje: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14"/><path d="M12 17.5h.01"/>',
  // Kutia e AI-së (bordet "0.22 · AI dhe ushqimi i shpejtë"): shkëndija e AI-së dhe dërgimi.
  shkendija: '<path d="M12 3l2 7 7 2-7 2-2 7-2-7-7-2 7-2z"/>',
  dergo: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  // Të preferuarat te vakti (bordi V22-Vakti-Shpejt): pa mbushje; i zgjedhuri merr ngjyrën ember-text.
  yll: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
  // Muzika "Trupi në ritëm" (bordet "Muzika · *", V2-E1-12).
  pauze: '<path d="M9 5v14M15 5v14"/>',
  'kenga-para': '<path d="M6 6l9 6-9 6V6zM18 6v12"/>',
  'kenga-mbrapa': '<path d="M18 6L9 12l9 6V6zM6 6v12"/>',
  metronomi: '<path d="M7 21h10L14 3h-4L7 21z"/><path d="M12 16l5-8"/>',
  muzika: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  vale: '<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>',
} as const
