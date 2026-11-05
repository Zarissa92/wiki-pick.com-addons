# Wiki-Pick — addons

Des userscripts faits pour jouer à [wiki-pick.com](https://wiki-pick.com) plus confortablement. **TOUT EST VIBECODE**

Tout tourne dans le navigateur. Le site n'est pas modifié, il n'y a pas de serveur à moi derrière, et les données restent dans le navigateur (`localStorage`, et une base IndexedDB pour la collection). J'utilise perso **Firefox + Greasemonkey**.

| Script | Fichier | Version | Rôle |
|---|---|---|---|
| **Album+cleaner+Maximisation** | `album.user.js` | 12.23 | Le script principal : affichage, exports, derniers paquets, historique, échanges |
| **Wiki-Pick verrouillage** | `album.verrouillage.js` | 3.7 | Verrouille ou déverrouille les cartes d'étiquettes, depuis le tiroir d'export d'Album |
| **Album+cleaner — vendeurs bloqués** | `vendeurs_bloques.user.js` | 2.1 | Masque les annonces des vendeurs que j'ai bloqués sur le site, et signale une enchère d'un vendeur bloqué ouverte par un lien |
| **Album+cleaner — tri par date d'obtention** | `wikipick_tri_date.user.js` | 2.5 | Trie la page « Ma collection » par date d'obtention, ouvre « Mes dernières cartes », et garde toute la collection dans le navigateur |

Album marche tout seul. Le verrouillage a besoin d'Album, parce qu'il se branche dans son tiroir d'export ; si le tri par date est installé, il lit aussi sa base de la collection. Le masquage des vendeurs et le tri par date marchent sans Album, mais prennent son style quand il est là.

---

## Navigateurs

**Développé et testé uniquement sur Firefox (ordinateur) avec Greasemonkey.**

- **Tampermonkey ou Violentmonkey (Chrome, Edge, Firefox)** : ça devrait marcher, mais ce n'est pas testé. Ces gestionnaires ne lancent pas les scripts de la même façon que Greasemonkey (dans la page ou dans un bac à sable) ; le code est écrit pour les deux cas, mais un souci reste possible.
- **Firefox sur téléphone, Safari (extension Userscripts), autres navigateurs** : pas testé du tout.
- Ce qu'il faut au navigateur : IndexedDB (la base de la collection), IntersectionObserver, `navigator.clipboard` pour les boutons « Copier » (avec une solution de repli). `navigator.locks` sert à ce qu'un seul onglet travaille sur la base ; sans lui, ça marche, mais deux onglets ouverts pourraient lire la collection en même temps.
- Sous Firefox, Greasemonkey isole chaque script de la page (« XrayWrapper ») : les scripts recopient de leur côté tout ce qui vient du site ou de la base. Si un message « XrayWrapper » apparaît quand même dans un journal, c'est un bug : signale-le.

Si tu l'utilises ailleurs que sur Firefox + Greasemonkey, dis-moi ce qui marche et ce qui ne marche pas.

---

## Installation

1. Installer un gestionnaire de userscripts : Greasemonkey (Firefox), [Tampermonkey](https://www.tampermonkey.net/) ou [Violentmonkey](https://violentmonkey.github.io/).
2. Créer un nouveau script et y coller le contenu du fichier, pour chacun des scripts voulus. Ou ouvrir le fichier brut sur GitHub et l'installer directement depuis le gestionnaire.
3. Recharger wiki-pick.com.

Les scripts ne tournent que sur `https://wiki-pick.com/*`.

### Mises à jour

Un script qui contient son adresse de mise à jour (`@updateURL`) est vérifié par le gestionnaire, qui propose la version suivante quand le numéro de version augmente. Je relis les changements avant de publier. Si tu préfères garder la main, désactive la mise à jour automatique de ce script dans le gestionnaire.

---

## Album+cleaner+Maximisation

### Affichage
- **Menu fixe** en haut de l'écran, sur toutes les pages. En option : l'ancienne rangée d'onglets, ou la taille de l'ancien site.
- **Profil fixe** : en descendant sur un profil, une barre compacte garde l'avatar, le pseudo, les chiffres et les actions.
- **Ma collection et Toutes les cartes** : les onglets, la recherche et les filtres restent sous le menu.
- **Taille des cartes** réglable, texte des cartes plus lisible, en gras si on veut.
- **Clean** (à côté du crâne et de la lune) : cache les bandeaux, Discord, X, Parrainage, Boutique… On choisit ce qu'il cache dans les réglages.
- **Largeur** : le site prend toute la largeur de l'écran.
- Le **clic droit** du navigateur reste toujours disponible.
- Les **images de cartes cassées** retombent sur l'original Wikimedia quand c'est possible.

### Étiquettes et export
- Sur un profil et dans « Mes étiquettes » : un onglet **Collection** pour descendre à la collection, et **Catégories** pour une vue d'ensemble de toutes les étiquettes, avec recherche.
- **Exporter** ouvre un tiroir à droite :
  - la liste des étiquettes, ou toutes leurs cartes (avec ou sans description, noms en gras) ;
  - découpé en messages de moins de 2 000 caractères, prêts à copier un par un ;
  - ou d'un coup en `.txt`.

### Livres (page Albums)
- **Toutes les pages** : les pages du livre d'un coup d'œil, avec recherche, pour sauter à n'importe laquelle.
- **Page vide suivante**, dans mes propres livres.
- **Copier le lien** d'une page précise.
- Raccourcis : `G` toutes les pages, `N` page vide suivante, `Début` / `Fin`, `?` pour le rappel.

### Paquets, échanges, marché
- **Derniers paquets** : chaque ouverture est notée dès que le site reçoit les cartes, donc un F5 pendant l'animation ne perd rien. Une grille des 100 dernières cartes.
- **Chances** :
  - sur la fiche d'une carte, une estimation de la chance de la tirer ;
  - dans les derniers paquets, ma chance comparée à la moyenne.
- **Échanges** :
  - filtre **Doublons** dans chaque colonne ;
  - badge **« Déjà de son côté »** sur les cartes que le partenaire a déjà ;
  - **historique de mes échanges joueur par joueur**, que le site ne garde pas.
- **Souhaits** : au marché, aux enchères et dans les échanges proposés, les cartes de ma liste de souhaits sont entourées.

### Réglages
Tout se règle depuis le bouton **Réglages de l'outil**, à côté de Clean et Largeur. Les choix sont gardés dans le navigateur et une mise à jour du script ne les efface pas. Tout est aussi dans l'objet `CONFIG` en haut du fichier.

Le flou derrière les barres fixes est coupé par défaut : c'est joli, mais ça fait ramer en défilant sur une grande grille.

### Garde-fou
Le site change sans prévenir. Quand l'outil ne retrouve plus ce dont il a besoin, un petit avis le dit, une fois par version du site, au lieu de casser en silence.

---

## Wiki-Pick verrouillage

Ajoute un bouton **Verrouiller** dans la barre des étiquettes, entre le trait et **Exporter** (sur un profil, et dans Ma collection › Étiquettes). Il ouvre le panneau de verrouillage dans le tiroir d'export ; un second clic le referme. On coche des étiquettes, puis on verrouille ou déverrouille :
- toute la sélection ;
- une étiquette ;
- ou une carte à la fois.

### Quels exemplaires sont touchés
- **Dans ma collection** (Ma collection › Étiquettes, ou mon propre profil) : **exactement les exemplaires qui portent l'étiquette**, y compris ceux que la page n'a pas encore affichés. Si j'ai deux exemplaires d'une carte et qu'un seul est étiqueté, seul celui-là est verrouillé. Ils sont lus dans la base de la collection du tri par date quand elle existe (aucune requête au site), sinon dans ma collection filtrée par étiquette.
- **Sur le profil de quelqu'un d'autre** : les cartes affichées de l'étiquette, et l'outil agit sur **mes** exemplaires de ces cartes (lus sur leur fiche), dans la bonne version (normale, chromatique ou Halloween).

Les exemplaires déjà dans l'état demandé, ou absents de ma collection, ne sont pas envoyés au site. La liste montre ceux qui sont déjà verrouillés.

Quand des étiquettes cochées sont encore en lecture, celles déjà lues partent tout de suite, et les autres suivent dès qu'elles sont lues.

### Envoi groupé
Le site accepte plusieurs exemplaires dans une seule requête, comme son propre bouton. Chaque lot (50 cartes au plus, `TAILLE_LOT`) part donc en un seul envoi. Si le site répond 404 ou 405 à cette adresse, ou refuse un envoi groupé, l'outil reprend ce lot carte par carte : un envoi refusé n'est jamais compté comme fait.

### Pour ne pas surcharger le site
- Les fiches sont lues **4 à la fois** (`LECTURES_SIMULTANEES`), et les pages de la collection avec **400 ms** entre deux pages.
- Les envois partent **900 ms après la fin du précédent** (`DELAI_ENTRE_VERROUILLAGES_MS`).
- **2 s de pause** entre deux lots (`PAUSE_ENTRE_LOTS_MS`).
- Sur un **429**, tout l'outil s'arrête le temps demandé par le site (ou 5 s, puis 10, 20…), puis reprend la même requête.

Tout est réglable en haut du fichier.

### Journal
- Chaque opération est écrite dans un journal, exportable en `.txt` ou copiable.
- Une confirmation est demandée au-delà de 10 cartes.
- À la fin, l'outil propose l'action inverse.
- En quittant le panneau, rien n'est effacé : le journal, le dernier traitement et les étiquettes déjà lues restent (une étiquette lue il y a plus de 5 minutes est relue). Le journal (2 000 dernières lignes) et le dernier traitement survivent même à un rechargement de l'onglet.
- Un traitement en cours continue quand je navigue ailleurs sur le site. Fermer ou recharger l'onglet pendant un traitement demande d'abord confirmation.
- Panneau fermé, l'outil ne fait plus rien d'autre que reposer son bouton : il ne fait pas ramer le site.
- **Vider la mémoire** n'efface que le journal et les étiquettes déjà lues : jamais les données d'Album.

---

## Album+cleaner — vendeurs bloqués

Masque les annonces des vendeurs que j'ai bloqués sur le site. La liste des blocages est lue sur le site (`/api/blocages`), donc rien à maintenir à la main.

- La liste est gardée **5 minutes**, et relue tout de suite quand je bloque ou débloque quelqu'un. Elle n'est jamais lue en continu : aucune requête de plus quand je ne regarde pas le marché.
- Les annonces sont retirées des réponses du site avant affichage : ça marche sur tous les tris et filtres, pas seulement sur la page par défaut.
- La comparaison ignore la casse, les espaces et les accents (« Élodie » = « elodie »).
- **Enchère ouverte par un lien** (Discord, profil, notification) : si son vendeur est bloqué, un bandeau rouge le dit en haut de l'enchère, que le masquage soit actif ou non. L'enchère reste utilisable.
- Un bouton **Vendeurs bloqués : masqués / affichés**, à côté de **Messages**, active ou désactive le masquage. Le choix est gardé dans le navigateur ; un clic recharge la page seulement si je suis sur le marché.

Limite : si je bloque quelqu'un pendant que le marché est ouvert, ses annonces disparaissent au prochain chargement d'annonces (changement de filtre, de tri ou de page).

---

## Album+cleaner — tri par date d'obtention

### Tri de la page
À côté de **Sélectionner**, sur la page « Ma collection » (hors de l'onglet Étiquettes) :
- un menu : **Ordre du site**, **plus récentes d'abord**, **plus anciennes d'abord** ;
- un nombre de cartes, à valider avec **OK** (ou Entrée) ;
- le bouton **Mes dernières cartes**.

Les N premières cartes de la page (100 au plus, une page du site) sont triées par la date d'obtention de l'exemplaire affiché ; les suivantes gardent leur place. « Ordre du site » remet l'ordre d'origine, même après un changement de page. Les dates sont lues sur la fiche de chaque carte (4 à la fois, avec une pause entre deux lots) et gardées dans le navigateur : une carte n'est lue qu'une fois, sauf si un nouvel exemplaire apparaît.

### Mes dernières cartes
**OK** (ou le bouton) ouvre une fenêtre par-dessus la page avec mes **N dernières cartes obtenues, dans toute la collection** (jusqu'à 1 000), de la plus récente à la plus ancienne, avec leur date et heure, leurs étiquettes et leur cadenas.
- **Clic** sur une carte pour la cocher, **Maj + clic** pour une plage, **Fiche** pour ouvrir la vraie fiche du site.
- **En lot**, sur les cartes cochées : poser ou retirer une étiquette, verrouiller ou déverrouiller, mettre de côté pour la vente. L'outil passe par la fiche de chaque carte, comme si je cliquais : il vérifie la version et l'exemplaire, n'agit que si l'état n'est pas déjà le bon (« Poser » ne retire jamais une étiquette), et saute les cartes verrouillées pour la vente. Confirmation avant, bouton **Arrêter** pendant.
- Le recyclage et les enchères restent à la main, fiche par fiche.
- Les images arrivent quelques-unes à la fois, à l'approche de l'écran. Quand la vignette de 960 px n'existe pas chez Wikimedia, l'outil essaie 500 px, puis 250 px, puis le fichier original.

Sans la base, la fenêtre lit la tête de chaque rang de la collection, mon historique d'échanges et d'achats, puis les fiches des candidats (1 à 2 minutes la première fois). Avec la base, elle s'ouvre en quelques secondes.

### La base de la collection
Toute ma collection, gardée dans le navigateur (IndexedDB `wpx-collection`, une dizaine de Mo pour 80 000 exemplaires) : pour chaque exemplaire, sa carte, son rang, chromatique ou non, ses étiquettes, son cadenas et sa date d'obtention dès qu'elle est connue.

- **Construction, une seule fois** : toutes les pages de la collection (environ 800), par petits lots espacés, soit **30 à 40 minutes**. Je peux continuer à jouer pendant ce temps. **Pause** l'arrête ; elle reprend à la page où elle s'était arrêtée, même après un rechargement.
- **Ensuite, seulement les différences** avec la dernière fois :
  - les cartes neuves, en tête de chaque rang ;
  - quand le nombre d'exemplaires d'un rang ne colle plus (vente, recyclage, carte reçue avec un ancien identifiant), une recherche par dichotomie trouve la page qui a bougé ;
  - chaque carte échangée, achetée ou vendue depuis la dernière fois est vérifiée sur sa fiche ;
  - seules les étiquettes dont le nombre d'exemplaires a changé sont relues ;
  - les cadenas posés (par le site ou par mes outils) sont notés au passage, sans requête.

  Une mise à jour coûte une dizaine de requêtes quand rien n'a changé, un peu plus là où il y a des différences.
- **Quand** : à l'ouverture de « Mes dernières cartes » (si la base a plus de 2 minutes), quand le verrouillage lit une étiquette (plus de 10 minutes), ou avec **Mettre à jour**. Entre deux, rien ne part vers le site.
- **Tout vérifier** relit toute la collection : ça rattrape les changements qui se compensent (une étiquette déplacée d'une carte à une autre, par exemple). Le tableau de bord le rappelle après 7 jours.
- **Exporter / Importer** : une copie de la base en fichier JSON.

### Tableau de bord
Dans **Collection › Mes étiquettes**, un bouton **base de données** apparaît dans l'en-tête, à côté de Clean, Largeur et des réglages, avec une pastille :
- 🟢 **vert** : base prête ;
- 🟠 **orange** : construction, mise à jour ou vérification en cours ;
- 🔴 **rouge** : pas construite, en pause, ou erreur.

Il ouvre un panneau avec le statut, une **barre de progression** (étape en cours et pourcentage), les boutons (construire, pause, mettre à jour, tout vérifier, exporter, importer) et un **journal** horodaté : pages lues par rang, ajouts et retraits, étiquettes relues, erreurs. Le journal (500 lignes) survit à un rechargement de l'onglet et se copie en un clic. Sur les autres pages, le bouton est caché, mais un travail en cours continue.

---

## Données et vie privée

- **Aucun secret dans le code.** Aucune adresse ni aucun identifiant n'est écrit dans les fichiers.
- Les données gardées restent dans le navigateur :
  - `localStorage`, sous des clés `wpx.*` : réglages, derniers paquets, historique des échanges, dates de tri, caches ;
  - `sessionStorage` : les journaux du verrouillage et de la base ;
  - IndexedDB `wpx-collection` : la base de la collection.
- Les scripts n'envoient rien à un autre site que wiki-pick.com. Ils lisent l'API du site comme le site lui-même, avec ma session, sans jamais lire les cookies.
- Le verrouillage, le masquage, le tri et la base lisent l'API du site par petits lots espacés : je ne veux pas surcharger le site. La construction de la base est la seule opération lourde (environ 800 pages, une fois).
- **Ne jamais copier les en-têtes d'une requête** (onglet Réseau) pour demander de l'aide : ils contiennent le cookie de session, qui permet d'entrer dans le compte. Seules l'adresse et la réponse sont utiles.

### À savoir
- Ces scripts utilisent des routes internes du site, qui peuvent changer du jour au lendemain. Le garde-fou d'Album est là pour le signaler, et le journal de la base dit quand une liste a dû être relue en entier.
- Le partage Discord (envoi des paquets vers un salon) passait par un pont qui n'est plus dans ce dépôt. Sans lui, cette partie d'Album ne fait rien.

---

## Fichiers

```
album.user.js                 Album+cleaner+Maximisation
album.verrouillage.js         Wiki-Pick verrouillage (tiroir d'export)
vendeurs_bloques.user.js      Album+cleaner — vendeurs bloqués
wikipick_tri_date.user.js     Album+cleaner — tri par date d'obtention (et la base de la collection)
README.md
```

Projet perso, non affilié à wiki-pick.com.