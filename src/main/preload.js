/*!
 * COMPTABLOO — Script de préchargement (preload).
 * Pont sécurisé entre le rendu (page web) et le processus principal.
 * Aucun accès Node direct n'est exposé à la page : uniquement des fonctions
 * explicites via ipcRenderer.invoke.
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('comptablooAPI', {
  /** Version et plateforme de l'application. */
  getAppInfo: function () { return ipcRenderer.invoke('app:info'); },

  /** Charge l'intégralité des données locales. */
  loadData: function () { return ipcRenderer.invoke('db:load'); },

  /** Enregistre l'état complet (JSON local, atomique). */
  saveData: function (data) { return ipcRenderer.invoke('db:save', data); },

  /** Boîte de dialogue « Enregistrer sous » pour une sauvegarde JSON. */
  exportBackup: function (data) { return ipcRenderer.invoke('backup:export', data); },

  /** Boîte de dialogue « Ouvrir » pour restaurer une sauvegarde JSON. */
  importBackup: function () { return ipcRenderer.invoke('backup:import'); },

  /** Boîte de dialogue « Enregistrer sous » pour un export CSV. */
  exportCSV: function (defaultName, content) { return ipcRenderer.invoke('csv:export', defaultName, content); },

  /** Actions du menu applicatif (Ctrl+N, Ctrl+P…). */
  onMenuAction: function (callback) {
    ipcRenderer.on('menu:action', function (_event, action) { callback(action); });
  }
});
