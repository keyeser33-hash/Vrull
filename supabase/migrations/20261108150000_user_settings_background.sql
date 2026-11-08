-- Sfondi i app-it (V20, DESIGN.md › Sfondet, V2-E1-05): "I plotë" (solid) ose "Vija shpejtësie"
-- (speed_lines), me çdo temë. Sinkronizohet si gjuha; rreshtat e v1 marrin "I plotë".
alter table public.user_settings
  add column background text not null default 'solid' check (background in ('solid', 'speed_lines'));
