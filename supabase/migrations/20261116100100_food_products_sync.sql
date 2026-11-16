-- 0.28 (V2-E3-27, vala 5; SPEC V59, §0.3h): sinkronizimi i produkteve të grupit nga telefoni. Vetëm shtesë, pas `20261115120000_food_catalog.sql`.
--
-- Telefoni krijon id-në e rreshtit (si te çdo tabelë e sinkronizuar), që rreshti i kthyer nga serveri të gjendet lokalisht dhe dërgimi i
-- përsëritur të mos bëjë dy rreshta. Kolona `id` kishte vetëm parazgjedhjen gen_random_uuid(); këtu telefoni lejohet ta japë. Asgjë tjetër nuk ndryshon:
-- ndryshimi dhe fshirja mbeten vetëm për Adminin, `added_by` vendoset nga baza dhe nuk lexohet. Telefoni dërgon me `insert` (jo upsert),
-- dhe një barkod që ekziston tashmë (indeksi unik `food_products_barcode`) merret si "grupi e ka" dhe rreshti tjetër vjen me marrjen.

grant insert (id) on public.food_products to authenticated;

-- Kontrolli (pritet: id te kolonat e lejuara për insert):
--   select column_name from information_schema.column_privileges
--   where table_name = 'food_products' and grantee = 'authenticated' and privilege_type = 'INSERT' order by 1;

-- Prodhuar nga Claude (AI); rishikohet nga Andi
