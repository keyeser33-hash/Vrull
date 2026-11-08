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
  'pa-internet':
    '<path d="M3 3l18 18"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 4.3-2.6"/><path d="M19 12.9a10 10 0 0 0-2.2-1.6"/><path d="M2 9.3a15 15 0 0 1 4-2.6"/><path d="M22 9.3A15 15 0 0 0 11 5.1"/><path d="M12 20h.01"/>',
} as const
