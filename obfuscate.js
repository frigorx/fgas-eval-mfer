/**
 * obfuscate.js — Obfusque le JavaScript de dm.html
 * Optionnel mais recommandé avant déploiement public.
 *
 * Prérequis : npm install javascript-obfuscator
 *
 * Usage :
 *   node obfuscate.js
 *
 * Entrée : dm.html (avec JS lisible)
 * Sortie : dm.obfuscated.html (avec JS obscurci)
 */

const fs = require('fs');
const path = require('path');

let obfuscator;
try {
  obfuscator = require('javascript-obfuscator');
} catch (e) {
  console.error('[ERREUR] Module manquant. Lance d\'abord : npm install javascript-obfuscator');
  console.error('[INFO] Tu peux aussi déployer dm.html non obfusqué — la sécurité repose surtout sur le chiffrement AES + HMAC.');
  process.exit(1);
}

const fichierIn = path.join(__dirname, 'dm.html');
const fichierOut = path.join(__dirname, 'dm.obfuscated.html');

const html = fs.readFileSync(fichierIn, 'utf8');

// Extraire le contenu de la balise <script> principale
const regex = /<script>([\s\S]*?)<\/script>/g;
let match, scripts = [];
while ((match = regex.exec(html)) !== null) {
  scripts.push({ start: match.index, end: regex.lastIndex, contenu: match[1] });
}

if (scripts.length === 0) {
  console.error('[ERREUR] Aucune balise <script> trouvée dans dm.html');
  process.exit(1);
}

// On ne traite que le dernier <script> (le principal)
const cible = scripts[scripts.length - 1];
console.log(`[INFO] Obfuscation du script principal (${cible.contenu.length} caractères)...`);

const optionsObfu = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: false,        // évite les soucis de UX si l'élève ouvre F12 par erreur
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 8,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  unicodeEscapeSequence: false
};

const t0 = Date.now();
const obfuscated = obfuscator.obfuscate(cible.contenu, optionsObfu).getObfuscatedCode();
console.log(`[OK] Obfuscation en ${Date.now() - t0} ms (${obfuscated.length} caractères).`);

const htmlOut = html.slice(0, cible.start) + '<script>' + obfuscated + '</script>' + html.slice(cible.end);
fs.writeFileSync(fichierOut, htmlOut);
console.log(`[OK] dm.obfuscated.html écrit (${htmlOut.length} caractères).`);
console.log(`[INFO] Tu peux maintenant renommer dm.obfuscated.html en dm.html avant push GitHub.`);
