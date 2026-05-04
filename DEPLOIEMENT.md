# DÉPLOIEMENT — F-Gas Eval MFER DM

## Étape 1 : Apps Script

1. Ouvrir https://script.google.com → **Nouveau projet** → renommer "F-Gas Eval MFER DM"
2. Supprimer le code par défaut, coller le contenu de `Code.gs`
3. Vérifier les CONSTANTES en haut du fichier :
   - `SHEET_ID` : doit pointer vers la Sheet du collecteur universel (`16T1T3yL6M49OhJUQS1SmFHwW7Bywp7m2kSXDiXdmItk` par défaut)
   - `CODE_LPPJR` : modifier si besoin
   - `HMAC_SECRET` : laisser tel quel (cohérent avec dm.html)
4. **Sauvegarder** (Ctrl+S)
5. Dans la liste des fonctions en haut, sélectionner `initialiser` → cliquer **Exécuter**
6. Une fenêtre d'autorisation Google s'ouvre → autoriser l'accès Sheet (compte `inerweb.fh@gmail.com`)
7. Vérifier dans la Sheet que les 4 onglets ont été créés :
   - `fgas_comptes`
   - `fgas_resultats`
   - `fgas_logs`
   - `fgas_params` (avec valeurs par défaut)

### Déploiement comme application web
1. Bouton **Déployer** → **Nouveau déploiement**
2. Type : **Application web**
3. Description : "F-Gas DM v1.0"
4. **Exécuter en tant que** : Moi (`inerweb.fh@gmail.com`)
5. **Qui a accès** : Tout le monde
6. Cliquer **Déployer**
7. Copier l'URL `https://script.google.com/macros/s/AKfycb.../exec`

### Tester l'API
Dans le navigateur, ouvrir : `URL_EXEC?action=ping`

Attendu : `{"ok":true,"version":"1.0","module":"fgas-eval-mfer-dm"}`

---

## Étape 2 : Configurer les HTML

Dans **`dm.html`** et **`tableau-bord.html`**, ligne `const APPS_SCRIPT_URL = ...` :

```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb.../exec';
```

Remplacer par l'URL copiée à l'étape précédente.

---

## Étape 3 : Obfuscation (optionnel mais recommandé)

```bash
cd C:/Users/henni/OneDrive/Bureau/fgas-eval-mfer-dm
npm install javascript-obfuscator   # une seule fois
node obfuscate.js
```

Sortie : `dm.obfuscated.html`. Renommer en `dm.html` avant push GitHub.

---

## Étape 4 : Push GitHub

```bash
cd C:/Users/henni/OneDrive/Bureau/fgas-eval-mfer-dm

# Si le repo n'existe pas encore :
# (créer manuellement frigorx/fgas-eval-mfer sur github.com)

git init
git remote add origin https://github.com/frigorx/fgas-eval-mfer.git
git checkout -b main

# Fichiers à publier
git add dm.html tableau-bord.html questions.enc README.md PROCEDURE_PROF.md

# Fichiers à NE PAS publier (créer .gitignore)
echo "node_modules/" >> .gitignore
echo "package*.json" >> .gitignore
echo "questions.json" >> .gitignore
echo "questions.enc.json" >> .gitignore
echo "Code.gs" >> .gitignore
echo "build-questions.js" >> .gitignore
echo "obfuscate.js" >> .gitignore
echo "DEPLOIEMENT.md" >> .gitignore
echo "TESTS.md" >> .gitignore
git add .gitignore

git commit -m "DM F-Gas v1.0 — split-screen 16 diapos / 25-40 questions chiffrées"
git push -u origin main
```

### Activer GitHub Pages

1. Sur GitHub → repo `fgas-eval-mfer` → **Settings** → **Pages**
2. Source : Branch `main`, dossier `/ (root)`
3. Sauvegarder
4. Attendre 1-2 min, puis vérifier :
   - https://frigorx.github.io/fgas-eval-mfer/dm.html
   - https://frigorx.github.io/fgas-eval-mfer/tableau-bord.html

---

## Étape 5 : Première utilisation

1. Ouvrir `tableau-bord.html` → code `LPPJR2026`
2. Onglet **Paramètres** : vérifier que toutes les classes sont 🟢 ouvertes
3. Faire un test élève sur `dm.html` (créer compte `TEST1`, classe 1 MFER, MDP `1MFER`)
4. Faire le DM
5. Retourner sur le tableau de bord → ✅ vérifier que la note apparaît
6. Supprimer le compte `TEST1`

---

## Étape 6 : Annoncer aux élèves

Modèle de message ÉcoleDirecte :

> **DEVOIR MAISON — F-Gas III**
>
> Tu vas réviser la réforme F-Gas III avec un DM numérique sur ton téléphone.
>
> 🔗 Lien : https://frigorx.github.io/fgas-eval-mfer/dm.html
>
> 📱 Comment faire :
> 1. Choisis ta classe.
> 2. Pseudo : initiale prénom + 4 lettres nom (ex: F. Henninot → `FHENN`).
> 3. Mot de passe : nom de ta classe (ex: `1MFER`).
> 4. Clique "Première fois — Créer mon compte".
> 5. Réponds aux questions. Tu peux refaire autant de fois que tu veux, je garde la meilleure note.
>
> ⏱ Durée : ~12 min (1 fois) ou ~30 min (en t'entraînant 2-3 fois).
>
> 📅 À rendre avant le [DATE].
>
> ⚠️ Pas la peine d'ouvrir F12, les questions sont chiffrées 😉
>
> Bon DM !
> F. Henninot

---

## Maintenance

### Modifier les questions
1. Éditer `questions.json`
2. Relancer `node build-questions.js` → nouveau `questions.enc`
3. Push GitHub

### Changer le code AES annuel
1. Lancer `node build-questions.js --password=NOUVEAU_CODE`
2. Aller dans tableau-bord → Paramètres → modifier `code_aes`
3. Push le nouveau `questions.enc`
