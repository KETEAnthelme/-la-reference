-- LA RÉFÉRENCE — Compléter les échéanciers existants sans doublons
-- Migration déjà appliquée sur le projet Supabase bsmrwupcbhwoquwjdtvi.
-- Le RPC conserve les tranches, remises et encaissements déjà enregistrés.
CREATE OR REPLACE FUNCTION public.creer_echeancier_eleve(p_eleve_id bigint, p_code_niveau text)
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE v_e public.eleves%rowtype; v_year bigint; v_grid public.grilles_tarifaires%rowtype; v_count integer := 0;
BEGIN
 SELECT * INTO v_e FROM public.eleves WHERE id=p_eleve_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Élève introuvable.'; END IF;
 IF NOT private.has_site_role(v_e.etablissement_id,ARRAY['administrateur_general','administrateur','direction','directeur','censeur','secretariat','secretaire','comptable','caissier']) THEN
  RAISE EXCEPTION 'Vous n’êtes pas autorisé à créer un échéancier dans cet établissement.';
 END IF;
 SELECT id INTO v_year FROM public.annees_scolaires WHERE active=true AND etablissement_id=v_e.etablissement_id ORDER BY id DESC LIMIT 1;
 IF v_year IS NULL THEN RAISE EXCEPTION 'Aucune année scolaire active pour cet établissement.'; END IF;
 SELECT * INTO v_grid FROM public.grilles_tarifaires WHERE annee_scolaire_id=v_year AND etablissement_id=v_e.etablissement_id AND code_niveau=upper(trim(p_code_niveau)) AND valide=true ORDER BY id DESC LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Aucun tarif validé pour le niveau % dans cet établissement.',p_code_niveau; END IF;
 INSERT INTO public.echeances_eleves(eleve_id,etablissement_id,annee_scolaire_id,grille_tarifaire_id,numero_tranche,libelle,date_echeance,montant_initial)
 SELECT p_eleve_id,v_e.etablissement_id,v_year,v_grid.id,e.numero_tranche,e.numero_tranche||'ème tranche',e.date_echeance,e.montant
 FROM public.echeances_tarifaires e WHERE e.grille_tarifaire_id=v_grid.id
 ON CONFLICT (eleve_id,annee_scolaire_id,numero_tranche) DO NOTHING;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF coalesce(v_grid.frais_photocopie_support_tranche,0)>0 THEN
  INSERT INTO public.echeances_support_eleves(eleve_id,etablissement_id,annee_scolaire_id,numero_tranche,libelle,date_echeance,montant_du)
  SELECT p_eleve_id,v_e.etablissement_id,v_year,e.numero_tranche,e.numero_tranche||'ème tranche — Photocopies/support',e.date_echeance,v_grid.frais_photocopie_support_tranche
  FROM public.echeances_tarifaires e WHERE e.grille_tarifaire_id=v_grid.id
  ON CONFLICT (eleve_id,annee_scolaire_id,numero_tranche) DO NOTHING;
 END IF;
 RETURN v_count;
END
$function$;
REVOKE ALL ON FUNCTION public.creer_echeancier_eleve(bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.creer_echeancier_eleve(bigint,text) TO authenticated;
