# Instalimi në telefon

Training Hub nuk është në Play Store. APK-ja ndërtohet nga GitHub Actions dhe publikohet te [Releases](https://github.com/keyeser33-hash/training-hub/releases) e repo-s.

## 1. Një herë: çelësi i nënshkrimit

Çdo APK nënshkruhet me të njëjtin çelës. Android e instalon një version të ri mbi të vjetrin vetëm kur çelësi është i njëjti. Prandaj çelësi ruhet në dy vende.

**Në GitHub** (pa këtë, ndërtimi i APK-së ndalet me mesazhin "Mungon çelësi i nënshkrimit"):

1. Hap repo-n në GitHub, pastaj **Settings → Secrets and variables → Actions**.
2. **New repository secret**, emri `TH_KEYSTORE_BASE64`, vlera: i gjithë teksti i skedarit `traininghub-release.jks.base64.txt`.
3. **New repository secret**, emri `TH_KEYSTORE_PASSWORD`, vlera: teksti i skedarit `traininghub-release-password.txt`.

**Kopje rezervë:** ruaj `traininghub-release.jks` dhe fjalëkalimin në një vend privat (menaxher fjalëkalimesh ose Google Drive). Secret-et e GitHub-it nuk lexohen dot më pas. Nëse çelësi humbet, një version i ri nuk instalohet mbi të vjetrin: duhet çinstaluar app-i, dhe humbin të dhënat që nuk janë sinkronizuar ende me Supabase.

Workflow-i kontrollon gjurmën e certifikatës. Nëse dikush vendos një çelës tjetër te secret-et, ndërtimi ndalet para se të dalë një APK që nuk instalohet dot si përditësim.

## 2. Instalimi i parë

1. Në telefon, hyr në GitHub në shfletues (repo-ja është private) dhe hap [versionin e fundit](https://github.com/keyeser33-hash/training-hub/releases/latest).
2. Shkarko `TrainingHub-X.Y.Z.apk`.
3. Hape skedarin. Herën e parë Android kërkon leje për të instaluar app-e nga ky burim: **Cilësimet → Lejo nga ky burim** (Allow from this source). Kjo bëhet vetëm një herë për shfletuesin ose për app-in e skedarëve.
4. **Instalo**. Nëse Play Protect thotë që app-i është i panjohur, zgjidh **Më shumë detaje → Instalo gjithsesi**.
5. Hap Training Hub nga ekrani kryesor dhe hyr me email-in dhe fjalëkalimin e llogarisë që krijove te Supabase. Hyrja kërkon internet vetëm herën e parë; pastaj vendos peshën, ditët dhe orën e stërvitjes, zgjimin dhe gjumin, dhe programi nis nga Java 0.

## 3. Përditësimet

1. Shkarko APK-në e versionit të ri nga Releases.
2. Hape dhe zgjidh **Përditëso** (Update).

Mos e çinstalo app-in para përditësimit. Përditësimi mban të gjitha të dhënat e telefonit, sepse çelësi është i njëjti dhe numri i versionit rritet.

## 4. Lejet

- **Njoftimet:** app-i i kërkon në stërvitjen e parë, për timer-in e pushimit. Lejoji.
- **Alarmet e sakta:** në Android 13 e lart jepen vetë. Në Android 12, nëse app-i të dërgon te cilësimet, aktivizo **Alarmet dhe rikujtuesit**.
- **Bateria:** nëse timer-i vonon me ekran të kyçur, te Training Hub hap **Cilësimet → Timer-i i pushimit → Hiq kufizimin e baterisë** dhe lejoje. Ose te cilësimet e telefonit: **App-et → Training Hub → Bateria → Pa kufizime**.

## 5. Verifikimi i zhvilluesve nga Google

Nga viti 2027, Google do të kërkojë që app-et e instaluara jashtë Play Store në telefonat Android të certifikuar të jenë të regjistruara nga një zhvillues i verifikuar. Për një app personal mjafton llogaria falas **limited distribution** te Android Developer Console: kërkon vetëm email dhe lejon instalimin në deri në 20 pajisje. Aty regjistrohen `al.traininghub.app` dhe çelësi i nënshkrimit i pikës 1.

Kur rregulli të hyjë në fuqi në Shqipëri, regjistrimi bëhet një herë dhe instalimi vazhdon si më sipër. Pa regjistrim, instalimi mbetet i mundur me "advanced flow" të Android-it ose me ADB nga kompjuteri.

## 6. Si del një version i ri

Release-i del vetë, pa hap me dorë:

1. Rritet `version` te `package.json` (p.sh. `0.3.0` → `0.4.0`) dhe bëhet commit në `main`.
2. Workflow-i "APK për Android" e sheh që versioni nuk ka ende Release. Kalon lint-in, testet dhe build-in, ndërton APK-në, verifikon nënshkrimin, krijon tag-un `v0.4.0` dhe publikon Release-in me APK-në (rreth 6 minuta).
3. Shkarko APK-në në telefon dhe zgjidh **Përditëso** (pika 3).

Një push te `main` pa version të ri nuk ndërton asgjë. Tag-u mund të krijohet edhe me dorë (te GitHub: **Releases → Draft a new release**, ose `git tag v0.4.0 && git push origin v0.4.0`); rezultati është i njëjtë.

Numri i versionit për Android llogaritet vetë: `major × 10000 + minor × 100 + patch` (0.2.0 → 200), prandaj `minor` dhe `patch` shkojnë deri në 99. Tag-u duhet të jetë i njëjtë me versionin te `package.json`, ndryshe ndërtimi ndalet.

Për një provë pa Release: te **Actions → APK për Android → Run workflow**. APK-ja del si artifact i run-it.
