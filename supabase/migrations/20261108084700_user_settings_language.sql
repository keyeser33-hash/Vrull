-- Gjuha e app-it (SPEC V22, §0.3a, V2-E1-02): shqip (parazgjedhje) ose anglisht britanike.
-- Sinkronizohet si cilësimet e tjera; rreshtat e v1 marrin shqipen.
alter table public.user_settings
  add column language text not null default 'sq' check (language in ('sq', 'en'));
