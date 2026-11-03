# Album+cleaner — outils pour wiki-pick.com

Trois userscripts que j'ai faits pour jouer à [wiki-pick.com](https://wiki-pick.com) plus confortablement : un site plus lisible, des exports de mes étiquettes, le partage de mes paquets sur Discord et le verrouillage de mes cartes en masse.

Tout tourne dans le navigateur. Le site n'est pas modifié, il n'y a pas de serveur à moi derrière, et les réglages restent dans le `localStorage` du navigateur.

| Script | Fichier | Version | Rôle |
|---|---|---|---|
| **Album+cleaner+Maximisation** | `album.user.js` | 12.23 | Le script principal : affichage, exports, derniers paquets, historique, Discord |
| **Album pont Discord** | `album_pont_discord.user.js` | 1.6 | Petit relais qui envoie vers Discord les messages préparés par Album |
| **Wiki-Pick verrouillage** | `wikipick_verrouillage.user.js` | 2.12 | Verrouille ou déverrouille des cartes par étiquettes, depuis le tiroir d'export d'Album |

Album marche tout seul. Le pont ne sert que si on utilise le partage Discord. Le verrouillage a besoin d'Album, parce qu'il se branche dans son tiroir d'export.

---

## Installation

1. Installer un gestionnaire de userscripts : [Tampermonkey](https://www.tampermonkey.net/), [Violentmonkey](https://violentmonkey.github.io/) ou Greasemonkey (Firefox).
2. Créer un nouveau script et y coller le contenu du fichier, pour chacun des scripts voulus.
3. Recharger wiki-pick.com.

Les trois scripts ne tournent que sur `https://wiki-pick.com/*`.

---

## Album+cleaner+Maximisation

### Affichage
- **Menu fixe** en haut de l'écran, sur toutes les pages. En option : l'ancienne rangée d'onglets, ou carrément la taille de l'ancien site (avant la refonte du 25/10/2026).
- **Profil fixe** : en descendant sur un profil, une barre compacte garde l'avatar, le pseudo, les chiffres et les actions. Les onglets Vitrines / Étiquettes / Exclusives et la collection restent collés dessous, et une rangée reprend les albums (les livres) du joueur.
- **Ma collection et Toutes les cartes** : les onglets, la recherche et les filtres restent sous le menu.
- **Taille des cartes** réglable, texte des cartes plus lisible, en gras si on veut.
- **Clean** (à côté du crâne et de la lune) : cache les bandeaux, Discord, X, Parrainage, Boutique… On choisit ce qu'il cache dans les réglages.
- **Largeur** : le site prend toute la largeur de l'écran.
- Le **clic droit** du navigateur reste toujours disponible.
- Les **images de cartes cassées** retombent sur l'original Wikimedia quand c'est possible.

### Étiquettes et export
- Sur un profil et dans « Mes étiquettes » : un onglet **Collection** pour descendre à la collection, et **Catégories** pour une vue d'ensemble de toutes les étiquettes (ou vitrines), avec recherche.
- **Exporter** ouvre un tiroir à droite :
  - la liste des étiquettes, ou toutes leurs cartes (avec ou sans description, noms en gras) ;
  - découpé en messages Discord de moins de 2 000 caractères, prêts à copier un par un ;
  - ou d'un coup en `.txt`.

### Livres (page Albums)
- **Toutes les pages** : les pages du livre d'un coup d'œil, avec recherche, pour sauter à n'importe laquelle.
- **Page vide suivante**, dans mes propres livres.
- **Copier le lien** d'une page précise (le lien ouvre directement la page pour quelqu'un qui a l'outil).
- Raccourcis : `G` toutes les pages, `N` page vide suivante, `Début` / `Fin`, `?` pour le rappel.

### Paquets, échanges, marché
- **Derniers paquets** : chaque ouverture est notée dès que le site reçoit les cartes, donc un F5 pendant l'animation ne perd rien. Il y a un aperçu à côté du paquet et une grille des 100 dernières cartes.
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

## Partage Discord (Album + pont)

Si on l'active, Album envoie à un serveur Discord :
- chaque paquet ouvert ;
- chaque carte achetée aux enchères ;
- chaque carte reçue en échange ;
- la liste de souhaits.

Un bot sur le serveur lit ces messages (le bloc ```` ```wpx ````), publie les belles cartes par thème et prévient ceux qui souhaitaient une carte. Le bot n'est pas dans ce dépôt.

### Pourquoi un pont ?
La page de wiki-pick n'a pas le droit d'appeler discord.com directement. Le pont tourne à côté avec `GM_xmlhttpRequest`, la seule permission spéciale du projet, limitée à `discord.com` et `discordapp.com`. Album dépose une demande dans le `localStorage` (`wpx.pont.req`), le pont l'envoie et range la réponse (`wpx.pont.res`).

### Ce que le pont refuse
Le `localStorage` est lisible par la page, donc le pont ne croit jamais une demande sur parole. Il refuse :
- toute adresse qui n'est pas un webhook Discord ;
- tout message qui n'est pas un message de l'outil, ou qui dépasse 2 000 caractères ;
- toute pièce jointe qui n'est pas un petit JSON.

Il force aussi `allowed_mentions` à vide (personne n'est jamais pingé), n'envoie pas les cookies de discord.com et refuse les redirections.

### Relier un serveur
Sur Discord, dans le sas du serveur, le bouton **« ② Connecte l'outil »** donne un lien qui relie l'outil à ce serveur. On peut relier plusieurs serveurs : chacun reçoit les envois par son propre webhook, rien ne passe de l'un à l'autre. On coche ou décoche chaque serveur depuis **Discord** dans le panneau des derniers paquets.

Les envois passent par une file gardée dans le navigateur, un seul onglet à la fois, au rythme que Discord accepte (un message toutes les 2,5 s). Les refus « trop vite » (429) sont respectés.

---

## Verrouillage

Ajoute un bouton **cadenas** en haut du site, à côté de Clean et Largeur. Sur une page d'étiquettes (un profil, ou Ma collection › Étiquettes), il ouvre directement le panneau de verrouillage ; un second clic le referme. On coche des étiquettes, puis on verrouille ou déverrouille :
- toute la sélection ;
- une étiquette ;
- ou une carte à la fois.

Seul l'exemplaire de la bonne version est touché (normale, chromatique ou Halloween). Les cartes déjà dans l'état demandé ne sont pas renvoyées au site.

### Pour ne pas surcharger le site
- Les copies sont lues **par blocs de 50**, 4 à la fois, avec **1,5 s entre deux blocs**.
- Les verrouillages partent **un par un, 900 ms après la fin du précédent**.
- Les cartes sont traitées par lots de 100, avec une pause de 2 s entre deux lots.
- Sur un **429**, tout l'outil s'arrête le temps demandé par le site (ou 5 s, puis 10, 20…), puis reprend la même requête.

Tout est réglable en haut du fichier : `DELAI_ENTRE_VERROUILLAGES_MS`, `LECTURES_PAR_BLOC`, `PAUSE_ENTRE_BLOCS_LECTURE_MS`, `LECTURES_SIMULTANEES`…

### Journal
- Chaque opération est écrite dans un journal, exportable en `.txt` ou copiable.
- Une confirmation est demandée au-delà de 10 cartes.
- À la fin, l'outil propose l'action inverse.
- En quittant le panneau, le journal, la liste des cartes et quelques caches sont vidés pour alléger la page. Il faut exporter le journal avant si on veut le garder (`VIDER_EN_QUITTANT = false` pour couper ça).

---

## Données et vie privée

- **Aucun secret dans le code.** Les adresses de webhook ne sont jamais écrites dans les fichiers. Elles n'existent que dans le `localStorage` de chaque joueur, une fois qu'il a relié un serveur.
- Les données gardées (réglages, derniers paquets, historique des échanges, caches) restent dans le navigateur, sous des clés `wpx.*`.
- Rien ne part ailleurs que vers wiki-pick.com (lectures de l'API du site, comme le site lui-même) et, si on l'a activé, vers les webhooks Discord qu'on a reliés.
- Album et le verrouillage lisent l'API du site par petits lots espacés : je ne veux pas surcharger le site.

### À savoir
- Un webhook Discord, c'est une adresse qui permet de poster dans un salon. S'il fuit, il suffit de le supprimer et d'en recréer un sur Discord.
- Le pont accepte n'importe quel webhook Discord que la demande indique : il ne connaît pas ceux réglés dans Album.
- Ces scripts utilisent des routes internes du site, qui peuvent changer du jour au lendemain. Le garde-fou est là pour le signaler.

---

## Fichiers

```
album.user.js                 Album+cleaner+Maximisation
album_pont_discord.user.js    Album pont Discord
wikipick_verrouillage.user.js Wiki-Pick verrouillage (tiroir d'export)
README.md
```

Projet perso, non affilié à wiki-pick.com.
