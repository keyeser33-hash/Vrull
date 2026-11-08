# Muzika: kontrolli i app-it të muzikës dhe burimi i tempos

Spike V2-E1-03 për V29 "Trupi në ritëm" (SPEC §0.2). Data: 08.11.2026. Burimet u lexuan po atë ditë; çdo burim ka lidhjen te "Burimet" në fund. Eksperimenti native (`MusicPlugin`) u ndërtua me Gradle-in e projektit, por nuk u provua në pajisje: këtu nuk ka telefon dhe emulatori i CI-së nuk u nis.

Shenjat: **Fakt** do të thotë që e thotë burimi i cituar ose e pamë vetë në provë; **Përfundim** është arsyetimi ynë nga faktet; **Rekomandim** është propozimi për E1-12.

## Përmbledhja

1. **Leja dhe leximi.** Me "Qasjen te njoftimet" Vrull merr sesionet e medias së çdo app-i muzike: titullin, artistin, albumin, kohëzgjatjen, kopertinën, gjendjen, pozicionin dhe shpejtësinë, pa pyetur vazhdimisht. Te APK-ja e shkarkuar nga një lidhje, Android 13+ e bllokon këtë leje derisa përdoruesi të zgjedhë "Allow restricted settings" te "Info e app-it". Kjo vlen për përdoruesin dhe për miqtë.
2. **Kontrollet.** Play, pauza, para, mbrapa dhe pozicioni punojnë kur app-i i muzikës i shpall te `PlaybackState.getActions()`. Çdo komandë është kërkesë, dhe app-i vendos nëse e zbaton.
3. **Radha.** Android-i e jep radhën vetëm kur app-i i muzikës e vendos te sesioni. Për YouTube Music ka gjurmë që e vendos (ora Pixel tregon 24 këngët e radhës), për Spotify nuk gjetëm asnjë dëshmi, dhe broadcast-i zyrtar i Spotify-t për radhën nuk mbart asnjë këngë. Asnjë app i jashtëm nuk e rirendit radhën e tjetrit. Nxjerrja përpara e "këngës së setit" pa prekje nuk mund të premtohet.
4. **Rruga e Spotify-t nuk ia vlen.** Web API e Spotify-t e jep radhën dhe shton këngë në të, por kërkon Premium (edhe pronari i app-it), lejon 5 përdorues në Development Mode, ka hequr tempon (audio features) për app-et e reja, dhe Developer Policy ndalon lidhjen me përmbajtje të një shërbimi tjetër dhe sinkronizimin e regjistrimeve me pamje.
5. **Tempo.** GetSongBPM (falas, me çelës dhe me lidhje të detyrueshme te GetSongBPM.com) mbulon këngët e reja. AcousticBrainz (CC0, i ngrirë më 2022) mbulon të vjetrat pa çelës. Deezer e ka fushën `bpm`, por kushtet e lejojnë vetëm për përdorim privat familjar dhe pa markë. "Prek ritmin" mbetet rezerva.
6. **Bateria.** Pulsi duhet të jetë ndërrim CSS i dy pamjeve të renderuara një herë, pa WebGL në çdo goditje, dhe të ndalet kur faqja fshihet. Pulsi ndjek tempon, jo goditjet e këngës.

**Rekomandimi:** E1-12 ndërtohet vetëm mbi sesionet e medias të Android-it. Kontrollet ndjekin atë që shpall app-i. Kënga ndërrohet vetëm me prekjen e përdoruesit, me emrin dhe tempon e saj kur radha njihet, ose me "Kalo këngën" kur nuk njihet. Tempo vjen nga GetSongBPM përmes një Edge Function, pastaj AcousticBrainz, pastaj "Prek ritmin". Para ndërtimit të radhës, diagnostikimi matet një herë në telefonin e përdoruesit me Spotify dhe YouTube Music (§1.5).

## 1. Sesionet e medias në Android 13–15

### 1.1 Çfarë lejon përdoruesi

- **Fakt.** `MediaSessionManager.getActiveSessions(ComponentName)` kërkon `MEDIA_CONTENT_CONTROL`, që e ka vetëm sistemi, ose që app-i të jetë "an enabled notification listener", duke i dhënë `ComponentName`-in e shërbimit të vet. I njëjti kusht vlen për `addOnActiveSessionsChangedListener` [A1].
- **Fakt.** Shërbimi deklarohet me `BIND_NOTIFICATION_LISTENER_SERVICE` dhe me intent-filter-in `NotificationListenerService` [A6]. Leja kontrollohet me `NotificationManager.isNotificationListenerAccessGranted` (API 27+) [A7]. Faqja e lejes vetëm për një app hapet me `ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS` (API 30+) dhe me `EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME`. Faqja e listës hapet me `ACTION_NOTIFICATION_LISTENER_SETTINGS`, që "mund të mos ekzistojë" [A8].
- **Fakt.** Që nga Android 12 (API 31), meta-data `default_filter_types` me vlerë bosh do të thotë "allow no types": shërbimi nuk merr asnjë njoftim [A6]. Te eksperimenti, vlera bosh kalon e paprekur në APK (`aapt2 dump xmltree`: `android:value=""`).
- **Fakt: cilësimet e kufizuara.** Sipas CDD-së së Android 15 (§9.8) dhe 16, një app i instaluar pasi shkarkohet nga një app që s'është dyqan app-esh (p.sh. shfletuesi ose një app mesazhesh), ose nga një skedar lokal, është "Covered Application". "Notification listener" (`OPSTR_ACCESS_NOTIFICATIONS`) është mes lejeve të kufizuara. Pajisja duhet ta ketë rregullin të ndezur, dhe konfirmimi merret vetëm nga faqja "App info" e app-it [A9]. Android 13 e kishte tashmë për qasjen te njoftimet dhe aksesueshmërinë [A11]. Hapat e Google-it: Settings › Apps › app-i › ⋮ › "Allow restricted settings" [A10]. Në emulator ose me ADB, leja jepet me `cmd appops set <paketa> ACCESS_RESTRICTED_SETTINGS allow` [A12, burim dytësor].
- **Përfundim.** Vrull u shpërndan me një lidhje shkarkimi (SPEC §0.5, §3b), pra çdo instalim i parë mbulohet nga ky rregull, edhe ai i përdoruesit (0.15.0 me dorë). Ekrani i lidhjes duhet ta shpjegojë hapin e dytë. Hapat e One UI-së nuk u provuan në pajisje. Nuk dimë nëse leja e dhënë mbetet pas një përditësimi nga vetë app-i (`PackageInstaller`, SPEC §3b). Ka gjasa të mbetet, sepse është një app-op i app-it, por duhet provuar.
- **Përfundim.** Dritarja e sistemit thotë që app-i mund të lexojë të gjitha njoftimet. Për Vrullin kjo nuk është e vërtetë (filtri bosh, asnjë `onNotificationPosted`), por ekrani duhet ta thotë para se ta hapë.

### 1.2 Si e gjen sesionin që luan

- **Fakt.** `getActiveSessions` i jep kontrolluesit "in priority order with the most important controller at index 0" [A1]. `OnActiveSessionsChangedListener` njofton kur lista ndryshon. `MediaController.Callback` njofton për `onMetadataChanged`, `onPlaybackStateChanged`, `onQueueChanged` dhe `onSessionDestroyed` [A2].
- **Rekomandim.** Zgjidhet i pari që është `STATE_PLAYING`, përndryshe i pari i listës. Dëgjimi nis kur hapet seanca dhe ndalet kur ajo mbyllet. Nuk ka pyetje periodike, sepse çdo gjë vjen me ngjarje.

### 1.3 Çfarë jep `MediaController`

| Të dhëna | API | Shënim |
|---|---|---|
| Titulli, artisti, albumi | `MediaMetadata.METADATA_KEY_TITLE`, `ARTIST`, `ALBUM` (rezervë: `DISPLAY_TITLE`, `DISPLAY_SUBTITLE`) [A5] | Te YouTube Music titulli mund të ketë shtesa ("Official Video"); pastrohet para kërkimit të tempos. |
| Kohëzgjatja | `METADATA_KEY_DURATION`, në ms, negative kur nuk dihet [A5] | Ndihmon të dallohen versionet kur kërkohet tempo. |
| Kopertina | `METADATA_KEY_ALBUM_ART` / `ART` (bitmap) ose `ART_URI` / `ALBUM_ART_URI` [A5] | Bitmap-i mund të jetë i madh; zvogëlohet në native para se t'i jepet JS-it. |
| Gjendja | `PlaybackState.getState()` [A4] | playing, paused, buffering, stopped. |
| Pozicioni | `getPosition()`, `getLastPositionUpdateTime()` (elapsedRealtime), `getPlaybackSpeed()` [A4] | Pozicioni tani = pozicioni + (tani − koha e përditësimit) × shpejtësia. JS-i e vazhdon vetë pa pyetur. |
| Veprimet | `getActions()`, bitmask (`ACTION_PLAY`, `PAUSE`, `SKIP_TO_NEXT`, `SEEK_TO`, `SKIP_TO_QUEUE_ITEM`, `PLAY_FROM_SEARCH`, …) [A4] | Bazë për çdo buton që shfaqet. |
| Radha | `getQueue()`, "the current play queue or null", `getQueueTitle()`, `PlaybackState.getActiveQueueItemId()` (`UNKNOWN_ID` kur nuk ka radhë) [A2, A4] | Shih §2. |
| App-i | `getPackageName()`, `getSessionActivity()` [A2] | `getSessionActivity` hap app-in e muzikës pa nevojë për `<queries>`. |

### 1.4 Cilat kontrolle punojnë

- **Fakt.** Metodat e `TransportControls` janë "Request that the player…" [A3]: app-i i muzikës vendos. Për `skipToQueueItem(id)` me një id jashtë radhës, "the behavior is undefined" [A3].
- **Fakt.** Te Media3, nëse app-i nuk e ndryshon `onConnect`, "it allows all controllers to connect", dhe kontrolluesit "untrusted" marrin vetëm lexim [A13]. Platforma e quan "trusted" një app me `MEDIA_CONTENT_CONTROL` ose "an enabled notification listener" (`isTrustedForMediaControl`) [A1]. Një sesion i vjetër e njeh thirrësin me `getCurrentControllerInfo()` [A14].
- **Përfundim.** Me qasjen te njoftimet, Vrull trajtohet si kontrollues i besuar nga app-et me parazgjedhjet e Media3. Një app që e ndryshon `onConnect` mund të refuzojë gjithsesi. Prandaj butonat ndjekin `getActions()` dhe çdo refuzim thuhet me fjalë.

| Kontrolli | A punon nga Vrull | Kusht |
|---|---|---|
| play, pauza, para, mbrapa | Po | Veprimi te `getActions()`. Për Spotify dhe YouTube Music pritet, por matet me §1.5. |
| Pozicioni (`seekTo`) | Po | `ACTION_SEEK_TO`. |
| Kënga e radhës (`skipToQueueItem`) | Vetëm kur app-i jep radhë dhe veprimin | Id-ja duhet të jetë te `getQueue()`. |
| Shtim ose rirenditje e radhës | Jo | `MediaController` i platformës nuk ka metodë për to [A2]. `addQueueItem` i compat është "deprecated" dhe kërkon `FLAG_HANDLES_QUEUE_COMMANDS` te sesioni [A15]. |
| `playFromMediaId` | Jo në praktikë | Kërkon id-të e brendshme të app-it. Për Spotify-n, një përgjigje në Stack Overflow (20.02.2020) thotë se ai refuzon lidhjen me `MediaBrowserService`-in e vet për app-et jashtë listës së tij [A17]. |
| `playFromSearch("artisti titulli")` | Ndoshta, kur app-i e shpall | Është i njëjti kërkim si intent-i "play from search": app-i kërkon dhe luan rezultatin [A16]. E zëvendëson listën që po luan përdoruesi, prandaj nuk përdoret te E1-12. |

**Fakt: kufijtë e planeve falas.** YouTube Music e rendit "Background play" ("while using other apps or when your screen is off") mes veçorive të Premium [Y1]. Përfundimi: pa Premium muzika nuk vazhdon kur Vrull është përpara. Lista zyrtare e vendeve të YouTube Music dhe YouTube Premium nuk e përmend Shqipërinë (lexuar më 08.11.2026), ndërsa lista e Spotify-t e përmend [Y2, S13]. Spotify Free lejon që nga 15.09.2025 "pick and play any song" [S11]. Më parë, në shuffle, kishte 6 kapërcime në orë [S12, burim dytësor]; faqja zyrtare nuk e thotë kufirin e sotëm.

**Përfundim.** Një kapërcim automatik mund të harxhojë kapërcimet e kufizuara të një llogarie falas, dhe me YouTube Music pa Premium muzika as nuk vazhdon ndërsa Vrull është përpara. Ekrani i lidhjes duhet ta thotë rastin e dytë.

### 1.5 Eksperimenti native

- `android/app/src/main/java/al/traininghub/app/MusicListenerService.java`: shërbimi bosh i lejes, me `default_filter_types` bosh te manifesti.
- `MusicPlugin.java` (plugin-i `Music`): `getAccess`, `openAccessSettings`, `openAppInfo` (për cilësimet e kufizuara), `getNowPlaying`, `diagnose`, `control({ action: 'play' | 'pause' | 'next' | 'previous' | 'seekTo' | 'skipToQueueItem', positionMs?, queueItemId? })`, `startListening` / `stopListening` me ngjarjen `nowPlaying`. Çdo komandë refuzohet me `UNSUPPORTED` kur sesioni nuk e shpall. `diagnose` kthen për çdo sesion paketën, flamujt, veprimet, gjendjen, pozicionin, gjatësinë e radhës (−1 kur `getQueue()` është null) dhe 5 këngët pas së tanishmes, dhe i shkruan edhe te logcat (`VrullMusic`).
- **Fakt.** `npm run build` dhe `./gradlew assembleDebug` kaluan më 08.11.2026 (Gradle 8.14.3, compileSdk 36). Nuk u provua në pajisje.
- **Protokolli i matjes** (një herë, para radhës te E1-12): APK debug në Galaxy; leja (me "Allow restricted settings" nëse duhet); luaj një playlist te Spotify; `chrome://inspect` › konsola: `await Capacitor.Plugins.Music.diagnose()`. Pastaj e njëjta gjë me YouTube Music. Shënohen `actions`, `flags`, `queue.length` dhe `queue.upcoming`. Pa ekran (në emulator ose me ADB): `adb shell cmd notification allow_listener al.traininghub.app/al.traininghub.app.MusicListenerService`, pastaj `adb logcat -s VrullMusic` (shërbimi e shkruan diagnostikimin kur lidhet). Rezultati shkruhet këtu, te §2, si tabelë.

## 2. Radha dhe "kënga e setit"

### 2.1 Çfarë dihet sot

- **Fakt.** `getQueue()` kthen null kur app-i nuk vendos radhë [A2]. Android-i nuk e detyron asnjë app ta vendosë.
- **Fakt (Spotify).** Dokumentimi i Spotify-t për njoftimet e medias në Android (beta) thotë që `com.spotify.music.queuechanged` "does not contain any additional intent extras". Edhe ky broadcast është i fikur derisa përdoruesi ndez "Device Broadcast Status" [S1]. Nuk gjetëm asnjë burim, as zyrtar as dytësor, që thotë se Spotify e vendos radhën te `MediaSession`.
- **Fakt (YouTube Music, dytësor).** Kontrollet e reja të medias te Pixel Watch (prill 2025) tregojnë "the next 24 songs (in the case of YouTube Music)" me prekje për t'i luajtur. "Not all apps support" këtë [Y3].
- **Përfundim.** YouTube Music ka gjasa ta japë radhën dhe `skipToQueueItem` përmes sesionit. Për Spotify-n nuk e dimë. Diagnostikimi i §1.5 e vendos këtë në një minutë. Në asnjë rast Vrull nuk e rirendit radhën dhe nuk fut një këngë në të.

### 2.2 Alternativat për Spotify

| Rruga | Çfarë jep | Kushtet | Vlerësimi |
|---|---|---|---|
| Web API: `GET /me/player/queue`, `POST /me/player/queue`, `POST /me/player/next` | Radha, shtimi i një kënge, kapërcimi | `POST /me/player/queue`: "only works for users who have Spotify Premium", scope `user-modify-playback-state`, "the order of execution is not guaranteed" [S3]. Development Mode: deri në 5 përdorues të shtuar me email, pronari me Premium [S4, S5]; deri në 25 Client ID për llogari dhe kuota e përbashkët (korrik 2026) [S7]. Extended Quota vetëm për organizata me ≥ 250 000 MAU [S4]. Endpoint-et e player-it mbeten te lista e shkurtuar e shkurtit 2026 [S6]. | Jo: Premium për çdo mik, një llogari zhvilluesi e përdoruesit, vetëm Spotify. |
| Android SDK (App Remote) | Luajtja, gjendja, komandat nga app-i i Spotify-t | Beta ("may change significantly"); kërkon app-in e Spotify-t të instaluar; Client ID me paketën dhe gjurmën e çelësit [S2]. | Jo: të njëjtat kufij të Client ID-së (përfundim), dhe vetëm Spotify. |
| Tempo e Spotify-t (`audio-features`) | `tempo`, `energy` | E kufizuar për app-et e reja që më 27.11.2024 [S8]; faqja e endpoint-it e shënon "Deprecated" [S9]; mungon te lista e shkurtit 2026 [S6]. | E pamundur. |

**Fakt: Spotify Developer Policy** (në fuqi nga 15.05.2025), vlen kur përdoret Spotify Platform: "Do not create any product or service which is integrated with streams or content from another service." "Do not synchronize any sound recordings with any visual media…" "you must clearly attribute the content as being supplied … by Spotify." "Do not use the Spotify Platform or any Spotify Content to train a machine learning or AI model" [S10].

**Përfundim.** Një Vrull me Spotify Platform, që lidh këngën me tempon e një shërbimi tjetër dhe pulson trupin me të, bie të paktën në frymën e dy rregullave të para. Sesionet e medias të Android-it nuk janë Spotify Platform, prandaj kjo politikë nuk i prek.

**Fakt (YouTube Music).** Nuk gjetëm asnjë API publike që kontrollon app-in e YouTube Music nga jashtë (kërkim më 08.11.2026). E vetmja rrugë është sesioni i medias.

### 2.3 Zgjidhja e ndershme

**Rekomandim.** Kënga nuk ndërrohet kurrë vetë. Arsyet:

- Vrull nuk e di me siguri çfarë vjen pas.
- App-i i muzikës është i përdoruesit, me kufijtë e llogarisë së tij (§1.4).
- Një ndërrim i papritur në mes të setit e prish vetë setin.

Sipas asaj që jep app-i, sjellja ka dy nivele:

- **Pa radhë** (rasti bazë, edhe për çdo app tjetër): Vrull e di vetëm këngën që luan. Kur fillon seti dhe kjo këngë është nën tempon e setit ose pa tempo, del një sugjerim i qetë "Kjo këngë ka 98 BPM" me "Kalo këngën". Butoni nuk premton tempon e së radhës, dhe pas kapërcimit Vrull tregon tempon e këngës së re.
- **Me radhë** (kur `queue.length > 0` dhe sesioni shpall `skipToQueueItem`): Vrull kërkon tempon e 5 këngëve të ardhshme dhe sugjeron atë më afër tempos së setit: "Pastaj: Titulli · 136 BPM" me "Luaj tani". Në pushim, kur radha njihet, mund të sugjerojë këngën më të qetë, gjithnjë me prekje.

Rregulla e zgjedhjes (logjikë pa UI, me prova përpara kodit te E1-12): tempo e setit 120–140 BPM sipas V29. Zgjidhet kënga brenda intervalit që është më afër 130; nëse asnjë nuk bie brenda, merret më e larta nën 150. Tempo jashtë 60–200 nuk pranohet. Gjatë pushimit, pulsi i trupit shkon në gjysmën e tempos së këngës (136 → 68), pavarësisht muzikës.

## 3. Burimi i tempos

| Burimi | Si kërkohet | Kushtet | Prova më 08.11.2026 | Vlerësimi |
|---|---|---|---|---|
| GetSongBPM | `api.getsongbpm.com/search/?type=both&lookup=song:… artist:…`, pastaj `/song/` me `tempo` [T1] | Falas; "a link back to GetSongBPM.com is REQUIRED (Website, in-App or Store Listing)", ndryshe pezullim pa njoftim; çelës i detyrueshëm; "rate limits apply" pa numër; ruajtja e rezultateve nuk përmendet; "contact us if your project is … for private use" [T1] | Pa çelës nuk u provua | Burimi i parë, me çelësin si secret i Supabase. |
| AcousticBrainz | MusicBrainz (titulli + artisti → MBID), pastaj `acousticbrainz.org/api/v1/low-level?recording_ids=…&features=rhythm.bpm`, deri në 25 MBID në një kërkesë [T2] | Të dhënat CC0; mbledhja u ndal më 2022, faqja dhe API "will continue to be available", statistikat e fundit 2022-07-06 [T2]. MusicBrainz: mesatarisht 1 kërkesë në sekondë për IP, User-Agent me kontakt, 503 kur kalon [T3]. | 4 nga 5 këngë para 2022 kishin tempo (Get Lucky 116,0; Without Me 112,3; 24K Magic 107,0; Eye of the Tiger 108,7; Lose Yourself pa vlerë). MusicBrainz ktheu 503 pas pak kërkesash nga IP-ja e përbashkët e proxy-t. Të dy shërbimet lejojnë CORS (`access-control-allow-origin: *`); AcousticBrainz ktheu `x-ratelimit-limit: 100` (dokumentimi i vjetër thotë zakonisht 10 kërkesa në 10 s). | E dyta, drejt nga telefoni (IP-ja e vet), pa çelës. Nuk ka këngë pas 2022. |
| Deezer | `api.deezer.com/track/{id}`, fusha `bpm` | "strictly limited for a non-commercial purpose", "strictly private use within a family scope", "shall not be associated … with any trademark, brand name, or logo"; dokumentimi kërkon hyrje për të pranuar kushtet [T4] | 4 nga 6 këngë me vlerë (Without Me 112,3; Lose Yourself 171,6; Get Lucky 116,1; 24K Magic 106,83), 2 me `0` | Jo pa leje me shkrim nga Deezer: Vrull është markë, dhe miqtë nuk janë familje. |
| Spotify `audio-features` | Me ID-në e Spotify-t | E kufizuar për app-et e reja [S8, S9] | – | E pamundur. |
| ReccoBeats | ID-ja e vet (UUID), sipas një katalogu të palës së tretë | Dokumentimi zyrtar nuk u hap dot nga ky sesion (leja e URL-së nuk u dha) | – | I pavlerësuar. |

- **Përfundim: dyfishi dhe gjysma.** Vlera 171,6 e Deezer-it për Lose Yourself mund të dëgjohet edhe si 86. Burimet automatike e ngatërrojnë shpesh oktavën e tempos. Karta e këngës ka "×2" dhe "÷2" për korrigjim, dhe "Prek ritmin" e mbishkruan vlerën.
- **Rekomandim: zinxhiri.** (1) Ruajtja në telefon (Dexie, sipas artistit dhe titullit të normalizuar, me burimin dhe kohëzgjatjen). (2) GetSongBPM përmes një Edge Function `tempo` me çelësin si secret dhe vetëm me sesion, si USDA te TH-15. (3) AcousticBrainz drejt nga telefoni, me User-Agent `Vrull/<versioni> (<email>)`. (4) "Prek ritmin". Pa internet: vlera e ruajtur ose prekja. Kërkimi nuk e ndal kurrë ekranin: kënga del menjëherë dhe tempo shtohet kur gjendet.
- **Rekomandim: atribuimi.** "Tempo nga GetSongBPM.com" me lidhje, nën tempon e kërkuar, dhe te Cilësimet › "Burimet dhe licencat" bashkë me AcousticBrainz (CC0, nuk e kërkon, por ndihmon).
- **Rekomandim: ruajtja.** CC0 lejon gjithçka. Për GetSongBPM, kushtet nuk e përmendin, ndaj përdoruesi u shkruan dhe pyet, sepse faqja vetë kërkon kontakt për projekte private (§7).
- **Rekomandim: "Prek ritmin".** Të paktën 4 prekje; tempo = 60 000 / mediana e intervaleve të 8 prekjeve të fundit; nis nga e para pas 2 s pa prekje; pranohet 60–200. Prekja e fundit jep edhe fazën e goditjes, që pulsi të nisë bashkë me muzikën. Vlera ruhet për këngën me burimin "e prekur".

## 4. Politikat

- **Sot (APK jashtë Play Store).** Cilësimet e kufizuara (§1.1) dhe verifikimi i zhvilluesve, që është te SPEC §18.
- **Fakt (Google Play).** Faqja "Permissions and APIs that Access Sensitive Information" nuk e përmend qasjen te njoftimet. Ajo kufizon `REQUEST_INSTALL_PACKAGES` ("All installations must be a direct, active choice by the user"), `QUERY_ALL_PACKAGES` dhe `USE_EXACT_ALARM` (vetëm për alarm, timer dhe kalendar si funksion kryesor) [P2]. "User Data" kërkon njoftim brenda app-it dhe pëlqim me veprim të qartë kur përdorimi i të dhënave "may not be within the reasonable expectation of the user" [P1]. "Device and Network Abuse": "An app distributed via Google Play may not modify, replace, or update itself using any method other than Google Play's update mechanism" [P3].
- **Përfundim.** Nëse Vrull shkon ndonjëherë në Play: përditësimi brenda app-it (TH-23) duhet hequr; ekrani i lidhjes së muzikës, që shpjegon çfarë lexon Vrull para se të hapë cilësimet, e plotëson njoftimin e "User Data"; dhe cilësimet e kufizuara nuk vlejnë për instalimet nga Play, që është dyqan app-esh [A9].
- **Spotify Developer Policy** nuk vlen për sesionet e medias (§2.2).

## 5. Bateria dhe performanca e pulsit

- **Fakt.** Një kuadër ka 16 ms në 60 fps, 11 ms në 90 dhe 8 ms në 120. Kuadri që e kalon, hidhet [A18]. `requestAnimationFrame` "are paused in most browsers when running in background tabs", "to improve performance and battery life" [W1]. Vetëm `transform` dhe `opacity` i bën vetë compositor-i, pa layout dhe paint [W3]. Renderimi i vazhdueshëm "wastes the user's battery"; three.js rekomandon renderim vetëm kur ndryshon diçka [W4].
- **Fakt (repo).** `body-model.tsx` renderon vetëm kur lëviz kamera (rreshtat 127–141). Capacitor 8.6.0 nuk e ndal JS-in kur app-i del në sfond: `Bridge.onPause` thërret `handlePause(keepRunning)` (`node_modules/@capacitor/android/.../Bridge.java`, rreshti 1370). Një animacion i nisur nga JS vazhdon derisa ta ndalë vetë app-i.
- **Rekomandim.** Pulsi është ndërrim CSS i `opacity` mes dy pamjeve të trupit, "i ndezur" dhe "i qetë". Të dyja renderohen një herë me skenën ekzistuese, dhe sërish vetëm kur ndryshojnë muskujt ose rrotullimi. Kohëzgjatja e animacionit është `60 / BPM` s. Nuk ka WebGL në çdo goditje, kështu që puna për kuadër mbetet te compositor-i.
- **Rekomandim.** `animation-play-state: paused` me `visibilitychange` (hidden), me `pause` të `@capacitor/app` dhe kur seanca mbyllet. Me `prefers-reduced-motion`, trupi rri i ndezur pa puls (V29). Pozicioni i këngës llogaritet në JS nga `positionMs`, `positionAt` dhe shpejtësia, pa timer native. Ngjarjet native janë të rralla (ndërrimi i këngës, pauza), dhe dëgjimi ndalet kur mbyllet seanca.
- **Përfundim.** Tempo jep periudhën, jo fazën. Pa "Prek ritmin", pulsi nuk bie bashkë me goditjet, ndaj UI thotë "në tempo" dhe kurrë "në ritëm me goditjet".
- **Rekomandim: matja te E1-12.** Një seancë 60-minutëshe me ekran të ndezur, me dhe pa puls, në Galaxy-n e përdoruesit: përqindja e baterisë në fillim dhe në fund, dhe `adb shell dumpsys gfxinfo al.traininghub.app` për kuadrot e vonuara. Synimi i propozuar: diferenca nën 3 pikë përqindjeje në orë. Ky prag nuk vjen nga një burim. Mbetet e pamatur nëse ekrani 120 Hz i Samsung-ut qëndron në frekuencë të lartë sa kohë ka animacion; nëse po, provohet `steps()` te animacioni.

## 6. Çfarë premton UI (për E1-12)

1. **Lidhja** (Cilësimet › Muzika dhe karta e parë te seanca): "Lidh app-in e muzikës". Fleta shpjegon: "Vrull lexon vetëm këngën që luan dhe kontrollet e saj. Android-i e quan këtë qasje te njoftimet dhe thotë që app-i mund t'i lexojë; Vrull nuk lexon asnjë njoftim." Butoni: "Hap cilësimet".
2. **Leja e bllokuar** (kur leja nuk vjen pas kthimit): "Android-i e bllokon këtë leje për app-et e shkarkuara nga një lidhje. Hap info e app-it, prek ⋮ dhe Allow restricted settings, pastaj ndize Vrullin te qasja te njoftimet." Butoni: "Hap info e app-it".
3. **Kontrollet e muzikës te seanca:** titulli, artisti, emri i app-it (Spotify, YouTube Music ose "App-i i muzikës"), tempo me burimin ("138 BPM", "Tempo nga GetSongBPM.com", "Tempo e prekur"). Shfaqen vetëm butonat që app-i i pranon. Një refuzim thuhet: "App-i i muzikës nuk e pranon këtë veprim."
4. **Kur fillon seti:** pa radhë, "Kjo këngë ka 98 BPM" me "Kalo këngën"; me radhë, "Pastaj: Titulli · 136 BPM" me "Luaj tani". Asnjëherë automatikisht.
5. **Pushimi:** pulsi në gjysmën e tempos. Muzika nuk ndërrohet. Me radhë, mund të dalë "Për pushimin: Titulli · 96 BPM" me "Luaj tani".
6. **Pa tempo:** "Tempo e panjohur" me "Prek ritmin"; karta ka "×2" dhe "÷2".
7. **Zemra:** "138 BPM kënga · 142 zemra" vetëm kur ka të dhëna nga ora (Etapat 3 dhe 5). Pa to, vetëm tempo e këngës. Teksti nuk thotë që zemra ndjek muzikën.
8. **Pa muzikë:** "Asnjë app muzike nuk luan" me "Hap app-in e muzikës" (`getSessionActivity` i sesionit të fundit, kur ka).
9. **YouTube Music:** Vrull nuk e di nëse përdoruesi ka Premium, ndaj kur app-i që luan është YouTube Music, fleta e lidhjes thotë: "Pa Premium, YouTube Music ndalet kur Vrull është përpara."
10. **Diagnostikimi** te Cilësimet › Muzika: për app-in që luan, "Radha: e dhënë" ose "Radha: nuk jepet", dhe kontrollet që pranon. Kjo i jep përdoruesit të njëjtën përgjigje si §1.5.
11. **Ekrani i kyçur:** kontrollet e vetë app-it të muzikës mbeten si zakonisht. Njoftimi i seancës (E1-08) shton "Kalo këngën" vetëm kur app-i e pranon. Ora vjen me Etapën 5.

## 7. Pyetjet e hapura

1. Çfarë japin Spotify dhe YouTube Music në Galaxy-n e përdoruesit: veprimet, flamujt dhe radha (§1.5). Kjo vendos nëse niveli "Me radhë" vlen për Spotify-n.
2. Hapat e sakta të One UI-së për "Allow restricted settings", dhe nëse leja mbetet pas përditësimit nga vetë app-i.
3. Kufijtë e GetSongBPM dhe leja për të ruajtur rezultatet në telefon (përgjigja me email).
4. Bateria me puls, sipas matjes së §5.
5. A e përdor përdoruesi YouTube Music, që zyrtarisht nuk është në Shqipëri [Y2]. Vrull punon njësoj me çdo app tjetër.
6. Nëse ndonjë app e refuzon Vrullin te `onConnect` edhe me qasjen te njoftimet; matet me të njëjtin diagnostikim.

## 8. Veprimet e përdoruesit

- Regjistrim falas te GetSongBPM (getsongbpm.com/api) për çelësin e API-së; në email: projekt privat për disa miq, pyetja për ruajtjen e rezultateve në telefon, dhe vendi i lidhjes (brenda app-it). Çelësi shtohet vetë si secret i Supabase (`GETSONGBPM_API_KEY`, Edge Functions › Secrets), si te USDA.
- Kur të vijë E1-12: leja e qasjes te njoftimet në telefon, me "Allow restricted settings" nëse duhet, dhe një diagnostikim me Spotify dhe YouTube Music (një minutë).
- Nuk duhet llogari zhvilluesi te Spotify.

## Burimet

Android
- [A1] MediaSessionManager: https://developer.android.com/reference/android/media/session/MediaSessionManager
- [A2] MediaController: https://developer.android.com/reference/android/media/session/MediaController
- [A3] MediaController.TransportControls: https://developer.android.com/reference/android/media/session/MediaController.TransportControls
- [A4] PlaybackState: https://developer.android.com/reference/android/media/session/PlaybackState
- [A5] MediaMetadata: https://developer.android.com/reference/android/media/MediaMetadata
- [A6] NotificationListenerService: https://developer.android.com/reference/android/service/notification/NotificationListenerService
- [A7] NotificationManager: https://developer.android.com/reference/android/app/NotificationManager
- [A8] Settings: https://developer.android.com/reference/android/provider/Settings
- [A9] Android 15 CDD, §9.8 "Restricted settings": https://source.android.com/docs/compatibility/15/android-15-cdd (i njëjti tekst te https://source.android.com/docs/compatibility/16/android-16-cdd)
- [A10] Android Help, "Allow restricted settings": https://support.google.com/android/answer/12623953
- [A11] Android Authority, 12.09.2024 (dytësor): https://androidauthority.com/android-15-restricted-settings-sideloading-3481098
- [A12] F-Droid, issue 2680 (dytësor, komanda appops): https://gitlab.com/fdroid/fdroidclient/-/issues/2680
- [A13] Media3 MediaSession.Callback (onConnect): https://developer.android.com/reference/androidx/media3/session/MediaSession.Callback
- [A14] MediaSession (getCurrentControllerInfo): https://developer.android.com/reference/android/media/session/MediaSession
- [A15] MediaControllerCompat (addQueueItem): https://developer.android.com/reference/android/support/v4/media/session/MediaControllerCompat
- [A16] Common intents, "Play music based on a search query": https://developer.android.com/guide/components/intents-common
- [A17] Stack Overflow 60216008, përgjigja e ianhanniballake, 20.02.2020 (dytësor; lexuar nga kopja e arkivuar https://kaweah.freedombox.rocks/kiwix/stackoverflow.com_en_all_2023-11/questions/60216008/is-it-possible-to-connect-to-spotify-s-mediabrowserservice): https://stackoverflow.com/questions/60216008
- [A18] Slow rendering: https://developer.android.com/topic/performance/vitals/render

Spotify
- [S1] Android Media Notifications (beta): https://developer.spotify.com/documentation/android/tutorials/android-media-notifications
- [S2] Android SDK: https://developer.spotify.com/documentation/android dhe https://developer.spotify.com/documentation/android/tutorials/getting-started
- [S3] Add Item to Playback Queue: https://developer.spotify.com/documentation/web-api/reference/add-to-queue
- [S4] Quota modes: https://developer.spotify.com/documentation/web-api/concepts/quota-modes
- [S5] Update on Developer Access and Platform Security, 06.02.2026: https://developer.spotify.com/blog/2026-02-06-update-on-developer-access-and-platform-security
- [S6] Web API Changelog, shkurt 2026: https://developer.spotify.com/documentation/web-api/references/changes/february-2026
- [S7] Web API quota updates for Development Mode, 23.07.2026: https://developer.spotify.com/blog/2026-07-23-web-api-quota-updates dhe https://developer.spotify.com/documentation/web-api/references/changes/july-2026
- [S8] Introducing some changes to our Web API, 27.11.2024: https://developer.spotify.com/blog/2024-11-27-changes-to-the-web-api
- [S9] Get Track's Audio Features ("Deprecated"): https://developer.spotify.com/documentation/web-api/reference/get-audio-features
- [S10] Spotify Developer Policy, në fuqi nga 15.05.2025: https://developer.spotify.com/policy
- [S11] Spotify Newsroom, 15.09.2025: https://newsroom.spotify.com/2025-09-15/free-experience-updates-features-tips/
- [S12] nextpit (dytësor, kufiri i vjetër i kapërcimeve): https://nextpit.com/news/spotify-free-no-limit-shuffle-play-any-song-feature-for-all
- [S13] Where Spotify is available: https://support.spotify.com/us/article/where-spotify-is-available/

YouTube
- [Y1] Play music or podcasts in the background: https://support.google.com/youtubemusic/answer/6313552
- [Y2] YouTube Music, available locations: https://support.google.com/youtubemusic/answer/6313540; YouTube Premium: https://support.google.com/youtube/answer/6307365
- [Y3] 9to5Google, 24.04.2025 (dytësor): https://9to5google.com/2025/04/24/pixel-watch-media-controls-upgrade/; Chrome Unboxed, 24.04.2025: https://chromeunboxed.com/pixel-watch-is-getting-far-better-media-controls/

Tempo
- [T1] GetSongBPM API: https://getsongbpm.com/api
- [T2] AcousticBrainz: https://acousticbrainz.org/; API: https://acousticbrainz.readthedocs.io/api.html
- [T3] MusicBrainz API, Rate Limiting: https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting
- [T4] Deezer for Developers, Terms of use: https://developers.deezer.com/termsofuse (pa datë). Faqja e track-ut kërkon hyrje: https://developers.deezer.com/api/track

Google Play
- [P1] User Data: https://support.google.com/googleplay/android-developer/answer/10144311
- [P2] Permissions and APIs that Access Sensitive Information: https://support.google.com/googleplay/android-developer/answer/9888170
- [P3] Device and Network Abuse: https://support.google.com/googleplay/android-developer/answer/9888379

Web
- [W1] MDN, requestAnimationFrame: https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- [W2] MDN, Page Visibility API: https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- [W3] web.dev, Stick to Compositor-Only Properties and Manage Layer Count: https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count
- [W4] three.js, Rendering on Demand: https://threejs.org/manual/en/rendering-on-demand.html
