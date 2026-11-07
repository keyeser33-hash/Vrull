# Supabase

Projekti: `training-hub` (ref `hxwkyhfqcadtipkpopnq`, eu-central-1, plani falas).

- `migrations/`: skema, me emrin sipas versionit që regjistroi Supabase. Çdo ndryshim i skemës hyn si migrim i ri; një migrim i aplikuar nuk ndryshohet më.
- `tests/rls_isolation.sql`: prova e izolimit. Krijon dy përdorues provë në një transaksion, kontrollon që i dyti nuk sheh, nuk ndryshon dhe nuk fshin asgjë të të parit (as fotot), që `anon` nuk ka qasje dhe që një version më i vjetër nuk mbishkruan një më të ri; pastaj kthen gjithçka mbrapsht. Rezultati pritet `failed = 0`.

Pas çdo migrimi: këshilltarët e sigurisë dhe të performancës pa paralajmërime, dhe prova e izolimit e gjelbër.
