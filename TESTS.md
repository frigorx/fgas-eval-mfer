# TESTS — F-Gas Eval MFER DM

## Tests automatiques (déjà passés)

| Test | Résultat |
|---|---|
| Déchiffrement AES-GCM avec FGAS2026-MFER | ✅ |
| 50 questions valides dans questions.enc | ✅ |
| Phase 1 : 40 questions, Phase 2 : 10 questions | ✅ |
| Filtrage mode léger : 24 q (pioche 20) | ✅ |
| Filtrage mode habilitation : 50 q (pioche 40) | ✅ |
| Couverture diapos 2 à 14 (chacune ≥ 1 q) | ✅ |
| 6 classes présentes dans dm.html | ✅ |
| 13 diapos pédagogiques rendues dans dm.html | ✅ |
| 6 routes prof appelées dans tableau-bord.html | ✅ |
| 10 fonctions clés présentes dans Code.gs | ✅ |
| Obfuscation dm.html : 31k → 105k (×3.3) | ✅ |

## Scénarios de test bout en bout (à exécuter après déploiement)

### Préalable : déploiement Apps Script
1. Ouvrir https://script.google.com → nouveau projet "F-Gas Eval MFER"
2. Coller le contenu de `Code.gs`
3. Vérifier les CONSTANTES en haut (SHEET_ID, CODE_LPPJR…)
4. Lancer manuellement `initialiser()` une fois → autorise l'accès Sheet
5. Déployer comme application web : exécuter en tant que MOI, accès TOUT LE MONDE
6. Copier l'URL `/exec` et la coller dans `dm.html` et `tableau-bord.html` (variable `APPS_SCRIPT_URL`)

### S1 — Création compte élève (cas nominal)
1. Ouvrir `dm.html` sur téléphone
2. Cliquer "🎓 1 MFER"
3. Saisir pseudo `FHENN`, mot de passe `1MFER`
4. Cliquer "Première fois — Créer mon compte"
5. ✅ Attendu : compte créé, login automatique, écran chargement → DM démarre

### S2 — Login depuis 2ᵉ appareil (cross-device)
1. Sur PC, ouvrir `dm.html`
2. Choisir 1 MFER, pseudo `FHENN`, mot de passe `1MFER`
3. Cliquer "Se connecter"
4. ✅ Attendu : login OK, le DM démarre normalement

### S3 — Anti-collision pseudo
1. Créer compte `FHENN` (1 MFER)
2. Tenter de créer un autre compte `FHENN` (1 MFER)
3. ✅ Attendu : message "Pseudo déjà utilisé dans la classe 1MFER. Ajoute la lettre suivante de ton nom."
4. Saisir `FHENNI` → ✅ création réussie

### S4 — Lockout après 5 essais ratés
1. Tenter login `FHENN` / mauvais MDP × 5
2. ✅ Attendu : 5ᵉ essai → "Trop d'essais ratés. Compte verrouillé 5 minutes."
3. Tenter à nouveau dans la minute → "Compte verrouillé. Réessaie dans X s."

### S5 — Limite 40 comptes/classe
1. Dans tableau-bord prof, paramètres → mettre `limite_comptes_par_classe = 3`
2. Créer 3 comptes 1 MFER : OK
3. Tenter de créer un 4ᵉ → ✅ Attendu : "La classe 1MFER est complète (3/3)."

### S6 — DM léger (20 questions)
1. Login en 1 MFER (mode par défaut = leger)
2. ✅ Attendu : 20 questions affichées, ~12 min de DM
3. Cliquer "Revoir la diapo" → diapo s'affiche → toucher zone bas → ✅ diapo se masque après 2s
4. Compteur "📖 ×N" s'incrémente

### S7 — Mode habilitation (40 questions)
1. Tableau-bord → Paramètres → T MFER → mode = habilitation → Enregistrer
2. Login en T MFER → ✅ 40 questions, ~25 min

### S8 — Score, HMAC, envoi Sheet
1. Terminer un DM avec ~12/20
2. ✅ Vérifier dans `fgas_resultats` : ligne avec note, hmac_signature, devtools_ouvert
3. Tenter via curl/Postman un POST `submit_result` avec note 20/20 sans HMAC valide
4. ✅ Attendu : Apps Script renvoie `{ ok: false, error: "Signature invalide" }`, ligne non insérée

### S9 — Tableau de bord prof
1. Ouvrir `tableau-bord.html`
2. Saisir code LPPJR2026 → accès
3. Cliquer 1 MFER → onglet Notes
4. ✅ Attendu : tableau avec FHENN, sa meilleure note, ses tentatives
5. Cliquer "Détail" → modal avec courbe progression + liste tentatives

### S10 — Reset MDP par prof
1. Onglet Comptes → ligne FHENN → "🔄 Reset MDP"
2. ✅ Attendu : confirmation, MDP remis à `1MFER`
3. Côté élève : login échoue avec ancien MDP, OK avec `1MFER`

### S11 — Suppression compte
1. Onglet Comptes → ligne FHENN → "🗑 Supprimer"
2. ✅ Attendu : compte supprimé + tentatives supprimées
3. Vérifier dans Sheet : aucune trace de FHENN

### S12 — Renommer pseudo
1. Onglet Comptes → ligne FHENN → "✏️ Renommer" → saisir `FHENNINOT`
2. ✅ Attendu : pseudo renommé dans `fgas_comptes` ET `fgas_resultats`

### S13 — Vider la classe (action danger)
1. Créer plusieurs comptes 1 MFER
2. Onglet Comptes → "🗑 Vider la classe"
3. Saisir `1IFCA` (faux) → ✅ "Confirmation invalide"
4. Saisir `1MFER` (correct) → ✅ tous les comptes + tentatives supprimés

### S14 — Export CSV ÉcoleDirecte
1. Onglet Notes → "📥 Export CSV ÉcoleDirecte"
2. ✅ Attendu : fichier `fgas_notes_1MFER_AAAA-MM-JJ.csv` téléchargé
3. Ouvrir : 5 colonnes (Classe;Pseudo;Note;Tentatives;Statut), virgules françaises

### S15 — Détection devtools
1. Élève ouvre F12 pendant le DM
2. Console : `appelApi('log_event', {type: 'DEVTOOLS_OUVERT', ...})` est appelée
3. ✅ Attendu : badge 🚨 sur la ligne dans tableau-bord, log dans onglet Activité

### S16 — Toggle ouvert/fermé classe
1. Tableau-bord → Paramètres → 2 IFCA → désactiver toggle → Enregistrer
2. Élève 2 IFCA tente login → ✅ "Le DM n'est pas ouvert pour cette classe."

### S17 — Max tentatives
1. Paramètres → max_tentatives = 2 → Enregistrer
2. Élève fait 3 DM successifs → ✅ 3ᵉ tentative bloquée : "Nombre maximum de tentatives atteint (2)"

### S18 — Refaire DM (note écrasée, compteur tentatives)
1. Élève fait DM → 12/20
2. Refait → 16/20
3. ✅ Tableau-bord : meilleure note = 16, dernière note = 16, tentatives = 2

### S19 — Dans la modal détail élève, invalider une tentative
1. Tableau-bord → détail élève → bouton "🗑 Invalider" sur tentative N°1
2. ✅ Attendu : tentative marquée `invalidee = true`, masquée du tableau récap, mais conservée dans la Sheet

### S20 — Visuel charte PDF
1. Vérifier garde dm.html : fond bleu marine #1b3a63, barre orange, logo + cartouche
2. Diapos : header avec logo + cartouche Édu, titre Trebuchet MS bleu, sous-titre orange italique
3. Cards à barre verticale colorée (bleu / orange / vert)
4. Encart "💡 À retenir" en orange clair

## Bilan

Tous les tests automatiques passent. Les scénarios bout en bout S1 à S20 sont à exécuter après déploiement Apps Script + GitHub Pages — ils couvrent l'ensemble du périmètre fonctionnel : auth, DM, sécurité, ménage prof, charte visuelle.
