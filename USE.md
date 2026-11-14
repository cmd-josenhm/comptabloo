# USE.md — Guide complet de COMPTABLOO

> **Ce document explique tout** : comment utiliser le code source, le compiler, produire
> l'installateur Windows, installer le logiciel sur un PC **Windows 11 – 64 bits**, puis
> l'utiliser au quotidien comme entrepreneur.
>
> Sommaire :
> - **Partie 1 — Utiliser le code** (prérequis, installation, développement, tests, architecture)
> - **Partie 2 — Compiler et installer sur Windows 11 (64 bits)** (pas à pas, sans rien omettre)
> - **Partie 3 — Manuel d'utilisation du logiciel** (chaque écran expliqué simplement)
> - **Partie 4 — Dépannage et questions fréquentes**

---

# Partie 1 — Utiliser le code

## 1.1 Prérequis

| Outil | Version | Où le trouver | Obligatoire pour |
|---|---|---|---|
| **Node.js** | 18 minimum, **22.x LTS recommandé** | [https://nodejs.org](https://nodejs.org) (choisir *LTS*, installer en cliquant « Next ») | Développer, tester, compiler |
| **Git** | toute version récente | [https://git-scm.com](https://git-scm.com) | Récupérer le code (facultatif : un ZIP suffit) |
| **Windows** | 10 ou 11, **64 bits** | — | Compiler l'installateur `.exe` |

> 💡 **Vérification** : ouvrez une invite de commandes (`⊞ Win` puis tapez `cmd`, Entrée) et tapez :
> ```
> node -v
> npm -v
> ```
> Vous devez voir un numéro de version (ex. `v22.x.x`). Si « commande inconnue », Node.js n'est pas installé ou n'a pas été ajouté au PATH : relancez son installateur.

## 1.2 Récupérer le code source

**Option A — avec Git (recommandé) :**
```bat
git clone https://github.com/cmd-josenhm/comptabloo.git
cd comptabloo
```

**Option B — sans Git :**
1. Sur la page GitHub du projet, bouton vert **« <> Code » → « Download ZIP »** ;
2. Décompressez le ZIP (clic droit → *Extraire tout…*), par exemple dans `Documents\comptabloo` ;
3. Ouvrez une invite de commandes **dans ce dossier** (dans l'explorateur : cliquez dans la barre d'adresse, tapez `cmd`, Entrée).

## 1.3 Installer les dépendances (une seule fois)

```bat
npm install
```

Cette commande télécharge les outils de développement (Electron, electron-builder, jsdom).
⚠️ **Une connexion Internet est nécessaire à cette étape uniquement** — le logiciel final,
lui, fonctionne 100 % hors ligne. Attendez la fin (1 à 3 minutes selon la connexion).

## 1.4 Lancer le logiciel en mode développement

```bat
npm start
```

La fenêtre **COMPTABLOO** s'ouvre avec l'écran de bienvenue (voir Partie 3).

Astuce : `npx electron . --dev` ouvre également les outils de développeur (console).

## 1.5 Tester l'interface dans un navigateur

```bat
npm run serve
```

Puis ouvrez [http://localhost:4173](http://localhost:4173) dans Chrome, Edge ou Firefox.
C'est le **mode démonstration navigateur** : exactement la même interface, mais les données
sont conservées dans le *localStorage* du navigateur (à ne pas utiliser en production).

## 1.6 Lancer les tests automatisés

```bat
npm test
```

Vous devez voir :

```
# tests 51
# pass 51
# fail 0
```

Les 51 tests vérifient :
- les **totaux de documents** (remises, TVA, arrondis par devise) ;
- les **statuts de paiement** (impayée → partielle → payée, retards d'échéance) ;
- la **numérotation** (jamais de numéro réutilisé) ;
- le **stock dérivé** (ventes, achats, devis sans effet, ajustements, suppressions et modifications rétroactives) ;
- le **journal comptable** (paiements → écritures, périodes, TVA collectée/déductible) ;
- les **balances clients/fournisseurs** et les analyses ;
- le **montant en lettres** français (« deux cent quatre-vingt-quinze mille francs CFA ») ;
- le **magasin d'état** (création, modification, suppression, garde-fous) ;
- la **persistance** (écriture atomique, sauvegarde quotidienne, restauration après coupure) ;
- **l'interface complète** chargée dans un DOM simulé : onboarding, navigation dans les 9 écrans,
  création d'un client, d'un produit, d'une facture avec décrément du stock, enregistrement
  d'un paiement, journal, rapports, paramètres, persistance.

## 1.7 Architecture du code (pour comprendre ou modifier)

```
comptabloo/
├── package.json              ← scripts npm + configuration de compilation (electron-builder)
├── build/                    ← icônes Windows (icon.ico multi-tailles, icon.png 512px)
├── assets/                   ← logo.png et favicon.png d'origine
│
├── src/
│   ├── main/                 ← LE MOTEUR (processus principal Electron, Node.js)
│   │   ├── main.js           ← fenêtre, menu « Fichier/Affichage/Aide », dialogues, IPC
│   │   ├── preload.js        ← pont sécurisé : expose 7 fonctions au rendu (aucun Node direct)
│   │   └── storage.js        ← lecture/écriture du fichier de données (atomique) + backups
│   │
│   ├── shared/               ← LA LOGIQUE MÉTIER (100 % pure, partagée rendu + tests)
│   │   ├── logic.js          ← totaux, TVA, statuts, stock DÉRIVÉ, journal DÉRIVÉ, balances,
│   │   │                       analyses, devises, montant en lettres, normalisation
│   │   └── seed.js           ← générateur du jeu de démonstration (dates relatives à aujourd'hui)
│   │
│   └── renderer/             ← L'INTERFACE (HTML/CSS/JS natifs, aucune bibliothèque)
│       ├── index.html        ← ossature : sidebar 8 modules + vue + modales + zone d'impression
│       ├── css/styles.css    ← design bleu & blanc (variables CSS en tête de fichier)
│       └── js/
│           ├── db.js         ← adaptateur de persistance : IPC Electron OU localStorage
│           ├── store.js      ← magasin d'état central : toutes les mutations métier y passent
│           ├── ui.js         ← composants réutilisables (h(), modales, toasts, badges, CSV…)
│           ├── charts.js     ← graphiques canvas dessinés à la main (barres, anneau)
│           ├── app.js        ← amorçage, routeur par hash (#/sales…), onboarding, menu
│           └── pages/        ← un fichier par écran :
│               ├── docs.js       éditeur de factures/devis/achats + paiements + impression A4
│               ├── dashboard.js  tableau de bord
│               ├── sales.js      liste des ventes
│               ├── purchases.js  liste des achats
│               ├── stock.js      produits, ajustements, historique des mouvements
│               ├── contacts.js   clients & fournisseurs (composant partagé)
│               ├── accounting.js journal, compte de résultat, TVA
│               ├── reports.js    10 rapports + CSV + impression
│               └── settings.js   paramètres et gestion des données
│
├── tests/                    ← 51 tests automatisés (node:test + jsdom)
└── scripts/serve.js          ← mini-serveur HTTP pour le mode navigateur
```

### Comment circule une action

```
Clic utilisateur → pages/*.js → store.js (mutation métier validée)
                                 ├→ logic.js (recalculs purs)
                                 ├→ db.js → IPC preload → main/storage.js (écriture disque)
                                 └→ notification → ré-affichage de la page courante
```

### Le principe clé : tout est DÉRIVÉ

Le stock courant, le journal comptable, les soldes clients et les statuts **ne sont jamais
enregistrés** : ils sont recalculés à partir des documents (factures, achats, ajustements,
paiements). Conséquence : modifiez ou supprimez une facture datée de 3 mois, le stock,
la comptabilité et les balances restent **toujours exacts**. Ce principe élimine toute
désynchronisation — c'est lui qui est vérifié par la majorité des tests.

### Personnalisations fréquentes

| Envie | Où | Comment |
|---|---|---|
| Changer les couleurs | `src/renderer/css/styles.css` | variables `:root` en tête (`--primary`, `--navy-900`…) |
| Changer la TVA par défaut | `src/shared/logic.js` | `defaultSettings().taxRate` |
| Ajouter une catégorie comptable | `src/renderer/js/store.js` | tableaux `INCOME_CATEGORIES` / `EXPENSE_CATEGORIES` |
| Ajouter une devise | `src/shared/logic.js` | objet `CURRENCIES` |
| Modifier le menu Aide | `src/main/main.js` | fonction `buildMenu()` |
| Modifier le jeu de démonstration | `src/shared/seed.js` | listes clients/produits en tête de fonction |

---

# Partie 2 — Compiler et installer sur Windows 11 (64 bits)

Cette partie transforme le code source en **vrai logiciel Windows installable**, avec icône,
raccourcis bureau et menu démarrer, et désinstallation propre.

## 2.1 Résumé en 4 commandes

```bat
git clone https://github.com/cmd-josenhm/comptabloo.git
cd comptabloo
npm install
npm run dist:win
```

À la fin, l'installateur se trouve ici :

```
comptabloo\dist\COMPTABLOO-Setup-1.0.0-x64.exe
```

## 2.2 Détail pas à pas

1. **Installez Node.js LTS** (voir 1.1) puis redémarrez l'invite de commandes.
2. **Placez-vous dans le dossier du projet** (voir 1.2).
3. **`npm install`** — installe les outils (une seule fois ; Internet requis).
4. **`npm run dist:win`** — compile l'application. Comptez **3 à 10 minutes** la première
   fois (téléchargement du moteur Electron pour Windows). La commande se termine sans
   message d'erreur et affiche le dossier `dist`.

### Contenu du dossier `dist\` après compilation

| Fichier / dossier | Rôle |
|---|---|
| `COMPTABLOO-Setup-1.0.0-x64.exe` | ✅ **L'installateur** à distribuer sur chaque poste |
| `win-unpacked\COMPTABLOO.exe` | Version « décompressée » : lancez-la directement sans installation (tests rapides) |

> 💡 **Version portable (clé USB)** : `npm run dist:win:portable` produit un `.exe`
> unique qui s'exécute sans installation ni droits administrateur — idéal pour transporter
> le logiciel. Les données sont alors enregistrées à côté de l'exécutable.

## 2.3 Installer COMPTABLOO sur un PC Windows 11

1. **Double-cliquez** sur `COMPTABLOO-Setup-1.0.0-x64.exe`.
2. Si Windows affiche *« Windows a protégé votre ordinateur »* (SmartScreen) :
   c'est normal pour un logiciel récent non référencé chez Microsoft. Cliquez
   **« Informations complémentaires » → « Exécuter quand même »**.
   *(Pour supprimer définitivement cet avertissement : signez l'exécutable avec un
   certificat de signature de code — voir 2.6.)*
3. L'assistant d'installation s'ouvre :
   - **Emplacement d'installation** : le chemin proposé par défaut installe pour
     l'utilisateur courant — aucun droit administrateur n'est requis ;
     vous pouvez aussi changer le dossier (ex. `C:\Program Files\comptabloo`,
     Windows demandera alors l'autorisation administrateur) ;
   - cliquez **Installer**, puis **Terminer**.
4. COMPTABLOO est disponible :
   - icône sur le **Bureau** ;
   - raccourci **COMPTABLOO** dans le menu Démarrer ;
   - entrée « COMPTABLOO » dans *Paramètres → Applications* pour le désinstaller.

## 2.4 Premier lancement

Au premier démarrage, l'écran de bienvenue vous propose :
- **« Démarrer avec un compte vide »** : pour commencer votre vraie comptabilité ;
- **« Découvrir avec des données de démonstration »** : un jeu de données complet
  (clients, produits, factures sur 8 mois…) pour explorer sans risque.
  Vous pourrez l'effacer ensuite depuis *Paramètres → Mes données*.

## 2.5 Où sont enregistrées vos données ? (très important)

| Contenu | Emplacement Windows |
|---|---|
| Fichier de données | `C:\Users\<vous>\AppData\Roaming\comptabloo\comptabloo-data.json` |
| Sauvegardes quotidiennes automatiques | `C:\Users\<vous>\AppData\Roaming\comptabloo\backups\` (10 derniers jours) |

Le fichier de données est du **JSON lisible** (vous pouvez l'ouvrir avec le Bloc-notes).
Menu **Aide → « Où sont mes données ? »** affiche le chemin exact sur votre machine.

> 🗑️ La désinstallation du logiciel **conserve** vos données (elles ne sont pas supprimées
> avec le programme). Pour un effacement total, supprimez également le dossier
> `AppData\Roaming\comptabloo`.

## 2.6 (Avancé) Signer l'installateur

L'exécutable produit n'est pas signé : Windows SmartScreen peut afficher un avertissement
au premier lancement. Pour le supprimer pour vos clients :
1. achetez un **certificat de signature de code** auprès d'une autorité (Sectigo, DigiCert…) ;
2. ajoutez dans `package.json` → `"build"` → `"win"` :
   ```json
   "certificateFile": "chemin/vers/mon-certificat.pfx",
   "certificatePassword": "mot-de-passe"
   ```
3. relancez `npm run dist:win`.

## 2.7 Mettre à jour le logiciel

1. Récupérez la nouvelle version du code (`git pull` ou nouveau ZIP) ;
2. `npm install` si les dépendances ont changé ;
3. `npm run dist:win` ;
4. installez le nouveau `.exe` par-dessus l'ancien — **vos données sont conservées**
   (elles vivent dans `AppData`, pas dans le dossier d'installation).

---

# Partie 3 — Manuel d'utilisation du logiciel

## 3.0 Premiers pas recommandés (5 minutes)

1. **Paramètres → Mon entreprise** : nom, téléphone, adresse, IFU/NIF, et éventuellement
   votre **logo** (il apparaîtra sur vos factures) → *Enregistrer*.
2. **Paramètres → Facturation et devise** : vérifiez la devise (FCFA par défaut) et le taux
   de TVA (18 % par défaut).
3. **Clients** : créez votre premier client (*+ Nouveau client*).
4. **Stock** : créez vos produits (*+ Nouveau produit*) avec prix d'achat, prix de vente et
   stock initial.
5. **Ventes → + Nouvelle facture** : sélectionnez le client, choisissez un produit
   (description et prix se remplissent seuls), ajustez la quantité → *Créer le document*.
6. Enregistrez le **paiement** (icône carte bancaire dans la liste) puis **imprimez** la
   facture (icône imprimante).

Félicitations : votre stock a bougé, votre journal comptable s'est rempli et votre tableau
de bord s'est animé — automatiquement.

## 3.1 Tableau de bord

| Indicateur | Signification |
|---|---|
| **Revenus encaissés (mois)** | Argent réellement reçu de vos clients ce mois (paiements) |
| **Dépenses payées (mois)** | Argent réellement sorti ce mois (fournisseurs + charges) |
| **Résultat du mois** | Recettes − dépenses : votre bénéfice (ou perte) de trésorerie |
| **Créances clients** | Total des factures non réglées (à relancer !) |
| **Valeur du stock** | Ce que vaut votre marchandise au prix d'achat |
| **Dettes fournisseurs** | Ce que vous devez encore payer à vos fournisseurs |

Le graphique montre 12 mois de recettes/dépenses ; l'anneau répartit vos ventes par
catégorie de produits. En bas : dernières ventes, alertes de stock et meilleurs clients.

## 3.2 Ventes (factures et devis)

**Créer une facture**
1. *Ventes → + Nouvelle facture* ;
2. choisissez le **client**, la date (l'échéance se calcule selon votre délai par défaut) ;
3. ajoutez des lignes : sélectionnez un **produit** (la description et le prix de vente se
   remplissent automatiquement — modifiables) ou tapez une description libre (prestation,
   service…) ; indiquez quantité, prix unitaire et éventuellement une **remise %** par ligne ;
4. le taux de **TVA** est modifiable sur le document ;
5. *Enregistrer*, ou *Enregistrer et imprimer*.

**Encaisser un paiement**
Icône paiement sur la ligne de la facture → le montant restant dû est pré-rempli →
*Ajouter le paiement*. Le statut passe automatiquement à *Partielle* ou *Payée*. Chaque
paiement s'écrit tout seul dans le journal comptable.

**Devis**
Même saisie qu'une facture. Un devis **ne modifie pas le stock**. Quand le client confirme :
ouvrez le devis → *Convertir en facture*. La facture est créée, le devis est marqué « Facturé ».

**Statuts automatiques** : Payée (vert) · Partielle (orange) · Impayée (bleu) ·
**En retard** (rouge, échéance dépassée). Les couleurs vous indiquent immédiatement qui relancer.

**Impression** : format A4 professionnel — vos coordonnées et logo, celles du client, le
détail des lignes, les totaux, la TVA, l'historique des paiements et le **montant en
lettres** (« Arrêté le présent document à la somme de… »), indispensable dans de nombreux
pays d'Afrique de l'Ouest. Depuis la boîte d'impression Windows, vous pouvez aussi
**enregistrer en PDF**.

## 3.3 Achats

Mes achats fournisseurs : même logique que les ventes. Chaque achat **augmente le stock**
des produits sélectionnés et, une fois payé, s'inscrit comme dépense en comptabilité.
Le bouton paiement enregistre les règlements (acomptes acceptés) ; la colonne
« Reste à payer » suit vos dettes par fournisseur.

## 3.4 Stock

- **Le stock est automatique** : ventes −, achats +, devis sans effet.
- **Alertes** : chaque produit a un *seuil d'alerte* ; sous le seuil → badge orange
  « Stock faible », à zéro → badge rouge « Rupture ». La coche « Alertes seulement »
  filtre la liste.
- **Ajustement** : entrée ou sortie manuelle **tracée** (marchandise endommagée,
  inventaire, don, retour…) — à privilégier plutôt que de modifier le stock initial.
- **Historique** (icône horloge) : tous les mouvements d'un produit, avec le stock après
  chaque opération.
- **Archivage** : un produit obsolète ne se supprime pas (il figure dans des documents) :
  archivez-le, il disparaît des nouveaux documents mais reste dans l'historique.
- **Valeur du stock** = quantités × prix d'achat.

## 3.5 Clients & Fournisseurs

Répertoires simples (nom, contact, téléphone, email, adresse, notes). La colonne **Encours**
(ou **Dette**) indique ce qui reste à encaisser (ou à payer) ; l'icône œil ouvre l'historique
complet des documents du contact. Un contact utilisé dans des documents ne peut pas être
supprimé — ses données comptables doivent rester intactes.

## 3.6 Comptabilité

**Journal** — liste chronologique de toutes les opérations :
- recettes : chaque encaissement de facture (badge bleu « Vente ») ;
- dépenses : chaque paiement d'achat (badge violet) et vos **écritures manuelles**
  (badge gris) : loyer, salaires, électricité, transport… bouton *+ Nouvelle écriture*.

**Compte de résultat** — choisissez une période (mois, trimestre, année, dates précises) :
recettes par catégorie, dépenses par catégorie, et **résultat** = bénéfice ou perte.
Imprimable.

**TVA** — TVA collectée (sur vos ventes facturées) − TVA déductible (sur vos achats) =
**TVA à reverser** à l'État (ou crédit de TVA si négatif). Détail mois par mois fourni.

> L'approche retenue est la **trésorerie** : une recette est comptée quand l'argent entre,
> une dépense quand il sort. C'est l'approche la plus naturelle et la plus prudente pour
> piloter une petite entreprise.

## 3.7 Rapports

Dix rapports, une période au choix (raccourcis ou dates précises), puis **Exporter CSV**
(ouvrable dans Excel — séparateur « ; » et accents gérés) ou **Imprimer** :

Ventes détaillées · Ventes par produit · Ventes par client · Achats détaillés · Achats par
fournisseur · État du stock (valorisé) · Balance clients (créances) · Balance
fournisseurs (dettes) · Compte de résultat · Journal comptable.

## 3.8 Paramètres

- **Mon entreprise** : identité imprimée sur les documents + logo + pied de facture.
- **Facturation et devise** : devise (12 devises : FCFA, €, $, £, GNF, GHS…), TVA, délai de
  paiement, préfixes (FACT / DEVIS / ACH).
- **Mes données** :
  - **Exporter une sauvegarde** → fichier `.json` à garder sur une **clé USB** ;
  - **Restaurer une sauvegarde** → remplace les données actuelles (après confirmation) ;
  - **Charger les données de démonstration** ;
  - **Tout réinitialiser** (double confirmation).
- Sauvegarde quotidienne automatique : les 10 derniers jours sont conservés dans
  `AppData\Roaming\comptabloo\backups\` — utilisez le menu *Aide → Où sont mes données ?*
  pour trouver le dossier.

## 3.9 Raccourcis clavier

| Raccourci | Action |
|---|---|
| `Ctrl + N` | Nouvelle facture de vente |
| `Ctrl + Maj + N` | Nouvel achat |
| `Ctrl + P` | Imprimer |
| `Ctrl + R` | Recharger l'écran |
| `F11` | Plein écran |
| `Échap` | Fermer une fenêtre modale |

---

# Partie 4 — Dépannage et questions fréquentes

## Compilation

**« npm » ou « node » n'est pas reconnu**
→ Node.js n'est pas installé ou l'invite de commandes date d'avant l'installation.
Réinstallez Node.js LTS puis **rouvrez** l'invite de commandes.

**`npm run dist:win` échoue sur « electron-builder »**
→ Vérifiez que `npm install` s'est terminé sans erreur ; supprimez les dossiers
`node_modules` et le fichier `package-lock.json` puis relancez `npm install`.

**L'antivirus bloque la compilation ou l'installateur**
→ Certains antivirus se méfient des fichiers récents non signés. Ajoutez le dossier du
projet aux exceptions, ou compilez puis signez l'exécutable (voir 2.6).

## Utilisation

**Windows affiche « Windows a protégé votre ordinateur » au lancement**
→ *Informations complémentaires → Exécuter quand même*. Voir 2.3.

**J'ai supprimé une facture par erreur**
→ Les données sont modifiées dès confirmation, sans corbeille. Vos recours : la
sauvegarde quotidienne (`backups\`) ou votre dernière sauvegarde exportée
(*Paramètres → Restaurer une sauvegarde*).

**Le stock ne correspond pas à mon inventaire physique**
→ Vérifiez l'historique du produit (icône horloge) : chaque mouvement est justifié par un
document. Corrigez ensuite avec un *Ajustement de stock* motivé — ne modifiez pas le
stock initial, qui fausserait l'historique passé.

**Puis-je utiliser COMPTABLOO sur plusieurs ordinateurs ?**
→ Chaque installation possède ses propres données locales. Pour transférer :
*Paramètres → Exporter une sauvegarde* sur l'ancien PC, puis *Restaurer* sur le nouveau.
La version portable (`dist:win:portable`) sur clé USB emporte le logiciel et ses données.

**Le logiciel envoie-t-il des données sur Internet ?**
→ **Non.** Aucune requête réseau n'est effectuée par COMPTABLOO, ni au démarrage ni
pendant l'utilisation. Testez-le : débranchez Internet, tout continue de fonctionner.

**Comment passer du FCFA à l'euro ou au dollar ?**
→ *Paramètres → Facturation et devise*. ⚠️ Le changement de devise modifie l'affichage
et les arrondis de tous les montants : faites-le de préférence au démarrage et exportez
une sauvegarde avant.

**L'écran reste blanc au démarrage**
→ Relancez en mode développement (`npm start`) et consultez la console. Si le problème
persiste, restaurez la dernière sauvegarde quotidienne (menu *Aide → Où sont mes
données ?* → dossier `backups` : copiez le fichier le plus récent en
`comptabloo-data.json` après avoir fermé le logiciel).

---

*COMPTABLOO 1.0.0 — Copyright © 2026 — Licence MIT. Guide rédigé pour Windows 11 (64 bits) ; le logiciel fonctionne aussi sur Windows 10 (64 bits).*
