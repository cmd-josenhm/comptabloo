<div align="center">


# COMPTABLOO

**La comptabilité simple pour les PME — pensée pour les entrepreneurs débutants.**

Ventes · Achats · Stock · Clients · Fournisseurs · Comptabilité · Rapports

[![Version](https://img.shields.io/badge/version-1.0.0-1666F1.svg)]() [![Plateforme](https://img.shields.io/badge/Windows-10%20%7C%2011%20(64%20bits)-0078D6.svg)]() [![Licence](https://img.shields.io/badge/licence-MIT-green.svg)]() [![Tests](https://img.shields.io/badge/tests-51%2F51%20r%C3%A9ussis-brightgreen.svg)]()

</div>

---

## 🧾 C'est quoi COMPTABLOO ?

**COMPTABLOO** est un logiciel de comptabilité de bureau pour les petites et moyennes entreprises. Il permet à un entrepreneur **sans aucune connaissance comptable** de gérer son activité au quotidien :

- établir des **factures** et des **devis** professionnels (imprimables, avec montant en lettres) ;
- enregistrer ses **achats** fournisseurs et suivre ses **dettes** ;
- suivre son **stock** automatiquement (alertes de rupture incluses) ;
- gérer ses **clients** et **fournisseurs**, avec encours et historiques ;
- tenir sa **comptabilité** sans effort : journal automatique, compte de résultat, TVA ;
- produire des **rapports** clairs, exportables en CSV et imprimables.

### Les 3 promesses de COMPTABLOO

| Promesse | Détail |
|---|---|
| 🔌 **100 % hors ligne** | Aucune connexion Internet n'est requise ni utilisée. Vos données ne quittent jamais votre ordinateur. |
| 🎯 **Simple pour débuter** | Zéro jargon inutile : chaque écran explique ce que vous faites. Un mode démonstration vous entraîne. |
| 🛡️ **Vos données sont à vous** | Stockage local en JSON lisible, sauvegarde quotidienne automatique, export/restauration en un clic. |

---

## ✨ Fonctionnalités

### 📊 Tableau de bord
Revenus encaissés et dépenses du mois, résultat net, créances clients, valeur du stock, dettes fournisseurs, graphique des 12 derniers mois, répartition des ventes par catégorie, alertes de stock, meilleures clients et dernières factures — tout sur un seul écran.

### 🧾 Ventes
Factures **et** devis. Éditeur avec lignes multiples (produit enregistré ou ligne libre), remises par ligne, TVA paramétrable, totaux en temps réel. Encaissements partiels ou complets, statuts automatiques (*payée, partielle, impayée, en retard*), conversion d'un devis en facture en un clic, impression A4 soignée avec **montant en lettres** (« Arrêté le présent document à la somme de… »).

### 🛒 Achats
Bons d'achat fournisseurs avec les mêmes confort de saisie. Chaque achat **réapprovisionne le stock** et alimente la comptabilité dès qu'il est payé.

### 📦 Stock
Stock **entièrement automatique** : les ventes décrémentent, les achats incrémentent, les devis n'y touchent pas. Alertes de seuil et de rupture, valorisation au prix d'achat, ajustements manuels tracés (casse, inventaire, dons…), historique complet par produit, archivage des produits obsolètes.

### 👥 Clients & Fournisseurs
Répertoires avec contact, téléphone, email, adresse. Chaque fiche affiche l'**encours** (ce que le client vous doit) ou la **dette** (ce que vous devez au fournisseur), et l'historique complet des documents.

### 📚 Comptabilité
- **Journal** : chaque encaissement et chaque paiement devient automatiquement une écriture. Ajoutez vos charges courantes (loyer, salaires, électricité…) en écritures manuelles classées.
- **Compte de résultat** : recettes par catégorie, dépenses par catégorie, bénéfice ou perte de la période — en trésorerie, l'approche la plus sûre pour une PME.
- **TVA** : TVA collectée, TVA déductible et TVA à reverser, mois par mois, avec des explications simples.

### 📈 Rapports
10 rapports prêts à l'emploi avec période personnalisable : ventes détaillées, ventes par produit/client, achats détaillés/par fournisseur, état du stock valorisé, balance clients, balance fournisseurs, compte de résultat, journal comptable. **Export CSV** (compatible Excel) et **impression** inclus.

### ⚙️ Paramètres
Nom et logo de l'entreprise (imprimés sur les factures), IFU/NIF, devise (FCFA, €, $, et 8 autres), taux de TVA, préfixes de numérotation, délai de paiement, export/import de sauvegarde, données de démonstration, réinitialisation sécurisée.

---

## 🚀 Démarrage rapide

> Le guide complet (compilation, installation Windows 11, utilisation détaillée) se trouve dans **[USE.md](USE.md)**.

### Prérequis
- **Node.js 18 ou plus récent** (recommandé : LTS 22.x) — [nodejs.org](https://nodejs.org)
- Git (facultatif)

### Lancer le logiciel en mode développement

```bash
git clone https://github.com/cmd-josenhm/comptabloo.git
cd comptabloo
npm install
npm start
```

La fenêtre COMPTABLOO s'ouvre : choisissez *« Découvrir avec des données de démonstration »* pour explorer immédiatement toutes les fonctionnalités.

### Tester l'interface dans un navigateur (mode démonstration)

```bash
npm run serve
# → http://localhost:4173
```

### Lancer les tests automatisés

```bash
npm test
```

**51 tests** couvrent la logique métier (totaux, TVA, statuts, stock dérivé, journal comptable, balances, montant en lettres), les mutations du magasin d'état, la persistance (écriture atomique, sauvegardes) et l'interface complète chargée dans un DOM simulé (onboarding, navigation, création de facture, paiement, stock).

### Générer l'installateur Windows

```bash
npm run dist:win
```

L'installateur `dist/COMPTABLOO-Setup-1.0.0-x64.exe` est prêt pour **Windows 10/11 – 64 bits**. Voir [USE.md](USE.md) pour la procédure d'installation détaillée.

---

## 🏗️ Architecture technique

```
comptabloo/
├── package.json              # Scripts, dépendances, configuration electron-builder
├── build/                    # Icônes de l'application (Windows .ico + .png)
├── assets/                   # Logo et favicon fournis
├── src/
│   ├── main/                 # Processus principal Electron
│   │   ├── main.js           # Fenêtre, menu français, IPC
│   │   ├── preload.js        # Pont sécurisé (contextBridge)
│   │   └── storage.js        # Persistance JSON locale, atomique + backups
│   ├── shared/               # Code partagé rendu + tests
│   │   ├── logic.js          # TOUTE la logique métier (pure, testée)
│   │   └── seed.js           # Données de démonstration
│   └── renderer/             # Interface (HTML/CSS/JS, aucune dépendance)
│       ├── index.html        # Ossature : sidebar + vue + modales
│       ├── css/styles.css    # Design bleu & blanc (charte du logo)
│       └── js/
│           ├── db.js         # Adaptateur Electron / navigateur
│           ├── store.js      # Magasin d'état + mutations métier
│           ├── ui.js         # Composants (modales, toasts, icônes…)
│           ├── charts.js     # Graphiques canvas (sans bibliothèque)
│           ├── app.js        # Routeur + onboarding
│           └── pages/        # Une fichier par écran
├── tests/                    # 51 tests automatisés (node:test + jsdom)
└── scripts/serve.js          # Serveur de développement
```

### Choix de conception

- **Aucune dépendance runtime** : l'interface est du JavaScript natif — pas de React, pas de CDN, pas de police téléchargée. Le logiciel fonctionne indéfiniment hors ligne.
- **Stock, journal et soldes dérivés** : ils ne sont jamais stockés, mais **recalculés** à partir des documents. Résultat : impossible de désynchroniser la comptabilité du stock, même en supprimant ou modifiant une facture après coup.
- **Sécurité Electron** : `contextIsolation` + `sandbox` activés, `nodeIntegration` désactivé, CSP stricte, le rendu ne touche jamais le disque directement (tout passe par un pont IPC minimal).
- **Données lisibles** : un seul fichier JSON, sauvegarde quotidienne automatique (10 derniers jours), export/import manuel.

---

## 🔒 Confidentialité

COMPTABLOO **ne se connecte jamais à Internet** : aucun télémétrie, aucun compte, aucun cloud. Vos données sont stockées ici :

| Système | Emplacement |
|---|---|
| Windows | `C:\Users\<vous>\AppData\Roaming\comptabloo\comptabloo-data.json` |
| | + dossier `backups\` (10 sauvegardes quotidiennes automatiques) |

---

## 📘 Documentation

- **[USE.md](USE.md)** — Guide complet : utilisation du code, compilation pas à pas, installation sur Windows 11 (64 bits), et manuel d'utilisation du logiciel.

## 🤝 Contribuer

Les contributions sont bienvenues ! Forkez le dépôt, créez une branche, assurez-vous que `npm test` passe, puis ouvrez une pull request vers la branche `comptab`.

## 📄 Licence

[MIT](LICENSE) © 2026 COMPTABLOO
