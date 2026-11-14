/*!
 * COMPTABLOO — Persistance (processus principal Electron).
 * Toutes les données sont stockées LOCALEMENT dans le dossier utilisateur :
 *   Windows : C:\Users\<nom>\AppData\Roaming\comptabloo\comptabloo-data.json
 * Écriture atomique (fichier temporaire + renommage) pour ne jamais corrompre
 * le fichier, même en cas de coupure de courant. Une sauvegarde horodatée est
 * conservée chaque premier enregistrement de la journée (10 dernières).
 */
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_FILE = 'comptabloo-data.json';
const BACKUP_DIR = 'backups';
const MAX_BACKUPS = 10;

function createStorage(app) {
  const dataPath = path.join(app.getPath('userData'), DATA_FILE);
  const backupDir = path.join(app.getPath('userData'), BACKUP_DIR);

  /** Charge l'état complet. Retourne null si aucun fichier. */
  function load() {
    try {
      if (!fs.existsSync(dataPath)) return null;
      const raw = fs.readFileSync(dataPath, 'utf8');
      if (!raw.trim()) return null;
      return JSON.parse(raw);
    } catch (err) {
      console.error('[comptabloo] Erreur de lecture des données :', err.message);
      // Tente la restauration de la sauvegarde la plus récente
      const restored = restoreLatestBackup();
      if (restored) return restored;
      return null;
    }
  }

  /** Sauvegarde la plus récente du dossier backups, sinon null. */
  function restoreLatestBackup() {
    try {
      if (!fs.existsSync(backupDir)) return null;
      const files = fs.readdirSync(backupDir)
        .filter(function (f) { return /^comptabloo-data-\d{4}-\d{2}-\d{2}\.json$/.test(f); })
        .sort();
      if (!files.length) return null;
      const raw = fs.readFileSync(path.join(backupDir, files[files.length - 1]), 'utf8');
      const data = JSON.parse(raw);
      console.warn('[comptabloo] Données restaurées depuis :', files[files.length - 1]);
      return data;
    } catch (e) {
      return null;
    }
  }

  /** Écriture atomique + sauvegarde quotidienne. */
  function save(data) {
    const json = JSON.stringify(data, null, 2);
    const tmpPath = dataPath + '.tmp';
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(tmpPath, json, 'utf8');
    fs.renameSync(tmpPath, dataPath);
    dailyBackup(json);
    return { ok: true, path: dataPath };
  }

  /** Une sauvegarde par jour maximum, 10 conservées. */
  function dailyBackup(json) {
    try {
      const today = new Date();
      const pad = function (n) { return String(n).padStart(2, '0'); };
      const stamp = today.getFullYear() + '-' + pad(today.getMonth() + 1) + '-' + pad(today.getDate());
      const target = path.join(backupDir, 'comptabloo-data-' + stamp + '.json');
      if (fs.existsSync(target)) return; // déjà fait aujourd'hui
      fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(target, json, 'utf8');
      // Purge : ne garder que les 10 plus récentes
      const files = fs.readdirSync(backupDir)
        .filter(function (f) { return /^comptabloo-data-\d{4}-\d{2}-\d{2}\.json$/.test(f); })
        .sort();
      while (files.length > MAX_BACKUPS) {
        fs.unlinkSync(path.join(backupDir, files.shift()));
      }
    } catch (err) {
      console.error('[comptabloo] Sauvegarde quotidienne impossible :', err.message);
    }
  }

  return {
    load: load,
    save: save,
    dataPath: function () { return dataPath; }
  };
}

module.exports = { createStorage: createStorage };
