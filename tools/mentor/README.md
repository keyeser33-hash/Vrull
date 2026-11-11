# Mentori në Claude

Tekstet e tri detyrave të planifikuara të mentorit (SPEC V55; doc-u i projektit "Training Hub - Paneli në Claude"). Çdo tekst është i plotë: rregullat, pyetja e fiksuar e leximit dhe insert-i te `mentor_notes`. Detyra nuk shkruan SQL tjetër dhe nuk prek asnjë tabelë tjetër.

| Detyra | Skedari | Kur (ora e Tiranës) | Shkruan |
|---|---|---|---|
| Raporti i së hënës | `raporti.txt` | e hënë 09:10 | `raport_javor`, java e mbyllur |
| Plani i javës | `plani.txt` | e diel 18:40 | `plani_javes`, java që vjen |
| Komenti i seancës | `komenti.txt` | çdo ditë 22:50, 23:50, 00:50, 01:50 | `komenti_seances`, seanca e mbyllur në 36 orët e fundit pa koment |

- Krijohen si scheduled tasks në Claude, në cloud, me connector-in Supabase dhe miratim automatik: raporti `trig_01MhvRKhZQE5hyZC8w5uK5sr`, plani `trig_01SFzrm9PpM3wu74GLLjeuag`, komenti `trig_01NLWyoWrtDScKxNLmrs2iLf` (11.11.2026).
- Njoftimi: detyra thërret vetë `PushNotification` vetëm kur shkruan një shënim. Njoftimi i detyrës (`push`) mbetet i ndezur, por në provën 3 nuk arriti.
- Kur ndryshon një tekst këtu, ndryshohet edhe detyra (update_trigger), që të dyja të mbeten njësoj.
- Një detyrë e nisur dy herë nuk shkruan dy herë: indekset unike te `mentor_notes` dhe `on conflict ... do nothing`.
- Numrat (e1RM sipas §7, volumi sipas §11, mesataret) llogariten në SQL; mentori vetëm i lexon.
- Një ndryshim në pyetje provohet më parë me `execute_sql` kundrejt bazës, dhe numrat krahasohen me panelin.
