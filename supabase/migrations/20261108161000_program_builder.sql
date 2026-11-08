-- Ndërtuesi i programeve (V2-E1-10; SPEC §4, bordet "Programet" dhe "Ndërto"). Vetëm shtesa: rreshtat
-- e v1 marrin vlerat e parazgjedhura dhe nuk ndryshojnë.

-- 1. "Progresi i zgjuar" i gjithë programit: vlen për çdo slot që nuk ka rregull më vete
-- (slot_prescriptions.progression) në asnjë nivel. Null: pa rregull.
-- progression: {"minRir": 2, "incrementKg": 2.5}
alter table public.programs
  add column progression jsonb check (
    progression is null or (
      jsonb_typeof(progression) = 'object'
      and case
        when jsonb_typeof(progression -> 'minRir') = 'number' and jsonb_typeof(progression -> 'incrementKg') = 'number'
          then (progression ->> 'minRir')::numeric between 0 and 10 and (progression ->> 'incrementKg')::numeric > 0
        else false
      end
    )
  );

-- 2. Shablloni nga i cili nisi programi ("Nisur nga shablloni Upper/Lower 4 ditë"). Vetëm emri: kopja
-- nuk lidhet me shabllonin.
alter table public.programs
  add column template text check (template is null or template in ('shortcut_to_size', 'full_body_3', 'upper_lower_4'));

-- 3. Programi që po ndërtohet dhe nuk është ruajtur ende me "Ruaj programin" ("Draft").
alter table public.programs
  add column draft boolean not null default false;
