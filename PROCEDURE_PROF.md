# 📋 PROCÉDURE PROF — F-Gas Eval MFER DM

**inerWeb Édu — F. Henninot — LP Privé Jacques Raynaud, Marseille**

---

## 🎯 À quoi ça sert

Faire passer aux élèves un **devoir maison numérique** sur la réforme F-Gas III (arrêtés du 21 novembre 2025), à la maison, sur leur téléphone. Note automatique sur 20.

**6 classes** prises en charge : 1 IFCA · 2 IFCA · 2 TNE · 1 MFER · T MFER · TP CVC

---

## 🔑 Codes à connaître

| Code | Valeur par défaut | Pour quoi |
|---|---|---|
| **Code prof LPPJR** | `LPPJR2026` | Accéder au tableau de bord |
| **Code AES** | `FGAS2026-MFER` | Chiffrement des questions (transparent pour les élèves) |
| **Mot de passe élève** | nom de la classe (ex `1MFER`) | À leur 1ʳᵉ connexion |

---

## 🌐 URLs à donner aux élèves

| Public | URL |
|---|---|
| **Élèves (DM)** | `https://frigorx.github.io/fgas-eval-mfer/dm.html` |
| **Prof (notes)** | `https://frigorx.github.io/fgas-eval-mfer/tableau-bord.html` |

---

## 📱 Côté élève — déroulé en 4 étapes

1. **Choisir sa classe** (gros boutons, 1 clic)
2. **Saisir son pseudo** : initiale prénom + 4 lettres nom (`FHENN` pour F. Henninot)
3. **Première fois** → mot de passe = **nom de la classe** (`1MFER`). Cliquer **"Première fois — Créer mon compte"**.
4. **Faire le DM** : split-screen, diapo en haut, question en bas. Possibilité de revoir la diapo (compteur affiché). Note /20 à la fin. Refaire autant de fois qu'on veut.

---

## 🖥 Côté prof — Tableau de bord

### Connexion
1. Ouvrir l'URL prof
2. Saisir `LPPJR2026`
3. Choisir la classe (ou "Toutes")

### Onglet 📊 Notes
- Tableau récap : pseudo, statut (🟢🟡🔴⚪), meilleure note, tentatives, durée moyenne.
- 🚨 = devtools détecté (élève a essayé de tricher).
- Cliquer **Détail** → courbe progression + historique tentatives.
- **📥 Export CSV** → fichier prêt à coller dans ÉcoleDirecte.

### Onglet 👥 Comptes
- Liste des comptes élèves de la classe.
- 🔄 **Reset MDP** d'un élève (remis à `1MFER` par défaut).
- ✏️ **Renommer** un pseudo (en cas d'erreur de saisie).
- 🗑 **Supprimer** un compte (avec ses notes).
- Jauge **40/40** : limite anti-spam.
- 🔄 **Reset classe** : tous les MDP remis à la valeur classe (rare, début d'année).
- 🗑 **Vider classe** : tout effacer (tape le nom de la classe pour confirmer, action irréversible).

### Onglet ⚠️ Activité
- Journal de sécurité : devtools détectés, lockouts (5 essais ratés), tentatives login échouées, etc.

### Onglet ⚙️ Paramètres
- **Activation par classe** : 🟢 Ouvert / 🔴 Fermé (toggle).
- **Mode par classe** :
  - **20 q (DM léger)** : 12 min, pour révision normale.
  - **40 q (Examen blanc)** : 25 min, pour prépa habilitation A1 (T MFER).
- **Limite comptes/classe** : 40 par défaut.
- **Max tentatives par élève** : 0 = illimité.
- **Code AES** et **Code prof** : modifiables annuellement.

---

## 🚨 Cas pratiques fréquents

| Situation | Quoi faire |
|---|---|
| Élève a oublié son mot de passe | Onglet Comptes → 🔄 Reset → il se reconnecte avec sa classe (`1MFER`) |
| Faute de frappe dans le pseudo | Onglet Comptes → ✏️ Renommer |
| Homonymes dans la classe | Le système demande automatiquement la 5ᵉ lettre du nom |
| Classe complète à 40 | Supprimer un compte fantôme OU augmenter la limite dans Paramètres |
| Élève a triché (badge 🚨) | Détail élève → 🗑 Invalider la tentative concernée |
| Fin de session DM | Paramètres → toggle 🔴 Fermé pour la classe |
| Refaire une session propre | Onglet Notes → 🗑 Effacer toutes les tentatives (les comptes sont conservés) |
| Tout reprendre à zéro | Onglet Comptes → 🗑 Vider la classe |

---

## 📊 Comprendre les notes

- **/20**, par défaut.
- **Meilleure note** = celle affichée pour ÉcoleDirecte.
- **Compteur tentatives** : visible, te dit combien de fois l'élève a refait.
- **Compteur consultations diapo** : combien de fois il a regardé le cours pendant le DM. Très consultatif = il révise. Zéro = soit il sait, soit il devine.
- **Durée** : si < 3 min → suspect (devinette). Si > 25 min → consciencieux.

---

## 🔐 Sécurité

- Questions chiffrées AES-GCM (F12 ne révèle rien).
- Score signé HMAC : impossible de bidouiller la note via Postman.
- Lockout 5 essais ratés = blocage 5 min.
- Devtools détectés = badge 🚨 visible côté prof.

---

## ⚙️ Maintenance annuelle (rentrée septembre)

1. **Vider toutes les classes** de l'année précédente (Tableau-bord → onglet Comptes → "Vider la classe" pour chaque).
2. **Changer le code AES** dans Paramètres (ex: `FGAS2027-MFER`).
3. **Re-chiffrer questions.json** : lancer `node build-questions.js --password=FGAS2027-MFER` puis pousser le nouveau `questions.enc` sur GitHub.
4. **Vérifier l'ouverture** des classes dans Paramètres.

---

## 🆘 En cas de bug

1. Recharger la page (F5).
2. Vérifier qu'on est bien en HTTPS.
3. Vérifier dans la Google Sheet que les onglets `fgas_comptes`, `fgas_resultats`, `fgas_logs`, `fgas_params` existent.
4. Si rien ne marche : ouvrir Apps Script → relancer manuellement la fonction `initialiser()`.
