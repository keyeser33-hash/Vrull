-- Logjika e progresit (V2-E1-04; SPEC §0.2 V9 dhe V23, §7).

-- 1. Rregulli i progresit të një sloti në programet e përdoruesit (V9), si receta dhe teknika:
-- vlen në çdo nivel të editorit (block_id, week). Kur çdo set i seancës së kaluar arrin kufirin e
-- sipërm me RIR ≥ minRir, pesha e radhës propozohet me incrementKg më shumë.
-- progression: {"minRir": 2, "incrementKg": 2.5}
alter table public.slot_prescriptions
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

-- 2. Peshat e javës (V23): pesha që përdoruesi pranoi ("accepted"), ndryshoi ("changed") ose la
-- nga java e kaluar ("postponed", "Më vonë") për një slot në një javë të programit, në një xhiro.
-- Pa rresht vlen propozimi i §7; vendimi vlen vetëm për ushtrimin për të cilin u mor.
create table public.week_weights (
  program_id uuid not null references public.programs (id) on delete cascade,
  run smallint not null default 1 check (run >= 1),
  block_id uuid not null references public.program_blocks (id) on delete cascade,
  week smallint not null check (week between 1 and 52),
  slot_id uuid not null references public.program_slots (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  weight_kg numeric(6, 2) not null check (weight_kg >= 0),
  status text not null check (status in ('accepted', 'changed', 'postponed'))
);
select private.setup_sync_table('week_weights');

create unique index week_weights_slot_week_unique on public.week_weights (slot_id, run, block_id, week)
  where deleted_at is null;
create index week_weights_program_idx on public.week_weights (program_id);
create index week_weights_block_idx on public.week_weights (block_id);
create index week_weights_exercise_idx on public.week_weights (exercise_id);
