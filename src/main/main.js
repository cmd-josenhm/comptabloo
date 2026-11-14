/*!
 * COMPTABLOO — Processus principal Electron.
 * Fenêtre, menu français, IPC de persistance locale. Aucune connexion réseau
 * n'est requise ni établie par l'application.
 */
'use strict';

const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { createStorage } = require('./storage.js');

const APP_URL = path.join(__dirname, '..', 'renderer', 'index.html');
const isDev = process.argv.includes('--dev');

/* ------------------------------------------------------------------ */
/* Instance unique                                                     */
/* ------------------------------------------------------------------ */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', function () {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

let mainWindow = null;

function createWindow() {
  // Icône de fenêtre (en développement uniquement ; l'exécutable Windows porte sa propre icône)
  const iconPath = path.join(__dirname, '..', '..', 'build', 'icon.png');
  const windowOptions = {
    width: 1440,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    backgroundColor: '#EDF2F8',
    title: 'COMPTABLOO',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  };
  if (fs.existsSync(iconPath)) windowOptions.icon = iconPath;

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile(APP_URL);
  mainWindow.once('ready-to-show', function () { mainWindow.show(); });

  // Les clics sur liens externes (rare) s'ouvrent dans le navigateur du système
  mainWindow.webContents.setWindowOpenHandler(function () { return { action: 'deny' }; });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('closed', function () { mainWindow = null; });
}

/* ------------------------------------------------------------------ */
/* Menu en français                                                    */
/* ------------------------------------------------------------------ */
function sendAction(action) {
  if (mainWindow) mainWindow.webContents.send('menu:action', action);
}

function buildMenu() {
  const template = [
    {
      label: '&Fichier',
      submenu: [
        { label: 'Nouvelle facture de vente', accelerator: 'CmdOrCtrl+N', click: function () { sendAction('new-invoice'); } },
        { label: 'Nouvel achat', accelerator: 'CmdOrCtrl+Shift+N', click: function () { sendAction('new-purchase'); } },
        { type: 'separator' },
        { label: 'Imprimer…', accelerator: 'CmdOrCtrl+P', click: function () { sendAction('print'); } },
        { type: 'separator' },
        { label: 'Quitter', role: 'quit' }
      ]
    },
    {
      label: '&Affichage',
      submenu: [
        { label: 'Recharger', accelerator: 'CmdOrCtrl+R', click: function (item, win) { win.reload(); } },
        { label: 'Plein écran', accelerator: 'F11', click: function (item, win) { win.setFullScreen(!win.isFullScreen()); } },
        { type: 'separator' },
        { label: 'Zoom avant', accelerator: 'CmdOrCtrl+=', click: function (item, win) { win.webContents.setZoomLevel(Math.min(3, win.webContents.getZoomLevel() + 0.5)); } },
        { label: 'Zoom arrière', accelerator: 'CmdOrCtrl+-', click: function (item, win) { win.webContents.setZoomLevel(Math.max(-2, win.webContents.getZoomLevel() - 0.5)); } },
        { label: 'Zoom normal', accelerator: 'CmdOrCtrl+0', click: function (item, win) { win.webContents.setZoomLevel(0); } }
      ]
    },
    {
      label: '&Aide',
      submenu: [
        {
          label: 'Guide d\u2019utilisation (README)',
          click: function () {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'COMPTABLOO — Aide',
              message: 'Guide d\u2019utilisation',
              detail: 'Le guide complet (README.md et USE.md) se trouve à la racine du code source.\n\nRappel : toutes vos données restent sur cet ordinateur, aucune connexion Internet n\u2019est nécessaire ni utilisée.'
            });
          }
        },
        {
          label: 'Où sont mes données ?',
          click: function () {
            const storage = createStorage(app);
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Emplacement des données',
              message: 'Vos données sont enregistrées sur cet ordinateur :',
              detail: storage.dataPath() + '\n\nUne sauvegarde automatique quotidienne est conservée dans le sous-dossier « backups » (10 dernières).'
            });
          }
        },
        { type: 'separator' },
        {
          label: 'À propos de COMPTABLOO',
          click: function () {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'À propos',
              message: 'COMPTABLOO ' + app.getVersion(),
              detail: 'Comptabilité simple pour les PME.\n100% hors ligne — vos données restent sur votre ordinateur.\n\nCopyright © 2026 COMPTABLOO — Licence MIT.'
            });
          }
        }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */
function registerIpc() {
  const storage = createStorage(app);

  ipcMain.handle('app:info', function () {
    return { version: app.getVersion(), platform: process.platform, dataPath: storage.dataPath() };
  });

  ipcMain.handle('db:load', function () {
    return storage.load();
  });

  ipcMain.handle('db:save', function (_event, data) {
    try {
      return storage.save(data);
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('backup:export', async function (_event, data) {
    const stamp = new Date().toISOString().slice(0, 10);
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter une sauvegarde COMPTABLOO',
      defaultPath: 'comptabloo-sauvegarde-' + stamp + '.json',
      filters: [{ name: 'Sauvegarde COMPTABLOO', extensions: ['json'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return { ok: true, path: filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('backup:import', async function () {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Restaurer une sauvegarde COMPTABLOO',
      filters: [{ name: 'Sauvegarde COMPTABLOO', extensions: ['json'] }],
      properties: ['openFile']
    });
    if (canceled || !filePaths || !filePaths.length) return { ok: false, canceled: true };
    try {
      const raw = fs.readFileSync(filePaths[0], 'utf8');
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || !data.settings) {
        return { ok: false, error: 'Ce fichier n\u2019est pas une sauvegarde COMPTABLOO valide.' };
      }
      return { ok: true, data: data };
    } catch (err) {
      return { ok: false, error: 'Fichier illisible : ' + err.message };
    }
  });

  ipcMain.handle('csv:export', async function (_event, defaultName, content) {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Exporter un rapport CSV',
      defaultPath: defaultName,
      filters: [{ name: 'Fichier CSV', extensions: ['csv'] }]
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    try {
      // BOM UTF-8 : accents corrects dans Excel
      fs.writeFileSync(filePath, '\uFEFF' + content, 'utf8');
      return { ok: true, path: filePath };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });
}

/* ------------------------------------------------------------------ */
/* Cycle de vie                                                        */
/* ------------------------------------------------------------------ */
app.whenReady().then(function () {
  registerIpc();
  buildMenu();
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
