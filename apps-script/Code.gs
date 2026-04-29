/**
 * inerWeb Édu — Apps Script backend
 * Cours interactif F-Gas III (BAC PRO MFER)
 *
 * Fonctions exposées en HTTP :
 *   POST /  action=connect      pseudo, classe       -> inscription élève
 *   POST /  action=answer       pseudo, qid, lettre  -> enregistrer réponse
 *   POST /  action=heartbeat    pseudo, sortie?      -> ping vie + sortie page
 *   POST /  action=set_state    etat, qid?           -> prof change l'état
 *   GET  /  action=state                              -> élève récupère l'état
 *   GET  /  action=results      qid                  -> prof voit qui a répondu
 *   GET  /  action=eleves                             -> liste classe live
 *   GET  /  action=export_notes                       -> CSV des notes finales
 *   GET  /  action=reset_session                      -> RAZ session (prof)
 *
 * Onglets Google Sheet attendus :
 *   eleves              : pseudo | classe | date | dernier_ping | sorties
 *   reponses_checkpoints: timestamp | pseudo | qid | lettre | juste
 *   reponses_qcm        : timestamp | pseudo | qid | bonne_reponse_index
 *   notes_finales       : pseudo | classe | score | sur | version | timestamp
 *   etat_session        : key | value
 *
 * Déploiement : Déployer en tant qu'application Web, accès "Tout le monde",
 * exécuter en tant que "Moi". Récupérer l'URL /exec et la coller dans
 * prof.html et eleve.html (constante GAS_URL).
 *
 * IMPORTANT : Drive Bridge CORS — répondre en text/plain pour éviter le préflight.
 * Côté JS : fetch(url, { method: 'POST', body: JSON.stringify(...) })
 *           sans header Content-Type pour rester en simple request.
 */

const SHEET_ID = '1HdSKRnoXYr4MWn19MI-rU8lcdXRQ_OYza8hbadqXAs4';

const ONGLETS = {
  ELEVES: 'eleves',
  CHECK: 'reponses_checkpoints',
  QCM: 'reponses_qcm',
  NOTES: 'notes_finales',
  ETAT: 'etat_session'
};

function getSheet_(nom) {
  const ss = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nom);
  if (!sh) {
    sh = ss.insertSheet(nom);
    initOnglet_(sh, nom);
  }
  return sh;
}

function initOnglet_(sh, nom) {
  const headers = {
    [ONGLETS.ELEVES]: ['pseudo', 'classe', 'date', 'dernier_ping', 'sorties'],
    [ONGLETS.CHECK]: ['timestamp', 'pseudo', 'qid', 'lettre', 'juste'],
    [ONGLETS.QCM]: ['timestamp', 'pseudo', 'qid', 'reponse_index', 'juste'],
    [ONGLETS.NOTES]: ['pseudo', 'classe', 'score', 'sur', 'version', 'timestamp'],
    [ONGLETS.ETAT]: ['key', 'value']
  };
  if (headers[nom]) {
    sh.appendRow(headers[nom]);
    sh.getRange(1, 1, 1, headers[nom].length).setFontWeight('bold').setBackground('#1b3a63').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
}

function setupAll() {
  Object.values(ONGLETS).forEach(getSheet_);
  setEtat_('phase', 'attente');
  setEtat_('qid_actif', '');
  return 'Onglets initialisés';
}

function reponseJson_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.TEXT);
}

function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  try {
    if (action === 'state') return reponseJson_(getEtatComplet_());
    if (action === 'results') return reponseJson_(getResultats_(e.parameter.qid));
    if (action === 'eleves') return reponseJson_(getEleves_());
    if (action === 'export_notes') return exportNotesCSV_();
    if (action === 'reset_session') return reponseJson_(resetSession_());
    if (action === 'ping') return reponseJson_({ ok: true, ts: Date.now() });
    return reponseJson_({ ok: false, error: 'action inconnue: ' + action });
  } catch (err) {
    return reponseJson_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  let payload = {};
  try { payload = JSON.parse(e.postData.contents || '{}'); } catch (_) {}
  const action = (payload.action || '').toLowerCase();
  try {
    if (action === 'connect') return reponseJson_(connectEleve_(payload));
    if (action === 'answer') return reponseJson_(enregistrerReponse_(payload));
    if (action === 'qcm_answer') return reponseJson_(enregistrerReponseQCM_(payload));
    if (action === 'heartbeat') return reponseJson_(heartbeat_(payload));
    if (action === 'set_state') return reponseJson_(setEtatComplet_(payload));
    if (action === 'submit_qcm') return reponseJson_(soumettreNoteFinale_(payload));
    return reponseJson_({ ok: false, error: 'action inconnue: ' + action });
  } catch (err) {
    return reponseJson_({ ok: false, error: String(err) });
  }
}

// === ÉTAT SESSION ===

function setEtat_(key, value) {
  const sh = getSheet_(ONGLETS.ETAT);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sh.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sh.appendRow([key, value]);
}

function getEtat_(key) {
  const sh = getSheet_(ONGLETS.ETAT);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1];
  }
  return '';
}

function getEtatComplet_() {
  return {
    ok: true,
    phase: getEtat_('phase') || 'attente',
    qid_actif: getEtat_('qid_actif') || '',
    timestamp: Date.now()
  };
}

function setEtatComplet_(payload) {
  if (payload.phase !== undefined) setEtat_('phase', payload.phase);
  if (payload.qid !== undefined) setEtat_('qid_actif', payload.qid);
  return { ok: true, phase: getEtat_('phase'), qid_actif: getEtat_('qid_actif') };
}

function resetSession_() {
  setEtat_('phase', 'attente');
  setEtat_('qid_actif', '');
  return { ok: true, message: 'Session réinitialisée' };
}

// === ÉLÈVES ===

function connectEleve_(p) {
  const pseudo = (p.pseudo || '').toUpperCase().trim();
  const classe = (p.classe || '').toUpperCase().trim();
  if (!pseudo || !classe) return { ok: false, error: 'pseudo et classe requis' };
  const sh = getSheet_(ONGLETS.ELEVES);
  const data = sh.getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === pseudo) {
      sh.getRange(i + 1, 4).setValue(now);
      return { ok: true, pseudo, classe: data[i][1], deja_inscrit: true };
    }
  }
  sh.appendRow([pseudo, classe, now, now, 0]);
  return { ok: true, pseudo, classe, deja_inscrit: false };
}

function getEleves_() {
  const sh = getSheet_(ONGLETS.ELEVES);
  const data = sh.getDataRange().getValues();
  const now = Date.now();
  const liste = [];
  for (let i = 1; i < data.length; i++) {
    const dernier = data[i][3] ? new Date(data[i][3]).getTime() : 0;
    liste.push({
      pseudo: data[i][0],
      classe: data[i][1],
      en_ligne: (now - dernier) < 15000,
      sorties: data[i][4] || 0
    });
  }
  return { ok: true, eleves: liste };
}

function heartbeat_(p) {
  const pseudo = (p.pseudo || '').toUpperCase().trim();
  if (!pseudo) return { ok: false, error: 'pseudo requis' };
  const sh = getSheet_(ONGLETS.ELEVES);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === pseudo) {
      sh.getRange(i + 1, 4).setValue(new Date());
      if (p.sortie) {
        const courant = Number(data[i][4]) || 0;
        sh.getRange(i + 1, 5).setValue(courant + 1);
      }
      return { ok: true };
    }
  }
  return { ok: false, error: 'pseudo inconnu' };
}

// === RÉPONSES CHECKPOINTS ===

function enregistrerReponse_(p) {
  const pseudo = (p.pseudo || '').toUpperCase().trim();
  const qid = p.qid || '';
  const lettre = (p.lettre || '').toUpperCase();
  const juste = p.juste === true ? 1 : 0;
  if (!pseudo || !qid || !lettre) return { ok: false, error: 'pseudo/qid/lettre requis' };
  const sh = getSheet_(ONGLETS.CHECK);
  const data = sh.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === pseudo && data[i][2] === qid) {
      return { ok: false, error: 'Déjà répondu' };
    }
  }
  sh.appendRow([new Date(), pseudo, qid, lettre, juste]);
  return { ok: true };
}

function getResultats_(qid) {
  if (!qid) return { ok: false, error: 'qid requis' };
  const sh = getSheet_(ONGLETS.CHECK);
  const data = sh.getDataRange().getValues();
  const repartition = { A: [], B: [], C: [], D: [] };
  const justes = [];
  const faux = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === qid) {
      const lettre = data[i][3];
      const pseudo = data[i][1];
      if (repartition[lettre]) repartition[lettre].push(pseudo);
      if (data[i][4] === 1) justes.push(pseudo);
      else faux.push({ pseudo, lettre });
    }
  }
  return {
    ok: true,
    qid,
    total: justes.length + faux.length,
    justes,
    faux,
    repartition,
    pourcentage: justes.length + faux.length > 0
      ? Math.round((justes.length / (justes.length + faux.length)) * 100)
      : 0
  };
}

// === QCM FINAL ===

function enregistrerReponseQCM_(p) {
  const pseudo = (p.pseudo || '').toUpperCase().trim();
  const qid = p.qid || '';
  const idx = p.reponse_index;
  const juste = p.juste === true ? 1 : 0;
  if (!pseudo || !qid || idx === undefined) return { ok: false, error: 'champs requis manquants' };
  const sh = getSheet_(ONGLETS.QCM);
  sh.appendRow([new Date(), pseudo, qid, idx, juste]);
  return { ok: true };
}

function soumettreNoteFinale_(p) {
  const pseudo = (p.pseudo || '').toUpperCase().trim();
  const classe = (p.classe || '').toUpperCase().trim();
  const score = Number(p.score) || 0;
  const sur = Number(p.sur) || 20;
  const version = p.version || 'A';
  if (!pseudo) return { ok: false, error: 'pseudo requis' };
  const sh = getSheet_(ONGLETS.NOTES);
  sh.appendRow([pseudo, classe, score, sur, version, new Date()]);
  return { ok: true, pseudo, score, sur };
}

// === EXPORT NOTES ===

function exportNotesCSV_() {
  const sh = getSheet_(ONGLETS.NOTES);
  const data = sh.getDataRange().getValues();
  const lignes = ['pseudo;classe;score;sur;note_sur_20;version;date'];
  for (let i = 1; i < data.length; i++) {
    const note20 = data[i][3] > 0
      ? (Number(data[i][2]) * 20 / Number(data[i][3])).toFixed(2)
      : '0';
    const date = data[i][5] instanceof Date
      ? Utilities.formatDate(data[i][5], 'Europe/Paris', 'yyyy-MM-dd HH:mm')
      : data[i][5];
    lignes.push([data[i][0], data[i][1], data[i][2], data[i][3], note20, data[i][4], date].join(';'));
  }
  return ContentService.createTextOutput(lignes.join('\n')).setMimeType(ContentService.MimeType.TEXT);
}
