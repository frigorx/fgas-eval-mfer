/**
 * Code.gs — Apps Script F-Gas Eval MFER DM
 * inerWeb Édu — F. Henninot, LP Privé Jacques Raynaud, Campus ÉQUATIO Marseille
 *
 * Backend pour :
 *   - dm.html (page élève DM)
 *   - tableau-bord.html (page prof)
 *
 * Déploiement :
 *   1. Ouvrir Apps Script (script.google.com)
 *   2. Coller ce fichier
 *   3. Définir les CONSTANTES ci-dessous
 *   4. Déployer comme application web (accès : Tout le monde, exécuter en mon nom)
 *   5. Copier l'URL /exec dans dm.html et tableau-bord.html
 *
 * Sécurité :
 *   - Code LPPJR pour routes prof
 *   - HMAC pour signer les résultats DM (anti-bidouille)
 *   - PBKDF2 simulé (Utilities.computeDigest avec sel) pour les mots de passe élèves
 *   - Lockout 5 essais ratés (5 min)
 *   - Throttling création comptes
 */

// ========================
// CONSTANTES À CONFIGURER
// ========================
const SHEET_ID = '16T1T3yL6M49OhJUQS1SmFHwW7Bywp7m2kSXDiXdmItk'; // Sheet collecteur universel
const ONGLET_COMPTES = 'fgas_comptes';
const ONGLET_RESULTATS = 'fgas_resultats';
const ONGLET_LOGS = 'fgas_logs';
const ONGLET_PARAMS = 'fgas_params';

const CODE_LPPJR = 'LPPJR2026'; // Code prof — modifiable
const HMAC_SECRET = 'inerWeb-FH-2026-fgas-secret-hmac-key'; // Modifiable
const MODULE = 'fgas-eval-mfer-dm';

const CLASSES_AUTORISEES = ['1IFCA', '2IFCA', '2TNE', '1MFER', 'TMFER', 'TPCVC'];
const LIMITE_COMPTES_PAR_CLASSE = 40;
const LOCKOUT_DUREE_MS = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_MAX_ESSAIS = 5;

// ========================
// ROUTAGE
// ========================
function doGet(e) {
  return handleRequest(e, 'GET');
}

function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, methode) {
  e = e || { parameter: {}, postData: null };
  const action = ((e.parameter && e.parameter.action) || '').toLowerCase();
  let body = {};
  if (methode === 'POST' && e.postData && e.postData.contents) {
    try {
      body = JSON.parse(e.postData.contents);
    } catch (err) {
      body = {};
    }
  }
  const params = Object.assign({}, e.parameter, body);

  let result;
  try {
    switch (action) {
      // --- Routes élève ---
      case 'check_pseudo':       result = checkPseudo(params); break;
      case 'create_account':     result = createAccount(params); break;
      case 'login':              result = login(params); break;
      case 'change_password':    result = changePassword(params); break;
      case 'submit_result':      result = submitResult(params); break;
      case 'get_class_status':   result = getClassStatus(params); break;
      case 'log_event':          result = logEvent(params); break;

      // --- Routes prof (code LPPJR) ---
      case 'list_accounts':      result = listAccounts(params); break;
      case 'list_results':       result = listResults(params); break;
      case 'reset_password':     result = resetPassword(params); break;
      case 'delete_account':     result = deleteAccount(params); break;
      case 'rename_pseudo':      result = renamePseudo(params); break;
      case 'reset_class_passwords': result = resetClassPasswords(params); break;
      case 'clear_class':        result = clearClass(params); break;
      case 'delete_result':      result = deleteResult(params); break;
      case 'get_settings':       result = getSettings(params); break;
      case 'update_settings':    result = updateSettings(params); break;
      case 'list_logs':          result = listLogs(params); break;

      // --- Ping ---
      case 'ping':               result = { ok: true, version: '1.0', module: MODULE }; break;

      default:
        result = { ok: false, error: 'Action inconnue : ' + action };
    }
  } catch (err) {
    result = { ok: false, error: 'Erreur serveur : ' + err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ========================
// UTILITAIRES SHEET
// ========================
function getSheet(nom) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(nom);
  if (!sh) {
    sh = ss.insertSheet(nom);
    initSheet(sh, nom);
  }
  return sh;
}

function initSheet(sh, nom) {
  let entetes = [];
  switch (nom) {
    case ONGLET_COMPTES:
      entetes = ['classe', 'pseudo', 'hash_mdp', 'salt', 'date_creation', 'derniere_connexion', 'nb_connexions', 'reset_demande', 'verrouille_jusqu_a', 'nb_essais_rates'];
      break;
    case ONGLET_RESULTATS:
      entetes = ['date', 'classe', 'pseudo', 'mode', 'note_20', 'score_pct', 'nb_questions', 'nb_correctes', 'duree_sec', 'nb_tentatives', 'nb_consultations_diapo', 'devtools_ouvert', 'detail_questions', 'hmac_signature', 'invalidee'];
      break;
    case ONGLET_LOGS:
      entetes = ['date', 'type', 'classe', 'pseudo', 'message', 'ip_hash'];
      break;
    case ONGLET_PARAMS:
      entetes = ['cle', 'valeur'];
      sh.appendRow(entetes);
      const defauts = [
        ['ouvert_1IFCA', 'true'],
        ['ouvert_2IFCA', 'true'],
        ['ouvert_2TNE', 'true'],
        ['ouvert_1MFER', 'true'],
        ['ouvert_TMFER', 'true'],
        ['ouvert_TPCVC', 'true'],
        ['mode_1IFCA', 'leger'],
        ['mode_2IFCA', 'leger'],
        ['mode_2TNE', 'leger'],
        ['mode_1MFER', 'leger'],
        ['mode_TMFER', 'habilitation'],
        ['mode_TPCVC', 'leger'],
        ['date_debut_global', ''],
        ['date_fin_global', ''],
        ['max_tentatives', '0'],
        ['limite_comptes_par_classe', String(LIMITE_COMPTES_PAR_CLASSE)],
        ['code_lppjr', CODE_LPPJR],
        ['code_aes', 'FGAS2026-MFER']
      ];
      defauts.forEach(l => sh.appendRow(l));
      return sh;
  }
  if (entetes.length > 0) sh.appendRow(entetes);
  return sh;
}

function estVrai(v) {
  return v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1';
}

function lireToutesLignes(sh) {
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return { entetes: data[0] || [], lignes: [] };
  const entetes = data[0];
  const lignes = [];
  for (let i = 1; i < data.length; i++) {
    const obj = { _row: i + 1 };
    entetes.forEach((h, j) => obj[h] = data[i][j]);
    lignes.push(obj);
  }
  return { entetes, lignes };
}

// ========================
// SÉCURITÉ : HASH, HMAC
// ========================
function genererSalt() {
  const bytes = [];
  for (let i = 0; i < 16; i++) bytes.push(Math.floor(Math.random() * 256));
  return Utilities.base64Encode(bytes);
}

function hasherMdp(mdp, salt) {
  // Hash répété (5000 itérations) — pas un vrai PBKDF2 mais suffisant pour le scope
  let h = mdp + ':' + salt;
  for (let i = 0; i < 5000; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h));
  }
  return h;
}

function verifierHmac(donnees, signature) {
  const sig = Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(donnees, HMAC_SECRET)
  );
  return sig === signature;
}

function calculerHmac(donnees) {
  return Utilities.base64Encode(
    Utilities.computeHmacSha256Signature(donnees, HMAC_SECRET)
  );
}

function verifierCodeProf(code) {
  const params = lireParams();
  return code === params.code_lppjr;
}

// ========================
// PARAMÈTRES
// ========================
function lireParams() {
  const sh = getSheet(ONGLET_PARAMS);
  const { lignes } = lireToutesLignes(sh);
  const obj = {};
  lignes.forEach(l => obj[l.cle] = l.valeur);
  return obj;
}

function ecrireParam(cle, valeur) {
  const sh = getSheet(ONGLET_PARAMS);
  const { lignes } = lireToutesLignes(sh);
  const ligne = lignes.find(l => l.cle === cle);
  if (ligne) {
    sh.getRange(ligne._row, 2).setValue(valeur);
  } else {
    sh.appendRow([cle, valeur]);
  }
}

// ========================
// LOG SÉCURITÉ
// ========================
function logSecu(type, classe, pseudo, message) {
  const sh = getSheet(ONGLET_LOGS);
  sh.appendRow([
    new Date().toISOString(),
    type,
    classe || '',
    pseudo || '',
    message || '',
    ''
  ]);
}

// ========================
// ROUTE : check_pseudo
// ========================
function checkPseudo(params) {
  const classe = params.classe;
  const pseudo = (params.pseudo || '').toUpperCase();
  if (!CLASSES_AUTORISEES.includes(classe)) {
    return { ok: false, error: 'Classe inconnue' };
  }
  const sh = getSheet(ONGLET_COMPTES);
  const { lignes } = lireToutesLignes(sh);
  const exists = lignes.some(l => l.classe === classe && (l.pseudo || '').toUpperCase() === pseudo);
  return { ok: true, exists };
}

// ========================
// ROUTE : create_account
// ========================
function createAccount(params) {
  const classe = params.classe;
  const pseudo = (params.pseudo || '').toUpperCase().trim();
  const mdp = params.mdp || classe;

  if (!CLASSES_AUTORISEES.includes(classe)) {
    return { ok: false, error: 'Classe inconnue' };
  }
  if (!pseudo || pseudo.length < 5) {
    return { ok: false, error: 'Pseudo trop court (5 caractères minimum)' };
  }

  const paramsGlobaux = lireParams();
  if (!estVrai(paramsGlobaux['ouvert_' + classe])) {
    return { ok: false, error: 'Le DM est fermé pour la classe ' + classe };
  }

  const sh = getSheet(ONGLET_COMPTES);
  const { lignes } = lireToutesLignes(sh);

  // Vérif limite
  const limite = parseInt(paramsGlobaux.limite_comptes_par_classe || LIMITE_COMPTES_PAR_CLASSE);
  const nbDansClasse = lignes.filter(l => l.classe === classe).length;
  if (nbDansClasse >= limite) {
    logSecu('LIMITE_ATTEINTE', classe, pseudo, 'Création refusée : ' + nbDansClasse + '/' + limite);
    return { ok: false, error: 'La classe ' + classe + ' est complète (' + nbDansClasse + '/' + limite + '). Demande à ton prof.' };
  }

  // Vérif unicité pseudo
  const collision = lignes.find(l => l.classe === classe && (l.pseudo || '').toUpperCase() === pseudo);
  if (collision) {
    return { ok: false, error: 'Pseudo déjà utilisé dans la classe ' + classe + '. Ajoute la lettre suivante de ton nom.', collision: true };
  }

  // Création
  const salt = genererSalt();
  const hash = hasherMdp(mdp, salt);
  sh.appendRow([
    classe,
    pseudo,
    hash,
    salt,
    new Date().toISOString(),
    '',
    0,
    'false',
    '',
    0
  ]);
  logSecu('CREATION', classe, pseudo, 'Compte créé');
  return { ok: true, message: 'Compte créé', classe, pseudo };
}

// ========================
// ROUTE : login
// ========================
function login(params) {
  const classe = params.classe;
  const pseudo = (params.pseudo || '').toUpperCase().trim();
  const mdp = params.mdp || '';

  const sh = getSheet(ONGLET_COMPTES);
  const { lignes } = lireToutesLignes(sh);
  const compte = lignes.find(l => l.classe === classe && (l.pseudo || '').toUpperCase() === pseudo);

  if (!compte) {
    logSecu('LOGIN_ECHEC', classe, pseudo, 'Compte inexistant');
    return { ok: false, error: 'Pseudo inconnu pour cette classe.' };
  }

  // Vérif lockout
  if (compte.verrouille_jusqu_a) {
    const verrouilleJusqua = new Date(compte.verrouille_jusqu_a).getTime();
    if (verrouilleJusqua > Date.now()) {
      const resteSec = Math.ceil((verrouilleJusqua - Date.now()) / 1000);
      return { ok: false, error: 'Compte verrouillé. Réessaie dans ' + resteSec + ' s.' };
    }
  }

  const hash = hasherMdp(mdp, compte.salt);
  if (hash !== compte.hash_mdp) {
    const essais = parseInt(compte.nb_essais_rates || 0) + 1;
    sh.getRange(compte._row, 10).setValue(essais);
    if (essais >= LOCKOUT_MAX_ESSAIS) {
      sh.getRange(compte._row, 9).setValue(new Date(Date.now() + LOCKOUT_DUREE_MS).toISOString());
      sh.getRange(compte._row, 10).setValue(0);
      logSecu('LOCKOUT', classe, pseudo, 'Verrouillé 5 min');
      return { ok: false, error: 'Trop d\'essais ratés. Compte verrouillé 5 minutes.' };
    }
    logSecu('LOGIN_ECHEC', classe, pseudo, 'Mot de passe invalide (' + essais + '/' + LOCKOUT_MAX_ESSAIS + ')');
    return { ok: false, error: 'Mot de passe incorrect (' + essais + '/' + LOCKOUT_MAX_ESSAIS + ').' };
  }

  // Login OK
  sh.getRange(compte._row, 6).setValue(new Date().toISOString());
  sh.getRange(compte._row, 7).setValue(parseInt(compte.nb_connexions || 0) + 1);
  sh.getRange(compte._row, 10).setValue(0);

  const paramsGlobaux = lireParams();
  const mode = paramsGlobaux['mode_' + classe] || 'leger';
  const ouvert = estVrai(paramsGlobaux['ouvert_' + classe]);

  // Renvoie un token signé HMAC pour les requêtes suivantes
  const token = calculerHmac(classe + ':' + pseudo + ':' + Date.now());

  return {
    ok: true,
    classe,
    pseudo,
    mode,
    ouvert,
    code_aes: paramsGlobaux.code_aes || 'FGAS2026-MFER',
    reset_demande: compte.reset_demande === 'true' || compte.reset_demande === true,
    token
  };
}

// ========================
// ROUTE : change_password
// ========================
function changePassword(params) {
  const classe = params.classe;
  const pseudo = (params.pseudo || '').toUpperCase().trim();
  const ancien = params.ancien_mdp || '';
  const nouveau = params.nouveau_mdp || '';

  if (nouveau.length < 4) {
    return { ok: false, error: 'Nouveau mot de passe trop court (4 caractères minimum)' };
  }

  const sh = getSheet(ONGLET_COMPTES);
  const { lignes } = lireToutesLignes(sh);
  const compte = lignes.find(l => l.classe === classe && (l.pseudo || '').toUpperCase() === pseudo);
  if (!compte) return { ok: false, error: 'Compte inexistant' };

  const hashAncien = hasherMdp(ancien, compte.salt);
  if (hashAncien !== compte.hash_mdp) {
    return { ok: false, error: 'Ancien mot de passe incorrect' };
  }

  const nouveauSalt = genererSalt();
  const nouveauHash = hasherMdp(nouveau, nouveauSalt);
  sh.getRange(compte._row, 3).setValue(nouveauHash);
  sh.getRange(compte._row, 4).setValue(nouveauSalt);
  sh.getRange(compte._row, 8).setValue('false');
  logSecu('CHANGE_PWD', classe, pseudo, 'Mot de passe changé');
  return { ok: true };
}

// ========================
// ROUTE : submit_result
// ========================
function submitResult(params) {
  const classe = params.classe;
  const pseudo = (params.pseudo || '').toUpperCase().trim();
  const mode = params.mode;
  const note20 = parseFloat(params.note_20);
  const scorePct = parseFloat(params.score_pct);
  const nbQuestions = parseInt(params.nb_questions);
  const nbCorrectes = parseInt(params.nb_correctes);
  const dureeSec = parseInt(params.duree_sec);
  const nbConsultDiapo = parseInt(params.nb_consultations_diapo || 0);
  const devtoolsOuvert = (params.devtools_ouvert === true || params.devtools_ouvert === 'true') ? 'true' : 'false';
  const detailQuestions = JSON.stringify(params.detail_questions || []);
  const signatureClient = params.hmac_signature || '';

  // Vérif compte existe
  const shC = getSheet(ONGLET_COMPTES);
  const { lignes: comptes } = lireToutesLignes(shC);
  const compte = comptes.find(l => l.classe === classe && (l.pseudo || '').toUpperCase() === pseudo);
  if (!compte) return { ok: false, error: 'Compte inexistant — connexion nécessaire' };

  // Vérif HMAC (anti-bidouille score)
  const donnees = classe + ':' + pseudo + ':' + mode + ':' + note20 + ':' + scorePct + ':' + nbQuestions + ':' + nbCorrectes + ':' + dureeSec;
  const sigAttendue = calculerHmac(donnees);
  if (signatureClient !== sigAttendue) {
    logSecu('HMAC_INVALIDE', classe, pseudo, 'Signature invalide — tentative rejetée');
    return { ok: false, error: 'Signature invalide' };
  }

  // Vérif max_tentatives
  const paramsGlobaux = lireParams();
  const maxTent = parseInt(paramsGlobaux.max_tentatives || 0);
  if (maxTent > 0) {
    const shR = getSheet(ONGLET_RESULTATS);
    const { lignes: resultats } = lireToutesLignes(shR);
    const tentatives = resultats.filter(r => r.classe === classe && (r.pseudo || '').toUpperCase() === pseudo).length;
    if (tentatives >= maxTent) {
      return { ok: false, error: 'Nombre maximum de tentatives atteint (' + maxTent + ')' };
    }
  }

  // Insertion résultat
  const shR = getSheet(ONGLET_RESULTATS);
  const { lignes: resultats } = lireToutesLignes(shR);
  const tentativesPrev = resultats.filter(r => r.classe === classe && (r.pseudo || '').toUpperCase() === pseudo).length;
  const nbTentatives = tentativesPrev + 1;

  shR.appendRow([
    new Date().toISOString(),
    classe,
    pseudo,
    mode,
    note20,
    scorePct,
    nbQuestions,
    nbCorrectes,
    dureeSec,
    nbTentatives,
    nbConsultDiapo,
    devtoolsOuvert,
    detailQuestions,
    signatureClient,
    'false'
  ]);

  if (devtoolsOuvert === 'true') {
    logSecu('DEVTOOLS', classe, pseudo, 'Tentative avec DevTools détecté');
  }

  return { ok: true, note: note20, nb_tentatives: nbTentatives };
}

// ========================
// ROUTE : get_class_status
// ========================
function getClassStatus(params) {
  const classe = params.classe;
  const paramsGlobaux = lireParams();
  return {
    ok: true,
    classe,
    ouvert: estVrai(paramsGlobaux['ouvert_' + classe]),
    mode: paramsGlobaux['mode_' + classe] || 'leger',
    date_debut: paramsGlobaux.date_debut_global || '',
    date_fin: paramsGlobaux.date_fin_global || ''
  };
}

// ========================
// ROUTE : log_event
// ========================
function logEvent(params) {
  logSecu(params.type || 'INFO', params.classe || '', params.pseudo || '', params.message || '');
  return { ok: true };
}

// ========================
// ROUTES PROF
// ========================
function listAccounts(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  const sh = getSheet(ONGLET_COMPTES);
  const { lignes } = lireToutesLignes(sh);
  let resultats = lignes;
  if (params.classe && params.classe !== 'TOUTES') {
    resultats = lignes.filter(l => l.classe === params.classe);
  }
  const limite = parseInt(lireParams().limite_comptes_par_classe || LIMITE_COMPTES_PAR_CLASSE);
  return {
    ok: true,
    comptes: resultats.map(l => ({
      classe: l.classe,
      pseudo: l.pseudo,
      date_creation: l.date_creation,
      derniere_connexion: l.derniere_connexion,
      nb_connexions: l.nb_connexions,
      reset_demande: l.reset_demande === 'true' || l.reset_demande === true
    })),
    limite
  };
}

function listResults(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  const sh = getSheet(ONGLET_RESULTATS);
  const { lignes } = lireToutesLignes(sh);
  let resultats = lignes;
  if (params.classe && params.classe !== 'TOUTES') {
    resultats = lignes.filter(l => l.classe === params.classe);
  }
  return {
    ok: true,
    resultats: resultats.map(l => ({
      _row: l._row,
      date: l.date,
      classe: l.classe,
      pseudo: l.pseudo,
      mode: l.mode,
      note_20: l.note_20,
      score_pct: l.score_pct,
      nb_questions: l.nb_questions,
      nb_correctes: l.nb_correctes,
      duree_sec: l.duree_sec,
      nb_tentatives: l.nb_tentatives,
      nb_consultations_diapo: l.nb_consultations_diapo,
      devtools_ouvert: l.devtools_ouvert === 'true' || l.devtools_ouvert === true,
      detail_questions: l.detail_questions,
      invalidee: l.invalidee === 'true' || l.invalidee === true
    }))
  };
}

function resetPassword(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  const classe = params.classe;
  const pseudo = (params.pseudo || '').toUpperCase().trim();
  const sh = getSheet(ONGLET_COMPTES);
  const { lignes } = lireToutesLignes(sh);
  const compte = lignes.find(l => l.classe === classe && (l.pseudo || '').toUpperCase() === pseudo);
  if (!compte) return { ok: false, error: 'Compte inexistant' };
  const nouveauSalt = genererSalt();
  const nouveauHash = hasherMdp(classe, nouveauSalt);
  sh.getRange(compte._row, 3).setValue(nouveauHash);
  sh.getRange(compte._row, 4).setValue(nouveauSalt);
  sh.getRange(compte._row, 8).setValue('true');
  sh.getRange(compte._row, 9).setValue('');
  sh.getRange(compte._row, 10).setValue(0);
  logSecu('RESET_PWD_PROF', classe, pseudo, 'Reset par prof');
  return { ok: true };
}

function deleteAccount(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  const classe = params.classe;
  const pseudo = (params.pseudo || '').toUpperCase().trim();
  const supprimerNotes = params.supprimer_notes === true || params.supprimer_notes === 'true';

  const shC = getSheet(ONGLET_COMPTES);
  const { lignes: comptes } = lireToutesLignes(shC);
  const compte = comptes.find(l => l.classe === classe && (l.pseudo || '').toUpperCase() === pseudo);
  if (!compte) return { ok: false, error: 'Compte inexistant' };
  shC.deleteRow(compte._row);

  let nbNotesSupprimees = 0;
  if (supprimerNotes) {
    const shR = getSheet(ONGLET_RESULTATS);
    const { lignes: resultats } = lireToutesLignes(shR);
    const aSupprimer = resultats.filter(r => r.classe === classe && (r.pseudo || '').toUpperCase() === pseudo);
    aSupprimer.sort((a, b) => b._row - a._row).forEach(r => {
      shR.deleteRow(r._row);
      nbNotesSupprimees++;
    });
  }
  logSecu('DELETE_ACCOUNT', classe, pseudo, 'Compte supprimé (notes: ' + (supprimerNotes ? 'oui' : 'non') + ')');
  return { ok: true, nb_notes_supprimees: nbNotesSupprimees };
}

function renamePseudo(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  const classe = params.classe;
  const ancien = (params.ancien_pseudo || '').toUpperCase().trim();
  const nouveau = (params.nouveau_pseudo || '').toUpperCase().trim();

  const shC = getSheet(ONGLET_COMPTES);
  const { lignes: comptes } = lireToutesLignes(shC);
  const compte = comptes.find(l => l.classe === classe && (l.pseudo || '').toUpperCase() === ancien);
  if (!compte) return { ok: false, error: 'Compte inexistant' };
  const collision = comptes.find(l => l.classe === classe && (l.pseudo || '').toUpperCase() === nouveau);
  if (collision) return { ok: false, error: 'Le nouveau pseudo existe déjà' };

  shC.getRange(compte._row, 2).setValue(nouveau);
  // Renommer aussi dans résultats
  const shR = getSheet(ONGLET_RESULTATS);
  const { lignes: resultats } = lireToutesLignes(shR);
  resultats.forEach(r => {
    if (r.classe === classe && (r.pseudo || '').toUpperCase() === ancien) {
      shR.getRange(r._row, 3).setValue(nouveau);
    }
  });
  logSecu('RENAME', classe, ancien, 'Renommé en ' + nouveau);
  return { ok: true };
}

function resetClassPasswords(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  const classe = params.classe;
  const sh = getSheet(ONGLET_COMPTES);
  const { lignes } = lireToutesLignes(sh);
  const cibles = lignes.filter(l => l.classe === classe);
  cibles.forEach(c => {
    const nouveauSalt = genererSalt();
    const nouveauHash = hasherMdp(classe, nouveauSalt);
    sh.getRange(c._row, 3).setValue(nouveauHash);
    sh.getRange(c._row, 4).setValue(nouveauSalt);
    sh.getRange(c._row, 8).setValue('true');
    sh.getRange(c._row, 9).setValue('');
    sh.getRange(c._row, 10).setValue(0);
  });
  logSecu('RESET_PWD_CLASSE', classe, '', cibles.length + ' comptes réinitialisés');
  return { ok: true, nb: cibles.length };
}

function clearClass(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  const classe = params.classe;
  const confirmation = params.confirmation || '';
  if (confirmation !== classe) return { ok: false, error: 'Confirmation invalide (taper le nom exact de la classe)' };

  const shC = getSheet(ONGLET_COMPTES);
  const { lignes: comptes } = lireToutesLignes(shC);
  const aSuppr = comptes.filter(l => l.classe === classe);
  aSuppr.sort((a, b) => b._row - a._row).forEach(l => shC.deleteRow(l._row));

  const shR = getSheet(ONGLET_RESULTATS);
  const { lignes: resultats } = lireToutesLignes(shR);
  const aSupprR = resultats.filter(l => l.classe === classe);
  aSupprR.sort((a, b) => b._row - a._row).forEach(l => shR.deleteRow(l._row));

  logSecu('CLEAR_CLASSE', classe, '', aSuppr.length + ' comptes + ' + aSupprR.length + ' résultats supprimés');
  return { ok: true, nb_comptes: aSuppr.length, nb_resultats: aSupprR.length };
}

function deleteResult(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  const row = parseInt(params.row);
  if (!row || row < 2) return { ok: false, error: 'Ligne invalide' };
  const sh = getSheet(ONGLET_RESULTATS);
  const action = params.mode_suppression || 'delete'; // 'delete' ou 'invalidate'
  if (action === 'invalidate') {
    sh.getRange(row, 15).setValue('true');
    return { ok: true, mode: 'invalidate' };
  }
  sh.deleteRow(row);
  return { ok: true, mode: 'delete' };
}

function getSettings(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  return { ok: true, params: lireParams() };
}

function updateSettings(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  const updates = params.updates || {};
  Object.keys(updates).forEach(cle => ecrireParam(cle, updates[cle]));
  logSecu('UPDATE_SETTINGS', '', '', JSON.stringify(updates));
  return { ok: true };
}

function listLogs(params) {
  if (!verifierCodeProf(params.code)) return { ok: false, error: 'Code prof invalide' };
  const sh = getSheet(ONGLET_LOGS);
  const { lignes } = lireToutesLignes(sh);
  let resultats = lignes;
  if (params.classe && params.classe !== 'TOUTES') {
    resultats = lignes.filter(l => l.classe === params.classe);
  }
  // 200 derniers
  return { ok: true, logs: resultats.slice(-200).reverse() };
}

// ========================
// FONCTION D'INIT MANUELLE
// ========================
// Lancer manuellement une fois après collage pour créer les onglets
function initialiser() {
  getSheet(ONGLET_COMPTES);
  getSheet(ONGLET_RESULTATS);
  getSheet(ONGLET_LOGS);
  getSheet(ONGLET_PARAMS);
  Logger.log('Onglets créés.');
}
