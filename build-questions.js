/**
 * build-questions.js
 * inerWeb Édu — F. Henninot, LP Privé Jacques Raynaud
 *
 * Chiffre questions.json en questions.enc (AES-GCM 256 bits).
 * Clé dérivée d'un mot de passe via PBKDF2 (200 000 itérations, SHA-256).
 *
 * Usage :
 *   node build-questions.js [--password=FGAS2026-MFER]
 *
 * Sortie :
 *   - questions.enc        : fichier base64 prêt à embarquer dans dm.html
 *   - questions.enc.json   : structure {salt, iv, ciphertext} pour debug
 *
 * Sécurité :
 *   - PBKDF2 200 000 itérations (résistant brute-force jusqu'à mots de passe courts)
 *   - AES-GCM 256 bits (chiffrement authentifié)
 *   - Salt 16 octets aléatoire, IV 12 octets aléatoire
 *   - Le mot de passe N'EST PAS stocké : il est demandé à l'élève après login
 *     OU dérivé automatiquement après authentification compte (cf. Apps Script)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- Lecture des arguments ---
const args = process.argv.slice(2);
let password = 'FGAS2026-MFER';
for (const arg of args) {
  if (arg.startsWith('--password=')) {
    password = arg.slice('--password='.length);
  }
}

const inputFile = path.join(__dirname, 'questions.json');
const outputFileEnc = path.join(__dirname, 'questions.enc');
const outputFileJson = path.join(__dirname, 'questions.enc.json');

// --- Lecture du JSON en clair ---
if (!fs.existsSync(inputFile)) {
  console.error(`[ERREUR] Fichier introuvable : ${inputFile}`);
  process.exit(1);
}

const jsonClair = fs.readFileSync(inputFile, 'utf8');
const jsonObj = JSON.parse(jsonClair);
const nbQuestions = (jsonObj.phase1?.length || 0) + (jsonObj.phase2?.length || 0);
console.log(`[INFO] Lecture de questions.json : ${nbQuestions} questions trouvées.`);

// --- Génération du sel et de l'IV ---
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);

// --- Dérivation de la clé via PBKDF2 ---
console.log(`[INFO] Dérivation de la clé (PBKDF2, 200 000 itérations)...`);
const t0 = Date.now();
const key = crypto.pbkdf2Sync(password, salt, 200000, 32, 'sha256');
console.log(`[INFO] Clé dérivée en ${Date.now() - t0} ms.`);

// --- Chiffrement AES-GCM ---
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(jsonClair, 'utf8'), cipher.final()]);
const authTag = cipher.getAuthTag();
const fullCiphertext = Buffer.concat([ciphertext, authTag]);

// --- Encodage base64 ---
const blob = {
  v: '1',
  alg: 'AES-256-GCM',
  kdf: 'PBKDF2-SHA256',
  iter: 200000,
  salt: salt.toString('base64'),
  iv: iv.toString('base64'),
  ct: fullCiphertext.toString('base64')
};

// --- Sortie 1 : fichier .enc compact (base64 d'un JSON) ---
const blobBase64 = Buffer.from(JSON.stringify(blob), 'utf8').toString('base64');
fs.writeFileSync(outputFileEnc, blobBase64);
console.log(`[OK] questions.enc écrit (${blobBase64.length} caractères base64).`);

// --- Sortie 2 : structure lisible pour debug ---
fs.writeFileSync(outputFileJson, JSON.stringify(blob, null, 2));
console.log(`[OK] questions.enc.json écrit (debug).`);

// --- Test de déchiffrement intégrité ---
console.log(`[INFO] Test de déchiffrement (vérification d'intégrité)...`);
const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
decipher.setAuthTag(authTag);
const dechiffre = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
if (dechiffre === jsonClair) {
  console.log(`[OK] Déchiffrement vérifié — le fichier .enc est exploitable.`);
} else {
  console.error(`[ERREUR] Déchiffrement invalide.`);
  process.exit(1);
}

// --- Snippet JS Web Crypto à intégrer dans dm.html ---
console.log(`\n[INFO] Snippet JS Web Crypto pour dm.html :\n`);
console.log(`async function dechiffrerQuestions(blobBase64, motDePasse) {`);
console.log(`  const blob = JSON.parse(atob(blobBase64));`);
console.log(`  const salt = Uint8Array.from(atob(blob.salt), c => c.charCodeAt(0));`);
console.log(`  const iv   = Uint8Array.from(atob(blob.iv),   c => c.charCodeAt(0));`);
console.log(`  const ct   = Uint8Array.from(atob(blob.ct),   c => c.charCodeAt(0));`);
console.log(`  const enc  = new TextEncoder();`);
console.log(`  const baseKey = await crypto.subtle.importKey(`);
console.log(`    'raw', enc.encode(motDePasse), 'PBKDF2', false, ['deriveKey']);`);
console.log(`  const key = await crypto.subtle.deriveKey(`);
console.log(`    { name: 'PBKDF2', salt, iterations: blob.iter, hash: 'SHA-256' },`);
console.log(`    baseKey,`);
console.log(`    { name: 'AES-GCM', length: 256 },`);
console.log(`    false, ['decrypt']);`);
console.log(`  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);`);
console.log(`  return JSON.parse(new TextDecoder().decode(plain));`);
console.log(`}\n`);

console.log(`[FIN] Mot de passe utilisé : ${password}`);
console.log(`[FIN] À fournir à l'élève (ou dérivé automatiquement après login compte).`);
