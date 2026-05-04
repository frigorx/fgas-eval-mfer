# inerWeb Édu — F-Gas III · 2 modes d'évaluation

Outils pédagogiques sur la réforme de l'habilitation à la manipulation des fluides frigorigènes (arrêtés du 21 nov. 2025).

**2 modes complémentaires** :

- 📺 **Mode cours live** (présentiel) : slides au vidéoprojecteur + tels élèves synchronisés. Format "Qui veut gagner des millions", anti-décrochage actif.
- 🏠 **Mode DM maison** (asynchrone) : split-screen sur téléphone, 25 ou 40 questions, auth comptes, tableau de bord prof complet.

## Architecture

```
fgas-eval-mfer/
├── prof.html               ← MODE LIVE : page prof (slides + pilotage)
├── eleve.html              ← MODE LIVE : page élève (smartphone)
├── dm.html                 ← MODE DM : page élève split-screen
├── tableau-bord.html       ← MODE DM : page prof (Notes / Comptes / Activité / Paramètres)
├── data/
│   ├── questions.json      ← MODE LIVE : 1 test + 17 checkpoints + 20 QCM final
│   └── dm-questions.enc    ← MODE DM : 50 questions chiffrées AES-GCM
├── apps-script/
│   └── Code.gs             ← MODE LIVE : backend Sheet
├── apps-script-dm/
│   ├── Code.gs             ← MODE DM : backend (15 routes, HMAC, lockout)
│   └── appsscript.json
├── PROCEDURE_PROF.md       ← Guide d'utilisation prof (mode DM)
├── DEPLOIEMENT.md          ← Procédure technique
├── TESTS.md                ← 20 scénarios de tests
└── README.md
```

## URLs publiques (GitHub Pages)

- 📺 Mode live, prof : `https://frigorx.github.io/fgas-eval-mfer/prof.html`
- 📺 Mode live, élève : `https://frigorx.github.io/fgas-eval-mfer/eleve.html?gas=<URL>`
- 🏠 Mode DM, élève : `https://frigorx.github.io/fgas-eval-mfer/dm.html`
- 🏠 Mode DM, prof : `https://frigorx.github.io/fgas-eval-mfer/tableau-bord.html`

## Mode DM — Vue rapide

- 6 classes : 1 IFCA · 2 IFCA · 2 TNE · 1 MFER · T MFER · TP CVC
- Auth élève : pseudo (initiale + 4 lettres nom) + mdp (par défaut = nom de la classe)
- Tentatives illimitées, dernière note écrase, compteur tentatives + consultations diapo
- 2 modes : DM léger (20 q, 12 min) ou Examen blanc habilitation (40 q, 25 min)
- Sécurité : AES-GCM (questions), HMAC (score), détection devtools, lockout 5 essais ratés, limite 40/classe

Voir `PROCEDURE_PROF.md` pour le guide d'utilisation et `DEPLOIEMENT.md` pour la procédure technique.

---

## Mode LIVE (existant) — Documentation détaillée

## Déploiement (1ʳᵉ fois — 15 min)

### 1. Créer la Google Sheet

1. Aller sur https://sheets.new (compte `inerweb.fh@gmail.com`)
2. Renommer en `Eval_Cours_F-Gas_MFER_2026`
3. Copier l'**ID de la Sheet** (entre `/d/` et `/edit` dans l'URL)
4. Garder cette Sheet ouverte pour la suite

### 2. Brancher l'Apps Script

1. Dans la Sheet : **Extensions → Apps Script**
2. Effacer le contenu de `Code.gs` et coller le contenu de `apps-script/Code.gs`
3. Coller l'ID de la Sheet dans la constante `SHEET_ID` (ligne 24 environ)
4. Sauvegarder (Ctrl+S)
5. Lancer la fonction `setupAll` une fois pour créer les 5 onglets (autoriser les permissions Google)
6. **Déployer → Nouveau déploiement** :
   - Type : **Application Web**
   - Description : `inerWeb Édu — F-Gas eval`
   - Exécuter en tant que : **moi** (`inerweb.fh@gmail.com`)
   - Qui a accès : **Tout le monde** (indispensable pour que les tels élèves puissent appeler)
7. Copier l'**URL de déploiement** (finit par `/exec`) — c'est `GAS_URL`

### 3. Pousser sur GitHub Pages

```bash
cd "C:/Users/henni/OneDrive/Bureau/25 26/cours 25_26/TNE/fgas-eval-mfer/"
git init
git add .
git commit -m "Cours interactif F-Gas III — V1"
gh repo create frigorx/fgas-eval-mfer --public --source=. --push
```

Puis activer GitHub Pages :
- Repo Settings → Pages → Source : `main` / `/` (root) → Save
- L'URL sera `https://frigorx.github.io/fgas-eval-mfer/`

### 4. Lier le tout

Avant le cours, ouvrir `prof.html` :
- Au 1ᵉʳ chargement, le navigateur demande l'URL Apps Script → coller `GAS_URL` (mémorisée ensuite dans le `localStorage`)
- L'URL élève est dérivée automatiquement : `https://frigorx.github.io/fgas-eval-mfer/eleve.html?gas=<GAS_URL>`
- Le QR code de la slide 1 pointe directement dessus

## Lancer un cours

1. Ouvrir `prof.html` au vidéoprojecteur (plein écran F11)
2. Slide 1 : les élèves scannent le QR code
3. Slide 2 : règles du jeu — laisser le temps aux élèves de se connecter (visible dans la barre prof : "X connectés")
4. Slide 3 : question test — vérifier qu'au moins 80% ont bien répondu
5. Naviguer ← / → ou Espace pour avancer
6. Sur une slide question : cliquer **▶ Lancer la question** — les tels élèves affichent les propositions
7. Cliquer **📊 Voir les résultats** quand tout le monde a répondu
8. Slide résultats : faire la remédiation orale, puis enchaîner
9. Slide 30 : cliquer **🚀 Lancer le QCM final** — tous les élèves passent en mode QCM noté
10. Slide 31 : cliquer **📥 Télécharger les notes (CSV)** pour récupérer

## Récupérer les notes

3 options selon ton besoin :

- **Bouton CSV** sur la dernière slide → fichier `notes_fgas_2026-04-29.csv` directement téléchargé, prêt à copier-coller dans Pronote (colonne `note_sur_20`)
- **Onglet `notes_finales`** dans la Sheet → tableau live avec pseudo, classe, score brut, version
- **URL directe** : `<GAS_URL>?action=export_notes` → CSV brut, utilisable en script si besoin

Le pseudo (1ʳᵉ lettre prénom + 4 lettres nom) permet de retrouver chaque élève sans ambiguïté pour la classe.

## Anti-décrochage

- Quand un élève quitte la page (Snap, SMS…) → enregistré côté Sheet
- Quand il revient : **vibration + son strident + écran rouge clignotant 3-4s**
- Côté prof : bandeau rouge en haut affichant qui décroche en temps réel
- Limitation technique : iOS/Android coupent le JS quand la page est en arrière-plan, donc le tel ne sonne pas pendant la sortie — uniquement au retour. C'est volontaire (autrement le tel sonnerait dans le sac toute la journée).

## Personnalisation

- **Modifier les questions** : éditer `data/questions.json`. Pas besoin de redéployer, le fichier est rechargé à chaque ouverture
- **Ajouter une classe** : éditer la liste des `<option>` dans `eleve.html` (recherche : `2nde TNE`)
- **Changer le titre du cours** : `prof.html` slide 1 et `eleve.html` ligne `<h1>Bienvenue</h1>`

## Troubleshooting

| Symptôme | Cause probable | Fix |
|---|---|---|
| LED GAS rouge dans la barre prof | URL Apps Script invalide ou pas déployée en "Tout le monde" | Re-déployer en "Tout le monde" |
| Tels élèves ne reçoivent pas la question | Polling 2s = délai normal · sinon URL `?gas=` manquante | Ajouter `?gas=<URL>` à l'URL élève |
| Erreurs CORS | Header `Content-Type` envoyé côté JS | Ne JAMAIS ajouter de header Content-Type sur les fetch POST |
| Notes mélangées | 4 versions A/B/C/D normales | Le mélange est déterministe par pseudo, retrouvable |
| QCM se relance après chaque réponse | État `qcm_final` resté actif | Cliquer "🔄 RAZ" en barre prof |

## Crédits

- Auteur : F. Henninot · LP Privé Jacques Raynaud · Campus ÉQUATIO Marseille
- Charte inerWeb Édu (bleu #1b3a63 · orange #ff6b35)
- Sources réglementaires : Arrêtés du 21 nov. 2025 (JORF 6 déc. 2025), F-Gas III (UE) 2024/573
