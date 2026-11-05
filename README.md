# Wiki-Pick — addons

Des userscripts faits pour jouer à [wiki-pick.com](https://wiki-pick.com) plus confortablement. **TOUT EST VIBECODE**

Tout tourne dans le navigateur. Le site n'est pas modifié, il n'y a pas de serveur à moi derrière, et les réglages restent dans le `localStorage` du navigateur. J'utilise perso, **greasemonkey**. 

| Script | Fichier | Version | Rôle |
|---|---|---|---|
| **Album+cleaner+Maximisation** | `album.user.js` | 12.23 | Le script principal : affichage, exports, derniers paquets, historique, échanges |
| **Wiki-Pick verrouillage** | `album.verrouillage.js` | 2.16 | Verrouille ou déverrouille des cartes par étiquettes, depuis le tiroir d'export d'Album |
| **Wiki-Pick vendeurs bloqués** | `vendeurs_bloques.user.js` | 1.5 | Masque les annonces des vendeurs que j'ai bloqués sur le site, avec un bouton pour l'activer ou le désactiver |
| **Wiki-Pick tri par date d'ajout** | `wikipick_tri_date.user.js` | 0.5 | Trie les cartes de la page « Ma collection » par date d'obtention |

Album marche tout seul. Le verrouillage a besoin d'Album, parce qu'il se branche dans son tiroir d'export. Le masquage des vendeurs et le tri par date sont indépendants.

---

## Installation

1. Installer un gestionnaire de userscripts : [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/) ou Greasemonkey (Firefox).
2. Créer un nouveau script et y coller le contenu du fichier, pour chacun des scripts voulus. Ou ouvrir le fichier brut sur GitHub et l'installer directement depuis le gestionnaire.
3. Recharger wiki-pick.com.

Les scripts ne tournent que sur `https://wiki-pick.com/*`.

### Mises à jour

Le verrouillage contient son adresse de mise à jour (`@updateURL`) : le gestionnaire vérifie le dépôt et propose la version suivante quand le numéro de version augmente. Je relis les changements avant de publier. Si tu préfères garder la main, désactive la mise à jour automatique de ce script dans le gestionnaire.

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

Ajoute un bouton **cadenas** en haut du site, à côté de Clean et Largeur. Sur une page d'étiquettes (un profil, ou Ma collection › Étiquettes), il ouvre directement le panneau de verrouillage ; un second clic le referme. On coche des étiquettes, puis on verrouille ou déverrouille :
- toute la sélection ;
- une étiquette ;
- ou une carte à la fois.

Seul l'exemplaire de la bonne version est touché (normale, chromatique ou Halloween). Les cartes déjà dans l'état demandé, ou absentes de ma collection, ne sont pas envoyées au site.

### Envoi groupé
Le site accepte plusieurs exemplaires dans une seule requête, comme son propre bouton. Les exemplaires partent donc **par groupes de 99** (`EXEMPLAIRES_PAR_ENVOI`) : 99 cartes font un seul envoi. Si le site répond 404 ou 405 à cette adresse, l'outil repasse carte par carte.

### Pour ne pas surcharger le site
- Les copies sont lues **par blocs de 50**, 4 à la fois, avec **1,5 s entre deux blocs**.
- Les envois partent **900 ms après la fin du précédent**.
- Les cartes sont traitées par lots de 100, avec une pause de 2 s entre deux lots.
- Sur un **429**, tout l'outil s'arrête le temps demandé par le site (ou 5 s, puis 10, 20…), puis reprend la même requête.

Tout est réglable en haut du fichier : `DELAI_ENTRE_VERROUILLAGES_MS`, `LECTURES_PAR_BLOC`, `PAUSE_ENTRE_BLOCS_LECTURE_MS`, `EXEMPLAIRES_PAR_ENVOI`…

### Journal
- Chaque opération est écrite dans un journal, exportable en `.txt` ou copiable.
- Une confirmation est demandée au-delà de 10 cartes.
- À la fin, l'outil propose l'action inverse.
- En quittant le panneau, le journal, la liste des cartes et quelques caches sont vidés, puis la page se recharge. Il faut exporter le journal avant si on veut le garder. Réglable avec `VIDER_EN_QUITTANT` et `RAFRAICHIR_EN_QUITTANT`.

---

## Wiki-Pick vendeurs bloqués

Masque les annonces des vendeurs que j'ai bloqués sur le site. La liste des blocages est lue sur le site (`/api/blocages`), donc rien à maintenir à la main.

- La liste est relue à chaque chargement d'annonces (pas en continu, donc aucune requête de plus quand je ne regarde pas le marché).
- Les annonces sont retirées des réponses du site avant affichage : ça marche sur tous les tris et filtres, pas seulement sur la page par défaut.
- La comparaison ignore la casse, les espaces et les accents.
- Un bouton **Blocage** à côté de **Messages** permet d'activer ou de désactiver le masquage. Le choix est gardé dans le navigateur ; un clic recharge la page.

Limite : si je bloque quelqu'un pendant que la page est ouverte, ses annonces disparaissent au prochain chargement d'annonces (changement de filtre, de tri ou de page).

---

## Wiki-Pick tri par date d'ajout

Ajoute un bouton **Tri par date** à côté de **Sélectionner**, sur la page « Ma collection ». Un clic passe en tri **plus récent d'abord**, un second en **plus ancien d'abord**, un troisième rend l'ordre du site (rareté, puis date d'obtention).

- La date utilisée est celle de l'obtention de l'exemplaire affiché (ou la plus récente de la carte si l'exemplaire n'est pas reconnu).
- Les dates sont lues sur la fiche de chaque carte, **par blocs de 50 lus en même temps**, avec 1,5 s entre deux blocs. Un 429 du site fait attendre 5 s, puis 10 s, 15 s, avant de réessayer.
- Les dates sont gardées dans le navigateur : une carte n'est lue qu'une fois.
- Le mode choisi reste en place quand on change de page. Les cartes d'une nouvelle page sont lues et triées automatiquement.

Limites :
- Le tri ne porte que sur la page affichée (100 cartes). Trier toute la collection demanderait de lire environ 78 000 fiches.
- Le tri remplace l'ordre fait à la main avec le glisser-déposer du site. « Remettre à l'emplacement d'origine » le restaure.

---

## Données et vie privée

- **Aucun secret dans le code.** Aucune adresse ni aucun identifiant n'est écrit dans les fichiers.
- Les données gardées (réglages, derniers paquets, historique des échanges, dates de tri, caches) restent dans le navigateur, sous des clés `wpx.*`.
- Les scripts n'envoient rien à un autre site que wiki-pick.com. Ils lisent l'API du site comme le site lui-même, avec ma session, sans jamais lire les cookies.
- Le verrouillage, le masquage et le tri lisent l'API du site par petits lots espacés : je ne veux pas surcharger le site.

### À savoir
- Ces scripts utilisent des routes internes du site, qui peuvent changer du jour au lendemain. Le garde-fou est là pour le signaler.
- Le partage Discord (envoi des paquets vers un salon) passait par un pont qui n'est plus dans ce dépôt. Sans lui, cette partie d'Album ne fait rien.

---

## Fichiers

```
album.user.js                 Album+cleaner+Maximisation
album.verrouillage.js         Wiki-Pick verrouillage (tiroir d'export)
vendeurs_bloques.user.js      Wiki-Pick vendeurs bloqués
wikipick_tri_date.user.js     Wiki-Pick tri par date d'ajout
README.md
```

Projet perso, non affilié à wiki-pick.com.