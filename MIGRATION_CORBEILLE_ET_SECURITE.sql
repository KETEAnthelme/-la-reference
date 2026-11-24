-- Migration appliquee au projet Supabase bsmrwupcbhwoquwjdtvi le 24/11/2026.
-- La corbeille prend actuellement en charge les notes et les presences seulement.
create table if not exists public.corbeille_generale (
 id uuid primary key default gen_random_uuid(),
 etablissement_id uuid not null references public.etablissements(id),
 table_origine text not null check (table_origine in ('notes','presences')),
 enregistrement_id bigint not null,
 donnees jsonb not null,
 supprime_par uuid not null default auth.uid(),
 supprime_le timestamptz not null default now(),
 restaure_le timestamptz,
 restaure_par uuid,
 purge_le timestamptz,
 purge_par uuid
);
alter table public.corbeille_generale enable row level security;
drop policy if exists corbeille_admin_select on public.corbeille_generale;
create policy corbeille_admin_select on public.corbeille_generale for select to authenticated
using (private.has_site_role(etablissement_id, array['administrateur_general']::text[]));
revoke all on public.corbeille_generale from anon, authenticated;
grant select on public.corbeille_generale to authenticated;

create or replace function public.corbeille_archiver(p_table text, p_id bigint)
returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_row jsonb; v_site uuid; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 if p_table not in ('notes','presences') then raise exception 'Type non pris en charge par la corbeille'; end if;
 if p_table='notes' then select to_jsonb(t),t.etablissement_id into v_row,v_site from public.notes t where t.id=p_id;
 else select to_jsonb(t),t.etablissement_id into v_row,v_site from public.presences t where t.id=p_id; end if;
 if v_row is null then raise exception 'Enregistrement introuvable'; end if;
 if not private.has_site_role(v_site,array['administrateur_general']::text[]) then raise exception 'Seul l’administrateur général peut archiver cet élément'; end if;
 insert into public.corbeille_generale(etablissement_id,table_origine,enregistrement_id,donnees) values(v_site,p_table,p_id,v_row) returning id into v_id;
 if p_table='notes' then delete from public.notes where id=p_id and etablissement_id=v_site;
 else delete from public.presences where id=p_id and etablissement_id=v_site; end if;
 return v_id;
end $$;
create or replace function public.corbeille_restaurer(p_corbeille_id uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v public.corbeille_generale%rowtype;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 select * into v from public.corbeille_generale where id=p_corbeille_id and restaure_le is null and purge_le is null for update;
 if not found then raise exception 'Élément introuvable ou déjà traité'; end if;
 if not private.has_site_role(v.etablissement_id,array['administrateur_general']::text[]) then raise exception 'Accès réservé à l’administrateur général'; end if;
 if v.table_origine='notes' then execute 'insert into public.notes select (jsonb_populate_record(null::public.notes,$1)).*' using v.donnees;
 elsif v.table_origine='presences' then execute 'insert into public.presences select (jsonb_populate_record(null::public.presences,$1)).*' using v.donnees;
 else raise exception 'Type non restaurable'; end if;
 update public.corbeille_generale set restaure_le=now(),restaure_par=auth.uid() where id=v.id;
 return true;
end $$;
create or replace function public.corbeille_purger(p_corbeille_id uuid)
returns boolean language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v public.corbeille_generale%rowtype;
begin
 if auth.uid() is null then raise exception 'Connexion requise'; end if;
 select * into v from public.corbeille_generale where id=p_corbeille_id and restaure_le is null for update;
 if not found then raise exception 'Élément introuvable ou déjà traité'; end if;
 if not private.has_site_role(v.etablissement_id,array['administrateur_general']::text[]) then raise exception 'Accès réservé à l’administrateur général'; end if;
 delete from public.corbeille_generale where id=v.id;
 return true;
end $$;
revoke all on function public.corbeille_archiver(text,bigint) from public,anon;
revoke all on function public.corbeille_restaurer(uuid) from public,anon;
revoke all on function public.corbeille_purger(uuid) from public,anon;
grant execute on function public.corbeille_archiver(text,bigint) to authenticated;
grant execute on function public.corbeille_restaurer(uuid) to authenticated;
grant execute on function public.corbeille_purger(uuid) to authenticated;

-- Audit: lecture admin general et insertion du personnel autorise sur le site.
drop policy if exists journal_actions_admin_select on public.journal_actions;
create policy journal_actions_admin_select on public.journal_actions for select to authenticated
using (private.has_site_role(etablissement_id, array['administrateur_general']::text[]));
drop policy if exists journal_actions_staff_insert on public.journal_actions;
create policy journal_actions_staff_insert on public.journal_actions for insert to authenticated
with check (private.has_site_role(etablissement_id,array['administrateur_general','direction','directeur','secretariat','secretaire','comptable','enseignant','professeur','censeur','surveillant']::text[]));
revoke all on public.test_ecole from anon,authenticated;
revoke all on function public.encaisser_support_eleve(bigint,numeric,text,text) from public,anon;
grant execute on function public.encaisser_support_eleve(bigint,numeric,text,text) to authenticated;
revoke all on function public.portail_parent_donnees() from public,anon;
grant execute on function public.portail_parent_donnees() to authenticated;


-- Défense en profondeur : la table de test reste inaccessible aux rôles API.
drop policy if exists test_ecole_deny_all on public.test_ecole;
create policy test_ecole_deny_all on public.test_ecole
for all to anon, authenticated using (false) with check (false);
