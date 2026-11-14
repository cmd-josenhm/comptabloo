/*!
 * COMPTABLOO — Serveur de développement.
 * Sert l'interface dans un navigateur classique (mode démonstration) :
 *   npm run serve  →  http://localhost:4173
 * Pratique pour tester le rendu sans lancer Electron. En mode navigateur,
 * les données sont conservées dans le localStorage du navigateur.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'src');
const PORT = Number(process.env.PORT || 4173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

function createServer() {
  return http.createServer(function (req, res) {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    // Redirection : les URLs relatives de la page doivent se résoudre sous /renderer/
    if (urlPath === '/') {
      res.writeHead(302, { Location: '/renderer/index.html' });
      return res.end();
    }
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      return res.end('Interdit');
    }
    fs.readFile(filePath, function (err, data) {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Introuvable : ' + urlPath);
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
}

if (require.main === module) {
  createServer().listen(PORT, '0.0.0.0', function () {
    console.log('COMPTABLOO (mode navigateur) : http://localhost:' + PORT);
  });
}

module.exports = { createServer: createServer };
