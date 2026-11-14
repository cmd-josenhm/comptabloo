/*!
 * COMPTABLOO — Adaptateur de persistance côté rendu.
 *  - Mode application (Electron) : IPC vers le processus principal,
 *    données dans %APPDATA%\comptabloo\comptabloo-data.json.
 *  - Mode navigateur (démo / développement) : localStorage.
 */
(function (root) {
  'use strict';

  const LS_KEY = 'comptabloo-data-v1';

  function isElectron() {
    return !!(root.comptablooAPI && root.comptablooAPI.loadData);
  }

  /* ---------------- Adaptateur Electron ---------------- */

  const electronAdapter = {
    name: 'electron',
    load: function () { return root.comptablooAPI.loadData(); },
    save: function (data) { return root.comptablooAPI.saveData(data); },
    exportBackup: function (data) { return root.comptablooAPI.exportBackup(data); },
    importBackup: function () { return root.comptablooAPI.importBackup(); },
    exportCSV: function (defaultName, content) { return root.comptablooAPI.exportCSV(defaultName, content); }
  };

  /* ---------------- Adaptateur navigateur ---------------- */

  const localAdapter = {
    name: 'local',
    load: function () {
      try {
        const raw = root.localStorage ? root.localStorage.getItem(LS_KEY) : null;
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    save: function (data) {
      try {
        root.localStorage.setItem(LS_KEY, JSON.stringify(data));
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    exportBackup: function (data) {
      // En mode navigateur : téléchargement d'un fichier JSON
      return new Promise(function (resolve) {
        try {
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          const stamp = new Date().toISOString().slice(0, 10);
          a.href = URL.createObjectURL(blob);
          a.download = 'comptabloo-sauvegarde-' + stamp + '.json';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
          resolve({ ok: true, path: a.download });
        } catch (e) {
          resolve({ ok: false, error: e.message });
        }
      });
    },
    importBackup: function () {
      return new Promise(function (resolve) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.style.display = 'none';
        input.addEventListener('change', function () {
          const file = input.files && input.files[0];
          if (!file) return resolve({ ok: false, canceled: true });
          const reader = new FileReader();
          reader.onload = function () {
            try {
              const data = JSON.parse(String(reader.result));
              if (!data || typeof data !== 'object' || !data.settings) {
                return resolve({ ok: false, error: 'Ce fichier n\u2019est pas une sauvegarde COMPTABLOO valide.' });
              }
              resolve({ ok: true, data: data });
            } catch (e) {
              resolve({ ok: false, error: 'Fichier illisible : ' + e.message });
            }
          };
          reader.onerror = function () { resolve({ ok: false, error: 'Lecture impossible.' }); };
          reader.readAsText(file);
        });
        document.body.appendChild(input);
        input.click();
        setTimeout(function () { input.remove(); }, 10000);
      });
    },
    exportCSV: null // géré par COMPTA.ui.exportCSV (téléchargement)
  };

  function detect() {
    return isElectron() ? electronAdapter : localAdapter;
  }

  root.COMPTA = root.COMPTA || {};
  root.COMPTA.db = {
    detect: detect,
    isElectron: isElectron,
    LS_KEY: LS_KEY
  };
})(typeof window !== 'undefined' ? window : this);
