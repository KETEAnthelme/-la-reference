const KEY="lr_school_v1";
const SUPABASE_URL="https://bsmrwupcbhwoquwjdtvi.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_ipZHSXMiaI3KGr--HWVpew_b3PpP57H";
const supabaseClient=window.supabase?.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);
let currentProfile=null;
let pedagogySelectedClassId=0;
let pedagogySelectedSubjectId=0;
let gradeEntryState={classId:0,yearId:0,period:'1er trimestre',studentId:0};
let liveMode=false;
let liveParentPortal=null;
let db=JSON.parse(localStorage.getItem(KEY)||"null")||{
 students:[],
 establishments:[
  {id:"SITE-001",name:"GROUPE SCOLAIRE LA RÉFÉRENCE — SIÈGE",city:"Cotonou, Gbèdjromèdjé"},
  {id:"SITE-002",name:"GROUPE SCOLAIRE LA RÉFÉRENCE — ANNEXE 1",city:"Cotonou, Sainte-Cécile"},
  {id:"SITE-003",name:"GROUPE SCOLAIRE LA RÉFÉRENCE — ANNEXE 2",city:"Abomey-Calavi, Akassato"}
 ],
 teachers:[{id:1,name:"Exemple Enseignant",subject:"Mathématiques",phone:""}],
 classes:[{id:1,name:"6e",level:"Collège",capacity:50}],
 payments:[], grades:[], attendance:[], parents:[],
 settings:{school:"GROUPE SCOLAIRE LA RÉFÉRENCE",director:"",phone:"",address:"Cotonou / Abomey-Calavi"}
};
db.establishments ||= [
 {id:"SITE-001",name:"GROUPE SCOLAIRE LA RÉFÉRENCE — SIÈGE",city:"Cotonou, Gbèdjromèdjè"},
 {id:"SITE-002",name:"GROUPE SCOLAIRE LA RÉFÉRENCE — ANNEXE 1",city:"Cotonou, Sainte-Cécile"},
 {id:"SITE-003",name:"GROUPE SCOLAIRE LA RÉFÉRENCE — ANNEXE 2",city:"Abomey-Calavi, Akassato"}
];
db.educmaster ||= {primaryUrl:"",secondaryUrl:"",notes:"La synchronisation directe nécessite un accès officiel/API ou un format d'échange fourni par EducMaster."};
function save(){localStorage.setItem(KEY,JSON.stringify(db));}
async function logout(){if(supabaseClient)await supabaseClient.auth.signOut();location.reload()}

function accessPage(){
 const sites=liveSites.map(s=>`<label class="site-check"><input type="checkbox" name="accessSite" value="${esc(s.id)}" checked> ${esc(s.code+" — "+s.nom)}</label>`).join("");
 return pageShell("Gestion des accès","Créer les accès et assister les parents pour leurs mots de passe", "", "", `<div class="notice">Seul l'administrateur général peut gérer les comptes et réinitialiser les mots de passe. Lorsqu'un parent se présente à l'administration, générez un mot de passe provisoire et remettez-le-lui en privé. Il devra obligatoirement choisir son propre mot de passe à sa prochaine connexion.</div><div class="card" style="margin-top:15px"><h3>Réinitialiser le mot de passe d'un parent</h3><div class="form-grid"><label class="full">Numéro de téléphone enregistré dans le dossier parent<input id="parentResetPhone" type="tel" inputmode="tel" placeholder="Ex. +229XXXXXXXX"></label></div><button class="btn primary" style="margin-top:12px" onclick="resetParentPassword()">Générer un nouveau mot de passe provisoire</button><p class="muted" id="parentResetFeedback" aria-live="polite"></p></div><div class="card" style="margin-top:15px"><h3>Créer un compte / envoyer une invitation</h3><div class="form-grid"><label>Nom<input id="accessNom" required></label><label>Prénoms<input id="accessPrenom" required></label><label>Téléphone (facultatif)<input id="accessPhone" type="tel" placeholder="+229XXXXXXXX"></label><label>Adresse e-mail (facultatif)<input id="accessEmail" type="email"></label><label>Fonction<select id="accessRole" onchange="toggleParentAccess()"><option value="secretariat">Secrétariat / Caisse</option><option value="surveillant">Surveillant</option><option value="censeur">Censeur</option><option value="direction">Directeur</option><option value="parent">Parent</option></select></label><label id="parentAccessField" class="full" style="display:none">ID du dossier parent déjà enregistré<input id="accessParentId" type="number" min="1" placeholder="Numéro du dossier parent"></label></div><div id="accessSites" style="margin-top:12px"><b>Établissement(s) autorisé(s)</b><div class="site-checks">${sites}</div></div><button class="btn primary" style="margin-top:16px" onclick="inviteAccess()">Créer le compte</button><p class="muted" id="accessFeedback" aria-live="polite"></p></div><div class="card" style="margin-top:15px"><h3>Règles de sécurité</h3><ul><li>Les rôles d'administrateur ne peuvent pas être créés depuis ce formulaire.</li><li>Un membre du personnel n'accède qu'aux établissements qui lui sont attribués.</li><li>Un compte parent est associé à un dossier parent précis.</li><li>Le mot de passe provisoire n'est communiqué qu'au parent concerné.</li></ul></div>`);
}
async function resetParentPassword(){
 if(!liveMode||currentProfile?.role!=="administrateur_general"){alert("Cette opération est réservée à l'administrateur général.");return;}
 const phone=val("parentResetPhone").trim(),feedback=document.getElementById("parentResetFeedback");
 if(!phone){feedback.textContent="Saisissez le numéro de téléphone du parent.";return;}
 if(!confirm("Confirmez-vous la réinitialisation du mot de passe du parent associé à ce numéro ?"))return;
 feedback.textContent="Génération du mot de passe provisoire…";
 const {data,error}=await supabaseClient.functions.invoke("manage-access",{body:{action:"reset_parent_password",telephone:phone}});
 if(error||data?.error){feedback.textContent="Échec : "+(data?.error||error?.message||"erreur inconnue");return;}
 feedback.innerHTML=`<b>${esc(data.nom||"")} ${esc(data.prenom||"")}</b><br>${esc(data.message||"Mot de passe provisoire généré.")}<br><br><b>Identifiant parent : ${esc(data.login_code||"")}</b><br><b>Nouveau mot de passe provisoire : ${esc(data.temporary_password||"")}</b><br><small>Remettez ces informations au parent en privé. Le mot de passe provisoire ne sera plus affiché après avoir quitté cette page.</small>`;
 document.getElementById("parentResetPhone").value="";
}

function toggleParentAccess(){const isParent=val("accessRole")==="parent";const f=document.getElementById("parentAccessField"),s=document.getElementById("accessSites");if(f)f.style.display=isParent?"block":"none";if(s)s.style.display=isParent?"none":"block";}
async function inviteAccess(){
 if(!liveMode||!supabaseClient){alert("Connectez-vous avec votre compte administrateur général.");return;}
 const role=val("accessRole");const sites=[...document.querySelectorAll('input[name="accessSite"]:checked')].map(x=>x.value);
 const payload={action:"invite",nom:val("accessNom").trim(),prenom:val("accessPrenom").trim(),email:val("accessEmail").trim(),telephone:val("accessPhone").trim(),role,etablissement_ids:role==="parent"?[]:sites,parent_id:role==="parent"?Number(val("accessParentId")):null};
 const feedback=document.getElementById("accessFeedback");if(!payload.nom||!payload.prenom||false|| (role!=="parent"&&!sites.length)||(role==="parent"&&!payload.parent_id)){feedback.textContent="Complétez le nom, le prénom et les autres champs obligatoires.";return;}
 feedback.textContent="Envoi de l'invitation en cours…";
 const {data,error}=await supabaseClient.functions.invoke("manage-access",{body:payload});
 if(error||data?.error){feedback.textContent="Échec : "+(data?.error||error?.message||"erreur inconnue");return;}
 feedback.innerHTML=(data.message||"Compte créé.")+`<br><b>Numéro de connexion : ${esc(data.login_code||"")}</b><br><b>Mot de passe provisoire : ${esc(data.temporary_password||"")}</b><br><small>Communiquez ces identifiants en privé à la personne. Elle pourra ensuite utiliser son numéro AG et ce mot de passe. Conservez-les avant de fermer cette page.</small>`;
 ["accessNom","accessPrenom","accessEmail","accessPhone","accessParentId"].forEach(id=>{const el=document.getElementById(id);if(el)el.value=""});
}

function toggleSide(){document.querySelector(".sidebar").classList.toggle("open")}
function esc(s){return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function roleAllowedPages(){
 const role=currentProfile?.role||"";
 const rules={
  administrateur_general:["dashboard","hr","groups","edition","students","teachers","classes","grades","bulletins","cards","ped-assign-teachers","ped-assign-subjects","ped-interrogations","ped-student-averages","ped-subject-averages","ped-term-averages","ped-statistics","ped-annual","payments","finance-movements","support-fees","attendance","schedule","parents","reports","settings","educmaster","access","edition-list","edition-grades","edition-debtors","edition-em-list","edition-em-notes","recycle-bin"],
  
  directeur:["dashboard","hr","groups","edition","students","teachers","classes","grades","bulletins","cards","ped-assign-teachers","ped-assign-subjects","ped-interrogations","ped-student-averages","ped-subject-averages","ped-term-averages","ped-statistics","ped-annual","payments","finance-movements","support-fees","attendance","schedule","parents","reports","settings","educmaster","edition-list","edition-grades","edition-debtors","edition-em-list","edition-em-notes"],
  direction:["dashboard","hr","groups","edition","students","teachers","classes","grades","bulletins","cards","ped-assign-teachers","ped-assign-subjects","ped-interrogations","ped-student-averages","ped-subject-averages","ped-term-averages","ped-statistics","ped-annual","payments","finance-movements","support-fees","attendance","schedule","parents","reports","settings","educmaster","edition-list","edition-grades","edition-debtors","edition-em-list","edition-em-notes"],
  censeur:["dashboard","groups","edition","students","teachers","classes","grades","bulletins","cards","ped-assign-teachers","ped-assign-subjects","ped-interrogations","ped-student-averages","ped-subject-averages","ped-term-averages","ped-statistics","ped-annual","attendance","schedule","reports"],
  enseignant:["dashboard","students","grades","schedule","ped-interrogations","ped-student-averages","ped-subject-averages","ped-term-averages","ped-statistics","ped-annual","attendance","reports"],professeur:["dashboard","students","grades","schedule","ped-interrogations","ped-student-averages","ped-subject-averages","ped-term-averages","ped-statistics","ped-annual","attendance","reports"],
  comptable:["dashboard","students","payments","finance-movements","support-fees","reports"],caissier:["dashboard","students"],
  surveillant:["dashboard","students","attendance","schedule"],
  secretariat:["dashboard","students","classes","parents","cards","attendance","schedule","payments","finance-movements","support-fees","reports"],secretaire:["dashboard","students","classes","parents","cards","attendance","schedule","payments","finance-movements","support-fees","reports"],secretariat_caisse:["dashboard","students","classes","parents","cards","attendance","schedule","reports"],
  parent:["dashboard","parents"]
 };
 return new Set(rules[role]||["dashboard"]);
}
function applyRoleNavigation(){
 const allowed=roleAllowedPages();
 document.querySelectorAll(".sidebar nav button[data-page]").forEach(b=>{b.style.display=allowed.has(b.dataset.page)?"block":"none";});
 document.querySelectorAll(".sidebar nav details.nav-group,.sidebar nav details.sub-group").forEach(g=>{
  const visible=[...g.querySelectorAll("button[data-page]")].some(b=>allowed.has(b.dataset.page));
  g.style.display=visible?"":"none";
 });
}
function showPage(p){
 if(!roleAllowedPages().has(p)){alert("Cette rubrique n’est pas autorisée pour votre fonction.");return;}
 if(currentProfile?.role==="parent" && !["dashboard","parents"].includes(p)){alert("Votre compte parent permet uniquement de consulter les informations de vos enfants.");return;}
 if(["access","recycle-bin"].includes(p) && currentProfile?.role!=="administrateur_general"){alert("Cette rubrique est réservée à l’administrateur général.");return;}
 document.querySelectorAll(".sidebar nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===p));
 const titles={dashboard:"Tableau de bord",hr:"Gestion du personnel et RH",groups:"Groupes pédagogiques",edition:"Édition par classe",students:"Élèves",teachers:"Enseignants",classes:"Classes",grades:"Saisie de notes par matière / classe",bulletins:"Bulletins scolaires",cards:"Cartes scolaires",payments:"Paiements",attendance:"Présences",schedule:"Emploi du temps",parents:"Parents",reports:"Rapports",settings:"Paramètres",educmaster:"ÉducMaster",access:"Gestion des accès",
 "ped-assign-teachers":"Affectation des enseignants","ped-assign-subjects":"Affectation des matières","ped-interrogations":"Moyenne des interrogations","ped-student-averages":"Moyenne par apprenant","ped-subject-averages":"Moyennes par matière","ped-term-averages":"Moyennes générales par classe et par session","ped-statistics":"Statistiques scolaires trimestrielles par classe","ped-annual":"Moyennes annuelles et passage","edition-list":"Liste par classe","edition-grades":"Fiche de notes","edition-debtors":"Liste des impayés","edition-em-list":"Liste pour EDUCMASTER","edition-em-notes":"Notes pour EDUCMASTER","recycle-bin":"Corbeille générale"};
 document.getElementById("pageTitle").textContent=titles[p]||p;
 const accessNav=document.querySelector('button[data-page="access"]');if(accessNav)accessNav.style.display=currentProfile?.role==="administrateur_general"?"block":"none";
 applyRoleNavigation();
 document.getElementById("content").innerHTML=(p==="groups"?groupsPage():(p==="hr"?hrPage():(pages[p]||pages.dashboard)()));
 if(["groups","grades","schedule","attendance","students","teachers","classes","bulletins","cards","ped-assign-teachers","ped-assign-subjects","ped-interrogations","ped-student-averages","ped-subject-averages","ped-term-averages","ped-statistics","ped-annual"].includes(p)) addPagePrintExport(p);
 if(p==="recycle-bin")refreshRecycleBin();if(p==="edition-list")refreshEditionView();if(p==="edition-grades")refreshEditionGradeSheet();if(p==="edition-debtors")refreshEditionDebtors();if(p==="edition-em-list")refreshEmList();if(p==="edition-em-notes")refreshEmNotes();
 if(currentProfile?.role==="parent"){
  document.querySelectorAll(".sidebar nav button[data-page]").forEach(b=>{b.style.display=["dashboard","parents"].includes(b.dataset.page)?"block":"none";});
  document.querySelectorAll(".sidebar nav details").forEach(d=>d.style.display="none");
 }
 document.getElementById("today").textContent=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"});
}

function addPagePrintExport(pageKey){
 const host=document.getElementById("content");if(!host||host.querySelector(".page-export-tools"))return;
 const head=host.querySelector(".page-head");if(!head)return;
 const tools=document.createElement("div");tools.className="page-export-tools";tools.style.cssText="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 14px;justify-content:flex-end";
 tools.innerHTML='<button type="button" class="btn light" onclick="printCurrentPage()">Imprimer</button><button type="button" class="btn light" onclick="exportCurrentTables()">Exporter Excel (CSV)</button><button type="button" class="btn light" onclick="exportCurrentPDF()">Exporter PDF</button>';
 head.insertAdjacentElement("afterend",tools);
}
function printCurrentPage(){
 const content=document.getElementById("content");if(!content)return;
 const clone=content.cloneNode(true);clone.querySelectorAll("button,.page-export-tools,.modal,.notice").forEach(x=>x.remove());
 const w=window.open("","_blank");if(!w)return alert("Autorisez les fenêtres contextuelles pour imprimer.");
 w.document.write('<!doctype html><html lang="fr"><meta charset="utf-8"><title>LA RÉFÉRENCE — Impression pédagogique</title><style>@page{size:A4;margin:12mm}body{font:10pt Arial;color:#111}h2,h3{text-align:center}table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #777;padding:6px;text-align:left}button{display:none}.card{margin:10px 0;padding:8px;border:1px solid #bbb}.page-head p{margin:4px 0}</style>'+clone.innerHTML+'<script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></html>');w.document.close();
}
function exportCurrentTables(){
 const tables=[...document.querySelectorAll("#content table")];if(!tables.length)return alert("Aucun tableau à exporter sur cette page.");
 const rows=[];tables.forEach((t,idx)=>{rows.push(["Tableau "+(idx+1)]);t.querySelectorAll("tr").forEach(tr=>rows.push([...tr.children].map(c=>c.innerText.trim())));rows.push([])});
 const csv="\uFEFF"+rows.map(r=>r.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(";")).join("\r\n");
 const blob=new Blob([csv],{type:"text/csv;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="la-reference-"+document.querySelector("#pageTitle")?.textContent.toLowerCase().replace(/[^a-z0-9]+/g,"-")+".csv";a.click();URL.revokeObjectURL(a.href);
}
function exportCurrentPDF(){printCurrentPage();}

function pageShell(title,sub,button,onclick,body){return `<div class="page"><div class="page-head"><div><h2>${title}</h2><p>${sub}</p></div>${button?`<button class="btn primary" onclick="${onclick}">${button}</button>`:""}</div>${body}</div>`}
function stat(label,value){return `<div class="card"><div class="muted">${label}</div><div class="metric">${value}</div></div>`}
const pages={
 groups:()=>groupsPage(),
 edition:()=>classEditionPage(),
 dashboard:()=>currentProfile?.role==="parent"?parentPortalPage():`<div class="page"><div class="page-head"><div><h2>Bienvenue dans LA RÉFÉRENCE</h2><p>Centre de contrôle de votre établissement.</p></div></div><div class="card accueil-hero" style="padding:0;overflow:hidden;margin-bottom:16px"><img src="accueil-classe.jpg" alt="Groupe scolaire LA RÉFÉRENCE — Discipline, Travail, Réussite" style="display:block;width:100%;max-height:360px;object-fit:cover"><div style="padding:12px 16px"><strong>Discipline · Travail · Réussite</strong><p class="muted" style="margin:4px 0 0">Ensemble pour une éducation de qualité</p></div></div>${liveMode?`<div class="notice">Connexion sécurisée active · ${esc(currentProfile?.role||"Utilisateur")} · données consultées depuis Supabase</div>`:`<div class="notice">Mode local de démonstration — aucune connexion à la base de données.</div>`}<div class="cards">${stat("Élèves",db.students.length)}${stat("Enseignants",db.teachers.length)}${stat("Classes",db.classes.length)}${stat("Paiements",db.payments.length)}</div><div class="dashboard-grid"><div class="card"><h3>Fonctionnalités</h3><p>Gérez les élèves, enseignants, classes, notes, paiements, présences, parents et rapports depuis cette interface.</p><div class="notice">Les données affichées proviennent de Supabase et sont filtrées selon l’établissement sélectionné.</div></div><div class="card"><h3>État</h3><p>🟢 Interface opérationnelle</p><p>🔐 Session sécurisée Supabase</p><p>📱 Compatible téléphone</p></div></div><div class="footer-note">LA RÉFÉRENCE — Gestion scolaire</div></div>`,
 students:()=>studentsPage(),
 bulletins:()=>bulletinsPage(),
 cards:()=>cardsPage(),
 teachers:()=>listPage("Enseignants","Gestion du personnel enseignant","Ajouter un enseignant","teacher",db.teachers,["Matricule","Nom","Matière","Téléphone"]),
 classes:()=>listPage("Classes","Classes et niveaux","Ajouter une classe","class",db.classes,["Classe","Niveau","Capacité"]),
 parents:()=>currentProfile?.role==="parent"?parentPortalPage():listPage("Parents","Contacts des parents/tuteurs","Ajouter un parent","parent",db.parents,["Nom","Élève","Téléphone","Email"]),
 payments:()=>paymentsPage(),
 "finance-movements":()=>financeMovementsPage(),
 grades:()=>pedagogicGridPage("class"),
 "ped-assign-teachers":()=>pedagogicAssignmentsPage("teachers"),
 "ped-assign-subjects":()=>pedagogicAssignmentsPage("subjects"),
 "ped-interrogations":()=>interrogationEntryPage(),
 "ped-student-averages":()=>pedagogicGridPage("student"),
 "ped-subject-averages":()=>pedagogicGridPage("subject"),
 "ped-term-averages":()=>pedagogySessionAveragesPage(), "ped-statistics":()=>pedagogyClassStatsPage(), "ped-statistics":()=>pedagogyClassStatsPage(),
 "ped-annual":()=>pedagogicAveragePage("annual"),
 "edition-list":()=>editionRosterPage(),
 "edition-grades":()=>editionGradeSheetPage(),
 "edition-debtors":()=>editionDebtorsPage(),
 "edition-em-list":()=>editionEducMasterListPage(),
 "edition-em-notes":()=>editionEducMasterNotesPage(),
 attendance:()=>attendancePage(),
 reports:()=>pageShell("Rapports","Synthèse de l'établissement","","",`<div class="cards">${stat("Total élèves",db.students.length)}${stat("Total enseignants",db.teachers.length)}${stat("Total classes",db.classes.length)}${stat("Paiements enregistrés",db.payments.length)}</div><div class="card" style="margin-top:15px"><h3>Exporter les données</h3><p class="muted">Téléchargez une copie JSON de la base locale pour sauvegarde.</p><button class="btn primary" onclick="exportData()">Exporter la sauvegarde</button></div>`),
 schedule:()=>schedulePage(),
 access:()=>accessPage(),
 "recycle-bin":()=>recycleBinPage(),
 hr:()=>hrPage(),
 educmaster:()=>educMasterPage(),
 settings:()=>{const s=currentSite()||{};return pageShell("Paramètres","Informations de l'établissement sélectionné","Enregistrer","saveSettings",`<div class="card"><div class="form-grid"><label>Nom de l'établissement<input id="setSchool" value="${esc(s.nom||db.settings.school)}"></label><label>Directeur<input id="setDirector" value="${esc(s.directeur||db.settings.director)}"></label><label>Téléphone<input id="setPhone" value="${esc(s.telephone||db.settings.phone)}"></label><label>Adresse<input id="setAddress" value="${esc(s.adresse||db.settings.address)}"></label></div></div>`) }
};
function recycleBinPage(){return pageShell("Corbeille générale","Restauration des notes et présences archivées — accès administrateur général","Actualiser","refreshRecycleBin()",'<div id="recycleBinContent" class="notice">Chargement de la corbeille…</div>');}
async function refreshRecycleBin(){
 if(currentProfile?.role!=="administrateur_general")return;
 const target=document.getElementById("recycleBinContent");if(!target)return;
 const {data,error}=await supabaseClient.from("corbeille_generale").select("id,table_origine,enregistrement_id,donnees,supprime_le,restaure_le,purge_le").eq("etablissement_id",activeSiteId).is("restaure_le",null).is("purge_le",null).order("supprime_le",{ascending:false});
 if(error){target.innerHTML=`Impossible de charger la corbeille : ${esc(error.message)}`;return;}
 const rows=(data||[]).map(x=>{const d=x.donnees||{};const label=x.table_origine==="notes"?`Note de l’élève #${d.eleve_id} — ${d.note??""}/20`:`Présence de l’élève #${d.eleve_id} — ${d.statut||""} (${d.date_presence||""})`;return `<tr><td>${esc(x.table_origine)}</td><td>${esc(label)}</td><td>${new Date(x.supprime_le).toLocaleString("fr-FR")}</td><td><button class="btn primary" onclick="restoreRecycleItem('${x.id}')">Restaurer</button> <button class="btn danger" onclick="purgeRecycleItem('${x.id}')">Supprimer définitivement</button></td></tr>`}).join("");
 target.innerHTML=`<div class="notice">Les notes et présences archivées sont conservées ici. Les autres catégories (élèves, personnel, classes, paiements et reçus) ne sont pas encore prises en charge par cette corbeille.</div><div class="table-wrap"><table class="table"><thead><tr><th>Type</th><th>Élément</th><th>Date d’archivage</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="empty">Aucun élément archivé.</td></tr>'}</tbody></table></div>`;
}
async function restoreRecycleItem(id){if(currentProfile?.role!=="administrateur_general")return alert("Accès réservé à l’administrateur général.");if(!confirm("Restaurer cet élément ?"))return;const {error}=await supabaseClient.rpc("corbeille_restaurer",{p_corbeille_id:id});if(error){notifyError("Restauration",error);return;}await loadLiveData();showPage("recycle-bin");}
async function purgeRecycleItem(id){if(currentProfile?.role!=="administrateur_general")return alert("Accès réservé à l’administrateur général.");if(!confirm("Suppression définitive irréversible. Confirmez-vous ?"))return;const {error}=await supabaseClient.rpc("corbeille_purger",{p_corbeille_id:id});if(error){notifyError("Suppression définitive",error);return;}showPage("recycle-bin");}

function parentPortalPage(){
 const p=liveParentPortal||{parent:null,enfants:[]};
 const children=(p.enfants||[]).map(e=>{
  const grades=(e.notes||[]).map(n=>`<tr><td>${esc(n.matiere||"Matière")}</td><td>${n.note===null?"—":esc(n.note)+"/20"}</td><td>${esc(n.periode||"—")}</td><td>${esc(n.type||"—")}</td></tr>`).join("");
  const fees=(e.echeances||[]).map(x=>`<tr><td>${esc(x.tranche)} · ${esc(x.libelle||"")}</td><td>${x.date?new Date(x.date+"T00:00:00").toLocaleDateString("fr-FR"):"À l'inscription"}</td><td>${Number(x.net||0).toLocaleString("fr-FR")} F</td><td>${Number(x.paye||0).toLocaleString("fr-FR")} F</td><td><b>${Number(x.reste||0).toLocaleString("fr-FR")} F</b></td></tr>`).join("");
  const pres=(e.presences||[]).map(x=>`<tr><td>${x.date?new Date(x.date+"T00:00:00").toLocaleDateString("fr-FR"):"—"}</td><td>${esc(x.statut)}</td><td>${esc(x.motif||"—")}</td></tr>`).join("");
  return `<section class="card" style="margin-top:16px"><h3>${esc(e.nom)} ${esc(e.prenoms)}</h3><p class="muted">${esc(e.etablissement||"")} · ${esc(e.classe||"Classe non affectée")} · Matricule ${esc(e.matricule||"—")} · ÉducMaster ${esc(e.numero_educmaster||"—")}</p><h4>Notes scolaires</h4><div class="table-wrap"><table class="table"><thead><tr><th>Matière</th><th>Note</th><th>Période</th><th>Évaluation</th></tr></thead><tbody>${grades||'<tr><td colspan="4" class="empty">Aucune note publiée.</td></tr>'}</tbody></table></div><h4 style="margin-top:18px">Situation de scolarité</h4><div class="table-wrap"><table class="table"><thead><tr><th>Tranche</th><th>Échéance</th><th>Net dû</th><th>Payé</th><th>Reste</th></tr></thead><tbody>${fees||'<tr><td colspan="5" class="empty">Aucun échéancier disponible.</td></tr>'}</tbody></table></div><h4 style="margin-top:18px">Présences récentes</h4><div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Statut</th><th>Motif</th></tr></thead><tbody>${pres||'<tr><td colspan="3" class="empty">Aucune présence enregistrée.</td></tr>'}</tbody></table></div></section>`;
 }).join("");
 return pageShell("Espace parents","Consultation privée des notes, de la scolarité et des présences de vos enfants","Actualiser","refreshParentPortal()",`<div class="notice">Bienvenue ${esc([p.parent?.nom,p.parent?.prenoms].filter(Boolean).join(" ")||"")}. Vous consultez uniquement les dossiers des enfants associés à votre compte. Les bulletins ne sont pas téléchargeables depuis cet espace.</div>${children||'<div class="card"><p>Aucun enfant n’est encore associé à ce compte. Contactez le secrétariat de l’établissement.</p></div>'}`);
}
async function refreshParentPortal(){const {data,error}=await supabaseClient.rpc("portail_parent_donnees");if(error){notifyError("Actualisation de l'espace parents",error);return;}liveParentPortal=data||{parent:null,enfants:[]};showPage("dashboard");}

function hrPersonName(id){const p=liveHR.personnel.find(x=>Number(x.id)===Number(id));return p?[p.nom,p.prenoms].filter(Boolean).join(" "):"Personnel #"+id;}
function hrPage(){
 const fmt=n=>Number(n||0).toLocaleString("fr-FR");
 const staff=liveHR.personnel.map(p=>`<tr><td>${esc(p.matricule||"—")}</td><td>${esc(p.nom)} ${esc(p.prenoms)}</td><td>${esc(p.fonction)}</td><td>${esc(p.telephone||"—")}</td><td>${esc(p.mode_remuneration)}</td><td>${esc(p.statut)}</td></tr>`).join("");
 const payroll=liveHR.paies.map(p=>`<tr><td>${esc(hrPersonName(p.personnel_id))}</td><td>${new Date(p.periode+"T00:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</td><td>${fmt(p.net_a_payer)} F</td><td>${fmt(p.montant_paye)} F</td><td>${esc(p.statut)}</td><td>${p.statut==="paye"?`<button class="btn light" onclick="printPayrollSlip(${p.id})">Imprimer</button>`:`<button class="btn light" onclick="markPayrollPaid(${p.id})">Marquer payée</button>`}</td></tr>`).join("");
 const abs=liveHR.absences.map(a=>`<tr><td>${esc(hrPersonName(a.personnel_id))}</td><td>${esc(a.type_absence)}</td><td>${new Date(a.date_debut).toLocaleDateString("fr-FR")}</td><td>${a.date_fin?new Date(a.date_fin).toLocaleDateString("fr-FR"):"—"}</td><td>${esc(a.statut)}</td><td>${esc(a.motif||"")}</td><td>${a.statut==="en_attente"?`<button class="btn light" onclick="reviewHRAbsence(${a.id},'approuvee')">Approuver</button> <button class="btn danger" onclick="reviewHRAbsence(${a.id},'refusee')">Refuser</button>`:"—"}</td></tr>`).join("");
 const apps=liveHR.candidatures.map(a=>`<tr><td>${esc(a.nom)} ${esc(a.prenoms)}</td><td>${esc(a.poste_souhaite)}</td><td>${esc(a.telephone||"—")}</td><td><select onchange="updateCandidateStatus(${a.id},this.value)">${["nouveau","a_etudier","entretien","attente","accepte","refuse"].map(v=>`<option value="${v}" ${a.statut===v?"selected":""}>${v.replaceAll("_"," ")}</option>`).join("")}</select></td><td>${a.statut==="accepte"?"Converti si besoin":`<button class="btn light" onclick="convertCandidate(${a.id})">Créer le dossier du personnel</button>`}</td></tr>`).join("");
 return pageShell("Gestion du personnel et RH","Dossiers du personnel, contrats, vacations, paies, avances, absences et recrutement","Actualiser","refreshHR()",`<div class="cards">${stat("Personnel actif",liveHR.personnel.filter(x=>x.statut==="actif").length)}${stat("Candidatures",liveHR.candidatures.length)}${stat("Absences en attente",liveHR.absences.filter(x=>x.statut==="en_attente").length)}${stat("Paies à régler",liveHR.paies.filter(x=>x.statut!=="paye").length)}</div>
 <div class="card" style="margin-top:15px"><div class="toolbar"><h3>Dossiers du personnel</h3><button class="btn primary" onclick="openHRForm('personnel')">Ajouter un membre du personnel</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Matricule</th><th>Nom</th><th>Fonction</th><th>Téléphone</th><th>Rémunération</th><th>Statut</th></tr></thead><tbody>${staff||`<tr><td colspan="6" class="empty">Aucun dossier du personnel dans cet établissement.</td></tr>`}</tbody></table></div></div>
 <div class="card" style="margin-top:15px"><div class="toolbar"><h3>Recrutement et candidatures</h3><button class="btn primary" onclick="openHRForm('candidature')">Nouvelle candidature</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Candidat</th><th>Poste</th><th>Téléphone</th><th>Statut</th><th>Action</th></tr></thead><tbody>${apps||`<tr><td colspan="5" class="empty">Aucune candidature.</td></tr>`}</tbody></table></div></div>
 <div class="card" style="margin-top:15px"><div class="toolbar"><h3>Contrats et rémunérations</h3><button class="btn light" onclick="openHRForm('contrat')">Ajouter un contrat</button><button class="btn light" onclick="openHRForm('vacation')">Saisir une vacation</button><button class="btn light" onclick="openHRForm('paie')">Préparer une paie</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Personnel</th><th>Période</th><th>Net à payer</th><th>Versé</th><th>État</th><th>Action</th></tr></thead><tbody>${payroll||`<tr><td colspan="6" class="empty">Aucune paie préparée.</td></tr>`}</tbody></table></div></div>
 <div class="card" style="margin-top:15px"><div class="toolbar"><h3>Congés, absences et permissions</h3><button class="btn primary" onclick="openHRForm('absence')">Enregistrer une absence / permission</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Personnel</th><th>Type</th><th>Début</th><th>Fin</th><th>Statut</th><th>Motif</th><th>Décision</th></tr></thead><tbody>${abs||`<tr><td colspan="7" class="empty">Aucune absence enregistrée.</td></tr>`}</tbody></table></div></div>
 <div class="card" style="margin-top:15px"><div class="toolbar"><h3>Avances et prêts</h3><button class="btn light" onclick="openHRForm('avance')">Enregistrer une avance / un prêt</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Personnel</th><th>Type</th><th>Montant initial</th><th>Reste</th><th>Mensualité</th><th>Statut</th><th>Action</th></tr></thead><tbody>${liveHR.avances.map(a=>`<tr><td>${esc(hrPersonName(a.personnel_id))}</td><td>${esc(a.type_operation)}</td><td>${fmt(a.montant_initial)} F</td><td>${fmt(a.montant_restant)} F</td><td>${fmt(a.mensualite_prevue)} F</td><td>${esc(a.statut)}</td><td>${Number(a.montant_restant)>0?`<button class="btn light" onclick="openAdvanceRepayment(${a.id})">Rembourser</button>`:"Soldé"}</td></tr>`).join("")||`<tr><td colspan="7" class="empty">Aucune avance ou prêt.</td></tr>`}</tbody></table></div></div>`);
}
async function refreshHR(){await loadLiveData();showPage("hr")}
function openHRForm(type){
 const people=liveHR.personnel.map(p=>`<option value="${p.id}">${esc(p.nom)} ${esc(p.prenoms)} · ${esc(p.fonction)}</option>`).join("");
 const forms={
 personnel:`<div class="form-grid"><label>Nom<input id="hrNom" required></label><label>Prénoms<input id="hrPrenom" required></label><label>Fonction<input id="hrFonction" required></label><label>Téléphone<input id="hrPhone"></label><label>E-mail<input id="hrEmail" type="email"></label><label>Date de recrutement<input id="hrRecruit" type="date"></label><label>Mode de rémunération<select id="hrMode"><option value="mensuel">Mensuel</option><option value="vacation">Vacation</option><option value="mixte">Mixte</option></select></label></div>`,
 candidature:`<div class="form-grid"><label>Nom<input id="hrNom" required></label><label>Prénoms<input id="hrPrenom" required></label><label>Poste souhaité<input id="hrFonction" required></label><label>Téléphone<input id="hrPhone"></label><label>E-mail<input id="hrEmail" type="email"></label><label class="full">Expérience<textarea id="hrExperience"></textarea></label></div>`,
 contrat:`<div class="form-grid"><label>Personnel<select id="hrPerson">${people}</select></label><label>Type de contrat<input id="hrContractType" value="CDD"></label><label>Début<input id="hrStart" type="date" required></label><label>Fin (facultatif)<input id="hrEnd" type="date"></label><label>Salaire de base (FCFA)<input id="hrSalary" type="number" min="0" value="0"></label></div>`,
 vacation:`<div class="form-grid"><label>Personnel<select id="hrPerson">${people}</select></label><label>Date<input id="hrDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Description<input id="hrDescription"></label><label>Quantité<input id="hrQty" type="number" min="0.01" step="0.01" value="1"></label><label>Unité<select id="hrUnit"><option value="heure">Heure</option><option value="cours">Cours</option><option value="jour">Jour</option></select></label><label>Tarif unitaire (FCFA)<input id="hrRate" type="number" min="0" value="0"></label></div>`,
 paie:`<div class="form-grid"><label>Personnel<select id="hrPerson">${people}</select></label><label>Période (1er du mois)<input id="hrPeriod" type="date" value="${new Date().toISOString().slice(0,7)}-01"></label><label>Salaire de base<input id="hrSalary" type="number" min="0" value="0"></label><label>Primes<input id="hrBonus" type="number" min="0" value="0"></label><label>Vacations<input id="hrVacation" type="number" min="0" value="0"></label><label>Retenues<input id="hrDeduct" type="number" min="0" value="0"></label></div>`,
 absence:`<div class="form-grid"><label>Personnel<select id="hrPerson">${people}</select></label><label>Type<select id="hrAbsType"><option value="conge">Congé</option><option value="maladie">Maladie</option><option value="permission">Permission</option><option value="sortie">Sortie</option><option value="absence">Absence</option></select></label><label>Début<input id="hrAbsStart" type="datetime-local" required></label><label>Fin<input id="hrAbsEnd" type="datetime-local"></label><label class="full">Motif<textarea id="hrAbsReason"></textarea></label></div>`,
 avance:`<div class="form-grid"><label>Personnel<select id="hrPerson">${people}</select></label><label>Type<select id="hrAdvanceType"><option value="avance">Avance</option><option value="pret">Prêt</option></select></label><label>Montant initial<input id="hrAmount" type="number" min="1"></label><label>Mensualité prévue<input id="hrMonthly" type="number" min="1"></label><label>Date d'accord<input id="hrDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label class="full">Motif<textarea id="hrReason"></textarea></label></div>`
 };
 if(!liveHR.personnel.length&&!['personnel','candidature'].includes(type))return alert("Ajoutez d'abord un membre du personnel.");
 document.getElementById("modalTitle").textContent=({personnel:"Nouveau dossier du personnel",candidature:"Nouvelle candidature",contrat:"Nouveau contrat",vacation:"Prestation / vacation",paie:"Préparer une paie",absence:"Absence ou permission",avance:"Avance ou prêt"})[type];
 document.getElementById("modalBody").innerHTML=forms[type]+`<button class="btn primary" onclick="saveHRRecord('${type}')">Enregistrer</button>`;document.getElementById("modal").classList.remove("hidden");
}
async function saveHRRecord(type){
 const site=activeSiteId;let table,payload;
 if(type==='personnel'){table='personnel';payload={etablissement_id:site,nom:val('hrNom').trim(),prenoms:val('hrPrenom').trim(),fonction:val('hrFonction').trim(),telephone:val('hrPhone')||null,email:val('hrEmail')||null,date_recrutement:val('hrRecruit')||null,mode_remuneration:val('hrMode'),statut:'actif'};}
 if(type==='candidature'){table='candidatures_personnel';payload={etablissement_id:site,nom:val('hrNom').trim(),prenoms:val('hrPrenom').trim(),poste_souhaite:val('hrFonction').trim(),telephone:val('hrPhone')||null,email:val('hrEmail')||null,experience:val('hrExperience')||null,diplomes:{},statut:'nouveau'};}
 if(type==='contrat'){table='contrats_personnel';payload={etablissement_id:site,personnel_id:Number(val('hrPerson')),type_contrat:val('hrContractType'),date_debut:val('hrStart'),date_fin:val('hrEnd')||null,salaire_base:Number(val('hrSalary')),devise:'FCFA',actif:true};}
 if(type==='vacation'){const q=Number(val('hrQty')),rate=Number(val('hrRate'));table='prestations_vacations';payload={etablissement_id:site,personnel_id:Number(val('hrPerson')),date_prestation:val('hrDate'),description:val('hrDescription')||null,quantite:q,unite:val('hrUnit'),tarif_unitaire:rate,montant_total:q*rate,statut:'en_attente'};}
 if(type==='paie'){const base=Number(val('hrSalary')),bonus=Number(val('hrBonus')),vac=Number(val('hrVacation')),ded=Number(val('hrDeduct'));if(base+bonus+vac<ded)return alert('Les retenues dépassent la rémunération brute.');table='paies_personnel';payload={etablissement_id:site,personnel_id:Number(val('hrPerson')),periode:val('hrPeriod'),salaire_base:base,total_primes:bonus,total_vacations:vac,total_retenues:ded,net_a_payer:base+bonus+vac-ded,montant_paye:0,statut:'a_payer'};}
 if(type==='absence'){table='absences_personnel';const {data:u}=await supabaseClient.auth.getUser();payload={etablissement_id:site,personnel_id:Number(val('hrPerson')),type_absence:val('hrAbsType'),date_debut:new Date(val('hrAbsStart')).toISOString(),date_fin:val('hrAbsEnd')?new Date(val('hrAbsEnd')).toISOString():null,motif:val('hrAbsReason')||null,statut:'en_attente',demande_par:u.user.id};}
 if(type==='avance'){const amount=Number(val('hrAmount'));table='avances_prets_personnel';const {data:u}=await supabaseClient.auth.getUser();payload={etablissement_id:site,personnel_id:Number(val('hrPerson')),type_operation:val('hrAdvanceType'),montant_initial:amount,montant_restant:amount,date_accord:val('hrDate'),mensualite_prevue:Number(val('hrMonthly')),motif:val('hrReason')||null,autorise_par:u.user.id,statut:'en_cours'};}
 if(!payload||Object.values(payload).some(v=>v===undefined)||!site)return alert('Vérifiez les champs obligatoires.');
 if(['personnel','candidature'].includes(type)&&(!payload.nom||!payload.prenoms))return alert('Nom et prénoms obligatoires.');
 const {error}=await supabaseClient.from(table).insert(payload);if(error){notifyError('Enregistrement RH',error);return;}
 closeModal();await loadLiveData();showPage('hr');alert('Enregistrement effectué.');
}
async function reviewHRAbsence(id,status){const {data:u}=await supabaseClient.auth.getUser();if(!confirm("Confirmer cette décision ?"))return;const {error}=await supabaseClient.from("absences_personnel").update({statut,validee_par:u.user.id}).eq("id",id);if(error){notifyError("Validation absence",error);return;}await refreshHR();}
async function markPayrollPaid(id){const p=liveHR.paies.find(x=>Number(x.id)===Number(id));if(!p)return;const rest=Number(p.net_a_payer)-Number(p.montant_paye);if(rest<=0)return; if(!confirm(`Confirmer le règlement de ${rest.toLocaleString("fr-FR")} FCFA ?`))return;const ref="RH-"+new Date().toISOString().slice(0,10).replaceAll("-","")+"-"+Math.random().toString(36).slice(2,8).toUpperCase();const {error}=await supabaseClient.from("paies_personnel").update({montant_paye:p.net_a_payer,date_paiement:new Date().toISOString().slice(0,10),statut:"paye",reference:ref}).eq("id",id);if(error){notifyError("Règlement de paie",error);return;}await refreshHR();alert("Paie enregistrée comme réglée. Référence : "+ref);}
function openAdvanceRepayment(id){const a=liveHR.avances.find(x=>Number(x.id)===Number(id));if(!a)return;document.getElementById("modalTitle").textContent="Remboursement avance / prêt";document.getElementById("modalBody").innerHTML=`<p>Solde restant : <b>${Number(a.montant_restant).toLocaleString("fr-FR")} FCFA</b></p><label>Montant remboursé<input id="hrRepayAmount" type="number" min="1" max="${a.montant_restant}" value="${Math.min(Number(a.mensualite_prevue),Number(a.montant_restant))}"></label><label>Référence facultative<input id="hrRepayRef"></label><button class="btn primary" onclick="submitAdvanceRepayment(${id})">Enregistrer</button>`;document.getElementById("modal").classList.remove("hidden");}
async function submitAdvanceRepayment(id){const amount=Number(val("hrRepayAmount"));if(amount<=0)return alert("Montant invalide.");const {data,error}=await supabaseClient.rpc("enregistrer_remboursement_avance",{p_avance_id:Number(id),p_montant:amount,p_reference:val("hrRepayRef")||null});if(error){notifyError("Remboursement refusé",error);return;}closeModal();await refreshHR();alert("Solde restant : "+Number(data).toLocaleString("fr-FR")+" FCFA.");}
function printPayrollSlip(id){const p=liveHR.paies.find(x=>Number(x.id)===Number(id));if(!p)return;const person=liveHR.personnel.find(x=>Number(x.id)===Number(p.personnel_id));const w=window.open("","_blank");if(!w)return alert("Autorisez les fenêtres contextuelles.");w.document.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Bulletin de paie</title><style>body{font-family:Arial;padding:24px}.sheet{max-width:680px;margin:auto;border:1px solid #333;padding:24px}td{padding:8px;border-bottom:1px solid #ddd}</style><div class="sheet"><h2>GROUPE SCOLAIRE LA RÉFÉRENCE</h2><h3>BULLETIN DE PAIE</h3><p>${esc(person?.nom||"")} ${esc(person?.prenoms||"")} — ${esc(person?.fonction||"")}</p><p>Période : ${new Date(p.periode+"T00:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</p><table><tr><td>Salaire de base</td><td>${Number(p.salaire_base).toLocaleString("fr-FR")} FCFA</td></tr><tr><td>Primes</td><td>${Number(p.total_primes).toLocaleString("fr-FR")} FCFA</td></tr><tr><td>Vacations</td><td>${Number(p.total_vacations).toLocaleString("fr-FR")} FCFA</td></tr><tr><td>Retenues</td><td>${Number(p.total_retenues).toLocaleString("fr-FR")} FCFA</td></tr><tr><td><b>Net à payer</b></td><td><b>${Number(p.net_a_payer).toLocaleString("fr-FR")} FCFA</b></td></tr><tr><td>Référence</td><td>${esc(p.reference||"—")}</td></tr></table><p style="margin-top:55px">Signature et cachet</p><button onclick="print()">Imprimer</button></div></html>`);w.document.close();w.print();}
async function updateCandidateStatus(id,status){const {error}=await supabaseClient.from('candidatures_personnel').update({statut}).eq('id',id);if(error){notifyError('Mise à jour candidature',error);return;}await refreshHR();}
async function convertCandidate(id){
 const c=liveHR.candidatures.find(x=>Number(x.id)===Number(id));if(!c)return;
 if(!confirm(`Créer un dossier du personnel pour ${c.nom} ${c.prenoms} ?`))return;
 const {data,error}=await supabaseClient.from('personnel').insert({etablissement_id:activeSiteId,nom:c.nom,prenoms:c.prenoms,telephone:c.telephone,email:c.email,fonction:c.poste_souhaite,mode_remuneration:'mensuel',statut:'actif'}).select('id').single();
 if(error){notifyError('Conversion candidature',error);return;}
 const {error:updateError}=await supabaseClient.from('candidatures_personnel').update({statut:'accepte',converti_personnel_id:data.id}).eq('id',id);
 if(updateError){notifyError('Dossier créé mais candidature non mise à jour',updateError);return;}
 await refreshHR();alert('Candidat converti en dossier du personnel.');
}
function editionClassFilter(id='editionClassFilter'){
 return `<label>Établissement<input value="${esc(currentSite()?.nom||'Établissement sélectionné')}" disabled></label><label>Année scolaire<input value="${esc(currentSchoolYear())}" disabled></label><label>Classe<select id="${id}" onchange="refreshEditionView()"><option value="">Toutes les classes</option>${classSelectOptions()}</select></label>`;
}
function editionActiveStudents(classId=''){
 return db.students.filter(s=>s.status!=='ancien'&&s.status!=='exclu'&&(!classId||String(s.classId)===String(classId))).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
}
function editionSexCounts(students){const girls=students.filter(s=>String(s.sex||'').toLowerCase().startsWith('f')).length;return {girls,boys:students.length-girls,total:students.length};}
function editionCsv(filename,headers,rows){const csv='\uFEFF'+[headers,...rows].map(r=>r.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=filename;a.click();URL.revokeObjectURL(a.href);}
function editionPrint(title,headers,rows,landscape=false){const w=window.open('','_blank');if(!w)return alert('Autorisez les fenêtres contextuelles pour imprimer.');const th=headers.map(x=>`<th>${esc(x)}</th>`).join(''),tr=rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v??'')}</td>`).join('')}</tr>`).join('');w.document.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>${esc(title)}</title><style>@page{size:A4 ${landscape?'landscape':'portrait'};margin:10mm}body{font:10pt Arial;color:#172338}h2,h3{text-align:center;margin:4px}.meta{margin:12px 0}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #64748b;padding:5px;text-align:left}th{background:#eaf0f7}tr{break-inside:avoid}</style><h2>GROUPE SCOLAIRE LA RÉFÉRENCE</h2><h3>${esc(currentSite()?.nom||'')}</h3><h3>${esc(title)}</h3><p class="meta">Année scolaire : ${esc(currentSchoolYear())}</p><table><thead><tr>${th}</tr></thead><tbody>${tr||`<tr><td colspan="${headers.length}">Aucune donnée</td></tr>`}</tbody></table><script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></html>`);w.document.close();}
function editionRosterPage(){
 const students=editionActiveStudents(),counts=editionSexCounts(students);
 return pageShell('Liste par classe','Liste nominative filtrée par établissement, année scolaire et classe. Impression et exportation.','','',`<div class="card"><div class="form-grid">${editionClassFilter()}<label>Recherche<input id="editionSearch" type="search" placeholder="Matricule, nom, téléphone…" oninput="refreshEditionView()"></label></div><div class="cards" id="editionCounts">${stat('Nombre de filles',counts.girls)}${stat('Nombre de garçons',counts.boys)}${stat('Effectif total',counts.total)}</div><div class="toolbar"><label>Afficher<select id="editionPageSize" onchange="refreshEditionView()"><option>10</option><option>25</option><option>50</option><option value="1000">Tout</option></select></label><button class="btn light" onclick="exportEditionRoster()">Exporter</button><button class="btn light" onclick="printEditionRoster()">Imprimer</button></div><div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Matricule</th><th>Nom & Prénoms</th><th>Sexe</th><th>Téléphone apprenant</th><th>Téléphone parent</th><th>Total dû (FCFA)</th><th>Total payé (FCFA)</th><th>Reste (FCFA)</th><th>Date d'inscription</th></tr></thead><tbody id="editionRosterRows"></tbody></table></div><p class="muted" id="editionRosterCount"></p></div>`);
}
function editionRosterRows(){const id=val('editionClassFilter'),q=val('editionSearch').toLocaleLowerCase('fr'),size=Number(val('editionPageSize')||10),yearId=Number(liveYears.find(y=>y.active)?.id||liveYears[0]?.id||0);return editionActiveStudents(id).filter(s=>{const link=liveStudentParentLinks.find(p=>String(p.eleve_id)===String(s.id)),phone=link?.parents?.telephone||'';return [s.name,s.matricule,s.phone,s.educmasterId,phone].join(' ').toLocaleLowerCase('fr').includes(q)}).slice(0,size).map((s,i)=>{const schedules=liveStudentSchedules.filter(x=>String(x.eleve_id)===String(s.id)&&(!yearId||Number(x.annee_scolaire_id)===yearId)),due=schedules.reduce((a,x)=>a+Number(x.montant_net||0),0),paid=schedules.reduce((a,x)=>a+Number(x.montant_paye||0),0),rest=schedules.reduce((a,x)=>a+Number(x.reste_a_payer||0),0),link=liveStudentParentLinks.find(p=>String(p.eleve_id)===String(s.id)),parentPhone=link?.parents?.telephone||'—';return [i+1,s.matricule||'—',s.name,s.sex||'—',s.phone||'—',parentPhone,due.toLocaleString('fr-FR'),paid.toLocaleString('fr-FR'),rest.toLocaleString('fr-FR'),s.registrationDate?new Date(s.registrationDate+'T00:00:00').toLocaleDateString('fr-FR'):'—'];});}
function refreshEditionView(){const p=document.getElementById('editionRosterRows');if(p){const rows=editionRosterRows();p.innerHTML=rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="10" class="empty">Aucun élève trouvé.</td></tr>';const all=editionActiveStudents(val('editionClassFilter')).filter(s=>{const link=liveStudentParentLinks.find(p=>String(p.eleve_id)===String(s.id));return [s.name,s.matricule,s.phone,s.educmasterId,link?.parents?.telephone].join(' ').toLocaleLowerCase('fr').includes(val('editionSearch').toLocaleLowerCase('fr'))});const c=editionSexCounts(all);document.getElementById('editionCounts').innerHTML=stat('Nombre de filles',c.girls)+stat('Nombre de garçons',c.boys)+stat('Effectif total',c.total);document.getElementById('editionRosterCount').textContent=`Affichage de ${rows.length} sur ${all.length} élève(s).`;}}
function exportEditionRoster(){const rows=editionRosterRows();editionCsv('LA_REFERENCE_liste_par_classe.csv',['N°','Matricule','Nom & Prénoms','Sexe','Téléphone apprenant','Téléphone parent','Total dû FCFA','Total payé FCFA','Reste FCFA','Date inscription'],rows);}
function printEditionRoster(){editionPrint('LISTE DES APPRENANTS', ['N°','Matricule','Nom & Prénoms','Sexe','Téléphone apprenant','Téléphone parent','Total dû FCFA','Total payé FCFA','Reste FCFA','Date inscription'],editionRosterRows(),true);}
function editionGradeData(){const cls=val('editionGradeClass'),period=val('editionGradePeriod')||'1er trimestre',subjectId=val('editionGradeSubject');const yearId=Number(liveYears.find(y=>y.active)?.id||liveYears[0]?.id||0);const students=editionActiveStudents(cls);const subject=liveSubjects.find(m=>String(m.id)===String(subjectId));const rows=students.map(st=>{const find=type=>db.grades.find(g=>Number(g.studentId)===Number(st.id)&&Number(g.matterId)===Number(subjectId)&&g.period===period&&(!yearId||Number(g.yearId)===yearId)&&emNorm(g.type)===emNorm(type))?.note;const inter=find('Moyenne d’interrogation'),d1=find('Premier devoir'),d2=find('Deuxième devoir'),nums=[inter,d1,d2].filter(x=>x!==undefined&&x!==null&&x!=='').map(Number),avg=nums.length===3?nums.reduce((a,b)=>a+b,0)/3:null;return {st,inter,d1,d2,avg};});return {rows,subject,period};}
function editionGradeSheetPage(){const yearId=Number(liveYears.find(y=>y.active)?.id||liveYears[0]?.id||0);const classIds=[...new Set(liveClassSubjects.filter(x=>Number(x.annee_scolaire_id)===yearId&&x.actif!==false).map(x=>Number(x.classe_id)))];const classOpts=db.classes.filter(c=>classIds.includes(Number(c.id))).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');return pageShell('Fiche de notes','Toutes les matières affectées à la classe sont proposées, même sans note déjà saisie.','','',`<div class="card"><div class="form-grid"><label>Établissement<input value="${esc(currentSite()?.nom||'')}" disabled></label><label>Année scolaire<input value="${esc(currentSchoolYear())}" disabled></label><label>Classe<select id="editionGradeClass" onchange="refreshEditionGradeSubjects()"><option value="">Choisir une classe</option>${classOpts}</select></label><label>Période<select id="editionGradePeriod" onchange="refreshEditionGradeSheet()"><option>1er trimestre</option><option>2e trimestre</option><option>3e trimestre</option><option>1er semestre</option><option>2e semestre</option></select></label><label>Matière<select id="editionGradeSubject" onchange="refreshEditionGradeSheet()"><option value="">Choisir une matière</option></select></label></div><div class="cards" id="editionGradeCounts"></div><div class="toolbar"><button class="btn light" onclick="printEditionGradeSheet()">Imprimer</button><button class="btn light" onclick="exportEditionGradeSheet()">Exporter</button></div><div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Nom & Prénoms</th><th>Moy. interro</th><th>1er devoir</th><th>2ème devoir</th><th>Moyenne</th></tr></thead><tbody id="editionGradeRows"><tr><td colspan="6">Choisissez une matière.</td></tr></tbody></table></div></div>`);}
function refreshEditionGradeSubjects(){const cls=Number(val('editionGradeClass')),yearId=Number(liveYears.find(y=>y.active)?.id||liveYears[0]?.id||0),sel=document.getElementById('editionGradeSubject');if(!sel)return;const assigned=liveClassSubjects.filter(x=>Number(x.classe_id)===cls&&Number(x.annee_scolaire_id)===yearId&&x.actif!==false);const ids=[...new Set(assigned.map(x=>Number(x.matiere_id)))];sel.innerHTML='<option value="">Choisir une matière</option>'+ids.map(id=>{const m=liveSubjects.find(z=>Number(z.id)===id);return m?`<option value="${m.id}">${esc(m.nom)}</option>`:''}).join('');refreshEditionGradeSheet();}
function refreshEditionGradeSheet(){const id=val('editionGradeSubject'),body=document.getElementById('editionGradeRows');if(!body)return;const {rows,subject}=editionGradeData();if(!subject){body.innerHTML='<tr><td colspan="6">Choisissez une matière.</td></tr>';return;}body.innerHTML=rows.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.st.name)}</td><td>${x.inter??'—'}</td><td>${x.d1??'—'}</td><td>${x.d2??'—'}</td><td>${x.avg===null?'—':x.avg.toFixed(2)}</td></tr>`).join('');const c=editionSexCounts(rows.map(x=>x.st));document.getElementById('editionGradeCounts').innerHTML=stat('Nombre de filles',c.girls)+stat('Nombre de garçons',c.boys)+stat('Effectif total',c.total);}
function editionGradeRowsForOutput(){const {rows,subject,period}=editionGradeData();return {subject,period,rows:rows.map((x,i)=>[i+1,x.st.name,x.inter??'',x.d1??'',x.d2??'',x.avg===null?'':x.avg.toFixed(2)])};}
function printEditionGradeSheet(){const x=editionGradeRowsForOutput();if(!x.subject)return alert('Choisissez une matière.');editionPrint(`FICHE DE NOTES — ${x.subject.nom} — ${x.period}`,['N°','Nom & Prénoms','Moy. interro','1er devoir','2ème devoir','Moyenne'],x.rows);}
function exportEditionGradeSheet(){const x=editionGradeRowsForOutput();if(!x.subject)return alert('Choisissez une matière.');editionCsv('LA_REFERENCE_fiche_notes.csv',['N°','Nom & Prénoms','Moy. interro','1er devoir','2ème devoir','Moyenne'],x.rows);}
function editionDebtorsPage(){return pageShell('Liste des débiteurs par tranche','Impayés détaillés par classe et par tranche, selon les dates de renvoi du prospectus 2026-2027.','','',`<div class="card"><div class="form-grid"><label>Établissement<input value="${esc(currentSite()?.nom||'')}" disabled></label><label>Année scolaire<input value="${esc(currentSchoolYear())}" disabled></label><label>Classe<select id="editionDebtClass" onchange="refreshEditionDebtors()"><option value="">Toutes les classes</option>${classSelectOptions()}</select></label><label>Tranche<select id="editionDebtTranche" onchange="refreshEditionDebtors()"><option value="">Toutes les tranches</option>${[1,2,3,4,5,6,7].map(n=>`<option value="${n}">${n}ème tranche</option>`).join('')}</select></label><label>Date de situation<input id="editionDebtAsOf" type="date" value="${new Date().toISOString().slice(0,10)}" onchange="refreshEditionDebtors()"></label><label>Recherche<input id="editionDebtSearch" oninput="refreshEditionDebtors()" placeholder="Nom ou matricule"></label></div><p class="muted">Renvoi applicable à partir du 5 du mois suivant la date limite de la tranche. À partir du 11, la reprise exige le paiement de la tranche échue et de la suivante.</p><div class="cards" id="editionDebtStats"></div><div class="toolbar"><button class="btn light" onclick="printEditionDebtors()">Imprimer A4</button><button class="btn light" onclick="exportEditionDebtors()">Exporter CSV</button></div><div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Matricule</th><th>Nom & Prénoms</th><th>Classe</th><th>Tranche</th><th>Date limite</th><th>Net dû</th><th>Payé</th><th>Reste</th><th>Situation</th></tr></thead><tbody id="editionDebtRows"></tbody></table></div><p id="editionDebtCount" class="muted"></p></div>`);}
function editionDebtThreshold(schedule){if(!schedule.date_echeance)return new Date(0);const d=new Date(schedule.date_echeance+'T00:00:00');if(Number.isNaN(d.getTime()))return new Date(0);return new Date(d.getFullYear(),d.getMonth()+1,5);}
function editionDebtData(){const classId=val('editionDebtClass'),tranche=val('editionDebtTranche'),q=val('editionDebtSearch').toLocaleLowerCase('fr'),asOf=val('editionDebtAsOf')||new Date().toISOString().slice(0,10),today=new Date(asOf+'T23:59:59');const students=editionActiveStudents(classId);const out=[];for(const st of students){const schedules=liveStudentSchedules.filter(x=>String(x.eleve_id)===String(st.id));for(const e of schedules){const balance=Number(e.reste_a_payer||0),n=Number(e.numero_tranche||0);if(balance<=0||(tranche&&String(n)!==String(tranche)))continue;const threshold=editionDebtThreshold(e);if(!threshold||today<threshold)continue;if(![st.name,st.matricule,st.educmasterId,st.class].join(' ').toLocaleLowerCase('fr').includes(q))continue;const next=schedules.find(x=>Number(x.numero_tranche)===n+1);const nextBalance=next?Math.max(0,Number(next.reste_a_payer||0)):0;const reprise=today>=new Date(threshold.getFullYear(),threshold.getMonth(),11);const montantReprise=reprise?balance+nextBalance:balance;out.push({st,e,balance,threshold,next,nextBalance,reprise,montantReprise});}}return out.sort((a,b)=>(a.st.class||'').localeCompare(b.st.class||'','fr',{numeric:true})||a.st.name.localeCompare(b.st.name,'fr')||Number(a.e.numero_tranche)-Number(b.e.numero_tranche));}
function refreshEditionDebtors(){const body=document.getElementById('editionDebtRows');if(!body)return;const data=editionDebtData(),total=data.reduce((n,x)=>n+x.balance,0),reprise=data.filter(x=>x.reprise).length,totalReprise=data.filter(x=>x.reprise).reduce((n,x)=>n+x.montantReprise,0);body.innerHTML=data.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.st.matricule||'—')}</td><td>${esc(x.st.name)}</td><td>${esc(x.st.class||'—')}</td><td>${esc(x.e.libelle||('Tranche '+x.e.numero_tranche))}</td><td>${x.e.date_echeance?new Date(x.e.date_echeance+'T00:00:00').toLocaleDateString('fr-FR'):'—'}</td><td>${Number(x.e.montant_net||0).toLocaleString('fr-FR')}</td><td>${Number(x.e.montant_paye||0).toLocaleString('fr-FR')}</td><td><b>${x.balance.toLocaleString('fr-FR')}</b></td><td><b>${x.reprise?'Reprise conditionnée (tranche + suivante)':'Renvoi applicable'}</b>${x.reprise?`<small style="display:block">Tranche suivante : ${x.nextBalance.toLocaleString('fr-FR')} FCFA restant<br>À régler pour reprise : ${x.montantReprise.toLocaleString('fr-FR')} FCFA</small>`:''}</td></tr>`).join('')||'<tr><td colspan="10" class="empty">Aucun impayé arrivé à la date de renvoi pour ces critères.</td></tr>';document.getElementById('editionDebtStats').innerHTML=stat('Tranches impayées',data.length)+stat('Total restant dû',total.toLocaleString('fr-FR')+' FCFA')+stat('Reprises conditionnées',reprise)+stat('Total à régler pour reprise',totalReprise.toLocaleString('fr-FR')+' FCFA');document.getElementById('editionDebtCount').textContent=`${data.length} tranche(s) impayée(s) arrivée(s) à échéance de renvoi au ${new Date((val('editionDebtAsOf')||new Date().toISOString().slice(0,10))+'T00:00:00').toLocaleDateString('fr-FR')}.`;
}
function editionDebtOutput(){return editionDebtData().map((x,i)=>[i+1,x.st.matricule||'',x.st.name,x.st.class||'',x.e.libelle||('Tranche '+x.e.numero_tranche),x.e.date_echeance||'',Number(x.e.montant_net||0),Number(x.e.montant_paye||0),x.balance,x.reprise?'Reprise conditionnée':'Renvoi applicable',x.reprise?x.montantReprise:'']);}
function printEditionDebtors(){editionPrint('LISTE DES DÉBITEURS PAR CLASSE ET PAR TRANCHE',['N°','Matricule','Nom & Prénoms','Classe','Tranche','Date limite','Net dû (FCFA)','Payé (FCFA)','Reste (FCFA)','Situation','À régler pour reprise (FCFA)'],editionDebtOutput(),true);}
function exportEditionDebtors(){editionCsv('LA_REFERENCE_debiteurs_par_classe_et_tranche.csv',['N°','Matricule','Nom & Prénoms','Classe','Tranche','Date limite','Net dû (FCFA)','Payé (FCFA)','Reste (FCFA)','Situation','À régler pour reprise (FCFA)'],editionDebtOutput());}
function editionEducMasterListPage(){return pageShell('Liste pour EDUCMASTER','Préparer la liste nominative avec les informations des dossiers élèves. Les champs absents restent vides.','','',`<div class="card"><div class="form-grid"><label>Établissement<input value="${esc(currentSite()?.nom||'')}" disabled></label><label>Année scolaire<input value="${esc(currentSchoolYear())}" disabled></label><label>Classe<select id="emListClass" onchange="refreshEmList()">${classSelectOptions()}</select></label><label>Recherche<input id="emListSearch" oninput="refreshEmList()" placeholder="Matricule, nom…"></label></div><div class="cards" id="emListCounts"></div><div class="toolbar"><button class="btn light" onclick="printEmList()">Imprimer</button><button class="btn light" onclick="exportEmList()">Exporter Excel / CSV</button></div><div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Matricule</th><th>Nom</th><th>Prénoms</th><th>Sexe</th><th>Date naissance</th><th>Lieu naissance</th><th>Nationalité</th><th>Contact</th><th>Option écrit</th><th>TRIM 1</th><th>TRIM 2</th><th>TRIM 3</th></tr></thead><tbody id="emListRows"></tbody></table></div></div>`);}
function emTermAverage(st,period){const ns=db.grades.filter(g=>Number(g.studentId)===Number(st.id)&&Number(g.yearId)===yearId&&g.period===period);if(!ns.length)return '';const byMatter=new Map();for(const g of ns){const key=g.matterId??g.matter;const arr=byMatter.get(key)||[];arr.push(g);byMatter.set(key,arr);}const avgs=[...byMatter.values()].map(a=>{const vals=a.map(x=>Number(x.note)).filter(Number.isFinite);return vals.length?vals.reduce((x,y)=>x+y,0)/vals.length:null;}).filter(x=>x!==null);return avgs.length?(avgs.reduce((x,y)=>x+y,0)/avgs.length).toFixed(2):'';}
function emListData(){const q=val('emListSearch').toLocaleLowerCase('fr');return editionActiveStudents(val('emListClass')).filter(s=>[s.name,s.matricule,s.educmasterId].join(' ').toLocaleLowerCase('fr').includes(q)).map((s,i)=>[i+1,s.educmasterId||'',s.lastName||s.name,s.firstName||'',s.sex||'',s.birthDate||'',s.birthPlace||'',s.nationality||'',s.phone||'',s.optionEcrit||'',emTermAverage(s,'1er trimestre'),emTermAverage(s,'2e trimestre'),emTermAverage(s,'3e trimestre')]);}
function refreshEmList(){const b=document.getElementById('emListRows');if(!b)return;const rows=emListData();b.innerHTML=rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v||'—')}</td>`).join('')}</tr>`).join('')||'<tr><td colspan="13">Aucun élève trouvé.</td></tr>';const st=editionActiveStudents(val('emListClass'));const c=editionSexCounts(st);document.getElementById('emListCounts').innerHTML=stat('Nombre de filles',c.girls)+stat('Nombre de garçons',c.boys)+stat('Effectif total',c.total);}
function printEmList(){editionPrint('LISTE DES APPRENANTS POUR EDUCMASTER',['N°','Matricule','Nom','Prénoms','Sexe','Date naissance','Lieu naissance','Nationalité','Contact','Option écrit','TRIM 1','TRIM 2','TRIM 3'],emListData(),true);}
function exportEmList(){editionCsv('LA_REFERENCE_LISTE_EDUCMASTER.csv',['N°','Matricule','Nom','Prénoms','Sexe','Date naissance','Lieu naissance','Nationalité','Contact','Option écrit','TRIM 1','TRIM 2','TRIM 3'],emListData());}
function editionEducMasterNotesPage(){return pageShell('Notes pour EDUCMASTER','Afficher les notes déjà enregistrées dans LA RÉFÉRENCE, puis préparer leur export sans ressaisie.','','',`<div class="card"><div class="form-grid"><label>Établissement<input value="${esc(currentSite()?.nom||'')}" disabled></label><label>Année scolaire<input value="${esc(currentSchoolYear())}" disabled></label><label>Période<select id="emNotesPeriod" onchange="refreshEmNotes()"><option>1er trimestre</option><option>2e trimestre</option><option>3e trimestre</option><option>1er semestre</option><option>2e semestre</option></select></label><label>Classe<select id="emNotesClass" onchange="refreshEmNotes()">${classSelectOptions()}</select></label><label>Matière<select id="emNotesSubject" onchange="refreshEmNotes()"><option value="">Choisir une matière</option>${liveSubjects.map(m=>`<option value="${m.id}">${esc(m.nom)}</option>`).join('')}</select></label></div><div class="toolbar"><button class="btn light" onclick="printEmNotes()">Imprimer</button><button class="btn primary" onclick="exportEmNotesWorkbook()">Exporter le tableau de contrôle</button></div><div class="notice">Les notes affichées sont celles déjà enregistrées. L’export est un tableau de contrôle, pas encore le fichier officiel d’importation. Téléchargez le modèle vierge depuis EducMaster et vérifiez sa structure avant tout transfert. L’export ne modifie jamais les notes de LA RÉFÉRENCE.</div><div class="table-wrap"><table class="table"><thead><tr><th>Matricule</th><th>Nom</th><th>Prénoms</th><th>Moy. interro</th><th>Devoir 1</th><th>Devoir 2</th><th>Moyenne</th><th>Coef</th><th>Appréciation</th><th>Rang</th></tr></thead><tbody id="emNotesRows"><tr><td colspan="10">Choisissez une matière.</td></tr></tbody></table></div></div>`);}
function emNotesData(){const classId=val('emNotesClass'),period=val('emNotesPeriod'),mid=val('emNotesSubject'),students=editionActiveStudents(classId);const rows=students.map(st=>{const find=t=>db.grades.find(g=>Number(g.studentId)===Number(st.id)&&Number(g.matterId)===Number(mid)&&g.period===period&&emNorm(g.type)===emNorm(t))?.note;const i=find('Moyenne d’interrogation'),d1=find('Premier devoir'),d2=find('Deuxième devoir'),avg=[i,d1,d2].every(x=>x!==undefined&&x!==null&&x!=='')?(Number(i)+Number(d1)+Number(d2))/3:null;const n=liveSubjects.find(m=>String(m.id)===String(mid));return {st,i,d1,d2,avg,coef:n?.coefficient||1};}).sort((a,b)=>(b.avg??-1)-(a.avg??-1));return rows.map((x,i)=>({...x,rank:x.avg===null?'—':i+1,app:x.avg===null?'':x.avg>=16?'Très bien':x.avg>=14?'Bien':x.avg>=12?'Assez bien':x.avg>=10?'Passable':'Insuffisant'}));}
function refreshEmNotes(){const b=document.getElementById('emNotesRows');if(!b)return;const mid=val('emNotesSubject');if(!mid){b.innerHTML='<tr><td colspan="10">Choisissez une matière.</td></tr>';return;}b.innerHTML=emNotesData().map(x=>`<tr><td>${esc(x.st.educmasterId||x.st.matricule||'')}</td><td>${esc(x.st.lastName||x.st.name)}</td><td>${esc(x.st.firstName||'')}</td><td>${x.i??'—'}</td><td>${x.d1??'—'}</td><td>${x.d2??'—'}</td><td>${x.avg===null?'—':x.avg.toFixed(2)}</td><td>${x.coef}</td><td>${esc(x.app)}</td><td>${x.rank}</td></tr>`).join('')||'<tr><td colspan="10">Aucun élève dans cette classe.</td></tr>';}
function printEmNotes(){if(!val('emNotesSubject'))return alert('Choisissez une matière.');const rows=emNotesData().map(x=>[x.st.educmasterId||x.st.matricule||'',x.st.lastName||x.st.name,x.st.firstName||'',x.i??'',x.d1??'',x.d2??'',x.avg===null?'':x.avg.toFixed(2),x.coef,x.app,x.rank]);editionPrint('NOTES POUR EDUCMASTER',['Matricule','Nom','Prénoms','Moy. interro','Devoir 1','Devoir 2','Moyenne','Coef','Appréciation','Rang'],rows,true);}
function exportEmNotesWorkbook(){if(!val('emNotesSubject'))return alert('Choisissez une matière.');if(!window.XLSX)return alert('Le module Excel n’est pas chargé.');const subject=liveSubjects.find(m=>String(m.id)===String(val('emNotesSubject'))),rows=emNotesData();const data=[['Matricule','Nom','Prénoms','Moy. interro','Devoir 1','Devoir 2','Moyenne','Coef','Appréciation','Rang'],...rows.map(x=>[x.st.educmasterId||x.st.matricule||'',x.st.lastName||x.st.name,x.st.firstName||'',x.i??'',x.d1??'',x.d2??'',x.avg===null?'':Number(x.avg.toFixed(2)),x.coef,x.app,x.rank])];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),String(subject.nom).slice(0,31));XLSX.writeFile(wb,`LA_REFERENCE_CONTROLE_NOTES_AVANT_EDUCMASTER_${String(subject.nom).replace(/[^a-z0-9]/gi,'_')}.xlsx`);}
function classEditionPage(){
 const opts=classSelectOptions();
 return pageShell('Édition par classe','Préparer et imprimer les documents scolaires d’une classe sur papier A4','Imprimer les documents sélectionnés','printClassEdition()',`<div class="card"><div class="form-grid"><label>Classe à éditer<select id="editionClass">${opts}</select></label><label>Période des notes et bulletins<select id="editionPeriod"><option>1er trimestre</option><option>2e trimestre</option><option>3e trimestre</option><option>1er semestre</option><option>2e semestre</option></select></label></div><h3 style="margin-top:18px">Documents à imprimer</h3><div class="form-grid"><label><input type="checkbox" class="edition-doc" value="roster" checked> Liste nominative de la classe</label><label><input type="checkbox" class="edition-doc" value="grades" checked> Fiches de notes par élève</label><label><input type="checkbox" class="edition-doc" value="bulletins" checked> Bulletins scolaires</label><label><input type="checkbox" class="edition-doc" value="cards" checked> Cartes scolaires</label><label><input type="checkbox" class="edition-doc" value="timetable" checked> Emploi du temps de la classe</label><label><input type="checkbox" class="edition-doc" value="debts" checked> Grille de scolarité et liste des impayés</label></div><p class="muted" style="margin-top:12px">Les documents sont préparés à partir des données réellement enregistrées. Les notes, photos ou horaires absents ne seront pas inventés. Chaque document commence sur une nouvelle page A4 lorsque nécessaire.</p><button class="btn primary" onclick="printClassEdition()">Imprimer les documents sélectionnés</button></div>`);
}
function printClassEdition(){
 const id=Number(val('editionClass')),period=val('editionPeriod'),cls=db.classes.find(c=>Number(c.id)===id);
 if(!cls)return alert('Choisissez une classe.');
 const students=db.students.filter(s=>Number(s.classId)===id).sort((a,b)=>a.name.localeCompare(b.name,'fr'));
 if(!students.length)return alert('Aucun élève enregistré dans cette classe.');
 const selected=[...document.querySelectorAll('.edition-doc:checked')].map(x=>x.value);if(!selected.length)return alert('Cochez au moins un document.');
 const title=`GROUPE SCOLAIRE LA RÉFÉRENCE`;
 const heading=(t)=>`<header class="doc-head"><h2>${title}</h2><h3>${esc(t)}</h3><p>Classe : <b>${esc(cls.name)}</b> · Année scolaire : 2026-2027</p></header>`;
 const table=(heads,rows)=>`<table><thead><tr>${heads.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${heads.length}">Aucune donnée enregistrée</td></tr>`}</tbody></table>`;
 let docs='';
 if(selected.includes('roster')){const rows=students.map((s,i)=>`<tr><td>${i+1}</td><td>${esc(s.name)}</td><td>${esc(s.sex||'—')}</td><td>${esc(s.birthDate||'—')}</td><td>${esc(s.matricule||'—')}</td><td>${esc(s.educmasterId||'—')}</td><td>${esc(s.phone||'—')}</td><td></td></tr>`).join('');docs+=`<section class="sheet">${heading('LISTE NOMINATIVE DES ÉLÈVES')}${table(['N°','Nom et prénoms','Sexe','Date de naissance','Matricule','N° ÉducMaster','Téléphone','Signature'],rows)}<p class="count">Effectif : ${students.length} élève(s)</p></section>`;}
 if(selected.includes('grades')){docs+=students.map(st=>{const ns=db.grades.filter(g=>g.student===st.name&&g.period===period);const subjects=[...new Set(ns.map(g=>g.matter))];const rows=subjects.map(m=>{const a=ns.filter(g=>g.matter===m),get=t=>a.find(g=>String(g.type||'').toLowerCase()===t.toLowerCase())?.note, i=get('Moyenne d’interrogation'),d1=get('Premier devoir'),d2=get('Deuxième devoir'),vals=[i,d1,d2].filter(v=>v!==undefined&&v!==null&&v!=='').map(Number),avg=vals.length===3?vals.reduce((x,y)=>x+y,0)/3:null;return `<tr><td>${esc(m)}</td><td>${i??'—'}</td><td>${d1??'—'}</td><td>${d2??'—'}</td><td><b>${avg===null?'—':avg.toFixed(2)}</b></td><td>${a[0]?.coeff??1}</td></tr>`}).join('');return `<section class="sheet">${heading('FICHE DE NOTES — SECONDAIRE') }<p><b>Élève :</b> ${esc(st.name)} · <b>Matricule :</b> ${esc(st.matricule||'—')}</p><p><b>Période :</b> ${esc(period)}</p>${table(['Matière','Moy. interrogation','1er devoir','2e devoir','Moyenne /20','Coeff.'],rows)}<p style="margin-top:35px">Moyenne matière = (interrogation + devoir 1 + devoir 2) ÷ 3. Les moyennes ne sont calculées que lorsque les trois notes existent.</p><p>Signature du professeur principal : ____________________</p></section>`;}).join('');}
 if(selected.includes('bulletins')){docs+=students.map(st=>{const ns=db.grades.filter(g=>g.student===st.name&&g.period===period);const names=[...new Set(ns.map(n=>n.matter))];let sum=0,coSum=0;const rows=names.map(name=>{const arr=ns.filter(n=>n.matter===name),co=Number(liveSubjects.find(m=>m.nom===name)?.coefficient||arr[0]?.coeff||1),find=t=>arr.find(n=>String(n.type||'').toLowerCase()===t.toLowerCase())?.note,i=find('Moyenne d’interrogation'),d1=find('Premier devoir'),d2=find('Deuxième devoir'),complete=[i,d1,d2].every(v=>v!==undefined&&v!==null&&v!==''),avg=complete?(Number(i)+Number(d1)+Number(d2))/3:null;if(avg!==null){sum+=avg*co;coSum+=co;}return `<tr><td>${esc(name)}</td><td>${co}</td><td>${i??'—'}</td><td>${d1??'—'}</td><td>${d2??'—'}</td><td>${avg===null?'—':avg.toFixed(2)+'/20'}</td></tr>`}).join('');const avg=coSum?sum/coSum:null;const appreciation=avg===null?'Non calculable':avg>=16?'Très bien':avg>=14?'Bien':avg>=12?'Assez bien':avg>=10?'Passable':'Insuffisant';return `<section class="sheet">${heading('BULLETIN SCOLAIRE') }<div class="student-line">${st.photo_url?`<img src="${esc(st.photo_url)}" class="student-photo">`:''}<p><b>Élève :</b> ${esc(st.name)}<br><b>Matricule :</b> ${esc(st.matricule||'—')}<br><b>N° ÉducMaster :</b> ${esc(st.educmasterId||'—')}<br><b>Période :</b> ${esc(period)}</p></div>${table(['Matière','Coeff.','Interrogation','Devoir 1','Devoir 2','Moyenne'],rows)}<h3>Moyenne générale : ${avg===null?'Non calculable':avg.toFixed(2)+'/20'}</h3><p>Appréciation : <b>${appreciation}</b></p><p class="signatures">Le professeur principal ____________________　Le chef d’établissement ____________________</p></section>`;}).join('');}
 if(selected.includes('cards')){docs+=students.map(st=>`<section class="card-print"><h3>${title}</h3><b>CARTE SCOLAIRE</b>${st.photo_url?`<img src="${esc(st.photo_url)}">`:''}<p><b>${esc(st.name)}</b></p><p>Classe : ${esc(cls.name)}</p><p>Matricule : ${esc(st.matricule||'—')}</p><p>N° ÉducMaster : ${esc(st.educmasterId||'—')}</p><p>Année scolaire : 2026-2027</p></section>`).join('');}
 if(selected.includes('timetable')){const ts=liveTimetable.filter(t=>Number(t.classe_id)===id).sort((a,b)=>String(a.jour).localeCompare(String(b.jour),'fr')||String(a.heure_debut).localeCompare(String(b.heure_debut)));const rows=ts.map(t=>{const m=liveSubjects.find(x=>Number(x.id)===Number(t.matiere_id)),teacher=db.teachers.find(x=>Number(x.id)===Number(t.enseignant_id));return `<tr><td>${esc(t.jour)}</td><td>${String(t.heure_debut||'').slice(0,5)} – ${String(t.heure_fin||'').slice(0,5)}</td><td>${esc(m?.nom||'—')}</td><td>${esc(teacher?.name||'—')}</td><td>${esc(t.salle||'—')}</td></tr>`}).join('');docs+=`<section class="sheet">${heading('EMPLOI DU TEMPS')}${table(['Jour','Horaire','Matière','Enseignant','Salle'],rows)}</section>`;}
 if(selected.includes('debts')){const debtItems=liveStudentSchedules.filter(x=>Number(x.reste_a_payer)>0&&students.some(st=>String(st.id)===String(x.eleve_id)));const debtRows=debtItems.map(x=>{const st=students.find(z=>String(z.id)===String(x.eleve_id));return `<tr><td>${esc(st?.name||'—')}</td><td>${esc(x.libelle||('Tranche '+x.numero_tranche))}</td><td>${x.date_echeance?new Date(x.date_echeance+'T00:00:00').toLocaleDateString('fr-FR'):'À l’inscription'}</td><td>${Number(x.montant_net||0).toLocaleString('fr-FR')} FCFA</td><td>${Number(x.montant_paye||0).toLocaleString('fr-FR')} FCFA</td><td><b>${Number(x.reste_a_payer||0).toLocaleString('fr-FR')} FCFA</b></td></tr>`}).join('');const total=debtItems.reduce((a,x)=>a+Number(x.reste_a_payer||0),0);docs+=`<section class="sheet">${heading('ÉTAT DES IMPAYÉS DE SCOLARITÉ')}${table(['Élève','Tranche','Échéance','Net dû','Payé','Reste à payer'],debtRows)}<h3>Total restant dû pour la classe : ${total.toLocaleString('fr-FR')} FCFA</h3></section>`;}
 const w=window.open('','_blank');if(!w)return alert('Autorisez les fenêtres contextuelles pour imprimer.');
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Édition ${esc(cls.name)}</title><style>@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:11pt}.sheet{page-break-after:always;break-after:page;min-height:260mm}.doc-head{text-align:center;margin-bottom:18px}.doc-head h2{font-size:18px;margin:0 0 8px}.doc-head h3{font-size:15px;margin:4px}.doc-head p{text-align:center}table{width:100%;border-collapse:collapse;margin:14px 0}th,td{border:1px solid #555;padding:6px;text-align:left}th{background:#eee}.count{text-align:right;font-weight:bold}.student-line{display:flex;gap:16px;align-items:center}.student-photo{width:75px;height:90px;object-fit:cover}.signatures{margin-top:45px}.card-print{display:inline-block;vertical-align:top;width:46%;min-height:180px;border:2px solid #234;padding:10px;margin:1%;box-sizing:border-box;page-break-inside:avoid}.card-print h3{text-align:center;font-size:13px}.card-print img{float:right;width:60px;height:75px;object-fit:cover}@media print{button{display:none}}</style></head><body>${docs}<script>window.onload=()=>setTimeout(()=>window.print(),350)<\/script></body></html>`);w.document.close();
}
function classSelectOptions(){return db.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');}
function bulletinsPage(){
 const years=liveYears.map(y=>`<option value="${y.id}" ${y.active?'selected':''}>${esc(y.libelle)}</option>`).join('');
 return pageShell('Bulletins scolaires','Bulletin officiel A4 — modèle bleu et jaune','Imprimer les bulletins','printClassBulletins()',`<div class="card"><div class="form-grid"><label>Année scolaire<select id="bulletinYear">${years}</select></label><label>Classe<select id="bulletinClass">${classSelectOptions()}</select></label><label>Période<select id="bulletinPeriod"><option>1er trimestre</option><option>2e trimestre</option><option>3e trimestre</option></select></label></div><p class="muted">Tous les élèves de la classe sélectionnée seront imprimés. Un bulletin par page A4 avec QR code sécurisé de vérification. Le QR permet de consulter les notes et les moyennes figurant sur le bulletin ; il ne donne pas accès au portail parent.</p></div>`);
}
async function printClassBulletins(){
 if(!liveMode||!supabaseClient)return alert('Connectez-vous à la plateforme pour imprimer les bulletins.');
 const classId=Number(val('bulletinClass')),period=val('bulletinPeriod'),yearId=Number(val('bulletinYear'));
 const cls=db.classes.find(c=>Number(c.id)===classId),year=liveYears.find(y=>Number(y.id)===yearId);
 if(!year)return alert('Choisissez une année scolaire.'); if(!cls)return alert('Choisissez une classe.');
 const students=db.students.filter(s=>Number(s.classId)===classId);
 if(!students.length)return alert('Aucun élève dans cette classe.');
 const site=currentSite(); if(!site)return alert('Établissement actif introuvable.');
 const girls=students.filter(s=>/^(f|féminin|female)/i.test(String(s.sex||'').trim())).length;
 const boys=students.filter(s=>/^(m|masculin|male|garçon)/i.test(String(s.sex||'').trim())).length;
 const btn=document.querySelector('button[onclick="printClassBulletins()"]'); if(btn){btn.disabled=true;btn.textContent='Préparation des bulletins…';}
 try{
  const prepared=students.map(st=>{
   const ns=db.grades.filter(g=>Number(g.studentId)===Number(st.id)&&g.period===period&&Number(g.yearId)===yearId);
   const subjects=[...new Set(ns.map(n=>n.matter))]; let weighted=0,coeffTotal=0; const qrSubjects=[];
   const rows=subjects.map(name=>{
    const arr=ns.filter(n=>n.matter===name),matterId=arr[0]?.matterId;
    const mapping=liveClassSubjects.find(m=>Number(m.classe_id)===classId&&Number(m.matiere_id)===Number(matterId)&&Number(m.annee_scolaire_id)===yearId);
    const co=Number(mapping?.coefficient||liveSubjects.find(m=>m.nom===name)?.coefficient||arr[0]?.coeff||1);
    const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const find=t=>arr.find(n=>norm(n.type)===norm(t))?.note;
    const interrogation=find('Moyenne d’interrogation')??find('Moyenne interrogation')??find('Interrogation');
    const d1=find('Premier devoir')??find('Devoir 1'); const d2=find('Deuxième devoir')??find('Devoir 2');
    const complete=[interrogation,d1,d2].every(v=>v!==undefined&&v!==null&&v!=='');
    const avg=complete?(Number(interrogation)+Number(d1)+Number(d2))/3:null;
    if(avg!==null){weighted+=avg*co;coeffTotal+=co;}
    const appreciation=avg===null?'—':avg>=16?'TRÈS BIEN':avg>=14?'BIEN':avg>=12?'ASSEZ BIEN':avg>=10?'PASSABLE':'INSUFFISANT';
    qrSubjects.push({nom:name,moyenne_interrogation:interrogation??null,devoir1:d1??null,devoir2:d2??null,moyenne:avg===null?null:Number(avg.toFixed(2)),coefficient:co,moyenne_coefficiente:avg===null?null:Number((avg*co).toFixed(2)),appreciation});
    return `<tr><td>${esc(name)}</td><td>${interrogation??'—'}</td><td>${d1??'—'}</td><td>${d2??'—'}</td><td>${avg===null?'—':avg.toFixed(2)}</td><td>${co}</td><td>${avg===null?'—':(avg*co).toFixed(2)}</td><td>${appreciation}</td></tr>`;
   }).join('');
   const avg=coeffTotal?weighted/coeffTotal:null;
   const termAvgs=['1er trimestre','2e trimestre','3e trimestre'].map(p=>studentPeriodAverage(st.id,p,yearId));
   const annual=termAvgs.every(v=>v!==null)?(2*termAvgs[2]+((termAvgs[0]+termAvgs[1])/2))/3:null;
   return {st,rows,avg,termAvgs,annual,qrSubjects};
  });
  const classAvgs=prepared.filter(x=>x.avg!==null).map(x=>x.avg),annualAvgs=prepared.filter(x=>x.annual!==null).map(x=>x.annual);
  const fmt=v=>v===null||v===undefined?'—':Number(v).toFixed(2);
  // Émettre un jeton neuf par bulletin : toute réimpression révoque automatiquement l'ancien.
  for(const item of prepared){
   const rank=item.avg===null?null:prepared.filter(x=>x.avg!==null&&x.avg>item.avg).length+1;
   const payload={apprenant:item.st.name,classe:cls.name,matricule:item.st.matricule||null,numero_educmaster:item.st.educmasterId||null,annee_scolaire:year.libelle,effectif:students.length,matieres:item.qrSubjects,moyenne_generale:item.avg===null?null:fmt(item.avg),rang:rank,forte_moyenne:fmt(classAvgs.length?Math.max(...classAvgs):null),faible_moyenne:fmt(classAvgs.length?Math.min(...classAvgs):null),appreciation:item.avg===null?'Non calculable':item.avg>=16?'Très bien':item.avg>=14?'Bien':item.avg>=12?'Assez bien':item.avg>=10?'Passable':'Insuffisant'};
   const issued=await supabaseClient.functions.invoke('bulletin-qr',{body:{action:'issue',eleve_id:Number(item.st.id),annee_scolaire_id:yearId,etablissement_id:site.id,periode, moyenne_generale:item.avg,appreciation:payload.appreciation,bulletin_data:payload}});
   if(issued.error||!issued.data?.verification_url)throw new Error(issued.error?.message||issued.data?.error||'Impossible de générer le QR code du bulletin de '+item.st.name);
   item.verificationUrl=issued.data.verification_url;
  }
  const pages=prepared.map(({st,rows,avg,termAvgs,annual,verificationUrl})=>{
   const rank=avg===null?'—':(prepared.filter(x=>x.avg!==null&&x.avg>avg).length+1)+'e';
   const annualRank=annual===null?'—':(prepared.filter(x=>x.annual!==null&&x.annual>annual).length+1)+'e';
   const decision=avg===null?'':avg>=16?'Félicitation':avg>=14?'Encouragement':avg>=12?'Tableau d’honneur':avg>=10?'':'Avertissement';
   return `<section class="sheet">
    <header class="school-head"><img class="school-logo left-logo" src="/logo-gauche.jpg" alt="Logo LA RÉFÉRENCE"><div class="school-title"><b>RÉPUBLIQUE DU BÉNIN</b><br>Ministère de l’Enseignement Secondaire, Technique et de la Formation Professionnelle<br><b>GROUPE SCOLAIRE LA RÉFÉRENCE (GSR)</b><br><b>${esc(site.nom||'ÉTABLISSEMENT')}</b><br><small>Fondateur : 95710071 / 97878750 (Message)</small></div><img class="school-logo right-logo" src="/logo-droit.jpg" alt="Armoiries du Bénin"></header>
    <div class="banner"><b>BULLETIN DE NOTES</b><span>Année Scolaire : ${esc(year.libelle)}</span></div>
    <div class="term">${esc(period.toUpperCase())}</div>
    <div class="identity"><span>Classe : <b>${esc(cls.name)}</b></span><span>Nbre F : <b>${girls}</b></span><span>Nbre G : <b>${boys}</b></span><span>Effectif : <b>${students.length}</b></span><span class="wide">Apprenant(e) : <b>${esc(st.name)}</b></span><span class="wide">EDUCMASTER : <b>${esc(st.educmasterId||'')}</b></span><span class="qr-wrap"><img class="qr-code" data-url="${esc(verificationUrl)}" alt="QR de vérification du bulletin"><small>Scanner pour vérifier l’authenticité et consulter les notes</small></span></div>
    <table class="marks"><thead><tr><th>Matières</th><th>Moy Int</th><th>Dev 1</th><th>Dev 2</th><th>Moy.</th><th>Coef</th><th>Moy. Coef.</th><th>Appréciation</th></tr></thead><tbody>${rows||'<tr><td colspan="8">Aucune note saisie pour cette période</td></tr>'}</tbody></table>
    <div class="lower"><div class="leftcol"><table class="summary"><tr><th>MOY TRIMESTRIELLE</th><td class="highlight">${fmt(avg)} / 20</td></tr><tr><th>RANG</th><td class="highlight">${rank}</td></tr><tr><th>FORTE MOYENNE</th><td>${fmt(classAvgs.length?Math.max(...classAvgs):null)}</td></tr><tr><th>FAIBLE MOYENNE</th><td>${fmt(classAvgs.length?Math.min(...classAvgs):null)}</td></tr></table><table class="summary"><tr><th>MOY. 1er TRIM</th><td>${fmt(termAvgs[0])}</td></tr><tr><th>MOY. 2e TRIM</th><td>${fmt(termAvgs[1])}</td></tr><tr><th>MOY. 3e TRIM</th><td>${fmt(termAvgs[2])}</td></tr></table><table class="summary"><tr><th>MOY ANNUELLE</th><td>${fmt(annual)}</td></tr><tr><th>FORTE MOY. ANNUELLE</th><td>${fmt(annualAvgs.length?Math.max(...annualAvgs):null)}</td></tr><tr><th>FAIBLE MOY. ANNUELLE</th><td>${fmt(annualAvgs.length?Math.min(...annualAvgs):null)}</td></tr><tr><th>RANG ANNUEL</th><td>${annualRank}</td></tr></table></div>
     <div class="middlecol"><table class="council"><thead><tr><th colspan="2">Conseil des enseignants</th></tr></thead><tbody>${[['Félicitation','Félicitation'],['Encouragement','Encouragement'],['Tableau d’honneur','Tableau d’honneur'],['Avertissement','Avertissement'],['Blâme','Blâme'],['Renvoi','Renvoi']].map(([label,key])=>`<tr><td>${label}</td><td class="check">${decision===key?'☑':'□'}</td></tr>`).join('')}</tbody></table></div>
     <div class="rightcol"><div class="assessment"><b>Bilan Scientifique :</b><div></div><b>Bilan Littéraire :</b><div></div></div><div class="signature"><b><u>Signature et cachet<br>Directeur</u></b><strong>Germain Maxime ATTOLOU</strong></div></div></div>
    <footer class="page-foot"><span>Date d’impression : ${new Date().toLocaleDateString('fr-FR')}</span><span>Copyright GSR</span></footer></section>`;
  }).join('');
  const w=window.open('','_blank'); if(!w)throw new Error('Autorisez les fenêtres contextuelles pour imprimer les bulletins.');
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bulletins ${esc(cls.name)}</title><style>
   @page{size:A4 portrait;margin:7mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Arial,sans-serif}.sheet{width:196mm;height:283mm;margin:0 auto;position:relative;padding:0 2mm 13mm;overflow:hidden;page-break-after:always;break-after:page;font-size:9pt}
   .school-head{height:24mm;display:grid;grid-template-columns:25mm 1fr 25mm;align-items:center;text-align:center}.school-logo{object-fit:contain;display:block;margin:auto}.left-logo{width:24mm;height:20mm}.right-logo{width:19mm;height:22mm}.school-title{font-family:Georgia,serif;font-size:8pt;line-height:1.2;font-weight:bold}.school-title small{font-size:7pt}
   .banner{height:8mm;background:#fff2c7;border-top:2px solid #174b78;border-bottom:2px solid #d6ad26;display:flex;align-items:center;justify-content:space-between;padding:0 4mm}.banner b{font:bold 15pt Georgia;color:#174b78}.banner span{font-size:8pt;font-weight:bold;color:#174b78}.term{margin:10mm 0 3mm 7mm}.identity{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:3mm 5mm;margin:0 3mm 5mm;font-size:9pt}.wide{grid-column:1/-1}.qr-wrap{grid-column:4;grid-row:1/4;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:6pt}.qr-code{width:25mm;height:25mm;object-fit:contain}.qr-wrap small{max-width:28mm}
   .marks{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8pt}.marks th,.marks td{border:1px solid #333;padding:1.1mm .7mm;text-align:center;white-space:nowrap;overflow:hidden}.marks th{background:#174b78;color:#fff}.marks th:first-child,.marks td:first-child{text-align:left;width:27%}.marks tbody tr:nth-child(even){background:#eaf1fb}.marks tbody tr:nth-child(odd){background:#fff7df}.marks th:nth-child(2),.marks th:nth-child(3),.marks th:nth-child(4),.marks th:nth-child(5){width:8%}.marks th:nth-child(6){width:6%}.marks th:nth-child(7){width:11%}.marks th:nth-child(8){width:16%}
   .lower{display:grid;grid-template-columns:32% 31% 33%;gap:2%;margin-top:5mm;align-items:start}.summary,.council{width:100%;border-collapse:collapse;font-size:8pt;margin-bottom:4mm}.summary th,.summary td,.council th,.council td{border:1px solid #333;padding:1.1mm}.summary th{text-align:left;font-weight:normal}.summary td{text-align:center}.summary tr:nth-child(even),.council tr:nth-child(even){background:#eaf1fb}.summary .highlight{color:#174b78;font-weight:bold}.council th{background:#174b78;color:#fff;text-align:center;font-size:10pt}.council td:last-child{text-align:center;font-size:13pt}.assessment{background:#fff7df;border:1px solid #174b78;padding:3mm;min-height:29mm;font-size:9pt}.assessment div{height:8mm}.signature{border:1px solid #174b78;height:43mm;margin-top:12mm;display:flex;flex-direction:column;justify-content:space-between;align-items:center;padding:4mm 1mm;text-align:center;font-size:9pt}.signature strong{text-decoration:underline}.page-foot{position:absolute;bottom:4mm;left:3mm;right:3mm;border-top:1px solid #174b78;padding-top:2mm;display:flex;justify-content:space-between;font-size:7pt;font-style:italic}@media print{.sheet{margin:0;box-shadow:none}}
  </style></head><body>${pages}<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode/1.5.3/qrcode.min.js"></script><script>window.onload=async()=>{try{const imgs=[...document.querySelectorAll('.qr-code')];await Promise.all(imgs.map(async img=>{const url=await QRCode.toDataURL(img.dataset.url,{width:220,margin:1,errorCorrectionLevel:'M'});img.src=url;}));setTimeout(()=>window.print(),350)}catch(e){alert('Les QR codes n’ont pas pu être générés. Vérifiez la connexion Internet puis réimprimez.')}}<\/script></body></html>`);
  w.document.close();alert(`${students.length} bulletin(s) prêts : un bulletin par élève, une page A4 avec QR code de vérification.`);
 }catch(e){notifyError('Impression des bulletins',e)}finally{if(btn){btn.disabled=false;btn.textContent='Imprimer les bulletins'}}
}
function cardsPage(){const years=['2026-2027','2027-2028','2025-2026'];return pageShell('Cartes scolaires','Cartes individuelles ou par classe, avec photo et impression A4','Imprimer les cartes','printClassCards()',`<div class="card"><div class="form-grid"><label>Classe<select id="cardClass">${classSelectOptions()}</select></label><label>Apprenant (facultatif)<select id="cardStudent"><option value="">Toute la classe</option>${db.students.map(s=>`<option value="${s.id}">${esc(s.name)} · ${esc(s.class||'')}</option>`).join('')}</select></label><label>Année scolaire<input id="cardYear" value="${esc(currentSchoolYear())}"></label></div><p class="muted">Les cartes utilisent les photos, matricules et numéros ÉducMaster réellement enregistrés. Les champs absents restent indiqués par un tiret.</p></div>`);}
function currentSchoolYear(){const d=new Date(),y=d.getFullYear();return d.getMonth()>=8?`${y}-${y+1}`:`${y-1}-${y}`;}
function printClassCards(){const classId=Number(val('cardClass')),one=val('cardStudent'),cls=db.classes.find(c=>Number(c.id)===classId),students=db.students.filter(s=>(!classId||Number(s.classId)===classId)&&(!one||String(s.id)===String(one)));if(!students.length)return alert('Aucun apprenant correspondant aux critères.');const year=val('cardYear')||currentSchoolYear(),school=currentSite()?.nom||'GROUPE SCOLAIRE LA RÉFÉRENCE';const html=students.map(s=>{const c=db.classes.find(x=>Number(x.id)===Number(s.classId));return `<article class="school-card"><header><b>${esc(school)}</b><small>CARTE SCOLAIRE · ${esc(year)}</small></header><div class="card-content">${s.photo_url?`<img src="${esc(s.photo_url)}" alt="Photo de ${esc(s.name)}">`:'<div class="photo-placeholder">PHOTO</div>'}<div><h3>${esc(s.name)}</h3><p><b>Classe :</b> ${esc(c?.name||'—')}</p><p><b>Matricule :</b> ${esc(s.matricule||'—')}</p><p><b>N° ÉducMaster :</b> ${esc(s.educmasterId||'—')}</p><p><b>Né(e) le :</b> ${esc(s.birthDate||'—')}</p></div></div><footer>GROUPE SCOLAIRE LA RÉFÉRENCE</footer></article>`}).join('');const w=window.open('','_blank');if(!w)return alert('Autorisez les fenêtres contextuelles.');w.document.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Cartes scolaires</title><style>@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font:10px Arial;display:grid;grid-template-columns:1fr 1fr;gap:8mm}.school-card{height:55mm;border:1.5px solid #174a36;border-radius:7px;padding:8px;break-inside:avoid;overflow:hidden}.school-card header{text-align:center;border-bottom:1px solid #174a36;padding-bottom:5px;color:#174a36}.school-card header b{display:block;font-size:12px}.school-card header small{font-size:9px}.card-content{display:flex;gap:9px;padding:8px 0}.card-content img,.photo-placeholder{width:24mm;height:29mm;object-fit:cover;border:1px solid #aaa;flex-shrink:0}.photo-placeholder{display:grid;place-items:center;color:#777}.card-content h3{font-size:12px;margin:0 0 5px}.card-content p{margin:3px 0;font-size:9px}.school-card footer{text-align:right;font-size:8px;border-top:1px solid #ddd;padding-top:4px}@media print{body{gap:6mm}}</style>${html}<script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></html>`);w.document.close();}
function pedagogyFilters(){return `<div class="form-grid card"><label>Année scolaire<input id="pedYear" value="${esc(currentSchoolYear())}"></label><label>Période<select id="pedPeriod"><option>1er trimestre</option><option>2e trimestre</option><option>3e trimestre</option></select></label><label>Classe<select id="pedClass"><option value="">Toutes les classes</option>${classSelectOptions()}</select></label></div>`;}
function pedagogyRows(period, classId){return db.grades.filter(g=>(!period||g.period===period)&&(!classId||Number(db.students.find(s=>Number(s.id)===Number(g.studentId))?.classId)===Number(classId)));}
function activeYearId(){return Number(liveYears.find(y=>y.active)?.id||liveYears[0]?.id||0);}
function subjectAverageFor(studentId,subjectId,period,yearId=activeYearId()){const a=db.grades.filter(g=>Number(g.studentId)===Number(studentId)&&Number(g.matterId)===Number(subjectId)&&g.period===period&&(!yearId||Number(g.yearId)===Number(yearId)));const get=t=>a.find(g=>emNorm(g.type)===emNorm(t))?.note;const i=get('Moyenne d’interrogation'),d1=get('Premier devoir'),d2=get('Deuxième devoir');if([i,d1,d2].some(v=>v===undefined||v===null||v===''))return null;return (Number(i)+Number(d1)+Number(d2))/3;}
function studentPeriodAverage(studentId,period,yearId=activeYearId()){let sum=0,coSum=0;const st=db.students.find(x=>Number(x.id)===Number(studentId));const mappings=liveClassSubjects.filter(x=>Number(x.classe_id)===Number(st?.classId)&&(!yearId||Number(x.annee_scolaire_id)===Number(yearId)));const subjects=mappings.length?mappings.map(x=>({id:x.matiere_id,coefficient:x.coefficient})):liveSubjects.map(x=>({id:x.id,coefficient:x.coefficient}));subjects.forEach(m=>{const avg=subjectAverageFor(studentId,m.id,period,yearId);if(avg!==null){const co=Number(m.coefficient)||1;sum+=avg*co;coSum+=co;}});return coSum?sum/coSum:null;}
function pedagogicAssignmentsPage(kind){
 const isTeacher=kind==='teachers',yearOptions=liveYears.map(y=>`<option value="${y.id}" ${y.active?'selected':''}>${esc(y.libelle)}</option>`).join(''),classOptions=db.classes.map(c=>`<option value="${c.id}" ${Number(pedagogySelectedClassId)===Number(c.id)?'selected':''}>${esc(c.name)}</option>`).join(''),subjectOptions=liveSubjects.map(m=>`<option value="${m.id}">${esc(m.nom)}</option>`).join('');
 const selectedClass=Number(pedagogySelectedClassId||0);
 const rows=isTeacher?liveTeacherAssignments.filter(a=>!selectedClass||Number(a.classe_id)===selectedClass).map(a=>{const t=db.teachers.find(x=>Number(x.id)===Number(a.enseignant_id)),c=db.classes.find(x=>Number(x.id)===Number(a.classe_id)),m=liveSubjects.find(x=>Number(x.id)===Number(a.matiere_id)),y=liveYears.find(x=>Number(x.id)===Number(a.annee_scolaire_id));return `<tr><td>${esc(t?.name||'Enseignant')}</td><td>${esc(c?.name||'—')}</td><td>${esc(m?.nom||'—')}</td><td>${esc(y?.libelle||'—')}</td></tr>`}).join(''):liveClassSubjects.filter(a=>selectedClass&&Number(a.classe_id)===selectedClass).map(a=>{const m=liveSubjects.find(x=>Number(x.id)===Number(a.matiere_id)),y=liveYears.find(x=>Number(x.id)===Number(a.annee_scolaire_id));return `<tr><td>${esc(m?.nom||'—')}</td><td>${Number(a.coefficient).toLocaleString('fr-FR')}</td><td>${esc(y?.libelle||'—')}</td><td><button class="btn light" onclick="editClassSubject(${Number(a.id)})">Modifier</button> <button class="btn danger" onclick="deleteClassSubject(${Number(a.id)})">Supprimer</button></td></tr>`}).join('');
 const form=isTeacher?`<div class="form-grid"><label>Année scolaire<select id="assignYear">${yearOptions}</select></label><label>Classe<select id="assignClass" onchange="pedagogySelectedClassId=Number(this.value);showPage('ped-assign-teachers')">${classOptions}</select></label><label>Matière<select id="assignSubject">${subjectOptions}</select></label><label>Enseignant<select id="assignTeacher">${db.teachers.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label></div><button class="btn primary" onclick="saveTeacherAssignment()">Enregistrer l’affectation</button>`:`<div class="form-grid"><label>Année scolaire<select id="assignYear">${yearOptions}</select></label><label>Classe<select id="assignClass" onchange="pedagogySelectedClassId=Number(this.value);showPage('ped-assign-subjects')"><option value="">Choisir une classe</option>${classOptions}</select></label><label>Matière<select id="assignSubject">${subjectOptions}</select></label><label>Coefficient<input id="assignCoeff" type="number" min="0.01" step="0.01" value="1"></label></div><div class="toolbar" style="gap:10px;flex-wrap:wrap"><button class="btn primary" onclick="saveClassSubject()">Enregistrer la matière dans cette classe</button><button class="btn light" onclick="openSubjectForm()">+ Ajouter une nouvelle matière</button></div><p class="muted">Les matières affectées sont consultables et modifiables directement dans la classe sélectionnée. Les classes homologues du premier cycle sont également alimentées automatiquement.</p>`;
 const tableHead=isTeacher?'<th>Enseignant</th><th>Classe</th><th>Matière</th><th>Année</th>':'<th>Matière</th><th>Coefficient</th><th>Année</th><th>Actions</th>';
 return pageShell(isTeacher?'Affectation des enseignants':'Affectation des matières par classe',isTeacher?'Associer un enseignant à une classe, une matière et une année scolaire.':'Choisissez une classe pour gérer uniquement les matières qui lui sont affectées.','','',`<div class="card">${form}</div><div class="card" style="margin-top:15px"><h3>${isTeacher?'Affectations de la classe sélectionnée':'Matières de la classe sélectionnée'}</h3>${!selectedClass?'<p class="empty">Choisissez une classe pour afficher ses matières.</p>':`<div class="table-wrap"><table class="table"><thead><tr>${tableHead}</tr></thead><tbody>${rows||`<tr><td colspan="${isTeacher?4:4}" class="empty">Aucune matière affectée à cette classe pour le moment.</td></tr>`}</tbody></table></div>`}</div>`);
}
function homologousFirstCycleClasses(selectedClassId){
 const selected=db.classes.find(c=>Number(c.id)===Number(selectedClassId));
 if(!selected)return [];
 const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim();
 const text=norm(selected.name);
 const gradeMatch=text.match(/\\b(6e|6eme|5e|5eme|4e|4eme|3e|3eme)\\b/);
 if(!gradeMatch)return [selected];
 const grade=gradeMatch[1].replace('eme','e');
 const base=text.replace(/\\b(6e|6eme|5e|5eme|4e|4eme|3e|3eme)\\b/g,grade).replace(/\\s*(?:[-/]?\\s*)?(?:m\\s*\\d+|[a-f]|\\d+)$/,'').trim();
 return db.classes.filter(c=>{
  const n=norm(c.name),g=n.match(/\\b(6e|6eme|5e|5eme|4e|4eme|3e|3eme)\\b/);
  if(!g||g[1].replace('eme','e')!==grade)return false;
  const b=n.replace(/\\b(6e|6eme|5e|5eme|4e|4eme|3e|3eme)\\b/g,grade).replace(/\\s*(?:[-/]?\\s*)?(?:m\\s*\\d+|[a-f]|\\d+)$/,'').trim();
  return b===base;
 });
}
async function saveClassSubject(){
 const classe_id=Number(val('assignClass')),matiere_id=Number(val('assignSubject')),annee_scolaire_id=Number(val('assignYear')),coefficient=Number(val('assignCoeff'));
 if(!classe_id||!matiere_id||!annee_scolaire_id||!Number.isFinite(coefficient)||coefficient<=0)return alert('Choisissez une année, une classe, une matière et un coefficient positif.');pedagogySelectedClassId=classe_id;
 const targets=homologousFirstCycleClasses(classe_id);
 for(const cls of targets){
  const {data:existing,error:checkError}=await supabaseClient.from('classes_matieres').select('id').eq('classe_id',cls.id).eq('matiere_id',matiere_id).eq('annee_scolaire_id',annee_scolaire_id).eq('etablissement_id',activeSiteId).limit(1);
  if(checkError){notifyError('Vérification de la matière',checkError);return;}
  if(existing?.length){
   const {error}=await supabaseClient.from('classes_matieres').update({coefficient,actif:true}).eq('id',existing[0].id).eq('etablissement_id',activeSiteId);
   if(error){notifyError('Mise à jour de la matière',error);return;}
  }else{
   const {error}=await supabaseClient.from('classes_matieres').insert({classe_id:cls.id,matiere_id,annee_scolaire_id,coefficient,etablissement_id:activeSiteId,actif:true});
   if(error){notifyError('Enregistrement de la matière',error);return;}
  }
 }
 await loadLiveData();showPage('ped-assign-subjects');
 if(targets.length>1)alert('Matière enregistrée dans '+targets.length+' classes homologues du premier cycle.');
}
async function saveTeacherAssignment(){const enseignant_id=Number(val('assignTeacher')),classe_id=Number(val('assignClass')),matiere_id=Number(val('assignSubject')),annee_scolaire_id=Number(val('assignYear'));if(!enseignant_id||!classe_id||!matiere_id||!annee_scolaire_id)return alert('Complétez tous les champs.');const {error}=await supabaseClient.from('affectations').insert({enseignant_id,classe_id,matiere_id,annee_scolaire_id,etablissement_id:activeSiteId});if(error){notifyError('Affectation enseignant',error);return;}await loadLiveData();showPage('ped-assign-teachers');}

function interrogationEntryPage(){
 const yearId=Number(val("interroYear")||liveYears.find(y=>y.active)?.id||liveYears[0]?.id||0),period=val("interroPeriod")||"1er trimestre",classId=Number(val("interroClass")||0),subjectId=Number(val("interroSubject")||0),scale=Math.max(1,Number(val("interroScale")||20));
 const mappings=liveClassSubjects.filter(x=>Number(x.classe_id)===classId),subjects=liveSubjects.filter(m=>mappings.some(x=>Number(x.matiere_id)===Number(m.id))),roster=db.students.filter(s=>classId&&Number(s.classId)===classId).sort((a,b)=>String(a.name).localeCompare(String(b.name),"fr"));
 const rows=roster.map((st,i)=>{const g=db.grades.find(x=>Number(x.studentId)===Number(st.id)&&Number(x.matterId)===subjectId&&Number(x.yearId)===yearId&&String(x.period)===period&&emNorm(x.type)===emNorm("Moyenne d’interrogation"));return `<tr><td>${i+1}</td><td>${esc(st.name)}</td><td><input class="interro-value" data-student="${Number(st.id)}" type="number" min="0" max="${scale}" step="0.01" value="${esc(g?.note??"")}" placeholder="—" style="max-width:120px"></td></tr>`}).join("");
 return pageShell("Moyenne des interrogations","Saisissez la moyenne retenue pour chaque élève. Elle sera reprise automatiquement dans les moyennes par matière.","Enregistrer les moyennes","saveInterrogationAverages()",`<div class="card"><div class="form-grid">
 <label>Établissement<input value="${esc(currentSite()?.nom||"")}" readonly></label>
 <label>Année scolaire<select id="interroYear" onchange="showPage('ped-interrogations')">${liveYears.map(y=>`<option value="${y.id}" ${yearId===Number(y.id)?"selected":""}>${esc(y.libelle)}</option>`).join("")}</select></label>
 <label>Session académique<select id="interroPeriod" onchange="showPage('ped-interrogations')">${["1er trimestre","2e trimestre","3e trimestre"].map(p=>`<option ${period===p?"selected":""}>${p.toUpperCase()}</option>`).join("")}</select></label>
 <label>Classe<select id="interroClass" onchange="showPage('ped-interrogations')"><option value="">Choisir une classe</option>${db.classes.map(c=>`<option value="${c.id}" ${classId===Number(c.id)?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label>
 <label>Matière<select id="interroSubject" onchange="showPage('ped-interrogations')"><option value="">Choisir une matière</option>${subjects.map(m=>`<option value="${m.id}" ${subjectId===Number(m.id)?"selected":""}>${esc(m.nom)}</option>`).join("")}</select></label>
 <label>Nombre d'interrogations retenues<input id="interroCount" type="number" min="1" max="20" value="${Math.max(1,Number(val("interroCount")||1))}"></label><label>Barème<input id="interroScale" type="number" min="1" max="100" value="${scale}"></label>
 </div><div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Apprenant</th><th>Moy Inter</th></tr></thead><tbody>${!classId?'<tr><td colspan="3">Choisissez une classe.</td></tr>':!subjectId?'<tr><td colspan="3">Choisissez une matière.</td></tr>':rows||'<tr><td colspan="3">Aucun élève.</td></tr>'}</tbody></table></div><p class="muted">Les notes sont enregistrées sur 20 après conversion du barème choisi.</p></div>`);
}
async function saveInterrogationAverages(){
 const yearId=Number(val("interroYear")),period=val("interroPeriod"),classId=Number(val("interroClass")),subjectId=Number(val("interroSubject")),scale=Math.max(1,Number(val("interroScale")||20));
 if(!yearId||!classId||!subjectId)return alert("Choisissez l'année, la classe et la matière.");
 const filled=[...document.querySelectorAll(".interro-value")].filter(x=>x.value.trim()!=="");if(!filled.length)return alert("Saisissez au moins une moyenne.");
 for(const x of filled){const n=Number(x.value);if(!Number.isFinite(n)||n<0||n>scale)return alert(`Chaque note doit être comprise entre 0 et ${scale}.`);}
 if(!confirm(`Enregistrer ${filled.length} moyenne(s) d'interrogation ?`))return;
 const coef=Number(liveClassSubjects.find(x=>Number(x.classe_id)===classId&&Number(x.matiere_id)===subjectId)?.coefficient)||1;
 for(const x of filled){const studentId=Number(x.dataset.student),note=Number(x.value)*20/scale;
  const {data,error}=await supabaseClient.from("notes").select("id").eq("etablissement_id",activeSiteId).eq("annee_scolaire_id",yearId).eq("eleve_id",studentId).eq("matiere_id",subjectId).eq("periode",period).eq("type_evaluation","Moyenne d’interrogation").limit(1);
  if(error){notifyError("Recherche des notes",error);return;}
  const result=data?.length?await supabaseClient.from("notes").update({note,coefficient_applique:coef}).eq("id",data[0].id).eq("etablissement_id",activeSiteId):await supabaseClient.from("notes").insert({etablissement_id:activeSiteId,annee_scolaire_id:yearId,eleve_id:studentId,matiere_id:subjectId,note,type_evaluation:"Moyenne d’interrogation",periode:period,coefficient_applique:coef});
  if(result.error){notifyError("Enregistrement",result.error);return;}
 }
 await loadLiveData();showPage("ped-interrogations");alert(`${filled.length} moyenne(s) enregistrée(s).`);
}
function pedagogySessionAveragesPage(){
 const yearId=Number(val("sessionYear")||liveYears.find(y=>y.active)?.id||liveYears[0]?.id||0),period=val("sessionPeriod")||"1er trimestre",classId=Number(val("sessionClass")||0),mappings=liveClassSubjects.filter(x=>Number(x.classe_id)===classId),subjects=liveSubjects.filter(m=>mappings.some(x=>Number(x.matiere_id)===Number(m.id))),roster=db.students.filter(s=>classId&&Number(s.classId)===classId).sort((a,b)=>String(a.name).localeCompare(String(b.name),"fr"));
 const avgFor=(sid,mid)=>{const gs=db.grades.filter(g=>Number(g.studentId)===Number(sid)&&Number(g.matterId)===Number(mid)&&Number(g.yearId)===yearId&&String(g.period)===period),get=t=>gs.find(g=>emNorm(g.type)===emNorm(t))?.note,v=[get("Moyenne d’interrogation"),get("Premier devoir"),get("Deuxième devoir")];return v.every(x=>x!==undefined&&x!==null&&x!=="")?v.reduce((s,x)=>s+Number(x),0)/3:null;};
 const data=roster.map(st=>{let sum=0,cs=0;const vals=subjects.map(m=>{const v=avgFor(st.id,m.id),c=Number(mappings.find(x=>Number(x.matiere_id)===Number(m.id))?.coefficient)||1;if(v!==null){sum+=v*c;cs+=c;}return v;});return {st,vals,avg:cs?sum/cs:null};}),ranked=data.filter(x=>x.avg!==null).sort((a,b)=>b.avg-a.avg);
 const headers=subjects.map(m=>`<th>${esc(m.nom)}<br><small>Coef. ${Number(mappings.find(x=>Number(x.matiere_id)===Number(m.id))?.coefficient)||1}</small></th>`).join("");
 const rows=data.map(x=>`<tr><td>${esc(x.st.name)}</td>${x.vals.map(v=>`<td>${v===null?"—":v.toFixed(2)}</td>`).join("")}<td><strong>${x.avg===null?"—":x.avg.toFixed(2)}</strong></td><td>${x.avg===null?"—":ranked.findIndex(y=>Number(y.st.id)===Number(x.st.id))+1}</td></tr>`).join("");
 const avgClass=ranked.length?ranked.reduce((s,x)=>s+x.avg,0)/ranked.length:null;
 return pageShell("Moyennes générales par classe et par session","Résultats de toute la classe calculés à partir des moyennes par matière et des coefficients.","Recalculer les moyennes","showPage('ped-term-averages')",`<div class="card"><div class="form-grid">
 <label>Établissement<input value="${esc(currentSite()?.nom||"")}" readonly></label><label>Année scolaire<select id="sessionYear" onchange="showPage('ped-term-averages')">${liveYears.map(y=>`<option value="${y.id}" ${yearId===Number(y.id)?"selected":""}>${esc(y.libelle)}</option>`).join("")}</select></label>
 <label>Session académique<select id="sessionPeriod" onchange="showPage('ped-term-averages')">${["1er trimestre","2e trimestre","3e trimestre"].map(p=>`<option ${period===p?"selected":""}>${p.toUpperCase()}</option>`).join("")}</select></label><label>Classe<select id="sessionClass" onchange="showPage('ped-term-averages')"><option value="">Choisir une classe</option>${db.classes.map(c=>`<option value="${c.id}" ${classId===Number(c.id)?"selected":""}>${esc(c.name)}</option>`).join("")}</select></label></div>
 <div class="toolbar"><strong>Effectif : ${roster.length}</strong><button class="btn light" onclick="printCurrentPage()">Imprimer</button><button class="btn light" onclick="exportCurrentCSV()">Exporter</button></div>
 <div class="table-wrap"><table class="table"><thead><tr><th>Apprenant</th>${headers}<th>Moy. Session</th><th>Rang</th></tr></thead><tbody>${!classId?'<tr><td colspan="4">Choisissez une classe.</td></tr>':rows||'<tr><td colspan="4">Aucun élève dans cette classe.</td></tr>'}</tbody></table></div><div class="notice">Moyenne de classe : ${avgClass===null?"—":avgClass.toFixed(2)+"/20"} · ${ranked.length} élève(s) classé(s).</div></div>`);
}
function pedagogicAveragePage(kind){const period=val('pedPeriod')||'1er trimestre',classId=val('pedClass');let rows='',title='',heads=[];if(kind==='interrogations'){title='Moyenne des interrogations';heads=['Apprenant','Classe','Matière','Note interrogation'];rows=db.grades.filter(g=>String(g.type).toLowerCase()==='moyenne d’interrogation'&&(!classId||Number(db.students.find(s=>Number(s.id)===Number(g.studentId))?.classId)===Number(classId))).map(g=>{const st=db.students.find(s=>Number(s.id)===Number(g.studentId));return `<tr><td>${esc(g.student)}</td><td>${esc(st?.class||'—')}</td><td>${esc(g.matter)}</td><td>${esc(g.note??'—')}</td></tr>`}).join('');}
else if(kind==='students'){title='Moyenne par apprenant';heads=['Apprenant','Classe','Matière','Moy. interrogation','Devoir 1','Devoir 2','Moyenne matière','Coeff.','Appréciation','Rang'];const roster=db.students.filter(s=>!classId||Number(s.classId)===Number(classId));const ranked=roster.map(st=>({st,avg:studentPeriodAverage(st.id,period)})).filter(x=>x.avg!==null).sort((a,b)=>b.avg-a.avg);const rankOf=id=>{const i=ranked.findIndex(x=>Number(x.st.id)===Number(id));return i<0?'—':i+1};rows=roster.map(st=>liveSubjects.map(m=>{const a=db.grades.filter(g=>Number(g.studentId)===Number(st.id)&&Number(g.matterId)===Number(m.id)&&g.period===period),get=t=>a.find(g=>emNorm(g.type)===emNorm(t))?.note,i=get('Moyenne d’interrogation'),d1=get('Premier devoir'),d2=get('Deuxième devoir'),avg=subjectAverageFor(st.id,m.id,period),app=avg===null?'À compléter':avg>=16?'Très bien':avg>=14?'Bien':avg>=12?'Assez bien':avg>=10?'Passable':'Insuffisant';return `<tr><td>${esc(st.name)}</td><td>${esc(st.class||'—')}</td><td>${esc(m.nom)}</td><td>${i??'—'}</td><td>${d1??'—'}</td><td>${d2??'—'}</td><td>${avg===null?'—':avg.toFixed(2)}</td><td>${esc(m.coefficient||1)}</td><td>${app}</td><td>${rankOf(st.id)}</td></tr>`}).join('')).join('');}
else if(kind==='subjects'){
 title='Moyennes par matière';
 const roster=db.students.filter(s=>!classId||Number(s.classId)===Number(classId)).sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'));
 const assigned=liveClassSubjects.filter(a=>!classId||Number(a.classe_id)===Number(classId));
 const subjectIds=[...new Set(assigned.map(a=>Number(a.matiere_id)))];
 const subjects=liveSubjects.filter(m=>subjectIds.includes(Number(m.id)));
 if(!pedagogySelectedSubjectId||!subjects.some(m=>Number(m.id)===Number(pedagogySelectedSubjectId)))pedagogySelectedSubjectId=Number(subjects[0]?.id||0);
 const selected=subjects.find(m=>Number(m.id)===Number(pedagogySelectedSubjectId));
 heads=['N°','Apprenant','Moy. Int','Dev1','Dev2','Moyenne','Coef','Appréciation','Rang'];
 const values=roster.map(st=>{const a=db.grades.filter(g=>Number(g.studentId)===Number(st.id)&&Number(g.matterId)===Number(selected?.id)&&g.period===period),get=t=>a.find(g=>emNorm(g.type)===emNorm(t))?.note,i=get('Moyenne d’interrogation'),d1=get('Premier devoir'),d2=get('Deuxième devoir'),avg=subjectAverageFor(st.id,selected?.id,period),mapping=assigned.find(x=>Number(x.matiere_id)===Number(selected?.id)&&Number(x.classe_id)===Number(st.classId)),coef=Number(mapping?.coefficient)||1,app=avg===null?'À compléter':avg>=16?'Très bien':avg>=14?'Bien':avg>=12?'Assez bien':avg>=10?'Passable':avg>=8?'Faible':'Insuffisant';return {st,i,d1,d2,avg,coef,app};});
 const ranked=[...values].filter(x=>x.avg!==null).sort((a,b)=>b.avg-a.avg);
 rows=values.map((x,index)=>`<tr><td>${index+1}</td><td>${esc(x.st.name)}</td><td>${x.i??'—'}</td><td>${x.d1??'—'}</td><td>${x.d2??'—'}</td><td>${x.avg===null?'—':x.avg.toFixed(2)}</td><td>${x.coef}</td><td>${x.app}</td><td>${x.avg===null?'—':ranked.findIndex(y=>Number(y.st.id)===Number(x.st.id))+1}</td></tr>`).join('');
}
else if(kind==='terms'){title='Moyennes générales par trimestre';heads=['Apprenant','Classe','Période','Moyenne générale','Rang'];const roster=db.students.filter(s=>!classId||Number(s.classId)===Number(classId));const rank=roster.map(st=>({st,avg:studentPeriodAverage(st.id,period)})).filter(x=>x.avg!==null).sort((a,b)=>b.avg-a.avg);rows=roster.map(st=>{const avg=studentPeriodAverage(st.id,period),r=rank.findIndex(x=>Number(x.st.id)===Number(st.id));return `<tr><td>${esc(st.name)}</td><td>${esc(st.class||'—')}</td><td>${esc(period)}</td><td>${avg===null?'—':avg.toFixed(2)+'/20'}</td><td>${r<0?'—':r+1}</td></tr>`}).join('');}
else{title='Moyennes annuelles et décisions de passage';heads=['Apprenant','Classe','T1','T2','T3','Moyenne annuelle','Décision'];rows=db.students.filter(s=>!classId||Number(s.classId)===Number(classId)).map(st=>{const a=['1er trimestre','2e trimestre','3e trimestre'].map(p=>studentPeriodAverage(st.id,p));const annual=a.every(v=>v!==null)?(2*a[2]+((a[0]+a[1])/2))/3:null;return `<tr><td>${esc(st.name)}</td><td>${esc(st.class||'—')}</td>${a.map(v=>`<td>${v===null?'—':v.toFixed(2)}</td>`).join('')}<td>${annual===null?'—':annual.toFixed(2)}</td><td>${annual===null?'À compléter':annual>=10?'Proposition : admis':'Proposition : redoublement'}</td></tr>`}).join('');}
const pageKey=kind==='interrogations'?'ped-interrogations':kind==='students'?'ped-student-averages':kind==='subjects'?'ped-subject-averages':kind==='terms'?'ped-term-averages':'ped-annual';return pageShell(title,'Calculs établis à partir des notes réellement enregistrées. Une note absente n’est jamais assimilée à zéro.','Recalculer',`showPage('${pageKey}')`,`${pedagogyFilters()}${kind==='subjects'?`<div class="card"><label>Matière<select id="pedSubject" onchange="pedagogySelectedSubjectId=Number(this.value);showPage('ped-subject-averages')">${liveSubjects.filter(m=>liveClassSubjects.some(a=>Number(a.matiere_id)===Number(m.id)&&(!Number(val('pedClass')||0)||Number(a.classe_id)===Number(val('pedClass'))))).map(m=>`<option value="${m.id}" ${Number(m.id)===Number(pedagogySelectedSubjectId)?'selected':''}>${esc(m.nom)}</option>`).join('')}</select></label></div>`:''}<div class="card"><p class="muted">Pour le secondaire : moyenne matière = (moyenne interrogation + devoir 1 + devoir 2) ÷ 3. Moyenne générale pondérée par les coefficients enregistrés. Le primaire garde son barème distinct.</p><div class="table-wrap"><table class="table"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${heads.length}">Aucune donnée suffisante pour les critères sélectionnés.</td></tr>`}</tbody></table></div>${kind==='annual'?'<p class="notice">Les décisions affichées sont des propositions indicatives. La direction doit les valider avant publication.</p>':''}</div>`);}
function pedagogicGridPage(mode){
 const yearId=Number(val('pedGridYear')||liveYears.find(y=>y.active)?.id||liveYears[0]?.id||0);
 const period=val('pedGridPeriod')||'1er trimestre';
 const classId=Number(val('pedGridClass')||0);
 const studentId=Number(val('pedGridStudent')||0);
 const subjectId=Number(val('pedGridSubject')||0);
 const cls=db.classes.find(c=>Number(c.id)===classId);
 const mappings=liveClassSubjects.filter(a=>Number(a.classe_id)===classId&&Number(a.annee_scolaire_id)===yearId&&a.actif!==false);
 const subjects=liveSubjects.filter(m=>mappings.some(a=>Number(a.matiere_id)===Number(m.id)));
 const roster=db.students.filter(st=>classId&&Number(st.classId)===classId).sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'));
 const selectedStudent=roster.find(st=>Number(st.id)===studentId);
 const selectedSubject=subjects.find(m=>Number(m.id)===subjectId);
 const types=[['Moyenne d’interrogation','Interrogation'],['Premier devoir','Devoir 1'],['Deuxième devoir','Devoir 2']];
 const getNote=(sid,mid,type)=>db.grades.find(g=>Number(g.studentId)===Number(sid)&&Number(g.matterId)===Number(mid)&&Number(g.yearId)===yearId&&String(g.period)===period&&emNorm(g.type)===emNorm(type))?.note;
 const input=(sid,mid,type)=>{const v=getNote(sid,mid,type);return `<input class="ped-grid-note" data-student="${Number(sid)}" data-subject="${Number(mid)}" data-type="${esc(type)}" type="number" min="0" max="20" step="0.25" value="${v??''}" placeholder="—" aria-label="${esc(type)}" style="width:92px;min-width:76px">`;};
 let title=mode==='class'?'Saisie de notes par matière / classe':mode==='student'?'Moyenne par apprenant — saisie et consultation':'Moyennes par matière — saisie et consultation';
 let table='';
 if(mode==='student'){
  const rows=selectedStudent?subjects.map((m,i)=>{const vals=types.map(t=>getNote(selectedStudent.id,m.id,t[0]));const avg=vals.every(v=>v!==undefined&&v!==null&&v!=='')?vals.reduce((a,v)=>a+Number(v),0)/3:null;return `<tr><td>${i+1}</td><td>${esc(m.nom)}</td>${types.map(t=>`<td>${input(selectedStudent.id,m.id,t[0])}</td>`).join('')}<td>${avg===null?'—':avg.toFixed(2)}</td><td>${Number(mappings.find(a=>Number(a.matiere_id)===Number(m.id))?.coefficient)||1}</td></tr>`}).join(''):'';
  table=`<div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Matière</th><th>Moy. interrogation</th><th>Devoir 1</th><th>Devoir 2</th><th>Moyenne</th><th>Coef.</th></tr></thead><tbody>${!classId?'<tr><td colspan="7">Choisissez une classe.</td></tr>':!studentId?'<tr><td colspan="7">Choisissez un apprenant.</td></tr>':rows||'<tr><td colspan="7">Aucune matière affectée à cette classe pour cette année.</td></tr>'}</tbody></table></div>`;
 }else{
  const list=mode==='class'?(selectedSubject?roster:[]):(selectedSubject?roster:[]);
  const rows=list.map((st,i)=>{const vals=types.map(t=>getNote(st.id,selectedSubject.id,t[0]));const avg=vals.every(v=>v!==undefined&&v!==null&&v!=='')?vals.reduce((a,v)=>a+Number(v),0)/3:null;return `<tr><td>${i+1}</td><td>${esc(st.name)}</td>${types.map(t=>`<td>${input(st.id,selectedSubject.id,t[0])}</td>`).join('')}<td>${avg===null?'—':avg.toFixed(2)}</td></tr>`}).join('');
  table=`<div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Apprenant</th><th>Moy. interrogation</th><th>Devoir 1</th><th>Devoir 2</th><th>Moyenne matière</th></tr></thead><tbody>${!classId?'<tr><td colspan="6">Choisissez une classe.</td></tr>':!subjectId?'<tr><td colspan="6">Choisissez une matière.</td></tr>':rows||'<tr><td colspan="6">Aucun apprenant dans cette classe.</td></tr>'}</tbody></table></div>`;
 }
 const classOptions=db.classes.map(c=>`<option value="${c.id}" ${classId===Number(c.id)?'selected':''}>${esc(c.name)}</option>`).join('');
 const subjectOptions=subjects.map(m=>`<option value="${m.id}" ${subjectId===Number(m.id)?'selected':''}>${esc(m.nom)}</option>`).join('');
 const studentOptions=roster.map(st=>`<option value="${st.id}" ${studentId===Number(st.id)?'selected':''}>${esc(st.name)}</option>`).join('');
 return pageShell(title,'Les trois notes sont modifiables ici. Les valeurs enregistrées alimentent automatiquement les moyennes, les classements et les bulletins.','Enregistrer les notes',`savePedagogicGrid('${mode}')`, `<div class="card"><div class="form-grid"><label>Établissement<input value="${esc(currentSite()?.nom||'')}" readonly></label><label>Année scolaire<select id="pedGridYear" onchange="showPage('${mode==='class'?'grades':mode==='student'?'ped-student-averages':'ped-subject-averages'}')">${liveYears.map(y=>`<option value="${y.id}" ${yearId===Number(y.id)?'selected':''}>${esc(y.libelle)}</option>`).join('')}</select></label><label>Trimestre<select id="pedGridPeriod" onchange="showPage('${mode==='class'?'grades':mode==='student'?'ped-student-averages':'ped-subject-averages'}')">${['1er trimestre','2e trimestre','3e trimestre'].map(x=>`<option value="${x}" ${period===x?'selected':''}>${x}</option>`).join('')}</select></label><label>Classe<select id="pedGridClass" onchange="showPage('${mode==='class'?'grades':mode==='student'?'ped-student-averages':'ped-subject-averages'}')"><option value="">Choisir une classe</option>${classOptions}</select></label>${mode==='student'?`<label>Apprenant<select id="pedGridStudent" onchange="showPage('ped-student-averages')"><option value="">Choisir un apprenant</option>${studentOptions}</select></label>`:`<label>Matière<select id="pedGridSubject" onchange="showPage('${mode==='class'?'grades':'ped-subject-averages'}')"><option value="">Choisir une matière</option>${subjectOptions}</select></label>`}</div><div class="notice" style="margin:12px 0">Barème sur 20. Moyenne matière = (interrogation + devoir 1 + devoir 2) ÷ 3. Une note vide reste non renseignée et n'est pas considérée comme zéro.</div>${table}<div class="toolbar"><button class="btn primary" onclick="savePedagogicGrid('${mode}')">Enregistrer les notes</button><button class="btn light" onclick="printCurrentPage()">Imprimer</button><button class="btn light" onclick="exportCurrentTables()">Exporter Excel (CSV)</button></div></div>`);
}
async function savePedagogicGrid(mode){
 const yearId=Number(val('pedGridYear')),period=val('pedGridPeriod');
 const inputs=[...document.querySelectorAll('.ped-grid-note')].filter(x=>x.value.trim()!=='');
 if(!yearId||!period)return alert('Choisissez une année scolaire et un trimestre.');
 if(!inputs.length)return alert('Saisissez au moins une note avant d’enregistrer.');
 for(const x of inputs){const n=Number(x.value);if(!Number.isFinite(n)||n<0||n>20)return alert('Chaque note doit être comprise entre 0 et 20.');}
 if(!confirm(`Enregistrer ou mettre à jour ${inputs.length} note(s) ?`))return;
 for(const x of inputs){
  const studentId=Number(x.dataset.student),matterId=Number(x.dataset.subject),type=x.dataset.type,note=Number(x.value);
  const student=db.students.find(st=>Number(st.id)===studentId),mapping=liveClassSubjects.find(a=>Number(a.classe_id)===Number(student?.classId)&&Number(a.matiere_id)===matterId&&Number(a.annee_scolaire_id)===yearId);
  const coefficient_applique=Number(mapping?.coefficient)||1;
  const {data:found,error:findError}=await supabaseClient.from('notes').select('id').eq('etablissement_id',activeSiteId).eq('annee_scolaire_id',yearId).eq('eleve_id',studentId).eq('matiere_id',matterId).eq('periode',period).eq('type_evaluation',type).limit(1);
  if(findError){notifyError('Recherche des notes',findError);return;}
  const result=found?.length?await supabaseClient.from('notes').update({note,coefficient_applique}).eq('id',found[0].id).eq('etablissement_id',activeSiteId):await supabaseClient.from('notes').insert({etablissement_id:activeSiteId,annee_scolaire_id:yearId,eleve_id:studentId,matiere_id:matterId,note,type_evaluation:type,periode:period,coefficient_applique});
  if(result.error){notifyError('Enregistrement des notes',result.error);return;}
 }
 await loadLiveData();showPage(mode==='class'?'grades':mode==='student'?'ped-student-averages':'ped-subject-averages');alert(`${inputs.length} note(s) enregistrée(s) ou mise(s) à jour.`);
}

function pedagogyClassStatsPage(){
 const period=val('classStatsPeriod')||'1er trimestre',classId=Number(val('classStatsClass')||0);
 const classes=db.classes.filter(c=>!classId||Number(c.id)===classId);
 const rows=classes.map(c=>{
  const roster=db.students.filter(st=>Number(st.classId)===Number(c.id));
  const averages=roster.map(st=>studentPeriodAverage(st.id,period)).filter(v=>v!==null);
  const avg=averages.length?averages.reduce((a,b)=>a+b,0)/averages.length:null;
  const passed=averages.filter(v=>v>=10).length,failed=averages.filter(v=>v<10).length;
  const best=averages.length?Math.max(...averages):null,lowest=averages.length?Math.min(...averages):null;
  return `<tr><td>${esc(c.name)}</td><td>${roster.length}</td><td>${averages.length}</td><td>${avg===null?'—':avg.toFixed(2)+'/20'}</td><td>${passed}</td><td>${failed}</td><td>${best===null?'—':best.toFixed(2)}</td><td>${lowest===null?'—':lowest.toFixed(2)}</td></tr>`;
 }).join('');
 return pageShell('Statistiques scolaires trimestrielles par classe','Synthèse calculée à partir des notes enregistrées et des coefficients affectés à chaque classe. Les élèves sans notes suffisantes ne sont pas comptés dans la moyenne.','','',`<div class="card"><div class="form-grid"><label>Année scolaire<input value="${esc(currentSchoolYear())}" disabled></label><label>Trimestre<select id="classStatsPeriod" onchange="showPage('ped-term-averages')"><option ${period==='1er trimestre'?'selected':''}>1er trimestre</option><option ${period==='2e trimestre'?'selected':''}>2e trimestre</option><option ${period==='3e trimestre'?'selected':''}>3e trimestre</option></select></label><label>Classe<select id="classStatsClass" onchange="showPage('ped-term-averages')"><option value="">Toutes les classes</option>${db.classes.map(c=>`<option value="${c.id}" ${classId===Number(c.id)?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Classe</th><th>Effectif</th><th>Notes complètes</th><th>Moyenne de classe</th><th>Admis (≥10)</th><th>En difficulté (<10)</th><th>Meilleure moyenne</th><th>Plus faible moyenne</th></tr></thead><tbody>${rows||'<tr><td colspan="8" class="empty">Aucune classe ou donnée disponible.</td></tr>'}</tbody></table></div></div>`);
}
function schedulePage(){const cls=val('scheduleClass'),day=val('scheduleDay'),teacherId=val('scheduleTeacher');const list=liveTimetable.filter(t=>(!cls||String(t.classe_id)===cls)&&(!teacherId||String(t.enseignant_id)===teacherId)&&(!day||t.jour===day)).sort((a,b)=>String(a.heure_debut).localeCompare(String(b.heure_debut)));const rows=list.map(t=>{const c=db.classes.find(x=>Number(x.id)===Number(t.classe_id)),m=liveSubjects.find(x=>Number(x.id)===Number(t.matiere_id)),teacher=db.teachers.find(x=>Number(x.id)===Number(t.enseignant_id));return `<tr><td>${esc(c?.name||'Classe')}</td><td>${esc(t.jour)}</td><td>${String(t.heure_debut||'').slice(0,5)}–${String(t.heure_fin||'').slice(0,5)}</td><td>${esc(m?.nom||'—')}</td><td>${esc(teacher?.name||'—')}</td><td>${esc(t.salle||'—')}</td></tr>`}).join('');return pageShell('Emplois du temps','Filtres par établissement actif, classe et jour ; cours du lundi au samedi','Ajouter un cours','openTimetableForm()',`<div class="card"><div class="form-grid"><label>Établissement<input value="${esc(currentSite()?.nom||'')}" disabled></label><label>Année scolaire<input value="${esc(db.settings?.schoolYear||currentSchoolYear())}" disabled></label><label>Classe<select id="scheduleClass" onchange="showPage('schedule')"><option value="">Toutes les classes</option>${classSelectOptions().replace(`value="${cls}"`,`value="${cls}" selected`)}</select></label><label>Professeur<select id="scheduleTeacher" onchange="showPage('schedule')"><option value="">Tous les professeurs</option>${db.teachers.map(t=>`<option value="${t.id}" ${teacherId===String(t.id)?'selected':''}>${esc(t.name)}</option>`).join('')}</select></label><label>Jour<select id="scheduleDay" onchange="showPage('schedule')"><option value="">Tous les jours</option>${['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map(d=>`<option ${day===d?'selected':''}>${d}</option>`).join('')}</select></label></div></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Classe</th><th>Jour</th><th>Horaire</th><th>Matière</th><th>Enseignant</th><th>Salle</th></tr></thead><tbody>${rows||'<tr><td colspan="6" class="empty">Aucun cours planifié pour ces critères.</td></tr>'}</tbody></table></div></div>`);}
function openTimetableForm(){if(!db.classes.length)return alert('Créez d’abord les classes.');if(!liveSubjects.length)return alert('Ajoutez d’abord les matières.');document.getElementById('modalTitle').textContent='Ajouter un cours à l’emploi du temps';document.getElementById('modalBody').innerHTML=`<div class="form-grid"><label>Classe<select id="ttClass">${db.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>Jour<select id="ttDay">${['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'].map(d=>`<option>${d}</option>`).join('')}</select></label><label>Heure début<input id="ttStart" type="time" value="08:00"></label><label>Heure fin<input id="ttEnd" type="time" value="10:00"></label><label>Matière<select id="ttSubject">${liveSubjects.map(m=>`<option value="${m.id}">${esc(m.nom)}</option>`).join('')}</select></label><label>Enseignant<select id="ttTeacher"><option value="">Non affecté</option>${db.teachers.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label><label>Salle<input id="ttRoom"></label></div><button class="btn primary" onclick="saveTimetableEntry()">Enregistrer</button>`;document.getElementById('modal').classList.remove('hidden');}
async function saveTimetableEntry(){const start=val('ttStart'),end=val('ttEnd');if(!start||!end||end<=start)return alert('Vérifiez les heures du cours.');const {error}=await supabaseClient.from('emplois_temps').insert({etablissement_id:activeSiteId,classe_id:Number(val('ttClass')),jour:val('ttDay'),heure_debut:start,heure_fin:end,matiere_id:Number(val('ttSubject')),enseignant_id:val('ttTeacher')?Number(val('ttTeacher')):null,salle:val('ttRoom')||null});if(error){notifyError('Création du cours',error);return;}closeModal();await loadLiveData();showPage('schedule');}
function gradesPage(){
 const classId=Number(gradeEntryState.classId||0);
 const yearId=Number(gradeEntryState.yearId||0);
 const period=gradeEntryState.period||'1er trimestre';
 const studentId=Number(gradeEntryState.studentId||0);
 const classOptions=db.classes.map(c=>`<option value="${c.id}" ${classId===Number(c.id)?'selected':''}>${esc(c.name)}</option>`).join('');
 const yearOptions=`<option value="">Choisir une année scolaire</option>`+liveYears.map(y=>`<option value="${y.id}" ${yearId===Number(y.id)?'selected':''}>${esc(y.libelle)}</option>`).join('');
 const students=db.students.filter(s=>classId&&Number(s.classId)===classId).sort((a,b)=>String(a.name).localeCompare(String(b.name),'fr'));
 const studentOptions=students.map(s=>`<option value="${s.id}" ${studentId===Number(s.id)?'selected':''}>${esc(s.name)}${s.matricule?' — '+esc(s.matricule):''}</option>`).join('');
 const mappings=classId?liveClassSubjects.filter(a=>Number(a.classe_id)===classId).map(a=>({mapping:a,subject:liveSubjects.find(m=>Number(m.id)===Number(a.matiere_id))})).filter(x=>x.subject).sort((a,b)=>String(a.subject.nom).localeCompare(String(b.subject.nom),'fr')):[];
 const types=[{key:'Moyenne d’interrogation',short:'Moy. Int'},{key:'Premier devoir',short:'Dev1'},{key:'Deuxième devoir',short:'Dev2'}];
 const selected=students.find(s=>Number(s.id)===studentId);
 const rows=selected?mappings.map(({mapping,subject},i)=>{
  const get=t=>db.grades.find(g=>Number(g.studentId)===studentId&&Number(g.matterId)===Number(subject.id)&&Number(g.yearId)===yearId&&String(g.period||'')===period&&emNorm(g.type)===emNorm(t));
  const values=types.map(t=>get(t.key)?.note??'');
  const nums=values.map(v=>v===''?null:Number(v));
  const complete=nums.every(v=>v!==null&&Number.isFinite(v));
  const avg=complete?nums.reduce((a,b)=>a+b,0)/3:null;
  const coef=Number(mapping.coefficient)||1;
  const appreciation=avg===null?'—':avg>=16?'Très bien':avg>=14?'Bien':avg>=12?'Assez bien':avg>=10?'Passable':'Insuffisant';
  const peerAverages=students.map(st=>subjectAverageFor(st.id,subject.id,period,yearId)).filter(v=>v!==null).sort((a,b)=>b-a);
  const rank=avg===null?'—':(peerAverages.findIndex(v=>v<=avg)+1)||'—';
  return `<tr data-subject-row="${Number(subject.id)}"><td>${i+1}</td><td><strong>${esc(subject.nom)}</strong></td>${types.map((t,j)=>`<td><input class="class-average-input" data-subject="${Number(subject.id)}" data-type="${esc(t.key)}" type="number" min="0" max="20" step="0.25" value="${values[j]===''?'':esc(values[j])}" style="width:78px" oninput="recalculateSelectedStudentAverages()" aria-label="${esc(subject.nom)} ${t.short}"></td>`).join('')}<td><input class="class-average-result" data-average="${Number(subject.id)}" value="${avg===null?'':avg.toFixed(2)}" readonly style="width:78px"></td><td><input value="${coef}" readonly style="width:55px"></td><td><input class="class-average-appreciation" data-appreciation="${Number(subject.id)}" value="${appreciation}" readonly style="width:110px"></td><td><input class="class-average-rank" data-rank="${Number(subject.id)}" value="${rank}" readonly style="width:48px"></td></tr>`;
 }).join(''):'';
 const savedRows=selected?db.grades.filter(g=>Number(g.studentId)===studentId&&Number(g.yearId)===yearId&&String(g.period||'')===period).map(g=>`<tr><td>${esc(g.matter)}</td><td>${esc(g.type)}</td><td>${esc(g.note)}</td><td><button class="btn light" onclick="editGrade(${Number(g.id)})">Modifier</button> <button class="btn danger" onclick="deleteGrade(${Number(g.id)})">Supprimer</button></td></tr>`).join(''):'';
 return pageShell('Saisie des moyennes par classe','Sélectionnez une classe et un apprenant : toutes les matières affectées apparaissent sur une seule fiche.','', '',`
 <div class="card">
  <div class="form-grid">
   <label>Établissement<input value="${esc(currentSite()?.nom||'')}" readonly></label>
   <label>Année scolaire<select id="gradeYearSelect" onchange="gradeEntryState.yearId=Number(this.value);showPage('grades')">${yearOptions}</select></label>
   <label>Session académique<select id="gradePeriodSelect" onchange="gradeEntryState.period=this.value;showPage('grades')">${['1er trimestre','2e trimestre','3e trimestre'].map(p=>`<option value="${p}" ${period===p?'selected':''}>${p.toUpperCase()}</option>`).join('')}</select></label>
   <label>Classe<select id="gradeClassFilter" onchange="gradeEntryState.classId=Number(this.value);gradeEntryState.studentId=0;showPage('grades')"><option value="">Choisir une classe</option>${classOptions}</select></label>
   <label>Apprenant<select id="gradeStudentSelect" onchange="gradeEntryState.studentId=Number(this.value);showPage('grades')"><option value="">-- Sélectionnez l'apprenant --</option>${studentOptions}</select></label>
   <div style="display:flex;align-items:end"><button class="btn primary" onclick="recalculateSelectedStudentAverages()">Recalculer la moyenne</button></div>
  </div>
  <p class="muted">Calcul de la moyenne générale d'un apprenant par session académique. Moyenne matière = (moyenne interrogation + devoir 1 + devoir 2) ÷ 3. La moyenne générale tient compte des coefficients des matières.</p>
 </div>
 <div class="card" style="margin-top:14px">
  <div class="table-wrap" style="overflow-x:auto"><table class="table"><thead><tr><th>N°</th><th>Matière</th><th>Moy. Int</th><th>Dev1</th><th>Dev2</th><th>Moyenne</th><th>Coef</th><th>Appréciation</th><th>Rang</th></tr></thead><tbody>${!classId?'<tr><td colspan="9" class="empty">Choisissez une classe.</td></tr>':!selected?'<tr><td colspan="9" class="empty">Choisissez un apprenant pour afficher toutes les matières de sa classe.</td></tr>':rows||'<tr><td colspan="9" class="empty">Aucune matière n’est affectée à cette classe. Affectez d’abord les matières.</td></tr>'}</tbody></table></div>
  ${selected?`<div class="toolbar" style="margin-top:14px"><strong>Moyenne générale :</strong><input id="classGeneralAverage" readonly style="max-width:110px"><strong>Rang :</strong><input id="classGeneralRank" readonly style="max-width:80px"><button class="btn primary" onclick="saveClassAverageSheet()">Enregistrer</button></div>`:''}
 </div>
 ${selected?`<div class="card" style="margin-top:14px"><h3>Notes déjà enregistrées pour ${esc(selected.name)}</h3><div class="table-wrap"><table class="table"><thead><tr><th>Matière</th><th>Évaluation</th><th>Note</th><th>Actions</th></tr></thead><tbody>${savedRows||'<tr><td colspan="4" class="empty">Aucune note enregistrée pour cette période.</td></tr>'}</tbody></table></div></div>`:''}`);
}
function recalculateSelectedStudentAverages(){
 const inputs=[...document.querySelectorAll('.class-average-input')],bySubject={};
 for(const input of inputs){const id=input.dataset.subject;(bySubject[id]??={})[emNorm(input.dataset.type)]=input.value.trim()===''?null:Number(input.value);}
 let weighted=0,coeffSum=0,completeCount=0;
 for(const [id,v] of Object.entries(bySubject)){
  const values=[v[emNorm('Moyenne d’interrogation')],v[emNorm('Premier devoir')],v[emNorm('Deuxième devoir')]];
  const complete=values.every(x=>x!==null&&Number.isFinite(x)&&x>=0&&x<=20);
  const avg=complete?values.reduce((a,b)=>a+b,0)/3:null;
  const avgInput=document.querySelector(`[data-average="${id}"]`),appInput=document.querySelector(`[data-appreciation="${id}"]`);
  if(avgInput)avgInput.value=avg===null?'':avg.toFixed(2);
  if(appInput)appInput.value=avg===null?'—':avg>=16?'Très bien':avg>=14?'Bien':avg>=12?'Assez bien':avg>=10?'Passable':'Insuffisant';
  if(complete){const row=document.querySelector(`[data-subject-row="${id}"]`),coef=Number(row?.querySelector('td:nth-child(7) input')?.value)||1;weighted+=avg*coef;coeffSum+=coef;completeCount++;}
 }
 const general=coeffSum?weighted/coeffSum:null,field=document.getElementById('classGeneralAverage');
 if(field)field.value=general===null?'':general.toFixed(2);
 const rankField=document.getElementById('classGeneralRank');
 if(rankField){
  if(general===null)rankField.value='—';
  else{
   const currentId=Number(gradeEntryState.studentId);
   const peerValues=db.students.filter(st=>Number(st.classId)===Number(gradeEntryState.classId)&&Number(st.id)!==currentId).map(st=>studentPeriodAverage(st.id,gradeEntryState.period)).filter(v=>v!==null);
   rankField.value=1+peerValues.filter(v=>v>general).length;
  }
 }
}
async function saveClassAverageSheet(){
 const classId=Number(gradeEntryState.classId),studentId=Number(gradeEntryState.studentId),yearId=Number(gradeEntryState.yearId||0),period=gradeEntryState.period;
 if(!classId||!studentId||!yearId)return alert('Choisissez une classe, une année scolaire et un apprenant.');
 const inputs=[...document.querySelectorAll('.class-average-input')],filled=inputs.filter(x=>x.value.trim()!=='');
 if(!filled.length)return alert('Saisissez au moins une note.');
 for(const input of filled){const n=Number(input.value);if(!Number.isFinite(n)||n<0||n>20)return alert('Toutes les notes doivent être comprises entre 0 et 20.');}
 if(!confirm(`Enregistrer les notes de ${db.students.find(s=>Number(s.id)===studentId)?.name||'cet apprenant'} pour toutes les matières renseignées ?`))return;
 let saved=0;
 for(const input of filled){
  const matterId=Number(input.dataset.subject),type=input.dataset.type,note=Number(input.value),mapping=liveClassSubjects.find(x=>Number(x.classe_id)===classId&&Number(x.matiere_id)===matterId),coefficient_applique=Number(mapping?.coefficient)||1;
  const {data:existing,error:findError}=await supabaseClient.from('notes').select('id').eq('etablissement_id',activeSiteId).eq('annee_scolaire_id',yearId).eq('eleve_id',studentId).eq('matiere_id',matterId).eq('periode',period).eq('type_evaluation',type).limit(1);
  if(findError){notifyError('Recherche des notes existantes',findError);return;}
  const result=existing?.length?await supabaseClient.from('notes').update({note,coefficient_applique}).eq('id',existing[0].id).eq('etablissement_id',activeSiteId):await supabaseClient.from('notes').insert({etablissement_id:activeSiteId,annee_scolaire_id:yearId,eleve_id:studentId,matiere_id:matterId,note,type_evaluation:type,periode:period,coefficient_applique});
  if(result.error){notifyError('Enregistrement des notes',result.error);return;}saved++;
 }
 await loadLiveData();showPage('grades');alert(`${saved} note(s) enregistrée(s) ou mise(s) à jour.`);
}

function openSubjectForm(){document.getElementById('modalTitle').textContent='Ajouter une matière';document.getElementById('modalBody').innerHTML=`<div class="form-grid"><label>Code<input id="subjectCode" required></label><label>Nom<input id="subjectName" required></label><label>Coefficient<input id="subjectCoeff" type="number" min="0.01" step="0.01" value="1"></label><label class="full">Description<input id="subjectDescription"></label></div><button class="btn primary" onclick="saveSubject()">Enregistrer</button>`;document.getElementById('modal').classList.remove('hidden');}
async function saveSubject(){const code=val('subjectCode').trim(),nom=val('subjectName').trim(),coefficient=Number(val('subjectCoeff'));if(!code||!nom||!Number.isFinite(coefficient)||coefficient<=0)return alert('Code, matière et coefficient positif obligatoires.');const {data:dup,error:checkError}=await supabaseClient.from('matieres').select('id').eq('etablissement_id',activeSiteId).ilike('code',code).limit(1);if(checkError){notifyError('Vérification matière',checkError);return;}if(dup?.length)return alert('Ce code matière existe déjà dans cet établissement.');const {error}=await supabaseClient.from('matieres').insert({etablissement_id:activeSiteId,code,nom,coefficient,description:val('subjectDescription')||null});if(error){notifyError('Création matière',error);return;}closeModal();await loadLiveData();showPage('ped-assign-subjects');}
function gradeSubjectOptions(classId,selectedId){return liveClassSubjects.filter(x=>Number(x.classe_id)===Number(classId)).map(x=>{const m=liveSubjects.find(s=>Number(s.id)===Number(x.matiere_id));return m?`<option value="${m.id}" ${Number(selectedId)===Number(m.id)?'selected':''}>${esc(m.nom)} · coeff. ${esc(x.coefficient)}</option>`:''}).join('');}
function refreshGradeSubjects(selectedId){const student=db.students.find(s=>Number(s.id)===Number(val('gradeStudent'))),sel=document.getElementById('gradeSubject');if(sel)sel.innerHTML=gradeSubjectOptions(student?.classId,selectedId)||'<option value="">Aucune matière affectée à cette classe</option>';}
function openGradeForm(){showPage('grades');}
async function saveBulkGrades(){return saveClassAverageSheet();}
async function saveGrade(){const note=Number(val('gradeValue'));if(!Number.isFinite(note)||note<0||note>20)return alert('La note doit être comprise entre 0 et 20.');const student=db.students.find(s=>Number(s.id)===Number(val('gradeStudent'))),mapping=liveClassSubjects.find(x=>Number(x.classe_id)===Number(student?.classId)&&Number(x.matiere_id)===Number(val('gradeSubject')));if(!student||!mapping)return alert('Cette matière n’est pas affectée à la classe de cet apprenant.');const coefficient_applique=Number(mapping.coefficient)||1;const {error}=await supabaseClient.from('notes').insert({etablissement_id:activeSiteId,annee_scolaire_id:Number(val('gradeYear')),eleve_id:Number(val('gradeStudent')),matiere_id:Number(val('gradeSubject')),note,type_evaluation:val('gradeType'),periode:val('gradePeriod'),coefficient_applique,observation:val('gradeObservation')||null});if(error){notifyError('Enregistrement de la note',error);return;}closeModal();await loadLiveData();showPage('ped-assign-subjects');}
async function editGrade(id){const g=db.grades.find(x=>Number(x.id)===Number(id));if(!g)return alert('Note introuvable.');const student=db.students.find(s=>Number(s.id)===Number(g.studentId));document.getElementById('modalTitle').textContent='Modifier la note';document.getElementById('modalBody').innerHTML=`<div class="form-grid"><label>Apprenant<input value="${esc(g.student)}" disabled></label><label>Matière<input value="${esc(g.matter)}" disabled></label><label>Note sur 20<input id="editGradeValue" type="number" min="0" max="20" step="0.25" value="${Number(g.note)}"></label><label>Type d’évaluation<select id="editGradeType">${['Moyenne d’interrogation','Premier devoir','Deuxième devoir','Composition','Examen'].map(t=>`<option ${t===g.type?'selected':''}>${t}</option>`).join('')}</select></label><label>Période<select id="editGradePeriod">${['1er trimestre','2e trimestre','3e trimestre','1er semestre','2e semestre'].map(t=>`<option ${t===g.period?'selected':''}>${t}</option>`).join('')}</select></label><label class="full">Observation<textarea id="editGradeObservation">${esc(g.observation||'')}</textarea></label></div><button class="btn primary" onclick="updateGrade(${Number(g.id)})">Enregistrer les modifications</button>`;document.getElementById('modal').classList.remove('hidden');}
async function updateGrade(id){const note=Number(val('editGradeValue'));if(!Number.isFinite(note)||note<0||note>20)return alert('La note doit être comprise entre 0 et 20.');const {error}=await supabaseClient.from('notes').update({note,type_evaluation:val('editGradeType'),periode:val('editGradePeriod'),observation:val('editGradeObservation')||null}).eq('id',id).eq('etablissement_id',activeSiteId);if(error){notifyError('Modification de la note',error);return;}closeModal();await loadLiveData();showPage('ped-assign-subjects');}
async function deleteGrade(id){if(currentProfile?.role!=="administrateur_general"){alert("Seul l’administrateur général peut supprimer une note. Contactez la direction.");return;}if(!confirm('Archiver cette note ? Elle pourra être restaurée depuis la corbeille.'))return;const {error}=await supabaseClient.rpc("corbeille_archiver",{p_table:"notes",p_id:Number(id)});if(error){notifyError('Archivage de la note',error);return;}await loadLiveData();showPage('recycle-bin');}
function printGrade(id){const g=db.grades.find(x=>Number(x.id)===Number(id));if(!g)return alert('Note introuvable.');const st=db.students.find(x=>Number(x.id)===Number(g.studentId)),w=window.open('','_blank');if(!w)return alert('Autorisez les fenêtres contextuelles pour imprimer.');w.document.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Fiche de note</title><style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#172033;font-size:10pt}.sheet{width:100%;max-width:186mm;margin:0 auto;border:1px solid #ccd5e0;padding:10mm;page-break-inside:avoid;break-inside:avoid}h2{text-align:center;color:#174a8b;font-size:17pt;margin:0 0 8mm}h3{font-size:13pt;text-align:center;margin:5mm 0}table{width:100%;border-collapse:collapse;margin-top:8mm}td,th{border:1px solid #ccd5e0;padding:4mm;text-align:left}.note{font-size:22pt;font-weight:bold;text-align:center}@media print{button{display:none!important}.sheet{page-break-inside:avoid;break-inside:avoid}}@media screen{body{padding:10px;background:#f4f6f8}.sheet{background:#fff}}</style><div class="sheet"><h2>GROUPE SCOLAIRE LA RÉFÉRENCE</h2><h3>FICHE DE NOTE</h3><p><b>Apprenant :</b> ${esc(g.student)}<br><b>Classe :</b> ${esc(st?.class||'—')}<br><b>Période :</b> ${esc(g.period||'—')}</p><table><tr><th>Matière</th><th>Évaluation</th><th>Note / 20</th><th>Coefficient</th></tr><tr><td>${esc(g.matter)}</td><td>${esc(g.type)}</td><td class="note">${esc(g.note)}</td><td>${esc(g.coeff)}</td></tr></table><p><b>Observation :</b> ${esc(g.observation||'—')}</p><p style="margin-top:55px;text-align:right">La Direction</p><button onclick="window.print()">Imprimer</button></div></html>`);w.document.close();setTimeout(()=>{try{w.focus();w.print();}catch(e){}},350);}
function editClassSubject(id){
 const a=liveClassSubjects.find(x=>Number(x.id)===Number(id));if(!a)return alert('Affectation introuvable.');pedagogySelectedClassId=Number(a.classe_id);
 document.getElementById('modalTitle').textContent='Modifier la matière de cette classe';
 document.getElementById('modalBody').innerHTML=`<div class="form-grid"><label>Matière<select id="editAssignSubject">${liveSubjects.map(m=>`<option value="${m.id}" ${Number(m.id)===Number(a.matiere_id)?'selected':''}>${esc(m.nom)}</option>`).join('')}</select></label><label>Coefficient<input id="editAssignCoeff" type="number" min="0.01" step="0.01" value="${esc(a.coefficient)}"></label></div><button class="btn primary" onclick="updateClassSubject(${Number(a.id)})">Enregistrer les modifications</button>`;
 document.getElementById('modal').classList.remove('hidden');
}
async function updateClassSubject(id){
 const a=liveClassSubjects.find(x=>Number(x.id)===Number(id)),matiere_id=Number(val('editAssignSubject')),coefficient=Number(val('editAssignCoeff'));
 if(!a||!matiere_id||!Number.isFinite(coefficient)||coefficient<=0)return alert('Choisissez une matière et un coefficient positif.');pedagogySelectedClassId=Number(a.classe_id);
 const {data:dup,error:checkError}=await supabaseClient.from('classes_matieres').select('id').eq('classe_id',a.classe_id).eq('matiere_id',matiere_id).eq('annee_scolaire_id',a.annee_scolaire_id).eq('etablissement_id',activeSiteId).neq('id',id).limit(1);
 if(checkError){notifyError('Vérification de la matière',checkError);return;}
 if(dup?.length)return alert('Cette matière est déjà enregistrée dans cette classe pour cette année.');
 const {error}=await supabaseClient.from('classes_matieres').update({matiere_id,coefficient,actif:true}).eq('id',id).eq('etablissement_id',activeSiteId);
 if(error){notifyError('Modification de la matière',error);return;}
 closeModal();await loadLiveData();showPage('ped-assign-subjects');
}
async function deleteClassSubject(id){const a=liveClassSubjects.find(x=>Number(x.id)===Number(id));if(!a)return alert('Affectation introuvable.');pedagogySelectedClassId=Number(a.classe_id);if(!confirm('Retirer uniquement cette matière de cette classe ? Les autres matières et les notes déjà enregistrées seront conservées.'))return;const {error}=await supabaseClient.from('classes_matieres').update({actif:false}).eq('id',id).eq('classe_id',a.classe_id).eq('matiere_id',a.matiere_id).eq('annee_scolaire_id',a.annee_scolaire_id).eq('etablissement_id',activeSiteId);if(error){notifyError('Suppression de la matière de la classe',error);return;}await loadLiveData();showPage('ped-assign-subjects');}
function attendanceToday(){const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function attendancePage(){
 const selectedDate=val("attendanceQuickDate")||attendanceToday();const rows=db.attendance.filter(a=>String(a.state||"").toLowerCase().includes("absent")&&a.date===selectedDate).sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).map(a=>{const st=db.students.find(x=>String(x.id)===String(a.studentId));return `<tr><td>${esc(a.student)}</td><td>${esc(st?.class||"—")}</td><td>${a.date?new Date(a.date+"T00:00:00").toLocaleDateString("fr-FR"):""}</td><td>${esc(a.reason||"—")}</td></tr>`}).join("");
 return pageShell("Présences et absences","Appel quotidien : choisissez une classe et cochez uniquement les élèves absents.","Faire l’appel de la classe","openAttendanceForm()",`<div class="card"><div class="toolbar"><label>Date du jour<input type="date" id="attendanceQuickDate" value="${attendanceToday()}" onchange="refreshAttendanceDate()"></label><button class="btn primary" onclick="openAttendanceForm()">Faire l’appel</button></div><h3>Absences enregistrées</h3><div class="table-wrap"><table class="table"><thead><tr><th>Élève</th><th>Classe</th><th>Date</th><th>Motif</th></tr></thead><tbody>${rows||'<tr><td colspan="4" class="empty">Aucune absence enregistrée.</td></tr>'}</tbody></table></div></div>`);
}
function refreshAttendanceDate(){showPage("attendance");}
function openAttendanceForm(){
 if(!db.students.length)return alert("Aucun élève dans cet établissement.");
 const classOptions=db.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 document.getElementById("modalTitle").textContent="Appel quotidien — absences par classe";
 document.getElementById("modalBody").innerHTML=`<div class="form-grid"><label>Classe<select id="attendanceClass" onchange="loadAttendanceClass()"><option value="">Choisir une classe</option>${classOptions}</select></label><label>Date du pointage<input id="attendanceDate" type="date" value="${attendanceToday()}" onchange="loadAttendanceClass()"></label></div><p class="muted">La liste complète de la classe apparaît. Cochez uniquement les élèves absents ; les autres seront enregistrés comme présents.</p><div id="attendanceRoster" class="table-wrap"><p class="empty">Choisissez une classe pour afficher les élèves.</p></div><button class="btn primary" style="margin-top:12px" onclick="saveAttendanceClass()">Enregistrer l’appel</button>`;
 document.getElementById("modal").classList.remove("hidden");
}
function loadAttendanceClass(){
 const classId=val("attendanceClass"),date=val("attendanceDate"),target=document.getElementById("attendanceRoster");if(!target)return;
 if(!classId){target.innerHTML='<p class="empty">Choisissez une classe pour afficher les élèves.</p>';return;}
 const students=db.students.filter(s=>String(s.classId)===String(classId)&&s.status!=="ancien"&&s.status!=="exclu"&&s.status!=="transfere").sort((a,b)=>String(a.name).localeCompare(String(b.name),"fr"));
 if(!students.length){target.innerHTML='<p class="empty">Aucun élève actif dans cette classe.</p>';return;}
 target.innerHTML=`<table class="table"><thead><tr><th>N°</th><th>Nom et prénoms</th><th>Absent ?</th><th>Motif (facultatif)</th></tr></thead><tbody>${students.map((st,i)=>{const old=db.attendance.find(a=>String(a.studentId)===String(st.id)&&a.date===date);return `<tr><td>${i+1}</td><td>${esc(st.name)}</td><td><input type="checkbox" class="attendance-absent" data-student="${st.id}" ${old&&String(old.state).toLowerCase().includes("absent")?"checked":""}></td><td><input class="attendance-reason" data-reason-student="${st.id}" value="${esc(old?.reason||"")}" placeholder="Motif"></td></tr>`}).join("")}</tbody></table><p>${students.length} élève(s) dans cette classe.</p>`;
}
async function saveAttendanceClass(){
 const classId=val("attendanceClass"),date=val("attendanceDate");if(!classId||!date)return alert("Choisissez une classe et une date.");
 const students=db.students.filter(s=>String(s.classId)===String(classId)&&s.status!=="ancien"&&s.status!=="exclu"&&s.status!=="transfere");if(!students.length)return alert("Aucun élève à pointer.");
 const {data:u,error:userError}=await supabaseClient.auth.getUser();if(userError||!u?.user)return alert("Session expirée. Reconnectez-vous.");
 const checks=[...document.querySelectorAll(".attendance-absent")],reasons=[...document.querySelectorAll(".attendance-reason")];
 for(const st of students){
  const absent=checks.find(x=>String(x.dataset.student)===String(st.id))?.checked||false;
  const reason=reasons.find(x=>String(x.dataset.reasonStudent)===String(st.id))?.value?.trim()||null;
  const old=db.attendance.find(a=>String(a.studentId)===String(st.id)&&a.date===date);
  if(old){const {error}=await supabaseClient.from("presences").update({statut:absent?"absent":"present",motif:absent?reason:null}).eq("id",old.id).eq("etablissement_id",activeSiteId);if(error){notifyError("Mise à jour du pointage de "+st.name,error);return;}}
  else {const {error}=await supabaseClient.from("presences").insert({etablissement_id:activeSiteId,eleve_id:Number(st.id),date_presence:date,statut:absent?"absent":"present",motif:absent?reason:null,saisi_par:u.user.id});if(error){notifyError("Enregistrement du pointage de "+st.name,error);return;}}
 }
 alert("Appel enregistré pour "+students.length+" élève(s). Les absences cochées ont été enregistrées et les autres élèves marqués présents.");closeModal();await loadLiveData();showPage("attendance");
}

function studentsPage(){
 const selectedYear=String(liveYears.find(y=>y.active)?.id||liveYears[0]?.id||"");
 const rows=studentDirectoryRows(selectedYear);
 const yearOptions=liveYears.map(y=>`<option value="${y.id}" ${String(y.id)===selectedYear?"selected":""}>${esc(y.libelle)}${y.active?" — Active":""}</option>`).join("");
 const baseStudents=selectedYear?db.students.filter(s=>liveStudentSchedules.some(x=>String(x.eleve_id)===String(s.id)&&String(x.annee_scolaire_id)===selectedYear)):db.students;
 const girls=baseStudents.filter(s=>s.sex==="F").length,boys=baseStudents.filter(s=>s.sex==="M").length;
 const classOptions=db.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 const body=`<div class="card student-directory-head" style="margin-bottom:14px"><div class="form-grid"><label>Établissement<input value="${esc(currentSite()?.nom||"")}" disabled></label><label>Année scolaire<select id="studentDirectoryYearFilter" onchange="changeStudentDirectoryYear()"><option value="">Toutes les années</option>${yearOptions}</select></label><label>Classe<select id="studentClassFilter" onchange="filterStudentDirectory()"><option value="">Toutes les classes</option>${classOptions}</select></label></div><div class="toolbar" style="margin-top:12px;align-items:center"><div class="button-row"><button class="btn primary" onclick="openForm('student')">＋ Nouveau</button><button class="btn light" onclick="openReenrollment()">Réinscription</button><button class="btn light" onclick="printStudentCardsFromDirectory()">Cartes</button><button class="btn light" onclick="generateMissingClassSchedules()">Créer les échéanciers manquants de la classe</button></div><div class="student-counts"><b>Filles : <span id="studentGirls">${girls}</span></b><b>Garçons : <span id="studentBoys">${boys}</span></b><b>Effectif total : <span id="studentTotal">${baseStudents.length}</span></b></div></div></div><div class="toolbar"><input id="studentDirectorySearch" placeholder="Rechercher un apprenant..." oninput="filterStudentDirectory()"><span class="muted" id="studentDirectoryCount">${baseStudents.length} apprenant(s)</span></div><div class="table-wrap"><table class="table student-directory-table"><thead><tr><th>N°</th><th>ÉDUCMASTER</th><th>Photo</th><th>Nom & prénoms</th><th>Date de naissance</th><th>Total à payer</th><th>Total payé</th><th>Reste à payer</th><th>Contact parent</th><th>Code d'accès parent</th><th>Situation</th><th>Action</th></tr></thead><tbody id="studentDirectoryBody">${rows}</tbody></table></div>`;
 return pageShell("Apprenants","Liste des apprenants de "+(currentSite()?.nom||"l’établissement")+" — inscriptions, réinscriptions et suivi de scolarité","","",body);
}
function studentDirectoryRows(yearId=""){
 const yearStudents=yearId?db.students.filter(s=>liveStudentSchedules.some(x=>String(x.eleve_id)===String(s.id)&&String(x.annee_scolaire_id)===String(yearId))):db.students;
 return yearStudents.filter(s=>s.status!=="ancien"&&s.status!=="exclu").map((s,i)=>{const schedules=liveStudentSchedules.filter(x=>String(x.eleve_id)===String(s.id)&&(!yearId||String(x.annee_scolaire_id)===String(yearId)));const due=schedules.reduce((a,x)=>a+Number(x.montant_net||0),0),paid=schedules.reduce((a,x)=>a+Number(x.montant_paye||0),0),rest=schedules.reduce((a,x)=>a+Number(x.reste_a_payer||0),0);const link=liveStudentParentLinks.find(p=>String(p.eleve_id)===String(s.id)),parent=link?.parents;return `<tr data-class="${s.classId||""}" data-sex="${s.sex||""}" data-search="${esc([s.name,s.educmasterId,s.matricule,s.class,s.phone,parent?.telephone].join(" ").toLowerCase())}"><td>${i+1}</td><td>${esc(s.educmasterId||"—")}</td><td>${s.photo_url?`<img src="${esc(s.photo_url)}" alt="Photo" style="width:38px;height:44px;object-fit:cover;border-radius:4px">`:"—"}</td><td><b>${esc(s.name)}</b><small style="display:block;color:#64748b">${esc(s.class||"Sans classe")}</small></td><td>${s.birthDate?new Date(s.birthDate+"T00:00:00").toLocaleDateString("fr-FR"):"—"}</td><td>${due.toLocaleString("fr-FR")} FCFA</td><td>${paid.toLocaleString("fr-FR")} FCFA</td><td><b>${rest.toLocaleString("fr-FR")} FCFA</b></td><td>${esc(parent?.telephone||"—")}</td><td>—</td><td><button class="btn light" onclick="openStudentSituation(${Number(s.id)})">Voir le dossier</button></td><td class="actions"><button class="btn light" onclick="openEdit('student',${Number(s.id)})">Modifier dossier</button><button class="btn light" onclick="openEdit('student',${Number(s.id)})">Modifier inscription</button><button class="btn light" onclick="openStudentPayment(${Number(s.id)})">Paiement</button><button class="btn light" onclick="openClassTransfer(${Number(s.id)})">Changer de classe</button><button class="btn light" onclick="printStudentCard(${Number(s.id)})">Carte</button><button class="btn danger" onclick="removeItem('student',${Number(s.id)})">Supprimer</button></td></tr>`}).join("")||'<tr><td colspan="12" class="empty">Aucun apprenant enregistré pour cette année scolaire dans cet établissement.</td></tr>';
}
function changeStudentDirectoryYear(){const yearId=val("studentDirectoryYearFilter")||"";const body=document.getElementById("studentDirectoryBody");if(body)body.innerHTML=studentDirectoryRows(yearId);const filtered=yearId?db.students.filter(s=>liveStudentSchedules.some(x=>String(x.eleve_id)===String(s.id)&&String(x.annee_scolaire_id)===String(yearId))):db.students;const girls=filtered.filter(s=>s.sex==="F").length,boys=filtered.filter(s=>s.sex==="M").length;const set=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n};set("studentGirls",girls);set("studentBoys",boys);set("studentTotal",filtered.length);filterStudentDirectory();}

function openClassTransfer(studentId){
 const st=db.students.find(x=>Number(x.id)===Number(studentId));if(!st)return alert("Apprenant introuvable.");
 const opts=db.classes.map(c=>`<option value="${c.id}" ${Number(c.id)===Number(st.classId)?"selected":""}>${esc(c.name||c.level||"Classe")}</option>`).join("");
 document.getElementById("modalTitle").textContent="Changer l'apprenant de classe";
 document.getElementById("modalBody").innerHTML=`<p><strong>${esc(st.name)}</strong> · Classe actuelle : ${esc(st.class||"Sans classe")}</p><label>Nouvelle classe<select id="transferClass">${opts}</select></label><p class="muted">Le dossier, le matricule et l'historique des paiements sont conservés. Le changement de classe est enregistré sur le même apprenant.</p><button class="btn primary" onclick="saveClassTransfer(${Number(st.id)})">Confirmer le changement</button>`;
 document.getElementById("modal").classList.remove("hidden");
}
async function saveClassTransfer(studentId){
 const classId=Number(val("transferClass"));if(!classId)return alert("Choisissez la nouvelle classe.");
 const {error}=await supabaseClient.from("eleves").update({classe_id:classId}).eq("id",studentId).eq("etablissement_id",activeSiteId);
 if(error){notifyError("Changement de classe",error);return;}
 closeModal();await loadLiveData();showPage("students");alert("Classe de l'apprenant mise à jour. Son historique est conservé.");
}
function openStudentSituation(studentId){
 const st=db.students.find(x=>Number(x.id)===Number(studentId));if(!st)return alert("Apprenant introuvable.");
 const parents=liveStudentParentLinks.filter(x=>String(x.eleve_id)===String(studentId)).map(x=>x.parents).filter(Boolean);
 const schedules=liveStudentSchedules.filter(x=>String(x.eleve_id)===String(studentId));
 const grades=db.grades.filter(x=>String(x.studentId)===String(studentId));
 const totalDue=schedules.reduce((a,x)=>a+Number(x.montant_net||0),0),paid=schedules.reduce((a,x)=>a+Number(x.montant_paye||0),0),remaining=schedules.reduce((a,x)=>a+Number(x.reste_a_payer||0),0);
 const fmt=n=>Number(n||0).toLocaleString("fr-FR")+" FCFA";
 const parentHtml=parents.map(p=>`<tr><td>${esc([p.nom,p.prenoms].filter(Boolean).join(" "))}</td><td>${esc(p.lien||"Parent/tuteur")}</td><td>${esc(p.telephone||"—")}</td><td>${esc(p.email||"—")}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">Aucun parent ou tuteur associé.</td></tr>`;
 const feeHtml=schedules.map(x=>`<tr><td>${esc(x.libelle||"Échéance")}</td><td>${x.date_echeance?new Date(x.date_echeance+"T00:00:00").toLocaleDateString("fr-FR"):"À l'inscription"}</td><td>${fmt(x.montant_net)}</td><td>${fmt(x.montant_paye)}</td><td><b>${fmt(x.reste_a_payer)}</b></td></tr>`).join("")||`<tr><td colspan="5" class="empty">Aucun échéancier. Utilisez le bouton de création des échéanciers de la classe.</td></tr>`;
 const gradeHtml=grades.map(x=>`<tr><td>${esc(x.matter||"—")}</td><td>${esc(x.note??"—")}/20</td><td>${esc(x.period||"—")}</td><td>${esc(x.type||"—")}</td></tr>`).join("")||`<tr><td colspan="4" class="empty">Aucune note enregistrée.</td></tr>`;
 document.getElementById("modalTitle").textContent="Dossier complet — "+st.name;
 document.getElementById("modalBody").innerHTML=`<div class="student-situation"><div class="notice"><b>${esc(st.name)}</b> · ${esc(st.class||"Sans classe")}<br>Matricule : ${esc(st.matricule||"—")} · N° ÉducMaster : ${esc(st.educmasterId||"Non attribué")}</div><h4>Coordonnées de l'apprenant</h4><div class="form-grid"><p><b>Date de naissance :</b> ${esc(st.birthDate||"—")}</p><p><b>Sexe :</b> ${esc(st.sex||"—")}</p><p><b>Téléphone :</b> ${esc(st.phone||"—")}</p><p><b>Adresse :</b> ${esc(st.address||"—")}</p><p class="full"><b>E-mail :</b> ${esc(st.email||"—")}</p></div><h4>Parents et tuteurs associés</h4><div class="table-wrap"><table class="table"><thead><tr><th>Nom</th><th>Lien</th><th>Téléphone</th><th>E-mail</th></tr></thead><tbody>${parentHtml}</tbody></table></div><h4>Situation financière</h4><div class="student-counts"><b>Total dû : ${fmt(totalDue)}</b><b>Total payé : ${fmt(paid)}</b><b>Reste : ${fmt(remaining)}</b></div><div class="table-wrap"><table class="table"><thead><tr><th>Échéance</th><th>Date limite</th><th>Dû</th><th>Payé</th><th>Reste</th></tr></thead><tbody>${feeHtml}</tbody></table></div><h4>Notes scolaires</h4><div class="table-wrap"><table class="table"><thead><tr><th>Matière</th><th>Note</th><th>Période</th><th>Évaluation</th></tr></thead><tbody>${gradeHtml}</tbody></table></div></div>`;
 document.getElementById("modal").classList.remove("hidden");
}
async function generateMissingClassSchedules(){
 if(!liveMode)return alert("Connexion à la base officielle requise.");
 const classId=Number(val("studentClassFilter"));if(!classId)return alert("Choisissez d'abord une classe.");
 const selected=db.students.filter(s=>Number(s.classId)===classId&&s.status!=="ancien"&&s.status!=="exclu");
 if(!selected.length)return alert("Aucun apprenant actif dans cette classe.");
 const incomplete=selected.filter(s=>{const rows=liveStudentSchedules.filter(e=>String(e.eleve_id)===String(s.id));return rows.length===0||rows.length<7;});
 if(!incomplete.length)return alert("Les 7 tranches sont déjà présentes pour tous les apprenants de cette classe.");
 if(!confirm(`Vérifier et compléter les tranches manquantes pour les ${selected.length} apprenant(s) actifs de cette classe ? Les tranches existantes, remises et paiements seront conservés. Seules les tranches absentes seront ajoutées.`))return;
 let studentsUpdated=0,installmentsAdded=0,errors=[];
 for(const st of selected){
  const code=tariffCodeForStudent(st);if(!code){errors.push(st.name+" : classe/niveau non reconnu");continue;}
  const {data,error}=await supabaseClient.rpc("creer_echeancier_eleve",{p_eleve_id:Number(st.id),p_code_niveau:code});
  if(error)errors.push(st.name+" : "+error.message);
  else if(Number(data||0)>0){studentsUpdated++;installmentsAdded+=Number(data||0);}
 }
 await loadLiveData();showPage("students");
 alert(`${installmentsAdded} tranche(s) manquante(s) ajoutée(s) pour ${studentsUpdated} apprenant(s). Les paiements et tranches déjà enregistrés n'ont pas été modifiés.`+(errors.length?"\nÀ vérifier :\n"+errors.slice(0,10).join("\n"):""));
}
function openStudentPayment(studentId){
 const st=db.students.find(x=>Number(x.id)===Number(studentId));if(!st)return alert("Apprenant introuvable.");
 const schedules=liveStudentSchedules.filter(x=>Number(x.eleve_id)===Number(studentId));
 if(!schedules.length){if(confirm("Aucun échéancier n'est associé à cet apprenant. Voulez-vous le générer selon sa classe ?"))generateStudentSchedule(studentId);return;}
 document.getElementById("modalTitle").textContent="Paiement de scolarité — "+st.name;
 document.getElementById("modalBody").innerHTML=`<button class="btn primary" onclick="openStudentCombinedPayment(${Number(studentId)})">Encaisser plusieurs tranches + photocopies/supports</button><div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th>Échéance</th><th>Dû</th><th>Payé</th><th>Reste</th><th>Action</th></tr></thead><tbody>${schedules.map(e=>`<tr><td>${esc(e.libelle)}</td><td>${Number(e.montant_net||0).toLocaleString("fr-FR")}</td><td>${Number(e.montant_paye||0).toLocaleString("fr-FR")}</td><td>${Number(e.reste_a_payer||0).toLocaleString("fr-FR")}</td><td><button class="btn light" onclick="closeModal();openLedgerPayment(${Number(e.id)})">Encaisser cette tranche</button></td></tr>`).join("")}</tbody></table></div>`;
 document.getElementById("modal").classList.remove("hidden");
}
function openStudentCombinedPayment(studentId){
 const st=db.students.find(x=>Number(x.id)===Number(studentId));if(!st)return alert("Apprenant introuvable.");
 document.getElementById("modalTitle").textContent="Encaissement groupé — "+st.name;
 document.getElementById("modalBody").innerHTML=`<p>Le paiement de scolarité sera réparti automatiquement sur les tranches impayées, même futures. Les frais de photocopies/support seront encaissés séparément, mais au cours de la même opération.</p><div class="form-grid"><label>Scolarité à encaisser (FCFA)<input id="combinedSchoolAmount" type="number" min="0" step="1" value="0"></label><label>Photocopies et supports à encaisser (FCFA)<input id="combinedSupportAmount" type="number" min="0" step="1" value="0"></label><label>Mode de paiement<select id="combinedMode"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option><option>Autre</option></select></label><label>Référence externe<input id="combinedExternal"></label><label class="full">Observation<textarea id="combinedObservation" rows="2"></textarea></label></div><p class="muted">Les deux montants resteront distincts dans la comptabilité et sur le reçu A4.</p><button class="btn primary" onclick="submitStudentCombinedPayment(${Number(studentId)})">Valider les deux encaissements</button>`;
 document.getElementById("modal").classList.remove("hidden");
}
async function submitStudentCombinedPayment(studentId){
 const school=Number(val("combinedSchoolAmount")||0),support=Number(val("combinedSupportAmount")||0),mode=val("combinedMode"),external=val("combinedExternal")||null,obs=val("combinedObservation")||null;
 if(!Number.isFinite(school)||!Number.isFinite(support)||school<0||support<0||school+support<=0)return alert("Saisissez un montant positif pour la scolarité, les supports, ou les deux.");
 const receiptWindow=window.open("about:blank","_blank");if(!receiptWindow)return alert("Autorisez les fenêtres contextuelles pour imprimer le reçu.");
 let versement=null,supportCollected=0,supportRefs=[],supportRowsToPay=[];
 if(support>0){const q=await supabaseClient.from("v_echeances_support_eleves").select("id,reste_a_payer,numero_tranche").eq("eleve_id",Number(studentId)).eq("etablissement_id",activeSiteId).gt("reste_a_payer",0).order("numero_tranche");if(q.error){receiptWindow.close();notifyError("Chargement des frais de supports",q.error);return;}supportRowsToPay=q.data||[];const available=supportRowsToPay.reduce((sum,row)=>sum+Number(row.reste_a_payer||0),0);if(support>available){receiptWindow.close();return alert("Le montant photocopies/support dépasse le solde disponible de "+available.toLocaleString("fr-FR")+" FCFA. Aucun encaissement n'a été effectué.");}}
 if(school>0){const r=await supabaseClient.rpc("enregistrer_versement_eleve",{p_eleve_id:Number(studentId),p_montant:school,p_mode:mode,p_reference_externe:external,p_observation:obs||"Encaissement groupé avec frais de photocopies/support"});if(r.error){receiptWindow.close();notifyError("Encaissement de scolarité refusé",r.error);return;}versement=Array.isArray(r.data)?r.data[0]:r.data;}
 if(support>0){let left=support;for(const row of supportRowsToPay){if(left<=0)break;const part=Math.min(left,Number(row.reste_a_payer||0));if(part<=0)continue;const r=await supabaseClient.rpc("encaisser_support_eleve",{p_echeance_id:Number(row.id),p_montant:part,p_mode:mode,p_observation:obs||"Encaissement groupé avec scolarité"});if(r.error){receiptWindow.close();notifyError("Encaissement photocopies/support interrompu après "+supportCollected+" FCFA",r.error);return;}const rec=Array.isArray(r.data)?r.data[0]:r.data;supportCollected+=part;if(rec?.reference_recu)supportRefs.push(rec.reference_recu);left-=part;}
 if(left>0){receiptWindow.close();alert("La scolarité a été enregistrée, mais il reste "+left.toLocaleString("fr-FR")+" FCFA de frais support non affectés : aucun frais futur n'a été inventé.");await loadLiveData();return;}}
 closeModal();await loadLiveData();showPage("payments");
 if(versement){versement.support_encaisse_dans_operation=supportCollected;versement.support_references=supportRefs;await printVersementReceipt(versement,studentId,mode,receiptWindow);}else{receiptWindow.close();alert("Encaissement des supports enregistré. Référence(s) : "+supportRefs.join(", "));}
}
function filterStudentDirectory(){const cls=val('studentClassFilter'),q=val('studentDirectorySearch').toLowerCase();let visible=0,g=0,b=0;document.querySelectorAll('#studentDirectoryBody tr[data-class]').forEach(r=>{const ok=(!cls||r.dataset.class===cls)&&(!q||r.dataset.search.includes(q));r.style.display=ok?'':'none';if(ok){visible++;if(r.dataset.sex==='F')g++;if(r.dataset.sex==='M')b++;}});const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('studentDirectoryCount',visible+' apprenant(s) affiché(s)');set('studentGirls',g);set('studentBoys',b);set('studentTotal',visible);}
function printStudentCardsFromDirectory(){const id=Number(val('studentClassFilter'));if(!id)return alert('Choisissez une classe pour imprimer les cartes.');const sel=document.getElementById('cardClass');if(sel)sel.value=String(id);printClassCardsForId(id);}
function printStudentCard(id){const s=db.students.find(x=>Number(x.id)===Number(id));if(!s)return;const cls=db.classes.find(x=>Number(x.id)===Number(s.classId));const w=window.open('','_blank');if(!w)return alert('Autorisez les fenêtres contextuelles.');w.document.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Carte scolaire</title><style>@page{size:A4;margin:12mm}body{font:14px Arial}.card{width:85mm;min-height:52mm;border:2px solid #166534;border-radius:8px;padding:12px}.card img{width:65px;height:78px;object-fit:cover;float:right}h3{text-align:center;color:#166534}</style><article class="card"><h3>GROUPE SCOLAIRE LA RÉFÉRENCE</h3><b>CARTE SCOLAIRE</b>${s.photo_url?`<img src="${esc(s.photo_url)}">`:''}<p><b>${esc(s.name)}</b></p><p>Classe : ${esc(cls?.name||'—')}</p><p>Matricule : ${esc(s.matricule||'—')}</p><p>N° ÉducMaster : ${esc(s.educmasterId||'—')}</p></article><script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></html>`);w.document.close();}
function printClassCardsForId(id){const cls=db.classes.find(c=>Number(c.id)===Number(id)),students=db.students.filter(s=>Number(s.classId)===Number(id));if(!cls||!students.length)return alert('Aucun apprenant dans cette classe.');const html=students.map(s=>`<article class="card"><h3>GROUPE SCOLAIRE LA RÉFÉRENCE</h3><b>CARTE SCOLAIRE</b><p>${esc(s.name)}</p><p>Classe : ${esc(cls.name)}</p><p>Matricule : ${esc(s.matricule||'—')}</p><p>N° ÉducMaster : ${esc(s.educmasterId||'—')}</p></article>`).join('');const w=window.open('','_blank');if(!w)return alert('Autorisez les fenêtres contextuelles.');w.document.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Cartes ${esc(cls.name)}</title><style>@page{size:A4;margin:10mm}body{font:12px Arial;display:grid;grid-template-columns:1fr 1fr;gap:10px}.card{border:2px solid #166534;border-radius:8px;padding:12px;min-height:145px;page-break-inside:avoid}h3{text-align:center;color:#166534}</style>${html}<script>window.onload=()=>setTimeout(()=>window.print(),200)<\/script></html>`);w.document.close();}
function openReenrollment(){const archived=db.students.filter(s=>s.status==='ancien');if(!archived.length)return alert('Aucun ancien apprenant archivé à réinscrire.');const opts=archived.map(s=>`<option value="${s.id}">${esc(s.name)} · ${esc(s.class||'Ancienne classe')}</option>`).join('');document.getElementById('modalTitle').textContent='Réinscription d’un ancien apprenant';document.getElementById('modalBody').innerHTML=`<p class="muted">Le matricule et l’historique seront conservés. Un nouvel échéancier sera créé selon le tarif de la nouvelle classe.</p><label>Ancien apprenant<select id="reenrollStudent">${opts}</select></label><label>Nouvelle classe<select id="reenrollClass">${db.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label>Montant payé à la réinscription (FCFA)<input id="reenrollAmount" type="number" min="0" step="1" value="0"></label><label>Mode de paiement<select id="reenrollMode"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option><option>Autre</option></select></label><button class="btn primary" onclick="saveReenrollment()">Confirmer la réinscription</button>`;document.getElementById('modal').classList.remove('hidden');}
async function saveReenrollment(){if(!liveMode)return alert('Connectez-vous à la base officielle pour réinscrire.');const id=Number(val('reenrollStudent')),cls=Number(val('reenrollClass')),amount=Number(val('reenrollAmount')||0),mode=val('reenrollMode')||'Espèces';if(!id||!cls||amount<0||!Number.isFinite(amount))return alert('Vérifiez l’apprenant, la classe et le montant.');if(!confirm('Confirmer la réinscription ? Le matricule et l’historique antérieur seront conservés.'))return;const {data:c,error:ce}=await supabaseClient.from('classes').select('id,nom,niveau,serie,etablissement_id').eq('id',cls).eq('etablissement_id',activeSiteId).maybeSingle();if(ce||!c){notifyError('Classe de réinscription',ce||new Error('Classe introuvable'));return;}const code=tariffCodeForStudent({class:c.nom,level:c.niveau,series:c.serie,classId:c.id});if(!code)return alert('Aucun tarif ne correspond à cette classe. Vérifiez la grille tarifaire avant de réinscrire.');const {data:n,error:se}=await supabaseClient.rpc('creer_echeancier_eleve',{p_eleve_id:id,p_code_niveau:code});if(se){notifyError('Création de l’échéancier',se);return;}const {error}=await supabaseClient.from('eleves').update({classe_id:cls,statut:'actif'}).eq('id',id).eq('etablissement_id',activeSiteId);if(error){notifyError('Réinscription',error);return;}let receipt=null;if(amount>0){const {data:pd,error:pe}=await supabaseClient.rpc('enregistrer_versement_eleve',{p_eleve_id:id,p_montant:amount,p_mode:mode,p_reference_externe:null,p_observation:'Paiement effectué à la réinscription'});if(pe){alert('Réinscription faite, mais paiement non encaissé : '+pe.message);}else receipt=Array.isArray(pd)?pd[0]:pd;}closeModal();await loadLiveData();showPage('students');if(receipt){const w=window.open('about:blank','_blank');printVersementReceipt(receipt,id,mode,w);}alert('Réinscription enregistrée. '+n+' échéance(s) créée(s).'+(amount>0&&!receipt?' Le paiement reste à enregistrer.':''));}

async function loadTransferClasses(){const site=val("transferSite"),sel=document.getElementById("transferClass");if(!sel)return;sel.innerHTML='<option value="">Sans classe</option>';const {data,error}=await supabaseClient.from("classes").select("id,nom,niveau").eq("etablissement_id",site).order("nom");if(error){notifyError("Chargement des classes de destination",error);return;}sel.innerHTML+=(data||[]).map(c=>`<option value="${c.id}">${esc(c.nom)}${c.niveau?" · "+esc(c.niveau):""}</option>`).join("");}
async function executeStudentTransfer(){const id=Number(val("transferStudent")),site=val("transferSite"),cls=val("transferClass")?Number(val("transferClass")):null,motif=val("transferReason").trim();if(!id||!site||motif.length<5)return alert("Choisissez l’élève, la destination et indiquez un motif (5 caractères minimum).");const {data,error}=await supabaseClient.rpc("executer_transfert_eleve",{p_eleve_id:id,p_etablissement_destination:site,p_classe_destination:cls,p_motif:motif,p_date_effective:val("transferDate")||new Date().toISOString().slice(0,10)});if(error){notifyError("Transfert de l’élève",error);return;}alert("Transfert enregistré. L’historique scolaire et financier antérieur est conservé.");await loadLiveData();showPage("students");}
function refreshBulkGroups(){
 const classId=val("bulkClass"),sel=document.getElementById("bulkGroup");if(!sel)return;
 const groups=liveGroups.filter(g=>String(g.classe_id)===String(classId));
 sel.innerHTML='<option value="">Aucun groupe</option>'+groups.map(g=>`<option value="${g.id}">${esc(g.nom)}</option>`).join("");
}
async function bulkEnrollStudents(){
 if(!liveMode){alert("Connectez-vous pour inscrire les élèves dans la base officielle.");return;}
 const classId=Number(val("bulkClass")),groupId=val("bulkGroup")?Number(val("bulkGroup")):null;
 const feedback=document.getElementById("bulkFeedback");
 const source=val("bulkStudents").trim();
 if(!classId||!source){feedback.textContent="Choisissez une classe et saisissez au moins un élève.";return;}
 const cls=db.classes.find(c=>Number(c.id)===classId);
 if(!cls||String(cls.establishment)!==String(activeSiteId)){feedback.textContent="La classe ne correspond pas à l'établissement sélectionné.";return;}
 if(groupId&&!liveGroups.some(g=>Number(g.id)===groupId&&Number(g.classe_id)===classId)){feedback.textContent="Le groupe ne correspond pas à la classe choisie.";return;}
 const lines=source.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const rows=[];
 for(let i=0;i<lines.length;i++){
  const parts=lines[i].split(";").map(x=>x.trim());
  if(parts.length<2||!parts[0]||!parts[1]){feedback.textContent=`Ligne ${i+1} invalide : indiquez au minimum le nom et les prénoms séparés par un point-virgule.`;return;}
  const sex=(parts[2]||"").toUpperCase();
  if(sex&&!['M','F'].includes(sex)){feedback.textContent=`Ligne ${i+1} : le sexe doit être M ou F.`;return;}
  rows.push({matricule:`LR-${new Date().getFullYear()}-${Date.now().toString().slice(-5)}-${i+1}`,nom:parts[0],prenoms:parts[1],sexe:sex||null,telephone:parts[3]||null,numero_educmaster:parts[4]||null,classe_id:classId,groupe_pedagogique_id:groupId,etablissement_id:activeSiteId,statut:"actif"});
 }
 const {data:createdRows,error}=await supabaseClient.from("eleves").insert(rows).select("id");
 if(error){notifyError("Inscription groupée",error);return;}
 const code=tariffCodeForStudent({class:cls.name,classId:cls.id});let schedules=0;
 if(code){for(const student of (createdRows||[])){const result=await supabaseClient.rpc("creer_echeancier_eleve",{p_eleve_id:student.id,p_code_niveau:code});if(!result.error)schedules+=Number(result.data||0);}}
 feedback.textContent=`${rows.length} inscription(s) enregistrée(s). ${schedules?`${schedules} échéances créées.`:"Échéanciers non générés : vérifiez la grille tarifaire."}`;
 document.getElementById("bulkStudents").value="";
 await loadLiveData();showPage("students");alert(`${rows.length} élève(s) inscrit(s) dans ${cls.name}.`);
}
function baseAdministrativeClassName(name){return String(name||"").trim().replace(/\s+M[123]$/i,"").trim();}
function groupsPage(){
 const baseClasses=db.classes.filter(c=>!db.classes.some(other=>String(other.id)!==String(c.id)&&baseAdministrativeClassName(other.name).toLowerCase()===String(c.name||"").trim().toLowerCase()&&/\sM[123]$/i.test(other.name||"")));
 const opts=baseClasses.map(c=>`<option value="${c.id}">${esc(baseAdministrativeClassName(c.name))}${c.level?" · "+esc(c.level):""}</option>`).join("");
 const rows=liveGroups.map(g=>{const c=db.classes.find(x=>String(x.id)===String(g.classe_id));return `<tr><td>${esc(baseAdministrativeClassName(c?.name)||"Classe inconnue")}</td><td>${esc(g.nom)}</td><td>${g.annee_scolaire_id||"Année active"}</td><td>${g.actif?"Actif":"Inactif"}</td></tr>`}).join("");
 return pageShell("Groupes pédagogiques","Les groupes sont rattachés à une classe administrative : ils ne créent pas de nouvelles classes.","Créer M1, M2 et M3","createGroupsForClass()",`<div class="card"><label>Classe concernée<select id="groupClass">${opts}</select></label><p class="muted">Exemple : sélectionner 6ème crée 6ème M1, 6ème M2 et 6ème M3. Les groupes déjà présents ne seront pas dupliqués.</p></div><div class="card" style="margin-top:15px"><h3>Groupes existants</h3><div class="table-wrap"><table class="table"><thead><tr><th>Classe principale</th><th>Groupe</th><th>Année scolaire</th><th>État</th></tr></thead><tbody>${rows||`<tr><td colspan="4" class="empty">Aucun groupe créé pour cet établissement.</td></tr>`}</tbody></table></div></div>`);
}
async function createGroupsForClass(){
 if(!liveMode){alert("Connectez-vous pour créer les groupes dans la base officielle.");return;}
 const classId=Number(val("groupClass"));const c=db.classes.find(x=>Number(x.id)===classId);if(!c){alert("Sélectionnez une classe.");return;}
 if(!/^(6e|6ème|5e|5ème|4e|4ème|3e|3ème)\b/i.test(c.name.trim())){alert("Les groupes M1, M2 et M3 sont prévus ici pour les classes du premier cycle du secondaire (6ème à 3ème). ");return;}
 const baseName=baseAdministrativeClassName(c.name);const names=["M1","M2","M3"].map(s=>`${baseName} ${s}`);
 const existing=liveGroups.map(g=>g.nom);const missing=names.filter(n=>!existing.includes(n));
 if(!missing.length){alert("Les trois groupes existent déjà pour cette classe.");return;}
 const payload=missing.map(n=>({classe_id:classId,etablissement_id:activeSiteId,nom:n,actif:true}));
 const {error}=await supabaseClient.from("groupes_pedagogiques").insert(payload);if(error){notifyError("Création des groupes",error);return;}
 await loadLiveData();showPage("groups");alert("Groupes pédagogiques créés.");
}
function refreshStudentGroups(selectedId=null){
 const cls=val("f_class"),sel=document.getElementById("f_group");if(!sel)return;
 const opts=liveGroups.filter(g=>String(g.classe_id)===String(cls)).map(g=>`<option value="${g.id}" ${String(g.id)===String(selectedId)?"selected":""}>${esc(g.nom)}</option>`).join("");
 sel.innerHTML=`<option value="">${opts?"Choisir un groupe":"Aucun groupe créé pour cette classe"}</option>`+opts;
}

function paymentsPage(){
 const fmt=n=>Number(n||0).toLocaleString("fr-FR");
 const schedulesByStudent=new Map();
 liveStudentSchedules.forEach(x=>{const k=String(x.eleve_id);schedulesByStudent.set(k,(schedulesByStudent.get(k)||0)+1)});
 // Afficher aussi les dossiers partiels : les apprenants avec 1 à 6 tranches doivent pouvoir être régularisés.
 const noSchedule=db.students.filter(x=>x.classId&&x.status!=="ancien"&&x.status!=="exclu"&&(schedulesByStudent.get(String(x.id))||0)<7);
 const totalDue=liveStudentSchedules.reduce((a,x)=>a+Number(x.montant_net||0),0);
 const totalPaid=liveStudentSchedules.reduce((a,x)=>a+Number(x.montant_paye||0),0);
 const totalBalance=liveStudentSchedules.reduce((a,x)=>a+Number(x.reste_a_payer||0),0);
 const rows=liveStudentSchedules.map(x=>{const st=db.students.find(s=>String(s.id)===String(x.eleve_id));return `<tr><td>${esc(st?.name||"Élève")}</td><td>${esc(st?.class||"—")}</td><td>${x.numero_tranche} · ${esc(x.libelle)}</td><td>${x.date_echeance?new Date(x.date_echeance+"T00:00:00").toLocaleDateString("fr-FR"):"À l'inscription"}</td><td>${fmt(x.montant_net)} F</td><td>${fmt(x.montant_paye)} F</td><td><b>${fmt(x.reste_a_payer)} F</b></td><td>${esc(x.etat_calcul)}<br><small>${({en_delai:"Dans le délai",exclusion_temporaire:"Exclusion à appliquer",reprise_conditionnee:"Reprise conditionnée",regularise:"Régularisé"})[x.statut_sanction]||""}</small></td><td>${Number(x.reste_a_payer)>0?`<button class="btn primary" onclick="openLedgerPayment(${x.id})">Encaisser</button> <button class="btn light" onclick="openDiscount(${x.id})">Remise</button>`:`Soldé <button class="btn light" onclick="openDiscount(${x.id})">Remise</button>`}</td></tr>`}).join("");
 const receipts=liveReceipts.slice(0,50).map(x=>`<tr><td>${esc(x.reference_recu)}</td><td>${esc(x.student)}</td><td>${fmt(x.montant)} F</td><td>${new Date(x.date_encaissement).toLocaleString("fr-FR")}</td><td>${esc(x.mode_paiement)}</td><td>${x.annule?`<b style="color:#b42318">ANNULÉ</b><br><small>${esc(x.motif_annulation||"")}</small>`:`Valide`}</td><td><button class="btn light" onclick="printLedgerReceipt(${x.id})">Imprimer</button>${!x.annule?` <button class="btn light" onclick="openEditLedgerPayment(${x.id})">Modifier</button> <button class="btn danger" onclick="cancelLedgerReceipt(${x.id})">Supprimer</button>`:""}</td></tr>`).join("");
 const groupedRows=liveVersements.slice(0,50).map(v=>{const cancelled=!!v.annule||((v.versements_affectations||[]).length>0&&(v.versements_affectations||[]).every(a=>a.encaissements?.annule===true));return `<tr><td>${esc(v.reference_recu)}</td><td>${esc(v.student)}</td><td>${fmt(v.montant_recu)} F</td><td>${new Date(v.created_at).toLocaleString("fr-FR")}</td><td>${esc(v.mode_paiement)}</td><td>${cancelled?`<b style="color:#b42318">ANNULÉ — archive</b><br><small>${esc(v.motif_annulation||"")}</small>`:"Versement groupé"}</td><td><button class="btn light" onclick="printStoredVersementReceipt(${v.id})">Réimprimer</button>${!cancelled?` <button class="btn light" onclick="openGroupedPaymentEditor(${v.id})">Modifier</button> <button class="btn danger" onclick="cancelGroupedVersement(${v.id})">Supprimer</button>`:""}</td></tr>`}).join("");
 const allReceiptRows=receipts+groupedRows;
 const groupedEncaissementIds=new Set(liveVersements.flatMap(v=>(v.versements_affectations||[]).map(a=>Number(a.encaissements?.id)).filter(Boolean)));
 const feePaymentRecords=[
  ...liveReceipts.filter(x=>!groupedEncaissementIds.has(Number(x.id))).map(x=>({kind:"simple",id:x.id,ref:x.reference_recu,date:x.date_encaissement,student:x.student,studentId:x.eleve_id,amount:x.montant,category:"FRAIS DE SCOLARITÉ",cancelled:!!x.annule,mode:x.mode_paiement})),
  ...liveVersements.map(v=>({kind:"group",id:v.id,ref:v.reference_recu,date:v.created_at,student:v.student,studentId:v.eleve_id,amount:v.montant_recu,category:"FRAIS DE SCOLARITÉ",cancelled:!!v.annule,mode:v.mode_paiement}))
 ].sort((a,b)=>new Date(b.date||0)-new Date(a.date||0));
 const feePaymentRows=feePaymentRecords.map((x,index)=>{const st=db.students.find(s=>String(s.id)===String(x.studentId));return `<tr data-finance-search="${esc([x.ref,x.student,x.category,x.amount,x.mode,st?.class].join(" ").toLowerCase())}" data-finance-class="${esc(st?.classId||"")}"><td>${index+1}</td><td>${new Date(x.date).toLocaleDateString("fr-FR")}</td><td>${esc(x.category)}</td><td>${fmt(x.amount)} FCFA</td><td>${esc(x.student||"—")}</td><td class="actions">${x.kind==="group"?`<button class="btn light" onclick="printStoredVersementReceipt(${x.id})">Imprimer</button>${!x.cancelled?`<button class="btn light" onclick="openGroupedPaymentEditor(${x.id})">Modifier</button><button class="btn danger" onclick="cancelGroupedVersement(${x.id})">Annuler</button>`:""}`:`<button class="btn light" onclick="printLedgerReceipt(${x.id})">Imprimer</button>${!x.cancelled?`<button class="btn light" onclick="openEditLedgerPayment(${x.id})">Modifier</button><button class="btn danger" onclick="cancelLedgerReceipt(${x.id})">Annuler</button>`:""}`}</td></tr>`}).join("");
 const tariffRows=liveTariffs.map(g=>`<tr><td>${esc(g.libelle)}<br><small>${g.valide?"Tarif validé":"À confirmer avant encaissement"}</small></td><td>${fmt(g.frais_inscription_assurance)}</td><td>${fmt(g.frais_td)}</td><td>${fmt(g.frais_photocopie_td)}</td><td>${fmt(g.ecolage_annuel)}</td><td>${(g.echeances_tarifaires||[]).sort((a,b)=>a.numero_tranche-b.numero_tranche).map(e=>fmt(e.montant)).join(" / ")}</td></tr>`).join("");
 return pageShell("Finances et impayés","Échéanciers individuels, encaissements réels et reçus", "Actualiser", "refreshFinance()", `<div class="card" style="margin:16px 0"><div class="toolbar" style="justify-content:space-between;align-items:center"><div><h3>Liste des paiements de frais de scolarité</h3><p class="muted">Année scolaire : ${esc(currentSchoolYear())} · Effectif : <b id="feePaymentEffectif">${db.students.filter(x=>x.status!=="ancien"&&x.status!=="exclu").length} élèves</b> · Établissement : ${esc(currentSite()?.nom||"")}</p></div><button class="btn primary" onclick="openGroupPayment()">Nouveau</button></div><div class="toolbar"><label>Classe<select id="feePaymentClassFilter" onchange="filterFinancePaymentRows()"><option value="">Toutes les classes</option>${db.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></label><label>Recherche<input id="feePaymentSearch" type="search" placeholder="Nom, matricule ou référence…" oninput="filterFinancePaymentRows()"></label><label>Afficher<select id="feePaymentPageSize" onchange="filterFinancePaymentRows()"><option>10</option><option>25</option><option>50</option><option value="1000">Tout</option></select></label></div><div class="table-wrap"><table class="table"><thead><tr><th>N°</th><th>Date règlement</th><th>Rubrique</th><th>Montant réglé</th><th>Payé par</th><th>Action</th></tr></thead><tbody id="feePaymentRows">${feePaymentRows||`<tr><td colspan="6" class="empty">Aucun paiement enregistré.</td></tr>`}</tbody></table></div><p class="muted" id="feePaymentCount">${feePaymentRecords.length} paiement(s) enregistré(s).</p></div>
 <div class="card" style="margin:16px 0"><h3>Créer ou compléter les échéanciers des élèves</h3><p class="muted">Tous les apprenants actifs sans échéancier complet (de 0 à 6 tranches) sont affichés. L'action ajoute uniquement les tranches manquantes et conserve les montants, remises et paiements déjà enregistrés.</p><div class="table-wrap"><table class="table"><thead><tr><th>Élève</th><th>Classe</th><th>Action</th></tr></thead><tbody>${noSchedule.map(st=>{const code=tariffCodeForStudent(st),tariff=liveTariffs.find(g=>g.code_niveau===code&&g.valide);return `<tr><td>${esc(st.name)}</td><td>${esc(st.class||"Sans classe")}</td><td>${tariff?`<button class="btn light" onclick="generateStudentSchedule(${st.id})">${(schedulesByStudent.get(String(st.id))||0)>0?"Compléter les tranches":"Créer l'échéancier"}</button>`:`<span class="muted">Tarif à confirmer</span>`}</td></tr>`}).join("")||`<tr><td colspan="3" class="empty">Tous les apprenants actifs classés ont leurs sept tranches, ou aucune classe n'est renseignée.</td></tr>`}</tbody></table></div></div>
 <div class="card" style="margin:16px 0"><div class="toolbar" style="justify-content:space-between"><div><h3>Paiement de plusieurs tranches</h3><p class="muted">Le montant est réparti automatiquement sur les tranches impayées. Un reçu récapitulatif unique est créé ; tout surplus devient un crédit élève.</p></div><button class="btn primary" onclick="openGroupPayment()">Encaissement et reçu unique</button></div></div> <div class="card" style="margin:16px 0"><h3>États journaliers des encaissements — format A4</h3><p class="muted">Choisissez une date pour réimprimer les états du jour, même pour une date passée. Un état séparé est disponible pour chaque cycle.</p><div class="toolbar"><label>Date des encaissements<input id="dailyFinanceDate" type="date" value="${new Date().toISOString().slice(0,10)}"></label><button class="btn light" onclick="printDailyFinanceStatements('MATERNELLE')">Maternelle</button><button class="btn light" onclick="printDailyFinanceStatements('PRIMAIRE')">Primaire</button><button class="btn light" onclick="printDailyFinanceStatements('SECONDAIRE')">Secondaire</button><button class="btn light" onclick="printDailyFinanceStatements('LYCÉE')">Lycée</button></div><hr><h3>Recettes mensuelles et annuelles — impression et réimpression</h3><div class="toolbar"><label>Mois<input id="financeReportMonth" type="month" value="${new Date().toISOString().slice(0,7)}"></label><label>Année<input id="financeReportYear" type="number" min="2000" max="2100" value="${new Date().getFullYear()}"></label><label>Cycle<select id="financeReportCycle"><option value="TOUS">Tous les cycles</option><option value="MATERNELLE">Maternelle</option><option value="PRIMAIRE">Primaire</option><option value="SECONDAIRE">Secondaire</option><option value="LYCÉE">Lycée</option></select></label><button class="btn primary" onclick="printFinancePeriodReport('month')">Imprimer / Réimprimer le mois</button><button class="btn primary" onclick="printFinancePeriodReport('year')">Imprimer / Réimprimer l’année</button></div><p class="muted">Les états peuvent être réimprimés à tout moment en choisissant un mois ou une année déjà écoulée. Les recettes annulées sont exclues des totaux.</p></div>
<div class="card"><h3>Échéances et soldes des élèves</h3><div class="table-wrap"><table class="table"><thead><tr><th>Élève</th><th>Classe</th><th>Tranche</th><th>Échéance</th><th>Net dû</th><th>Payé</th><th>Solde</th><th>État / règle de retard</th><th>Action</th></tr></thead><tbody>${rows||`<tr><td colspan="9" class="empty">Aucun échéancier. Créez-en pour les élèves concernés.</td></tr>`}</tbody></table></div></div>
 <div class="card" style="margin-top:16px"><h3>Derniers reçus d'encaissement</h3><div class="table-wrap"><table class="table"><thead><tr><th>Référence</th><th>Élève</th><th>Montant</th><th>Date</th><th>Mode</th><th>État</th><th>Reçu / action</th></tr></thead><tbody>${allReceiptRows||`<tr><td colspan="7" class="empty">Aucun encaissement enregistré.</td></tr>`}</tbody></table></div></div>
 <div class="card" style="margin-top:16px"><div class="toolbar" style="justify-content:space-between"><div><h3>Dérogations et autorisations exceptionnelles</h3><p class="muted">Délais, reprise des cours et paiement partiel. Chaque demande exige un motif et conserve l'auteur et les dates.</p></div><button class="btn primary" onclick="openPaymentDerogation()">Nouvelle dérogation</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Élève</th><th>Tranche</th><th>Type</th><th>Motif</th><th>Période</th><th>État</th></tr></thead><tbody>${liveDerogations.map(d=>`<tr><td>${esc(d.student)}</td><td>${esc(d.tranche_concernee)}</td><td>${esc(d.type_derogation)}</td><td>${esc(d.motif)}</td><td>${new Date(d.date_debut+"T00:00:00").toLocaleDateString("fr-FR")} ${d.date_fin?"→ "+new Date(d.date_fin+"T00:00:00").toLocaleDateString("fr-FR"):""}</td><td>${esc(d.statut)}</td></tr>`).join("")||`<tr><td colspan="6" class="empty">Aucune dérogation enregistrée.</td></tr>`}</tbody></table></div></div>
 <div class="card" style="margin-top:16px"><h3>Grille tarifaire 2026-2027 · FCFA</h3><p class="muted">Les sanctions affichées sont calculées selon la règle : exclusion à partir du 5 du mois suivant l'échéance, reprise conditionnée à partir du 11. L'application automatique de ces sanctions à la présence reste volontairement désactivée tant que la direction n'a pas validé le fonctionnement. Les grilles maternelle/primaire sont activées. Les grilles collège/lycée restent désactivées pour les échéanciers tant que leurs montants n’ont pas été confirmés sur le document original.</p><div class="table-wrap"><table class="table"><thead><tr><th>Niveau</th><th>Inscription</th><th>TD</th><th>Photocopie TD</th><th>Écolage</th><th>Tranches 1 à 7</th></tr></thead><tbody>${tariffRows}</tbody></table></div></div>`);
}
function financeMovementsPage(){
 const fmt=n=>Number(n||0).toLocaleString("fr-FR");
 const outstanding=liveStudentSchedules.filter(x=>Number(x.reste_a_payer)>0);
 const receipts=liveReceipts.map(x=>`<tr><td>${esc(x.reference_recu||"—")}</td><td>${esc(x.student||studentName(x.eleve_id))}</td><td>${fmt(x.montant)} FCFA</td><td>${x.date_encaissement?new Date(x.date_encaissement).toLocaleString("fr-FR"):"—"}</td><td>${esc(x.mode_paiement||"—")}</td><td>${x.annule?`<b style="color:#b42318">ANNULÉ</b><br><small>${esc(x.motif_annulation||"")}</small>`:"Valide"}</td><td><button class="btn light" onclick="printLedgerReceipt(${Number(x.id)})">Imprimer</button>${!x.annule?` <button class="btn light" onclick="openEditLedgerPayment(${Number(x.id)})">Modifier</button> <button class="btn danger" onclick="cancelLedgerReceipt(${Number(x.id)})">Supprimer</button>`:""}</td></tr>`).join("");
 const groupedRows=liveVersements.map(v=>{const cancelled=!!v.annule||((v.versements_affectations||[]).length>0&&(v.versements_affectations||[]).every(a=>a.encaissements?.annule===true));return `<tr><td>${esc(v.reference_recu)}</td><td>${esc(v.student)}</td><td>${fmt(v.montant_recu)} FCFA</td><td>${new Date(v.created_at).toLocaleString("fr-FR")}</td><td>${esc(v.mode_paiement)}</td><td>${cancelled?`<b style="color:#b42318">ANNULÉ — archive</b><br><small>${esc(v.motif_annulation||"")}</small>`:"Versement groupé"}</td><td><button class="btn light" onclick="printStoredVersementReceipt(${v.id})">Réimprimer</button>${!cancelled?` <button class="btn light" onclick="openGroupedPaymentEditor(${v.id})">Modifier</button> <button class="btn danger" onclick="cancelGroupedVersement(${v.id})">Supprimer</button>`:""}</td></tr>`}).join("");
 const allReceiptRows=receipts+groupedRows;
 const debtRows=outstanding.map(x=>{const st=db.students.find(s=>String(s.id)===String(x.eleve_id));return `<tr><td>${esc(st?.name||"Élève")}</td><td>${esc(st?.class||"—")}</td><td>${esc(x.libelle||("Tranche "+x.numero_tranche))}</td><td>${x.date_echeance?new Date(x.date_echeance+"T00:00:00").toLocaleDateString("fr-FR"):"À l'inscription"}</td><td>${fmt(x.montant_net)} FCFA</td><td>${fmt(x.montant_paye)} FCFA</td><td><b>${fmt(x.reste_a_payer)} FCFA</b></td><td>${esc(x.etat_calcul||"À régler")}</td></tr>`}).join("");
 return pageShell("Mouvements et impayés","Historique des encaissements, reçus et soldes restant à recouvrer","Actualiser","refreshFinanceMovements()",`<div class="card" style="margin:16px 0"><h3>Historique des mouvements</h3><p class="muted">Chaque encaissement possède un reçu. Les reçus annulés restent visibles dans l'historique.</p><div class="table-wrap"><table class="table"><thead><tr><th>Référence</th><th>Élève</th><th>Montant</th><th>Date</th><th>Mode</th><th>État</th><th>Action</th></tr></thead><tbody>${allReceiptRows||`<tr><td colspan="7" class="empty">Aucun mouvement enregistré pour cet établissement.</td></tr>`}</tbody></table></div></div>
 <div class="card"><h3>Impayés par classe</h3><p class="muted">Choisissez une classe pour afficher et imprimer uniquement les élèves qui ont un solde restant.</p><div class="toolbar"><label>Classe<select id="debtClass">${classSelectOptions()}</select></label><button class="btn primary" onclick="printClassDebts()">Imprimer les impayés de cette classe (A4)</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Élève</th><th>Classe</th><th>Tranche</th><th>Échéance</th><th>Net dû</th><th>Payé</th><th>Solde</th><th>État</th></tr></thead><tbody>${debtRows||`<tr><td colspan="8" class="empty">Aucun impayé calculé : aucun échéancier ou aucun solde restant.</td></tr>`}</tbody></table></div></div>`);
}
function printClassDebts(){const id=Number(val('debtClass')),cls=db.classes.find(c=>Number(c.id)===id);if(!cls)return alert('Choisissez une classe.');const sts=db.students.filter(s=>Number(s.classId)===id),items=liveStudentSchedules.filter(x=>Number(x.reste_a_payer)>0&&sts.some(st=>String(st.id)===String(x.eleve_id)));if(!items.length)return alert('Aucun impayé pour cette classe.');const rows=items.map(x=>{const st=sts.find(z=>String(z.id)===String(x.eleve_id));return `<tr><td>${esc(st?.name||'—')}</td><td>${esc(x.libelle||('Tranche '+x.numero_tranche))}</td><td>${x.date_echeance?new Date(x.date_echeance+'T00:00:00').toLocaleDateString('fr-FR'):'À l’inscription'}</td><td>${Number(x.montant_net||0).toLocaleString('fr-FR')}</td><td>${Number(x.montant_paye||0).toLocaleString('fr-FR')}</td><td><b>${Number(x.reste_a_payer||0).toLocaleString('fr-FR')}</b></td></tr>`}).join(''),total=items.reduce((a,x)=>a+Number(x.reste_a_payer||0),0),w=window.open('','_blank');if(!w)return alert('Autorisez les fenêtres contextuelles pour imprimer.');w.document.write(`<!doctype html><html lang="fr"><meta charset="utf-8"><title>Impayés ${esc(cls.name)}</title><style>@page{size:A4;margin:12mm}body{font:11pt Arial}h2,h3{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #555;padding:7px;text-align:left}th{background:#eee}</style><h2>GROUPE SCOLAIRE LA RÉFÉRENCE</h2><h3>ÉTAT DES IMPAYÉS DE SCOLARITÉ</h3><p>Classe : <b>${esc(cls.name)}</b> — Année scolaire 2026-2027</p><table><thead><tr><th>Élève</th><th>Tranche</th><th>Échéance</th><th>Net dû (FCFA)</th><th>Payé (FCFA)</th><th>Solde (FCFA)</th></tr></thead><tbody>${rows}</tbody></table><h3>Total restant dû : ${total.toLocaleString('fr-FR')} FCFA</h3><script>window.onload=()=>setTimeout(()=>window.print(),250)<\/script></html>`);w.document.close();}
async function refreshFinanceMovements(){await loadLiveData();showPage("finance-movements")}

function openPaymentDerogation(){
 const students=db.students.map(s=>`<option value="${s.id}">${esc(s.name)} · ${esc(s.class||"Sans classe")}</option>`).join("");
 document.getElementById("modalTitle").textContent="Nouvelle dérogation de paiement";
 document.getElementById("modalBody").innerHTML=`<div class="form-grid"><label>Élève<select id="derogStudent">${students}</select></label><label>Tranche concernée<input id="derogTranche" placeholder="Ex. Tranche 2" required></label><label>Type<select id="derogType"><option value="delai">Délai supplémentaire</option><option value="reprise_cours">Autorisation de reprise des cours</option><option value="paiement_partiel">Paiement partiel</option><option value="autre">Autre</option></select></label><label>Date de début<input id="derogStart" type="date" value="${new Date().toISOString().slice(0,10)}" required></label><label>Date de fin (facultatif)<input id="derogEnd" type="date"></label><label class="full">Motif obligatoire<textarea id="derogReason" rows="3" required></textarea></label></div><p class="muted">L'autorisation est soumise aux droits de votre compte sur cet établissement. Toute décision est historisée.</p><button class="btn primary" onclick="savePaymentDerogation()">Enregistrer l'autorisation</button>`;
 document.getElementById("modal").classList.remove("hidden");
}
async function savePaymentDerogation(){
 const studentId=Number(val("derogStudent")),tranche=val("derogTranche").trim(),type=val("derogType"),start=val("derogStart"),end=val("derogEnd")||null,motif=val("derogReason").trim();
 if(!studentId||!tranche||!start||motif.length<5)return alert("Renseignez l'élève, la tranche, la date et un motif précis.");
 if(end&&end<start)return alert("La date de fin ne peut pas précéder la date de début.");
 const {data:userRes,error:userErr}=await supabaseClient.auth.getUser();if(userErr||!userRes?.user)return alert("Session expirée. Reconnectez-vous.");
 const {error}=await supabaseClient.from("derogations_paiement").insert({eleve_id:studentId,etablissement_id:activeSiteId,tranche_concernee:tranche,type_derogation:type,motif,date_debut:start,date_fin:end,accordee_par:userRes.user.id,statut:"active"});
 if(error){notifyError("Dérogation non enregistrée",error);return;}
 closeModal();await loadLiveData();showPage("payments");alert("Dérogation enregistrée avec succès.");
}
function openDiscount(scheduleId){
 const e=liveStudentSchedules.find(x=>Number(x.id)===Number(scheduleId));if(!e)return alert("Échéance introuvable.");
 const st=db.students.find(x=>String(x.id)===String(e.eleve_id));
 document.getElementById("modalTitle").textContent="Accorder une remise exceptionnelle";
 document.getElementById("modalBody").innerHTML=`<p><b>${esc(st?.name||"Élève")}</b> · ${esc(e.libelle)}<br>Montant initial : ${Number(e.montant_initial).toLocaleString("fr-FR")} FCFA</p><div class="form-grid"><label>Type de remise<select id="discountType"><option value="montant">Montant fixe (FCFA)</option><option value="pourcentage">Pourcentage (%)</option><option value="exoneration">Exonération totale</option></select></label><label>Valeur<input id="discountValue" type="number" min="0" step="0.01" value="0"></label><label class="full">Motif obligatoire<textarea id="discountReason" rows="3" placeholder="Motif et justification de la décision"></textarea></label></div><p class="muted">Réservé à l'administration générale, à l'administration ou à la direction de l'établissement. La remise est enregistrée dans l'historique.</p><button class="btn primary" onclick="submitDiscount(${e.id})">Enregistrer la remise</button>`;
 document.getElementById("modal").classList.remove("hidden");
}
async function submitDiscount(scheduleId){
 const type=val("discountType"),value=Number(val("discountValue")),reason=val("discountReason").trim();
 if(type!=="exoneration"&&(!Number.isFinite(value)||value<=0))return alert("Indiquez une valeur de remise supérieure à zéro.");
 if(reason.length<5)return alert("Le motif doit comporter au moins 5 caractères.");
 const {data,error}=await supabaseClient.rpc("appliquer_remise_echeance",{p_echeance_id:Number(scheduleId),p_type:type,p_valeur:type==="exoneration"?0:value,p_motif:reason});
 if(error){notifyError("Remise refusée",error);return;}
 closeModal();await loadLiveData();showPage("payments");alert(`Remise enregistrée : ${Number(data?.[0]?.remise||0).toLocaleString("fr-FR")} FCFA. Nouveau montant net : ${Number(data?.[0]?.montant_net||0).toLocaleString("fr-FR")} FCFA.`);
}
function filterFinancePaymentRows(){
 const body=document.getElementById("feePaymentRows");if(!body)return;
 const q=(val("feePaymentSearch")||"").toLocaleLowerCase("fr"),cls=val("feePaymentClassFilter"),size=Number(val("feePaymentPageSize")||10);
 const rows=[...body.querySelectorAll("tr[data-finance-search]")];let visible=0;
 rows.forEach((r)=>{const ok=(!q||r.dataset.financeSearch.includes(q))&&(!cls||r.dataset.financeClass===cls);r.style.display=ok&&visible<size?"":"none";if(ok)visible++;});
 const count=document.getElementById("feePaymentCount");if(count)count.textContent=`${Math.min(visible,size)} paiement(s) affiché(s) sur ${visible} résultat(s).`;
 const effectif=document.getElementById("feePaymentEffectif");if(effectif){const students=db.students.filter(x=>x.status!=="ancien"&&x.status!=="exclu"&&(!cls||String(x.classId)===String(cls)));effectif.textContent=students.length+" élèves";}
}
async function refreshFinance(){await loadLiveData();showPage("payments")}
async function generateStudentSchedule(studentId){
 if(!liveMode)return alert("Connexion requise.");
 const st=db.students.find(x=>String(x.id)===String(studentId));const code=tariffCodeForStudent(st);
 if(!code)return alert("Le niveau ou la série de cet élève ne correspond pas à une grille tarifaire. Vérifiez sa classe.");
 const {data,error}=await supabaseClient.rpc("creer_echeancier_eleve",{p_eleve_id:Number(studentId),p_code_niveau:code});
 if(error){notifyError("Création de l'échéancier",error);return;}
 await loadLiveData();showPage("payments");alert(`${data} échéances créées pour ${st.name}.`);
}
function financeCycleForClass(className){
 const c=String(className||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 if(c.includes("matern"))return "MATERNELLE";
 if(/\b(ci|cp|ce1|ce2|cm1|cm2)\b/.test(c)||c.includes("primaire"))return "PRIMAIRE";
 if(/\b(6e|6eme|5e|5eme|4e|4eme|3e|3eme)\b/.test(c)||c.includes("college"))return "SECONDAIRE";
 if(/\b(2nde|seconde|1ere|premiere|tle|terminal)\b/.test(c)||c.includes("lycee"))return "LYCÉE";
 return "NON CLASSÉ";
}
function financeLocalDateKey(value){const d=new Date(value);if(Number.isNaN(d.getTime()))return "";return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function printDailyFinanceStatements(cycle){
 const date=val("dailyFinanceDate");if(!date)return alert("Choisissez la date de l'état journalier.");
 const groupedIds=new Set(liveVersements.flatMap(v=>(v.versements_affectations||[]).map(a=>Number(a.encaissements?.id)).filter(Boolean)));
 const records=[];
 for(const x of liveReceipts){if(x.annule||groupedIds.has(Number(x.id))||financeLocalDateKey(x.date_encaissement)!==date)continue;const st=db.students.find(s=>String(s.id)===String(x.eleve_id));if(financeCycleForClass(st?.class)!==cycle)continue;records.push({ref:x.reference_recu,student:st?.name||studentName(x.eleve_id),matricule:st?.matricule||"",classe:st?.class||"",date:x.date_encaissement,mode:x.mode_paiement,montant:Number(x.montant||0),credit:0,kind:"Encaissement"});}
 for(const v of liveVersements){if(v.annule||(v.versements_affectations||[]).length>0&&(v.versements_affectations||[]).every(a=>a.encaissements?.annule===true))continue;if(financeLocalDateKey(v.created_at)!==date)continue;const st=db.students.find(s=>String(s.id)===String(v.eleve_id));if(financeCycleForClass(st?.class)!==cycle)continue;records.push({ref:v.reference_recu,student:st?.name||studentName(v.eleve_id),matricule:st?.matricule||"",classe:st?.class||"",date:v.created_at,mode:v.mode_paiement,montant:Number(v.montant_recu||0),credit:Number(v.credit_utilise||0),kind:"Versement groupé"});}
 records.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const total=records.reduce((a,x)=>a+x.montant,0),credit=records.reduce((a,x)=>a+x.credit,0);
 const money=n=>Number(n||0).toLocaleString("fr-FR");
 const rows=records.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.ref||"")}</td><td>${esc(x.student)}</td><td>${esc(x.matricule)}</td><td>${esc(x.classe)}</td><td>${new Date(x.date).toLocaleTimeString("fr-FR")}</td><td>${esc(x.mode||"")}</td><td>${esc(x.kind)}</td><td style="text-align:right">${money(x.montant)}</td><td style="text-align:right">${money(x.credit)}</td></tr>`).join("");
 const site=currentSite(),w=window.open("","_blank");if(!w)return alert("Autorisez les fenêtres contextuelles pour imprimer l'état A4.");
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>État journalier ${esc(cycle)} ${esc(date)}</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial;color:#172338;font-size:11px}.head{text-align:center;border-bottom:2px solid #174a8b;padding-bottom:10px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:left}th{background:#edf2f7}.totals{display:flex;gap:35px;margin-top:18px;font-size:14px;font-weight:bold}.sign{display:flex;justify-content:space-between;margin-top:45px}</style></head><body><div class="head"><h1>GROUPE SCOLAIRE LA RÉFÉRENCE</h1><div>${esc(site?.nom||"")} — ${esc(site?.adresse||"")}</div><h2>ÉTAT JOURNALIER DES ENCAISSEMENTS — ${esc(cycle)}</h2><b>Date : ${new Date(date+"T00:00:00").toLocaleDateString("fr-FR")}</b></div><table><thead><tr><th>N°</th><th>Référence</th><th>Élève</th><th>Matricule</th><th>Classe</th><th>Heure</th><th>Mode</th><th>Type</th><th>Montant reçu (FCFA)</th><th>Crédit utilisé (FCFA)</th></tr></thead><tbody>${rows||'<tr><td colspan="10">Aucun encaissement pour cette date et ce cycle.</td></tr>'}</tbody></table><div class="totals"><span>Nombre d'opérations : ${records.length}</span><span>Total reçu : ${money(total)} FCFA</span><span>Crédit antérieur utilisé : ${money(credit)} FCFA</span></div><div class="sign"><span>Agent de caisse</span><span>Comptabilité</span><span>Direction — Cachet et signature</span></div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}
function printFinancePeriodReport(period){
 const month=val("financeReportMonth"),year=Number(val("financeReportYear")),cycle=val("financeReportCycle")||"TOUS";
 if(period==="month"&&!/^\d{4}-\d{2}$/.test(month))return alert("Choisissez un mois valide.");
 if(period==="year"&&(!Number.isInteger(year)||year<2000||year>2100))return alert("Saisissez une année valide.");
 const start=period==="month"?month+"-01":String(year)+"-01-01";
 const end=period==="month"?new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),1).toISOString().slice(0,10):String(year+1)+"-01-01";
 const groupedIds=new Set(liveVersements.flatMap(v=>(v.versements_affectations||[]).map(a=>Number(a.encaissements?.id)).filter(Boolean)));
 const records=[];
 for(const x of liveReceipts){
  if(x.annule||groupedIds.has(Number(x.id))||financeLocalDateKey(x.date_encaissement)<start||financeLocalDateKey(x.date_encaissement)>=end)continue;
  const st=db.students.find(s=>String(s.id)===String(x.eleve_id)),cy=financeCycleForClass(st?.class);
  if(cycle!=="TOUS"&&cy!==cycle)continue;
  records.push({ref:x.reference_recu,student:st?.name||studentName(x.eleve_id),matricule:st?.matricule||"",classe:st?.class||"",date:x.date_encaissement,mode:x.mode_paiement,montant:Number(x.montant||0),credit:0,cycle:cy,kind:"Encaissement"});
 }
 for(const v of liveVersements){
  if(v.annule||(v.versements_affectations||[]).length>0&&(v.versements_affectations||[]).every(a=>a.encaissements?.annule===true)||financeLocalDateKey(v.created_at)<start||financeLocalDateKey(v.created_at)>=end)continue;
  const st=db.students.find(s=>String(s.id)===String(v.eleve_id)),cy=financeCycleForClass(st?.class);
  if(cycle!=="TOUS"&&cy!==cycle)continue;
  records.push({ref:v.reference_recu,student:st?.name||studentName(v.eleve_id),matricule:st?.matricule||"",classe:st?.class||"",date:v.created_at,mode:v.mode_paiement,montant:Number(v.montant_recu||0),credit:Number(v.credit_utilise||0),cycle:cy,kind:"Versement groupé"});
 }
 records.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 const money=n=>Number(n||0).toLocaleString("fr-FR"),total=records.reduce((a,x)=>a+x.montant,0),credit=records.reduce((a,x)=>a+x.credit,0);
 const rows=records.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(x.ref||"")}</td><td>${esc(x.student)}</td><td>${esc(x.classe)}</td><td>${esc(x.cycle||"")}</td><td>${new Date(x.date).toLocaleString("fr-FR")}</td><td>${esc(x.mode||"")}</td><td>${esc(x.kind)}</td><td style="text-align:right">${money(x.montant)}</td><td style="text-align:right">${money(x.credit)}</td></tr>`).join("");
 const byCycle={};for(const r of records){const k=r.cycle||"Non classé";byCycle[k]=(byCycle[k]||0)+r.montant;}
 const summary=Object.entries(byCycle).map(([k,v])=>`<tr><td>${esc(k)}</td><td style="text-align:right">${money(v)} FCFA</td></tr>`).join("");
 const site=currentSite(),periodLabel=period==="month"?new Date(start+"T00:00:00").toLocaleDateString("fr-FR",{month:"long",year:"numeric"}):String(year);
 const w=window.open("","_blank");if(!w)return alert("Autorisez les fenêtres contextuelles pour imprimer l'état.");
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Recettes ${esc(periodLabel)}</title><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;color:#172338;font-size:10px}.head{text-align:center;border-bottom:2px solid #174a8b;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #cbd5e1;padding:5px;text-align:left}th{background:#edf2f7}.totals{display:flex;gap:24px;margin:14px 0;font-size:13px;font-weight:bold}.sign{display:flex;justify-content:space-between;margin-top:32px}.summary{width:48%;margin-top:14px}</style></head><body><div class="head"><h1>GROUPE SCOLAIRE LA RÉFÉRENCE</h1><div>${esc(site?.nom||"")} — ${esc(site?.adresse||"")}</div><h2>ÉTAT DES RECETTES ${period==="month"?"MENSUELLES":"ANNUELLES"}</h2><b>Période : ${esc(periodLabel)} | ${esc(cycle==="TOUS"?"Tous les cycles":cycle)}</b></div><div class="totals"><span>Nombre d'opérations : ${records.length}</span><span>Total encaissé : ${money(total)} FCFA</span><span>Crédit antérieur utilisé : ${money(credit)} FCFA</span></div><table><thead><tr><th>N°</th><th>Référence</th><th>Élève</th><th>Classe</th><th>Cycle</th><th>Date</th><th>Mode</th><th>Type</th><th>Montant reçu (FCFA)</th><th>Crédit utilisé (FCFA)</th></tr></thead><tbody>${rows||'<tr><td colspan="10">Aucune recette pour cette période.</td></tr>'}</tbody></table><table class="summary"><thead><tr><th>Recettes par cycle</th><th>Total</th></tr></thead><tbody>${summary||'<tr><td colspan="2">Aucune recette</td></tr>'}</tbody></table><div class="sign"><span>Agent de caisse</span><span>Comptabilité</span><span>Direction — Cachet et signature</span></div><script>window.onload=()=>window.print()<\/script></body></html>`);w.document.close();
}

let groupPayStudentOptions=[];
let groupPaySelectedStudentId=0;
function chooseGroupPayStudent(id){
 const st=groupPayStudentOptions.find(x=>Number(x.id)===Number(id));
 if(!st)return;
 groupPaySelectedStudentId=Number(st.id);
 const hidden=document.getElementById("groupPayStudent");
 if(hidden)hidden.value=String(st.id);
 const chosen=document.getElementById("groupPayChosen");
 if(chosen)chosen.innerHTML=`<strong>Élève choisi :</strong> ${esc(st.name)} · ${esc(st.class||"Sans classe")}${st.matricule?` · ${esc(st.matricule)}`:""} <button type="button" class="btn light" onclick="clearGroupPayStudent()">Changer</button>`;
 const results=document.getElementById("groupPayResults");
 if(results)results.innerHTML="";
 const search=document.getElementById("groupPaySearch");
 if(search)search.value=st.name;
}
function clearGroupPayStudent(){
 groupPaySelectedStudentId=0;
 const hidden=document.getElementById("groupPayStudent");if(hidden)hidden.value="";
 const chosen=document.getElementById("groupPayChosen");if(chosen)chosen.textContent="Aucun élève sélectionné.";
 const search=document.getElementById("groupPaySearch");if(search)search.value="";
 renderGroupPayStudentOptions();
}
function renderGroupPayStudentOptions(){
 const q=String(document.getElementById("groupPaySearch")?.value||"").trim().toLocaleLowerCase("fr");
 const classId=String(document.getElementById("groupPayClass")?.value||"");
 const results=document.getElementById("groupPayResults");
 if(!results)return;
 if(groupPaySelectedStudentId){
  const selected=groupPayStudentOptions.find(st=>Number(st.id)===groupPaySelectedStudentId);
  if(selected&&q===String(selected.name||"").toLocaleLowerCase("fr")){results.innerHTML="";return;}
 }
 const filtered=groupPayStudentOptions.filter(st=>{
  const hay=[st.name,st.lastName,st.firstName,st.class,st.matricule,st.educmasterId].filter(Boolean).join(" ").toLocaleLowerCase("fr");
  return (!q||hay.includes(q))&&(!classId||String(st.classId||"")===classId);
 }).slice(0,30);
 if(!q&&!classId){results.innerHTML='<p class="muted">Saisissez le nom, le prénom ou le matricule pour afficher les élèves.</p>';return;}
 results.innerHTML=filtered.length?`<div class="student-search-results" style="border:1px solid #d0d7e2;border-radius:8px;max-height:220px;overflow:auto;margin-top:8px">${filtered.map(st=>`<button type="button" class="btn light" style="display:block;width:100%;text-align:left;margin:0;border-radius:0;border-bottom:1px solid #e5e7eb" onclick="chooseGroupPayStudent(${Number(st.id)})"><strong>${esc(st.name)}</strong><span class="muted"> · ${esc(st.class||"Sans classe")}${st.matricule?` · ${esc(st.matricule)}`:""}</span></button>`).join("")}</div>`:'<p class="muted">Aucun élève trouvé.</p>';
}
function openGroupPayment(){
 groupPayStudentOptions=[...db.students]
  .filter(st=>st.status!=="transfere" && st.status!=="ancien")
  .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"fr"));
 groupPaySelectedStudentId=0;
 if(!groupPayStudentOptions.length)return alert("Aucun élève n'est disponible dans l'établissement sélectionné.");
 const classOptions=db.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 document.getElementById("modalTitle").textContent="Encaissement de plusieurs tranches";
 document.getElementById("modalBody").innerHTML=`<div class="form-grid">
 <label class="full">Classe (facultatif — pour filtrer les élèves)<select id="groupPayClass" onchange="clearGroupPayStudent()"><option value="">Toutes les classes</option>${classOptions}</select></label>
 <label class="full">Rechercher un élève<input id="groupPaySearch" type="search" placeholder="Saisir le nom, prénom ou matricule…" autocomplete="off" oninput="groupPaySelectedStudentId=0;document.getElementById('groupPayStudent').value='';document.getElementById('groupPayChosen').textContent='Aucun élève sélectionné.';renderGroupPayStudentOptions()"></label>
 <input id="groupPayStudent" type="hidden" value="">
 <div class="full"><div id="groupPayResults"><p class="muted">Saisissez le nom, le prénom ou le matricule pour afficher les élèves.</p></div><div id="groupPayChosen" class="muted" style="margin-top:8px">Aucun élève sélectionné.</div></div>
 <label>Montant versé — contribution scolaire (FCFA)<input id="groupPayAmount" type="number" min="0" step="1" value="0"></label><label>Photocopies / supports versés (FCFA)<input id="groupPaySupportAmount" type="number" min="0" step="1" value="0" placeholder="Ex. 500 à 3 500"></label>
 <label>Mode de paiement<select id="groupPayMode"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option><option>Autre</option></select></label>
 <label>Référence externe<input id="groupPayExternal"></label>
 <label class="full">Observation<textarea id="groupPayObservation" rows="2"></textarea></label>
 </div><p class="muted">Tapez le nom de l'élève : les résultats apparaissent directement sous la recherche. Touchez le bon élève pour le sélectionner. Le montant est réparti automatiquement sur ses échéances impayées ; le surplus devient un crédit élève.</p><button class="btn primary" onclick="submitGroupPayment()">Valider et répartir le paiement</button>`;
 document.getElementById("modal").classList.remove("hidden");
}
function printSupportPaymentReceipt(studentId,amount,mode,references,targetWindow){
 const st=db.students.find(x=>String(x.id)===String(studentId)),site=currentSite(),w=targetWindow||window.open("about:blank","_blank");if(!w)return alert("Autorisez les fenêtres contextuelles pour imprimer le reçu photocopies/supports.");
 const money=Number(amount||0).toLocaleString("fr-FR");
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu photocopies/supports</title><style>@page{size:A4;margin:15mm}body{font:14px Arial;color:#182233}.receipt{border:2px solid #1d6b3a;padding:22px}.head{text-align:center;border-bottom:2px solid #1d6b3a;padding-bottom:14px}.head h1{color:#1d6b3a;margin:0}.amount{font-size:24px;font-weight:bold}.sign{display:flex;justify-content:space-between;margin-top:70px}</style></head><body><main class="receipt"><header class="head"><h1>GROUPE SCOLAIRE LA RÉFÉRENCE</h1><div>${esc(site?.nom||"")}</div><h2>REÇU — PHOTOCOPIES ET SUPPORTS</h2></header><p><b>Élève :</b> ${esc(st?.name||"—")}<br><b>Matricule :</b> ${esc(st?.matricule||"—")}<br><b>Classe :</b> ${esc(st?.class||"—")}<br><b>Date :</b> ${new Date().toLocaleString("fr-FR")}<br><b>Mode :</b> ${esc(mode||"—")}</p><p>Montant reçu :</p><p class="amount">${money} FCFA</p><p><b>Référence(s) :</b> ${esc((references||[]).join(", ")||"—")}</p><p>Ce paiement concerne uniquement les photocopies et supports. Il est distinct des frais de contribution scolaire.</p><div class="sign"><span>Cachet et signature</span><span>La comptabilité</span></div></main><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`);w.document.close();
}
async function submitGroupPayment(){
 const studentId=Number(val("groupPayStudent")),amount=Number(val("groupPayAmount")||0),supportAmount=Number(val("groupPaySupportAmount")||0),mode=val("groupPayMode"),external=val("groupPayExternal"),observation=val("groupPayObservation");
 if(!studentId||!Number.isFinite(amount)||!Number.isFinite(supportAmount)||amount<0||supportAmount<0||amount+supportAmount<=0)return alert("Sélectionnez un élève et saisissez un montant positif pour la contribution ou les photocopies/supports.");
 const receiptWindow=window.open("about:blank","_blank");
 let supportRows=[],supportRefs=[],supportCollected=0;
 if(supportAmount>0){
  const q=await supabaseClient.from("v_echeances_support_eleves").select("id,reste_a_payer,numero_tranche").eq("eleve_id",studentId).eq("etablissement_id",activeSiteId).gt("reste_a_payer",0).order("numero_tranche");
  if(q.error){if(receiptWindow&&!receiptWindow.closed)receiptWindow.close();notifyError("Chargement des frais photocopies/support",q.error);return;}
  supportRows=q.data||[];const available=supportRows.reduce((sum,x)=>sum+Number(x.reste_a_payer||0),0);
  if(supportAmount>available){if(receiptWindow&&!receiptWindow.closed)receiptWindow.close();return alert("Le solde photocopies/support disponible est de "+available.toLocaleString("fr-FR")+" FCFA. Aucun encaissement n'a été effectué.");}
 }
 let versement=null;
 if(amount>0){
  const {data,error}=await supabaseClient.rpc("enregistrer_versement_eleve",{p_eleve_id:studentId,p_montant:amount,p_mode:mode,p_reference_externe:external||null,p_observation:observation||null});
  if(error){if(receiptWindow&&!receiptWindow.closed)receiptWindow.close();notifyError("Versement de contribution refusé",error);return;}
  versement=Array.isArray(data)?data[0]:data;
 }
 if(supportAmount>0){
  let left=supportAmount;
  for(const row of supportRows){if(left<=0)break;const part=Math.min(left,Number(row.reste_a_payer||0));if(part<=0)continue;
   const r=await supabaseClient.rpc("encaisser_support_eleve",{p_echeance_id:Number(row.id),p_montant:part,p_mode:mode,p_observation:observation||"Paiement distinct de photocopies/support depuis Finance"});
   if(r.error){if(receiptWindow&&!receiptWindow.closed)receiptWindow.close();notifyError("Encaissement photocopies/support interrompu après "+supportCollected+" FCFA",r.error);return;}
   const rec=Array.isArray(r.data)?r.data[0]:r.data;supportCollected+=part;if(rec?.reference_recu)supportRefs.push(rec.reference_recu);left-=part;
  }
 }
 closeModal();await loadLiveData();showPage("payments");
 if(versement){versement.support_encaisse_dans_operation=supportCollected;versement.support_references=supportRefs;alert("Contribution enregistrée. Référence : "+versement.reference_recu+". Photocopies/supports encaissés séparément : "+supportCollected.toLocaleString("fr-FR")+" FCFA.");printVersementReceipt(versement,studentId,mode,receiptWindow);}
 else{if(supportCollected>0)printSupportPaymentReceipt(studentId,supportCollected,mode,supportRefs,receiptWindow);else if(receiptWindow&&!receiptWindow.closed)receiptWindow.close();alert("Photocopies/supports encaissés séparément : "+supportCollected.toLocaleString("fr-FR")+" FCFA. Référence(s) : "+supportRefs.join(", "));}
}
async function printStoredVersementReceipt(id){
 const v=liveVersements.find(x=>Number(x.id)===Number(id));if(!v)return alert("Reçu groupé introuvable.");
 const affects=(v.versements_affectations||[]).map(a=>({tranche:a.encaissements?.echeance_eleve_id,montant:a.encaissements?.montant,source:a.source==="credit"?"Crédit antérieur":"Versement du jour"}));
 printVersementReceipt({reference_recu:v.reference_recu,montant_recu:v.montant_recu,credit_utilise:v.credit_utilise,surplus_credite:v.surplus_credite,credit_disponible:v.credit_disponible_apres??0,affectations:affects,created_at:v.created_at,caissier_nom:v.caissier_nom,annule:!!v.annule||((v.versements_affectations||[]).length>0&&(v.versements_affectations||[]).every(a=>a.encaissements?.annule===true))},v.eleve_id,v.mode_paiement);
}
async function printVersementReceipt(v,studentId,mode,targetWindow){
 const st=db.students.find(x=>String(x.id)===String(studentId));const site=currentSite();
 let supportRows=[];
 try{const sr=await supabaseClient.from("v_echeances_support_eleves").select("*").eq("eleve_id",studentId).order("numero_tranche");if(!sr.error)supportRows=sr.data||[]}catch(err){console.warn("Détail photocopies/support indisponible sur le reçu :",err)}
 const money=n=>Number(n||0).toLocaleString("fr-FR");
 const schedules=liveStudentSchedules.filter(x=>String(x.eleve_id)===String(studentId)&&Number(x.reste_a_payer)>0).sort((a,b)=>{const da=a.date_echeance||null,db=b.date_echeance||null;if(!da&&!db)return Number(a.numero_tranche)-Number(b.numero_tranche);if(!da)return -1;if(!db)return 1;return String(da).localeCompare(String(db))||Number(a.numero_tranche)-Number(b.numero_tranche);});
 const allocations=(v.affectations||[]).map(a=>{const e=liveStudentSchedules.find(x=>Number(x.id)===Number(a.tranche));return `<tr><td>${esc(e?.libelle||("Échéance "+a.tranche))}</td><td>${esc(a.source||"")}</td><td style="text-align:right">${Number(a.montant||0).toLocaleString("fr-FR")} FCFA</td></tr>`}).join("");
 const allStudentSchedules=liveStudentSchedules.filter(x=>String(x.eleve_id)===String(studentId)).sort((a,b)=>Number(a.numero_tranche)-Number(b.numero_tranche));
 const totalDue=allStudentSchedules.reduce((sum,x)=>sum+Number(x.montant_net||0),0);
 const totalPaid=allStudentSchedules.reduce((sum,x)=>sum+Number(x.montant_paye||0),0);
 const totalRemaining=allStudentSchedules.reduce((sum,x)=>sum+Number(x.reste_a_payer||0),0);
 const installmentRows=allStudentSchedules.map(x=>`<tr><td>${esc(x.libelle||("Tranche "+x.numero_tranche))}</td><td style="text-align:right">${money(x.montant_net)} FCFA</td><td style="text-align:right">${money(x.montant_paye)} FCFA</td><td style="text-align:right">${money(x.reste_a_payer)} FCFA</td></tr>`).join("");
 const supportDue=supportRows.reduce((sum,x)=>sum+Number(x.montant_du||0),0),supportPaid=supportRows.reduce((sum,x)=>sum+Number(x.montant_paye||0),0),supportRemaining=supportRows.reduce((sum,x)=>sum+Number(x.reste_a_payer||0),0);
 const supportRowsHtml=supportRows.map(x=>`<tr><td>${esc(x.libelle||("Tranche "+x.numero_tranche))}</td><td style="text-align:right">${money(x.montant_du)} FCFA</td><td style="text-align:right">${money(x.montant_paye)} FCFA</td><td style="text-align:right">${money(x.reste_a_payer)} FCFA</td></tr>`).join("");
 const supportDetail=`<h3>Frais distincts — photocopies et supports de cours</h3><table><thead><tr><th>Tranche</th><th>Montant dû</th><th>Payé</th><th>Reste</th></tr></thead><tbody>${supportRowsHtml||'<tr><td colspan="4">Aucun frais distinct enregistré.</td></tr>'}</tbody><tfoot><tr><th>TOTAL SUPPORTS</th><th>${money(supportDue)} FCFA</th><th>${money(supportPaid)} FCFA</th><th>${money(supportRemaining)} FCFA</th></tr></tfoot></table><p><b>Encaissé en photocopies/support lors de cette opération :</b> ${money(v.support_encaisse_dans_operation||0)} FCFA ${v.support_references?.length?" · Référence(s) : "+v.support_references.map(esc).join(", "):""}</p><p><b>À noter :</b> les frais de photocopies et supports sont séparés de la scolarité et ne sont pas compris dans le montant reçu ci-dessus.</p>`;
 const nextDue=schedules[0]||null;const nextAfter=nextDue?schedules.find(x=>Number(x.numero_tranche)===Number(nextDue.numero_tranche)+1):null;
 let warning="Scolarité entièrement réglée.";
 if(nextDue){
  const due=nextDue.date_echeance?new Date(nextDue.date_echeance+"T00:00:00"):null;
  const cut5=due?new Date(due.getFullYear(),due.getMonth()+1,5):null;
  const cut6=due?new Date(due.getFullYear(),due.getMonth()+1,6):null;
  const cut11=due?new Date(due.getFullYear(),due.getMonth()+1,11):null;
  const today=new Date();today.setHours(0,0,0,0);
  const dateLabel=due?due.toLocaleDateString("fr-FR"):"À l’inscription (sans date fixe)";
  if(cut11&&today>=cut11){
   const required=Number(nextDue.reste_a_payer||0)+Number(nextAfter?.reste_a_payer||0);
   warning=`À partir du 11 : régler les deux tranches exigibles. ${esc(nextDue.libelle||"Tranche "+nextDue.numero_tranche)} : ${money(nextDue.reste_a_payer)} FCFA${nextAfter?` ; ${esc(nextAfter.libelle||"Tranche "+nextAfter.numero_tranche)} : ${money(nextAfter.reste_a_payer)} FCFA`:""}. Total à régler : ${money(required)} FCFA.`;
  }else if(cut6&&today>=cut6){
   warning=`Retard signalé : ${esc(nextDue.libelle||"Tranche "+nextDue.numero_tranche)} reste à régler (${money(nextDue.reste_a_payer)} FCFA).`;
  }else{
   warning=`Prochaine échéance : ${dateLabel} — ${esc(nextDue.libelle||"Tranche "+nextDue.numero_tranche)}. Montant restant : ${money(nextDue.reste_a_payer)} FCFA.`;
  }
  if(Number(nextDue.montant_paye||0)>0)warning+=` Déjà versé sur cette tranche : ${money(nextDue.montant_paye)} FCFA.`;
 }
 const w=targetWindow||window.open("","_blank");if(!w)return alert("Autorisez les fenêtres contextuelles pour imprimer le reçu.");
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${esc(v.reference_recu)}</title><style>
@page{size:A4 portrait;margin:6mm}
*{box-sizing:border-box}
html,body{margin:0!important;padding:0!important;width:100%;font-family:Arial,sans-serif;color:#172338;font-size:8pt;line-height:1.08}
body{print-color-adjust:exact;-webkit-print-color-adjust:exact}
.receipt{width:100%;max-width:198mm;height:285mm;max-height:285mm;margin:0 auto;border:1px solid #174a8b;padding:4mm;overflow:hidden}
.center{text-align:center;border-bottom:1px solid #174a8b;padding-bottom:1mm}
h1{font-size:14pt;margin:0 0 1mm}h2{font-size:10pt;margin:1mm 0}
h3{font-size:8.5pt;margin:1.5mm 0 .8mm}
p{margin:1mm 0}
table{width:100%;border-collapse:collapse;margin:1.2mm 0;table-layout:fixed}
td,th{padding:.8mm 1mm;border:1px solid #cbd5e1;text-align:left;font-size:7.2pt;line-height:1.05;overflow-wrap:anywhere}
.total{font-size:11pt;font-weight:bold}
.sign{display:flex;justify-content:space-between;gap:3mm;margin-top:2mm;padding-top:2mm;min-height:9mm}
.receipt button{display:none!important}
@media print{html,body{width:100%;height:285mm;overflow:hidden}.receipt{width:100%;height:285mm;max-height:285mm;max-width:none;margin:0;padding:4mm;overflow:hidden;page-break-inside:avoid;break-inside:avoid}table,tr,td,th{page-break-inside:avoid;break-inside:avoid}button{display:none!important}}
@media screen{body{padding:8px;background:#f3f6fa}.receipt{background:white;max-width:760px;height:auto;min-height:0;max-height:none;overflow:visible}}
</style></head><body><div class="receipt"><div class="center"><h1>GROUPE SCOLAIRE LA RÉFÉRENCE</h1><div>${esc(site?.nom||"")} · ${esc(site?.adresse||"")}</div><h2>REÇU DE VERSEMENT</h2>${v.annule?`<h2 style="color:#b42318">ANNULÉ — NE PAS ENCAISSER</h2>`:""}</div><p style="text-align:right"><b>N° ${esc(v.reference_recu)}</b></p><p><b>Élève :</b> ${esc(st?.name||"")} &nbsp; <b>Matricule :</b> ${esc(st?.matricule||"")}<br><b>Classe :</b> ${esc(st?.class||"")}<br><b>Date :</b> ${new Date(v.created_at||Date.now()).toLocaleString("fr-FR")} &nbsp; <b>Mode :</b> ${esc(mode||"")}</p><table><thead><tr><th>Tranche / échéance</th><th>Origine</th><th>Montant affecté</th></tr></thead><tbody>${allocations||'<tr><td colspan="3">Aucune échéance affectée</td></tr>'}</tbody></table><p>Montant reçu : <b class="total">${money(v.montant_recu)} FCFA</b></p><p>Crédit antérieur utilisé : ${money(v.credit_utilise)} FCFA<br>Surplus placé en crédit : ${money(v.surplus_credite)} FCFA<br><b>Crédit disponible après opération : ${money(v.credit_disponible)} FCFA</b></p><h3>Situation financière de la scolarité</h3><table><thead><tr><th>Tranche</th><th>Total dû</th><th>Total payé</th><th>Reste à payer</th></tr></thead><tbody>${installmentRows||'<tr><td colspan="4">Échéancier indisponible</td></tr>'}</tbody><tfoot><tr><th>TOTAL</th><th>${money(totalDue)} FCFA</th><th>${money(totalPaid)} FCFA</th><th>${money(totalRemaining)} FCFA</th></tr></tfoot></table>${supportDetail}<p><b>Situation après versement :</b> ${warning}</p><div class="sign"><span>Cachet et signature</span><span>Caissier : ${esc(v.caissier_nom||"Non renseigné")}<br>La comptabilité</span></div><p style="text-align:center">Merci pour votre confiance.</p><button onclick="window.print()">Imprimer le reçu A4</button></div></body></html>`);w.document.close();setTimeout(()=>{try{const r=w.document.querySelector(".receipt");if(r){const available=285*96/25.4;const needed=r.scrollHeight;const scale=Math.min(1,available/needed);if(scale<1)r.style.zoom=String(scale);}w.focus();w.print();}catch(e){try{w.print()}catch(_){}}},650);
}
async function cancelGroupedVersement(id){
 const motif=prompt("Motif obligatoire de l’annulation du versement (minimum 8 caractères) :");
 if(motif===null)return;
 if(motif.trim().length<8)return alert("Le motif doit comporter au moins 8 caractères.");
 if(!confirm("Confirmer l’annulation de tout le versement groupé ? Toutes ses affectations seront annulées et le crédit sera régularisé."))return;
 const {data,error}=await supabaseClient.rpc("annuler_versement_eleve",{p_versement_id:Number(id),p_motif:motif.trim()});
 if(error){notifyError("Annulation du versement groupé refusée",error);return;}
 await loadLiveData();showPage("payments");alert(data||"Versement groupé annulé. L’historique est conservé.");
}
function openEditLedgerPayment(id){
 const x=liveReceipts.find(r=>Number(r.id)===Number(id));
 if(!x)return alert("Paiement introuvable.");
 const localDate=x.date_encaissement?new Date(new Date(x.date_encaissement).getTime()-new Date(x.date_encaissement).getTimezoneOffset()*60000).toISOString().slice(0,16):"";
 const modes=["Espèces","MTN Mobile Money","Moov Money","Virement","Chèque","Autre"];
 const modeOptions=[...new Set([...modes,x.mode_paiement].filter(Boolean))].map(m=>`<option ${m===x.mode_paiement?'selected':''}>${esc(m)}</option>`).join("");
 document.getElementById("modalTitle").textContent="Modifier un paiement";
 document.getElementById("modalBody").innerHTML=`<div class="form-grid"><label>Référence<input value="${esc(x.reference_recu||"")}" disabled></label><label>Montant (FCFA)<input id="editReceiptAmount" type="number" min="1" step="1" value="${Number(x.montant||0)}"></label><label>Date et heure<input id="editReceiptDate" type="datetime-local" value="${localDate}"></label><label>Mode de paiement<select id="editReceiptMode">${modeOptions}</select></label><label>Référence externe<input id="editReceiptExternal" value="${esc(x.reference_externe||"")}"></label><label class="full">Observation<textarea id="editReceiptObservation">${esc(x.observation||"")}</textarea></label></div><p class="muted">La modification conserve le numéro du reçu et met à jour le paiement rattaché à son échéance.</p><button class="btn primary" onclick="saveEditLedgerPayment(${Number(x.id)})">Enregistrer les modifications</button>`;
 document.getElementById("modal").classList.remove("hidden");
}
async function saveEditLedgerPayment(id){
 const amount=Number(val("editReceiptAmount")),dateValue=val("editReceiptDate"),mode=val("editReceiptMode");
 if(!Number.isFinite(amount)||amount<=0)return alert("Le montant doit être supérieur à zéro.");
 if(!dateValue||!mode)return alert("La date et le mode de paiement sont obligatoires.");
 const date=new Date(dateValue);if(Number.isNaN(date.getTime()))return alert("Date de paiement invalide.");
 const {error}=await supabaseClient.from("encaissements").update({montant:amount,date_encaissement:date.toISOString(),mode_paiement:mode,reference_externe:val("editReceiptExternal")||null,observation:val("editReceiptObservation")||null}).eq("id",id).eq("etablissement_id",activeSiteId).eq("annule",false);
 if(error){notifyError("Modification du paiement",error);return;}
 closeModal();await loadLiveData();showPage("payments");alert("Paiement modifié. Les soldes seront recalculés à partir du nouvel encaissement.");
}
function openGroupedPaymentEditor(id){
 const v=liveVersements.find(x=>Number(x.id)===Number(id));if(!v)return alert("Versement groupé introuvable.");
 const parts=(v.versements_affectations||[]).filter(a=>a.encaissements&&!a.encaissements.annule);
 if(!parts.length)return alert("Aucun paiement actif à modifier dans ce versement.");
 document.getElementById("modalTitle").textContent="Modifier les paiements du reçu groupé";
 document.getElementById("modalBody").innerHTML=`<p><strong>${esc(v.reference_recu)}</strong> — ${esc(v.student)} — ${Number(v.montant_recu||0).toLocaleString("fr-FR")} FCFA</p><p class="muted">Sélectionnez le paiement individuel à modifier. Le reçu groupé reste disponible pour réimpression.</p><div class="table-wrap"><table class="table"><thead><tr><th>Échéance</th><th>Montant</th><th>Action</th></tr></thead><tbody>${parts.map(a=>`<tr><td>${esc(a.encaissements?.echeance_eleve_id||"—")}</td><td>${Number(a.encaissements?.montant||0).toLocaleString("fr-FR")} FCFA</td><td><button class="btn light" onclick="closeModal();openEditLedgerPayment(${Number(a.encaissements.id)})">Modifier</button></td></tr>`).join("")}</tbody></table></div>`;
 document.getElementById("modal").classList.remove("hidden");
}
async function cancelLedgerReceipt(id){
 const motif=prompt("Motif obligatoire de l’annulation du reçu (minimum 8 caractères) :");
 if(motif===null)return;
 if(motif.trim().length<8)return alert("Le motif doit comporter au moins 8 caractères.");
 if(!confirm("Confirmer l’annulation ? Le reçu sera conservé dans l’historique et le solde recalculé."))return;
 const {data,error}=await supabaseClient.rpc("annuler_encaissement",{p_encaissement_id:Number(id),p_motif:motif.trim()});
 if(error){notifyError("Annulation refusée",error);return;}
 await loadLiveData();showPage("payments");alert(data||"Reçu annulé.");
}
function openLedgerPayment(scheduleId){
 const e=liveStudentSchedules.find(x=>Number(x.id)===Number(scheduleId));if(!e)return alert("Échéance introuvable.");
 const st=db.students.find(x=>String(x.id)===String(e.eleve_id));
 const html=`<div class="form-grid"><label>Élève<input value="${esc(st?.name||"")}" disabled></label><label>Échéance<input value="${esc(e.libelle)}" disabled></label><label>Montant net dû<input value="${Number(e.montant_net).toLocaleString("fr-FR")} FCFA" disabled></label><label>Déjà payé<input value="${Number(e.montant_paye).toLocaleString("fr-FR")} FCFA" disabled></label><label>Reste à payer<input id="ledgerRemaining" value="${Number(e.reste_a_payer)}" disabled></label><label>Montant versé (FCFA)<input id="ledgerAmount" type="number" min="1" max="${Number(e.reste_a_payer)}" value="${Number(e.reste_a_payer)}" required></label><label>Mode de paiement<select id="ledgerMode"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option><option>Autre</option></select></label><label>Référence externe (facultatif)<input id="ledgerExternal"></label><label class="full">Observation<textarea id="ledgerObservation" rows="2"></textarea></label></div><button class="btn primary" onclick="submitLedgerPayment(${e.id})">Valider l'encaissement et créer le reçu</button>`;
 document.getElementById("modalTitle").textContent="Nouvel encaissement";document.getElementById("modalBody").innerHTML=html;document.getElementById("modal").classList.remove("hidden");
}
async function submitLedgerPayment(scheduleId){
 const amount=Number(val("ledgerAmount"));if(!Number.isFinite(amount)||amount<=0)return alert("Saisissez un montant positif.");
 const receiptWindow=window.open("about:blank","_blank");
 const {data,error}=await supabaseClient.rpc("enregistrer_encaissement",{p_echeance_id:Number(scheduleId),p_montant:amount,p_mode:val("ledgerMode"),p_reference_externe:val("ledgerExternal")||null,p_observation:val("ledgerObservation")||null});
 if(error){if(receiptWindow&&!receiptWindow.closed)receiptWindow.close();notifyError("Encaissement refusé",error);return;}
 closeModal();await loadLiveData();showPage("payments");const receipt=data?.[0];if(receipt){alert(`Encaissement enregistré. Reçu : ${receipt.reference_recu}. Solde restant : ${Number(receipt.solde_restant).toLocaleString("fr-FR")} FCFA.`);printLedgerReceiptByReference(receipt.reference_recu,receiptWindow);}
}
function printLedgerReceipt(id){const x=liveReceipts.find(r=>Number(r.id)===Number(id));if(x)printLedgerReceiptByReference(x.reference_recu);}
async function printLedgerReceiptByReference(ref,targetWindow){
 const x=liveReceipts.find(r=>r.reference_recu===ref);if(!x)return alert("Reçu introuvable après actualisation.");
 // Afficher séparément les frais de photocopies/support sur chaque reçu de scolarité.
 let supportRows=[];
 try{
  const supportResult=await supabaseClient.from("v_echeances_support_eleves").select("*").eq("eleve_id",x.eleve_id).order("numero_tranche");
  if(!supportResult.error)supportRows=supportResult.data||[];
 }catch(err){console.warn("Détail photocopies/support indisponible sur le reçu :",err)}
 const st=db.students.find(v=>String(v.id)===String(x.eleve_id));const e=liveStudentSchedules.find(v=>Number(v.id)===Number(x.echeance_eleve_id));const site=currentSite();
 const schedules=liveStudentSchedules.filter(v=>String(v.eleve_id)===String(x.eleve_id)).sort((a,b)=>Number(a.numero_tranche)-Number(b.numero_tranche));
 const money=n=>Number(n||0).toLocaleString("fr-FR");
 const due=schedules.reduce((a,z)=>a+Number(z.montant_net||0),0),paid=schedules.reduce((a,z)=>a+Number(z.montant_paye||0),0),balance=schedules.reduce((a,z)=>a+Number(z.reste_a_payer||0),0);
 const supportDue=supportRows.reduce((a,z)=>a+Number(z.montant_du||0),0),supportPaid=supportRows.reduce((a,z)=>a+Number(z.montant_paye||0),0),supportBalance=supportRows.reduce((a,z)=>a+Number(z.reste_a_payer||0),0);
 const supportDetail=supportRows.length?`<h3>Détail séparé — photocopies et supports de cours</h3><table class="details"><thead><tr><th>Tranche</th><th>Montant dû</th><th>Déjà payé</th><th>Reste à payer</th></tr></thead><tbody>${supportRows.map(z=>`<tr><td>${esc(z.libelle||("Tranche "+z.numero_tranche))}</td><td>${money(z.montant_du)} FCFA</td><td>${money(z.montant_paye)} FCFA</td><td>${money(z.reste_a_payer)} FCFA</td></tr>`).join("")}<tr><th>Total photocopies/support</th><th>${money(supportDue)} FCFA</th><th>${money(supportPaid)} FCFA</th><th>${money(supportBalance)} FCFA</th></tr></tbody></table>`:`<h3>Photocopies et supports de cours</h3><p>Aucun frais distinct enregistré pour cet élève.</p>`;
 const w=targetWindow||window.open("","_blank");if(!w)return alert("Autorisez les fenêtres contextuelles pour imprimer le reçu.");
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${esc(ref)}</title><style>
@page{size:A4 portrait;margin:7mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#172338;font-size:9pt;line-height:1.15}.receipt{width:100%;max-width:196mm;height:282mm;max-height:282mm;margin:0 auto;border:1.5px solid #174a8b;padding:5mm;overflow:hidden}.head{text-align:center;border-bottom:2px solid #174a8b;padding-bottom:4mm}.head h1{font-size:17pt;margin:0 0 2mm;color:#174a8b}.head h2{font-size:13pt;margin:2mm 0}.meta{display:flex;justify-content:space-between;gap:6mm;margin:3mm 0}.meta p{margin:1mm 0}.ref{text-align:right;font-weight:bold;color:#174a8b}.details{width:100%;border-collapse:collapse;margin:3mm 0}.details th,.details td{border:1px solid #cbd5e1;padding:1.7mm 2.5mm;text-align:left}.details th{width:38%;background:#f1f5f9}.amount{font-size:17pt;font-weight:bold;color:#174a8b}.summary{display:grid;grid-template-columns:repeat(3,1fr);gap:2mm;margin:3mm 0}.summary div{border:1px solid #cbd5e1;padding:2mm;text-align:center}.summary b{display:block;font-size:12pt;margin-top:1mm}.sign{display:flex;justify-content:space-between;margin-top:9mm;min-height:12mm}.thanks{text-align:center;margin-top:3mm;color:#475569;font-style:italic}.cancel{color:#b42318;font-size:16pt;font-weight:bold;text-align:center;margin:3mm}.no-print{margin:5mm auto;display:block}@media print{.no-print{display:none!important}.receipt{height:282mm;max-height:282mm;break-inside:avoid;page-break-inside:avoid}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><main class="receipt"><header class="head"><h1>GROUPE SCOLAIRE LA RÉFÉRENCE</h1><div>${esc(site?.nom||"")}</div><div>${esc(site?.adresse||"")} · ${esc(site?.telephone||"")}</div><h2>REÇU DE PAIEMENT — FRAIS DE SCOLARITÉ</h2></header>${x.annule?'<div class="cancel">PAIEMENT ANNULÉ</div>':""}<p class="ref">N° ${esc(x.reference_recu)}</p><section class="meta"><div><p><b>Élève :</b> ${esc(st?.name||x.student||"—")}</p><p><b>Matricule :</b> ${esc(st?.matricule||"—")}</p><p><b>Classe :</b> ${esc(st?.class||"—")}</p></div><div><p><b>Date :</b> ${new Date(x.date_encaissement).toLocaleString("fr-FR")}</p><p><b>Mode :</b> ${esc(x.mode_paiement||"—")}</p><p><b>Échéance :</b> ${esc(e?.libelle||"Frais de scolarité")}</p></div></section><table class="details"><tr><th>Rubrique</th><td>Frais de scolarité</td></tr><tr><th>Montant réglé</th><td class="amount">${money(x.montant)} FCFA</td></tr><tr><th>Référence externe</th><td>${esc(x.reference_externe||"—")}</td></tr><tr><th>Caissier</th><td>${esc(x.caissier_nom||"Non renseigné")}</td></tr></table><h3>Situation de scolarité après paiement</h3><section class="summary"><div>Total dû<b>${money(due)} F</b></div><div>Total payé<b>${money(paid)} F</b></div><div>Reste à payer<b>${money(balance)} F</b></div></section>${supportDetail}<p><b>Important :</b> les frais de photocopies et supports sont indépendants des frais de scolarité et ne sont pas inclus dans le montant encaissé sur ce reçu.</p>${x.annule?`<p><b>Motif d’annulation :</b> ${esc(x.motif_annulation||"")}</p>`:""}<div class="sign"><span>Cachet et signature</span><span>La comptabilité</span></div><p class="thanks">Merci pour votre confiance.</p></main><button class="no-print" onclick="window.print()">Imprimer le reçu A4</button><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`);
 w.document.close();
}

function listPage(title,sub,btn,type,arr,cols){
 let rows=arr.map((x)=>`<tr>${cols.map(c=>`<td>${esc(rowVal(x,c))}</td>`).join("")}<td class="actions"><button class="btn light" onclick="openEdit('${type}',${Number(x.id)})">Modifier</button>${type==='payment'?`<button class="btn light" onclick="printReceipt(${Number(x.id)})">Reçu</button>`:''}<button class="btn danger" onclick="removeItem('${type}',${Number(x.id)})">Supprimer</button></td></tr>`).join("");
 return pageShell(title,sub,btn,`openForm('${type}')`,`<div class="toolbar"><input placeholder="Rechercher..." oninput="filterTable(this)"></div><div class="table-wrap"><table class="table"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join("")}<th>Action</th></tr></thead><tbody id="dataBody">${rows||`<tr><td colspan="${cols.length+1}" class="empty">Aucune donnée.</td></tr>`}</tbody></table></div>`);
}
function rowVal(x,c){return ({Matricule:x.matricule||"",Nom:x.name||x.student||"",Classe:x.name||x.class||"Classe sans nom",Sexe:x.sex||"",Téléphone:x.phone||"",Statut:x.status||"",Matière:x.subject||x.matter||"",Niveau:x.level||"",Groupe:x.group||"—",Capacité:x.capacity||"",Élève:x.student||"",Email:x.email||"",Montant:x.amount!=null?Number(x.amount).toLocaleString("fr-FR")+" FCFA":"",Date:x.date||"",Motif:x.reason||"",Note:x.note??"",Coefficient:x.coeff??"",Période:x.period||"",État:x.state||""})[c]??""}
function filterTable(inp){let q=inp.value.toLowerCase();document.querySelectorAll("#dataBody tr").forEach(r=>r.style.display=r.innerText.toLowerCase().includes(q)?"":"none")}
function closeModal(){document.getElementById("modal").classList.add("hidden")}
function val(id){return document.getElementById(id)?.value||""}
function removeItem(type,id){if(liveMode){alert("La suppression en base de données n’est pas encore activée.");return;}if(!confirm("Supprimer cet élément ?"))return;const map={student:"students",teacher:"teachers",class:"classes",parent:"parents",payment:"payments",grade:"grades",attendance:"attendance"};db[map[type]]=db[map[type]].filter(x=>x.id!==id);save();showPage(document.querySelector(".sidebar nav button.active")?.dataset.page||"dashboard")}
async function saveSettings(){
 if(!liveMode||!activeSiteId)return alert("Connexion requise.");
 const payload={nom:val("setSchool").trim(),directeur:val("setDirector").trim()||null,telephone:val("setPhone").trim()||null,adresse:val("setAddress").trim()||null};
 if(!payload.nom)return alert("Le nom de l'établissement est obligatoire.");
 const {error}=await supabaseClient.from("etablissements").update(payload).eq("id",activeSiteId);
 if(error){notifyError("Enregistrement des paramètres",error);return;}
 await loadLiveData();showPage("settings");alert("Paramètres de l'établissement enregistrés dans Supabase.");
}
function exportData(){const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="la-reference-sauvegarde.json";a.click();URL.revokeObjectURL(a.href)}


function educMasterPage(){
 const cls=db.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 return pageShell("Synchronisation ÉDUCMASTER","Importer et exporter les notes du primaire et du collège à partir des modèles Excel reçus","Enregistrer les paramètres","saveEducMaster",`
 <div class="card"><div class="form-grid"><label>Adresse EducMaster primaire<input id="emPrimary" value="${esc(currentSite()?.educmaster_primaire_url||db.educmaster.primaryUrl)}" placeholder="Adresse officielle, facultatif"></label><label>Adresse EducMaster secondaire<input id="emSecondary" value="${esc(currentSite()?.educmaster_secondaire_url||db.educmaster.secondaryUrl)}" placeholder="Adresse officielle, facultatif"></label></div><button class="btn light" onclick="saveEducMaster()">Enregistrer les paramètres</button></div>
 <div class="card" style="margin-top:14px"><h3>Importer un fichier de notes Excel</h3><p class="muted">Choisissez le niveau, la classe, la période et le fichier exporté depuis EducMaster. Le fichier est analysé avant tout enregistrement.</p>
 <div class="form-grid"><label>Niveau<select id="emLevel" onchange="educMasterLevelChanged()"><option value="primaire">Primaire</option><option value="college">Collège</option></select></label><label>Classe concernée<select id="emClass">${cls}</select></label><label>Période<select id="emPeriod"><option>1er trimestre</option><option>2e trimestre</option><option>3e trimestre</option><option>1er semestre</option><option>2e semestre</option></select></label><label>Fichier Excel (.xlsx)<input id="emFile" type="file" accept=".xlsx,.xls" onchange="previewEducMasterImport()"></label></div>
 <div class="notice" id="emFormatHint">Primaire : feuilles Évaluation formative 1 et Évaluation sommative 1 à 3, avec Note obtenue et Note perfectionnement. Collège : une feuille par matière avec Moy. interro, Devoir 1 et Devoir 2.</div><div id="emPreview" style="margin-top:12px"></div><div class="button-row" style="margin-top:12px"><button class="btn primary" id="emApplyBtn" disabled onclick="applyEducMasterImport()">Valider l’importation</button><button class="btn light" onclick="exportEducMasterWorkbook()">Exporter les notes de la classe (.xlsx)</button></div>
 </div><div class="card" style="margin-top:14px"><h3>Règles de sécurité</h3><ul><li>Correspondance des élèves par numéro ÉducMaster uniquement.</li><li>Les matières non reconnues et les élèves absents de la classe sont signalés.</li><li>Les notes déjà présentes ne sont pas écrasées : elles sont ignorées et signalées.</li><li>Aucune donnée n’est enregistrée avant la validation de l’aperçu.</li></ul><div class="notice">L’export produit un classeur structuré selon les modèles reçus. La compatibilité finale doit être testée dans EducMaster avant un usage généralisé ; aucune API directe n’est présumée.</div></div>`);
}
let emPendingImport=[];
let emImportStats=null;
function emNorm(v){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function emMat(v){return String(v??"").replace(/^'+/,"").replace(/\s/g,"").trim();}
function emNumber(v){if(v===null||v===undefined||v==="")return null;const n=Number(String(v).replace(",","."));return Number.isFinite(n)?n:null;}
function educMasterLevelChanged(){const h=document.getElementById("emFormatHint");if(h)h.textContent=val("emLevel")==="primaire"?"Primaire : feuilles Évaluation formative 1 et Évaluation sommative 1 à 3, avec Note obtenue et Note perfectionnement.":"Collège : une feuille par matière avec Matricule, Nom, Prénoms, Moy. interro, Devoir 1 et Devoir 2.";emPendingImport=[];const p=document.getElementById("emPreview");if(p)p.innerHTML="";const b=document.getElementById("emApplyBtn");if(b)b.disabled=true;}
function emFindStudent(matricule){const key=emMat(matricule);return db.students.find(s=>emMat(s.educmasterId)===key&&Number(s.classId)===Number(val("emClass")));}
function emFindSubject(name){const aliases={math:"mathematiques",mathsgene:"mathematiques",pct:"physiquechimietechnologie",histgeo:"histoiregeographie",francaiscomecrite:"francaiscommunicationecrite"};const n=emNorm(name),target=aliases[n]||n;return liveSubjects.find(s=>{const sn=emNorm(s.nom);return sn===target||sn===n||sn.includes(target)||target.includes(sn);});}
async function previewEducMasterImport(){
 const file=document.getElementById("emFile")?.files?.[0];if(!file)return;
 if(!window.XLSX){alert("Le lecteur Excel n’est pas encore chargé. Actualisez la page puis réessayez.");return;}
 if(!liveMode||!activeSiteId)return alert("Connectez-vous à l’établissement avant l’importation.");
 if(!val("emClass"))return alert("Choisissez la classe concernée.");
 try{
  const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:false});const level=val("emLevel"),period=val("emPeriod"),rows=[];let badSheets=[];
  if(level==="college"){
   for(const sn of wb.SheetNames){const data=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null});if(!data.length)continue;const headers=(data[0]||[]).map(emNorm);const ix={mat:headers.indexOf("matricule"),name:headers.indexOf("nom"),first:headers.indexOf("prenoms"),inter:headers.findIndex(x=>x.includes("interro")),d1:headers.findIndex(x=>x.includes("devoir1")),d2:headers.findIndex(x=>x.includes("devoir2"))};if(ix.mat<0||ix.inter<0||ix.d1<0||ix.d2<0){badSheets.push(sn);continue;}const subject=emFindSubject(sn);for(let r=1;r<data.length;r++){const line=data[r],mat=emMat(line[ix.mat]);if(!mat)continue;const st=emFindStudent(mat);for(const [idx,type] of [[ix.inter,"Moyenne d’interrogation"],[ix.d1,"Premier devoir"],[ix.d2,"Deuxième devoir"]]){const note=emNumber(line[idx]);if(note===null)continue;rows.push({matricule:mat,student:st,matter:subject,type,note,period,level,sheet:sn});}}}
  }else{
   for(const sn of wb.SheetNames){const data=XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:null});if(data.length<3)continue;const head=data[0]||[],subhead=data[1]||[];const isExpected=/evaluation/i.test(sn);if(!isExpected){badSheets.push(sn);continue;}for(let r=2;r<data.length;r++){const line=data[r],mat=emMat(line[0]);if(!mat)continue;const st=emFindStudent(mat);for(let c=3;c<head.length;c++){const rawSub=head[c]||head[c-1];if(!rawSub)continue;const subject=emFindSubject(rawSub);const kind=emNorm(subhead[c]||"");const type=(/perfectionnement/.test(kind)?"Perfectionnement":"Note obtenue")+" — "+sn;const note=emNumber(line[c]);if(note===null)continue;rows.push({matricule:mat,student:st,matter:subject,type,note,period,level,sheet:sn});}}}
  }
  const valid=rows.filter(x=>x.student&&x.matter&&x.note>=0&&x.note<=20);const missingStudents=rows.filter(x=>!x.student).length,missingSubjects=rows.filter(x=>!x.matter).length,invalid=rows.filter(x=>x.note<0||x.note>20).length;
  const existingIds=[...new Set(valid.map(x=>x.student.id))],subjectIds=[...new Set(valid.map(x=>x.matter.id))];let existing=[];
  if(existingIds.length&&subjectIds.length){const {data,error}=await supabaseClient.from("notes").select("eleve_id,matiere_id,type_evaluation,periode").eq("etablissement_id",activeSiteId).eq("periode",period).in("eleve_id",existingIds).in("matiere_id",subjectIds);if(error)throw error;existing=data||[];}
  const keys=new Set(existing.map(x=>[x.eleve_id,x.matiere_id,emNorm(x.type_evaluation),x.periode].join("|")));const seen=new Set();
  emPendingImport=valid.filter(x=>{const k=[x.student.id,x.matter.id,emNorm(x.type),period].join("|");if(keys.has(k)||seen.has(k)){x.duplicate=true;return false;}seen.add(k);return true;});
  emImportStats={total:rows.length,ready:emPendingImport.length,missingStudents,missingSubjects,invalid,duplicates:valid.length-emPendingImport.length,badSheets};
  const preview=emPendingImport.slice(0,12).map(x=>`<tr><td>${esc(x.matricule)}</td><td>${esc(x.student.name)}</td><td>${esc(x.matter.nom)}</td><td>${esc(x.type)}</td><td>${x.note}</td></tr>`).join("");
  document.getElementById("emPreview").innerHTML=`<div class="cards">${stat("Lignes lues",emImportStats.total)}${stat("Prêtes à importer",emImportStats.ready)}${stat("Doublons ignorés",emImportStats.duplicates)}${stat("Élèves / matières inconnus",emImportStats.missingStudents+emImportStats.missingSubjects)}</div><p class="muted">${emImportStats.invalid} note(s) hors barème ignorée(s). ${badSheets.length?"Feuilles non reconnues : "+badSheets.map(esc).join(", "):"Toutes les feuilles ont été analysées."}</p><div class="table-wrap"><table class="table"><thead><tr><th>Matricule</th><th>Apprenant</th><th>Matière</th><th>Évaluation</th><th>Note</th></tr></thead><tbody>${preview||'<tr><td colspan="5">Aucune note prête à importer.</td></tr>'}</tbody></table></div><p class="muted">Aperçu limité aux 12 premières lignes. Le bouton valide uniquement les lignes prêtes.</p>`;
  document.getElementById("emApplyBtn").disabled=!emPendingImport.length;
 }catch(e){console.error(e);document.getElementById("emPreview").innerHTML=`<div class="notice">Lecture impossible : ${esc(e.message||e)}</div>`;document.getElementById("emApplyBtn").disabled=true;emPendingImport=[];}
}
async function applyEducMasterImport(){
 if(!emPendingImport.length)return alert("Aucune note prête à importer.");
 if(!confirm(`Importer ${emPendingImport.length} note(s) dans ${db.classes.find(c=>Number(c.id)===Number(val("emClass")))?.name||"la classe"} pour ${val("emPeriod")} ? Les notes existantes ne seront pas écrasées.`))return;
 const payload=emPendingImport.map(x=>({eleve_id:Number(x.student.id),matiere_id:Number(x.matter.id),note:x.note,type_evaluation:x.type,periode:x.period,etablissement_id:activeSiteId,coefficient_applique:Number(x.matter.coefficient)||1,observation:"Import EducMaster — "+x.sheet}));
 for(let i=0;i<payload.length;i+=100){const {error}=await supabaseClient.from("notes").insert(payload.slice(i,i+100));if(error){notifyError("Import EducMaster interrompu après "+i+" lignes",error);return;}}
 const count=payload.length;emPendingImport=[];await loadLiveData();showPage("educmaster");alert(count+" note(s) importée(s). Les doublons et les correspondances manquantes ont été ignorés.");
}
function exportEducMasterWorkbook(){
 if(!window.XLSX)return alert("Le module Excel n’est pas chargé.");const level=val("emLevel"),classId=Number(val("emClass")),period=val("emPeriod"),cls=db.classes.find(c=>Number(c.id)===classId);if(!cls)return alert("Choisissez une classe.");
 const students=db.students.filter(s=>Number(s.classId)===classId).sort((a,b)=>a.name.localeCompare(b.name,"fr"));if(!students.length)return alert("Aucun élève dans cette classe.");const wb=XLSX.utils.book_new();
 if(level==="college"){
  const selectedSubjects=liveSubjects;
  selectedSubjects.forEach(m=>{const data=[["Matricule","Nom","Prénoms","Moy. interro","Devoir 1","Devoir 2"],...students.map(s=>{const find=t=>db.grades.find(g=>Number(g.studentId)===Number(s.id)&&Number(g.matterId)===Number(m.id)&&g.period===period&&emNorm(g.type)===emNorm(t))?.note;return [s.educmasterId||"",s.lastName||s.name,s.firstName||"",find("Moyenne d’interrogation")??"",find("Premier devoir")??"",find("Deuxième devoir")??""];})];XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),m.nom.slice(0,31));});
 }else{
  const evals=["Évaluation formative 1","Évaluation sommative 1","Évaluation sommative 2","Évaluation sommative 3"];
  evals.forEach(ev=>{const headers=["Matricule","Nom","Prénoms"],sub=["","",""];liveSubjects.forEach(m=>{headers.push(m.nom,"");sub.push("Note obtenue","Note perfectionnement")});const data=[headers,sub,...students.map(s=>{const row=[s.educmasterId||"",s.lastName||s.name,s.firstName||""];liveSubjects.forEach(m=>{const find=t=>db.grades.find(g=>Number(g.studentId)===Number(s.id)&&Number(g.matterId)===Number(m.id)&&g.period===period&&emNorm(g.type)===emNorm(t+" — "+ev))?.note;row.push(find("Note obtenue")??"",find("Perfectionnement")??"")});return row;})];XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(data),ev.slice(0,31));});
 }
 XLSX.writeFile(wb,`LA_REFERENCE_EDUCMASTER_${level}_${cls.name.replace(/[^a-z0-9]/gi,"_")}_${period.replace(/\s/g,"_")}.xlsx`);
}

async function saveEducMaster(){
 if(!liveMode||!activeSiteId)return alert("Connexion requise.");
 const payload={educmaster_primaire_url:val("emPrimary").trim()||null,educmaster_secondaire_url:val("emSecondary").trim()||null};
 const {error}=await supabaseClient.from("etablissements").update(payload).eq("id",activeSiteId);
 if(error){notifyError("Enregistrement des paramètres EducMaster",error);return;}
 db.educmaster.primaryUrl=payload.educmaster_primaire_url||"";db.educmaster.secondaryUrl=payload.educmaster_secondaire_url||"";save();
 await loadLiveData();showPage("educmaster");alert("Paramètres EducMaster enregistrés dans Supabase pour cet établissement.");
}
function exportEducMaster(level){const el=document.getElementById("emLevel");if(el)el.value=level==="primaire"?"primaire":"college";exportEducMasterWorkbook();}

/* --- Couche de fonctionnement réel LA RÉFÉRENCE --- */
let activeSiteId=null;
let liveSites=[];
let liveSubjects=[];
let liveClassSubjects=[];
let liveYears=[];
let liveTeacherAssignments=[];
let liveGroups=[];
let liveTariffs=[];
let liveStudentSchedules=[];
let liveStudentParentLinks=[];
let liveReceipts=[];
let liveVersements=[];
let liveDerogations=[];
let liveHR={personnel:[],contrats:[],vacations:[],paies:[],avances:[],absences:[],candidatures:[],documents:[]};
let liveTimetable=[];
let editingRecord=null;
function currentSite(){return liveSites.find(s=>s.id===activeSiteId)||liveSites[0]||null}
function studentName(id){const st=db.students.find(s=>String(s.id)===String(id));return st?.name||"Élève non trouvé"}
function notifyError(label,error){console.error(label,error);alert(label+" : "+(error?.message||"opération impossible"))}
async function loadLiveData(){
 const [profileRes,sitesRes]=await Promise.all([
  supabaseClient.from("profiles").select("id,nom,prenom,email,role,actif").maybeSingle(),
  supabaseClient.from("utilisateur_etablissements").select("etablissement_id,role,actif,etablissements(id,code,nom,adresse,telephone,directeur,educmaster_primaire_url,educmaster_secondaire_url)").eq("actif",true)
 ]);
 if(profileRes.error)throw profileRes.error;
 currentProfile=profileRes.data;
 if(!currentProfile||!currentProfile.actif)throw new Error("Profil utilisateur absent ou désactivé.");
 if(sitesRes.error)throw sitesRes.error;
 if(currentProfile.role==="parent"){
  const {data:portal,error:portalError}=await supabaseClient.rpc("portail_parent_donnees");
  if(portalError)throw portalError;
  liveParentPortal=portal||{parent:null,enfants:[]};
  liveSites=[];activeSiteId=null;db.students=[];db.parents=[];db.teachers=[];db.classes=[];
  return;
 }
 liveParentPortal=null;
 liveSites=sitesRes.data.map(x=>x.etablissements).filter(Boolean);
 if(!liveSites.length)throw new Error("Aucun établissement n'est associé à ce compte.");
 if(!activeSiteId||!liveSites.some(s=>s.id===activeSiteId))activeSiteId=liveSites[0].id;
 const site=activeSiteId;
 const queries=await Promise.all([
  supabaseClient.from("eleves").select("id,matricule,numero_educmaster,nom,prenoms,sexe,date_naissance,lieu_naissance,nationalite,adresse,telephone,email,photo_url,statut,classe_id,groupe_pedagogique_id,etablissement_id").eq("etablissement_id",site).order("nom"),
  supabaseClient.from("classes").select("id,nom,niveau,serie,annee_scolaire_id,etablissement_id").eq("etablissement_id",site).order("nom"),
  supabaseClient.from("enseignants").select("id,matricule,nom,prenoms,specialite,telephone,statut,etablissement_id").eq("etablissement_id",site).order("nom"),
  supabaseClient.from("paiements").select("id,eleve_id,libelle,montant_du,montant_paye,date_paiement,mode_paiement,reference,observation,etablissement_id").eq("etablissement_id",site).order("date_paiement",{ascending:false}),
  supabaseClient.from("notes").select("id,eleve_id,matiere_id,note,type_evaluation,periode,annee_scolaire_id,coefficient_applique,etablissement_id,created_at").eq("etablissement_id",site).order("created_at",{ascending:false}),
  supabaseClient.from("presences").select("id,eleve_id,date_presence,statut,motif,etablissement_id").eq("etablissement_id",site).order("date_presence",{ascending:false}),
  supabaseClient.from("parents").select("id,nom,prenoms,telephone,email,etablissement_id").eq("etablissement_id",site).order("nom"),
  supabaseClient.from("matieres").select("id,nom,code,coefficient").eq("etablissement_id",site).order("nom"),
  supabaseClient.from("groupes_pedagogiques").select("id,classe_id,nom,annee_scolaire_id,actif,etablissement_id").eq("etablissement_id",site).eq("actif",true).order("nom"),
  supabaseClient.from("grilles_tarifaires").select("id,code_niveau,libelle,frais_inscription_assurance,frais_td,frais_photocopie_td,ecolage_annuel,frais_photocopie_support_tranche,valide,echeances_tarifaires(numero_tranche,date_echeance,montant)").eq("etablissement_id",site).order("libelle"),
  supabaseClient.from("v_sanctions_financieres").select("*").eq("etablissement_id",site).order("numero_tranche"),
  supabaseClient.from("encaissements").select("id,echeance_eleve_id,eleve_id,montant,date_encaissement,mode_paiement,reference_recu,reference_externe,observation,annule,motif_annulation,caissier_nom").eq("etablissement_id",site).order("date_encaissement",{ascending:false}),
  supabaseClient.from("derogations_paiement").select("id,eleve_id,tranche_concernee,type_derogation,motif,date_debut,date_fin,statut,created_at").eq("etablissement_id",site).order("created_at",{ascending:false}),
  supabaseClient.from("personnel").select("id,matricule,nom,prenoms,telephone,email,fonction,date_recrutement,statut,mode_remuneration").eq("etablissement_id",site).order("nom"),
  supabaseClient.from("contrats_personnel").select("id,personnel_id,type_contrat,date_debut,date_fin,salaire_base,devise,actif").eq("etablissement_id",site).order("date_debut",{ascending:false}),
  supabaseClient.from("prestations_vacations").select("id,personnel_id,date_prestation,description,quantite,unite,tarif_unitaire,montant_total,statut").eq("etablissement_id",site).order("date_prestation",{ascending:false}),
  supabaseClient.from("paies_personnel").select("id,personnel_id,periode,salaire_base,total_primes,total_vacations,total_retenues,net_a_payer,montant_paye,date_paiement,statut,reference").eq("etablissement_id",site).order("periode",{ascending:false}),
  supabaseClient.from("avances_prets_personnel").select("id,personnel_id,type_operation,montant_initial,montant_restant,date_accord,mensualite_prevue,motif,statut").eq("etablissement_id",site).order("date_accord",{ascending:false}),
  supabaseClient.from("absences_personnel").select("id,personnel_id,type_absence,date_debut,date_fin,motif,statut,created_at").eq("etablissement_id",site).order("date_debut",{ascending:false}),
  supabaseClient.from("candidatures_personnel").select("id,nom,prenoms,telephone,email,poste_souhaite,statut,experience,created_at").eq("etablissement_id",site).order("created_at",{ascending:false}),
  supabaseClient.from("documents_administratifs").select("id,type_document,personnel_id,objet,date_document,numero_document").eq("etablissement_id",site).order("date_document",{ascending:false}),
  supabaseClient.from("emplois_temps").select("id,classe_id,jour,heure_debut,heure_fin,matiere_id,enseignant_id,salle").eq("etablissement_id",site).order("jour").order("heure_debut"),
  supabaseClient.from("eleves_parents").select("eleve_id,parent_id,lien,parents(nom,prenoms,telephone,email)").eq("etablissement_id",site)
 ]);
 const [classSubjectsRes,yearsRes,teacherAssignmentsRes]=await Promise.all([
  supabaseClient.from("classes_matieres").select("id,classe_id,matiere_id,annee_scolaire_id,coefficient,actif,etablissement_id").eq("etablissement_id",site).eq("actif",true),
  supabaseClient.from("annees_scolaires").select("id,libelle,active,etablissement_id").eq("etablissement_id",site).order("libelle",{ascending:false}),
  supabaseClient.from("affectations").select("id,enseignant_id,matiere_id,classe_id,annee_scolaire_id,etablissement_id").eq("etablissement_id",site)
 ]);
 const groupedReceiptsRes=await supabaseClient.from("versements_eleves").select("id,reference_recu,eleve_id,etablissement_id,montant_recu,credit_utilise,surplus_credite,credit_disponible_apres,mode_paiement,reference_externe,observation,created_at,annule,annule_le,motif_annulation,caissier_nom,versements_affectations(source,encaissements(id,echeance_eleve_id,montant,annule,motif_annulation))").eq("etablissement_id",site).order("created_at",{ascending:false});
 if(groupedReceiptsRes.error && !/does not exist|schema cache/i.test(groupedReceiptsRes.error.message)) console.warn("Historique des reçus groupés indisponible:",groupedReceiptsRes.error.message);
 const labels=["Élèves","Classes","Enseignants","Paiements","Notes","Présences","Parents","Matières","Groupes pédagogiques","Grilles tarifaires","Échéanciers élèves","Encaissements","Dérogations de paiement","Personnel","Contrats","Vacations","Paies","Avances et prêts","Absences du personnel","Candidatures","Documents administratifs","Emplois du temps","Liens parents-élèves"];
 const critical=[0,1];
 const failed=queries.map((r,i)=>r.error?{i,label:labels[i],message:r.error.message}:null).filter(Boolean);
 const financeRoles=["administrateur_general","administrateur","direction","directeur","secretariat","secretaire","comptable"];
 const canSeeFinance=financeRoles.includes(currentProfile?.role)||sitesRes.data.some(x=>financeRoles.includes(x.role));
 const financeCritical=[9,10,11,12];
 const blocking=failed.filter(x=>critical.includes(x.i)||(canSeeFinance&&financeCritical.includes(x.i)));
 if(canSeeFinance&&groupedReceiptsRes.error)blocking.push({label:"Historique des reçus groupés",message:groupedReceiptsRes.error.message});
 failed.filter(x=>!blocking.some(b=>b.i===x.i)).forEach(x=>console.warn("Module non accessible pour ce rôle — "+x.label+": "+x.message));
 if(blocking.length)throw new Error("Chargement des données indispensables impossible — "+blocking.map(x=>x.label+": "+x.message).join(" | "));
 const valData=i=>queries[i].error?[]:(queries[i].data||[]);
 db.establishments=liveSites;
 liveSubjects=valData(7);
 liveClassSubjects=classSubjectsRes.error?[]:(classSubjectsRes.data||[]);
 liveYears=yearsRes.error?[]:(yearsRes.data||[]);
 liveTeacherAssignments=teacherAssignmentsRes.error?[]:(teacherAssignmentsRes.data||[]);
 db.classes=valData(1).map(x=>({id:x.id,name:x.nom||x.nom_classe||x.libelle||("Classe sans nom #"+x.id),level:x.niveau,series:x.serie,establishment:x.etablissement_id}));
 const classRank=c=>{const n=String(c.name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');if(n.includes('matern')||/petite|moyenne|grande section/.test(n))return [0,n];if(/\b(ci|cp|ce1|ce2|cm1|cm2)\b/.test(n))return [1,n];if(/6e|6eme|5e|5eme|4e|4eme|3e|3eme/.test(n))return [2,n];if(/2nde|seconde|1ere|premiere|tle|terminal/.test(n))return [3,n];return [4,n]};
 db.classes.sort((a,b)=>{const x=classRank(a),y=classRank(b);return x[0]-y[0]||x[1].localeCompare(y[1],'fr',{numeric:true})});
 liveGroups=valData(8);
 liveTariffs=valData(9);
 liveStudentSchedules=valData(10);
 liveHR={personnel:valData(13),contrats:valData(14),vacations:valData(15),paies:valData(16),avances:valData(17),absences:valData(18),candidatures:valData(19),documents:valData(20)};
 liveTimetable=valData(21);
 liveStudentParentLinks=valData(22);
 db.students=valData(0).map(x=>({id:x.id,lastName:x.nom,firstName:x.prenoms,name:[x.nom,x.prenoms].filter(Boolean).join(" "),class:(db.classes.find(c=>String(c.id)===String(x.classe_id))?.name||""),classId:x.classe_id,groupId:x.groupe_pedagogique_id,group:(liveGroups.find(g=>String(g.id)===String(x.groupe_pedagogique_id))?.nom||""),birthDate:x.date_naissance,birthPlace:x.lieu_naissance,nationality:x.nationalite,registrationDate:x.date_inscription,sex:x.sexe,phone:x.telephone,email:x.email,address:x.adresse,status:x.statut,educmasterId:x.numero_educmaster,optionEcrit:x.option_ecrit,photo_url:x.photo_url,establishment:x.etablissement_id,matricule:x.matricule}));
 liveReceipts=valData(11).map(x=>({...x,student:studentName(x.eleve_id)}));
 liveVersements=(groupedReceiptsRes.data||[]).map(x=>({...x,student:studentName(x.eleve_id)}));
 liveDerogations=valData(12).map(x=>({...x,student:studentName(x.eleve_id)}));
 db.teachers=valData(2).map(x=>({id:x.id,matricule:x.matricule||"",name:[x.nom,x.prenoms].filter(Boolean).join(" "),subject:x.specialite,phone:x.telephone,establishment:x.etablissement_id}));
 const subjectName=id=>{const m=liveSubjects.find(s=>String(s.id)===String(id));return m?.nom||""};
 db.payments=valData(3).map(x=>({id:x.id,student:studentName(x.eleve_id),studentId:x.eleve_id,amount:x.montant_paye,date:x.date_paiement,reason:x.libelle,paid:x.montant_paye,due:x.montant_du,mode:x.mode_paiement,reference:x.reference,observation:x.observation,establishment:x.etablissement_id}));
 db.grades=valData(4).map(x=>({id:x.id,studentId:x.eleve_id,matterId:x.matiere_id,yearId:x.annee_scolaire_id,student:studentName(x.eleve_id),matter:subjectName(x.matiere_id),note:x.note,type:x.type_evaluation||'',coeff:x.coefficient_applique||1,period:x.periode,observation:x.observation||''}));
 db.attendance=valData(5).map(x=>({id:x.id,studentId:x.eleve_id,student:studentName(x.eleve_id),date:x.date_presence,state:x.statut,reason:x.motif}));
 db.parents=valData(6).map(x=>({id:x.id,name:[x.nom,x.prenoms].filter(Boolean).join(" "),phone:x.telephone,email:x.email}));
 liveSubjects=valData(7);save();
 const top=document.querySelector(".topbar");
 if(top){let bar=document.getElementById("siteSelector");if(!bar){bar=document.createElement("label");bar.id="siteSelector";bar.style.cssText="margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px";top.appendChild(bar)}bar.innerHTML='Établissement <select id="activeSite" style="max-width:210px;padding:7px;border:1px solid #ccd5e2;border-radius:8px">'+liveSites.map(s=>`<option value="${esc(s.id)}" ${s.id===activeSiteId?'selected':''}>${esc(s.code+" · "+s.nom.replace("GROUPE SCOLAIRE LA RÉFÉRENCE — ",""))}</option>`).join("")+'</select>';document.getElementById("activeSite").onchange=async e=>{activeSiteId=e.target.value;try{await loadLiveData();showPage("dashboard")}catch(err){notifyError("Chargement du site",err)}}}
}
function toggleLoginFields(){
 const admin=val("loginRole")==="administrateur_general";
 const parent=val("loginRole")==="parent";
 document.getElementById("adminLoginFields").classList.toggle("hidden",!admin);
 document.getElementById("staffLoginFields").classList.toggle("hidden",admin);
 document.getElementById("loginUser").classList.toggle("hidden",parent);
 document.getElementById("loginFirstName").classList.toggle("hidden",parent);
 document.getElementById("loginParentPhone")?.classList.toggle("hidden",!parent);
}
async function submitTemporaryPasswordChange(){
 const p1=val("forcedNewPassword"),p2=val("forcedNewPasswordConfirm"),feedback=document.getElementById("forcedPasswordFeedback");
 if(p1.length<8){feedback.textContent="Le nouveau mot de passe doit contenir au moins 8 caractères.";return;}
 if(p1!==p2){feedback.textContent="Les deux mots de passe ne correspondent pas.";return;}
 feedback.textContent="Enregistrement du nouveau mot de passe…";
 const {data,error}=await supabaseClient.functions.invoke("manage-access",{body:{action:"change_own_password",password:p1}});
 if(error||data?.error){feedback.textContent="Échec : "+(data?.error||error?.message||"erreur inconnue");return;}
 document.getElementById("login").classList.add("hidden");document.getElementById("app").classList.remove("hidden");
 const userLabel=document.querySelector(".topbar .user");if(userLabel)userLabel.textContent="👤 "+[currentProfile?.prenom,currentProfile?.nom].filter(Boolean).join(" ");
 showPage("dashboard");
}
async function login(){
 if(!supabaseClient){alert("Connexion impossible : le service Supabase ne s'est pas chargé.");return}
 const selectedRole=val("loginRole"),isAdmin=selectedRole==="administrateur_general",isParent=selectedRole==="parent";
 const btn=document.querySelector(".login-card button");btn.disabled=true;btn.textContent="Connexion...";
 try{
  let mustChangePassword=false;
  if(isAdmin){
   const email=val("loginEmail").trim().toLowerCase(),password=val("adminPass");
   if(!email||!password)throw new Error("Saisissez votre adresse e-mail et votre mot de passe administrateur.");
   const {error}=await supabaseClient.auth.signInWithPassword({email,password});if(error)throw error;
  }else{
   const nom=val("loginUser").trim(),prenom=val("loginFirstName").trim(),password=val("loginPass"),telephone=val("loginParentPhone")?.trim()||"";
   if(!password||(isParent?!telephone:(!nom||!prenom)))throw new Error(isParent?"Saisissez votre numéro de téléphone et votre mot de passe.":"Saisissez votre nom, votre prénom et votre mot de passe.");
   const {data,error}=await supabaseClient.functions.invoke("login-by-name",{body:isParent?{role:"parent",telephone,password}:{nom,prenom,password,role:selectedRole}});
   if(error||data?.error)throw new Error(data?.error||error?.message||"Connexion impossible.");
   mustChangePassword=data.must_change_password===true;
   const {error:sessionError}=await supabaseClient.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});if(sessionError)throw sessionError;
  }
  liveMode=true;await loadLiveData();
  if(!currentProfile?.actif)throw new Error("Ce compte est désactivé. Contactez l'administration.");
  const roleAliases={administrateur_general:["administrateur_general"],direction:["direction","directeur"],censeur:["censeur"],surveillant:["surveillant"],secretariat_caisse:["secretariat","secretaire","comptable","caissier"],parent:["parent"]};
  if(!(roleAliases[selectedRole]||[]).includes(currentProfile.role)){
   await supabaseClient.auth.signOut();currentProfile=null;liveMode=false;
   throw new Error("Ce compte n'est pas autorisé pour la fonction choisie. Vérifiez votre fonction ou contactez l'administrateur.");
  }
  if(mustChangePassword){
   document.getElementById("login").classList.remove("hidden");document.getElementById("app").classList.add("hidden");
   document.querySelector(".login-card").innerHTML=`<div class="brand-mark">LR</div><h1>LA RÉFÉRENCE</h1><h3>Créer votre nouveau mot de passe</h3><p>Votre ancien mot de passe provisoire ne sera plus valable après cette étape.</p><input id="forcedNewPassword" type="password" autocomplete="new-password" placeholder="Nouveau mot de passe (8 caractères minimum)"><input id="forcedNewPasswordConfirm" type="password" autocomplete="new-password" placeholder="Confirmer le nouveau mot de passe"><button onclick="submitTemporaryPasswordChange()">Enregistrer mon nouveau mot de passe</button><p class="muted" id="forcedPasswordFeedback" aria-live="polite"></p>`;
   return;
  }
  document.getElementById("login").classList.add("hidden");document.getElementById("app").classList.remove("hidden");
  const userLabel=document.querySelector(".topbar .user");if(userLabel)userLabel.textContent="👤 "+[currentProfile.prenom,currentProfile.nom].filter(Boolean).join(" ");
  showPage("dashboard");
 }catch(e){notifyError("Connexion",e);await supabaseClient.auth.signOut()}
 finally{btn.disabled=false;btn.textContent="Se connecter"}
}

function openForm(type){
 editingRecord={type,id:null};if(type==="student")window.studentPhotoData=null;
 const siteOpts=liveSites.map(s=>`<option value="${esc(s.id)}" ${s.id===activeSiteId?'selected':''}>${esc(s.code+" — "+s.nom)}</option>`).join("");
 const studentOpts=db.students.map(s=>`<option value="${s.id}">${esc(s.name+" · "+s.matricule)}</option>`).join("");
 const classOpts=db.classes.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
 const subjectOpts=liveSubjects.map(s=>`<option value="${s.id}">${esc(s.nom)}</option>`).join("");
 const fields={
 student:["Inscrire un élève",`<div class="form-grid"><label>Nom<input id="f_last" required></label><label>Prénoms<input id="f_first" required></label><label>Sexe<select id="f_sex"><option value="M">Masculin</option><option value="F">Féminin</option></select></label><label>Date de naissance<input id="f_birth" type="date"></label><label>Lieu de naissance<input id="f_birthplace"></label><label>Nationalité<input id="f_nationality" value="Béninoise"></label><label>Téléphone<input id="f_phone" inputmode="tel"></label><label>Email<input id="f_email" type="email"></label><label class="full">Adresse<input id="f_address"></label><label>Nom du parent / tuteur<input id="f_parent_last" placeholder="Nom du parent"></label><label>Prénoms du parent / tuteur<input id="f_parent_first" placeholder="Prénoms du parent"></label><label>Téléphone du parent<input id="f_parent_phone" inputmode="tel" placeholder="+229…"></label><label>Email du parent<input id="f_parent_email" type="email" placeholder="parent@exemple.com"></label><label>Lien avec l’apprenant<select id="f_parent_link"><option value="Père">Père</option><option value="Mère">Mère</option><option value="Tuteur">Tuteur</option><option value="Autre">Autre</option></select></label><label>Numéro ÉducMaster<input id="f_educ" placeholder="À importer ultérieurement"></label><label>Classe actuelle<select id="f_class" onchange="refreshStudentGroups()"><option value="">Sans classe</option>${classOpts}</select><small>Le changement de classe modifie l'affectation actuelle de l'élève sans supprimer son dossier.</small></label><label>Groupe pédagogique<select id="f_group"><option value="">Choisir après la classe</option></select></label><label>Établissement<select id="f_site">${siteOpts}</select></label><label>Montant payé à l’inscription — scolarité (FCFA)<input id="f_registration_amount" type="number" min="0" step="1" value="0"><small>Facultatif. Ce montant concerne uniquement la contribution scolaire.</small></label><label>Photocopies / supports payés à l’inscription (FCFA)<input id="f_registration_support_amount" type="number" min="0" step="1" value="0" placeholder="Ex. 500, 1 000 ou 3 500"><small>Facultatif et séparé de la contribution. Saisir le montant réellement reçu (500 FCFA ou davantage, dans la limite du solde photocopies).</small></label><label>Mode de paiement à l’inscription<select id="f_registration_mode"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option><option>Autre</option></select></label><label class="full">Photo de l’élève<input id="f_photo" type="file" accept="image/*" onchange="readStudentPhoto(this)"><small>Photo compressée pour le dossier, le bulletin et la carte scolaire.</small></label></div>`],
 teacher:["Ajouter un enseignant",`<div class="form-grid"><label>Matricule enseignant<input id="f_teacher_matricule" placeholder="Ex. ENS-2026-001" required></label><label>Nom<input id="f_last" required></label><label>Prénoms<input id="f_first" required></label><label>Spécialité / matière<input id="f_subject"></label><label>Téléphone<input id="f_phone"></label><label>Établissement<select id="f_site">${siteOpts}</select></label></div>`],
 class:["Créer une classe",`<div class="form-grid"><label>Nom de la classe<input id="f_name" placeholder="Ex. 6ème A" required></label><label>Niveau<input id="f_level" placeholder="Collège / Primaire"></label><label>Série<input id="f_series"></label><label>Établissement<select id="f_site">${siteOpts}</select></label></div>`],
 parent:["Ajouter un parent",`<div class="form-grid"><label>Nom<input id="f_last" required></label><label>Prénoms<input id="f_first" required></label><label>Téléphone<input id="f_phone"></label><label>Email<input id="f_email" type="email"></label><label>Établissement<select id="f_site">${siteOpts}</select></label></div>`],
 payment:["Enregistrer un frais ou un paiement",`<div class="form-grid"><label>Élève<select id="f_student" required onchange="applyStudentTariff()">${studentOpts}</select></label><label>Catégorie de frais<select id="f_fee_category"><option value="Scolarité">Frais de scolarité</option><option value="Carte scolaire">Frais de carte scolaire</option><option value="Dossier d’examen">Frais de dossier d’examen</option><option value="Support de cours">Frais de support de cours</option><option value="Autres frais">Autres frais</option></select></label><label>Tranche / échéance<select id="f_tranche" onchange="applyStudentTariff()"><option value="1ère tranche">1ère tranche · à l’inscription</option><option value="2ème tranche">2ème tranche · 30/10/2026</option><option value="3ème tranche">3ème tranche · 30/11/2026</option><option value="4ème tranche">4ème tranche · 31/12/2026</option><option value="5ème tranche">5ème tranche · 31/01/2027</option><option value="6ème tranche">6ème tranche · 28/02/2027</option><option value="7ème tranche">7ème tranche · 30/03/2027</option><option value="Paiement global">Paiement global</option></select></label><label>Montant total dû (FCFA)<input id="f_due" type="number" min="0" value="0" required></label><label>Montant versé maintenant (FCFA)<input id="f_amount" type="number" min="0" value="0" required></label><label>Date<input id="f_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>Mode de paiement<select id="f_mode"><option>Espèces</option><option>Mobile Money</option><option>Virement</option><option>Chèque</option></select></label><label class="full">Observation<textarea id="f_observation" rows="2" placeholder="Précision facultative"></textarea></label></div>`],
 grade:["Saisir une note",`<div class="form-grid"><label>Élève<select id="f_student" required>${studentOpts}</select></label><label>Matière<select id="f_matter" required>${subjectOpts}</select></label><label>Note /20<input id="f_note" type="number" min="0" max="20" step="0.25" required></label><label>Type<input id="f_type" placeholder="Interrogation / Devoir / Composition"></label><label>Période<select id="f_period"><option>1er trimestre</option><option>2e trimestre</option><option>3e trimestre</option></select></label></div>`],
 attendance:["Enregistrer une présence",`<div class="form-grid"><label>Élève<select id="f_student" required>${studentOpts}</select></label><label>Date<input id="f_date" type="date" value="${new Date().toISOString().slice(0,10)}"></label><label>État<select id="f_state"><option value="present">Présent</option><option value="absent">Absent</option><option value="retard">Retard</option><option value="justifie">Absence justifiée</option></select></label><label>Motif<input id="f_reason"></label></div>`]
 };
 const [title,body]=fields[type]||[];if(!title){alert("Formulaire non disponible.");return}document.getElementById("modalTitle").textContent=title;document.getElementById("modalBody").innerHTML=body+`<button class="btn primary" onclick="saveForm('${type}')">Enregistrer</button>`;document.getElementById("modal").classList.remove("hidden");if(type==="payment")applyStudentTariff();
}
function tariffCodeForStudent(st){
 const cls=db.classes.find(x=>String(x.id)===String(st?.classId));
 const name=String(st?.class||cls?.name||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 const series=String(st?.series||cls?.series||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
 const level=String(st?.level||cls?.level||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
 if(/matern|petite section|moyenne section|grande section/.test(name)||level.includes("matern"))return "MATERNELLE";
 if(/\bci\b|\bcp\b/.test(name))return "CI-CP";
 if(/\bce1\b|\bce2\b/.test(name))return "CE1-CE2";
 if(/\bcm1\b|\bcm2\b/.test(name))return "CM1-CM2";
 if(/6e|6eme/.test(name))return "6EME";if(/5e|5eme/.test(name))return "5EME";if(/4e|4eme/.test(name))return "4EME";if(/3e|3eme/.test(name))return "3EME";
 if(/2nde|seconde/.test(name))return ["G1","G2","G3"].includes(series)||/^G[123]$/.test(series)?"2NDE-G1-G3":"2NDE-ABCD";
 if(/1ere|premiere/.test(name))return ["C","G1","G2","G3"].includes(series)?"1ERE-C-G1-G3":"1ERE-ABD-G2";
 if(/tle|terminal/.test(name))return ["C","G1","G3"].includes(series)?"TLE-C-G1-G3":"TLE-ABD-G2";
 return null;
}
function applyStudentTariff(){
 const studentId=val("f_student"),trancheLabel=val("f_tranche");const st=db.students.find(x=>String(x.id)===String(studentId));const code=tariffCodeForStudent(st);const tariff=liveTariffs.find(x=>x.code_niveau===code);const due=document.getElementById("f_due");if(!due||!tariff)return;
 const n=parseInt(String(trancheLabel).match(/[1-7]/)?.[0]||"1",10);const e=(tariff.echeances_tarifaires||[]).find(x=>Number(x.numero_tranche)===n);if(e)due.value=Number(e.montant);
}
function openEdit(type,id){
 const map={student:db.students,teacher:db.teachers,class:db.classes,parent:db.parents,payment:db.payments,grade:db.grades,attendance:db.attendance};
 const x=(map[type]||[]).find(v=>String(v.id)===String(id));if(!x){alert("Enregistrement introuvable.");return;}
 editingRecord={type,id:x.id};
 const siteOpts=liveSites.map(s=>`<option value="${esc(s.id)}" ${s.id===(x.establishment||activeSiteId)?'selected':''}>${esc(s.code+" — "+s.nom)}</option>`).join("");
 const studentOpts=db.students.map(s=>`<option value="${s.id}" ${String(s.id)===String(x.studentId)?'selected':''}>${esc(s.name+" · "+(s.matricule||""))}</option>`).join("");
 const classOpts=db.classes.map(c=>`<option value="${c.id}" ${String(c.id)===String(x.classId)?'selected':''}>${esc(c.name||c.level||"Classe sans nom")}</option>`).join("");
 const groupOpts=liveGroups.filter(g=>String(g.classe_id)===String(x.classId)).map(g=>`<option value="${g.id}" ${String(g.id)===String(x.groupId)?'selected':''}>${esc(g.nom)}</option>`).join("");
 let title="Modifier" ,body="";
 if(type==="student"){title="Modifier le dossier et l'inscription de l'apprenant";body=`<p class="muted">Vous pouvez modifier les informations personnelles, la classe, le groupe pédagogique, l'établissement, le statut et le numéro ÉducMaster. Le matricule et l'historique des paiements sont conservés.</p><div class="form-grid"><label>Nom<input id="f_last" value="${esc(x.lastName||x.name||"")}" required></label><label>Prénoms<input id="f_first" value="${esc(x.firstName||"")}" required></label><label>Sexe<select id="f_sex"><option value="M" ${x.sex==="M"?'selected':''}>Masculin</option><option value="F" ${x.sex==="F"?'selected':''}>Féminin</option></select></label><label>Date de naissance<input id="f_birth" type="date" value="${esc(x.birthDate||"")}"></label><label>Lieu de naissance<input id="f_birthplace" value="${esc(x.birthPlace||"")}"></label><label>Nationalité<input id="f_nationality" value="${esc(x.nationality||"Béninoise")}"></label><label>Adresse<input id="f_address" value="${esc(x.address||"")}"></label><label>Email<input id="f_email" type="email" value="${esc(x.email||"")}"></label><label class="full">Photo de l’élève ${x.photo_url?`<img src="${esc(x.photo_url)}" alt="Photo actuelle" style="width:54px;height:64px;object-fit:cover;border-radius:5px;display:block;margin:6px 0">`:""}<input id="f_photo" type="file" accept="image/*" onchange="readStudentPhoto(this)"><small>Laissez vide pour conserver la photo actuelle.</small></label><label>Numéro ÉducMaster<input id="f_educ" value="${esc(x.educmasterId||"")}"></label><label>Téléphone<input id="f_phone" value="${esc(x.phone||"")}"></label><label>Classe<select id="f_class" onchange="refreshStudentGroups()"><option value="">Sans classe</option>${classOpts}</select></label><label>Groupe pédagogique<select id="f_group"><option value="">Aucun groupe</option>${groupOpts}</select></label><label>Établissement<select id="f_site">${siteOpts}</select></label><label>Statut<select id="f_status"><option value="actif" ${x.status==="actif"?'selected':''}>Actif</option><option value="inactif" ${x.status==="inactif"?'selected':''}>Inactif</option></select></label></div>`;}
 else if(type==="class"){title="Modifier la classe";body=`<div class="form-grid"><label>Nom de la classe<input id="f_name" value="${esc(x.name||"")}" required></label><label>Niveau<input id="f_level" value="${esc(x.level||"")}"></label><label>Série<input id="f_series" value="${esc(x.series||"")}"></label><label>Établissement<select id="f_site">${siteOpts}</select></label></div>`;}
 else if(type==="payment"){title="Modifier le frais / paiement";const parts=String(x.reason||"").split(" — ");const cat=parts[0]||"Scolarité",tranche=parts[1]||"Paiement unique";body=`<div class="form-grid"><label>Élève<select id="f_student" required>${studentOpts}</select></label><label>Catégorie<select id="f_fee_category">${["Scolarité","Carte scolaire","Dossier d’examen","Support de cours","Autres frais"].map(v=>`<option ${cat===v?'selected':''}>${v}</option>`).join("")}</select></label><label>Tranche / échéance<select id="f_tranche">${["1ère tranche","2ème tranche","3ème tranche","4ème tranche","5ème tranche","6ème tranche","7ème tranche","Paiement global"].map(v=>`<option ${tranche===v?'selected':''}>${v}</option>`).join("")}</select></label><label>Montant total dû (FCFA)<input id="f_due" type="number" min="0" value="${Number(x.due||0)}"></label><label>Montant versé (FCFA)<input id="f_amount" type="number" min="0" value="${Number(x.paid??x.amount??0)}" required></label><label>Date<input id="f_date" type="date" value="${esc(x.date||"")}"></label><label>Mode<select id="f_mode">${["Espèces","Mobile Money","Virement","Chèque"].map(v=>`<option ${x.mode===v?'selected':''}>${v}</option>`).join("")}</select></label><label class="full">Observation<textarea id="f_observation" rows="2">${esc(x.observation||"")}</textarea></label></div>`;}
 else {alert("La modification de cette rubrique sera ajoutée dans une prochaine mise à jour.");return;}
 document.getElementById("modalTitle").textContent=title;document.getElementById("modalBody").innerHTML=body+`<button class="btn primary" onclick="saveForm('${type}')">Enregistrer les modifications</button>`;document.getElementById("modal").classList.remove("hidden");if(type==="student")refreshStudentGroups(x.groupId);
}
function printReceipt(id){
 const p=db.payments.find(v=>String(v.id)===String(id));if(!p){alert("Paiement introuvable.");return;}
 const st=db.students.find(v=>String(v.id)===String(p.studentId));const site=currentSite();
 const ref=p.reference||("LR-REC-"+String(p.id).padStart(6,"0"));
 const amount=Number(p.paid??p.amount??0),due=Number(p.due||0),balance=Math.max(0,due-amount);
 const w=window.open("","_blank");if(!w){alert("Autorisez les fenêtres contextuelles pour imprimer le reçu.");return;}
 w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu ${esc(ref)}</title><style>@page{size:A4 portrait;margin:5mm}*{box-sizing:border-box}html,body{margin:0;padding:0;font-family:Arial,sans-serif;color:#182233;font-size:9pt;line-height:1.15}.receipt{width:100%;max-width:190mm;margin:0 auto;border:1.5px solid #1d6b3a;padding:6mm}.head{text-align:center;border-bottom:1.5px solid #1d6b3a;padding-bottom:3mm}.head h1{color:#1d6b3a;margin:0;font-size:16pt}.ref{text-align:right;font-weight:bold;margin:5mm 0}table{width:100%;border-collapse:collapse;margin-top:4mm}td{padding:3mm;border-bottom:1px solid #ddd}.total{font-size:16pt;font-weight:bold}.foot{margin-top:12mm;display:flex;justify-content:space-between}@media print{button{display:none!important}.receipt{page-break-inside:avoid;break-inside:avoid}}</style></head><body><div class="receipt"><div class="head"><h1>GROUPE SCOLAIRE LA RÉFÉRENCE</h1><div>${esc(site?.nom||"")}</div><div>${esc(site?.adresse||"")} · ${esc(site?.telephone||"")}</div><h2>REÇU DE PAIEMENT</h2></div><div class="ref">N° ${esc(ref)}</div><table><tr><td>Élève</td><td><b>${esc(st?.name||p.student||"")}</b></td></tr><tr><td>Matricule</td><td>${esc(st?.matricule||"")}</td></tr><tr><td>Motif</td><td>${esc(p.reason||"")}</td></tr><tr><td>Date</td><td>${esc(p.date||"")}</td></tr><tr><td>Mode de paiement</td><td>${esc(p.mode||"")}</td></tr><tr><td>Montant versé</td><td class="total">${amount.toLocaleString("fr-FR")} FCFA</td></tr><tr><td>Montant dû</td><td>${due.toLocaleString("fr-FR")} FCFA</td></tr><tr><td>Solde restant</td><td>${balance.toLocaleString("fr-FR")} FCFA</td></tr></table><div class="foot"><span>Cachet et signature</span><span>Agent : ${esc([currentProfile?.prenom,currentProfile?.nom].filter(Boolean).join(" ")||"Non renseigné")}<br>La comptabilité</span></div><p style="text-align:center;margin-top:30px">Merci pour votre confiance.</p><button onclick="window.print()">Imprimer le reçu</button></div></body></html>`);w.document.close();setTimeout(()=>{try{const d=w.document,el=d.querySelector('.receipt');if(el){const printableHeight=1045;const contentHeight=Math.max(el.scrollHeight,el.getBoundingClientRect().height);const fit=Math.min(1,printableHeight/contentHeight);el.style.zoom=String(fit);el.style.transformOrigin='top left';}w.focus();w.print();}catch(e){try{w.print()}catch(_){}}},650);
}

async function saveForm(type){
 if(!liveMode){alert("Connectez-vous pour enregistrer dans la base officielle.");return}
 const isEdit=!!(editingRecord&&editingRecord.type===type&&editingRecord.id!=null);
 const registrationAmount=type==="student"&&!isEdit?Number(val("f_registration_amount")||0):0;
 const registrationSupportAmount=type==="student"&&!isEdit?Number(val("f_registration_support_amount")||0):0;
 if(type==="student"&&!isEdit&&(!Number.isFinite(registrationAmount)||registrationAmount<0||!Number.isFinite(registrationSupportAmount)||registrationSupportAmount<0)){alert("Les montants de scolarité et de photocopies doivent être positifs ou nuls.");return}
 const registrationMode=type==="student"?val("f_registration_mode")||"Espèces":"Espèces";
 const receiptWindow=type==="student"&&!isEdit&&(registrationAmount>0||registrationSupportAmount>0)?window.open("about:blank","_blank"):null;
 const site=val("f_site")||activeSiteId;let row={},table="";
 const required=(id,label)=>{const v=val(id).trim();if(!v)throw new Error("Le champ « "+label+" » est obligatoire.");return v};
 try{
 if(type==="student"){table="eleves";const full=required("f_last","Nom");row={nom:full,prenoms:required("f_first","Prénoms"),sexe:val("f_sex"),date_naissance:val("f_birth")||null,lieu_naissance:val("f_birthplace")||null,nationalite:val("f_nationality")||null,adresse:val("f_address")||null,email:val("f_email")||null,photo_url:window.studentPhotoData||(isEdit?(db.students.find(s=>String(s.id)===String(editingRecord.id))?.photo_url||null):null),numero_educmaster:val("f_educ")||null,telephone:val("f_phone")||null,classe_id:val("f_class")?Number(val("f_class")):null,groupe_pedagogique_id:val("f_group")?Number(val("f_group")):null,etablissement_id:site,statut:val("f_status")||"actif"};if(!isEdit){const year=String(new Date().getFullYear()).slice(-2);const siteTag=String(site||"SITE").replace(/-/g,"").slice(0,4).toUpperCase();const suffix=(typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID().replace(/-/g,"").slice(0,6):Math.random().toString(36).slice(2,8)).toUpperCase();row.matricule=`LR-${year}-${siteTag}-${suffix}`}}
 if(type==="teacher"){table="enseignants";row={matricule:required("f_teacher_matricule","Matricule enseignant").toUpperCase(),nom:required("f_last","Nom"),prenoms:required("f_first","Prénoms"),specialite:val("f_subject")||null,telephone:val("f_phone")||null,etablissement_id:site,statut:"actif"}}
 if(type==="class"){table="classes";row={nom:required("f_name","Classe"),niveau:val("f_level")||null,serie:val("f_series")||null,etablissement_id:site}}
 if(type==="parent"){table="parents";row={nom:required("f_last","Nom"),prenoms:required("f_first","Prénoms"),telephone:val("f_phone")||null,email:val("f_email")||null,etablissement_id:site}}
 if(type==="payment"){table="paiements";const category=required("f_fee_category","Catégorie de frais"),tranche=required("f_tranche","Tranche / échéance");row={eleve_id:Number(required("f_student","Élève")),libelle:category+" — "+tranche,montant_du:Number(val("f_due")||0),montant_paye:Number(val("f_amount")||0),date_paiement:val("f_date")||null,mode_paiement:val("f_mode"),observation:val("f_observation")||null,etablissement_id:site};if(!isEdit)row.reference=`LR-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`}
 if(type==="grade"){table="notes";row={eleve_id:Number(required("f_student","Élève")),matiere_id:Number(required("f_matter","Matière")),note:Number(required("f_note","Note")),type_evaluation:val("f_type")||"Évaluation",periode:val("f_period"),etablissement_id:activeSiteId}}
 if(type==="attendance"){table="presences";row={eleve_id:Number(required("f_student","Élève")),date_presence:val("f_date"),statut:val("f_state"),motif:val("f_reason")||null,etablissement_id:activeSiteId}}
 if(!table)throw new Error("Type d'enregistrement inconnu.");
 let request;
 if(isEdit) request=supabaseClient.from(table).update(row).eq("id",editingRecord.id).eq("etablissement_id",activeSiteId);
 else request=supabaseClient.from(table).insert(row).select("id");
 const {data:savedRows,error}=await request;if(error)throw error;
 let scheduleNotice="",registrationReceipt=null,registrationSupportCollected=0,registrationSupportRefs=[];
 let registrationScheduleReady=false;
 // Un même parent (même téléphone, même établissement) conserve un seul dossier et un seul accès pour tous ses enfants.
 if(type==="student"&&!isEdit&&savedRows?.[0]?.id&&val("f_parent_last").trim()){
  const phone=val("f_parent_phone").trim();
  const normalizePhone=v=>String(v||"").replace(/\D/g,"");
  const parentRow={nom:val("f_parent_last").trim(),prenoms:val("f_parent_first").trim()||"",telephone:phone||null,email:val("f_parent_email").trim()||null,etablissement_id:site};
  let parentId=null;
  if(phone){
   const {data:knownParents,error:findParentError}=await supabaseClient.from("parents").select("id,telephone").eq("etablissement_id",site).not("telephone","is",null);
   if(findParentError) scheduleNotice+=" Recherche du dossier parent impossible : "+findParentError.message;
   else parentId=(knownParents||[]).find(p=>normalizePhone(p.telephone)===normalizePhone(phone))?.id||null;
  }
  if(!parentId){
   const {data:parentRows,error:parentError}=await supabaseClient.from("parents").insert(parentRow).select("id");
   if(parentError)scheduleNotice+=" La fiche de l’apprenant est créée, mais la fiche parent n’a pas pu être créée : "+parentError.message;
   else parentId=parentRows?.[0]?.id||null;
  }
  if(parentId){
   const {data:existingLink,error:checkLinkError}=await supabaseClient.from("eleves_parents").select("parent_id").eq("eleve_id",Number(savedRows[0].id)).eq("parent_id",Number(parentId)).maybeSingle();
   let linkError=checkLinkError;
   if(!linkError&&!existingLink){const result=await supabaseClient.from("eleves_parents").insert({eleve_id:Number(savedRows[0].id),parent_id:Number(parentId),lien:val("f_parent_link")||"Tuteur",etablissement_id:site});linkError=result.error;}
   if(linkError)scheduleNotice+=" Dossier parent trouvé, mais liaison à vérifier : "+linkError.message;
   else {
    const {data:accountLinks,error:accountError}=await supabaseClient.from("parent_comptes").select("utilisateur_id").eq("parent_id",Number(parentId)).eq("actif",true);
    if(accountError)scheduleNotice+=" Enfant lié au parent, mais vérification du compte impossible : "+accountError.message;
    else if(accountLinks?.length)scheduleNotice+=" Enfant rattaché au compte parent déjà existant. Ce parent pourra consulter ses enfants avec le même accès.";
    else {
     const {data:createdAccount,error:createError}=await supabaseClient.functions.invoke("manage-access",{body:{action:"invite",nom:parentRow.nom,prenom:parentRow.prenoms||"Parent",email:parentRow.email||"",role:"parent",etablissement_ids:[],parent_id:Number(parentId)}});
     if(createError||!createdAccount?.ok)scheduleNotice+=" Dossier parent créé et enfant lié. Création du compte automatique non finalisée : "+(createdAccount?.error||createError?.message||"droits administrateur requis")+". L’administrateur doit activer l’accès dans Gestion des accès.";
     else scheduleNotice+=" COMPTE PARENT CRÉÉ — Identifiant : "+createdAccount.login_code+" ; mot de passe provisoire : "+createdAccount.temporary_password+". À remettre au parent : il devra changer ce mot de passe à sa première connexion.";
    }
   }
  }
 }
 if(type==="student"&&!isEdit&&row.classe_id&&savedRows?.[0]?.id){
  // Toujours relire la classe depuis Supabase : ne pas dépendre d'une liste locale potentiellement périmée.
  const {data:studentClass,error:classError}=await supabaseClient.from("classes").select("id,nom,niveau,serie,etablissement_id").eq("id",row.classe_id).eq("etablissement_id",site).maybeSingle();
  if(classError)throw new Error("Impossible de vérifier le tarif de la classe : "+classError.message);
  if(!studentClass)throw new Error("La classe sélectionnée n'existe pas dans cet établissement.");
  const fakeStudent={class:studentClass.nom,level:studentClass.niveau,series:studentClass.serie,classId:studentClass.id};
  const code=tariffCodeForStudent(fakeStudent);
  if(!code){scheduleNotice=" Aucun tarif automatique ne correspond à la classe « "+studentClass.nom+" ». Aucun paiement d'inscription n'a été encaissé.";}
  else {
   const {data:n,error:scheduleError}=await supabaseClient.rpc("creer_echeancier_eleve",{p_eleve_id:Number(savedRows[0].id),p_code_niveau:code});
   if(scheduleError){scheduleNotice=" Échéancier non créé : "+scheduleError.message+". Aucun paiement d'inscription n'a été encaissé.";}
   else {registrationScheduleReady=Number(n)>0;scheduleNotice=` ${n} échéance(s) tarifaire(s) créée(s) automatiquement.`;if(!registrationScheduleReady)scheduleNotice+=" Vérifiez la grille tarifaire de cette classe avant d'encaisser.";}
  }
 } else if(type==="student"&&!isEdit&&!row.classe_id){
  scheduleNotice=" L'élève est inscrit sans classe : aucun échéancier ni paiement n'a été créé.";
 }
 if(type==="student"&&!isEdit&&registrationAmount>0&&savedRows?.[0]?.id){
  if(!registrationScheduleReady){scheduleNotice+=" Le montant saisi n'a pas été encaissé. Affectez d'abord un tarif et un échéancier à la classe.";if(receiptWindow&&!receiptWindow.closed)receiptWindow.close();}
  else {
   const {data:paymentData,error:paymentError}=await supabaseClient.rpc("enregistrer_versement_eleve",{p_eleve_id:Number(savedRows[0].id),p_montant:registrationAmount,p_mode:registrationMode,p_reference_externe:null,p_observation:"Paiement effectué à l'inscription"});
   if(paymentError){scheduleNotice+=" Paiement non enregistré : "+paymentError.message;if(receiptWindow&&!receiptWindow.closed)receiptWindow.close();}
   else registrationReceipt=Array.isArray(paymentData)?paymentData[0]:paymentData;
  }
 }
 if(type==="student"&&!isEdit&&registrationSupportAmount>0&&savedRows?.[0]?.id){
  if(!registrationScheduleReady){scheduleNotice+=" Les photocopies/supports n'ont pas été encaissés : l'échéancier de la classe n'est pas prêt.";}
  else{
   const q=await supabaseClient.from("v_echeances_support_eleves").select("id,reste_a_payer,numero_tranche").eq("eleve_id",Number(savedRows[0].id)).eq("etablissement_id",site).gt("reste_a_payer",0).order("numero_tranche");
   if(q.error)scheduleNotice+=" Photocopies/supports non encaissés : "+q.error.message;
   else{
    const available=(q.data||[]).reduce((sum,x)=>sum+Number(x.reste_a_payer||0),0);
    if(registrationSupportAmount>available)scheduleNotice+=" Montant photocopies supérieur au solde disponible ("+available.toLocaleString("fr-FR")+" FCFA). Aucun frais de contribution n'a été modifié.";
    else{
     let left=registrationSupportAmount;
     for(const row of q.data||[]){if(left<=0)break;const part=Math.min(left,Number(row.reste_a_payer||0));if(part<=0)continue;
      const r=await supabaseClient.rpc("encaisser_support_eleve",{p_echeance_id:Number(row.id),p_montant:part,p_mode:registrationMode,p_observation:"Paiement facultatif photocopies/support à l'inscription"});
      if(r.error){scheduleNotice+=" Encaissement photocopies interrompu : "+r.error.message;break;}
      const rec=Array.isArray(r.data)?r.data[0]:r.data;registrationSupportCollected+=part;if(rec?.reference_recu)registrationSupportRefs.push(rec.reference_recu);left-=part;
     }
     if(left===0)scheduleNotice+=" Photocopies/supports encaissés séparément : "+registrationSupportCollected.toLocaleString("fr-FR")+" FCFA (réf. "+registrationSupportRefs.join(", ")+").";
    }
   }
  }
 }

 editingRecord=null;closeModal();await loadLiveData();const page={student:"students",teacher:"teachers",class:"classes",parent:"parents",payment:"payments",grade:"grades",attendance:"attendance"}[type];showPage(registrationReceipt?"payments":page);
 if(registrationReceipt){registrationReceipt.support_encaisse_dans_operation=registrationSupportCollected;registrationReceipt.support_references=registrationSupportRefs;alert("Inscription enregistrée et paiement reçu. Référence : "+registrationReceipt.reference_recu+scheduleNotice);printVersementReceipt(registrationReceipt,savedRows[0].id,registrationMode,receiptWindow);}
 else {alert((isEdit?"Modification enregistrée dans Supabase.":"Enregistrement effectué dans Supabase.")+(type==="student"&&!isEdit?" Matricule provisoire : "+row.matricule+".":"")+scheduleNotice);if(registrationSupportCollected>0)printSupportPaymentReceipt(savedRows[0].id,registrationSupportCollected,registrationMode,registrationSupportRefs,receiptWindow);else if(receiptWindow&&!receiptWindow.closed)receiptWindow.close();}
 }catch(e){if(typeof receiptWindow!=="undefined"&&receiptWindow&&!receiptWindow.closed)receiptWindow.close();notifyError("Enregistrement non effectué",e)}
}
async function removeItem(type,id){
 if(!liveMode){alert("Connectez-vous pour gérer les données officielles.");return}
 const map={student:"eleves",teacher:"enseignants",class:"classes",parent:"parents",payment:"paiements",grade:"notes",attendance:"presences"};const table=map[type];if(!table)return;
 if(type==="student"){
  if(!confirm("Retirer cet apprenant de la liste active ? Son dossier, ses notes et ses traces financières seront archivés et conservés."))return;
  const {error}=await supabaseClient.from("eleves").update({statut:"ancien"}).eq("id",id).eq("etablissement_id",activeSiteId);
  if(error){notifyError("Archivage de l'apprenant",error);return}
  await loadLiveData();showPage(document.querySelector(".sidebar nav button.active")?.dataset.page||"dashboard");alert("Apprenant archivé. Son historique est conservé.");return;
 }
 if(["grade","attendance"].includes(type)){
  if(currentProfile?.role!=="administrateur_general"){alert("Seul l’administrateur général peut archiver cet élément.");return;}
  if(!confirm("Archiver cet élément ? Il pourra être restauré depuis la corbeille."))return;
  const {error}=await supabaseClient.rpc("corbeille_archiver",{p_table:type==="grade"?"notes":"presences",p_id:Number(id)});
  if(error){notifyError("Archivage",error);return;}
  await loadLiveData();showPage("recycle-bin");return;
 }
 if(!confirm("Confirmer la suppression ? Cette opération peut être bloquée si des données y sont liées."))return;
 const {error}=await supabaseClient.from(table).delete().eq("id",id).eq("etablissement_id",activeSiteId);
 if(error){notifyError("Suppression refusée",error);return}await loadLiveData();showPage(document.querySelector(".sidebar nav button.active")?.dataset.page||"dashboard");
}

function readStudentPhoto(input){const f=input.files?.[0];if(!f)return;if(!f.type.startsWith("image/")){alert("Choisissez une image.");return;}const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement("canvas"),scale=Math.min(1,600/Math.max(img.width,img.height));c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);c.getContext("2d").drawImage(img,0,0,c.width,c.height);window.studentPhotoData=c.toDataURL("image/jpeg",0.72);};img.src=reader.result;};reader.readAsDataURL(f);}

document.addEventListener("DOMContentLoaded",toggleLoginFields);
