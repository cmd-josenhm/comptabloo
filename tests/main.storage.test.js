/*!
 * COMPTABLOO — Tests du module de persistance (processus principal).
 * Écriture atomique, sauvegardes quotidiennes, restauration après corruption.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStorage } = require('../src/main/storage.js');

function freshStorage() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'comptabloo-test-'));
  const app = { getPath: function () { return dir; } };
  return { storage: createStorage(app), dir: dir };
}

test('save + load — aller-retour complet', () => {
  const { storage } = freshStorage();
  assert.strictEqual(storage.load(), null, 'aucun fichier au départ');
  const data = { settings: { companyName: 'Test' }, sales: [{ n: 1 }], clients: [] };
  const res = storage.save(data);
  assert.strictEqual(res.ok, true);
  const loaded = storage.load();
  assert.deepStrictEqual(loaded, data);
});

test('save — écriture atomique (pas de fichier temporaire résiduel)', () => {
  const { storage, dir } = freshStorage();
  storage.save({ settings: {} });
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.tmp'));
  assert.strictEqual(files.length, 0, 'aucun .tmp ne doit rester');
  assert.ok(fs.existsSync(path.join(dir, 'comptabloo-data.json')));
});

test('sauvegarde quotidienne — une seule par jour, purge à 10', () => {
  const { storage, dir } = freshStorage();
  const backupDir = path.join(dir, 'backups');
  for (let i = 0; i < 3; i++) storage.save({ settings: {}, i: i }); // même jour -> 1 seule sauvegarde
  let backups = fs.readdirSync(backupDir);
  assert.strictEqual(backups.length, 1, 'une seule sauvegarde par jour');

  // simule 12 jours de sauvegardes
  for (let d = 1; d <= 12; d++) {
    const stamp = '2026-' + String(Math.ceil(d / 2)).padStart(2, '0') + '-01';
    fs.writeFileSync(path.join(backupDir, 'comptabloo-data-' + stamp + '.json'), '{}');
  }
  storage.save({ settings: {} }); // déclenche la purge
  backups = fs.readdirSync(backupDir).sort();
  assert.ok(backups.length <= 10, '10 sauvegardes maximum, obtenu : ' + backups.length);
});

test('fichier corrompu — restauration depuis la sauvegarde la plus récente', () => {
  const { storage, dir } = freshStorage();
  storage.save({ settings: { companyName: 'Ok' }, clients: [1] });
  // corruption du fichier principal
  fs.writeFileSync(path.join(dir, 'comptabloo-data.json'), '{ json cassé', 'utf8');
  const restored = storage.load();
  assert.ok(restored, 'des données doivent être restaurées');
  assert.strictEqual(restored.settings.companyName, 'Ok');
});

test('fichier corrompu sans sauvegarde — retour null (redémarrage propre)', () => {
  const { storage, dir } = freshStorage();
  fs.writeFileSync(path.join(dir, 'comptabloo-data.json'), 'nimporte quoi', 'utf8');
  assert.strictEqual(storage.load(), null);
});
