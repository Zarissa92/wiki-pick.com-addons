// ==UserScript==
// @name         [test]Album+cleaner+Maximisation
// @namespace    local
// @version      12.22
// @description  Menu fixe sur toutes les pages (ou l'ancien menu, ou la taille de l'ancien site, en réglage) ; profil fixe avec ses albums et les onglets Collection, Catégories et souhaitées ; onglets et filtres fixes dans Ma collection et Toutes les cartes ; export des étiquettes et extraction des cartes au format Discord ; toutes les pages d'un livre d'un coup d'œil ; tes souhaits mis en valeur ; l'historique de tes échanges avec chaque joueur(euse) ; chances des cartes ; réglages gardés dans le navigateur ; Clean et Largeur à côté du crâne et de la lune ; suit le mode nuit ; clic droit
// @match        https://wiki-pick.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// @updateURL    https://gist.githubusercontent.com/Plok-Code/3305b8d461789c702b60dc3185e7fedd/raw/album.user.js
// @downloadURL  https://gist.githubusercontent.com/Plok-Code/3305b8d461789c702b60dc3185e7fedd/raw/album.user.js
// ==/UserScript==

(function () {
"use strict";

/* Une seule instance, même si le gestionnaire injecte le script deux fois */
if (window.__wpxActif) return;
window.__wpxActif = true;

/* ==========================================================================
   CONFIGURATION : tout ce qui est modifiable se trouve ici
   ========================================================================== */
const CONFIG = {
    VERSION: "12.22",

    /*
     * EN-TÊTE : le menu du site reste en haut de l'écran, sur toutes les pages.
     *   fixe       : true = menu fixe. Sur ordinateur, avec le menu du site du 25/10/2026, seules les rubriques
     *                restent : la rangée du haut (le joueur, les boutons, le logo) part avec la page.
     *   ancienMenu : true = sur ordinateur, l'ancienne rangée d'onglets du site (toutes les pages côte à côte, comme
     *                avant le 25/10/2026) à la place des rubriques, sans « Communauté » à dérouler
     *   ancienSite : true = la taille de l'ancien site : l'en-tête compact (photo, Wikiki, boutons sur une rangée),
     *                l'ancien menu, les anciennes largeurs, les anciens onglets et filtres des pages, comme le 24/10/2026
     */
    ENTETE: {
        fixe: true,
        ancienMenu: false,
        ancienSite: false
    },

    /*
     * PROFIL : sur le profil d'un joueur, une barre compacte reprend tout ce qui précède les
     * étiquettes et les vitrines (avatar, pseudo, niveau, guilde, chiffres), et l'en-tête
     * « Vitrines / Étiquettes / Exclusives » reste fixé juste dessous. Une fois les albums (les livres)
     * passés, une petite rangée les reprend dans la barre : « Albums » y ramène, un nom ouvre son livre.
     *   remonterPour : boutons qui ouvrent un éditeur en haut du profil. Utilisés depuis la
     *                  barre compacte, la page remonte pour montrer l'éditeur.
     */
    PROFIL: {
        fixe: true,
        remonterPour: ["[data-ppers]", "[data-descredit]", "[data-sigprofil]", "[data-sigjoueur]"]
    },

    /*
     * MA COLLECTION ET TOUTES LES CARTES : en descendant dans les cartes, les onglets, la recherche, les boutons et
     * les raretés restent sous le menu, comme sur un profil (sur ordinateur, à partir de 901 px de large).
     */
    COLLECTION: {
        fixe: true
    },

    /*
     * ÉTIQUETTES (l'ancien « Album » de la collection ; le site garde pour elles le nom album dans
     * son code, et ce script aussi) : les onglets « Collection » et « Catégories », à la suite de
     * ceux du site.
     *   largeurMaxBouton : dans la vue d'ensemble, au-delà, le nom d'une étiquette finit par « … »
     *   suivreLaLecture  : l'onglet Collection s'allume quand on y lit ; dans la vue d'ensemble,
     *                      l'étiquette en cours de lecture est allumée
     */
    ALBUMS: {
        largeurMaxBouton: 210,
        suivreLaLecture: true
    },

    /*
     * EXPORT ET EXTRACTION (format Discord)
     *   limiteDiscord    : 2000 caractères pour un compte sans Nitro ; 1900 garde une marge
     *   marqueCarte      : entoure le nom de chaque carte (** = gras sur Discord)
     *   messagesAffiches : messages affichés d'un coup ; les suivants à la demande
     */
    EXPORT: {
        limiteDiscord: 1900,
        marqueCarte: "**",
        messagesAffiches: 20
    },

    /*
     * MODE CLEAN : éléments masqués quand le mode est actif.
     * Ajoutez simplement un sélecteur entre guillemets, séparé par une virgule.
     */
    CLEAN: {
        masquer: [
            "#packDiscord",
            "#parrainBtn",
            "#shopBtn",
            "#packX",
            "#spBandeau",
            "#poffers",
            "#rechargeSlot",
            ".recharge",
            "#hwBandeau",
            "#hwRebours",
            "#wfBandeau",
            "#wfMenu",
            ".tiroirbas .twf",
            ".crane[data-theme-bascule]",      // le crâne d'Halloween (la lune du mode nuit, elle, reste)
            "#mfBandeau",
            "#hwChrono",
            "#obBandeau"
        ]
    },

    /*
     * MODE LARGEUR : le site occupe toute la largeur de l'écran, sur toutes les pages.
     *   marge       : marge à gauche et à droite (px)
     *   carte       : largeur visée d'une carte quand sa taille n'est pas modifiée (marché)
     *   caseVitrine : largeur visée d'une case de vitrine
     *   defiWbc     : largeur visée d'un défi WBC
     */
    LARGEUR: {
        marge: 20,
        carte: 200,
        caseVitrine: 176,
        defiWbc: 290
    },

    /*
     * TAILLE DES CARTES : unique réglage pour toutes les pages, sauf les vues exclues.
     *   echelle     : 1 = taille normale, 0.5 = deux fois plus petit
     *   largeurBase : largeur d'une carte à taille normale (px)
     *   espaceBase  : espace normal entre deux cartes (px)
     *   policeMin / policeMax / policeCqi : taille du texte des cartes
     *   grille      : élément grille ; carte : sélecteur de carte
     *   vuesExclues : vues où la taille ne change pas (identifiant de la vue sans « v- »)
     */
    TAILLE_CARTES: {
        actif: true,
        echelle: 0.85,
        largeurBase: 200,
        espaceBase: 14,
        policeMin: 2,
        policeMax: 15,
        policeCqi: 6.6,
        grille: ".grid",
        carte: '[class~="card"]',
        vuesExclues: ["market"]
    },

    /*
     * TEXTE DES CARTES : la description, sur toutes les cartes du site (collection, Toutes les cartes, marché, paquets,
     * échanges, fiche…). Sa taille suit la carte, comme sur le site : « taille » est celle d'une description courte sur
     * une carte de 200 px de large ; sur une carte plus petite ou plus grande, elle suit, et une longue description
     * reste un peu plus petite pour tenir. Les cartes faites à la main (l'éditeur), celles des livres et des couvertures
     * gardent leur dessin (exclusions).
     */
    TEXTE: {
        actif: true,
        police: "Arial, Verdana, sans-serif",
        taille: 15,
        selecteurs: [".card .txt"],
        exclusions: [".card.perso", "#album", ".couv"]
    },

    /* TEXTE DES CARTES EN GRAS : la description, sur les mêmes cartes (avec ou sans le réglage du texte) */
    GRAS: {
        actif: true
    },

    /* CLIC DROIT : laisser le navigateur afficher son menu natif */
    CLIC_DROIT: {
        actif: true
    },

    /*
     * DOUBLONS (fenêtre d'échange) : tant que le filtre « Doublons » d'une colonne est allumé, le script
     * charge ses pages suivantes par lots : un lot quand on l'allume, puis un de plus à chaque
     * « Chercher plus loin ».
     *   pagesParLot    : pages chargées au plus par lot
     *   doublonsParLot : un lot s'arrête plus tôt dès qu'il a trouvé ce nombre de nouveaux doublons
     *   pauseMs        : pause entre deux pages d'un lot (ms)
     */
    DOUBLONS: {
        pagesParLot: 12,
        doublonsParLot: 30,
        pauseMs: 250
    },

    /*
     * DÉJÀ DE SON CÔTÉ (fenêtre d'échange) : dans la colonne « Tu donnes », les cartes que le partenaire
     * possède déjà reçoivent un badge. Pour le savoir, le script lit sa collection une seule fois
     * (/api/joueur/cartes, page par page), en garde les clés de version, et les met en cache par
     * joueur. Lecture seule, par lots espacés (CGU).
     *   pagesMax : pages lues au plus (au-delà, marquage partiel)
     *   pauseMs  : pause entre deux pages (ms)
     *   ttlMin   : durée de validité du cache d'un joueur (minutes)
     */
    A_DEJA: {
        pagesMax: 60,
        pauseMs: 350,
        ttlMin: 20
    },

    /*
     * IMAGES DE CARTES : quand l'image d'une carte ne charge pas (vignette Wikimedia régénérée, taille
     * changée, raté passager), on retombe sur le fichier ORIGINAL du même fichier (on retire la vignette
     * de l'URL) — toujours sur upload.wikimedia.org, donc autorisé par la CSP du site. Silencieux, aucune
     * permission en plus. Ne corrige pas un fichier supprimé/renommé sur Commons (interdit par la CSP).
     */
    IMAGES_CARTES: {
        actif: true
    },

    /*
     * DERNIERS PAQUETS : à chaque ouverture, le script note les cartes dès que le site les reçoit,
     * avant l'animation : un F5 pendant l'animation ne les perd pas (dans ce navigateur, sans
     * aucune requête de plus). La page Paquets les affiche.
     *   cartes : nombre de cartes gardées (les plus récentes)
     *   apercu : nombre de paquets montrés à côté du paquet à ouvrir
     */
    DERNIERS_PAQUETS: {
        actif: true,
        cartes: 100,
        apercu: 3
    },

    /*
     * DISCORD : le partage avec un serveur Discord, désactivé tant que le joueur ne l'active pas
     * (bouton « Discord » du panneau des derniers paquets, avec l'adresse du webhook que donne l'admin).
     * Le script envoie chaque paquet ouvert, chaque carte achetée aux enchères, toutes raretés, et la liste
     * de souhaits ; le bot du serveur publie les belles cartes par thème et prévient ceux qui souhaitaient une
     * carte piochée ou achetée.
     *   attenteMs  : écart entre deux envois, tous onglets confondus (Discord accepte une trentaine de messages par minute)
     *   fileMax    : envois gardés en attente au plus (au-delà, les plus anciens sont oubliés)
     *   souhaitsH  : la liste de souhaits est relue et renvoyée au moins toutes les N heures
     *   achatsMin  : au chargement, l'historique « Mes achats » est relu s'il date de plus de N minutes
     *                (une enchère remportée pendant que le site était fermé) ; une enchère remportée en
     *                direct le fait relire tout de suite
     *   messageMax : taille d'un message entier, en signes (Discord refuse au-delà de 2 000 : on garde de la marge)
     *   limitesMax : refus « trop vite » (429) de suite avant de faire une pause d'une minute
     */
    DISCORD: {
        attenteMs: 2500,
        fileMax: 80,
        souhaitsH: 12,
        achatsMin: 10,
        achatsRecentsH: 2,
        messageMax: 1900,
        limitesMax: 5
    },

    /*
     * TES SOUHAITS, MIS EN VALEUR : au marché, sur la page d'une enchère et dans les échanges proposés (colonne
     * « Tu reçois »), les cartes de ta liste de souhaits sont entourées et portent « ★ Tu la souhaites ».
     */
    SOUHAITS: {
        actif: true
    },

    /*
     * HISTORIQUE DES ÉCHANGES, JOUEUR PAR JOUEUR : le site ne montre que ses derniers échanges terminés, tous
     * joueurs mêlés. L'outil les garde dans ce navigateur, rangés par partenaire, et les montre sur la page
     * Échanges, dans la fenêtre d'échange et sur le profil du joueur. Lecture seule : rien ne part ailleurs.
     *   parJoueur : échanges gardés avec chaque joueur (les plus récents)
     *   relireMin : l'historique du site est relu au plus toutes les N minutes (une requête), à chaque passage
     *               sur la page Échanges, et après un échange accepté
     */
    HISTORIQUE: {
        actif: true,
        parJoueur: 300,
        relireMin: 10
    },

    /*
     * CHANCES : sur la fiche d'une carte, la chance de la tirer dans un paquet (une estimation : la chance de son
     * rang, donnée par le site, partagée entre toutes les cartes de ce rang) ; dans tes derniers paquets, ta chance
     * comparée à la moyenne (paquets normaux seulement).
     *   comptesH : le nombre de cartes de chaque rang est relu au plus toutes les N heures (une requête au site)
     */
    CHANCES: {
        actif: true,
        comptesH: 24
    },

    /*
     * GARDE-FOU : quand le site change et que l'outil n'y retrouve plus ce dont il a besoin (ou qu'une de ses
     * parties plante), un petit avis le dit, une fois par version du site.
     */
    GARDE_FOU: {
        actif: true
    },

    /* Textes de l'interface */
    TEXTES: {
        clean: "Clean",
        cleanTiroir: "Mode Clean",
        cleanAide: "Masquer les bandeaux, Discord, X, Parrainage, Boutique… (un second clic rétablit tout)",
        largeur: "Largeur",
        largeurAide: "Utiliser toute la largeur de l'écran, sur toutes les pages",
        exporterAlbums: "Exporter les étiquettes",
        extraireCartes: "Extraire les cartes",
        tousLesAlbums: "Toutes les étiquettes",
        toutesLesVitrines: "Toutes les vitrines",
        categories: "Catégories",
        exporter: "Exporter",
        exporterAide: "Exporter les étiquettes, ou leurs cartes, en messages Discord prêts à copier",
        chercherAlbum: "Chercher une étiquette…",
        chercherVitrine: "Chercher une vitrine…",
        aucunResultat: "Aucun résultat",
        collection: "Collection",
        souhaits: "Ses cartes que tu souhaites",
        souhaitsCourt: "Souhaitées",
        derniersTitre: "Tes derniers paquets",
        derniersVide: "Ouvre un paquet : ses cartes s'afficheront ici.",
        derniersNote: "Noté dans ce navigateur à chaque ouverture.",
        dernieresTitre: "Tes dernières cartes",
        nouvellesSeulement: "Nouvelles seulement",
        discordTitre: "Partage Discord",
        discordTexte: "Coche les serveurs avec qui partager tes paquets et ta liste de souhaits. Décoche pour arrêter.",
        discordVide: "Aucun serveur pour l'instant. Sur Discord, clique sur \"② Connecte l'outil\" dans le sas d'un serveur : il apparaîtra ici.",
        discordServeurSansNom: "Serveur Discord",
        mesAlbums: "Mes étiquettes",
        voirProfil: "Revenir en haut du profil",
        albumsProfil: "Albums",
        remonterAlbums: "Remonter aux albums",
        ouvrirLivre: "Ouvrir le livre",
        changerPhoto: "Changer la photo",
        actions: "Actions",
        aucuneSelection: "Sélectionne au moins une étiquette.",
        aucuneCarte: "Aucune carte trouvée dans les étiquettes sélectionnées (elles sont peut-être encore en chargement).",
        toutCopier: "Tout copier",
        copier: "Copier",
        copie: "Copié ✓",
        echecCopie: "Copie impossible",
        telecharger: "Télécharger .txt",
        livrePages: "Toutes les pages",
        livrePagesAide: "Voir toutes les pages du livre d'un coup d'œil, et sauter à l'une d'elles (touche G)",
        livreRaccourcis: "Raccourcis clavier",
        livreChercher: "Chercher une page, un titre, une carte…",
        livreBlanche: "Page blanche",
        livreVide: "Page vide suivante",
        livreVideAide: "Aller à la prochaine page vide de ton livre",
        livreLien: "Copier le lien de cette page",
        livreLienAide: "Copier un lien qui ouvre ce livre à la page affichée (pour un(e) ami(e) qui a l'outil)",
        reglages: "Réglages de l'outil",
        reglagesAide: "taille des cartes, texte, ce que Clean cache… (gardés dans ce navigateur)",
        souhaitee: "★ Tu la souhaites"
    }
};

/* ==========================================================================
   OUTILS
   ========================================================================== */
const D = document;
const HTML = D.documentElement;
const T = CONFIG.TEXTES;
const $ = (selecteur, racine) => (racine || D).querySelector(selecteur);
const $$ = (selecteur, racine) => Array.from((racine || D).querySelectorAll(selecteur));
const FORMAT = new Intl.NumberFormat("fr-FR");
const nombre = n => FORMAT.format(n);
const pluriel = (n, un, plusieurs) => nombre(n) + " " + (n > 1 ? plusieurs || un + "s" : un);
const propre = texte => String(texte == null ? "" : texte).replace(/\s+/g, " ").trim();
const pourRecherche = texte => propre(texte).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
const arrondi = n => Math.round(n * 100) / 100;

/* Crée un élément : el("button", {class: "x", title: "y"}, enfant, "texte"…) */
function el(balise, attributs, ...enfants) {
    const e = D.createElement(balise);
    for (const [nom, valeur] of Object.entries(attributs || {})) {
        if (valeur == null || valeur === false) continue;
        if (nom === "class") e.className = valeur;
        else e.setAttribute(nom, valeur === true ? "" : String(valeur));
    }
    for (const enfant of enfants.flat(Infinity)) {
        if (enfant == null || enfant === false) continue;
        e.append(typeof enfant === "object" ? enfant : String(enfant));
    }
    return e;
}

const SVG = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
/* Clean et Largeur : des formes pleines, comme le crâne et la lune du site, à côté desquels ils se rangent */
const PLEIN = 'viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"';
const ICONES = {
    clean: `<svg class="wpx-ico" ${PLEIN}><path d="M10 2Q10.9 8.1 17 9Q10.9 9.9 10 16Q9.1 9.9 3 9Q9.1 8.1 10 2z"/><path d="M18 13Q18.5 16.5 22 17Q18.5 17.5 18 21Q17.5 17.5 14 17Q17.5 16.5 18 13z"/><path d="M5.5 16.5Q5.8 18.7 8 19Q5.8 19.3 5.5 21.5Q5.2 19.3 3 19Q5.2 18.7 5.5 16.5z"/></svg>`,
    large: `<svg class="wpx-ico" ${PLEIN}><path d="M1.5 12L7 6.5V10h10V6.5l5.5 5.5L17 17.5V14H7v3.5z"/></svg>`,
    reglages: `<svg class="wpx-ico" ${PLEIN}><rect x="3" y="6" width="18" height="2.2" rx="1.1"/><rect x="3" y="15.8" width="18" height="2.2" rx="1.1"/><circle cx="15.5" cy="7.1" r="3.1"/><circle cx="8.5" cy="16.9" r="3.1"/></svg>`,
    liste: `<svg ${SVG}><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></svg>`,
    cartes: `<svg ${SVG}><rect x="3" y="6" width="11" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/></svg>`,
    copier: `<svg ${SVG}><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>`,
    telecharger: `<svg ${SVG}><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>`,
    aller: `<svg ${SVG}><path d="M7 17L17 7"/><path d="M9 7h8v8"/></svg>`,
    pages: `<svg ${SVG}><rect x="3" y="4" width="7.5" height="7" rx="1.2"/><rect x="13.5" y="4" width="7.5" height="7" rx="1.2"/><rect x="3" y="14" width="7.5" height="7" rx="1.2"/><rect x="13.5" y="14" width="7.5" height="7" rx="1.2"/></svg>`,
    clavier: `<svg ${SVG}><rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8"/></svg>`,
    pageVide: `<svg ${SVG}><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M12 11v6M9 14h6"/></svg>`,
    lien: `<svg ${SVG}><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5"/></svg>`,
    haut: `<svg ${SVG}><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>`
};
function icone(nom) {
    const s = el("span", {class: "wpx-i", "aria-hidden": "true"});
    s.innerHTML = ICONES[nom] || "";
    return s;
}

/* Mémoire du navigateur (préfixe « wpx. ») : si elle est indisponible, rien ne casse */
const memoire = {
    lire(cle, defaut) {
        try {
            const valeur = localStorage.getItem("wpx." + cle);
            return valeur === null ? defaut : JSON.parse(valeur);
        } catch (erreur) {
            return defaut;
        }
    },
    ecrire(cle, valeur) {
        try {
            localStorage.setItem("wpx." + cle, JSON.stringify(valeur));
            return true;
        } catch (erreur) {
            /* mémoire indisponible ou pleine : le réglage vaut pour cette visite seulement */
            return false;
        }
    },
    effacer(cle) {
        try {
            localStorage.removeItem("wpx." + cle);
        } catch (erreur) {
            /* rien à faire */
        }
    }
};

/* ==========================================================================
   RÉGLAGES DU JOUEUR
   Le panneau « Réglages de l'outil » garde ses choix dans ce navigateur (wpx.reglages) : ils s'appliquent
   par-dessus CONFIG dès le démarrage, avant tout le reste. Une mise à jour de l'outil remplace ce fichier, et
   donc CONFIG, mais pas eux. Seuls les réglages listés ici se changent du panneau.
   ========================================================================== */
const DEFAUTS = JSON.parse(JSON.stringify(CONFIG));
const REGLABLES = [
    {titre: "Affichage", lignes: [
        {chemin: "ENTETE.fixe", nom: "Menu fixe en haut de l'écran", type: "case"},
        {chemin: "ENTETE.ancienMenu", nom: "Ancien menu : toutes les pages côte à côte, sans dérouler Communauté (ordinateur)", type: "case"},
        {chemin: "ENTETE.ancienSite", nom: "Taille de l'ancien site : en-tête, menu et pages comme avant le 25/10", type: "case"},
        {chemin: "PROFIL.fixe", nom: "Barre compacte sur les profils", type: "case"},
        {chemin: "COLLECTION.fixe", nom: "Onglets et filtres fixes dans Ma collection et Toutes les cartes (ordinateur)", type: "case"},
        {chemin: "TAILLE_CARTES.actif", nom: "Régler la taille des cartes", type: "case"},
        {chemin: "TAILLE_CARTES.echelle", nom: "Taille des cartes", type: "curseur", min: 0.5, max: 1.3, pas: 0.05, facteur: 100,
            unite: " %", si: "TAILLE_CARTES.actif"},
        {chemin: "TEXTE.actif", nom: "Texte des cartes plus lisible", type: "case"},
        {chemin: "TEXTE.taille", nom: "Taille du texte", type: "curseur", min: 10, max: 18, pas: 1, unite: " px", si: "TEXTE.actif"},
        {chemin: "GRAS.actif", nom: "Texte des cartes en gras", type: "case"},
        {chemin: "LARGEUR.marge", nom: "Marges du mode Largeur", type: "curseur", min: 0, max: 80, pas: 4, unite: " px"}
    ]},
    {titre: "Aides", lignes: [
        {chemin: "SOUHAITS.actif", nom: "Mettre en valeur tes souhaits : marché, enchères, échanges proposés", type: "case"},
        {chemin: "HISTORIQUE.actif", nom: "Historique de tes échanges avec chaque joueur(euse)", type: "case"},
        {chemin: "CHANCES.actif", nom: "Chances : sur la fiche d'une carte et dans tes derniers paquets", type: "case"},
        {chemin: "DERNIERS_PAQUETS.actif", nom: "Noter tes derniers paquets", type: "case", recharger: true},
        {chemin: "IMAGES_CARTES.actif", nom: "Réparer les images de cartes qui ne chargent pas", type: "case", recharger: true},
        {chemin: "CLIC_DROIT.actif", nom: "Toujours permettre le clic droit", type: "case", recharger: true},
        {chemin: "GARDE_FOU.actif", nom: "Prévenir quand le site a changé", type: "case"}
    ]}
];
/* ce que cache le mode Clean, en clair (un sélecteur absent d'ici s'affiche tel quel) */
const NOMS_CLEAN = {
    "#packDiscord": "Le bouton Discord du menu", "#parrainBtn": "Le bouton Parrainage", "#shopBtn": "Le panier de la boutique",
    "#packX": "Le bouton X", "#spBandeau": "Le bandeau du Season Pass", "#poffers": "Les offres de paquets (page Paquets)",
    "#rechargeSlot": "Le bouton Recharger (page Paquets)", ".recharge": "Les recharges payantes", "#hwBandeau": "Le bandeau d'Halloween",
    "#hwRebours": "Le compte à rebours d'Halloween", "#wfBandeau": "Le bandeau wiki-foot", "#wfMenu": "Le bouton wiki-foot",
    ".tiroirbas .twf": "wiki-foot dans le tiroir du téléphone", ".crane[data-theme-bascule]": "Le crâne d'Halloween",
    "#mfBandeau": "Le bandeau Mythiques ×2", "#hwChrono": "Le chrono d'Halloween", "#obBandeau": "La barre de l'événement GTA VI"
};
const lireChemin = (chemin, base) => {
    const [bloc, cle] = chemin.split(".");
    return ((base || CONFIG)[bloc] || {})[cle];
};
const ligneReglable = chemin => REGLABLES.flatMap(s => s.lignes).find(l => l.chemin === chemin);
/* une valeur gardée ne passe que si elle a le bon type et reste dans les bornes du panneau */
function ecrireReglage(chemin, valeur) {
    const l = ligneReglable(chemin);
    if (!l || typeof valeur !== typeof lireChemin(chemin, DEFAUTS)) return;
    if (l.type === "curseur") {
        if (!Number.isFinite(valeur)) return;
        valeur = Math.min(l.max, Math.max(l.min, valeur));
    }
    for (const c of [chemin, ...(l.aussi || [])]) {
        const [bloc, cle] = c.split(".");
        CONFIG[bloc][cle] = valeur;
    }
}
(function appliquerReglages() {
    const r = memoire.lire("reglages", null) || {};
    if (r.valeurs && typeof r.valeurs === "object") Object.entries(r.valeurs).forEach(([chemin, valeur]) => ecrireReglage(chemin, valeur));
    if (Array.isArray(r.cleanSauf)) CONFIG.CLEAN.masquer = DEFAUTS.CLEAN.masquer.filter(s => !r.cleanSauf.includes(s));
    /* (12.18) les deux réglages du gras n'en font plus qu'un, GRAS.actif : un « Texte des cartes en gras » décoché le reste */
    if (r.valeurs && typeof r.valeurs === "object" && r.valeurs["TEXTE.gras"] === false && !("GRAS.actif" in r.valeurs))
        ecrireReglage("GRAS.actif", false);
})();

/* Regroupe les appels rapprochés : fn ne s'exécute qu'une fois, `delai` ms après le premier */
function regrouper(fn, delai) {
    let minuterie = 0;
    return () => {
        if (minuterie) return;
        minuterie = setTimeout(() => {
            minuterie = 0;
            fn();
        }, delai);
    };
}

async function copierTexte(texte) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            /* certains navigateurs laissent la promesse en suspens (page sans le focus) : 1,5 s au plus */
            await Promise.race([
                navigator.clipboard.writeText(texte),
                new Promise((ok, refus) => setTimeout(() => refus(new Error("délai dépassé")), 1500))
            ]);
            return true;
        } catch (erreur) {
            /* on passe à l'ancien mécanisme */
        }
    }
    const actif = D.activeElement;
    const zone = el("textarea", {readonly: true, "aria-hidden": "true"});
    zone.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    zone.value = texte;
    D.body.append(zone);
    zone.select();
    let ok = false;
    try {
        ok = D.execCommand("copy");
    } catch (erreur) {
        ok = false;
    }
    zone.remove();
    if (actif && actif.focus) actif.focus({preventScroll: true});
    return ok;
}

function telecharger(nomFichier, texte) {
    const lien = el("a", {href: "data:text/plain;charset=utf-8," + encodeURIComponent(texte), download: nomFichier});
    lien.style.display = "none";
    D.body.append(lien);
    lien.click();
    lien.remove();
}

/* « Étiquettes de Typhonx » -> etiquettes_de_typhonx : sans accent, sans espace */
function nomDeFichier(...parties) {
    return parties
        .map(p => pourRecherche(p).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""))
        .filter(Boolean)
        .join("_");
}

function dateDuJour() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/* fn s'exécute quand la page a fini de défiler (événement scrollend, ou au plus tard 1,2 s après) */
function quandDefilementFini(fn) {
    let fait = false;
    const fin = () => {
        if (fait) return;
        fait = true;
        removeEventListener("scrollend", fin);
        fn();
    };
    addEventListener("scrollend", fin);
    setTimeout(fin, 1200);
}

/* Lit un nombre écrit à la française (« 1 234 ») dans le premier groupe d'une correspondance */
function lireNombre(correspondance) {
    if (!correspondance) return null;
    const n = parseInt(correspondance[1].replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? n : null;
}

function selecteurValide(selecteur) {
    try {
        D.createDocumentFragment().querySelector(selecteur);
        return true;
    } catch (erreur) {
        console.warn("Album+cleaner+Maximisation : sélecteur ignoré :", selecteur);
        return false;
    }
}

/* une variable CSS en pixels, écrite seulement quand elle change */
const VARIABLES = {};
function definirVariable(nom, px) {
    if (VARIABLES[nom] === px) return;
    VARIABLES[nom] = px;
    HTML.style.setProperty(nom, px + "px");
}

/* ==========================================================================
   STYLES : une seule feuille, écrite au démarrage. Les modes ne font qu'ajouter
   ou retirer une classe sur <html> : rien n'est écrit dans les éléments du site,
   donc rien ne peut « rester collé » quand on désactive un mode.
   ========================================================================== */
const BANDEAUX = "#cfBandeau,#hwBandeau,#wfBandeau,#obBandeau,#cxBandeau,#mfBandeau,#spBandeau";

/* Les couleurs des panneaux viennent de celles du thème du site (--vio2, --vio, --mag, --grad, --edge…) : elles suivent
   d'elles-mêmes le thème normal, Halloween (le crâne) et le mode nuit (la lune). Seuls les fonds sont réglés par thème. */
function cssBase() {
    return `
:root{--wpx-entete-h:0px;--wpx-entete-bas:0px;--wpx-ident-h:0px;
  --wpx-verre:rgba(14,9,26,.88);--wpx-plein:#110b1e;--wpx-flou:blur(16px) saturate(140%);
  --wpx-bord:var(--edge,rgba(167,139,250,.16));--wpx-bord2:var(--edge2,rgba(167,139,250,.32));
  --wpx-encre:var(--ink,#ece9f6);--wpx-doux:var(--mute,#9a93b3);--wpx-pale:var(--faint,#6b6485);
  --wpx-teinte:var(--vio2,#a78bfa);--wpx-coche:var(--vio,#8b5cf6);--wpx-vif:var(--mag,#d946ef);
  --wpx-accent:color-mix(in srgb,var(--wpx-teinte) 62%,#fff);--wpx-degrade:var(--grad,linear-gradient(135deg,#7c3aed,#c026d3))}
html.th-halloween{--wpx-verre:rgba(16,8,6,.9);--wpx-plein:#150b08}
html.th-nuit{--wpx-verre:rgba(3,6,14,.9);--wpx-plein:#070c1a}
.wpx-verre{background:var(--wpx-verre);-webkit-backdrop-filter:var(--wpx-flou);backdrop-filter:var(--wpx-flou);
  border:1px solid var(--wpx-bord);border-radius:14px;box-shadow:0 16px 36px -16px rgba(0,0,0,.85)}
.wpx-i{display:inline-grid;place-items:center;flex:0 0 auto}
.wpx-i svg{width:15px;height:15px}
.wpx-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:30px;padding:0 12px;
  border:1px solid var(--wpx-bord);border-radius:9px;background:rgba(255,255,255,.04);color:var(--wpx-encre);
  font:600 12.5px/1 Inter,system-ui,sans-serif;white-space:nowrap;cursor:pointer;transition:background-color .12s,border-color .12s,color .12s}
.wpx-btn:hover{background:rgba(255,255,255,.08);border-color:var(--wpx-bord2)}
.wpx-btn:focus-visible,.wpx-puce:focus-visible,.wpx-lien:focus-visible,.wpx-t-ligne:focus-visible{outline:2px solid var(--wpx-accent);outline-offset:2px}
.wpx-btn[aria-expanded="true"]{background:color-mix(in srgb,var(--wpx-teinte) 16%,transparent);border-color:var(--wpx-bord2)}
.wpx-btn.wpx-ok{background:rgba(74,222,128,.14);border-color:rgba(74,222,128,.45);color:#bbf7d0}
.wpx-champ{height:34px;min-width:0;padding:0 12px;border:1px solid var(--wpx-bord2);border-radius:9px;
  background:rgba(0,0,0,.28);color:var(--wpx-encre);font:500 13px Inter,system-ui,sans-serif;outline:none}
.wpx-champ:focus{border-color:var(--wpx-accent)}
.wpx-vide{padding:18px 10px;text-align:center;color:var(--wpx-pale);font:500 13px Inter,system-ui,sans-serif}
.wpx-flash{animation:wpxFlash 1.4s ease-out;border-radius:14px}
@keyframes wpxFlash{0%,35%{box-shadow:0 0 0 2px color-mix(in srgb,var(--wpx-accent) 75%,transparent),0 0 34px -6px color-mix(in srgb,var(--wpx-vif) 80%,transparent)}
  100%{box-shadow:0 0 0 2px transparent,0 0 34px -6px transparent}}
@media (prefers-reduced-motion:reduce){#wpx-ident,#wpx-ident .wpx-id-l3,#wpx-tiroir,.wpx-puce,#pvbloc>.vhead,.wpx-crane,#wpx-livre,
  #v-coll>#ctabs,#v-coll>#cTools,#v-explore>.tools,#v-explore>#er{transition:none!important}.wpx-flash{animation:none}}`;
}

/* Mission 1 : le menu du site fixé en haut, quelle que soit la page */
function cssEntete() {
    if (!CONFIG.ENTETE.fixe) return "";
    return `
html.wpx-entete body>header.top{position:sticky;top:0;z-index:60;pointer-events:none;
  background:linear-gradient(180deg,var(--bg,#06040b) 0,var(--bg,#06040b) 12px,transparent 12px)}
html.wpx-entete body>header.top>*{pointer-events:auto}
html.wpx-entete{scroll-padding-top:calc(var(--wpx-entete-h) + 12px)}
html.wpx-entete .feedside{top:calc(var(--wpx-entete-h) + 14px);max-height:calc(100vh - var(--wpx-entete-h) - 28px)}
html.wpx-entete .apcard{top:calc(var(--wpx-entete-h) + 16px)}
html.wpx-entete .edapercu{top:calc(var(--wpx-entete-h) + 12px)}
html.wpx-entete #v-admin .adm-nav{top:calc(var(--wpx-entete-h) + 16px)}
@media (min-width:901px){
  /* le menu du 25/10/2026 : la rangée du haut part avec la page (--wpx-entete-masque, sa hauteur), les rubriques restent,
     sur un fond de verre qui n'apparaît qu'une fois collées (le site les pose sans fond, sur celui de la page) */
  html.wpx-entete body.menu-neuf>header.top{top:calc(-1 * var(--wpx-entete-masque,0px));background:none}
  html.wpx-entete body.menu-neuf>header.top::before{content:"";position:absolute;z-index:-1;left:0;right:0;top:var(--wpx-entete-masque,0px);bottom:0;
    background:var(--wpx-verre);-webkit-backdrop-filter:var(--wpx-flou);backdrop-filter:var(--wpx-flou);
    border-bottom:1px solid var(--wpx-bord);box-shadow:0 16px 36px -16px rgba(0,0,0,.85);opacity:0;transition:opacity .16s}
  html.wpx-entete.wpx-entete-colle body.menu-neuf>header.top::before{opacity:1}
  html.wpx-entete body.sp-plein>header.top{z-index:76}
  html.wpx-entete body.sp-plein #v-saison{top:var(--wpx-entete-bas)}
  html.wpx-entete body.sp-plein .spass{min-height:calc(100vh - var(--wpx-entete-bas))}
}`;
}

/* L'ancien menu (ENTETE.ancienMenu, sur ordinateur) : la rangée d'onglets d'origine (#tabs), que le site garde cachée mais
   tient à jour (pastilles, page ouverte, ses clics), revient à la place des rubriques et de la barre de « Communauté » */
function cssAncienMenu() {
    if (!CONFIG.ENTETE.ancienMenu) return "";
    return `
@media (min-width:901px){
  body.menu-neuf #menuRub,body.menu-neuf #menuSous{display:none!important}
  html body.menu-neuf .tabs{display:flex!important;margin-top:14px;padding:6px 2px;
    border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07)}
}`;
}

/* La taille de l'ancien site (ENTETE.ancienSite). La refonte du 25/10 est une couche posée sur l'ancien site, accrochée à
   la classe menu-neuf du <body> : appliquerAncienSite la retire, et les règles du 24/10, toujours là, reviennent telles
   quelles (en-tête, ancien menu, largeurs, onglets et filtres des pages). Seul le bloc du joueur est un élément nouveau :
   il se dissout ici, et ses morceaux (photo, pseudo, niveau, Wikiki) reprennent leur style d'avant. Menu fixe : seule
   l'ancienne rangée d'onglets reste, sur le verre de l'ancien en-tête (--wpx-entete-masque, mesurerEntete). */
function cssAncienSite() {
    if (!CONFIG.ENTETE.ancienSite) return "";
    const A = "html.wpx-ancien-site";
    return `
@media (min-width:901px){
  ${A} :is(#menuRub,#menuSous){display:none!important}
  ${A} :is(.jbloc,.jb-haut,.jb-chiffres){display:contents!important}
  ${A} :is(.jb-depuis,#chipCartes,.jb-chiffres .chip em,.jb-chiffres #chipPacks){display:none!important}
  ${A} .jbloc #meBtn{order:1;position:static;height:38px;padding:0;gap:0;font:600 13.5px Inter,system-ui,sans-serif;
    letter-spacing:normal;text-transform:none;color:inherit}
  ${A} .jbloc #meBtn>span:not(.av){display:none!important}
  ${A} .jbloc #meBtn .av{position:static;width:36px;height:36px;margin:0;font-size:15px;box-shadow:none!important}
  ${A} .jbloc #meBtn:hover .av{box-shadow:0 0 0 2px var(--vio2)!important}
  ${A} .jbloc #meBtn .meniv{order:0;margin:0 6px 0 11px;padding:0;background:none;font:800 12px/1 Sora,Inter,sans-serif;color:#fde68a}
  ${A} .jbloc.out #meBtn{height:36px;padding:0 16px;font:600 13.5px Inter,system-ui,sans-serif}
  ${A} .jbloc.out #meBtn>span:not(.av){display:inline!important}
  ${A} .jb-chiffres .chip{display:flex!important;align-items:center;gap:7px;height:36px;padding:0 12px;font-weight:700;font-size:13.5px}
  ${A} .jb-chiffres .chip[hidden]{display:none!important}
  ${A} .jb-chiffres .chip>span:last-child{font:inherit;color:inherit}
  ${A} .jb-chiffres .chip svg{width:17px;height:17px}
  ${A} .jb-chiffres .chip .coin{width:17px;height:17px;font-size:9.5px}
  ${A} .hwrebours:not(.court) span{display:flex!important}
  ${A} .wfmenu:not(.court) span i{display:block!important}
  html.wpx-entete.wpx-ancien-site body>header.top{top:calc(-1 * var(--wpx-entete-masque,0px))}
}
@media (min-width:901px) and (max-width:1299.9px){
  ${A} .wfmenu{padding:0 14px 0 11px}
  ${A} .wfmenu b{display:inline}
  ${A}:not(.wpx-clean) body:not(.dehors):not(.inconnu) #parrainBtn:not([hidden]){display:inline-flex!important}
}
@media (min-width:1600px){
  ${A} .bar{max-width:1280px}
  ${A} .wrap{max-width:1320px}
}`;
}

/* Clean et Largeur, à côté du crâne et de la lune du site et dans leur style (une forme pleine, sans fond, qui grossit au
   survol) ; allumés, ils prennent la couleur du thème et brillent, comme la lune en mode nuit. Sur téléphone, la rangée du
   haut est pleine : Clean est dans le tiroir du site, et Largeur n'y sert à rien. */
function cssBascules() {
    return `
.wpx-crane{flex:0 0 auto;width:32px;height:40px;display:grid;place-items:center;padding:0;background:none;border:0;cursor:pointer;
  color:#cfc8e2;transition:transform .15s,filter .2s,color .2s}
.wpx-crane:hover{transform:scale(1.1);color:#fff}
.wpx-crane:focus-visible{outline:2px solid var(--wpx-accent);outline-offset:2px}
.wpx-crane .wpx-ico{display:block;width:22px;height:22px}
.wpx-crane[aria-pressed="true"]{color:var(--wpx-accent);filter:drop-shadow(0 0 7px color-mix(in srgb,var(--wpx-teinte) 75%,transparent))}
@media (min-width:901px){body.menu-neuf .row1>.wpx-crane{order:98}}
@media (max-width:700px){.row1>.wpx-crane{display:none}}
.wpx-bascule-tiroir .wpx-voyant{display:inline-block;width:6px;height:6px;margin-left:auto;border-radius:50%;
  background:currentColor;opacity:.28;flex:0 0 auto;transition:opacity .15s,box-shadow .15s}
.wpx-bascule-tiroir[aria-pressed="true"],.wpx-bascule-tiroir[aria-pressed="true"] svg{color:var(--wpx-accent)}
.wpx-bascule-tiroir[aria-pressed="true"] .wpx-voyant{opacity:1;box-shadow:0 0 8px currentColor}`;
}

/* Mode Clean : une règle par sélecteur ; un sélecteur invalide n'emporte pas les autres */
function cssClean() {
    return CONFIG.CLEAN.masquer
        .filter(selecteurValide)
        .map(s => `html.wpx-clean :is(${s}){display:none!important}`)
        .join("\n");
}

/* Mode Largeur : tous les blocs qui bornent la largeur, et les grilles à colonnes fixes */
function cssLargeur() {
    const L = CONFIG.LARGEUR;
    return `
@media (min-width:701px){
  html.wpx-large .bar,html.wpx-large main.wrap,html.wpx-large :is(${BANDEAUX}){max-width:none!important}
  html.wpx-large body>header.top{padding-left:${L.marge}px;padding-right:${L.marge}px}
  html.wpx-large main.wrap{padding-left:${L.marge}px;padding-right:${L.marge}px}
  html.wpx-large :is(${BANDEAUX}){width:calc(100% - ${2 * L.marge}px)}
  html.wpx-large .vgrid{max-width:none;grid-template-columns:repeat(auto-fill,minmax(min(${L.caseVitrine}px,100%),1fr))}
  html.wpx-large .wbc-grid{grid-template-columns:repeat(auto-fill,minmax(min(${L.defiWbc}px,100%),1fr))}
  html.wpx-large main .grid:not(.ccol .grid){max-width:none;grid-template-columns:repeat(auto-fill,minmax(min(${L.carte}px,100%),1fr))}
}`;
}

function echelleCartes() {
    const n = Number(CONFIG.TAILLE_CARTES.echelle);
    return n > 0 ? n : 1;
}

/* Taille des cartes : partout, sauf sur les vues exclues (classe wpx-sans-taille) */
function cssTailleCartes() {
    const Z = CONFIG.TAILLE_CARTES;
    if (!Z.actif) return "";
    const e = echelleCartes();
    const largeur = arrondi(Z.largeurBase * e);
    const espace = arrondi(Z.espaceBase * e);
    const G = `html:not(.wpx-sans-taille) :is(${Z.grille})`;
    return `
${G}{grid-template-columns:repeat(auto-fill,minmax(${largeur}px,1fr))!important;gap:${espace}px!important;max-width:none!important}
${G} .slot{width:100%!important;max-width:${largeur}px!important;min-width:0!important}
${G} .slot>.cw{width:100%!important}
${G} ${Z.carte}{width:100%!important;max-width:100%!important;font-size:clamp(${Z.policeMin}px,${Z.policeCqi}cqi,${Z.policeMax}px)!important}
${G} ${Z.carte} .picw{aspect-ratio:auto}`;
}

/* La zone de texte des cartes visées (TEXTE.selecteurs), hors des cartes qui gardent leur dessin (TEXTE.exclusions) */
function texteDesCartes() {
    const X = CONFIG.TEXTE;
    if (!X.selecteurs.length) return "";
    const exclus = X.exclusions.filter(selecteurValide).join(",");
    return `:is(${X.selecteurs.join(",")})` + (exclus ? `:not(:is(${exclus}) *)` : "");
}

/* Texte des cartes : la description, en proportion de sa carte. Le site règle la police d'une carte sur sa largeur
   (6,6 % : 13,2 px pour une carte de 200 px), et la description sur elle : 0,78 em, moins pour une longue (.d2 à .d4).
   Chaque description grossit d'autant (« taille » px pour une courte, sur une carte de 200 px) : une petite carte garde
   un petit texte, une longue description reste un peu plus petite. La zone (.txt) garde sa taille, donc ses marges. */
const DESCRIPTIONS = [["", 0.78], [".d2", 0.71], [".d3", 0.64], [".d4", 0.58]];
function cssTexte() {
    const X = CONFIG.TEXTE;
    const cible = texteDesCartes();
    if (!X.actif || !cible) return "";
    const facteur = X.taille / (13.2 * 0.78);
    return `
html ${cible}{font-family:${X.police}!important}` + DESCRIPTIONS.map(([classe, em]) => `
html ${cible} .de${classe}{font-size:${arrondi(facteur * em)}em!important}`).join("");
}

function cssGras() {
    const cible = texteDesCartes();
    if (!CONFIG.GRAS.actif || !cible) return "";
    return `\nhtml ${cible}{font-weight:bold!important}`;
}

/* Mission 2 : la barre compacte du profil, et l'en-tête Vitrines / Étiquettes fixé dessous */
function cssProfil() {
    return `
#wpx-ident-ancre{position:sticky;top:calc(var(--wpx-entete-h) + 6px);height:0;z-index:56}
#wpx-ident{position:absolute;left:0;right:0;top:0;display:grid;grid-template-columns:auto minmax(0,1fr) auto;
  align-items:center;column-gap:14px;row-gap:2px;padding:6px 14px 6px 12px;
  opacity:0;visibility:hidden;transform:translateY(-6px);pointer-events:none;
  transition:opacity .16s ease,transform .16s ease,visibility 0s linear .16s,border-radius .16s}
html.wpx-ident-on #wpx-ident{opacity:1;visibility:visible;transform:none;pointer-events:auto;transition:opacity .16s ease,transform .16s ease,border-radius .16s}
#wpx-ident::before,#wpx-coll.wpx-colle::before{content:"";position:absolute;left:0;right:0;bottom:100%;height:8px;background:var(--bg,#06040b);pointer-events:none}
html.wpx-dock #wpx-ident{border-bottom-left-radius:0;border-bottom-right-radius:0;box-shadow:none}
#wpx-ident .wpx-id-av{grid-row:1/3;position:relative;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:none;cursor:pointer}
#wpx-ident .wpx-id-av .av{width:40px;height:40px;font-size:17px;--ce:1}
#wpx-ident .wpx-id-av .av.regle img{object-fit:contain;object-position:50% 50%}
#wpx-ident .wpx-id-chg{position:absolute;left:0;right:0;bottom:0;padding:1px 0 3px;border-radius:0 0 20px 20px;
  background:color-mix(in srgb,var(--bg,#06040b) 80%,transparent);color:var(--wpx-accent);font:700 8.5px/1.4 Inter,sans-serif;text-align:center;opacity:0;transition:opacity .15s}
#wpx-ident .wpx-id-av:hover .wpx-id-chg,#wpx-ident .wpx-id-av:focus-visible .wpx-id-chg{opacity:1}
#wpx-ident .wpx-id-l1{display:flex;align-items:center;gap:8px;min-width:0;overflow:hidden;white-space:nowrap}
#wpx-ident .wpx-id-nom{font:800 18px/1.25 Sora,Inter,sans-serif;cursor:pointer;flex:0 0 auto;max-width:60%;overflow:hidden;text-overflow:ellipsis}
#wpx-ident .wpx-id-nom .pnom{font-style:normal}
#wpx-ident .pnom.pcoul .pdin{background:none;color:inherit;-webkit-text-fill-color:inherit}
#wpx-ident .pnom.ppol .pdin{font-weight:inherit}
#wpx-ident .badge-s{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:11px;line-height:1.5;padding:1px 8px}
#wpx-ident .wpx-id-depuis{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--wpx-doux);font-size:12.5px;flex:0 100 auto}
#wpx-ident .wpx-id-depuis .link{font-size:inherit;padding:0}
/* le bouton « souhaitées » du site reste à sa place, caché : son reflet est dans le groupe d'onglets */
html.wpx-profil-fixe #profile #pcsouh{display:none!important}
.rar .k-DUP{color:var(--wpx-accent);font-family:Inter;letter-spacing:0;font-weight:700}
.ccol .rar.crar .k-DUP{padding:0 5px}
.rar .k-DUP.on{color:#15110a;background:linear-gradient(95deg,color-mix(in srgb,var(--wpx-teinte) 40%,#fff),var(--wpx-teinte),color-mix(in srgb,var(--wpx-vif) 55%,#fff))}
.ccol.wpx-tc-doublons .grid>.slot:not(:has(.dup)){display:none!important}
/* « Déjà de son côté » : coin haut-droit, libre (le ×2 est en haut-gauche, « Proposée » en haut-centre, la coche à gauche) */
#tcGrid-give .slot .cw>.wpx-adeja{position:absolute;top:-6px;right:-6px;z-index:13;pointer-events:none;background:#b91c1c;color:#fff;border:1px solid rgba(255,255,255,.4);border-radius:999px;font:800 10px/1 Sora,Inter,sans-serif;letter-spacing:.2px;padding:3px 7px;white-space:nowrap;box-shadow:0 4px 10px -3px rgba(0,0,0,.7)}
.wpx-adeja-statut{flex:1 1 100%;margin:2px 0 0;font:500 11.5px/1.4 Inter,sans-serif;color:var(--wpx-doux)}
.wpx-tc-statut{display:flex;align-items:center;gap:6px;flex-wrap:wrap;flex:1 1 100%;margin:2px 0 0;font:500 11.5px/1.4 Inter,sans-serif;color:var(--wpx-doux)}
.wpx-tc-statut .wpx-lien{padding:1px 5px;font-size:11.5px}
#wpx-ident .wpx-id-acts{grid-column:3;grid-row:1;display:flex;align-items:center;gap:6px}
#wpx-ident .wpx-id-acts .btn{height:28px;padding:0 11px;font-size:12px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis}
#wpx-ident .wpx-id-l2{grid-column:2/4;grid-row:2;display:flex;align-items:center;gap:8px;min-width:0}
#wpx-ident .wpx-id-stats{flex:0 1 auto;min-width:0;display:flex;gap:16px;white-space:nowrap;font-size:12px;color:var(--wpx-doux)}
#wpx-ident .wpx-stat b{color:var(--wpx-encre);font:800 12.5px Sora,Inter,sans-serif}
#wpx-ident .wpx-stat small{font-size:11.5px;color:var(--wpx-pale)}
/* les albums (les livres) du joueur : une rangée fine sous les chiffres, qui se déplie une fois leur bloc passé sous la barre */
#wpx-ident .wpx-id-l3{grid-column:2/4;grid-row:3;display:flex;align-items:center;gap:6px;min-width:0;max-height:0;margin-top:-2px;padding:0;
  border-top:1px solid transparent;overflow-x:auto;overflow-y:hidden;scrollbar-width:none;opacity:0;visibility:hidden;font:600 12px Inter,system-ui,sans-serif;
  transition:max-height .18s ease,margin .18s ease,padding .18s ease,border-color .18s,opacity .18s ease,visibility 0s linear .18s}
#wpx-ident .wpx-id-l3::-webkit-scrollbar{display:none}
html.wpx-ident-livres #wpx-ident .wpx-id-l3{max-height:40px;margin-top:4px;padding-top:6px;border-top-color:var(--wpx-bord);opacity:1;visibility:visible;
  transition:max-height .18s ease,margin .18s ease,padding .18s ease,border-color .18s,opacity .18s ease}
#wpx-ident .wpx-id-alb{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;height:24px;padding:0 9px 0 5px;border:0;border-radius:8px;
  background:none;color:var(--wpx-doux);font:inherit;font-weight:700;white-space:nowrap;cursor:pointer;transition:color .12s,background-color .12s}
#wpx-ident .wpx-id-alb:hover{color:var(--wpx-encre);background:rgba(255,255,255,.07)}
#wpx-ident .wpx-id-alb .wpx-i svg{width:13px;height:13px}
#wpx-ident .wpx-id-l3 .wpx-puce{height:24px;max-width:220px;padding:0 10px}
.wpx-menu{position:relative}
.wpx-menu>summary{list-style:none}
.wpx-menu>summary::-webkit-details-marker{display:none}
.wpx-menu-liste{position:absolute;right:0;top:calc(100% + 6px);z-index:3;display:flex;flex-direction:column;gap:6px;min-width:230px;padding:8px;
  background:var(--wpx-plein);border:1px solid var(--wpx-bord2);border-radius:12px;box-shadow:0 22px 50px -18px #000}
.wpx-menu-liste .btn{width:100%;justify-content:flex-start}
html.wpx-profil-fixe #pvbloc>.vhead{position:sticky;top:calc(var(--wpx-entete-h) + var(--wpx-ident-h) + 6px);z-index:55;
  margin:18px -12px 14px;padding:7px 12px;row-gap:8px;border:1px solid transparent;border-radius:14px;
  transition:background-color .16s,border-color .16s,box-shadow .16s,border-radius .16s}
html.wpx-profil-fixe #pvbloc>.vhead.wpx-colle{margin-left:0;margin-right:0;background:var(--wpx-verre);-webkit-backdrop-filter:var(--wpx-flou);backdrop-filter:var(--wpx-flou);
  border-color:var(--wpx-bord);border-top-color:rgba(255,255,255,.05);border-radius:0 0 14px 14px;box-shadow:0 16px 36px -16px rgba(0,0,0,.85)}
html.wpx-profil-fixe #pvbloc>.vhead>.wpx-barre{flex:1 1 420px}
/* Le site range l'en-tête « Vitrines / Étiquettes » dans le bloc des vitrines : collé, il partait avec la fin
   de ce bloc. Sans boîte propre (display: contents), le bloc laisse l'en-tête collé jusqu'en bas du profil. */
html.wpx-profil-fixe #pvbloc{display:contents}
/* Le bandeau « Collection » (titre, recherche, raretés, tri) se colle à son tour, sous l'en-tête des vitrines */
@media (min-width:701px){
  html.wpx-profil-fixe #profile>.vhead{position:sticky;z-index:54;top:calc(var(--wpx-entete-h) + var(--wpx-ident-h) + var(--wpx-vb-h,0px) + 6px);
    margin:18px -12px 10px;padding:7px 12px;border:1px solid transparent;border-radius:14px;
    transition:background-color .16s,border-color .16s,box-shadow .16s,border-radius .16s}
  html.wpx-profil-fixe #profile>#pctri{position:sticky;z-index:53;top:calc(var(--wpx-entete-h) + var(--wpx-ident-h) + var(--wpx-vb-h,0px) + var(--wpx-cv-h,0px) + 6px);
    margin:-4px -12px 16px;padding:5px 12px 7px;border:1px solid transparent;border-radius:14px;
    transition:background-color .16s,border-color .16s,box-shadow .16s,border-radius .16s}
  html.wpx-profil-fixe #profile>.vhead.wpx-colle,html.wpx-profil-fixe #profile>#pctri.wpx-colle{margin-left:0;margin-right:0;
    background:var(--wpx-verre);-webkit-backdrop-filter:var(--wpx-flou);backdrop-filter:var(--wpx-flou);
    border-color:var(--wpx-bord);border-top-color:rgba(255,255,255,.05);border-radius:0 0 14px 14px;box-shadow:0 16px 36px -16px rgba(0,0,0,.85)}
  html.wpx-dock-col #pvbloc>.vhead.wpx-colle,html.wpx-dock-tri #profile>.vhead.wpx-colle{border-radius:0;box-shadow:none;border-bottom-color:transparent}
}
@media (max-width:980px){#wpx-ident .wpx-stat:nth-child(n+5){display:none}}
@media (max-width:900px){#wpx-ident .wpx-id-l2,#wpx-ident .wpx-id-depuis,#wpx-ident .wpx-id-acts{display:none}#wpx-ident .wpx-id-av{grid-row:1}
  #wpx-ident .wpx-id-l3{grid-row:2;grid-column:1/4}}
@media (max-width:700px){html.wpx-profil-fixe #pvbloc>.vhead>h2{display:none}}`;
}

/* Mission 3 : un bouton par étiquette, la vue d'ensemble, les deux exports ; et la barre de « Mes étiquettes » */
function cssBarreAlbums() {
    return `
.wpx-barre{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 100%;font:600 12.5px Inter,system-ui,sans-serif}
/* le groupe d'onglets du script, centré entre deux traits : la typographie et le surlignage de ceux du site */
.segsm.wpx-groupe{flex:1 1 auto;justify-content:safe center;gap:4px;min-width:0;margin:0 0 0 6px;padding:0 14px;
  background:none;border:0;border-left:1px solid var(--edge,var(--wpx-bord));border-radius:0}
#profile .wpx-groupe button,#wpx-coll .wpx-groupe button{padding:8px 13px;font:600 14px Inter}
.wpx-groupe.wpx-court{flex-wrap:wrap}
.wpx-onglet .wpx-n{font-weight:500;opacity:.85}
.wpx-onglet .wpx-ct,.wpx-groupe.wpx-court .wpx-onglet .wpx-lg{display:none}
.wpx-groupe.wpx-court .wpx-onglet .wpx-ct{display:inline}
.wpx-ailleurs > button.on{background:none;color:var(--mute)}
.wpx-puce{flex:0 0 auto;display:inline-flex;align-items:center;gap:7px;max-width:${CONFIG.ALBUMS.largeurMaxBouton}px;height:30px;padding:0 11px 0 10px;
  border:1px solid var(--wpx-bord);border-radius:999px;background:rgba(255,255,255,.035);color:var(--wpx-doux);
  font:inherit;white-space:nowrap;cursor:pointer;transition:color .12s,background-color .12s,border-color .12s}
.wpx-puce:hover{color:var(--wpx-encre);background:rgba(255,255,255,.08);border-color:var(--wpx-bord2)}
.wpx-puce>i{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:var(--c,#8b5cf6);box-shadow:0 0 8px -1px var(--c,#8b5cf6)}
.wpx-puce>span{overflow:hidden;text-overflow:ellipsis}
.wpx-puce>small{font:700 11px Inter,sans-serif;color:var(--wpx-pale)}
.wpx-puce.wpx-actif{color:#fff;border-color:transparent;background:var(--wpx-degrade)}
.wpx-puce.wpx-actif>small{color:rgba(255,255,255,.78)}
.wpx-pano{position:fixed;z-index:92;display:flex;flex-direction:column;background:var(--wpx-plein);border:1px solid var(--wpx-bord2);
  border-radius:14px;box-shadow:0 30px 70px -24px #000;font:600 12.5px Inter,system-ui,sans-serif}
.wpx-pano-tete{display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid var(--wpx-bord)}
.wpx-pano-tete .wpx-champ{flex:1}
.wpx-pano-tete small{color:var(--wpx-pale);font:600 12px Inter,sans-serif;white-space:nowrap}
.wpx-pano-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:6px;padding:10px;overflow:auto;overscroll-behavior:contain}
.wpx-pano-grille .wpx-puce{max-width:none;width:100%;border-radius:10px}
.wpx-pano-grille .wpx-puce>small{margin-left:auto}
.wpx-exports{display:flex;gap:6px;flex:0 0 auto;padding-left:14px;border-left:1px solid var(--edge,var(--wpx-bord))}
#wpx-coll{position:sticky;top:calc(var(--wpx-entete-h) + 6px);z-index:55;display:flex;align-items:center;gap:12px;margin:-4px 0 18px;padding:7px 12px}
#wpx-coll .wpx-barre{flex:1 1 auto}
#wpx-coll .wpx-titre{font:800 15px Sora,Inter,sans-serif;white-space:nowrap;color:var(--wpx-encre)}
#wpx-coll .wpx-titre small{margin-left:6px;font:600 12px Inter,sans-serif;color:var(--wpx-doux)}
@media (max-width:700px){#wpx-coll .wpx-titre{display:none}}`;
}

/* Ma collection et Toutes les cartes (COLLECTION.fixe, sur ordinateur : plus étroit, onglets et boutons passent sur deux
   lignes et la partie collée prendrait la moitié de l'écran) : les onglets, la barre « Mes étiquettes », la recherche et
   ses boutons, les raretés se collent l'un sous l'autre sous le menu, comme sur un profil. Collés ou non, ils gardent la
   même taille (rien ne saute au passage) : seul leur fond de verre apparaît, et deux voisins collés s'amarrent
   (suivreCollection). Les marges compensent les bords et le rembourrage ajoutés : décollés, tout reste à sa place. */
function cssCollectionFixe() {
    if (!CONFIG.COLLECTION.fixe) return "";
    return `
@media (min-width:901px){
  #v-coll>#ctabs,#v-coll>#cTools,#v-explore>.tools,#v-explore>#er{position:sticky;border:1px solid transparent;
    transition:background-color .16s,border-color .16s,box-shadow .16s,border-radius .16s}
  #v-coll>#ctabs{z-index:56;top:calc(var(--wpx-entete-h) + 6px)}
  #v-coll>#wpx-coll{top:calc(var(--wpx-entete-h) + var(--wpx-ctabs-h,0px) + 6px)}
  #v-coll>#cTools{z-index:54;top:calc(var(--wpx-entete-h) + var(--wpx-ctabs-h,0px) + var(--wpx-ccoll-h,0px) + 6px);
    margin:-9px 0 6px;padding:8px 5px 0;border-radius:14px}
  #v-coll>#cTools>.meta{margin-bottom:9px}
  #v-explore>.tools{z-index:56;top:calc(var(--wpx-entete-h) + 6px);margin:-9px 0 4px;padding:8px 5px;border-radius:14px}
  #v-explore>#er{z-index:55;top:calc(var(--wpx-entete-h) + var(--wpx-eoutils-h,0px) + 6px);margin:0 0 8px;padding:0 5px 8px;border-radius:14px}
  :is(#v-coll>#ctabs,#v-coll>#cTools,#v-explore>.tools,#v-explore>#er).wpx-colle{background:var(--wpx-verre);
    -webkit-backdrop-filter:var(--wpx-flou);backdrop-filter:var(--wpx-flou);border-color:var(--wpx-bord);box-shadow:0 16px 36px -16px rgba(0,0,0,.85)}
  /* le premier collé : une bande du fond de la page le sépare du menu, les cartes ne passent pas dans l'interstice */
  :is(#v-coll>#ctabs,#v-explore>.tools).wpx-colle::before{content:"";position:absolute;left:-1px;right:-1px;bottom:100%;height:8px;
    background:var(--bg,#06040b);pointer-events:none}
  /* les suivants, collés dessous : le haut droit ; celui du dessus perd son bas arrondi et son ombre */
  :is(#v-coll>#wpx-coll,#v-coll>#cTools,#v-explore>#er).wpx-colle{border-top-left-radius:0;border-top-right-radius:0;border-top-color:rgba(255,255,255,.05)}
  :is(#v-coll>#ctabs,#v-coll>#wpx-coll,#v-explore>.tools).wpx-amarre{border-bottom-left-radius:0;border-bottom-right-radius:0;
    border-bottom-color:transparent;box-shadow:none}
}`;
}

/* L'export : un tiroir à droite de l'écran */
function cssTiroir() {
    return `
#wpx-tiroir{position:fixed;z-index:57;top:calc(var(--wpx-entete-bas) + 8px);right:12px;bottom:12px;width:min(480px,calc(100vw - 24px));
  display:flex;flex-direction:column;background:var(--wpx-plein);color:var(--wpx-encre);border:1px solid var(--wpx-bord2);border-radius:16px;
  box-shadow:0 30px 90px -20px #000;font:500 13.5px/1.45 Inter,system-ui,sans-serif;
  transform:translateX(calc(100% + 30px));visibility:hidden;transition:transform .24s cubic-bezier(.2,.8,.2,1),visibility 0s linear .24s}
#wpx-tiroir.wpx-ouvert{transform:none;visibility:visible;transition:transform .24s cubic-bezier(.2,.8,.2,1)}
#wpx-tiroir *{box-sizing:border-box}
.wpx-t-tete{display:flex;align-items:flex-start;gap:10px;padding:14px 14px 10px}
.wpx-t-tete b{display:block;font:800 17px/1.3 Sora,Inter,sans-serif}
.wpx-t-tete small{display:block;color:var(--wpx-doux);font-size:12.5px}
.wpx-x{margin-left:auto;flex:0 0 auto;width:32px;height:32px;border:1px solid var(--wpx-bord);border-radius:9px;background:none;color:var(--wpx-doux);font-size:15px;cursor:pointer}
.wpx-x:hover{color:var(--wpx-encre);background:rgba(255,255,255,.06)}
.wpx-seg{display:flex;gap:2px;margin:0 14px 10px;padding:3px;border:1px solid var(--wpx-bord);border-radius:11px;background:rgba(255,255,255,.03)}
.wpx-seg button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;height:32px;border:0;border-radius:8px;background:none;
  color:var(--wpx-doux);font:700 12.5px Inter,sans-serif;cursor:pointer}
.wpx-seg button:hover{color:var(--wpx-encre)}
.wpx-seg button[aria-pressed="true"]{background:var(--wpx-degrade);color:#fff}
.wpx-t-choix{display:flex;flex-direction:column;flex:0 0 auto;height:min(42%,400px);min-height:210px;border-top:1px solid var(--wpx-bord);border-bottom:1px solid var(--wpx-bord)}
.wpx-t-outils{display:flex;gap:8px;padding:10px 14px 6px}
.wpx-t-outils .wpx-champ{flex:1}
.wpx-t-outils select.wpx-champ{flex:0 0 auto;width:190px;padding:0 8px;cursor:pointer}
.wpx-t-outils select.wpx-champ option{background:var(--wpx-plein);color:var(--wpx-encre)}
.wpx-t-raccourcis{display:flex;align-items:center;gap:4px;padding:0 10px 6px;flex-wrap:wrap}
.wpx-lien{padding:3px 6px;border:0;border-radius:6px;background:none;color:var(--wpx-accent);font:600 12.5px Inter,sans-serif;cursor:pointer}
.wpx-lien:hover{background:color-mix(in srgb,var(--wpx-accent) 10%,transparent)}
.wpx-t-compte{margin-left:auto;padding-right:4px;color:var(--wpx-doux);font-size:12px}
.wpx-t-liste{flex:1 1 auto;min-height:0;overflow:auto;padding:0 8px 8px;overscroll-behavior:contain}
.wpx-t-ligne{display:flex;align-items:center;gap:9px;padding:5px 6px;border-radius:9px;cursor:pointer;user-select:none}
.wpx-t-ligne:hover{background:rgba(255,255,255,.05)}
.wpx-t-ligne input{flex:0 0 auto;width:16px;height:16px;margin:0;accent-color:var(--wpx-coche);pointer-events:none}
.wpx-t-ligne>i{width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:var(--c,#8b5cf6)}
.wpx-t-ligne>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wpx-t-ligne>small{color:var(--wpx-pale);font-size:12px;white-space:nowrap}
.wpx-t-ligne>small.wpx-partiel{color:#fbbf24}
.wpx-t-aller{display:grid;place-items:center;flex:0 0 auto;width:26px;height:26px;padding:0;border:0;border-radius:7px;background:none;color:var(--wpx-doux);cursor:pointer;opacity:0}
.wpx-t-ligne:hover .wpx-t-aller,.wpx-t-aller:focus-visible{opacity:1}
.wpx-t-aller:hover{background:rgba(255,255,255,.08);color:var(--wpx-encre)}
.wpx-t-options{display:flex;flex-wrap:wrap;gap:6px 16px;padding:9px 14px;border-bottom:1px solid var(--wpx-bord)}
.wpx-t-options label{display:inline-flex;align-items:center;gap:6px;color:var(--wpx-doux);font-size:12.5px;cursor:pointer}
.wpx-t-options input{margin:0;accent-color:var(--wpx-coche)}
.wpx-t-res{flex:1 1 auto;min-height:0;overflow:auto;padding:10px 14px 14px;overscroll-behavior:contain}
.wpx-t-resume{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.wpx-t-resume p{margin:0 0 2px;flex:1 1 100%;color:var(--wpx-doux);font-size:12.5px}
.wpx-t-resume p b{color:var(--wpx-encre)}
.wpx-t-avert{margin:0 0 10px;padding:8px 10px;border:1px solid rgba(251,191,36,.28);border-radius:10px;background:rgba(251,191,36,.07);color:#fde68a;font-size:12px}
.wpx-msg{margin-bottom:10px;border:1px solid var(--wpx-bord);border-radius:12px;background:rgba(255,255,255,.025);overflow:hidden}
.wpx-msg>header{display:flex;align-items:center;gap:8px;padding:6px 8px 6px 12px;border-bottom:1px solid var(--wpx-bord);font-size:12px;color:var(--wpx-doux)}
.wpx-msg>header b{color:var(--wpx-encre)}
.wpx-msg>header .wpx-btn{margin-left:auto;height:28px}
.wpx-msg pre{margin:0;padding:10px 12px;max-height:180px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;
  font:12px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--wpx-encre)}
.wpx-msg.wpx-copie{border-color:rgba(74,222,128,.45)}
.wpx-plus{width:100%}
@media (max-width:700px){
  #wpx-tiroir{left:8px;right:8px;width:auto;bottom:calc(var(--navbas-h,78px) + 8px)}
  .wpx-t-outils{flex-wrap:wrap}
  .wpx-t-outils .wpx-champ,.wpx-t-outils select.wpx-champ{flex:1 1 150px;width:auto}
}`;
}

/* Les derniers paquets : un panneau à droite du paquet à ouvrir, puis la grille des dernières cartes */
function cssPaquets() {
    return `
#stage{position:relative}
#wpx-paquets{position:absolute;top:22px;right:0;z-index:2;width:min(380px,calc(50% - 250px));max-height:calc(100% - 30px);
  display:flex;flex-direction:column;padding:14px 14px 12px;text-align:left;font:500 13px/1.4 Inter,system-ui,sans-serif;color:var(--wpx-encre)}
#wpx-paquets > *{flex:none}
#wpx-paquets > .wpx-pq-liste{flex:0 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;margin-right:-8px;padding-right:8px}
.wpx-pq-tete{display:flex;align-items:baseline;gap:8px;margin:0 0 10px}
.wpx-pq-tete b{font:800 15px Sora,Inter,sans-serif}
.wpx-pq-tete small{margin-left:auto;color:var(--wpx-pale);font-size:11.5px}
.wpx-btn.wpx-pq-voir{width:100%;height:36px;margin:0 0 12px;border-color:transparent;background:var(--wpx-degrade);color:#fff}
.wpx-btn.wpx-pq-voir:disabled{opacity:.45;cursor:default}
.wpx-pq-paquet{margin:0 0 10px;padding:0 0 10px;border-bottom:1px solid var(--wpx-bord)}
.wpx-pq-quand{display:flex;align-items:center;gap:6px;margin:0 0 6px;font-size:11.5px;color:var(--wpx-doux)}
.wpx-pq-pro{padding:0 6px;border-radius:5px;background:rgba(251,191,36,.16);color:#fde68a;font:700 10.5px Inter,sans-serif}
.wpx-pq-cartes{display:flex;flex-direction:column;gap:3px}
.wpx-pq-carte{display:flex;align-items:center;gap:8px;min-width:0;padding:3px 7px 3px 8px;border-left:3px solid var(--c);border-radius:6px;
  background:rgba(255,255,255,.03);color:var(--wpx-encre);text-decoration:none;cursor:pointer}
.wpx-pq-carte:hover{background:rgba(255,255,255,.08)}
.wpx-pq-carte span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}
.wpx-pq-carte small{flex:0 0 auto;font:700 10.5px Inter,sans-serif;color:var(--c)}
.wpx-pq-carte em,.wpx-nouvelle{flex:0 0 auto;padding:1px 6px;border-radius:99px;background:rgba(74,222,128,.16);color:#86efac;font:700 9.5px Inter,sans-serif;font-style:normal}
.wpx-pq-vide,.wpx-pq-note{margin:6px 0 0;color:var(--wpx-pale);font-size:12px}
.wpx-pq-masquer{flex:0 0 auto;padding:2px 9px;border:1px solid var(--wpx-bord);border-radius:7px;background:transparent;color:var(--wpx-doux);
  font:600 11.5px Inter,sans-serif;cursor:pointer}
.wpx-pq-masquer:hover,.wpx-pq-masquer:focus-visible{color:var(--wpx-encre);border-color:var(--wpx-bord2)}
#wpx-paquets.wpx-pq-replie{width:auto;max-width:min(380px,calc(50% - 250px));padding:4px}
.wpx-pq-montrer{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border:0;border-radius:10px;background:transparent;
  color:var(--wpx-encre);font:500 13px Inter,sans-serif;text-align:left;cursor:pointer}
.wpx-pq-montrer:hover,.wpx-pq-montrer:focus-visible{background:rgba(255,255,255,.07)}
.wpx-pq-montrer b{font:800 13.5px Sora,Inter,sans-serif;white-space:nowrap}
.wpx-pq-montrer small{color:var(--wpx-pale);font-size:11.5px;white-space:nowrap}
.wpx-pq-montrer span{margin-left:auto;color:var(--wpx-doux)}
@media (max-width:1100px){#wpx-paquets{position:static;width:100%;max-width:460px;max-height:none;margin:16px auto 0}
  #wpx-paquets.wpx-pq-replie{width:fit-content;max-width:460px}}
#wpx-dernieres{position:fixed;z-index:89;top:calc(var(--wpx-entete-bas) + 10px);left:24px;right:24px;bottom:20px;display:flex;flex-direction:column;
  background:var(--wpx-plein);color:var(--wpx-encre);border:1px solid var(--wpx-bord2);border-radius:16px;box-shadow:0 30px 90px -20px #000;
  font:500 13.5px/1.45 Inter,system-ui,sans-serif}
.wpx-dc-tete{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 16px;border-bottom:1px solid var(--wpx-bord)}
.wpx-dc-tete b{font:800 18px Sora,Inter,sans-serif}
.wpx-dc-tete small{color:var(--wpx-doux)}
.wpx-dc-tete label{display:inline-flex;align-items:center;gap:6px;margin-left:auto;color:var(--wpx-doux);font-size:12.5px;cursor:pointer}
.wpx-dc-tete label input{margin:0;accent-color:var(--wpx-coche)}
.wpx-dc-tete .wpx-x{margin-left:0}
.wpx-dc-corps{flex:1;min-height:0;overflow:auto;padding:14px 16px 20px;overscroll-behavior:contain}
.wpx-dc-paquet{margin:0 0 20px}
.wpx-dc-paquet h4{display:flex;align-items:center;gap:6px;margin:0 0 10px;font:700 12.5px Inter,sans-serif;color:var(--wpx-doux)}
.wpx-dc-lien{position:relative;display:block;color:inherit;text-decoration:none}
.wpx-dc-lien .wpx-nouvelle{position:absolute;top:-7px;right:-4px;z-index:3;background:#16a34a;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.5)}
@media (max-width:700px){#wpx-dernieres{left:8px;right:8px;bottom:calc(var(--navbas-h,78px) + 8px)}}
.wpx-pq-note .wpx-lien{margin-left:2px;padding:1px 5px;font-size:12px}
#wpx-discord{position:fixed;z-index:91;top:50%;left:50%;transform:translate(-50%,-50%);width:min(460px,calc(100vw - 32px));
  max-height:calc(100vh - 40px);overflow:auto;display:flex;flex-direction:column;gap:12px;padding:16px 18px;
  font:500 13.5px/1.45 Inter,system-ui,sans-serif;color:var(--wpx-encre);background:var(--wpx-plein);
  border:1px solid var(--wpx-bord2);border-radius:16px;box-shadow:0 30px 90px -20px #000}
#wpx-discord[hidden]{display:none}
.wpx-ds-tete{display:flex;align-items:center;gap:10px}
.wpx-ds-tete b{font:800 17px Sora,Inter,sans-serif}
.wpx-ds-tete .wpx-x{margin-left:auto}
.wpx-ds-texte{margin:0;color:var(--wpx-doux);font-size:12.5px}
.wpx-ds-texte b{color:var(--wpx-encre)}
.wpx-ds-liste{display:flex;flex-direction:column;gap:6px}
.wpx-ds-serveur{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;cursor:pointer;
  background:rgba(255,255,255,.05);border:1px solid var(--wpx-bord2)}
.wpx-ds-serveur input{margin:0;width:18px;height:18px;accent-color:var(--wpx-coche);flex:0 0 auto}
.wpx-ds-nom{font-weight:700;color:var(--wpx-encre);font-size:14px;overflow-wrap:anywhere}
.wpx-ds-vide{margin:0;color:var(--wpx-doux);font-size:12.5px}
.wpx-ds-etat{min-height:1.4em;margin:0;color:#86efac;font-size:12.5px}
.wpx-ds-etat.wpx-ds-erreur{color:#fca5a5}`;
}

/* Les livres : les deux boutons de la barre du livre, la vue « Toutes les pages » (les pages par deux, comme le livre
   ouvert, sur le papier du livre) et le rappel des raccourcis */
function cssLivre() {
    return `
.wpx-lv-outils{display:flex;align-items:center;gap:8px;flex:0 0 auto}
.wpx-lv-btn .wpx-i svg{width:16px;height:16px}
.wpx-lv-touches,.wpx-lv-lien{width:36px;padding:0!important}
.wpx-lv-btn .wpx-lv-touche{display:inline-block;min-width:18px;padding:0 4px;border:1px solid var(--wpx-bord2);border-bottom-width:2px;border-radius:5px;
  font:700 10.5px/1.45 Inter,sans-serif;color:var(--wpx-doux);text-align:center}
.wpx-lv-actions{display:none}
#livreOu[data-wpx-livre]{cursor:pointer}
#livreOu[data-wpx-livre]:hover{text-decoration:underline;text-underline-offset:3px}
@media (max-width:1180px){.wpx-lv-btn .wpx-lv-lib{display:none}}
@media (max-width:760px){.wpx-lv-btn .wpx-lv-lib,.wpx-lv-touches,.wpx-lv-vide,.wpx-lv-lien{display:none}.wpx-lv-btn{width:36px;padding:0!important}
  .wpx-lv-actions{display:flex;flex-wrap:wrap;gap:2px 10px;order:4;flex:1 1 100%;margin:-4px 0 0 -6px}}
#wpx-livre{position:fixed;z-index:90;top:64px;left:24px;right:24px;bottom:20px;display:flex;flex-direction:column;
  background:var(--wpx-plein);color:var(--wpx-encre);border:1px solid var(--wpx-bord2);border-radius:16px;box-shadow:0 30px 90px -20px #000;
  font:500 13.5px/1.45 Inter,system-ui,sans-serif}
#wpx-livre[hidden]{display:none}
#wpx-livre *{box-sizing:border-box}
.wpx-lv-tete{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid var(--wpx-bord)}
.wpx-lv-tete>div{min-width:0;margin-right:auto}
.wpx-lv-tete b{display:block;font:800 18px/1.25 Sora,Inter,sans-serif}
.wpx-lv-tete small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--wpx-doux);font-size:12.5px}
.wpx-lv-tete .wpx-champ{flex:0 1 300px;width:300px}
.wpx-lv-compte{color:var(--wpx-doux);font-size:12px;white-space:nowrap}
.wpx-lv-corps{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:16px;display:grid;
  grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:16px 14px;align-content:start}
.wpx-lv-corps>.wpx-vide{grid-column:1/-1}
.wpx-lv-double{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:5px;border:1px solid transparent;border-radius:12px}
.wpx-lv-corps>[hidden]{display:none}
.wpx-lv-double.wpx-ici,.wpx-lv-page.wpx-ici{border-color:var(--wpx-accent);box-shadow:0 0 0 1px var(--wpx-accent),0 0 24px -8px var(--wpx-teinte)}
.wpx-lv-page{display:flex;flex-direction:column;gap:6px;min-width:0;padding:6px;border:1px solid var(--wpx-bord);border-radius:8px;
  background:rgba(255,255,255,.035);color:var(--wpx-encre);font:inherit;text-align:left;cursor:pointer;transition:background-color .12s,border-color .12s,opacity .12s}
.wpx-lv-page:hover{background:rgba(255,255,255,.08);border-color:var(--wpx-bord2)}
.wpx-lv-page:focus-visible{outline:2px solid var(--wpx-accent);outline-offset:1px}
.wpx-lv-page.wpx-lv-hors{opacity:.28}
.wpx-lv-vue{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:3px;aspect-ratio:.76;padding:4px;border-radius:5px;overflow:hidden;
  background:linear-gradient(160deg,#efe4ca,#d9c9a4)}
.wpx-lv-vue.wpx-un{grid-template-columns:1fr}
.wpx-lv-vue img,.wpx-lv-sans{display:block;width:100%;height:100%;min-height:0;object-fit:cover;border-radius:3px;box-shadow:0 0 0 1.5px var(--c,#aeb6c2)}
.wpx-lv-sans{display:grid;place-items:center;background:color-mix(in srgb,var(--c,#aeb6c2) 35%,#2a2236);color:#fff;font:800 15px Sora,Inter,sans-serif;font-style:normal}
.wpx-lv-texte{grid-column:1/-1;align-self:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:8;-webkit-box-orient:vertical;
  padding:2px 4px;color:#5b4a2e;font:italic 500 11px/1.35 Georgia,serif;overflow-wrap:anywhere}
.wpx-lv-blanche .wpx-lv-vue{background:none;border:1.5px dashed var(--wpx-bord2)}
.wpx-lv-blanche .wpx-lv-texte{color:var(--wpx-pale);font-style:normal;text-align:center}
.wpx-lv-repere .wpx-lv-vue{place-items:center;align-content:center;text-align:center}
.wpx-lv-couverture .wpx-lv-vue{background:linear-gradient(160deg,#5b1f2b,#2a0d15);box-shadow:inset 0 0 0 3px rgba(217,182,96,.5)}
.wpx-lv-couverture b{display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden;padding:0 6px;
  color:#f3e3bf;font:600 12px/1.25 Cinzel,Georgia,serif;overflow-wrap:break-word;hyphens:auto}
.wpx-lv-orn{color:#7a6440;font:400 30px/1 Georgia,serif}
.wpx-lv-sommaire .wpx-lv-orn{width:58%;height:44%;background:repeating-linear-gradient(180deg,#9a8258 0 2px,transparent 2px 10px);
  -webkit-mask:linear-gradient(90deg,#000 70%,transparent);mask:linear-gradient(90deg,#000 70%,transparent)}
.wpx-lv-nom{display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 12px/1.3 Inter,sans-serif}
.wpx-lv-nom small{margin-right:5px;color:var(--wpx-pale);font:700 11px Inter,sans-serif}
.wpx-lv-blanche .wpx-lv-nom{color:var(--wpx-pale);font-weight:600}
#wpx-lv-aide{position:fixed;z-index:91;width:300px;padding:12px 14px;background:var(--wpx-plein);color:var(--wpx-encre);border:1px solid var(--wpx-bord2);
  border-radius:12px;box-shadow:0 22px 50px -18px #000;font:500 12.5px/1.4 Inter,system-ui,sans-serif}
#wpx-lv-aide[hidden]{display:none}
#wpx-lv-aide>b{display:block;margin:0 0 9px;font:800 14px Sora,Inter,sans-serif}
#wpx-lv-aide dl{display:grid;grid-template-columns:auto 1fr;align-items:center;gap:6px 12px;margin:0}
#wpx-lv-aide dd{margin:0;color:var(--wpx-doux)}
#wpx-lv-aide dd em{color:var(--wpx-pale);font-size:11px;font-style:normal}
#wpx-lv-aide kbd{display:inline-block;min-width:24px;padding:2px 7px;border:1px solid var(--wpx-bord2);border-bottom-width:2px;border-radius:6px;
  background:rgba(255,255,255,.05);color:var(--wpx-encre);font:700 11.5px/1.3 Inter,sans-serif;text-align:center;white-space:nowrap}
@media (max-width:760px){
  #wpx-livre{left:8px;right:8px;bottom:8px}
  .wpx-lv-tete{flex-wrap:wrap}
  .wpx-lv-tete>div{flex:1 1 0}
  .wpx-lv-tete .wpx-champ{flex:1 1 100%;width:auto;order:3}
  .wpx-lv-corps{grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;padding:10px}
  .wpx-lv-couverture b{font-size:9.5px}
  .wpx-lv-nom{font-size:11px}
}`;
}

/* Le panneau des réglages : une fenêtre au milieu de l'écran, comme celle du partage Discord */
function cssReglages() {
    return `
#wpx-reglages{position:fixed;z-index:93;top:50%;left:50%;transform:translate(-50%,-50%);width:min(580px,calc(100vw - 24px));
  max-height:calc(100vh - 40px);display:flex;flex-direction:column;gap:10px;padding:16px 18px;
  font:500 13.5px/1.45 Inter,system-ui,sans-serif;color:var(--wpx-encre);background:var(--wpx-plein);
  border:1px solid var(--wpx-bord2);border-radius:16px;box-shadow:0 30px 90px -20px #000}
#wpx-reglages[hidden]{display:none}
#wpx-reglages *{box-sizing:border-box}
.wpx-rg-corps{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;margin:0 -8px;padding:0 8px}
.wpx-rg-section{margin:0 0 14px}
.wpx-rg-section h3{margin:0 0 4px;font:800 11.5px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--wpx-doux)}
.wpx-rg-ligne{display:flex;align-items:center;gap:10px;min-width:0;padding:6px 8px;border-radius:9px;cursor:pointer}
.wpx-rg-ligne:hover{background:rgba(255,255,255,.045)}
.wpx-rg-ligne input[type=checkbox]{flex:0 0 auto;width:16px;height:16px;margin:0;accent-color:var(--wpx-coche)}
.wpx-rg-ligne>span{flex:1 1 auto;min-width:0}
.wpx-rg-ligne small{flex:0 0 auto;color:var(--wpx-pale);font-size:11px}
.wpx-rg-curseur input[type=range]{flex:0 1 190px;min-width:90px;margin:0;accent-color:var(--wpx-coche)}
.wpx-rg-curseur output{flex:0 0 56px;text-align:right;font:700 12.5px Inter,sans-serif;color:var(--wpx-accent)}
.wpx-rg-off{opacity:.45;cursor:default}
.wpx-rg-clean{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:0 8px}
.wpx-rg-pied{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding-top:10px;border-top:1px solid var(--wpx-bord)}
.wpx-rg-note{color:var(--wpx-doux);font-size:12px}
@media (max-width:560px){.wpx-rg-curseur{flex-wrap:wrap}.wpx-rg-curseur input[type=range]{flex:1 1 100%;order:3}}`;
}

/* Tes souhaits : le contour doré et le badge « ★ Tu la souhaites » de la fenêtre d'échange du site */
function cssSouhaits() {
    return `
.wpx-souhaitee,.wpx-lot-souhaite{position:relative}
.wpx-souhaitee>.card,.wpx-souhaitee>.cw>.card{outline:2px solid rgba(255,210,79,.65);outline-offset:3px}
.wpx-souhait-marque{position:absolute;top:-8px;left:50%;transform:translateX(-50%);z-index:25;white-space:nowrap;padding:2px 8px;border-radius:99px;
  background:#141021;color:#ffd24f;box-shadow:0 0 0 1px rgba(255,210,79,.7),0 3px 10px -3px rgba(0,0,0,.8);
  font:800 10px Inter,system-ui,sans-serif;letter-spacing:.03em;pointer-events:none}`;
}

/* Les chances : une ligne de la fiche d'une carte, une ligne et le détail dans les derniers paquets */
function cssChances() {
    return `
.wpx-chance{display:flex;flex-direction:column;gap:2px;margin:10px 0 0;padding:8px 10px;border:1px solid var(--wpx-bord);border-radius:10px;
  background:rgba(255,255,255,.03);font:500 13px/1.4 Inter,system-ui,sans-serif;color:var(--wpx-encre)}
.wpx-chance b{color:var(--wpx-accent)}
.wpx-chance small{color:var(--wpx-pale);font-size:11.5px}
.wpx-pq-chance{margin:-4px 0 12px;font-size:12px;color:var(--wpx-doux)}
.wpx-pq-chance b{color:var(--wpx-encre)}
.wpx-pq-chance.wpx-plus b{color:#86efac}
.wpx-pq-chance.wpx-moins b{color:#fca5a5}
.wpx-dc-chance{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px}
.wpx-dc-chance span{display:inline-flex;align-items:baseline;gap:5px;padding:3px 9px;border-left:3px solid var(--c);border-radius:6px;
  background:rgba(255,255,255,.04);font-size:12.5px}
.wpx-dc-chance small{color:var(--wpx-pale);font-size:11px}`;
}

/* Le garde-fou : un petit avis en bas à droite */
function cssGardeFou() {
    return `
#wpx-garde{position:fixed;z-index:95;right:16px;bottom:16px;width:min(360px,calc(100vw - 32px));display:flex;flex-direction:column;align-items:flex-start;gap:6px;
  padding:12px 14px;font:500 12.5px/1.45 Inter,system-ui,sans-serif;color:var(--wpx-encre);background:var(--wpx-plein);
  border:1px solid rgba(251,191,36,.45);border-radius:14px;box-shadow:0 22px 50px -18px #000}
#wpx-garde[hidden]{display:none}
#wpx-garde b{font:800 13.5px Sora,Inter,sans-serif;color:#fde68a}
#wpx-garde p{margin:0}
.wpx-garde-aide{color:var(--wpx-doux)}
@media (max-width:700px){#wpx-garde{right:8px;left:8px;width:auto;bottom:calc(var(--navbas-h,78px) + 8px)}}`;
}

function cssHistorique() {
    return `
#wpx-histo{position:fixed;z-index:89;top:calc(var(--wpx-entete-bas) + 10px);left:50%;transform:translateX(-50%);width:min(920px,calc(100vw - 48px));
  bottom:20px;display:flex;flex-direction:column;background:var(--wpx-plein);color:var(--wpx-encre);border:1px solid var(--wpx-bord2);
  border-radius:16px;box-shadow:0 30px 90px -20px #000;font:500 13.5px/1.45 Inter,system-ui,sans-serif}
#wpx-histo[hidden]{display:none}
#wpx-histo .wpx-dc-tete label{margin-left:auto}
.wpx-hi-nom{color:inherit;text-decoration:underline;text-decoration-color:var(--wpx-bord2);text-underline-offset:3px}
.wpx-hi-chercher{flex:1 1 160px;max-width:240px;height:30px;padding:0 10px;border:1px solid var(--wpx-bord);border-radius:9px;
  background:rgba(255,255,255,.04);color:var(--wpx-encre);font:500 13px Inter,sans-serif}
.wpx-hi-joueurs{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px}
.wpx-hi-joueur{display:grid;grid-template-columns:1fr auto;gap:2px 8px;padding:9px 11px;border:1px solid var(--wpx-bord);border-radius:10px;
  background:rgba(255,255,255,.03);color:var(--wpx-encre);text-align:left;cursor:pointer;font:inherit}
.wpx-hi-joueur:hover,.wpx-hi-joueur:focus-visible{background:rgba(255,255,255,.08);border-color:var(--wpx-bord2)}
.wpx-hi-joueur b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 13.5px Sora,Inter,sans-serif}
.wpx-hi-joueur span{grid-column:1;color:var(--wpx-doux);font-size:12px}
.wpx-hi-joueur small{grid-column:2;grid-row:1/3;align-self:center;color:var(--wpx-pale);font-size:11.5px}
.wpx-hi-note{margin:16px 0 0;color:var(--wpx-pale);font-size:12px}
.wpx-hi-bilan{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 14px;padding:10px 12px;border-radius:10px;background:rgba(255,255,255,.04);color:var(--wpx-doux)}
.wpx-hi-bilan b{color:var(--wpx-encre)}
.wpx-hi-echange{margin:0 0 10px;padding:10px 12px;border:1px solid var(--wpx-bord);border-radius:12px;background:rgba(255,255,255,.02)}
.wpx-hi-echange:not(.wpx-hi-a){opacity:.75}
.wpx-hi-echange h4{display:flex;align-items:center;flex-wrap:wrap;gap:6px 10px;margin:0 0 8px;font:700 12.5px Inter,sans-serif;color:var(--wpx-doux)}
.wpx-hi-echange h4 small{margin-left:auto;font-weight:500;color:var(--wpx-pale)}
.wpx-hi-statut{padding:1px 8px;border-radius:99px;background:rgba(255,255,255,.07);font-size:11px}
.wpx-hi-a .wpx-hi-statut{background:rgba(74,222,128,.16);color:#86efac}
.wpx-hi-d .wpx-hi-statut,.wpx-hi-i .wpx-hi-statut{background:rgba(248,113,113,.14);color:#fca5a5}
.wpx-hi-msg{margin:0 0 8px;color:var(--wpx-doux);font-style:italic}
.wpx-hi-cols{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:start}
.wpx-hi-col h5{margin:0 0 5px;font:700 11.5px Inter,sans-serif;color:var(--wpx-pale);text-transform:uppercase;letter-spacing:.04em}
.wpx-hi-fl{align-self:center;color:var(--wpx-pale);font-size:16px}
.wpx-hi-w{margin-top:4px;font:700 12px Inter,sans-serif;color:#fde68a}
.wpx-hi-rien{color:var(--wpx-pale)}
.wpx-histo-composer{display:block;margin:4px 0 8px}
#tbody .trade > .thd > .wpx-histo-btn{flex:0 0 auto;margin-right:6px}
@media (max-width:700px){#wpx-histo{left:8px;right:8px;transform:none;width:auto;bottom:calc(var(--navbas-h,78px) + 8px)}
  .wpx-hi-cols{grid-template-columns:1fr}.wpx-hi-fl{display:none}}`;
}

function installerStyles() {
    let style = D.getElementById("wpx-styles");
    if (!style) {
        style = el("style", {id: "wpx-styles"});
        (D.head || HTML).append(style);
    }
    style.textContent = [
        cssBase(), cssEntete(), cssAncienMenu(), cssAncienSite(), cssBascules(), cssClean(), cssLargeur(),
        cssTailleCartes(), cssTexte(), cssGras(), cssProfil(), cssBarreAlbums(), cssCollectionFixe(), cssTiroir(), cssPaquets(), cssLivre(),
        cssReglages(), cssSouhaits(), cssChances(), cssGardeFou(), cssHistorique()
    ].join("\n");
}

/* ==========================================================================
   MISSIONS 4, 5 ET 6 : CLEAN ET LARGEUR, À CÔTÉ DU CRÂNE ET DE LA LUNE
   ========================================================================== */
const MODES = {
    clean: {classe: "wpx-clean", texte: T.clean, aide: T.cleanAide, icone: ICONES.clean},
    large: {classe: "wpx-large", texte: T.largeur, aide: T.largeurAide, icone: ICONES.large}
};

function basculer(nom, force) {
    const mode = MODES[nom];
    const actif = typeof force === "boolean" ? force : !HTML.classList.contains(mode.classe);
    HTML.classList.toggle(mode.classe, actif);
    memoire.ecrire(nom, actif);
    $$('[data-wpx-bascule="' + nom + '"]').forEach(b => b.setAttribute("aria-pressed", String(actif)));
}

/* L'état des boutons est porté par aria-pressed : l'icône seule à côté du crâne et de la lune, l'icône et son nom dans
   le tiroir du téléphone */
function creerBascule(nom, place) {
    const mode = MODES[nom];
    const tiroir = place === "tiroir";
    const bouton = el("button", {
        type: "button",
        class: tiroir ? "wpx-bascule-tiroir" : "wpx-crane",
        "data-wpx-bascule": nom,
        "aria-pressed": String(HTML.classList.contains(mode.classe)),
        "aria-label": mode.texte,
        title: mode.texte + " : " + mode.aide
    });
    bouton.innerHTML = mode.icone;
    if (tiroir) bouton.append(el("span", null, T.cleanTiroir), el("i", {class: "wpx-voyant"}));
    bouton.addEventListener("click", () => basculer(nom));
    return bouton;
}

/* le bouton des réglages de l'outil, à la suite de Clean et Largeur (et dans le tiroir du téléphone) */
function creerBoutonReglages(place) {
    const tiroir = place === "tiroir";
    const bouton = el("button", {type: "button", class: tiroir ? "wpx-bascule-tiroir" : "wpx-crane", "data-wpx-reglages": "",
        "aria-haspopup": "dialog", "aria-label": T.reglages, title: T.reglages + " : " + T.reglagesAide});
    bouton.innerHTML = ICONES.reglages;
    if (tiroir) bouton.append(el("span", null, T.reglages));
    bouton.addEventListener("click", () => (PANNEAU.vue && !PANNEAU.vue.hidden ? fermerReglages() : ouvrirReglages()));
    return bouton;
}

/* Les boutons suivent la lune du mode nuit (à défaut, le crâne d'Halloween) : sur ordinateur, ils se rangent avec eux,
   juste avant le logo. Le site ne redessine pas cette rangée ; s'il le faisait, ils seraient reposés au passage suivant. */
function installerBascules() {
    const repere = $(".row1 > [data-nuit-bascule]") || $(".row1 > [data-theme-bascule]");
    const rangee = repere ? repere.parentNode : $("body > header.top .row1");
    if (rangee && !rangee.querySelector(":scope > [data-wpx-bascule]")) {
        const boutons = [creerBascule("clean"), creerBascule("large"), creerBoutonReglages()];
        if (repere) repere.after(...boutons);
        else rangee.prepend(...boutons);
    }
    /* sur téléphone, la rangée du haut est pleine : Clean et les réglages sont dans le tiroir du site */
    const tiroir = $("#tiroirBas");
    if (tiroir && !tiroir.querySelector("[data-wpx-bascule]")) tiroir.prepend(creerBascule("clean", "tiroir"), creerBoutonReglages("tiroir"));
}

/* ==========================================================================
   MISSION 1 : HAUTEUR DU MENU FIXE
   hauteurEntete (--wpx-entete-h) : ce qui reste de l'en-tête une fois collé ; les barres fixes du script se rangent
   dessous. Avec le menu du site du 25/10/2026 (ordinateur), ce sont les rubriques : la rangée du haut, au-dessus
   (--wpx-entete-masque), part avec la page. --wpx-entete-bas : le bas de l'en-tête à l'écran, en haut de la page comme
   une fois collé, pour les panneaux posés par-dessus la page (l'export, les dernières cartes). Avec l'ancien menu
   (ENTETE.ancienMenu) ou l'ancien site (ENTETE.ancienSite), c'est l'ancienne rangée d'onglets (#tabs) qui reste. Menu
   pas fixé : rien ne reste, 0.
   ========================================================================== */
const BUREAU = matchMedia("(min-width: 901px)");
let hauteurEntete = 0;
function mesurerEntete() {
    const entete = $("body > header.top");
    if (!entete) return;
    const ancien = BUREAU.matches && (CONFIG.ENTETE.ancienSite || (CONFIG.ENTETE.ancienMenu && D.body.classList.contains("menu-neuf")));
    const rubriques = ancien ? $("#tabs") : $("#menuRub");
    const masque = rubriques && rubriques.getClientRects().length
        ? Math.max(0, Math.round(rubriques.getBoundingClientRect().top - entete.getBoundingClientRect().top)) : 0;
    definirVariable("--wpx-entete-masque", masque);
    hauteurEntete = CONFIG.ENTETE.fixe ? Math.max(0, Math.round(entete.getBoundingClientRect().height) - masque) : 0;
    definirVariable("--wpx-entete-h", hauteurEntete);
    suivreEntete();
}

/* à chaque défilement : le bas de l'en-tête à l'écran, et son fond de verre dès que les rubriques sont collées */
function suivreEntete() {
    const entete = $("body > header.top");
    if (!entete) return;
    const r = entete.getBoundingClientRect();
    const masque = VARIABLES["--wpx-entete-masque"] || 0;
    definirVariable("--wpx-entete-bas", Math.max(0, Math.round(r.bottom)));
    HTML.classList.toggle("wpx-entete-colle", masque > 0 && r.top <= 1 - masque);
}

/* L'ancien site (cssAncienSite) : menu.js pose menu-neuf une fois, au premier affichage d'une page ; avec le réglage, elle
   est retirée aussitôt (l'observateur passe avant l'image), et remise quand on coupe le réglage, si c'est l'outil qui
   l'avait retirée. */
let menuNeufRetire = false;
function appliquerAncienSite() {
    const actif = !!CONFIG.ENTETE.ancienSite;
    if (HTML.classList.contains("wpx-ancien-site") !== actif) HTML.classList.toggle("wpx-ancien-site", actif);
    if (actif && D.body.classList.contains("menu-neuf")) {
        D.body.classList.remove("menu-neuf");
        menuNeufRetire = true;
    } else if (!actif && menuNeufRetire) {
        menuNeufRetire = false;
        D.body.classList.add("menu-neuf");
    }
}

/* ==========================================================================
   LECTURE DES ÉTIQUETTES ET DES VITRINES
   Le site appelle « Étiquettes » ce qu'il appelait « Album » (les livres reliés ont pris ce nom le
   25/10/2026), mais son code les nomme toujours album (section.album, h2.albtitre, data-c="album") :
   ce script aussi, dans son code.
   ========================================================================== */

/* Le nom d'une étiquette, sans sa pastille, son nombre de cartes ni ses flèches */
function nomDuTitre(titre) {
    const copie = titre.cloneNode(true);
    copie.querySelectorAll("small, .albpastille, .albfleches, .pdico, button").forEach(e => e.remove());
    return propre(copie.textContent);
}

function lireAlbums(racine) {
    const dejaVus = new Set();
    return $$("section.album", racine).map((section, index) => {
        const titre = $("h2.albtitre", section);
        const nom = (titre && nomDuTitre(titre)) || "Étiquette " + (index + 1);
        const pastille = titre && $(".albpastille", titre);
        const detail = titre && $("small", titre) ? $("small", titre).textContent : "";
        const tuiles = section.querySelectorAll(".card").length;
        const total = lireNombre(detail.match(/(\d[\d\s.\u00a0\u202f]*)\s*cartes?/i)) ?? tuiles;
        const montrees = lireNombre(detail.match(/·\s*(\d[\d\s.\u00a0\u202f]*)\s*montr/i)) ?? total;
        let cle = section.dataset.albid ? "id:" + section.dataset.albid : "nom:" + pourRecherche(nom);
        if (dejaVus.has(cle)) cle += "#" + index;
        dejaVus.add(cle);
        return {
            cle,
            nom,
            couleur: (pastille && pastille.style.backgroundColor) || "#8b5cf6",
            compte: total,
            montrees: Math.min(montrees, total),
            element: section,
            ordre: index
        };
    });
}

function lireVitrines(racine) {
    return $$(".vitrine", racine).map((vitrine, index) => {
        const titre = $(".vtop h3", vitrine);
        const prive = vitrine.classList.contains("vflou");
        const nom = (!prive && titre && propre(titre.textContent)) || (prive ? "Vitrine privée " : "Vitrine ") + (index + 1);
        const casier = $(".vtop .cn", vitrine);
        const compte = lireNombre((casier ? casier.textContent : "").match(/(\d+)/)) ?? vitrine.querySelectorAll(".card").length;
        return {
            cle: "vitrine:" + (vitrine.dataset.vid || index),
            nom,
            couleur: vitrine.style.getPropertyValue("--vbord").trim() || "#a78bfa",
            compte,
            montrees: compte,
            element: vitrine,
            ordre: index
        };
    });
}

/* Les cartes d'une étiquette, dans l'ordre de la page, sans doublon (une même version comptée une fois) */
function cartesDeLAlbum(item) {
    const cartes = [];
    const dejaVues = new Set();
    if (!item.element.isConnected) return cartes;
    for (const carte of item.element.querySelectorAll(".card")) {
        const nomCarte = propre(($(".hd .nm", carte) || {}).textContent);
        if (!nomCarte) continue;
        const tuile = carte.closest(".slot");
        const identifiant = carte.getAttribute("data-cle") || (tuile && tuile.getAttribute("data-card")) || pourRecherche(nomCarte);
        if (dejaVues.has(identifiant)) continue;
        dejaVues.add(identifiant);
        const description = $(".txt .de", carte) || $(".txt", carte);
        cartes.push({nom: nomCarte, description: description ? propre(description.textContent) : ""});
    }
    return cartes;
}

/* ==========================================================================
   MISSION 3 : LA BARRE D'ÉTIQUETTES
   Après les onglets du site (Vitrines, Étiquettes, ★ Exclusives), un trait, puis un groupe
   d'onglets centré, avec leur typographie et leur surlignage : « Collection », qui descend à
   la collection du joueur, « Catégories », qui ouvre la vue d'ensemble des étiquettes (ou des
   vitrines) avec recherche, et, sur le profil d'un autre joueur, « Ses cartes que tu
   souhaites ». Un second trait, puis « Exporter ». Un seul endroit est surligné à la fois :
   celui où l'on lit.
   ========================================================================== */
function creerBarreAlbums(reglages) {
    const etat = {type: "", items: [], cle: "", proprietaire: "", titre: "", signature: "", actif: -1, sautJusqua: 0};

    const racine = el("div", {class: "wpx-barre", "data-wpx": ""});
    /* le groupe d'onglets du script, entre deux traits, avec le style de ceux du site (.segsm) ; sur le profil d'un
       autre joueur, « Ses cartes que tu souhaites » s'y ajoute (installerLiensProfil) */
    const compteCollection = el("span", {class: "wpx-n"});
    const boutonCollection = el("button", {type: "button", class: "wpx-onglet", hidden: true}, T.collection, compteCollection);
    const compteTous = el("span", {class: "wpx-n"});
    const boutonTous = el("button", {type: "button", class: "wpx-onglet", "aria-haspopup": "dialog", "aria-expanded": "false"},
        T.categories, compteTous);
    const groupe = el("div", {class: "segsm wpx-groupe"}, boutonCollection, boutonTous);
    let site = null;                       // les onglets du site (Vitrines, Étiquettes, Exclusives), s'il y en a
    let enCollection = false;

    /* la vue d'ensemble s'ouvre sous son onglet ; elle vit dans la page, car les onglets du site défilent
       (overflow) et la couperaient */
    const champ = el("input", {type: "search", class: "wpx-champ", autocomplete: "off", spellcheck: "false"});
    const compteur = el("small");
    const grille = el("div", {class: "wpx-pano-grille"});
    const pano = el("div", {class: "wpx-pano", "data-wpx": "", role: "dialog", hidden: true},
        el("div", {class: "wpx-pano-tete"}, champ, compteur), grille);
    D.body.append(pano);

    /* un seul bouton d'export : le tiroir s'ouvre sur le dernier choix (la liste des étiquettes, ou leurs cartes),
       que le sélecteur en tête du tiroir change */
    const exports = el("div", {class: "wpx-exports"},
        el("button", {type: "button", class: "wpx-btn", title: T.exporterAide}, icone("telecharger"), el("span", null, T.exporter)));
    racine.append(groupe, exports);

    const barre = {
        racine,
        maj,
        suivre,
        allerA,
        groupe,
        lierSite,
        surligner,
        ajuster,
        allerCollection: () => allerCollection(),
        fermerPano,
        actif: () => etat.actif,
        contexte: () => ({cle: etat.cle, type: etat.type, items: etat.items, proprietaire: etat.proprietaire, titre: etat.titre})
    };

    /* une étiquette (ou une vitrine) dans la vue d'ensemble */
    function puce(item, index) {
        const b = el("button", {type: "button", class: "wpx-puce", "data-i": index,
            title: item.nom + " — " + pluriel(item.compte, "carte") + (item.montrees < item.compte ? " (" + nombre(item.montrees) + " montrées)" : "")},
        el("i"), el("span", null, item.nom), el("small", null, nombre(item.compte)));
        b.style.setProperty("--c", item.couleur);
        return b;
    }

    /* les onglets du site : le leur s'efface quand un des nôtres s'allume, pour qu'un seul endroit reste allumé */
    function lierSite(onglets) {
        if (site && site !== onglets) site.classList.remove("wpx-ailleurs");
        site = onglets || null;
        surligner();
    }

    /* moins de place : les libellés longs (« Ses cartes que tu souhaites ») cèdent la place aux courts (« Souhaitées ») */
    function ajuster() {
        groupe.classList.remove("wpx-court");
        if (groupe.scrollWidth > groupe.clientWidth + 1) groupe.classList.add("wpx-court");
    }

    function maj(donnees) {
        etat.type = donnees.type;
        etat.cle = donnees.cle;
        etat.proprietaire = donnees.proprietaire;
        etat.titre = donnees.titre;
        etat.items = donnees.items;            // éléments à jour, même si les noms n'ont pas changé
        const collection = donnees.collection;
        boutonCollection.hidden = !collection;
        if (collection) {
            boutonCollection.title = "Aller à la collection" + (donnees.proprietaire ? " de " + donnees.proprietaire : "");
            compteCollection.textContent = collection.compte != null ? " · " + nombre(collection.compte) : "";
        }
        boutonTous.hidden = !donnees.items.length;
        if (boutonTous.hidden) fermerPano();
        racine.hidden = !donnees.items.length && !collection;
        exports.hidden = donnees.type !== "albums";
        const signature = donnees.type + "¤" + donnees.items.map(i => i.nom + "·" + i.compte + "·" + i.couleur).join("¤");
        if (signature === etat.signature) return;
        etat.signature = signature;
        const vitrines = donnees.type === "vitrines";
        compteTous.textContent = " · " + nombre(donnees.items.length);
        boutonTous.title = vitrines ? T.toutesLesVitrines : T.tousLesAlbums;
        champ.placeholder = vitrines ? T.chercherVitrine : T.chercherAlbum;
        etat.actif = -1;
        if (!pano.hidden) remplirPano();
        requestAnimationFrame(suivre);
    }

    /* le surlignage : « Catégories » quand la vue d'ensemble est ouverte, « Collection » quand on y lit, sauf si
       « Ses cartes que tu souhaites » est allumé : c'est lui qui le dit ; l'onglet du site s'efface alors */
    function surligner() {
        const filtre = !!groupe.querySelector(".wpx-filtre.on");
        const collection = enCollection && !filtre && !boutonCollection.hidden;
        boutonCollection.classList.toggle("on", collection);
        if (collection) boutonCollection.setAttribute("aria-current", "true");
        else boutonCollection.removeAttribute("aria-current");
        boutonTous.classList.toggle("on", !pano.hidden);
        if (site) site.classList.toggle("wpx-ailleurs", (enCollection && !boutonCollection.hidden) || !pano.hidden);
    }

    function marquerCollection(oui) {
        enCollection = oui;
        surligner();
    }

    /* l'étiquette en cours de lecture : la dernière dont le haut a passé la partie fixe (recherche dichotomique),
       allumé dans la vue d'ensemble ; une fois arrivé à la collection, c'est son onglet qui s'allume */
    function suivre() {
        if (!CONFIG.ALBUMS.suivreLaLecture || racine.hidden || !racine.isConnected) return;
        if (Date.now() < etat.sautJusqua) return;
        const dansCollection = !boutonCollection.hidden && !!reglages.dansCollection && reglages.dansCollection();
        marquerCollection(dansCollection);
        if (dansCollection) {
            etat.actif = -1;
            return;
        }
        if (!etat.items.length) return;
        const seuil = reglages.decalage() + 30;
        let bas = 0, haut = etat.items.length - 1, trouve = -1;
        while (bas <= haut) {
            const milieu = (bas + haut) >> 1;
            const element = etat.items[milieu].element;
            const y = element.isConnected ? element.getBoundingClientRect().top : Infinity;
            if (y <= seuil) {
                trouve = milieu;
                bas = milieu + 1;
            } else {
                haut = milieu - 1;
            }
        }
        etat.actif = trouve;
    }

    function allerA(index) {
        const item = etat.items[index];
        if (!item || !item.element.isConnected) return;
        const ecart = () => item.element.getBoundingClientRect().top - reglages.decalage() - 10;
        etat.sautJusqua = Date.now() + 2000;     // pendant le défilement, l'onglet Collection ne clignote pas
        etat.actif = index;
        marquerCollection(false);
        fermerPano();
        scrollTo({top: Math.max(0, scrollY + ecart()), behavior: "smooth"});
        /* le site ne dessine les tuiles qu'à l'approche de l'écran : leur hauteur change pendant le
           trajet et l'arrivée peut tomber à côté. Une fois le défilement fini, on recale. */
        quandDefilementFini(() => {
            if (Math.abs(ecart()) > 3) scrollTo({top: Math.max(0, scrollY + ecart()), behavior: "auto"});
            etat.sautJusqua = Date.now() + 150;
        });
        item.element.classList.remove("wpx-flash");
        void item.element.offsetWidth;           // relance l'animation si on clique deux fois
        item.element.classList.add("wpx-flash");
        setTimeout(() => item.element.classList.remove("wpx-flash"), 1500);
    }

    function allerCollection() {
        if (!reglages.ecartCollection) return;
        etat.sautJusqua = Date.now() + 2000;
        etat.actif = -1;
        fermerPano();
        marquerCollection(true);
        scrollTo({top: Math.max(0, scrollY + reglages.ecartCollection()), behavior: "smooth"});
        quandDefilementFini(() => {
            const ecart = reglages.ecartCollection();
            if (Math.abs(ecart) > 3) scrollTo({top: Math.max(0, scrollY + ecart), behavior: "auto"});
            etat.sautJusqua = Date.now() + 150;
        });
    }

    function remplirPano() {
        const filtre = pourRecherche(champ.value);
        const trouves = [];
        etat.items.forEach((item, index) => {
            if (!filtre || pourRecherche(item.nom).includes(filtre)) trouves.push(puce(item, index));
        });
        const actif = trouves.find(b => +b.dataset.i === etat.actif);
        if (actif) actif.classList.add("wpx-actif");
        grille.replaceChildren(...(trouves.length ? trouves : [el("div", {class: "wpx-vide"}, T.aucunResultat)]));
        compteur.textContent = filtre ? nombre(trouves.length) + " / " + nombre(etat.items.length) : "";
    }

    /* la vue d'ensemble, juste sous son onglet, sans sortir de l'écran */
    function placerPano() {
        const r = boutonTous.getBoundingClientRect();
        const largeur = Math.min(760, innerWidth - 32);
        pano.style.width = largeur + "px";
        pano.style.left = Math.max(16, Math.min(r.left, innerWidth - largeur - 16)) + "px";
        pano.style.top = Math.round(r.bottom + 8) + "px";
        pano.style.maxHeight = Math.max(220, Math.min(560, innerHeight - r.bottom - 24)) + "px";
    }

    function ouvrirPano() {
        pano.hidden = false;
        placerPano();
        boutonTous.setAttribute("aria-expanded", "true");
        champ.value = "";
        remplirPano();
        champ.focus({preventScroll: true});
        surligner();
        D.addEventListener("pointerdown", clicDehors, true);
        addEventListener("scroll", placerPano, {passive: true});
        addEventListener("resize", placerPano);
    }

    function fermerPano() {
        if (pano.hidden) return;
        pano.hidden = true;
        boutonTous.setAttribute("aria-expanded", "false");
        surligner();
        D.removeEventListener("pointerdown", clicDehors, true);
        removeEventListener("scroll", placerPano);
        removeEventListener("resize", placerPano);
    }

    function clicDehors(e) {
        if (!pano.contains(e.target) && !boutonTous.contains(e.target)) fermerPano();
    }

    grille.addEventListener("click", e => {
        const b = e.target.closest(".wpx-puce");
        if (b) allerA(+b.dataset.i);
    });
    boutonCollection.addEventListener("click", allerCollection);
    new ResizeObserver(ajuster).observe(groupe);

    boutonTous.addEventListener("click", () => (pano.hidden ? ouvrirPano() : fermerPano()));
    champ.addEventListener("input", remplirPano);
    champ.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            const premier = grille.querySelector(".wpx-puce");
            if (premier) allerA(+premier.dataset.i);
        } else if (e.key === "Escape") {
            e.stopPropagation();
            fermerPano();
            boutonTous.focus({preventScroll: true});
        }
    });
    exports.addEventListener("click", () => ouvrirExport(barre, EXP.mode));

    return barre;
}

/* ==========================================================================
   MISSION 2 : LE PROFIL FIXÉ
   La partie haute du profil (avatar, pseudo, niveau, saison, guilde, description,
   chiffres, actions) est reprise dans une barre compacte qui apparaît dès que le
   haut du profil passe sous le menu. Juste dessous, l'en-tête du site « Étiquettes /
   Vitrines » (avec ses onglets Vitrines, Étiquettes, Exclusives) reste fixé, et reçoit
   la barre d'étiquettes. Les boutons de la barre compacte sont des copies : un clic
   est transmis au vrai bouton du site, qui fait exactement ce qu'il fait d'habitude.
   ========================================================================== */
const PROFIL = {ancre: null, barre: null, hauteur: 0, signature: "", liens: new WeakMap(), albums: null, compte: null};

/* Depuis le 25/10/2026, le haut du profil (.phead, la description, .pstats) est rangé dans un grand bandeau,
   section.pf-hero ; les vitrines, les étiquettes et la collection restent à la racine de #profile */
const TETE_PROFIL = "#profile > .pf-hero > .phead, #profile > .phead";
function lireProfil() {
    const boite = $("#profile");
    const tete = boite && $(TETE_PROFIL);
    if (!tete) return null;
    return {
        boite,
        tete,
        stats: $(":scope > .pstats", tete.parentNode),
        bloc: $(":scope > #pvbloc", boite)
    };
}

function pseudoDuProfil(p) {
    const av = $(".avwrap .av", p.tete);
    return propre((av && av.dataset.n) || ($("h1 .pnom", p.tete) || {}).textContent);
}

/* Copie inerte d'un élément du site : sans identifiant (le site retrouve toujours SES éléments),
   reliée à l'original pour lui transmettre les clics */
function copier(original) {
    const copie = original.cloneNode(true);
    for (const e of [copie, ...copie.querySelectorAll("*")]) {
        e.removeAttribute("id");
        e.removeAttribute("draggable");
    }
    (function relier(a, b) {
        PROFIL.liens.set(b, a);
        for (let i = 0; i < a.children.length && i < b.children.length; i++) relier(a.children[i], b.children[i]);
    })(original, copie);
    return copie;
}

const ABREGES = {"points": "pts", "différentes": "diff.", "légendaires": "lég."};
function statsCompactes(stats) {
    const zone = el("span", {class: "wpx-id-stats"});
    for (const bloc of $$(":scope > div", stats)) {
        const valeur = propre(($("b", bloc) || {}).textContent);
        const libelle = propre(($("span", bloc) || {}).textContent);
        if (!valeur) continue;
        const classement = libelle.match(/classement(?:\s+sur\s+(.+))?$/);
        const item = el("span", {class: "wpx-stat", title: valeur + " " + libelle},
            el("b", null, valeur),
            classement ? (classement[1] ? el("small", null, " / " + classement[1]) : null) : el("small", null, " " + (ABREGES[libelle] || libelle)));
        const couleur = $("b", bloc).style.color;
        if (couleur) item.firstChild.style.color = couleur;
        zone.append(item);
    }
    return zone;
}

/* Les livres du bloc « Albums » du profil (le site le remplit après coup) : le livre mis en avant, puis l'étagère */
function livresDuProfil() {
    const livres = new Map();
    for (const bouton of $$("#pfAlbums [data-pfaouvre]")) {
        const id = bouton.dataset.pfaouvre;
        if (livres.has(id)) continue;
        const vedette = bouton.closest(".pfa-vedette");
        const nom = propre(bouton.title || (vedette && ($(".pfa-info b", vedette) || {}).textContent)
            || (bouton.getAttribute("aria-label") || "").replace(/^Ouvrir\s+/, ""));
        livres.set(id, {id, nom: nom || T.albumsProfil});
    }
    return [...livres.values()];
}

function remplirIdentite(p, livres) {
    PROFIL.liens = new WeakMap();
    const barre = PROFIL.barre;

    /* avatar : chez soi, il ouvre « Changer » ; ailleurs, il ramène en haut du profil */
    const avatar = $(".avwrap .av", p.tete);
    const changer = $(".avwrap [data-avpick]", p.tete);
    const boutonAvatar = el("button", {type: "button", class: "wpx-id-av", title: changer ? T.changerPhoto : T.voirProfil,
        "data-wpx-action": changer ? null : "haut"});
    if (avatar) boutonAvatar.append(copier(avatar));
    if (changer) {
        boutonAvatar.append(el("span", {class: "wpx-id-chg"}, "Changer"));
        PROFIL.liens.set(boutonAvatar, changer);
    }

    /* pseudo, relation, puis « membre depuis … · guilde » ; le niveau et les insignes de saison restent en haut du profil */
    const ligne1 = el("div", {class: "wpx-id-l1"});
    const titre = $("h1", p.tete);
    if (titre) {
        for (const enfant of titre.children) {
            if (enfant.classList.contains("pnom")) ligne1.append(el("span", {class: "wpx-id-nom", "data-wpx-action": "haut", title: T.voirProfil}, copier(enfant)));
            else if (!enfant.hidden && !enfant.matches(".pniv, .pins")) ligne1.append(copier(enfant));
        }
    }
    const depuis = $("small", p.tete);
    if (depuis) {
        const copie = copier(depuis);
        copie.classList.add("wpx-id-depuis");
        ligne1.append(copie);
    }
    /* actions : la principale à côté du pseudo, les autres dans un menu */
    const actions = el("div", {class: "wpx-id-acts"});
    const boutons = $$(".acts > button", p.tete).filter(b => !b.hidden && !b.matches("[data-pcsouh]"));
    const principale = boutons.length === 1 ? boutons[0] : boutons.find(b => b.classList.contains("main"));
    if (principale) actions.append(copier(principale));
    const autres = boutons.filter(b => b !== principale);
    if (autres.length) {
        actions.append(el("details", {class: "wpx-menu"},
            el("summary", {class: "wpx-btn", title: T.actions}, T.actions + " ▾"),
            el("div", {class: "wpx-menu-liste"}, autres.map(copier))));
    }

    /* les chiffres ; la description reste en haut du profil, pour que la barre respire */
    const ligne2 = el("div", {class: "wpx-id-l2"});
    if (p.stats) ligne2.append(statsCompactes(p.stats));

    /* ses albums : « Albums » remonte au bloc des livres, un nom ouvre le livre (le bouton du site, retrouvé au clic) */
    const ligne3 = livres.length ? el("div", {class: "wpx-id-l3"},
        el("button", {type: "button", class: "wpx-id-alb", "data-wpx-action": "albums", title: T.remonterAlbums}, icone("haut"), T.albumsProfil),
        livres.map(l => el("button", {type: "button", class: "wpx-puce", "data-wpx-livre": l.id, title: T.ouvrirLivre + " " + l.nom},
            el("span", null, l.nom)))) : null;

    barre.replaceChildren(...[boutonAvatar, ligne1, actions, ligne2, ligne3].filter(Boolean));
}

/* Sur le profil d'un autre joueur, un onglet de plus à la suite de « Catégories » : « Ses cartes que tu
   souhaites », le reflet du bouton du site (resté à sa place, caché : le site y tient son état ; un clic sur le
   reflet passe par lui). Sans nombre : celui du site ne correspondait pas toujours. Pas d'onglet sur son propre
   profil. */
const LIENS = {souhaits: null};
function installerLiensProfil(p) {
    const barre = PROFIL.albums;
    if (!barre) return;
    const original = $("#pcsouh", p.boite);
    if (!original) {
        if (LIENS.souhaits) LIENS.souhaits.remove();
        barre.surligner();
        return;
    }
    if (!LIENS.souhaits) {
        LIENS.souhaits = el("button", {type: "button", class: "wpx-onglet wpx-filtre"},
            el("span", {class: "wpx-lg"}, T.souhaits), el("span", {class: "wpx-ct"}, T.souhaitsCourt));
        LIENS.souhaits.addEventListener("click", basculerSouhaits);
    }
    const reflet = LIENS.souhaits;
    if (reflet.parentNode !== barre.groupe) barre.groupe.append(reflet);
    reflet.hidden = original.hidden;
    reflet.classList.toggle("on", original.classList.contains("on"));
    if (reflet.title !== original.title) reflet.title = original.title;
    barre.ajuster();
    barre.surligner();
}

/* « Ses cartes que tu souhaites » : le bouton du site filtre la collection ; allumé, la page y descend */
function basculerSouhaits() {
    const original = $("#pcsouh");
    if (!original) return;
    const allumer = !original.classList.contains("on");
    original.click();
    if (allumer) setTimeout(allerCollectionProfil, 30);
}

/* La page descend au début de la collection, sous la partie fixe */
function allerCollectionProfil() {
    if (PROFIL.albums && PROFIL.albums.racine.isConnected) PROFIL.albums.allerCollection();
    else scrollTo({top: Math.max(0, scrollY + ecartCollection()), behavior: "smooth"});
}

/* ==========================================================================
   OUTILS COMMUNS : pause, échappement HTML, raretés, dates, une carte au format du site
   ========================================================================== */
const pause = ms => new Promise(r => setTimeout(r, ms));
const echapper = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const RANGS = {C: "Commune", PC: "Inhabituelle", R: "Rare", SR: "Épique", UR: "Exceptionnelle", L: "Légendaire", M: "Mythique",
    WBC: "Exclusive", SIXSEVEN: "Exclusive", EXC: "Exclusive"};
const dateCourte = ms => new Date(ms).toLocaleDateString("fr-FR", {day: "2-digit", month: "2-digit"});

/* une carte au format de celles du site (core.js : cardHTML), en plus simple */
function carteHTML(c) {
    const nom = String(c.n || "");
    const description = String(c.d || "");
    const taille = nom.length > 42 ? " t4" : nom.length > 32 ? " t3" : nom.length > 24 ? " t2" : "";
    const tailleDe = description.length > 118 ? " d4" : description.length > 86 ? " d3" : description.length > 56 ? " d2" : "";
    const rang = c.hw ? "Halloween" : c.sh ? "Chromatique" : RANGS[c.r] || "";
    const image = c.img ? `<img src="${echapper(c.img)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : "";
    return `<div class="card r-${echapper(c.r || "C")}${c.sh ? " sh" : ""}${c.hw ? " hw" : ""} nopos" title="${echapper(rang)}">` +
        `<div class="hd${taille}"><h3 class="nm">${echapper(nom)}</h3></div>` +
        `<div class="picw"><div class="pic${image ? "" : " none"}">${image}</div></div>` +
        `<div class="txt"><div class="de${tailleDe}">${echapper(description)}</div></div><div class="ft">${echapper(rang)}</div></div>`;
}

/* ==========================================================================
   ÉCHANGE : LE FILTRE « DOUBLONS »
   Dans la fenêtre d'échange, chaque colonne (Tu donnes, Tu reçois) reçoit un filtre « Doublons »
   à gauche de « Chromatique ». Le site additionne les raretés entre elles (Mythique + Légendaire)
   et se sert de Chromatique et d'Halloween pour réduire le résultat (Chromatique + Mythique = les
   mythiques chromatiques). « Doublons » réduit de la même façon : parmi ce que montrent les autres
   filtres, seules restent les cartes en plusieurs exemplaires (le badge ×2 du site).
   Le serveur envoie les cartes page par page sans savoir trier les doublons : tant que le filtre est
   actif, le script charge les pages suivantes par lots, avec le bouton « Afficher plus de cartes ».
   ========================================================================== */
const ECH = {actif: {give: false, take: false}, jeton: {give: 0, take: 0}, enCours: {give: false, take: false},
             rendu: {give: 0, take: 0}, saisie: {give: 0, take: 0}, grilles: new WeakSet()};
const ECH_PAGES_PAR_LOT = CONFIG.DOUBLONS.pagesParLot;
const ECH_DOUBLONS_PAR_LOT = CONFIG.DOUBLONS.doublonsParLot;

const colonneEchange = cle => $(`#composer .ccol[data-k="${cle}"]`);
const doublonsEchange = cle => $$(`#tcGrid-${cle} > .slot`).filter(s => s.querySelector(".dup")).length;

/* les boutons sont reposés chaque fois que le site redessine la fenêtre */
function installerEchange() {
    for (const cle of ["give", "take"]) {
        const rangee = $("#tcRar-" + cle);
        const colonne = colonneEchange(cle);
        if (!rangee || !colonne) continue;
        let bouton = rangee.querySelector("[data-wpx-dup]");
        if (!bouton) {
            bouton = el("button", {type: "button", class: "k-DUP", "data-wpx-dup": cle,
                title: "Seulement les cartes en plusieurs exemplaires. Se combine avec les autres filtres : Doublons + Mythique = les mythiques en double"},
            "⧉ Doublons");
            rangee.prepend(bouton);
        }
        bouton.classList.toggle("on", ECH.actif[cle]);
        colonne.classList.toggle("wpx-tc-doublons", ECH.actif[cle]);
        if (!colonne.querySelector(".wpx-tc-statut")) rangee.after(el("div", {class: "wpx-tc-statut", hidden: true}));
        /* l'heure du dernier dessin de la colonne : la réponse du site à une recherche est-elle arrivée ? */
        const grille = $("#tcGrid-" + cle);
        if (grille && !ECH.grilles.has(grille)) {
            ECH.grilles.add(grille);
            new MutationObserver(() => { ECH.rendu[cle] = Date.now(); if (cle === "give") marquerDejaVu(); }).observe(grille, {childList: true});
        }
        majStatutEchange(cle);
    }
    /* « Déjà de son côté » : dès que le partenaire est connu, on lit sa collection (une fois), puis on marque */
    const partenaire = partenaireEchange();
    if (partenaire && (!AVU.joueur || AVU.joueur.toLowerCase() !== partenaire.toLowerCase())) chargerADeja(partenaire);
    marquerDejaVu();
    majStatutADeja();
}

function majStatutEchange(cle) {
    const colonne = colonneEchange(cle);
    const statut = colonne && colonne.querySelector(".wpx-tc-statut");
    if (!statut) return;
    statut.hidden = !ECH.actif[cle];
    if (!ECH.actif[cle]) return;
    const n = doublonsEchange(cle);
    const chargees = $$(`#tcGrid-${cle} > .slot`).length;
    const plus = $(`[data-tcmore="${cle}"]`);
    const reste = !!plus && !plus.hidden;
    const texte = ECH.enCours[cle] ? "Recherche des doublons… " + nombre(n) + " parmi " + pluriel(chargees, "carte chargée", "cartes chargées")
        : reste ? pluriel(n, "doublon") + " parmi les " + pluriel(chargees, "première carte", "premières cartes")
        : pluriel(n, "doublon") + " · toutes les cartes sont chargées";
    const signature = texte + (reste && !ECH.enCours[cle]);
    if (statut.dataset.sig === signature) return;
    statut.dataset.sig = signature;
    statut.replaceChildren(el("span", null, texte));
    if (reste && !ECH.enCours[cle]) statut.append(el("button", {type: "button", class: "wpx-lien", "data-wpx-tcplus": cle}, "Chercher plus loin"));
}

/* attend que le site redessine la colonne (nouvelle page reçue), 12 s au plus */
function attendreColonne(cle) {
    return new Promise(fin => {
        const grille = $("#tcGrid-" + cle);
        if (!grille) return fin();
        const observateur = new MutationObserver(() => {
            observateur.disconnect();
            clearTimeout(minuterie);
            fin();
        });
        const minuterie = setTimeout(() => {
            observateur.disconnect();
            fin();
        }, 12000);
        observateur.observe(grille, {childList: true});
    });
}

/* charge les pages suivantes jusqu'à trouver assez de doublons, ou jusqu'au bout */
async function chargerDoublonsEchange(cle) {
    const jeton = ++ECH.jeton[cle];
    const actif = () => ECH.actif[cle] && ECH.jeton[cle] === jeton && !!$("#tcGrid-" + cle);
    ECH.enCours[cle] = true;
    majStatutEchange(cle);
    const vise = doublonsEchange(cle) + ECH_DOUBLONS_PAR_LOT;
    for (let pages = 0; actif() && pages < ECH_PAGES_PAR_LOT && doublonsEchange(cle) < vise; pages++) {
        const plus = $(`[data-tcmore="${cle}"]`);
        if (!plus || plus.hidden) break;                     // toutes les cartes sont là
        while (actif() && plus.disabled) await pause(120);   // une page est déjà en route
        if (!actif() || plus.hidden) break;
        const rendu = attendreColonne(cle);
        plus.click();                                        // le site charge la page suivante et redessine
        await rendu;
        majStatutEchange(cle);
        await pause(CONFIG.DOUBLONS.pauseMs);
    }
    if (ECH.jeton[cle] === jeton) ECH.enCours[cle] = false;
    majStatutEchange(cle);
}

function basculerDoublonsEchange(cle) {
    ECH.actif[cle] = !ECH.actif[cle];
    ECH.jeton[cle]++;
    ECH.enCours[cle] = false;
    installerEchange();
    if (ECH.actif[cle]) chargerDoublonsEchange(cle);
}

/* une nouvelle fenêtre d'échange repart sans filtre, comme les filtres du site */
function reinitialiserEchange() {
    for (const cle of ["give", "take"]) {
        ECH.actif[cle] = false;
        ECH.jeton[cle]++;
        ECH.enCours[cle] = false;
    }
    /* nouvelle fenêtre : on oublie le partenaire précédent (le cache par joueur, lui, reste) */
    AVU.joueur = null;
    AVU.cles = null;
    AVU.jeton++;
    AVU.enCours = false;
    AVU.partielle = false;
    installerEchange();
}

/* ==========================================================================
   ÉCHANGE : « DÉJÀ DE SON CÔTÉ »
   Dans la colonne « Tu donnes », chaque carte que le partenaire possède déjà reçoit un badge au coin
   haut-droit (il reste libre : le ×2 est en haut-gauche, « Proposée » en haut-centre, la coche à
   gauche). Pour le savoir, on lit une fois la collection du partenaire (/api/joueur/cartes, page par
   page, avec des pauses), on en garde les clés de version (cleVer = cid[#sh][#hw]) dans un cache par
   joueur. Même origine, lecture seule : aucune permission nouvelle, rien n'est écrit sur le site.
   Une carte n'est « déjà là » que dans SA version : si tu donnes la normale et qu'il n'a que la
   brillante, elle n'est pas marquée (le jeu compte chaque version à part).
   ========================================================================== */
const AVU_PAGES_MAX = CONFIG.A_DEJA.pagesMax;
const AVU_PAUSE = CONFIG.A_DEJA.pauseMs;
const AVU_TTL = CONFIG.A_DEJA.ttlMin * 60000;
const AVU = {joueur: null, cles: null, enCours: false, jeton: 0, total: 0, partielle: false};

/* la clé d'une version de carte, comme le site (core.js : cleVer) */
const cleVersion = c => ((c && c.cid) || "") + (c && c.sh ? "#sh" : "") + (c && c.hw ? "#hw" : "");

/* le nom du partenaire, lu dans le titre du composer (« Échange avec X » / « Contre-proposition à X ») */
function partenaireEchange() {
    const titre = $("#composer h2");
    if (!titre) return null;
    const m = (titre.textContent || "").trim().match(/^(?:Échange avec |Contre-proposition à )(.+)$/);
    return m ? m[1].trim() : null;
}

/* le cache local des clés d'un joueur, s'il est encore frais */
function cacheADeja(nom) {
    const c = memoire.lire("aDeja." + nom.toLowerCase(), null);
    if (!c || !Array.isArray(c.cles) || !c.t || Date.now() - c.t > AVU_TTL) return null;
    return c;
}

/* marque (ou démarque) chaque carte de « Tu donnes » selon que le partenaire la possède */
function marquerDejaVu() {
    const grille = $("#tcGrid-give");
    if (!grille) return;
    const cles = AVU.cles;
    for (const slot of grille.querySelectorAll(":scope > .slot")) {
        const cw = slot.querySelector(".cw");
        if (!cw) continue;
        const cle = (slot.dataset.cid || "").split("@")[0];
        const possede = !!cles && !!cle && cles.has(cle);
        const badge = cw.querySelector(":scope > .wpx-adeja");
        if (possede && !badge) cw.append(el("span", {class: "wpx-adeja", title: "Le partenaire possède déjà cette carte"}, "Déjà de son côté"));
        else if (!possede && badge) badge.remove();
    }
}

/* un petit état sous la colonne « Tu donnes », seulement pendant la lecture ou si elle est partielle */
function majStatutADeja() {
    const colonne = colonneEchange("give");
    if (!colonne) return;
    let statut = colonne.querySelector(".wpx-adeja-statut");
    const montrer = AVU.enCours || (!!AVU.cles && AVU.partielle);
    if (!montrer) { if (statut) statut.remove(); return; }
    if (!statut) {
        const rangee = $("#tcRar-give");
        statut = el("div", {class: "wpx-adeja-statut"});
        if (rangee) rangee.after(statut); else colonne.prepend(statut);
    }
    const n = AVU.cles ? AVU.cles.size : 0;
    statut.textContent = AVU.enCours
        ? "Lecture de la collection de " + (AVU.joueur || "") + "… " + nombre(n) + " cartes"
        : "Collection trop grande : marquage partiel (" + nombre(n) + " cartes lues)";
}

/* lit la collection du partenaire, page par page avec des pauses, puis marque ; le cache évite de relire */
async function chargerADeja(nom) {
    const jeton = ++AVU.jeton;
    const encore = () => AVU.jeton === jeton && !!$("#composer");
    AVU.joueur = nom;
    AVU.enCours = true;
    AVU.partielle = false;

    const cache = cacheADeja(nom);
    if (cache) {
        AVU.cles = new Set(cache.cles);
        AVU.total = cache.total || 0;
        AVU.partielle = !!cache.partielle;
        AVU.enCours = false;
        marquerDejaVu();
        majStatutADeja();
        return;
    }

    const cles = new Set();
    AVU.cles = cles;
    let pages = 1;
    for (let page = 0; encore() && page < pages && page < AVU_PAGES_MAX; page++) {
        let d;
        try {
            const r = await fetch("/api/joueur/cartes?" + new URLSearchParams({name: nom, page}),
                                  {credentials: "same-origin", headers: {Accept: "application/json"}});
            if (!r.ok) break;
            d = await r.json();
        } catch (erreur) {
            break;                                   // le serveur ne répond pas : on s'arrête sans rien casser
        }
        if (!encore()) return;                       // la fenêtre a changé de joueur ou s'est fermée
        for (const x of (d.cards || [])) {
            const cle = cleVersion(x && x.card);
            if (cle) cles.add(cle);
        }
        pages = d.pages || 1;
        AVU.total = d.total || 0;
        marquerDejaVu();
        majStatutADeja();
        if (page + 1 < pages && page + 1 < AVU_PAGES_MAX) await pause(AVU_PAUSE);
    }
    if (AVU.jeton !== jeton) return;
    AVU.partielle = pages > AVU_PAGES_MAX;
    AVU.enCours = false;
    memoire.ecrire("aDeja." + nom.toLowerCase(), {t: Date.now(), cles: [...cles], total: AVU.total, partielle: AVU.partielle});
    marquerDejaVu();
    majStatutADeja();
}

/* ==========================================================================
   DERNIERS PAQUETS (page Paquets)
   À chaque ouverture, le site reçoit les cartes du serveur, joue l'animation, puis les montre sur
   l'écran de révélation. Le script les note dès leur réception (une copie de la réponse que le site
   reçoit, sans requête de plus) : un F5 pendant l'animation ne les perd pas. L'écran de révélation
   suit ensuite la relance gratuite, et prend le relais si la copie n'a pas pu se faire.
   À côté du paquet à ouvrir, un panneau montre les derniers paquets, et un bouton ouvre la grille
   des 100 dernières cartes ; chaque carte ouvre sa fiche, comme un lien vers une carte du site.
   ========================================================================== */
const PAQ = {liste: [], courant: null, panneau: null, signature: "", haut: 0, vue: null, z: null};

function chargerPaquets() {
    const lu = memoire.lire("paquets", []);
    PAQ.liste = Array.isArray(lu) ? lu.filter(p => p && Array.isArray(p.cartes) && p.t) : [];
}

/* « à l'instant », « il y a 12 min », « hier à 21:04 », « 18/10 à 14:03 » */
function ilYa(ms) {
    const s = Math.round((Date.now() - ms) / 1000);
    if (s < 45) return "à l'instant";
    if (s < 3600) return "il y a " + Math.max(1, Math.round(s / 60)) + " min";
    if (s < 6 * 3600) return "il y a " + Math.round(s / 3600) + " h";
    const d = new Date(ms);
    const heure = d.toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"});
    const jour = new Date();
    if (d.toDateString() === jour.toDateString()) return "aujourd'hui à " + heure;
    jour.setDate(jour.getDate() - 1);
    if (d.toDateString() === jour.toDateString()) return "hier à " + heure;
    return dateCourte(ms) + " à " + heure;
}

/* les cartes de l'écran de révélation (cards.js : flipperHTML ; « Déjà obtenue » marque celles qu'on avait) */
function lireRevelation() {
    return $$("#row5 > .flipper").map(volet => {
        const carte = $(".face .card", volet);
        if (!carte) return null;
        const image = $(".pic img", carte);
        return {
            cle: carte.getAttribute("data-cle") || "",
            n: propre(($(".hd .nm", carte) || {}).textContent),
            r: ([...carte.classList].find(c => /^r-/.test(c)) || "r-C").slice(2),
            d: propre(($(".txt .de", carte) || {}).textContent),
            img: image ? image.getAttribute("data-src") || image.getAttribute("src") || "" : "",
            sh: carte.classList.contains("sh"),
            hw: carte.classList.contains("hw"),
            nouvelle: !$(".tag.dup", volet)
        };
    }).filter(Boolean);
}

/* une carte de la réponse du serveur (cards.js : openPack), au format noté ; sa clé est celle de l'écran (core.js : cleVer) */
const carteDuServeur = c => ({
    cle: String(c.cid || "") + (c.perso ? "" : (c.sh ? "#sh" : "") + (c.hw ? "#hw" : "")),
    n: propre(c.n),
    r: String(c.r || "C"),
    d: propre(c.d),
    img: String(c.img || ""),
    sh: !!c.sh,
    hw: !!c.hw,
    nouvelle: !!c.isNew,
    q: String(c.qid || "")                       // l'élément Wikidata, quand le serveur le donne (pour le bot Discord)
});

/* nombre de cartes de b absentes de a : 0 pour le même paquet, dans n'importe quel ordre ; 1 après une relance */
function ecartPaquets(a, b) {
    const reste = new Map();
    for (const c of a) reste.set(c.cle, (reste.get(c.cle) || 0) + 1);
    let ecart = 0;
    for (const c of b) {
        const n = reste.get(c.cle) || 0;
        if (n) reste.set(c.cle, n - 1);
        else ecart++;
    }
    return ecart;
}
const memePaquet = (p, cartes) => p.cartes.length === cartes.length && ecartPaquets(p.cartes, cartes) === 0;

/* Le site vient de recevoir les cartes d'un paquet (ouverture, paquet PRO, « Revoir ») : notées tout de suite,
   avant l'animation. La trace du serveur (me.revoirTs, ts) reconnaît un paquet déjà noté. */
function noterReponsePaquet(m) {
    if (!CONFIG.DERNIERS_PAQUETS.actif || !m || !Array.isArray(m.cartes)) return;
    const cartes = m.cartes.filter(c => c && c.cid).map(carteDuServeur);
    if (!cartes.length) return;
    const revoir = /\/paquet\/revoir/.test(m.chemin);
    const genre = revoir ? new URLSearchParams(String(m.chemin).split("?")[1] || "").get("genre") || "normal"
        : /\/pro\/paquet/.test(m.chemin) ? "or" : "normal";
    const ts = (revoir ? m.ts : m.revoirTs && m.revoirTs[genre]) || 0;
    const deja = PAQ.liste.find(p => (ts && p.ts === ts) || memePaquet(p, cartes));
    if (deja) {
        PAQ.courant = deja;
        return;
    }
    /* « Revoir » d'un paquet jamais noté (page rechargée avant même la réponse) : il reprend sa place dans le temps */
    const t = revoir && ts ? (ts < 1e12 ? ts * 1000 : ts) : Date.now();
    PAQ.courant = {t, ts, pro: genre === "or", cartes};
    const place = PAQ.liste.findIndex(p => p.t <= t);
    PAQ.liste.splice(place < 0 ? PAQ.liste.length : place, 0, PAQ.courant);
    sauverPaquets();
    partagerPaquet(PAQ.courant);
}

/* Exécutée dans la page elle-même (le script l'y dépose) : quand le site reçoit les cartes d'un paquet, la liste
   de souhaits du joueur ou son historique d'achats, une copie de la réponse part vers le script par un événement.
   Une enchère remportée (la notification « won » du flux en direct du site) le prévient aussi. Les requêtes, les
   réponses et les notifications du site ne sont pas touchées. */
function espionPaquets() {
    if (window.__wpxEspionPaquets) return;
    window.__wpxEspionPaquets = true;
    const original = window.fetch;
    const suivi = /^\/api\/(open|pro\/paquet|paquet\/revoir|wishlist\/cids|wish|wish\/lot|purchases)$/;
    window.fetch = function (entree, options) {
        const promesse = Reflect.apply(original, window, arguments);
        try {
            const adresse = new URL(typeof entree === "string" ? entree : entree && entree.url ? entree.url : String(entree), location.href);
            if (adresse.origin === location.origin && suivi.test(adresse.pathname)) {
                const chemin = adresse.pathname + adresse.search;
                const corps = options && typeof options.body === "string" ? options.body : "";
                promesse.then(r => (r.ok ? r.clone().json() : null)).then(d => {
                    if (!d) return;
                    if (Array.isArray(d.cards)) {
                        document.dispatchEvent(new CustomEvent("wpx-paquet", {detail: JSON.stringify({
                            chemin, cartes: d.cards, ts: d.ts || 0, revoirTs: (d.me && d.me.revoirTs) || null})}));
                    } else if (adresse.pathname === "/api/purchases") {
                        if (Array.isArray(d.items) && (adresse.searchParams.get("page") || "0") === "0") {
                            document.dispatchEvent(new CustomEvent("wpx-achats", {detail: JSON.stringify({items: d.items})}));
                        }
                    } else if (/\/wish/.test(adresse.pathname)) {
                        let demande = {};
                        try { demande = JSON.parse(corps || "{}"); } catch (erreur) { /* corps illisible */ }
                        document.dispatchEvent(new CustomEvent("wpx-souhaits", {detail: JSON.stringify({
                            chemin: adresse.pathname, cids: d.cids || d.ajoutees || null, cid: demande.cid || "", souhaitee: !!d.wished})}));
                    }
                }).catch(() => {});
            }
        } catch (erreur) { /* adresse illisible : la requête du site part quand même, sans copie */ }
        return promesse;
    };
    /* le site cherche onNotify par son nom à chaque notification : l'enveloppe la voit passer, puis la lui rend. Elle
       est posée dès que la fonction du site existe (un script du site peut arriver après celui-ci), et reposée si le
       site la remplace : on regarde toutes les 3 secondes. */
    const envelopper = () => {
        const notifier = window.onNotify;
        if (typeof notifier !== "function" || notifier.__wpx) return;
        const enveloppe = function (d) {
            try {
                if (d && d.type === "won") document.dispatchEvent(new CustomEvent("wpx-gagne"));
            } catch (erreur) { /* notification illisible : le site la traite quand même */ }
            return Reflect.apply(notifier, this, arguments);
        };
        enveloppe.__wpx = true;
        window.onNotify = enveloppe;
    };
    envelopper();
    setInterval(envelopper, 3000);
}

function installerEspionPaquets() {
    D.addEventListener("wpx-paquet", e => {
        try { noterReponsePaquet(JSON.parse(e.detail)); }
        catch (erreur) { /* réponse inattendue : l'écran de révélation prend le relais */ }
    });
    D.addEventListener("wpx-souhaits", e => {
        try { noterSouhaits(JSON.parse(e.detail)); }
        catch (erreur) { /* réponse inattendue : la liste sera relue plus tard */ }
    });
    D.addEventListener("wpx-achats", e => {
        try { noterAchats(JSON.parse(e.detail).items); }
        catch (erreur) { /* réponse inattendue : l'historique sera relu plus tard */ }
    });
    /* le serveur range l'achat juste après la notification : une lecture tout de suite, une autre par sécurité */
    D.addEventListener("wpx-gagne", () => {
        setTimeout(lireAchats, 2000);
        setTimeout(lireAchats, 15000);
    });
    /* un onglet laissé de côté ne reçoit plus les notifications du site : au retour, l'historique est relu s'il date */
    D.addEventListener("visibilitychange", () => {
        if (!D.hidden) relireAchatsSiVieux();
    });
    const script = D.createElement("script");
    script.textContent = "(" + espionPaquets + ")();";
    (D.head || D.documentElement).append(script);
    script.remove();
}

/* Appelé quand l'écran de révélation change : un nouveau paquet, ou une carte relancée dans le paquet en cours.
   Un paquet déjà noté (à la réponse du serveur, ou remontré par « Revoir ») n'est pas compté deux fois. */
function noterRevelation() {
    if (!CONFIG.DERNIERS_PAQUETS.actif) return;
    const revelation = $("#reveal");
    if (!revelation || !revelation.classList.contains("on")) return;
    const cartes = lireRevelation();
    if (!cartes.length) return;
    const courant = PAQ.courant;
    if (courant && courant.cartes.length === cartes.length) {
        const ecart = ecartPaquets(courant.cartes, cartes);
        if (ecart === 0) return;
        if (ecart === 1) {                            // la relance gratuite d'un paquet de communes
            const restantes = courant.cartes.slice();
            const relancee = cartes.find(c => {
                const i = restantes.findIndex(x => x.cle === c.cle);
                if (i < 0) return true;
                restantes.splice(i, 1);
                return false;
            });
            courant.cartes = cartes;
            sauverPaquets();
            if (relancee) partagerPaquet(courant, relancee);
            return;
        }
    }
    const deja = PAQ.liste.find(p => memePaquet(p, cartes));
    if (deja) {
        PAQ.courant = deja;
        return;
    }
    PAQ.courant = {t: Date.now(), pro: /PRO/.test(($("#revTitle") || {}).textContent || ""), cartes};
    PAQ.liste.unshift(PAQ.courant);
    sauverPaquets();
    partagerPaquet(PAQ.courant);
}

function sauverPaquets() {
    let reste = CONFIG.DERNIERS_PAQUETS.cartes;
    const gardes = [];
    for (const p of PAQ.liste) {
        if (reste <= 0) break;
        gardes.push(p.cartes.length <= reste ? p : Object.assign({}, p, {cartes: p.cartes.slice(0, reste)}));
        reste -= p.cartes.length;
    }
    PAQ.liste = gardes;
    memoire.ecrire("paquets", PAQ.liste);
    rendrePanneauPaquets();
    if (PAQ.vue && !PAQ.vue.hidden) rendreDernieres();
}

const cidDe = c => String(c.cle || "").split("#")[0];
const lienCarte = c => {
    const chemin = "/carte/" + encodeURIComponent(cidDe(c));
    return `href="${echapper(chemin)}" data-interne="${echapper(chemin)}"`;
};

/* le panneau à côté du paquet à ouvrir */
function rendrePanneauPaquets() {
    const scene = $("#stage");
    if (!CONFIG.DERNIERS_PAQUETS.actif || !scene) return;
    if (!PAQ.panneau) PAQ.panneau = el("section", {id: "wpx-paquets", class: "wpx-verre", "data-wpx": "", "aria-label": T.derniersTitre});
    if (PAQ.panneau.parentNode !== scene) scene.append(PAQ.panneau);
    const total = PAQ.liste.reduce((somme, p) => somme + p.cartes.length, 0);
    const partage = reglagesDiscord().actif;
    const masque = memoire.lire("paquets.masque", false) === true;
    const chance = CONFIG.CHANCES.actif ? bilanDeChance() : null;
    const signature = PAQ.liste.length + "¤" + total + "¤" + (PAQ.liste[0] ? PAQ.liste[0].t + PAQ.liste[0].cartes.map(c => c.cle).join() : "")
        + "¤" + Math.floor(Date.now() / 60000) + "¤" + partage + "¤" + masque + "¤" + !!chance;
    if (signature === PAQ.signature) return;
    PAQ.signature = signature;
    /* masqué : il ne reste qu'une étiquette, qui le rouvre */
    PAQ.panneau.classList.toggle("wpx-pq-replie", masque);
    if (masque) {
        PAQ.panneau.innerHTML = `<button type="button" class="wpx-pq-montrer" data-wpx-pq-bascule="1" aria-expanded="false" title="Afficher tes derniers paquets">` +
            `📦 <b>${echapper(T.derniersTitre)}</b>${total ? `<small>${pluriel(total, "carte", "cartes")}</small>` : ""}<span aria-hidden="true">▸</span></button>`;
        return;
    }
    const apercu = PAQ.liste.slice(0, CONFIG.DERNIERS_PAQUETS.apercu).map(p => {
        const nouvelles = p.cartes.filter(c => c.nouvelle).length;
        return `<div class="wpx-pq-paquet"><div class="wpx-pq-quand">${echapper(ilYa(p.t))}${p.pro ? ' <span class="wpx-pq-pro">PRO</span>' : ""}` +
            `${nouvelles ? " · " + pluriel(nouvelles, "nouvelle") : ""}</div><div class="wpx-pq-cartes">` +
            p.cartes.map(c => `<a class="wpx-pq-carte" ${lienCarte(c)} style="--c:var(--r-${echapper(c.sh ? "SH" : c.hw ? "HW" : c.r)},#aeb6c2)" title="${echapper(c.n)}">` +
                `<span>${c.sh ? "✦ " : ""}${c.hw ? "🎃 " : ""}${echapper(c.n)}</span>${c.nouvelle ? "<em>Nouvelle</em>" : ""}` +
                `<small>${echapper(RANGS[c.r] || c.r)}</small></a>`).join("") + `</div></div>`;
    }).join("");
    /* la liste défile dans le panneau : elle garde sa position tant qu'aucun nouveau paquet n'est arrivé */
    const avant = $(".wpx-pq-liste", PAQ.panneau), haut = PAQ.liste[0] ? PAQ.liste[0].t : 0;
    const defile = avant && haut === PAQ.haut ? avant.scrollTop : 0;
    PAQ.haut = haut;
    PAQ.panneau.innerHTML = `<div class="wpx-pq-tete"><b>${echapper(T.derniersTitre)}</b><small>${total ? pluriel(total, "carte notée", "cartes notées") : ""}</small>` +
        `<button type="button" class="wpx-pq-masquer" data-wpx-pq-bascule="1" aria-expanded="true" title="Masquer ce panneau (il reste une étiquette pour le rouvrir)">Masquer</button></div>` +
        `<button type="button" class="wpx-btn wpx-pq-voir" data-wpx-dernieres="1"${total ? "" : " disabled"}>Voir mes ${nombre(total)} dernières cartes</button>` +
        (chance ? ligneDeChance(chance) : "") +
        (apercu ? `<div class="wpx-pq-liste">${apercu}</div>` : `<p class="wpx-pq-vide">${echapper(T.derniersVide)}</p>`) +
        `<p class="wpx-pq-note">${echapper(T.derniersNote)} <button type="button" class="wpx-lien" data-wpx-discord="1">` +
        `Discord : ${partage ? "activé" : "désactivé"}</button></p>`;
    if (defile) $(".wpx-pq-liste", PAQ.panneau).scrollTop = defile;
}

/* masquer ou afficher le panneau ; le choix est gardé dans ce navigateur */
function basculerPanneauPaquets() {
    memoire.ecrire("paquets.masque", memoire.lire("paquets.masque", false) !== true);
    rendrePanneauPaquets();
    const bouton = PAQ.panneau && $("[data-wpx-pq-bascule]", PAQ.panneau);
    if (bouton) bouton.focus();
}

/* la grille des dernières cartes, paquet par paquet */
function ouvrirDernieres() {
    if (!PAQ.vue) {
        const z = {
            compte: el("small"),
            nouvelles: el("input", {type: "checkbox"}),
            fermer: el("button", {type: "button", class: "wpx-x", title: "Fermer (Échap)", "aria-label": "Fermer"}, "✕"),
            corps: el("div", {class: "wpx-dc-corps"})
        };
        PAQ.vue = el("aside", {id: "wpx-dernieres", "data-wpx": "", role: "dialog", "aria-label": T.dernieresTitre, hidden: true},
            el("header", {class: "wpx-dc-tete"}, el("b", null, T.dernieresTitre), z.compte,
                el("label", null, z.nouvelles, T.nouvellesSeulement), z.fermer),
            z.corps);
        PAQ.z = z;
        D.body.append(PAQ.vue);
        z.fermer.addEventListener("click", fermerDernieres);
        z.nouvelles.addEventListener("change", rendreDernieres);
    }
    PAQ.vue.hidden = false;
    rendreDernieres();
}

function rendreDernieres() {
    const seulement = PAQ.z.nouvelles.checked;
    let n = 0;
    const blocs = PAQ.liste.map(p => {
        const cartes = seulement ? p.cartes.filter(c => c.nouvelle) : p.cartes;
        if (!cartes.length) return "";
        n += cartes.length;
        return `<section class="wpx-dc-paquet"><h4>${echapper(ilYa(p.t))}${p.pro ? ' <span class="wpx-pq-pro">PRO</span>' : ""}` +
            ` · ${pluriel(cartes.length, "carte")}</h4><div class="grid">` +
            cartes.map(c => `<div class="slot"><a class="cw wpx-dc-lien" ${lienCarte(c)} title="Voir la fiche de « ${echapper(c.n)} »">` +
                `${c.nouvelle ? '<span class="wpx-nouvelle">Nouvelle</span>' : ""}${carteHTML(c)}</a></div>`).join("") + `</div></section>`;
    }).join("");
    PAQ.z.compte.textContent = pluriel(n, seulement ? "nouvelle carte" : "carte", seulement ? "nouvelles cartes" : "cartes");
    const chance = CONFIG.CHANCES.actif ? bilanDeChance() : null;
    PAQ.z.corps.innerHTML = (chance ? ligneDeChance(chance) + detailDeChance(chance) : "") +
        (blocs || `<div class="wpx-vide">${echapper(seulement ? "Aucune nouvelle carte dans ces paquets." : T.derniersVide)}</div>`);
}

function fermerDernieres() {
    if (PAQ.vue) PAQ.vue.hidden = true;
}

/* ==========================================================================
   DISCORD : LES PAQUETS, LES ACHATS ET LA LISTE DE SOUHAITS
   Désactivé tant que le joueur ne l'active pas (« Discord » dans le panneau des derniers paquets). Le script
   envoie alors au webhook du salon d'arrivée chaque paquet ouvert et chaque carte achetée aux enchères, toutes
   raretés, et sa liste de souhaits ; le bot du serveur publie les belles cartes dans les salons de thème et
   prévient les joueurs qui souhaitaient une carte piochée ou achetée. Les envois passent par une file gardée dans le navigateur : un F5 ne les perd pas, et un
   seul onglet envoie à la fois, au rythme que Discord accepte. (12.22) Un onglet caché, que le navigateur ralentit,
   laisse la main à un onglet visible après chaque message : les envois ne s'accumulent plus pour partir par fournées.
   Plusieurs serveurs (12.4) : le webhook du réglage, plus ceux des serveurs reliés par le lien de leur sas d'entrée.
   Chaque envoi part vers chacun d'eux ; chaque serveur ne reçoit que par son propre webhook, rien ne passe de l'un
   à l'autre. Le message qui relie l'outil à un serveur (le pseudo et le code du lien) ne part que vers ce serveur.
   ========================================================================== */
const DSC = {envoi: false, minuterie: 0, reprise: 0, relance: 0, vue: null, z: null, limites: 0, pontSeul: false};
const WEBHOOK = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+$/;

/* Les serveurs reliés (chacun par le bouton « ② Connecte l'outil » de son sas) : une liste {url, nom, actif}. Chaque
   serveur se coche ou se décoche à part ; l'outil envoie à chaque serveur coché, chacun cloisonné. actif (global) =
   au moins un serveur coché, ce que le reste du code regarde pour savoir s'il y a quelque chose à partager. */
function reglagesDiscord() {
    const r = memoire.lire("discord", null) || {};
    let serveurs = Array.isArray(r.serveurs) ? r.serveurs : null;
    if (!serveurs) {            // migration de l'ancien modèle {actif, url, liens} : webhooks sans nom, cochés si c'était actif
        const vus = new Set();
        serveurs = [...urlsManuelles(r.url), ...(Array.isArray(r.liens) ? r.liens.map(String) : [])]
            .filter(u => WEBHOOK.test(u) && !vus.has(u) && (vus.add(u), true))
            .map(u => ({url: u, nom: "", actif: r.actif === true}));
    }
    serveurs = serveurs.filter(s => s && WEBHOOK.test(s.url))
        .map(s => ({url: String(s.url), nom: String(s.nom || ""), actif: s.actif !== false}));
    return {serveurs, actif: serveurs.some(s => s.actif)};
}
/* n'écrit que la liste des serveurs (l'ancien {actif, url, liens} est remplacé) */
function sauverServeurs(serveurs) {
    memoire.ecrire("discord", {serveurs: serveurs.map(s => ({url: String(s.url), nom: String(s.nom || ""), actif: s.actif !== false}))});
}
/* relie un serveur (ou le réactive) et retient son nom ; renvoie true si c'est un nouveau serveur */
function relierServeur(url, nom) {
    const serveurs = reglagesDiscord().serveurs;
    const s = serveurs.find(x => x.url === url);
    if (s) { s.actif = true; if (nom) s.nom = nom; }
    else serveurs.push({url, nom: nom || "", actif: true});
    sauverServeurs(serveurs);
    return !s;
}
/* coche/décoche un serveur dans la liste */
function basculerServeur(url, actif) {
    const serveurs = reglagesDiscord().serveurs;
    const s = serveurs.find(x => x.url === url);
    if (!s) return;
    s.actif = actif;
    sauverServeurs(serveurs);
}
/* les webhooks d'un ancien réglage gardés en texte : utilisé seulement par la migration ci-dessus */
const urlsManuelles = texte => String(texte || "").split(/[\s,]+/).map(u => u.trim()).filter(u => WEBHOOK.test(u));
/* tous les webhooks cochés : là où partent les envois */
function destinationsDiscord() {
    return [...new Set(reglagesDiscord().serveurs.filter(s => s.actif).map(s => s.url))].filter(u => WEBHOOK.test(u));
}
/* le pseudo du joueur connecté : le bouton du compte en haut à droite (rempli dès la connexion) ; le menu du compte
   (#menuName) n'est rempli qu'à son ouverture, le tiroir du téléphone affiche « Wiki-Pick » hors connexion */
const pseudoJoueur = () => ["#meBtn > span:not(.av):last-of-type", "#menuName", "#tiroirNom"]
    .map(choix => propre(($(choix) || {}).textContent)).find(nom => nom && nom !== "—" && nom !== "Wiki-Pick") || "";

/* une empreinte courte d'un texte : la liste de souhaits a-t-elle changé depuis le dernier envoi ? */
function empreinte(texte) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texte.length; i++) h = Math.imul(h ^ texte.charCodeAt(i), 0x01000193);
    return (h >>> 0).toString(16);
}

/* le bloc de données que lit le bot ; aucune apostrophe inversée ne peut le refermer */
const blocDiscord = donnees => "```wpx\n" + JSON.stringify(donnees).replace(/`/g, "\\u0060") + "\n```";

function mettreEnFile(element) {
    let file = memoire.lire("discord.file", []);
    if (!Array.isArray(file)) file = [];
    if (element.type === "souhaits") file = file.filter(x => x.type !== "souhaits");     // seule la dernière liste compte
    const destinations = element.cible ? [element.cible] : destinationsDiscord();        // un seul serveur, ou chacun
    delete element.cible;
    file.push(Object.assign({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7), destinations}, element));
    while (file.length > CONFIG.DISCORD.fileMax) {
        const i = file.findIndex(x => x.type !== "souhaits");
        file.splice(i < 0 ? 0 : i, 1);
    }
    memoire.ecrire("discord.file", file);
    pousserDiscord();
}

/* un paquet (ou la carte d'une relance, ou un achat) : toutes ses cartes, en un ou plusieurs messages de moins de 2 000 signes */
function partagerPaquet(paquet, relancee) {
    if (!reglagesDiscord().actif || !paquet) return;
    const joueur = pseudoJoueur();
    if (!joueur) return;
    const cartes = (relancee ? [relancee] : paquet.cartes)
        .map(c => [cidDe(c), String(c.n).slice(0, 80), c.r, (c.nouvelle ? 1 : 0) | (c.sh ? 2 : 0) | (c.hw ? 4 : 0), c.q || ""]);
    const tete = {v: 1, j: joueur, p: String(paquet.ts || paquet.t) + (relancee ? "-r-" + cidDe(relancee) : ""),
                  t: paquet.t, pro: paquet.pro ? 1 : 0, r: relancee ? 1 : 0};
    if (paquet.achat) tete.a = 1;
    if (paquet.echange) tete.e = 1;                  // une carte reçue dans un échange accepté
    const nature = paquet.achat ? "achat aux enchères" : paquet.echange ? "échange" : relancee ? "carte relancée" : paquet.pro ? "paquet PRO" : "paquet";
    /* le message entier (en-tête, bloc, apostrophes inversées échappées) est mesuré avant de décider de couper : Discord
       refuse au-delà de 2 000 signes, et un message refusé est perdu. L'en-tête ne sert qu'à l'œil : pseudo nettoyé et court. */
    const affiche = String(joueur).replace(/[`@\\]/g, "").slice(0, 40);
    const contenuDuLot = (lot, i) => `${paquet.achat ? "🛒" : "📦"} ${affiche} · ${nature} · ${pluriel(lot.length, "carte")}\n` +
        blocDiscord(Object.assign({}, tete, {i, c: lot}));
    const lots = [[]];
    for (const carte of cartes) {
        const lot = lots[lots.length - 1];
        if (lot.length && contenuDuLot(lot.concat([carte]), lots.length).length > CONFIG.DISCORD.messageMax) lots.push([carte]);
        else lot.push(carte);
    }
    lots.forEach((lot, i) => mettreEnFile({type: "texte", contenu: contenuDuLot(lot, i + 1)}));
}

/* la liste de souhaits du joueur, d'après les réponses du site : liste entière, étoile posée ou retirée, ajout en lot */
function noterSouhaits(m) {
    const etat = memoire.lire("discord.souhaits", null) || {};
    const cids = new Set(Array.isArray(etat.cids) ? etat.cids : []);
    const entiere = /\/wishlist\/cids$/.test(m.chemin) && Array.isArray(m.cids);
    if (entiere) {
        cids.clear();
        m.cids.forEach(c => cids.add(String(c)));
    } else if (/\/wish\/lot$/.test(m.chemin) && Array.isArray(m.cids)) m.cids.forEach(c => cids.add(String(c)));
    else if (/\/wish$/.test(m.chemin) && m.cid) {
        if (m.souhaitee) cids.add(String(m.cid));
        else cids.delete(String(m.cid));
    } else return;
    /* (12.16) le compte dont c'est la liste : un autre compte connecté dans ce navigateur la fait relire */
    memoire.ecrire("discord.souhaits", Object.assign(etat, {cids: [...cids].sort(), connue: entiere || etat.connue === true,
                                                            lue: entiere ? Date.now() : etat.lue || 0,
                                                            joueur: entiere ? pseudoJoueur() : etat.joueur || ""}));
    clearTimeout(DSC.minuterie);
    DSC.minuterie = setTimeout(envoyerSouhaits, 8000);         // plusieurs étoiles de suite : un seul envoi
}

/* relit la liste entière : une requête au site, au chargement, au plus toutes les souhaitsH heures */
async function lireSouhaits() {
    try {
        const reponse = await fetch("/api/wishlist/cids", {credentials: "same-origin"});
        const d = reponse.ok ? await reponse.json() : null;
        if (d && Array.isArray(d.cids)) noterSouhaits({chemin: "/api/wishlist/cids", cids: d.cids});
    } catch (erreur) { /* réseau : on réessaiera au prochain chargement */ }
}

/* Les cartes achetées aux enchères, d'après l'historique « Mes achats » du site (/api/purchases, le plus récent
   d'abord). La première lecture ne fait que noter ce qui s'y trouve déjà : seuls les achats suivants partent. Un
   achat est envoyé comme un paquet ; le bot ignore celui qu'un autre onglet aurait déjà envoyé. */
const cleAchat = a => String(a.id != null ? a.id : [a.ts, a.cid || (a.lot && a.lot.nom) || "", a.price].join("|"));
/* les achats déjà vus, compte par compte : un autre compte connecté dans ce navigateur commence par sa propre première
   lecture (12.2 ; la clé commune de la 12.1 est oubliée) */
const memoireAchats = () => "discord.achats." + pseudoJoueur().toLowerCase();

function oublierAchats() {
    try {
        Object.keys(localStorage).filter(k => k === "wpx.discord.achats" || k.startsWith("wpx.discord.achats.")).forEach(k => localStorage.removeItem(k));
    } catch (erreur) { /* mémoire indisponible : rien à oublier */ }
}

function relireAchatsSiVieux() {
    if (!reglagesDiscord().actif || !pseudoJoueur()) return;
    const etat = memoire.lire(memoireAchats(), null);
    if (!etat || Date.now() - (etat.lu || 0) > CONFIG.DISCORD.achatsMin * 60e3) lireAchats();
    const echanges = memoire.lire(memoireEchanges(), null);
    if (!echanges || Date.now() - (echanges.lu || 0) > CONFIG.DISCORD.achatsMin * 60e3) lireEchanges();
}

function noterAchats(items) {
    if (!reglagesDiscord().actif || !Array.isArray(items) || !pseudoJoueur()) return;
    const achats = items.filter(a => a && !a.vente);
    const cles = achats.map(cleAchat);
    const etat = memoire.lire(memoireAchats(), null);
    const connus = etat && Array.isArray(etat.vus) ? etat.vus : null;
    memoire.ecrire(memoireAchats(), {vus: cles.concat((connus || []).filter(c => !cles.includes(c))).slice(0, 200), lu: Date.now()});
    /* première lecture (partage tout juste activé, ou mémoire vide) : seuls les achats des dernières heures partent. Sans
       cela, un achat fait juste avant l'activation (une carte d'ARG, par exemple) ne partait jamais. Le bot ignore ce
       qu'il a déjà reçu, donc un achat reparti ne se lance pas deux fois. */
    const depuis = Date.now() - CONFIG.DISCORD.achatsRecentsH * 3600e3;
    const vus = new Set(connus || []);
    achats.filter(a => !vus.has(cleAchat(a)) && (connus || (Number(a.ts) || 0) * 1000 >= depuis))
        .reverse().forEach(partagerAchat);                                           // le plus ancien d'abord
}

function partagerAchat(a) {
    const cartes = (a.lot && Array.isArray(a.lot.cartes) ? a.lot.cartes : [a])
        .map(c => ({cle: String(c.cid || ""), n: c.title || c.n || c.cid, r: c.rarity || c.r || "C", sh: !!(c.shiny || c.sh), hw: !!c.hw}))
        .filter(c => c.cle);
    if (cartes.length) partagerPaquet({ts: "a-" + empreinte(cleAchat(a)), t: (Number(a.ts) || 0) * 1000 || Date.now(), achat: true, cartes});
}

/* relit la première page de l'historique : au chargement (au plus toutes les achatsMin minutes), à l'activation du
   partage, et après une enchère remportée */
async function lireAchats() {
    if (!reglagesDiscord().actif) return;
    try {
        const reponse = await fetch("/api/purchases?page=0", {credentials: "same-origin"});
        const d = reponse.ok ? await reponse.json() : null;
        if (d && Array.isArray(d.items)) noterAchats(d.items);
    } catch (erreur) { /* réseau : on relira à la prochaine enchère remportée */ }
}

/* Les cartes reçues dans un échange accepté, d'après l'historique du site (/api/trades?box=history). Comme les achats : la
   première lecture ne fait que noter ce qui s'y trouve, sauf les échanges des dernières heures ; le bot ignore ce qu'il a
   déjà reçu. */
const cleEchange = e => String(e.id);
const memoireEchanges = () => "discord.echanges." + pseudoJoueur().toLowerCase();

function noterEchanges(items) {
    if (!reglagesDiscord().actif || !Array.isArray(items) || !pseudoJoueur()) return;
    const acceptes = items.filter(e => e && e.status === "accepted");
    const cles = acceptes.map(cleEchange);
    const etat = memoire.lire(memoireEchanges(), null);
    const connus = etat && Array.isArray(etat.vus) ? etat.vus : null;
    memoire.ecrire(memoireEchanges(), {vus: cles.concat((connus || []).filter(c => !cles.includes(c))).slice(0, 200), lu: Date.now()});
    const depuis = Date.now() - CONFIG.DISCORD.achatsRecentsH * 3600e3;
    const vus = new Set(connus || []);
    acceptes.filter(e => !vus.has(cleEchange(e)) && (connus || (Number(e.created || e.ts) || 0) * 1000 >= depuis))
        .reverse().forEach(partagerEchange);
}

function partagerEchange(e) {
    const recues = e.incoming ? e.give : e.take;                 // entrant : les cartes de l'autre ; sortant : les miennes
    const cartes = (Array.isArray(recues) ? recues : [])
        .map(c => ({cle: String(c.cid || ""), n: c.title || c.n || c.cid, r: c.rarity || c.r || "C", sh: !!(c.shiny || c.sh), hw: !!c.hw}))
        .filter(c => c.cle);
    if (cartes.length) partagerPaquet({ts: "e-" + empreinte(cleEchange(e)), t: (Number(e.created || e.ts) || 0) * 1000 || Date.now(), echange: true, cartes});
}

async function lireEchanges() {
    if (!reglagesDiscord().actif && !CONFIG.HISTORIQUE.actif) return;
    HIS.lecture = Date.now();
    try {
        const reponse = await fetch("/api/trades?box=history", {credentials: "same-origin"});
        const d = reponse.ok ? await reponse.json() : null;
        if (d && Array.isArray(d.trades)) {
            essayer("l'historique des échanges", () => noterHistorique(d.trades));
            noterEchanges(d.trades);
        }
    } catch (erreur) { /* réseau : on relira au prochain chargement */ }
}

/* ==========================================================================
   HISTORIQUE DES ÉCHANGES, JOUEUR PAR JOUEUR
   Chaque lecture de l'historique du site (/api/trades?box=history) est rangée par partenaire, dans ce navigateur
   et compte par compte : wpx.histo.<moi> (la liste des partenaires) et wpx.histo.<moi>.<partenaire> (ses échanges,
   les plus récents d'abord, parJoueur au plus). Un échange se note en court, vu du joueur comme sur le site : ce
   qu'il a donné, ce qu'il a reçu. On le voit :
     - page Échanges : « Historique » sur chaque échange, et « Par joueur » à côté de « Nouvel échange » ;
     - dans la fenêtre d'échange, sous le nom du partenaire ;
     - sur le profil d'un joueur, avec ses autres boutons (dès qu'un échange avec lui est connu).
   ========================================================================== */
const HIS = {lecture: 0, vue: null, z: null, nom: "", tout: false};
const STATUTS_ECHANGE = {accepted: "a", declined: "d", cancelled: "c", invalid: "i", countered: "x"};
const NOMS_STATUTS = {a: "Accepté", d: "Refusé", c: "Annulé", i: "Annulé : cartes indisponibles", x: "Remplacé par une contre-proposition", p: "En attente"};
const memoireHisto = () => "histo." + pseudoJoueur().toLowerCase();
const memoireHistoDe = nom => memoireHisto() + "." + String(nom).toLowerCase();
const dateLongue = ms => new Date(ms).toLocaleDateString("fr-FR", {day: "numeric", month: "long", year: "numeric"});

function indexHisto() {
    const i = memoire.lire(memoireHisto(), null);
    return i && i.p && typeof i.p === "object" ? i : {lu: 0, p: {}};
}

/* une carte, en court : [clé, nom, rang, 1 chromatique + 2 Halloween] */
const carteCourte = c => [String(c.cid || ""), String(c.title || c.n || c.cid || ""), String(c.rarity || c.r || "C"),
    (c.shiny || c.sh ? 1 : 0) + (c.hw ? 2 : 0)];
const carteLongue = a => ({cle: a[0], n: a[1], r: a[2], sh: !!(a[3] & 1), hw: !!(a[3] & 2)});

function echangeCourt(t) {
    const inc = !!t.incoming;
    const donnees = inc ? t.take : t.give, recues = inc ? t.give : t.take;
    const court = {i: t.id, t: Number(t.closed || t.created) || 0, s: STATUTS_ECHANGE[t.status] || "p", e: inc ? 1 : 0,
                   g: (Array.isArray(donnees) ? donnees : []).map(carteCourte), r: (Array.isArray(recues) ? recues : []).map(carteCourte)};
    const wg = Number(inc ? t.takeCoins : t.giveCoins) || 0, wr = Number(inc ? t.giveCoins : t.takeCoins) || 0;
    if (wg) court.wg = wg;
    if (wr) court.wr = wr;
    if (t.message) court.m = String(t.message).slice(0, 200);
    return court;
}

function echangesAvec(nom) {
    const d = memoire.lire(memoireHistoDe(nom), null);
    return d && Array.isArray(d.l) ? d.l : [];
}

function noterHistorique(trades) {
    if (!CONFIG.HISTORIQUE.actif || !pseudoJoueur()) return;
    const index = indexHisto();
    const parNom = new Map();
    for (const t of trades) {
        const nom = propre(t && (t.incoming ? t.from : t.to));
        if (!nom || t.id == null) continue;
        if (!parNom.has(nom)) parNom.set(nom, []);
        parNom.get(nom).push(echangeCourt(t));
    }
    for (const [nom, neufs] of parNom) {
        const ids = new Set(neufs.map(e => e.i));
        let liste = neufs.concat(echangesAvec(nom).filter(e => !ids.has(e.i)))
            .sort((a, b) => b.t - a.t).slice(0, Math.max(1, CONFIG.HISTORIQUE.parJoueur));
        /* mémoire pleine : on garde moins d'échanges avec ce joueur plutôt que rien */
        while (!memoire.ecrire(memoireHistoDe(nom), {nom, l: liste}) && liste.length > 20) liste = liste.slice(0, Math.floor(liste.length / 2));
        index.p[nom.toLowerCase()] = [nom, liste.length, liste.filter(e => e.s === "a").length, liste[0] ? liste[0].t : 0];
    }
    index.lu = Date.now();
    memoire.ecrire(memoireHisto(), index);
    if (HIS.vue && !HIS.vue.hidden) rendreHistorique();
    installerBoutonsHisto();
}

/* au plus une lecture toutes les 30 s ; sur la page Échanges, à chaque passage ; ailleurs, toutes les relireMin minutes */
function relireHistoriqueSiVieux() {
    if (!CONFIG.HISTORIQUE.actif || !pseudoJoueur() || Date.now() - HIS.lecture < 30e3) return;
    if (vueCourante() === "trades" || Date.now() - (indexHisto().lu || 0) > CONFIG.HISTORIQUE.relireMin * 60e3) lireEchanges();
}

/* combien d'échanges connus avec ce joueur (tous, et acceptés) */
function bilanAvec(nom) {
    const e = indexHisto().p[String(nom).toLowerCase()];
    return e ? {n: e[1], acceptes: e[2]} : {n: 0, acceptes: 0};
}

const libelleHisto = nom => {
    const b = bilanAvec(nom);
    return b.n ? "Historique · " + pluriel(b.n, "échange") : "Historique";
};

/* les boutons, reposés à chaque rafraîchissement (le site redessine ses pages) */
function installerBoutonsHisto() {
    if (!CONFIG.HISTORIQUE.actif || !pseudoJoueur()) {
        $$("[data-wpx-histo]").forEach(b => b.remove());
        return;
    }
    /* page Échanges : chaque échange, et « Par joueur » */
    for (const thd of $$("#tbody .trade > .thd")) {
        const nom = propre((($(".av[data-n]", thd) || {}).dataset || {}).n);
        if (!nom) continue;
        let b = $(":scope > [data-wpx-histo]", thd);
        if (!b) {
            b = el("button", {type: "button", class: "btn xs ghost wpx-histo-btn", "data-wpx": "", "data-wpx-histo": nom, title: "Tes échanges avec ce(tte) joueur(euse)"});
            thd.insertBefore(b, $(":scope > .tstatus", thd));
        }
        const texte = libelleHisto(nom);
        if (b.textContent !== texte) b.textContent = texte;
    }
    const actes = $("#v-trades .tools > .acts");
    if (actes && !$(":scope > [data-wpx-histo]", actes)) {
        actes.prepend(el("button", {type: "button", class: "btn sm ghost wpx-histo-btn", "data-wpx": "", "data-wpx-histo": "",
            title: "Tes échanges avec chaque joueur(euse), gardés dans ce navigateur"}, "Par joueur(euse)"));
    }
    /* fenêtre d'échange : sous le nom du partenaire */
    const titre = $("#composer h2");
    const partenaire = partenaireEchange();
    if (titre && partenaire) {
        let b = $(":scope > [data-wpx-histo]", titre.parentNode);
        if (!b) {
            b = el("button", {type: "button", class: "btn xs ghost wpx-histo-btn wpx-histo-composer", "data-wpx": "", title: "Tes échanges avec ce(tte) joueur(euse)"});
            titre.after(b);
        }
        b.dataset.wpxHisto = partenaire;
        const texte = libelleHisto(partenaire);
        if (b.textContent !== texte) b.textContent = texte;
    }
    /* profil d'un autre joueur, s'il y a un échange connu avec lui */
    const p = vueCourante() === "profile" && lireProfil();
    const actesProfil = p && $(".acts", p.tete);
    if (actesProfil) {
        const nom = pseudoDuProfil(p);
        const n = nom && nom.toLowerCase() !== pseudoJoueur().toLowerCase() ? bilanAvec(nom).n : 0;
        let b = $(":scope > [data-wpx-histo]", actesProfil);
        if (n && !b) {
            b = el("button", {type: "button", class: "btn sm ghost wpx-histo-btn", "data-wpx": "", title: "Vos échanges, gardés dans ce navigateur"});
            const echanger = $(":scope > [data-tnew]", actesProfil);
            if (echanger) echanger.after(b);
            else actesProfil.prepend(b);
        }
        if (b && !n) b.remove();
        else if (b) {
            b.dataset.wpxHisto = nom;
            const texte = "Vos échanges (" + nombre(n) + ")";
            if (b.textContent !== texte) b.textContent = texte;
        }
    }
}

function ouvrirHistorique(nom) {
    if (!HIS.vue) {
        const z = {
            titre: el("b"),
            compte: el("small"),
            tout: el("input", {type: "checkbox"}),
            retour: el("button", {type: "button", class: "btn xs ghost", hidden: true}, "← Retour à la liste"),
            chercher: el("input", {type: "search", class: "wpx-hi-chercher", placeholder: "Chercher un(e) joueur(euse)…", autocomplete: "off"}),
            fermer: el("button", {type: "button", class: "wpx-x", title: "Fermer (Échap)", "aria-label": "Fermer"}, "✕"),
            corps: el("div", {class: "wpx-dc-corps"})
        };
        HIS.vue = el("aside", {id: "wpx-histo", "data-wpx": "", role: "dialog", "aria-label": "Historique des échanges", hidden: true},
            el("header", {class: "wpx-dc-tete"}, z.retour, z.titre, z.compte, z.chercher,
                el("label", null, z.tout, "Refusés et annulés aussi"), z.fermer),
            z.corps);
        HIS.z = z;
        D.body.append(HIS.vue);
        z.fermer.addEventListener("click", fermerHistorique);
        z.retour.addEventListener("click", () => ouvrirHistorique(""));
        z.tout.addEventListener("change", () => {
            HIS.tout = z.tout.checked;
            rendreHistorique();
        });
        z.chercher.addEventListener("input", rendreHistorique);
        z.corps.addEventListener("click", e => {
            const ligne = e.target.closest && e.target.closest("[data-wpx-hi-joueur]");
            if (ligne) ouvrirHistorique(ligne.dataset.wpxHiJoueur);
        });
    }
    HIS.nom = nom || "";
    HIS.z.tout.checked = HIS.tout;
    HIS.vue.hidden = false;
    rendreHistorique();
    HIS.z.corps.scrollTop = 0;
}

function fermerHistorique() {
    if (HIS.vue) HIS.vue.hidden = true;
}

const puceCarte = c => `<a class="wpx-pq-carte" ${lienCarte(c)} style="--c:var(--r-${echapper(c.sh ? "SH" : c.hw ? "HW" : c.r)},#aeb6c2)" title="${echapper(c.n)}">` +
    `<span>${c.sh ? "✦ " : ""}${c.hw ? "🎃 " : ""}${echapper(c.n)}</span><small>${echapper(RANGS[c.r] || c.r)}</small></a>`;

function colonneHisto(titre, cartes, wikiki) {
    return `<div class="wpx-hi-col"><h5>${echapper(titre)}</h5><div class="wpx-pq-cartes">${cartes.map(a => puceCarte(carteLongue(a))).join("")}</div>` +
        (wikiki ? `<div class="wpx-hi-w">${nombre(wikiki)} Wikiki</div>` : "") +
        (!cartes.length && !wikiki ? `<small class="wpx-hi-rien">Rien</small>` : "") + `</div>`;
}

function rendreHistorique() {
    const z = HIS.z;
    const index = indexHisto();
    z.retour.hidden = !HIS.nom;
    z.chercher.hidden = !!HIS.nom;
    if (!HIS.nom) {
        /* la liste des partenaires, du plus récent au plus ancien */
        const q = propre(z.chercher.value).toLowerCase();
        const joueurs = Object.values(index.p).filter(j => !q || j[0].toLowerCase().includes(q)).sort((a, b) => b[3] - a[3]);
        z.titre.textContent = "Tes échanges, personne par personne";
        z.compte.textContent = pluriel(Object.keys(index.p).length, "joueur(euse)", "joueur(euse)s");
        z.corps.innerHTML = (joueurs.length ? `<div class="wpx-hi-joueurs">${joueurs.map(j =>
            `<button type="button" class="wpx-hi-joueur" data-wpx-hi-joueur="${echapper(j[0])}"><b>${echapper(j[0])}</b>` +
            `<span>${pluriel(j[2], "accepté")}${j[1] > j[2] ? " · " + pluriel(j[1] - j[2], "autre") : ""}</span>` +
            `<small>${j[3] ? echapper(ilYa(j[3] * 1000)) : ""}</small></button>`).join("")}</div>`
            : `<div class="wpx-vide">${q ? "Personne de ce nom." : "Aucun échange connu pour l'instant : l'outil les note à chaque passage sur la page Échanges."}</div>`) +
            `<p class="wpx-hi-note">Gardé dans ce navigateur, ${nombre(CONFIG.HISTORIQUE.parJoueur)} échanges au plus avec chaque joueur(euse). ` +
            `Le site ne montre que les derniers : l'outil retient tout ce qu'il a vu depuis son installation.</p>`;
        return;
    }
    const tous = echangesAvec(HIS.nom);
    const liste = HIS.tout ? tous : tous.filter(e => e.s === "a");
    const acceptes = tous.filter(e => e.s === "a");
    const cartes = cle => acceptes.reduce((n, e) => n + e[cle].length, 0);
    const wikiki = cle => acceptes.reduce((n, e) => n + (e[cle] || 0), 0);
    const nom = (index.p[HIS.nom.toLowerCase()] || [HIS.nom])[0];
    z.titre.innerHTML = `Tes échanges avec <a href="/profil/${echapper(encodeURIComponent(nom))}" data-profile="${echapper(nom)}" class="wpx-hi-nom">${echapper(nom)}</a>`;
    z.compte.textContent = pluriel(acceptes.length, "accepté") + (tous.length > acceptes.length ? " · " + pluriel(tous.length - acceptes.length, "autre") : "");
    const bilan = acceptes.length ? `<div class="wpx-hi-bilan">` +
        `<span>Depuis le <b>${echapper(dateLongue(acceptes[acceptes.length - 1].t * 1000))}</b></span>` +
        `<span>Tu as donné <b>${pluriel(cartes("g"), "carte")}</b>${wikiki("wg") ? " et " + nombre(wikiki("wg")) + " Wikiki" : ""}</span>` +
        `<span>Tu as reçu <b>${pluriel(cartes("r"), "carte")}</b>${wikiki("wr") ? " et " + nombre(wikiki("wr")) + " Wikiki" : ""}</span></div>` : "";
    z.corps.innerHTML = bilan + (liste.length ? liste.map(e =>
        `<section class="wpx-hi-echange wpx-hi-${echapper(e.s)}"><h4><span>${echapper(ilYa(e.t * 1000))}</span>` +
        `<span class="wpx-hi-statut">${echapper(NOMS_STATUTS[e.s] || "")}</span><small>${e.e ? "proposé par " + echapper(nom) : "proposé par toi"}</small></h4>` +
        (e.m ? `<p class="wpx-hi-msg">${echapper(e.m)}</p>` : "") +
        `<div class="wpx-hi-cols">${colonneHisto("Tu as donné", e.g, e.wg)}<div class="wpx-hi-fl" aria-hidden="true">⇄</div>` +
        `${colonneHisto("Tu as reçu", e.r, e.wr)}</div></section>`).join("")
        : `<div class="wpx-vide">${tous.length ? "Aucun échange accepté. Coche « Refusés et annulés aussi » pour voir les autres." : "Aucun échange connu avec ce(tte) joueur(euse)."}</div>`);
}

function envoyerSouhaits(force, cible) {
    if (!reglagesDiscord().actif) return;
    const etat = memoire.lire("discord.souhaits", null);
    const joueur = pseudoJoueur();
    if (!etat || etat.connue !== true || !joueur) return;     // tant que la liste entière n'a pas été lue, rien ne part
    const signe = empreinte(joueur + "|" + etat.cids.join("|"));
    if (force !== true && etat.envoye === signe && Date.now() - (etat.envoyeLe || 0) < CONFIG.DISCORD.souhaitsH * 3600e3) return;
    mettreEnFile({type: "souhaits", joueur, cids: etat.cids, signe, cible});     // cible : un seul serveur, sinon chacun
}

/* un envoi au webhook : {ok} | {attente: ms} | {abandon, erreur} (message refusé) | {erreur} (à réessayer).
   L'envoi passe par le second script Pont Discord, qui relaie les messages vers Discord. */
async function envoyerDiscord(url, element) {
    let options, spec;
    if (element.type === "souhaits") {
        const payload = {content: `⭐ ${element.joueur} · liste de souhaits · ${pluriel(element.cids.length, "carte")}\n` +
                blocDiscord({v: 1, type: "souhaits", j: element.joueur, n: element.cids.length}),
            allowed_mentions: {parse: []}, attachments: [{id: 0, filename: "souhaits.json"}]};
        const fichierTexte = JSON.stringify({v: 1, j: element.joueur, cids: element.cids});
        const corps = new FormData();
        corps.append("payload_json", JSON.stringify(payload));
        corps.append("files[0]", new Blob([fichierTexte], {type: "application/json"}), "souhaits.json");
        options = {method: "POST", body: corps};
        spec = {url, payload, fichier: {nom: "souhaits.json", type: "application/json", texte: fichierTexte}};
    } else {
        const payload = {content: element.contenu, allowed_mentions: {parse: []}};
        options = {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(payload)};
        spec = {url, payload};
    }
    if (DSC.pontSeul) return await envoyerParPont(spec);
    let reponse;
    try {
        reponse = await fetch(url + "?wait=true", options);
    } catch (erreur) {
        DSC.pontSeul = true;                        // la page ne peut pas joindre Discord (CSP du site) : le pont, dès maintenant
        return await envoyerParPont(spec);          // et pour tous les envois suivants
    }
    if (reponse.ok) return {ok: true};
    const d = await reponse.json().catch(() => ({}));
    if (reponse.status === 429) return {attente: Math.ceil((Number(d.retry_after) || 2) * 1000) + 250};
    if ([401, 403, 404].includes(reponse.status)) return {refuse: true, erreur: `Discord refuse le webhook (${reponse.status}) : vérifie l'adresse`};
    return {abandon: true, erreur: `Discord refuse ce message (${reponse.status})`};
}

/* Le pont (second userscript, album_pont_discord) se charge de transmettre les messages vers Discord.
   On lui dépose la demande dans la mémoire partagée (localStorage) et on le réveille par un événement (wpx-pont-demande) ;
   il répond au même endroit et nous réveille à son tour (wpx-pont-reponse dans cet onglet, l'événement « storage » depuis
   un autre). (12.22) Plus d'attente d'un tour de minuterie, même dans un onglet caché ; un pont plus ancien, sans ces
   événements, est encore relu toutes les 300 ms. S'il n'est pas installé, la demande reste en file et on réessaie :
   rien n'est perdu. */
let numeroPont = 0;
function traduirePont(r) {
    const s = r && r.status;
    if (s === 200 || s === 204) return {ok: true};
    if (s === 429) return {attente: r.retryAfter || 2250};
    if ([401, 403, 404].includes(s)) return {refuse: true, erreur: `Discord refuse le webhook (${s}) : vérifie l'adresse`};
    if (!s) return {erreur: "le pont n'a pas pu joindre Discord (réessai)"};
    return {abandon: true, erreur: `Discord refuse ce message (${s})`};
}

/* dépose une demande pour le pont (les demandes de plus de deux minutes sont oubliées) et le réveille */
function deposerPont(demande) {
    const file = memoire.lire("pont.req", []);
    memoire.ecrire("pont.req", [...(Array.isArray(file) ? file : []).filter(x => x && Date.now() - (x.ts || 0) < 120000), demande]);
    D.dispatchEvent(new CustomEvent("wpx-pont-demande"));
}

/* la réponse du pont à la demande id, ou undefined au bout de delaiMax (la demande est alors retirée) */
function attendrePont(id, delaiMax) {
    return new Promise(resolve => {
        const debut = Date.now();
        let fini = false, minuterie = 0;
        const parStockage = e => { if (e.key === "wpx.pont.res") regarder(); };
        const finir = r => {
            if (fini) return;
            fini = true;
            clearTimeout(minuterie);
            D.removeEventListener("wpx-pont-reponse", regarder);
            removeEventListener("storage", parStockage);
            resolve(r);
        };
        function regarder() {
            if (fini) return;
            const reps = memoire.lire("pont.res", {});
            if (reps && typeof reps === "object" && Object.prototype.hasOwnProperty.call(reps, id)) {
                const r = reps[id];
                delete reps[id];
                memoire.ecrire("pont.res", reps);
                finir(r);
                return;
            }
            if (Date.now() - debut > delaiMax) {
                const file = memoire.lire("pont.req", []);
                memoire.ecrire("pont.req", (Array.isArray(file) ? file : []).filter(x => x && x.id !== id));
                finir(undefined);
                return;
            }
            clearTimeout(minuterie);
            minuterie = setTimeout(regarder, 300);      // en secours : un pont sans l'événement
        }
        D.addEventListener("wpx-pont-reponse", regarder);
        addEventListener("storage", parStockage);
        minuterie = setTimeout(regarder, 300);
    });
}

async function envoyerParPont(spec) {
    const id = Date.now().toString(36) + "-" + (++numeroPont);
    deposerPont(Object.assign({id, ts: Date.now()}, spec));
    const r = await attendrePont(id, 25000);
    if (r === undefined) return {erreur: "installe aussi le second script Pont Discord (voir le guide) : il transmet les messages vers Discord"};
    return traduirePont(r);
}

/* Demande au pont le nom du webhook (le bot l'a nommé d'après le serveur) : pour afficher le vrai nom sans reconnexion. */
async function nomDuWebhook(url) {
    const id = "nom-" + Date.now().toString(36) + "-" + (++numeroPont);
    deposerPont({id, ts: Date.now(), url, lire: true});
    const r = await attendrePont(id, 12000);
    try {
        return r && r.status === 200 ? String(JSON.parse(r.corps || "{}").name || "").trim() : "";
    } catch (erreur) {
        return "";
    }
}

/* Remplit tout seul les noms manquants des serveurs reliés (ceux restés « Serveur Discord »), via le pont. Aucune action. */
async function nommerServeurs() {
    let fait = false;
    for (const s of reglagesDiscord().serveurs) {
        if (s.nom) continue;
        const nom = await nomDuWebhook(s.url);
        if (!nom) continue;
        const liste = reglagesDiscord().serveurs, cible = liste.find(x => x.url === s.url);
        if (cible && !cible.nom) { cible.nom = nom; sauverServeurs(liste); fait = true; }
    }
    if (fait && DSC.vue && !DSC.vue.hidden) majDialogueDiscord();
}

function noterEtatDiscord(texte, ok) {
    memoire.ecrire("discord.etat", {texte, ok, quand: Date.now()});
    if (DSC.vue && !DSC.vue.hidden) majDialogueDiscord();
}

/* un envoi parti (ou abandonné) vers ce webhook : il le retire de sa liste ; parti vers tous, il quitte la file */
function retirerDestination(id, url) {
    const file = memoire.lire("discord.file", []);
    if (!Array.isArray(file)) return;
    memoire.ecrire("discord.file", file.map(x => x.id !== id ? x
        : Object.assign(x, {destinations: (Array.isArray(x.destinations) ? x.destinations : [url]).filter(u => u !== url)}))
        .filter(x => !Array.isArray(x.destinations) || x.destinations.length));
}

/* revenir vider la file dans ms millisecondes */
function relancerDiscord(ms) {
    clearTimeout(DSC.relance);
    DSC.relance = setTimeout(pousserDiscord, Math.max(250, ms || 0));
}

/* Vide la file, un message au plus toutes les attenteMs, tous onglets confondus (l'heure du dernier envoi est gardée dans
   wpx.discord.dernier) ; un seul onglet envoie à la fois. (12.22) Un onglet caché, que le navigateur ralentit, lâche la
   main au lieu d'attendre : un onglet visible la reprend. Un onglet qui trouve la main prise revient voir quelques
   secondes plus tard, tant qu'il reste des envois ; un onglet qui redevient visible relance aussi l'envoi. */
async function pousserDiscord() {
    if (DSC.envoi || !reglagesDiscord().actif || !destinationsDiscord().length) return;
    const enFile = memoire.lire("discord.file", []);
    if (!Array.isArray(enFile) || !enFile.length) return;
    DSC.envoi = true;
    let occupe = false;                                    // un autre onglet a la main
    const vider = async () => {
        for (;;) {
            const file = memoire.lire("discord.file", []);
            if (!Array.isArray(file) || !file.length || !reglagesDiscord().actif) return;
            const element = file[0];
            if (!element || typeof element !== "object" || !element.id) {       // un élément abîmé est retiré, il ne bloque pas la file
                memoire.ecrire("discord.file", file.filter(x => x && typeof x === "object" && x.id));
                continue;
            }
            // un envoi d'avant la 12.4 n'a pas de liste : il part vers les serveurs cochés
            const url = (Array.isArray(element.destinations) ? element.destinations : destinationsDiscord())[0];
            if (!WEBHOOK.test(url || "")) {
                retirerDestination(element.id, url);
                continue;
            }
            /* l'écart avec le dernier envoi, quel que soit l'onglet qui l'a fait */
            const attente = (Number(memoire.lire("discord.dernier", 0)) || 0) + CONFIG.DISCORD.attenteMs - Date.now();
            if (attente > 0) {
                if (D.hidden) {                            // caché : la main passe à un onglet visible pendant l'attente
                    relancerDiscord(attente);
                    return;
                }
                await pause(Math.min(attente, CONFIG.DISCORD.attenteMs));
                continue;                                  // la file a pu changer pendant la pause
            }
            const resultat = await envoyerDiscord(url, element);
            memoire.ecrire("discord.dernier", Date.now());
            if (resultat.attente) {                        // Discord demande de patienter : il dit combien
                if (++DSC.limites > CONFIG.DISCORD.limitesMax) {      // trop de refus de suite : on reprend dans une minute
                    DSC.limites = 0;
                    clearTimeout(DSC.reprise);
                    DSC.reprise = setTimeout(pousserDiscord, 60000);
                    return;
                }
                if (D.hidden) {
                    relancerDiscord(resultat.attente);
                    return;
                }
                await pause(resultat.attente);
                continue;
            }
            DSC.limites = 0;
            if (resultat.erreur) noterEtatDiscord(resultat.erreur, false);
            if (resultat.refuse) {                         // ce webhook n'existe plus : ce serveur ne reçoit pas ce message
                retirerDestination(element.id, url);
                continue;
            }
            if (!resultat.ok && !resultat.abandon) {       // réseau coupé : nouvel essai dans une minute
                clearTimeout(DSC.reprise);
                DSC.reprise = setTimeout(pousserDiscord, 60000);
                return;
            }
            retirerDestination(element.id, url);
            if (resultat.ok) {
                noterEtatDiscord("dernier envoi réussi", true);
                if (element.type === "souhaits") {
                    memoire.ecrire("discord.souhaits", Object.assign(memoire.lire("discord.souhaits", {}), {envoye: element.signe, envoyeLe: Date.now()}));
                }
            }
        }
    };
    try {
        if (navigator.locks) {
            await navigator.locks.request("wpx-discord", {ifAvailable: true}, verrou => {
                if (verrou) return vider();
                occupe = true;
                return null;
            });
        } else {
            await vider();
        }
    } catch (erreur) {                                     // une file abîmée ne doit pas rester bloquée sans que personne le sache
        noterEtatDiscord("erreur interne, nouvel essai dans une minute", false);
        clearTimeout(DSC.reprise);
        DSC.reprise = setTimeout(pousserDiscord, 60000);
    } finally {
        DSC.envoi = false;
    }
    if (occupe) relancerDiscord(3000);                     // la main est ailleurs : on revient voir s'il reste des envois
}

/* le réglage : la liste des serveurs reliés, chacun avec sa case (coché = partage, décoché = arrêté) */
function ouvrirDiscord() {
    if (!DSC.vue) {
        const z = {
            fermer: el("button", {type: "button", class: "wpx-x", title: "Fermer (Échap)", "aria-label": "Fermer"}, "✕"),
            liste: el("div", {class: "wpx-ds-liste"}),
            pseudo: el("b"),
            etat: el("p", {class: "wpx-ds-etat", "aria-live": "polite"})
        };
        DSC.vue = el("aside", {id: "wpx-discord", "data-wpx": "", role: "dialog", "aria-label": T.discordTitre, hidden: true},
            el("div", {class: "wpx-ds-tete"}, el("b", null, T.discordTitre), z.fermer),
            el("p", {class: "wpx-ds-texte"}, T.discordTexte),
            z.liste,
            el("p", {class: "wpx-ds-texte"}, "Ton pseudo de jeu : ", z.pseudo, "."),
            z.etat);
        DSC.z = z;
        z.fermer.addEventListener("click", fermerDiscord);
        D.body.append(DSC.vue);
    }
    DSC.vue.hidden = false;
    majDialogueDiscord();
    nommerServeurs();                            // au cas où un nom manque encore, on le récupère via le pont
}

function fermerDiscord() {
    if (DSC.vue) DSC.vue.hidden = true;
}

function majDialogueDiscord() {
    const z = DSC.z;
    if (!z) return;
    z.pseudo.textContent = pseudoJoueur() || "inconnu (connecte-toi au site)";
    const serveurs = reglagesDiscord().serveurs;
    z.liste.textContent = "";
    if (!serveurs.length) {
        z.liste.append(el("p", {class: "wpx-ds-vide"}, T.discordVide));
    } else {
        serveurs.forEach(s => {
            const coche = el("input", {type: "checkbox"});
            coche.checked = s.actif;
            coche.addEventListener("change", () => changerServeur(s.url, coche.checked));
            z.liste.append(el("label", {class: "wpx-ds-serveur"}, coche, el("span", {class: "wpx-ds-nom"}, s.nom || T.discordServeurSansNom)));
        });
    }
    const etat = memoire.lire("discord.etat", null);
    const file = memoire.lire("discord.file", []);
    const souhaits = memoire.lire("discord.souhaits", null);
    z.etat.textContent = [etat ? `${etat.ok ? "✓" : "⚠"} ${etat.texte} (${ilYa(etat.quand)})` : "",
        Array.isArray(file) && file.length ? pluriel(file.length, "envoi en attente", "envois en attente") : "",
        souhaits && souhaits.connue ? "liste de souhaits : " + pluriel(souhaits.cids.length, "carte") : ""].filter(Boolean).join(" · ");
    z.etat.classList.toggle("wpx-ds-erreur", !!etat && !etat.ok);
}

/* coché/décoché dans la modale : on applique tout de suite (chaque serveur à part) */
function changerServeur(url, actif) {
    const avant = reglagesDiscord().actif;
    basculerServeur(url, actif);
    rendrePanneauPaquets();
    if (actif) {
        if (!avant) oublierAchats();                          // les achats faits pendant la coupure ne partent pas
        lireAchats();                                         // ce qui est déjà acheté est noté, sans partir
        lireSouhaits().then(() => envoyerSouhaits(true, url));   // la liste de souhaits part vers ce serveur
        pousserDiscord();
        noterEtatDiscord("partage activé", true);
    } else {
        if (!reglagesDiscord().actif) oublierAchats();        // plus aucun serveur coché
        noterEtatDiscord("partage arrêté pour ce serveur", true);
    }
    majDialogueDiscord();
}

/* L'outil relié par le lien personnel du sas d'un serveur Discord (12.3) :
   https://wiki-pick.com/#wpx-discord=<webhook>&wpx-code=<code>&wpx-serveur=<nom>. Ouvert ici, le lien ajoute ce serveur
   à la liste (ou le rallume) et retient son nom ; dès que le pseudo s'affiche, l'outil envoie au bot le pseudo exact du
   joueur avec le code du lien : le bot sait quel compte Discord est derrière ce pseudo, et lui demande de confirmer en
   privé. Le lien quitte la barre d'adresse dès qu'il est lu ; un fragment (#…) n'est jamais envoyé au site. */
function lireLienDiscord() {
    const fragment = location.hash.replace(/^#/, "");
    if (!/(^|&)wpx-discord=/.test(fragment)) return;
    const parametres = new URLSearchParams(fragment);
    const url = String(parametres.get("wpx-discord") || ""), code = String(parametres.get("wpx-code") || "").toUpperCase();
    const nom = String(parametres.get("wpx-serveur") || "").trim().slice(0, 80);
    try { history.replaceState(history.state, "", location.pathname + location.search); } catch (erreur) { /* il reste affiché */ }
    if (!WEBHOOK.test(url) || !/^[A-Z0-9]{6,16}$/.test(code)) return bandeauDiscord("⚠ Ce lien Discord est abîmé : reprends le bouton du sas.");
    const avantActif = reglagesDiscord().actif;
    const nouveau = relierServeur(url, nom);              // l'ajoute (ou le rallume) et retient son nom ; chaque serveur reste cloisonné
    memoire.ecrire("discord.lien", {code, url, quand: Date.now()});
    if (nouveau) {                                        // un serveur de plus : la liste de souhaits repart vers lui
        if (!avantActif) oublierAchats();
        const souhaits = memoire.lire("discord.souhaits", null);
        if (souhaits) memoire.ecrire("discord.souhaits", Object.assign(souhaits, {envoye: null}));
    }
    noterEtatDiscord("partage relié au serveur Discord", true);
    bandeauDiscord("🔗 Outil relié au serveur Discord. Dès que ton pseudo s'affiche ici (connecte-toi si besoin), il part au bot.");
}

/* le pseudo exact, avec le code du lien : une seule fois, vers le webhook de ce lien, avant tout le reste */
function envoyerLien() {
    const lien = memoire.lire("discord.lien", null);
    const joueur = pseudoJoueur();
    if (!lien || !joueur || !destinationsDiscord().includes(lien.url)) return;
    memoire.ecrire("discord.lien", null);
    if (Date.now() - (lien.quand || 0) > 30 * 60e3) return bandeauDiscord("⚠ Ce lien a expiré : reprends le bouton du sas sur Discord.");
    mettreEnFile({type: "texte", cible: lien.url,               // vers ce serveur seulement
                  contenu: `🔗 ${joueur} · outil relié par le lien du sas\n` + blocDiscord({v: 1, type: "lien", j: joueur, code: lien.code})});
    bandeauDiscord(`✓ Pseudo ${joueur} envoyé. Retourne sur Discord : le bot te demande de le confirmer en message privé.`);
}

/* un bandeau en haut de la page, quelques secondes */
function bandeauDiscord(texte) {
    const vieux = $("#wpx-ds-bandeau");
    if (vieux) vieux.remove();
    const bandeau = el("div", {id: "wpx-ds-bandeau", "data-wpx": "", role: "status",
        style: "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483646;max-width:min(92vw,640px);" +
               "padding:12px 18px;border-radius:10px;background:#1e1f22;color:#f2f3f5;border:1px solid #5865f2;" +
               "box-shadow:0 8px 30px rgba(0,0,0,.45);font:600 14px/1.45 system-ui,sans-serif;text-align:center"}, texte);
    D.body.append(bandeau);
    setTimeout(() => bandeau.remove(), 14000);
}

/* au chargement, dès que le pseudo s'affiche (une minute au plus) : le lien du sas s'il vient d'être ouvert, la liste
   de souhaits et l'historique des achats relus s'ils datent, puis la file vidée */
function demarrerDiscord() {
    lireLienDiscord();
    nommerServeurs();                            // remplit tout seul les noms de serveurs restés « Serveur Discord »
    if (!reglagesDiscord().actif) return;
    try { localStorage.removeItem("wpx.discord.achats"); } catch (erreur) { /* la clé commune de la 12.1 */ }
    let essais = 0;
    const lancer = () => {
        if (!pseudoJoueur() && ++essais < 30) return void setTimeout(lancer, 2000);     // le site affiche le pseudo
        envoyerLien();
        const etat = memoire.lire("discord.souhaits", null);
        if (!etat || etat.connue !== true || Date.now() - (etat.lue || 0) > CONFIG.DISCORD.souhaitsH * 3600e3) lireSouhaits().then(() => envoyerSouhaits());
        else envoyerSouhaits();
        relireAchatsSiVieux();
        pousserDiscord();
    };
    setTimeout(lancer, 3000);
}

function installerIdentite(p) {
    const vue = $("#v-profile");
    if (!vue) return;
    if (!PROFIL.ancre) {
        PROFIL.barre = el("div", {id: "wpx-ident", class: "wpx-verre", role: "region", "aria-label": "Profil"});
        PROFIL.ancre = el("div", {id: "wpx-ident-ancre", "data-wpx": ""}, PROFIL.barre);
        PROFIL.barre.addEventListener("click", clicIdentite, true);
        new ResizeObserver(() => {
            const h = PROFIL.barre.offsetHeight;
            if (h === PROFIL.hauteur) return;
            PROFIL.hauteur = h;
            HTML.style.setProperty("--wpx-ident-h", h + "px");
        }).observe(PROFIL.barre);
    }
    if (PROFIL.ancre.parentNode !== vue) vue.prepend(PROFIL.ancre);
    const livres = livresDuProfil();
    const signature = p.tete.outerHTML + "¤" + (p.stats ? p.stats.textContent : "") + "¤" + livres.map(l => l.id + ":" + l.nom).join("|");
    if (signature === PROFIL.signature) return;
    PROFIL.signature = signature;
    remplirIdentite(p, livres);
}

function remonterAuProfil() {
    const boite = $("#profile");
    if (!boite) return;
    const y = boite.getBoundingClientRect().top + scrollY - hauteurEntete - 14;
    scrollTo({top: Math.max(0, y), behavior: "smooth"});
}

/* la hauteur de la barre compacte sans sa rangée d'albums (dépliée ou non) */
function hauteurBaseIdentite() {
    const barre = PROFIL.barre;
    if (!barre) return 0;
    const haut = barre.getBoundingClientRect().top;
    const bas = Math.max(0, ...$$(":scope > .wpx-id-av, :scope > .wpx-id-l1, :scope > .wpx-id-l2", barre)
        .filter(e => e.getClientRects().length).map(e => e.getBoundingClientRect().bottom - haut));
    return Math.round(bas + 7);                 // le bas de la barre : sa marge intérieure et son bord
}

/* « Albums » : la page remonte au bloc des livres, posé juste sous la barre compacte (sa rangée d'albums se replie en
   chemin) ; recalé une fois arrivé, comme pour une étiquette */
function remonterAuxAlbums() {
    const ecart = () => {
        const bloc = $("#pfAlbums");
        return bloc ? bloc.getBoundingClientRect().top - (hauteurEntete + 6 + hauteurBaseIdentite()) - 10 : 0;
    };
    scrollTo({top: Math.max(0, scrollY + ecart()), behavior: "smooth"});
    quandDefilementFini(() => {
        if (Math.abs(ecart()) > 3) scrollTo({top: Math.max(0, scrollY + ecart()), behavior: "auto"});
    });
}

/* Un clic dans la barre compacte est transmis au vrai bouton du site */
function clicIdentite(e) {
    const cible = e.target.closest("button, a, summary, [data-wpx-action]");
    e.stopPropagation();                         // le site ne voit jamais les copies
    if (!cible || cible.tagName === "SUMMARY") return;
    const original = PROFIL.liens.get(cible);
    e.preventDefault();
    if (original) {
        fermerMenus();
        if (!original.isConnected) return;
        original.click();
        const remonter = CONFIG.PROFIL.remonterPour.some(s => selecteurValide(s) && original.matches(s));
        if (remonter) requestAnimationFrame(() => requestAnimationFrame(remonterAuProfil));
    } else if (cible.dataset.wpxAction === "haut") {
        remonterAuProfil();
    } else if (cible.dataset.wpxAction === "albums") {
        remonterAuxAlbums();
    } else if (cible.dataset.wpxLivre) {
        const livre = $('#pfAlbums [data-pfaouvre="' + CSS.escape(cible.dataset.wpxLivre) + '"]');
        if (livre) livre.click();
    }
}

function fermerMenus(sauf) {
    $$(".wpx-menu[open]").forEach(m => {
        if (m !== sauf) m.open = false;
    });
}

/* hauteur de la partie fixe quand tout est collé : menu, barre compacte, en-tête « Étiquettes » */
function decalageProfil() {
    const entete = $("#pvbloc > .vhead");
    return hauteurEntete + 6 + PROFIL.hauteur + (entete ? entete.offsetHeight : 0);
}

/* Le bandeau « Collection » du profil (titre, recherche), suivi de la rangée des raretés et du tri */
const bandeauCollection = () => $("#profile > .vhead");
const triCollection = () => $("#profile > #pctri");

/* le bandeau Collection a atteint sa place, sous l'en-tête des vitrines : on lit la collection */
function dansCollection() {
    const bandeau = bandeauCollection();
    return !!bandeau && bandeau.getBoundingClientRect().top <= decalageProfil() + 1;
}

/* De combien faire défiler pour arriver au début de la collection : sur ordinateur, le bandeau et le tri
   collés sous l'en-tête des vitrines, et les cartes juste dessous. */
function ecartCollection() {
    const bandeau = bandeauCollection();
    if (!bandeau) return 0;
    const haut = decalageProfil();
    const tri = triCollection();
    let suite = (tri || bandeau).nextElementSibling;
    while (suite && !suite.getClientRects().length) suite = suite.nextElementSibling;      // (la grille du site est cachée pendant les doublons)
    if (getComputedStyle(bandeau).position !== "sticky" || !suite) return bandeau.getBoundingClientRect().top - haut;
    return suite.getBoundingClientRect().top - (haut + bandeau.offsetHeight + (tri ? tri.offsetHeight : 0) + 8);
}

const GRAND_ECRAN = matchMedia("(min-width: 701px)");

/* La barre d'étiquettes (ou de vitrines) dans l'en-tête « Étiquettes » du site. Cet en-tête est
   redessiné à chaque changement d'onglet : la barre y est reposée aussitôt, avant l'affichage. */
function installerAlbumsProfil(p) {
    const entete = p.bloc && $(":scope > .vhead", p.bloc);
    if (!entete) return;
    if (!PROFIL.albums) PROFIL.albums = creerBarreAlbums({decalage: decalageProfil, dansCollection, ecartCollection});
    const barre = PROFIL.albums;
    if (barre.racine.parentNode !== entete) {
        barre.fermerPano();
        entete.append(barre.racine);
    }
    barre.lierSite($(".pvseg", entete));
    const onglet = $(".pvseg button.on", entete);
    const vue = onglet ? onglet.dataset.pvue : "";
    const pseudo = pseudoDuProfil(p);
    const items = vue === "albums" ? lireAlbums(p.bloc) : vue === "vitrines" ? lireVitrines(p.bloc) : [];
    const collection = bandeauCollection() ? {compte: totalCollection(p, pseudo)} : null;
    barre.maj({type: vue, items, collection, cle: "profil:" + pseudo + ":" + vue, proprietaire: pseudo, titre: "Étiquettes de " + pseudo});
}

/* le total de la collection : une rareté, une recherche ou « souhaitées » le réduisent ; on garde alors le dernier
   total entier lu pour ce joueur (rien tant qu'on n'en a pas lu) */
function totalCollection(p, pseudo) {
    const total = $("#pcTotal", p.boite);
    const texte = total ? total.textContent : "";
    const recherche = $("#pcq", p.boite);
    const filtre = !/différente/.test(texte) || !!$("#pcrar .on", p.boite) || !!(recherche && recherche.value.trim());
    const n = lireNombre(texte.match(/(\d[\d\s.\u00a0\u202f]*)/));
    if (!filtre && n != null) PROFIL.compte = {pseudo, n};
    return PROFIL.compte && PROFIL.compte.pseudo === pseudo ? PROFIL.compte.n : null;
}

function rafraichirProfil(actif) {
    const p = actif && CONFIG.PROFIL.fixe ? lireProfil() : null;
    HTML.classList.toggle("wpx-profil-fixe", !!p);
    if (!p) {
        HTML.classList.remove("wpx-ident-on", "wpx-ident-livres", "wpx-dock", "wpx-dock-col", "wpx-dock-tri");
        return;
    }
    installerAlbumsProfil(p);
    installerLiensProfil(p);
    installerIdentite(p);
}

function suivreProfil() {
    if (!HTML.classList.contains("wpx-profil-fixe")) return;
    const tete = $(TETE_PROFIL);
    const visible = !!tete && tete.getBoundingClientRect().top < hauteurEntete - 2;
    HTML.classList.toggle("wpx-ident-on", visible);
    /* la rangée des albums se déplie une fois leur bloc passé sous la barre (mesurée sans elle : rien ne clignote) */
    const livres = $("#pfAlbums");
    HTML.classList.toggle("wpx-ident-livres", visible && !!livres && !!$(".wpx-id-l3", PROFIL.barre)
        && livres.getBoundingClientRect().bottom <= hauteurEntete + 6 + hauteurBaseIdentite());
    const entete = $("#pvbloc > .vhead");
    let colle = false;
    if (entete) {
        const seuil = hauteurEntete + 6 + PROFIL.hauteur;
        colle = visible && entete.getBoundingClientRect().top <= seuil + 1;
        entete.classList.toggle("wpx-colle", colle);
        definirVariable("--wpx-vb-h", entete.offsetHeight);
    }
    /* collés l'un à l'autre, la barre compacte et l'en-tête « Étiquettes » ne forment qu'un bloc */
    HTML.classList.toggle("wpx-dock", colle);

    /* plus bas, le bandeau Collection et ses filtres viennent se coller sous l'en-tête des vitrines */
    const bandeau = bandeauCollection();
    const tri = triCollection();
    let bandeauColle = false;
    let triColle = false;
    if (bandeau && GRAND_ECRAN.matches) {
        const haut = decalageProfil();
        bandeauColle = colle && bandeau.getBoundingClientRect().top <= haut + 1;
        definirVariable("--wpx-cv-h", bandeau.offsetHeight);
        triColle = !!tri && bandeauColle && tri.getBoundingClientRect().top <= haut + bandeau.offsetHeight + 1;
    }
    if (bandeau) bandeau.classList.toggle("wpx-colle", bandeauColle);
    if (tri) tri.classList.toggle("wpx-colle", triColle);
    HTML.classList.toggle("wpx-dock-col", bandeauColle);
    HTML.classList.toggle("wpx-dock-tri", triColle);
    if (PROFIL.albums) PROFIL.albums.suivre();
}

/* ==========================================================================
   « MES ÉTIQUETTES » (Collection > Étiquettes) : la même barre, fixée sous le menu
   ========================================================================== */
const COLL = {zone: null, titre: null, barre: null};

function monPseudo() {
    const av = $("#meBtn .av");
    return propre((av && av.dataset.n) || ($("#meBtn > span:last-child") || {}).textContent) || "moi";
}

function rafraichirCollection(actif) {
    const onglets = $("#ctabs");
    const surAlbum = actif && onglets && $('button[data-c="album"].on', onglets);
    const grille = $("#cg");
    const items = surAlbum && grille ? lireAlbums(grille) : [];
    if (!COLL.zone) {
        if (!items.length) return;
        COLL.titre = el("div", {class: "wpx-titre"});
        COLL.barre = creerBarreAlbums({decalage: () => hauteurEntete + 6 + (VARIABLES["--wpx-ctabs-h"] || 0) + COLL.zone.offsetHeight});
        COLL.zone = el("div", {id: "wpx-coll", class: "wpx-verre", "data-wpx": ""}, COLL.titre, COLL.barre.racine);
    }
    if (onglets && COLL.zone.previousElementSibling !== onglets) onglets.after(COLL.zone);
    COLL.zone.hidden = !items.length;
    const titre = T.mesAlbums + "¤" + items.length;
    if (items.length && COLL.titre.dataset.sig !== titre) {
        COLL.titre.dataset.sig = titre;
        COLL.titre.replaceChildren(T.mesAlbums, el("small", null, nombre(items.length)));
    }
    COLL.barre.maj({type: "albums", items, cle: "collection", proprietaire: monPseudo(), titre: T.mesAlbums});
}

/* ==========================================================================
   MA COLLECTION ET TOUTES LES CARTES : LES EN-TÊTES COLLÉS (COLLECTION.fixe)
   Chaque pile, de haut en bas : [sélecteur, variable CSS de sa hauteur (pour placer le suivant), fixé seulement avec le
   réglage]. « Mes étiquettes » se colle toujours ; avec le réglage, sous les onglets. À chaque défilement : qui est collé
   (son fond de verre), et qui s'amarre à son voisin du dessous, collé lui aussi.
   ========================================================================== */
const PILES = [
    [["#v-coll > #ctabs", "--wpx-ctabs-h", true], ["#wpx-coll", "--wpx-ccoll-h", false], ["#v-coll > #cTools", null, true]],
    [["#v-explore > .tools", "--wpx-eoutils-h", true], ["#v-explore > #er", null, true]]
];

function suivreCollection() {
    const fixe = CONFIG.COLLECTION.fixe && BUREAU.matches;
    for (const pile of PILES) {
        let haut = hauteurEntete + 6;
        const etats = [];
        for (const [selecteur, variable, reglable] of pile) {
            const e = $(selecteur);
            const montre = !!e && (fixe || !reglable) && e.getClientRects().length > 0;      // (une page cachée : rien)
            const h = montre ? e.offsetHeight : 0;
            if (variable) definirVariable(variable, h);
            if (!e) continue;
            etats.push({e, montre, colle: montre && e.getBoundingClientRect().top <= haut + 1});
            haut += h;
        }
        etats.forEach((x, i) => {
            const dessous = etats.slice(i + 1).find(y => y.montre);
            x.e.classList.toggle("wpx-colle", x.colle);
            x.e.classList.toggle("wpx-amarre", x.colle && !!dessous && dessous.colle);
        });
    }
}

/* ==========================================================================
   EXPORT DES ÉTIQUETTES ET EXTRACTION DES CARTES
   Un tiroir à droite : choix des étiquettes, ordre, options, puis les messages
   Discord prêts à copier un par un (chacun sous la limite de caractères).
   ========================================================================== */
const EXP = {
    racine: null,
    z: null,
    ouvert: false,
    mode: memoire.lire("export.mode", "liste") === "cartes" ? "cartes" : "liste",
    source: null,
    cle: "",
    selections: new Map(),
    recherche: "",
    tri: memoire.lire("export.tri", "page"),
    options: Object.assign({descriptions: true, gras: true, unParMessage: false}, memoire.lire("export.options", {})),
    visibles: [],
    dernier: -1,
    parties: [],
    texte: "",
    affichees: 0,
    signature: ""
};

function selectionCourante() {
    if (!EXP.selections.has(EXP.cle)) {
        /* à la première ouverture, toutes les étiquettes sont cochées */
        EXP.selections.set(EXP.cle, new Set(EXP.source.contexte().items.map(i => i.cle)));
    }
    return EXP.selections.get(EXP.cle);
}

function trierAlbums(items) {
    const copie = items.slice();
    const parNom = (a, b) => a.nom.localeCompare(b.nom, "fr", {sensitivity: "base", numeric: true});
    if (EXP.tri === "nom") copie.sort(parNom);
    else if (EXP.tri === "croissant") copie.sort((a, b) => a.compte - b.compte || parNom(a, b));
    else if (EXP.tri === "decroissant") copie.sort((a, b) => b.compte - a.compte || parNom(a, b));
    else copie.sort((a, b) => a.ordre - b.ordre);
    return copie;
}

function caseOption(cle, libelle, aide) {
    const coche = el("input", {type: "checkbox"});
    coche.checked = !!EXP.options[cle];
    coche.addEventListener("change", () => {
        EXP.options[cle] = coche.checked;
        memoire.ecrire("export.options", EXP.options);
        regenererBientot();
    });
    return el("label", {title: aide}, coche, libelle);
}

function construireTiroir() {
    if (EXP.racine) return;
    const z = {};
    z.titre = el("b", {id: "wpx-t-titre"});
    z.sousTitre = el("small");
    z.fermer = el("button", {type: "button", class: "wpx-x", title: "Fermer (Échap)", "aria-label": "Fermer"}, "✕");
    z.modeListe = el("button", {type: "button", "data-mode": "liste"}, icone("liste"), T.exporterAlbums);
    z.modeCartes = el("button", {type: "button", "data-mode": "cartes"}, icone("cartes"), T.extraireCartes);
    z.recherche = el("input", {type: "search", class: "wpx-champ", placeholder: T.chercherAlbum, autocomplete: "off", spellcheck: "false"});
    z.tri = el("select", {class: "wpx-champ", title: "Ordre des étiquettes dans l'export"},
        el("option", {value: "page"}, "Ordre de la page"),
        el("option", {value: "nom"}, "Nom de l'étiquette"),
        el("option", {value: "croissant"}, "Nombre de cartes : croissant"),
        el("option", {value: "decroissant"}, "Nombre de cartes : décroissant"));
    z.tri.value = EXP.tri;
    z.tous = el("button", {type: "button", class: "wpx-lien"}, "Tout cocher");
    z.aucun = el("button", {type: "button", class: "wpx-lien"}, "Tout décocher");
    z.affiche = el("button", {type: "button", class: "wpx-lien", title: "Seulement l'étiquette en cours de lecture"}, "Étiquette affichée");
    z.compte = el("span", {class: "wpx-t-compte"});
    z.liste = el("div", {class: "wpx-t-liste", role: "listbox", "aria-multiselectable": "true", "aria-label": "Étiquettes à exporter"});
    z.options = el("div", {class: "wpx-t-options"},
        caseOption("descriptions", "Descriptions", "Ajouter la description sous le nom de chaque carte"),
        caseOption("gras", "Noms en gras (" + CONFIG.EXPORT.marqueCarte + ")", "Entourer le nom des cartes pour l'afficher en gras sur Discord"),
        caseOption("unParMessage", "Une étiquette par message", "Commencer chaque étiquette dans un nouveau message"));
    z.res = el("div", {class: "wpx-t-res", "aria-live": "polite"});

    const racine = el("aside", {id: "wpx-tiroir", "data-wpx": "", role: "dialog", "aria-labelledby": "wpx-t-titre"},
        el("header", {class: "wpx-t-tete"}, el("div", null, z.titre, z.sousTitre), z.fermer),
        el("div", {class: "wpx-seg", role: "group", "aria-label": "Type d'export"}, z.modeListe, z.modeCartes),
        el("section", {class: "wpx-t-choix"},
            el("div", {class: "wpx-t-outils"}, z.recherche, z.tri),
            el("div", {class: "wpx-t-raccourcis"}, z.tous, z.aucun, z.affiche, z.compte),
            z.liste),
        z.options,
        z.res);
    D.body.append(racine);
    EXP.racine = racine;
    EXP.z = z;

    z.fermer.addEventListener("click", fermerExport);
    [z.modeListe, z.modeCartes].forEach(b => b.addEventListener("click", () => {
        EXP.mode = b.dataset.mode;
        memoire.ecrire("export.mode", EXP.mode);
        majTiroir();
        regenerer();
    }));
    z.recherche.addEventListener("input", () => {
        EXP.recherche = z.recherche.value;
        EXP.dernier = -1;
        rendreListe();
    });
    z.tri.addEventListener("change", () => {
        EXP.tri = z.tri.value;
        memoire.ecrire("export.tri", EXP.tri);
        EXP.dernier = -1;
        rendreListe();
        regenererBientot();
    });
    z.tous.addEventListener("click", () => changerSelection(() => true));
    z.aucun.addEventListener("click", () => changerSelection(() => false));
    z.affiche.addEventListener("click", () => {
        const items = EXP.source.contexte().items;
        const enCours = items[EXP.source.actif()];
        changerSelection(item => !!enCours && item.cle === enCours.cle, true);
    });
    z.liste.addEventListener("click", clicListe);
    z.liste.addEventListener("keydown", e => {
        if ((e.key === " " || e.key === "Enter") && e.target.classList.contains("wpx-t-ligne")) {
            e.preventDefault();
            e.target.click();
        }
    });
}

/* tous = true : toute la liste ; sinon, seulement les étiquettes affichées par la recherche */
function changerSelection(test, tous) {
    const selection = selectionCourante();
    const items = tous ? EXP.source.contexte().items : EXP.visibles;
    for (const item of items) {
        if (test(item)) selection.add(item.cle);
        else selection.delete(item.cle);
    }
    majCoches();
    regenererBientot();
}

function clicListe(e) {
    const ligne = e.target.closest(".wpx-t-ligne");
    if (!ligne) return;
    const k = +ligne.dataset.k;
    const item = EXP.visibles[k];
    if (!item) return;
    if (e.target.closest(".wpx-t-aller")) {
        const index = EXP.source.contexte().items.indexOf(item);
        if (index >= 0) EXP.source.allerA(index);
        return;
    }
    const selection = selectionCourante();
    const coche = !selection.has(item.cle);
    /* Maj + clic : coche ou décoche toute la plage depuis le dernier clic */
    const debut = e.shiftKey && EXP.dernier >= 0 ? Math.min(EXP.dernier, k) : k;
    const fin = e.shiftKey && EXP.dernier >= 0 ? Math.max(EXP.dernier, k) : k;
    for (let i = debut; i <= fin; i++) {
        if (coche) selection.add(EXP.visibles[i].cle);
        else selection.delete(EXP.visibles[i].cle);
    }
    EXP.dernier = k;
    majCoches();
    regenererBientot();
}

function rendreListe() {
    if (!EXP.racine) return;
    const filtre = pourRecherche(EXP.recherche);
    const items = trierAlbums(EXP.source.contexte().items).filter(item => !filtre || pourRecherche(item.nom).includes(filtre));
    EXP.visibles = items;
    const lignes = items.map((item, k) => {
        const partiel = item.montrees < item.compte;
        const ligne = el("div", {class: "wpx-t-ligne", role: "option", tabindex: "0", "data-k": k},
            el("input", {type: "checkbox", tabindex: "-1", "aria-hidden": "true"}),
            el("i"),
            el("span", {title: item.nom}, item.nom),
            el("small", {class: partiel ? "wpx-partiel" : null,
                title: partiel ? "Le profil n'affiche que " + nombre(item.montrees) + " cartes sur " + nombre(item.compte) : pluriel(item.compte, "carte")},
            partiel ? nombre(item.montrees) + " / " + nombre(item.compte) : nombre(item.compte)),
            el("button", {type: "button", class: "wpx-t-aller", title: "Aller à l'étiquette", "aria-label": "Aller à l'étiquette"}, icone("aller")));
        ligne.children[1].style.setProperty("--c", item.couleur);
        return ligne;
    });
    EXP.z.liste.replaceChildren(...(lignes.length ? lignes : [el("div", {class: "wpx-vide"}, T.aucunResultat)]));
    majCoches();
}

function majCoches() {
    const selection = selectionCourante();
    for (const ligne of EXP.z.liste.children) {
        const item = EXP.visibles[+ligne.dataset.k];
        if (!item) continue;
        const coche = selection.has(item.cle);
        ligne.firstChild.checked = coche;
        ligne.setAttribute("aria-selected", String(coche));
    }
    const items = EXP.source.contexte().items;
    const choisis = items.filter(item => selection.has(item.cle));
    const cartes = choisis.reduce((somme, item) => somme + item.compte, 0);
    EXP.z.compte.textContent = nombre(choisis.length) + " / " + pluriel(items.length, "étiquette") + " · " + pluriel(cartes, "carte");
}

function majTiroir() {
    const z = EXP.z;
    const ctx = EXP.source.contexte();
    z.titre.textContent = EXP.mode === "cartes" ? T.extraireCartes : T.exporterAlbums;
    z.sousTitre.textContent = ctx.titre + " · " + pluriel(ctx.items.length, "étiquette");
    z.modeListe.setAttribute("aria-pressed", String(EXP.mode === "liste"));
    z.modeCartes.setAttribute("aria-pressed", String(EXP.mode === "cartes"));
    z.options.hidden = EXP.mode !== "cartes";
}

function ouvrirExport(barre, mode) {
    construireTiroir();
    const ctx = barre.contexte();
    if (EXP.cle !== ctx.cle) {
        EXP.recherche = "";
        EXP.z.recherche.value = "";
    }
    EXP.source = barre;
    EXP.cle = ctx.cle;
    EXP.mode = mode;
    EXP.dernier = -1;
    EXP.signature = ctx.items.map(i => i.cle + "·" + i.compte).join("¤");
    EXP.ouvert = true;
    EXP.racine.classList.add("wpx-ouvert");
    majTiroir();
    rendreListe();
    regenerer();
    EXP.z.fermer.focus({preventScroll: true});
}

function fermerExport() {
    if (!EXP.ouvert) return;
    EXP.ouvert = false;
    EXP.racine.classList.remove("wpx-ouvert");
}

/* Le tiroir suit la page : il se ferme si on la quitte, et se met à jour si les étiquettes changent */
function suivreExport() {
    if (!EXP.ouvert) return;
    const barre = EXP.source;
    /* offsetParent est nul quand la barre n'est plus affichée (autre page, autre onglet) */
    if (!barre || !barre.racine.offsetParent || barre.contexte().cle !== EXP.cle) {
        fermerExport();
        return;
    }
    const signature = barre.contexte().items.map(i => i.cle + "·" + i.compte).join("¤");
    if (signature === EXP.signature) return;
    EXP.signature = signature;
    majTiroir();
    rendreListe();
    regenererBientot();
}

/* Le texte à exporter, en « unités » : une ligne d'étiquette, un titre d'étiquette (type "album"), ou une carte.
   Chaque unité porte le séparateur qui la précède. */
function genererUnites() {
    const ctx = EXP.source.contexte();
    const selection = selectionCourante();
    const albums = trierAlbums(ctx.items.filter(item => selection.has(item.cle)));
    const resultat = {unites: [], albums: albums.length, cartes: 0, partiels: []};
    if (EXP.mode === "liste") {
        resultat.unites = albums.map(item => ({texte: item.nom + " (" + item.compte + ")", avant: "\n", type: "ligne"}));
        return resultat;
    }
    const marque = EXP.options.gras ? CONFIG.EXPORT.marqueCarte : "";
    for (const item of albums) {
        const cartes = cartesDeLAlbum(item);
        if (!cartes.length) continue;
        if (cartes.length < item.compte) resultat.partiels.push(item);
        /* (v11 : chaque titre d'étiquette précède ses propres cartes ; la v10.9 les remontait tous en tête) */
        resultat.unites.push({texte: item.nom + " (" + cartes.length + ")", avant: "\n\n", type: "album"});
        for (const carte of cartes) {
            let texte = marque + carte.nom + marque;
            if (EXP.options.descriptions && carte.description) texte += "\n" + carte.description;
            resultat.unites.push({texte, avant: "\n\n", type: "carte"});
        }
        resultat.cartes += cartes.length;
    }
    return resultat;
}

function assembler(unites) {
    return unites.map((u, i) => (i ? u.avant : "") + u.texte).join("");
}

/*
 * Découpe en messages Discord d'au plus `limite` caractères, sans jamais couper une carte.
 * Un titre d'étiquette ne reste pas seul en bas d'un message : il passe avec sa première carte.
 * albumParMessage : chaque étiquette commence un nouveau message.
 */
function decouperPourDiscord(unites, limite, albumParMessage) {
    const morceaux = [];
    for (const u of unites) {
        if (u.texte.length <= limite) {
            morceaux.push(u);
            continue;
        }
        for (let k = 0; k < u.texte.length; k += limite) {
            morceaux.push({texte: u.texte.slice(k, k + limite), avant: k ? "" : u.avant, type: k ? "suite" : u.type});
        }
    }
    const parties = [];
    let courante = [];
    let longueur = 0;
    const fermer = () => {
        if (courante.length) parties.push(courante);
        courante = [];
        longueur = 0;
    };
    for (const u of morceaux) {
        const ajout = (courante.length ? u.avant.length : 0) + u.texte.length;
        const nouvelAlbum = albumParMessage && u.type === "album";
        if (courante.length && (longueur + ajout > limite || nouvelAlbum)) {
            const dernier = courante[courante.length - 1];
            const garder = !nouvelAlbum && dernier.type === "album" && courante.length > 1 && u.type !== "album"
                && dernier.texte.length + u.avant.length + u.texte.length <= limite;
            if (garder) {
                courante.pop();
                fermer();
                courante.push(dernier);
                longueur = dernier.texte.length;
            } else {
                fermer();
            }
        }
        longueur += (courante.length ? u.avant.length : 0) + u.texte.length;
        courante.push(u);
    }
    fermer();
    return parties.map(assembler);
}

function boutonCopie(libelle, texte, bloc) {
    const bouton = el("button", {type: "button", class: "wpx-btn"}, icone("copier"), el("span", null, libelle));
    bouton.addEventListener("click", async () => {
        const ok = await copierTexte(typeof texte === "function" ? texte() : texte);
        bouton.classList.toggle("wpx-ok", ok);
        bouton.lastChild.textContent = ok ? T.copie : T.echecCopie;
        if (bloc && ok) bloc.classList.add("wpx-copie");
    });
    return bouton;
}

function blocMessage(texte, index, total) {
    const bloc = el("article", {class: "wpx-msg"});
    bloc.append(
        el("header", null, el("b", null, "Message " + (index + 1)), " / " + total + " · " + nombre(texte.length) + " car.", boutonCopie(T.copier, texte, bloc)),
        el("pre", null, texte));
    return bloc;
}

function afficherMessages() {
    const zone = EXP.z.res.querySelector(".wpx-msgs");
    const plus = EXP.z.res.querySelector(".wpx-plus");
    const fin = Math.min(EXP.parties.length, EXP.affichees + CONFIG.EXPORT.messagesAffiches);
    for (let i = EXP.affichees; i < fin; i++) zone.append(blocMessage(EXP.parties[i], i, EXP.parties.length));
    EXP.affichees = fin;
    const reste = EXP.parties.length - fin;
    plus.hidden = reste <= 0;
    plus.lastChild.textContent = "Afficher " + (reste > CONFIG.EXPORT.messagesAffiches ? "les " + CONFIG.EXPORT.messagesAffiches + " messages suivants" : reste > 1 ? "les " + reste + " derniers messages" : "le dernier message");
}

function regenerer() {
    if (!EXP.ouvert) return;
    const zone = EXP.z.res;
    const gen = genererUnites();
    EXP.parties = [];
    EXP.texte = "";
    EXP.affichees = 0;
    if (!gen.unites.length) {
        zone.replaceChildren(el("div", {class: "wpx-vide"}, gen.albums ? T.aucuneCarte : T.aucuneSelection));
        return;
    }
    EXP.texte = assembler(gen.unites);
    EXP.parties = decouperPourDiscord(gen.unites, CONFIG.EXPORT.limiteDiscord, EXP.mode === "cartes" && EXP.options.unParMessage);
    const ctx = EXP.source.contexte();
    const nomFichier = nomDeFichier("wikipick", EXP.mode === "cartes" ? "cartes" : "etiquettes", ctx.proprietaire) + "_" + dateDuJour() + ".txt";
    const telechargement = el("button", {type: "button", class: "wpx-btn", title: nomFichier}, icone("telecharger"), el("span", null, T.telecharger));
    telechargement.addEventListener("click", () => telecharger(nomFichier, EXP.texte));
    const resume = el("p", null,
        el("b", null, pluriel(EXP.parties.length, "message")), " Discord · ",
        pluriel(gen.albums, "étiquette"),
        gen.cartes ? " · " + pluriel(gen.cartes, "carte") : "",
        " · " + pluriel(EXP.texte.length, "caractère"));
    const plus = el("button", {type: "button", class: "wpx-btn wpx-plus", hidden: true}, el("span"));
    plus.addEventListener("click", afficherMessages);
    const blocs = [el("div", {class: "wpx-t-resume"}, resume, boutonCopie(T.toutCopier, () => EXP.texte), telechargement)];
    if (gen.partiels.length) {
        blocs.push(el("p", {class: "wpx-t-avert"},
            "Sur un profil, le site n'affiche qu'une partie des cartes de certaines étiquettes : " +
            gen.partiels.slice(0, 4).map(i => "« " + i.nom + " » (" + nombre(i.montrees) + " sur " + nombre(i.compte) + ")").join(", ") +
            (gen.partiels.length > 4 ? " et " + (gen.partiels.length - 4) + " autres" : "") +
            ". L'extraction ne contient que les cartes affichées."));
    }
    blocs.push(el("div", {class: "wpx-msgs"}), plus);
    zone.replaceChildren(...blocs);
    zone.scrollTop = 0;
    afficherMessages();
}
const regenererBientot = regrouper(regenerer, 120);

/* ==========================================================================
   LIVRES (les albums reliés du 25/10/2026, page Albums)
   Dans la barre du livre ouvert : « Toutes les pages », la vue d'ensemble de ses pages (leur nom, leurs
   premières cartes, les pages blanches) pour sauter d'un clic à l'une d'elles (le sommaire du site n'en
   liste que vingt) ; « Page vide suivante » (dans ses propres livres) ; « Copier le lien », un lien qui ouvre
   ce livre à la page affichée (…/albums/<joueur>#livre-12-page-5), pour un ami qui a l'outil ; et le rappel
   des raccourcis clavier. Touches en plus de celles du site : G (toutes les pages), N (la page vide
   suivante), Début (la couverture), Fin (la fin du livre), ? (le rappel).
   Le livre vit dans la page (ALBM, albAllerPage, livreAller…) : un petit relais, déposé dans la page comme
   celui des paquets, lit ses pages et le fait tourner, par des événements. Rien ne part nulle part.
   ========================================================================== */
const LIVRE = {vue: null, z: null, aide: null, donnees: null, tuiles: []};
const TOUCHES_LIVRE = [
    ["← →", "tourner la page"],
    ["Molette", "tourner la page"],
    ["Clic dans la marge", "page précédente ou suivante"],
    ["Tirer une page", "la tourner à la main"],
    ["Échap", "revenir à l'étagère"],
    ["G", "toutes les pages", true],
    ["N", "la page vide suivante", true],
    ["Début", "la couverture", true],
    ["Fin", "la fin du livre", true],
    ["?", "ce rappel", true]
];

/* Exécutée dans la page elle-même (le script l'y dépose) : elle répond aux deux demandes du script, sans rien changer
   d'autre. Les pages partent en texte (JSON) : le script ne touche jamais aux objets du site. */
function pontLivre() {
    if (window.__wpxPontLivre) return;
    window.__wpxPontLivre = true;
    const livre = () => (typeof ALBM !== "undefined" && ALBM && ALBM.d && Array.isArray(ALBM.d.pages) ? ALBM : null);
    document.addEventListener("wpx-livre-demande", () => {
        let donnees = null;
        try {
            const A = livre();
            if (A) {
                const d = A.d;
                const carte = id => (id && d.cartes && d.cartes[String(id)]) || null;
                const cartesDe = p => (typeof albCartesDe === "function" ? albCartesDe(p) : (p.cases || []).map(carte)).filter(Boolean);
                donnees = {
                    id: d.id | 0, lecture: !!d.lecture,
                    proprietaire: String(d.nom_joueur || (typeof ME !== "undefined" && ME && ME.name) || ""),
                    nom: String(d.nom || ""), tel: !!A.tel, t: A.t | 0, p: A.p | 0,
                    feuilles: typeof nbFeuilles === "function" ? nbFeuilles() : Math.ceil(d.pages.length / 2) + 2,
                    pages: d.pages.map((p, i) => {
                        const cartes = cartesDe(p);
                        return {
                            nom: String(typeof albNomPage === "function" ? albNomPage(i) : p.titre || "Page " + (i + 1)),
                            titre: String(p.titre || ""),
                            ecrite: typeof albEcrite === "function" ? !!albEcrite(p) : !!(p.titre || p.texte || cartes.length),
                            extrait: cartes.length ? "" : String(p.texte || "").slice(0, 160),
                            noms: cartes.map(c => String(c.n || "")),
                            vues: cartes.slice(0, 4).map(c => ({n: String(c.n || ""), img: String(c.img || ""), r: String(c.r || "C"), sh: !!c.sh, hw: !!c.hw}))
                        };
                    })
                };
            }
        } catch (erreur) {
            donnees = null;
        }
        document.dispatchEvent(new CustomEvent("wpx-livre-donnees", {detail: JSON.stringify(donnees)}));
    });
    document.addEventListener("wpx-livre-aller", e => {
        try {
            const A = livre();
            if (!A) return;
            const v = JSON.parse(e.detail || "{}"), n = A.d.pages.length;
            if (v.ou === "blanche") {
                /* la prochaine page vide après celles qu'on voit, en repartant du début s'il le faut (ses propres livres) */
                if (A.d.lecture) return;
                const ecrite = p => (typeof albEcrite === "function" ? !!albEcrite(p) : !!(p && (p.titre || p.texte)));
                const depart = A.tel ? Math.max(0, (A.p | 0) - 2) : (A.t | 0) >= 2 ? 2 * ((A.t | 0) - 2) + 2 : 0;
                for (let k = 0; k < n; k++) {
                    const i = (depart + k) % n;
                    if (!ecrite(A.d.pages[i])) {
                        if (typeof albAllerPage === "function") albAllerPage(i);
                        return;
                    }
                }
                if (typeof toast === "function") toast("Ce livre n'a plus de page vide.", "good");
            } else if (typeof v.page === "number") {
                if (typeof albAllerPage === "function") albAllerPage(Math.max(0, Math.min(n - 1, v.page | 0)));
            } else if (A.tel) {
                /* le téléphone, page à page : la couverture, la garde, le sommaire, les pages, puis la fin */
                if (typeof telAller === "function") telAller(v.ou === "couverture" ? 0 : v.ou === "sommaire" ? 2 : 3 + n);
            } else if (typeof livreAller === "function") {
                livreAller(v.ou === "couverture" ? 0 : v.ou === "sommaire" ? 1 : typeof nbFeuilles === "function" ? nbFeuilles() : Math.ceil(n / 2) + 2);
            }
        } catch (erreur) { /* le livre a changé entre-temps : rien à faire */ }
    });
    /* un lien vers une page (…/albums/<joueur>#livre-12-page-5) : le livre s'ouvre, puis la page. L'étagère peut être
       encore en chemin : le site ouvre alors lui-même le livre demandé dès qu'elle arrive (ALBM.aOuvrir, comme depuis
       un profil). On attend la fin de l'ouverture (elle s'arrête au sommaire) avant de tourner les pages. */
    document.addEventListener("wpx-livre-lien", e => {
        let v = {};
        try { v = JSON.parse(e.detail || "{}"); } catch (erreur) { return; }
        const id = v.livre | 0, page = v.page | 0, debut = Date.now();
        if (!(id > 0)) return;
        let demande = false;
        const etape = () => {
            try {
                if (Date.now() - debut > 20000) return;                                   // au bout de 20 s, on laisse faire
                if (typeof VIEW === "undefined" || VIEW !== "album" || typeof ALBM === "undefined" || typeof albOuvrir !== "function") {
                    return void setTimeout(etape, 250);
                }
                if (!ALBM.d || ALBM.d.id !== id) {
                    if (!demande) {
                        demande = true;
                        if (ALBM.etagere) albOuvrir(id);
                        else ALBM.aOuvrir = id;
                    } else if (ALBM.etagere && ALBM.aOuvrir === id) {                     // l'étagère est arrivée sans l'ouvrir
                        ALBM.aOuvrir = null;
                        albOuvrir(id);
                    }
                    return void setTimeout(etape, 250);
                }
                if ((ALBM.tel ? ALBM.p | 0 : ALBM.t | 0) < 1) return void setTimeout(etape, 250);
                if (page > 0 && typeof albAllerPage === "function") albAllerPage(Math.min(page, ALBM.d.pages.length) - 1);
            } catch (erreur) { /* le livre a changé entre-temps */ }
        };
        etape();
    });
    /* les petits messages de l'outil, dans les bulles du site */
    document.addEventListener("wpx-toast", e => {
        try {
            const v = JSON.parse(e.detail || "{}");
            if (typeof toast === "function") toast(String(v.texte || ""), v.ok === false ? "bad" : "good");
        } catch (erreur) { /* message illisible : rien */ }
    });
}

/* les deux relais déposés dans la page : le livre (ci-dessus) et les chances du site (CHANCES, plus bas) */
function installerRelais() {
    const script = D.createElement("script");
    script.textContent = "(" + pontLivre + ")();(" + pontSite + ")();";
    (D.head || D.documentElement).append(script);
    script.remove();
}

/* les pages du livre ouvert, lues par le relais (l'événement est synchrone) ; null si aucun livre n'est ouvert */
function lireLivre() {
    let donnees = null;
    const recevoir = e => {
        try { donnees = JSON.parse(e.detail); } catch (erreur) { donnees = null; }
    };
    D.addEventListener("wpx-livre-donnees", recevoir);
    D.dispatchEvent(new CustomEvent("wpx-livre-demande"));
    D.removeEventListener("wpx-livre-donnees", recevoir);
    return donnees && Array.isArray(donnees.pages) ? donnees : null;
}

/* {page: i} (la page i, comptée depuis 0) ou {ou: "couverture" | "sommaire" | "fin"} */
function allerDansLeLivre(destination) {
    D.dispatchEvent(new CustomEvent("wpx-livre-aller", {detail: JSON.stringify(destination)}));
}

const barreDuLivre = () => $("#album .alb2-livre > .livre-barre");

/* un petit message, dans les bulles du site */
function messageLivre(texte, ok) {
    D.dispatchEvent(new CustomEvent("wpx-toast", {detail: JSON.stringify({texte, ok: ok !== false})}));
}

/* la prochaine page vide (ses propres livres) : la touche N, le bouton de la barre, celui de la vue d'ensemble */
function pageVideSuivante() {
    fermerLivre();
    allerDansLeLivre({ou: "blanche"});
}

/* un lien qui ouvre ce livre à la page affichée (la page de gauche d'une double page), pour un ami qui a l'outil ;
   sans l'outil, il arrive sur l'étagère du joueur, comme avec le lien du site */
async function copierLienDuLivre() {
    const d = lireLivre();
    if (!d || !d.id) return;
    const ici = ouEstLeLivre(d);
    const page = ici.pages ? ici.pages[0] + 1 : 0;
    const lien = location.origin + "/albums" + (d.proprietaire ? "/" + encodeURIComponent(d.proprietaire) : "")
        + "#livre-" + d.id + (page ? "-page-" + page : "");
    const ok = await copierTexte(lien);
    messageLivre(!ok ? "Copie impossible : " + lien
        : page ? "Lien de la page " + page + " copié. Ton ami(e) doit avoir l'outil pour arriver directement sur cette page."
        : "Lien du livre copié.", ok);
}

/* Un lien reçu (…/albums/<joueur>#livre-12-page-5) : le relais ouvre ce livre à cette page. L'ancre est retirée de
   l'adresse aussitôt (le site garde la sienne). */
function ouvrirLienDeLivre() {
    const m = /^#livre-(\d+)(?:-page-(\d+))?$/.exec(location.hash || "");
    if (!m) return;
    D.dispatchEvent(new CustomEvent("wpx-livre-lien", {detail: JSON.stringify({livre: +m[1], page: +(m[2] || 0)})}));
    try {
        history.replaceState(history.state, "", location.pathname + location.search);
    } catch (erreur) { /* l'adresse garde son ancre : sans conséquence */ }
}

/* Les boutons, dans la barre du livre ouvert. Le site la redessine à chaque livre ouvert (et quand on passe du
   livre au téléphone) : ils sont reposés aussitôt (l'observateur passe avant l'affichage). « Page vide suivante »
   n'est que dans ses propres livres, avec sa touche écrite dessus. */
function installerLivre(actif) {
    const barre = actif ? barreDuLivre() : null;
    if (!barre) {
        fermerLivre();
        fermerAideLivre();
        return;
    }
    if (!barre.querySelector(":scope > .wpx-lv-outils")) {
        const d = lireLivre();
        const pages = el("button", {type: "button", class: "btn ghost sm wpx-lv-btn", title: T.livrePagesAide, "aria-haspopup": "dialog"},
            icone("pages"), el("span", {class: "wpx-lv-lib"}, T.livrePages));
        const vide = d && !d.lecture ? el("button", {type: "button", class: "btn ghost sm wpx-lv-btn wpx-lv-vide", title: T.livreVideAide + " (touche N)"},
            icone("pageVide"), el("span", {class: "wpx-lv-lib"}, T.livreVide), el("kbd", {class: "wpx-lv-touche", "aria-hidden": "true"}, "N")) : null;
        const lien = el("button", {type: "button", class: "btn ghost sm wpx-lv-btn wpx-lv-lien", title: T.livreLienAide, "aria-label": T.livreLien},
            icone("lien"));
        const touches = el("button", {type: "button", class: "btn ghost sm wpx-lv-btn wpx-lv-touches", title: T.livreRaccourcis + " (?)",
            "aria-label": T.livreRaccourcis, "aria-expanded": "false"}, icone("clavier"));
        pages.addEventListener("click", ouvrirLivre);
        if (vide) vide.addEventListener("click", pageVideSuivante);
        lien.addEventListener("click", copierLienDuLivre);
        touches.addEventListener("click", () => basculerAideLivre());
        const groupe = el("div", {class: "wpx-lv-outils", "data-wpx": ""}, pages, vide, lien, touches);
        /* après « Pages 3-4 · … » sur ordinateur, après le nom du livre sur téléphone : avant les boutons du site */
        const repere = $(":scope > #livreOu", barre) || $(":scope > .livre-nom", barre);
        if (repere) repere.after(groupe);
        else barre.append(groupe);
    }
    /* l'endroit où l'on est (« Pages 3-4 · … », ou sa ligne du téléphone) ouvre aussi la vue d'ensemble */
    const ou = $("#livreOu");
    if (ou && !ou.dataset.wpxLivre) {
        ou.dataset.wpxLivre = "1";
        ou.title = T.livrePagesAide;
        ou.addEventListener("click", ouvrirLivre);
    }
}

/* où le livre est ouvert : {ou: "couverture" | "sommaire" | "fin"} ou {pages: [les pages visibles]} */
function ouEstLeLivre(d) {
    const n = d.pages.length;
    if (d.tel) {
        if (d.p <= 0) return {ou: "couverture"};
        if (d.p <= 2) return {ou: "sommaire"};
        return d.p < 3 + n ? {pages: [d.p - 3]} : {ou: "fin"};
    }
    if (d.t <= 0) return {ou: "couverture"};
    if (d.t === 1) return {ou: "sommaire"};
    if (d.t >= d.feuilles) return {ou: "fin"};
    return {pages: [2 * (d.t - 2), 2 * (d.t - 2) + 1]};
}

function construireLivre() {
    const z = {
        titre: el("b", {id: "wpx-lv-titre"}, T.livrePages),
        sous: el("small"),
        recherche: el("input", {type: "search", class: "wpx-champ", placeholder: T.livreChercher, "aria-label": T.livreChercher,
            autocomplete: "off", spellcheck: "false"}),
        compte: el("span", {class: "wpx-lv-compte", "aria-live": "polite"}),
        fermer: el("button", {type: "button", class: "wpx-x", title: "Fermer (Échap)", "aria-label": "Fermer"}, "✕"),
        corps: el("div", {class: "wpx-lv-corps"}),
        /* sur téléphone, la barre du livre n'a de place que pour « Toutes les pages » : ses deux autres boutons sont ici */
        vide: el("button", {type: "button", class: "wpx-lien"}, T.livreVide),
        lien: el("button", {type: "button", class: "wpx-lien"}, T.livreLien)
    };
    z.actions = el("div", {class: "wpx-lv-actions"}, z.vide, z.lien);
    LIVRE.vue = el("aside", {id: "wpx-livre", "data-wpx": "", role: "dialog", "aria-modal": "true", "aria-labelledby": "wpx-lv-titre", hidden: true},
        el("header", {class: "wpx-lv-tete"}, el("div", null, z.titre, z.sous), z.compte, z.actions, z.recherche, z.fermer),
        z.corps);
    LIVRE.z = z;
    D.body.append(LIVRE.vue);
    z.fermer.addEventListener("click", () => fermerLivre(true));
    z.vide.addEventListener("click", pageVideSuivante);
    z.lien.addEventListener("click", () => {
        fermerLivre(true);
        copierLienDuLivre();
    });
    z.recherche.addEventListener("input", filtrerLivre);
    z.corps.addEventListener("click", e => {
        const tuile = e.target.closest(".wpx-lv-page");
        if (tuile) allerALaTuile(tuile);
    });
    /* un clic hors de la vue la referme (sauf sur ses boutons, qui la referment eux-mêmes) */
    D.addEventListener("pointerdown", e => {
        if (LIVRE.vue.hidden || LIVRE.vue.contains(e.target) || (e.target.closest && e.target.closest(".wpx-lv-outils, #livreOu"))) return;
        fermerLivre();
    }, true);
}

function ouvrirLivre() {
    const d = lireLivre();
    if (!d) return;
    fermerAideLivre();
    if (!LIVRE.vue) construireLivre();
    if (!LIVRE.vue.hidden) return fermerLivre(true);           // un second clic la referme
    LIVRE.donnees = d;
    LIVRE.z.recherche.value = "";
    rendreLivre();
    /* le livre ouvert couvre toute la fenêtre, menu du site compris : la vue se pose juste sous sa barre */
    const barre = barreDuLivre();
    if (barre) LIVRE.vue.style.top = Math.round(barre.getBoundingClientRect().bottom + 8) + "px";
    LIVRE.vue.hidden = false;
    LIVRE.z.recherche.focus({preventScroll: true});
    const ici = $(".wpx-ici", LIVRE.z.corps);
    if (ici) ici.scrollIntoView({block: "center"});
}

function fermerLivre(rendreLaMain) {
    if (!LIVRE.vue || LIVRE.vue.hidden) return;
    LIVRE.vue.hidden = true;
    LIVRE.z.corps.replaceChildren();                            // ses images ne restent pas en mémoire
    LIVRE.tuiles = [];
    const bouton = rendreLaMain && $(".wpx-lv-outils .wpx-lv-btn");
    if (bouton) bouton.focus({preventScroll: true});
}

/* une page du livre : ses premières cartes (ou le début de son texte), son numéro et son nom */
function tuilePage(p, i) {
    const vue = el("span", {class: "wpx-lv-vue" + (p.vues.length === 1 ? " wpx-un" : "")});
    for (const c of p.vues) {
        const rang = c.sh ? "SH" : c.hw ? "HW" : /^[A-Z]+$/.test(c.r) ? c.r : "C";
        const sans = () => el("i", {class: "wpx-lv-sans"}, propre(c.n).slice(0, 1).toUpperCase() || "?");
        let vignette = sans();
        if (/^(https:|data:image\/|\/)/.test(c.img)) {
            vignette = el("img", {src: c.img, alt: "", loading: "lazy", decoding: "async", referrerpolicy: "no-referrer"});
            /* une image qui ne charge pas : l'original Wikimedia (comme pour les cartes du site), puis l'initiale */
            vignette.addEventListener("error", function repli() {
                const orig = urlOriginale(this.currentSrc || this.src);
                if (orig && !this.dataset.wpxImg) {
                    this.dataset.wpxImg = "orig";
                    this.src = orig;
                    return;
                }
                this.removeEventListener("error", repli);
                const initiale = sans();
                initiale.style.setProperty("--c", `var(--r-${rang},#aeb6c2)`);
                this.replaceWith(initiale);
            });
        }
        vignette.style.setProperty("--c", `var(--r-${rang},#aeb6c2)`);
        vue.append(vignette);
    }
    if (!p.vues.length) vue.append(el("em", {class: "wpx-lv-texte"}, p.ecrite ? propre(p.extrait) || p.titre : T.livreBlanche));
    const n = p.noms.length;
    const tuile = el("button", {type: "button", class: "wpx-lv-page" + (p.ecrite ? "" : " wpx-lv-blanche"), "data-page": i,
        title: (i + 1) + " · " + (p.ecrite ? p.nom : T.livreBlanche) + (n ? " · " + pluriel(n, "carte") : "")},
    vue, el("span", {class: "wpx-lv-nom"}, el("small", null, String(i + 1)), p.ecrite ? p.nom : T.livreBlanche));
    tuile.dataset.cherche = pourRecherche([String(i + 1), p.nom, p.titre, p.extrait, ...p.noms].join(" "));
    return tuile;
}

/* la couverture, le sommaire et la fin */
function tuileRepere(ou, nom, detail) {
    const vue = el("span", {class: "wpx-lv-vue wpx-un"},
        ou === "couverture" ? el("b", null, detail) : el("span", {class: "wpx-lv-orn", "aria-hidden": "true"}, ou === "fin" ? "❦" : ""));
    return el("button", {type: "button", class: "wpx-lv-page wpx-lv-repere wpx-lv-" + ou, "data-ou": ou, title: nom},
        vue, el("span", {class: "wpx-lv-nom"}, nom));
}

/* les pages vont par deux, comme dans le livre ouvert ; sur téléphone, c'est la page elle-même qui est allumée */
function rendreLivre() {
    const d = LIVRE.donnees;
    const z = LIVRE.z;
    const n = d.pages.length;
    const blanches = d.pages.filter(p => !p.ecrite).length;
    const cartes = d.pages.reduce((somme, p) => somme + p.noms.length, 0);
    z.sous.textContent = [d.nom, pluriel(n, "page"), pluriel(cartes, "carte"),
        blanches ? pluriel(blanches, "page blanche", "pages blanches") : ""].filter(Boolean).join(" · ");
    z.vide.hidden = d.lecture || !blanches;
    const ici = ouEstLeLivre(d);
    const double = (...tuiles) => el("div", {class: "wpx-lv-double"}, tuiles);
    const blocs = [double(tuileRepere("couverture", "Couverture", d.nom), tuileRepere("sommaire", "Sommaire"))];
    blocs[0].classList.add("wpx-lv-reperes");
    for (let i = 0; i < n; i += 2) {
        const bloc = double(tuilePage(d.pages[i], i), i + 1 < n ? tuilePage(d.pages[i + 1], i + 1) : null);
        if (!d.tel && ici.pages && ici.pages[0] === i) bloc.classList.add("wpx-ici");
        blocs.push(bloc);
    }
    if (!n) blocs.push(el("div", {class: "wpx-vide wpx-lv-reperes"}, "Ce livre n'a pas encore de page."));
    const fin = double(tuileRepere("fin", "Fin"));
    fin.classList.add("wpx-lv-reperes");
    blocs.push(fin);
    z.corps.replaceChildren(...blocs);
    LIVRE.tuiles = $$(".wpx-lv-page", z.corps);
    for (const tuile of LIVRE.tuiles) {
        const allumee = ici.ou ? tuile.dataset.ou === ici.ou : d.tel && ici.pages[0] === +tuile.dataset.page;
        if (allumee) tuile.classList.add("wpx-ici");
    }
    filtrerLivre();
}

/* la recherche : les pages qui ne correspondent pas pâlissent, les doubles pages sans aucune se cachent */
function filtrerLivre() {
    const z = LIVRE.z;
    const filtre = pourRecherche(z.recherche.value);
    let trouvees = 0;
    const rien = $(":scope > .wpx-lv-rien", z.corps);
    if (rien) rien.remove();
    for (const bloc of z.corps.children) {
        if (bloc.classList.contains("wpx-lv-reperes")) {
            bloc.hidden = !!filtre;
            continue;
        }
        let garde = false;
        for (const tuile of $$(".wpx-lv-page", bloc)) {
            const oui = !filtre || tuile.dataset.cherche.includes(filtre);
            tuile.classList.toggle("wpx-lv-hors", !oui);
            if (oui) {
                garde = true;
                trouvees++;
            }
        }
        bloc.hidden = !garde;
    }
    z.compte.textContent = filtre ? pluriel(trouvees, "page trouvée", "pages trouvées") : "";
    if (filtre && !trouvees) z.corps.append(el("div", {class: "wpx-vide wpx-lv-rien"}, T.aucunResultat));
}

function allerALaTuile(tuile) {
    const destination = tuile.dataset.page != null ? {page: +tuile.dataset.page} : {ou: tuile.dataset.ou};
    fermerLivre(true);
    allerDansLeLivre(destination);
}

/* les flèches passent d'une page à l'autre dans la vue d'ensemble : à côté, ou sur la rangée du dessus, du dessous */
function deplacerDansLivre(touche) {
    const tuiles = LIVRE.tuiles.filter(t => t.getClientRects().length && !t.classList.contains("wpx-lv-hors"));
    const i = tuiles.indexOf(D.activeElement);
    let cible = null;
    if (i < 0) cible = tuiles.find(t => t.matches(".wpx-ici, .wpx-ici .wpx-lv-page")) || tuiles[0];
    else if (touche === "ArrowLeft") cible = tuiles[i - 1];
    else if (touche === "ArrowRight") cible = tuiles[i + 1];
    else {
        const r = tuiles[i].getBoundingClientRect();
        const bas = touche === "ArrowDown";
        const autres = tuiles.filter(t => (bas ? t.getBoundingClientRect().top > r.top + 4 : t.getBoundingClientRect().top < r.top - 4));
        if (autres.length) {
            const rangee = autres.reduce((m, t) => {
                const y = t.getBoundingClientRect().top;
                return bas ? Math.min(m, y) : Math.max(m, y);
            }, bas ? Infinity : -Infinity);
            const x = r.left + r.width / 2;
            cible = autres.filter(t => Math.abs(t.getBoundingClientRect().top - rangee) < 4)
                .reduce((m, t) => {
                    const s = t.getBoundingClientRect();
                    return !m || Math.abs(s.left + s.width / 2 - x) < Math.abs(m.getBoundingClientRect().left + m.getBoundingClientRect().width / 2 - x) ? t : m;
                }, null);
        }
    }
    if (cible && cible.matches(".wpx-lv-page")) {
        cible.focus({preventScroll: true});
        cible.scrollIntoView({block: "nearest"});
    }
}

/* le rappel des raccourcis : un petit panneau sous son bouton */
function basculerAideLivre() {
    if (LIVRE.aide && !LIVRE.aide.hidden) return fermerAideLivre();
    const bouton = $(".wpx-lv-outils .wpx-lv-touches");
    if (!bouton || !bouton.getClientRects().length) return;
    if (!LIVRE.aide) {
        LIVRE.aide = el("div", {id: "wpx-lv-aide", "data-wpx": "", role: "dialog", "aria-label": T.livreRaccourcis, hidden: true},
            el("b", null, T.livreRaccourcis),
            el("dl", null, TOUCHES_LIVRE.map(([touche, effet, outil]) => [
                el("dt", null, el("kbd", null, touche)),
                el("dd", null, effet, outil ? el("em", null, " · outil") : null)
            ])));
        D.body.append(LIVRE.aide);
        D.addEventListener("pointerdown", e => {
            if (!LIVRE.aide.hidden && !LIVRE.aide.contains(e.target) && !(e.target.closest && e.target.closest(".wpx-lv-touches"))) fermerAideLivre();
        }, true);
    }
    const r = bouton.getBoundingClientRect();
    LIVRE.aide.hidden = false;
    LIVRE.aide.style.top = Math.round(r.bottom + 8) + "px";
    LIVRE.aide.style.left = Math.max(12, Math.min(r.right - LIVRE.aide.offsetWidth, innerWidth - LIVRE.aide.offsetWidth - 12)) + "px";
    bouton.setAttribute("aria-expanded", "true");
}

function fermerAideLivre() {
    if (!LIVRE.aide || LIVRE.aide.hidden) return;
    LIVRE.aide.hidden = true;
    const bouton = $(".wpx-lv-outils .wpx-lv-touches");
    if (bouton) bouton.setAttribute("aria-expanded", "false");
}

/* Les touches, avant le site (phase de capture) : la vue d'ensemble ouverte garde Échap et les flèches pour elle ; le
   livre ouvert reçoit G, Début, Fin et ?, sauf pendant une saisie ou quand une fenêtre du site est ouverte. */
function toucheLivre(e) {
    const garder = () => {
        e.preventDefault();
        e.stopImmediatePropagation();
    };
    if (LIVRE.vue && !LIVRE.vue.hidden) {
        const dansRecherche = e.target === LIVRE.z.recherche;
        if (e.key === "Escape") {
            garder();
            fermerLivre(true);
        } else if (dansRecherche && e.key === "Enter") {
            garder();
            const premiere = LIVRE.tuiles.find(t => t.dataset.page != null && t.getClientRects().length && !t.classList.contains("wpx-lv-hors"));
            if (premiere) allerALaTuile(premiere);
        } else if (/^Arrow/.test(e.key) && (!dansRecherche || e.key === "ArrowDown")) {
            garder();
            deplacerDansLivre(dansRecherche ? "" : e.key);
        } else if (!dansRecherche) {
            e.stopImmediatePropagation();                     // (le livre, derrière, ne tourne pas)
            /* une lettre tapée sur une page va dans la recherche */
            if (e.key.length === 1 && e.key !== " " && !e.ctrlKey && !e.metaKey && !e.altKey) LIVRE.z.recherche.focus({preventScroll: true});
        }
        return;
    }
    if (e.key === "Escape" && LIVRE.aide && !LIVRE.aide.hidden) {
        garder();
        fermerAideLivre();
        return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || !barreDuLivre() || vueCourante() !== "album") return;
    if (e.target.closest && e.target.closest("input, textarea, select, [contenteditable]")) return;
    const voile = $("#albVoile");
    if ((voile && !voile.hidden) || $(".veil.on")) return;
    if (e.key === "g" || e.key === "G") {
        garder();
        ouvrirLivre();
    } else if (e.key === "n" || e.key === "N") {
        garder();
        pageVideSuivante();
    } else if (e.key === "Home" || e.key === "End") {
        garder();
        allerDansLeLivre({ou: e.key === "Home" ? "couverture" : "fin"});
    } else if (e.key === "?") {
        garder();
        basculerAideLivre();
    }
}

/* ==========================================================================
   RÉGLAGES DE L'OUTIL (le panneau)
   Chaque changement s'applique tout de suite (la feuille de style est réécrite) et se garde dans ce navigateur ;
   les quelques réglages lus au démarrage le disent (« au prochain chargement »).
   ========================================================================== */
const PANNEAU = {vue: null};

function ouvrirReglages() {
    if (!PANNEAU.vue) construireReglages();
    rendreReglages();
    PANNEAU.vue.hidden = false;
    const fermer = $("[data-wpx-rg-fermer]", PANNEAU.vue);
    if (fermer) fermer.focus({preventScroll: true});
}

function fermerReglages() {
    if (PANNEAU.vue && !PANNEAU.vue.hidden) PANNEAU.vue.hidden = true;
}

function construireReglages() {
    PANNEAU.vue = el("aside", {id: "wpx-reglages", "data-wpx": "", role: "dialog", "aria-modal": "true", "aria-labelledby": "wpx-rg-titre", hidden: true});
    D.body.append(PANNEAU.vue);
    PANNEAU.vue.addEventListener("input", changerReglage);
    PANNEAU.vue.addEventListener("click", e => {
        if (e.target.closest("[data-wpx-rg-fermer]")) fermerReglages();
        else if (e.target.closest("[data-wpx-rg-defaut]")) retablirReglages();
        else if (e.target.closest("[data-wpx-rg-rien]")) toutDecocher();
    });
    D.addEventListener("pointerdown", e => {
        if (PANNEAU.vue.hidden || PANNEAU.vue.contains(e.target) || (e.target.closest && e.target.closest("[data-wpx-reglages]"))) return;
        fermerReglages();
    }, true);
}

const valeurAffichee = (l, v) => nombre(Math.round(v * (l.facteur || 1))) + (l.unite || "");

function ligneDeReglage(l) {
    const valeur = lireChemin(l.chemin);
    const attente = l.recharger ? el("small", null, "au prochain chargement") : null;
    if (l.type === "case") {
        const coche = el("input", {type: "checkbox", "data-wpx-rg": l.chemin});
        coche.checked = !!valeur;
        return el("label", {class: "wpx-rg-ligne", "data-si": l.si}, coche, el("span", null, l.nom), attente);
    }
    const curseur = el("input", {type: "range", min: l.min, max: l.max, step: l.pas, value: valeur, "data-wpx-rg": l.chemin});
    return el("label", {class: "wpx-rg-ligne wpx-rg-curseur", "data-si": l.si}, el("span", null, l.nom), curseur,
        el("output", null, valeurAffichee(l, valeur)));
}

function rendreReglages() {
    const sections = REGLABLES.map(s => el("section", {class: "wpx-rg-section"}, el("h3", null, s.titre), s.lignes.map(ligneDeReglage)));
    const clean = el("section", {class: "wpx-rg-section"}, el("h3", null, "Ce que cache le mode Clean"),
        el("div", {class: "wpx-rg-clean"}, DEFAUTS.CLEAN.masquer.map(s => {
            const coche = el("input", {type: "checkbox", "data-wpx-clean": s});
            coche.checked = CONFIG.CLEAN.masquer.includes(s);
            return el("label", {class: "wpx-rg-ligne", title: s}, coche, el("span", null, NOMS_CLEAN[s] || s));
        })));
    PANNEAU.vue.replaceChildren(
        el("header", {class: "wpx-ds-tete"}, el("b", {id: "wpx-rg-titre"}, T.reglages),
            el("button", {type: "button", class: "wpx-x", "data-wpx-rg-fermer": "", title: "Fermer (Échap)", "aria-label": "Fermer"}, "✕")),
        el("p", {class: "wpx-ds-texte"}, "Gardés dans ce navigateur : une mise à jour de l'outil ne les efface pas."),
        el("div", {class: "wpx-rg-corps"}, sections, clean),
        el("footer", {class: "wpx-rg-pied"},
            el("button", {type: "button", class: "wpx-lien", "data-wpx-rg-defaut": ""}, "Rétablir les réglages d'origine"),
            el("button", {type: "button", class: "wpx-lien", "data-wpx-rg-rien": "",
                title: "Toutes les cases du panneau, ce que cache Clean compris : l'outil ne règle plus rien. « Rétablir les réglages d'origine » les remet."},
                "Tout décocher"),
            el("small", {class: "wpx-rg-note", "aria-live": "polite"})));
    majDependances();
}

/* une ligne qui dépend d'une autre (la taille des cartes, de « Régler la taille des cartes ») s'éteint avec elle */
function majDependances() {
    for (const ligne of $$("[data-si]", PANNEAU.vue)) {
        const actif = !!lireChemin(ligne.dataset.si);
        ligne.classList.toggle("wpx-rg-off", !actif);
        $$("input", ligne).forEach(champ => { champ.disabled = !actif; });
    }
}

function changerReglage(e) {
    const champ = e.target;
    if (champ.dataset.wpxClean != null) {
        const gardes = new Set($$("[data-wpx-clean]", PANNEAU.vue).filter(c => c.checked).map(c => c.dataset.wpxClean));
        CONFIG.CLEAN.masquer = DEFAUTS.CLEAN.masquer.filter(s => gardes.has(s));
    } else if (champ.dataset.wpxRg) {
        const l = ligneReglable(champ.dataset.wpxRg);
        if (!l) return;
        ecrireReglage(l.chemin, champ.type === "checkbox" ? champ.checked : Number(champ.value));
        if (l.type === "curseur" && champ.nextElementSibling) champ.nextElementSibling.textContent = valeurAffichee(l, lireChemin(l.chemin));
        if (l.recharger) $(".wpx-rg-note", PANNEAU.vue).textContent = "Recharge la page pour appliquer « " + l.nom + " ».";
    } else {
        return;
    }
    sauverReglages();
    majDependances();
    appliquerReglagesEnDirect();
}

/* seuls les écarts aux réglages d'origine sont gardés : un nouveau défaut d'une version suivante s'applique */
function sauverReglages() {
    const valeurs = {};
    for (const l of REGLABLES.flatMap(s => s.lignes)) {
        if (lireChemin(l.chemin) !== lireChemin(l.chemin, DEFAUTS)) valeurs[l.chemin] = lireChemin(l.chemin);
    }
    const cleanSauf = DEFAUTS.CLEAN.masquer.filter(s => !CONFIG.CLEAN.masquer.includes(s));
    if (Object.keys(valeurs).length || cleanSauf.length) memoire.ecrire("reglages", {valeurs, cleanSauf});
    else memoire.effacer("reglages");
}

function retablirReglages() {
    for (const l of REGLABLES.flatMap(s => s.lignes)) ecrireReglage(l.chemin, lireChemin(l.chemin, DEFAUTS));
    CONFIG.CLEAN.masquer = DEFAUTS.CLEAN.masquer.slice();
    memoire.effacer("reglages");
    rendreReglages();
    appliquerReglagesEnDirect();
}

/* « Tout décocher » : chaque case du panneau, et tout ce que cache Clean ; les curseurs gardent leur valeur (éteints avec
   leur case). Ce qui ne s'applique qu'au chargement suivant est rappelé, comme pour une case seule. */
function toutDecocher() {
    const cases = REGLABLES.flatMap(s => s.lignes).filter(l => l.type === "case");
    const aRecharger = cases.filter(l => l.recharger && lireChemin(l.chemin)).map(l => "« " + l.nom + " »");
    cases.forEach(l => ecrireReglage(l.chemin, false));
    CONFIG.CLEAN.masquer = [];
    sauverReglages();
    rendreReglages();
    appliquerReglagesEnDirect();
    if (aRecharger.length) $(".wpx-rg-note", PANNEAU.vue).textContent = "Recharge la page pour appliquer " + aRecharger.join(", ") + ".";
}

/* la feuille de style est réécrite ; chaque partie revoit son état au rafraîchissement suivant */
function appliquerReglagesEnDirect() {
    installerStyles();
    HTML.classList.toggle("wpx-entete", !!CONFIG.ENTETE.fixe);
    appliquerAncienSite();
    if (!CONFIG.SOUHAITS.actif) effacerSouhaits();
    if (!CONFIG.CHANCES.actif) effacerChances();
    if (!CONFIG.GARDE_FOU.actif) fermerGardeFou();
    PAQ.signature = "";
    mesurerEntete();
    rafraichirBientot();
}

/* ==========================================================================
   TES SOUHAITS, MIS EN VALEUR
   Au marché, sur la page d'une enchère et dans les échanges proposés (colonne « Tu reçois »), les cartes de ta
   liste de souhaits sont entourées et portent « ★ Tu la souhaites », comme dans la fenêtre d'échange du site ;
   un lot du marché dit combien il en contient. La liste est celle que le site lit lui-même (vue au passage,
   comme pour le partage Discord) ; sinon le script la lit (/api/wishlist/cids), au plus toutes les 12 heures,
   et la relit quand un autre compte se connecte dans ce navigateur.
   ========================================================================== */
const VOEUX = {lecture: 0};

function mesSouhaits() {
    const etat = memoire.lire("discord.souhaits", null);
    const joueur = pseudoJoueur();
    const connue = !!etat && etat.connue === true && Array.isArray(etat.cids) && !(etat.joueur && joueur && etat.joueur !== joueur);
    if (!connue || Date.now() - (etat.lue || 0) > CONFIG.DISCORD.souhaitsH * 3600e3) relireSouhaits();
    return connue ? new Set(etat.cids) : null;
}

/* une lecture à la fois, au plus toutes les cinq minutes ; les cartes sont marquées dès la réponse */
function relireSouhaits() {
    if (!pseudoJoueur() || Date.now() - VOEUX.lecture < 5 * 60000) return;
    VOEUX.lecture = Date.now();
    lireSouhaits().then(rafraichirBientot);
}

function zonesDeSouhaits() {
    const vue = vueCourante();
    if (vue === "market") return $$("#v-market .offer");
    if (vue === "auction") return $$("#auction");
    if (vue === "trades") return $$("#tbody .trade .tcols > .tcol:last-child");          // « Tu reçois »
    return [];
}

function marquerSouhaits() {
    if (!CONFIG.SOUHAITS.actif) return;
    const zones = zonesDeSouhaits();
    if (!zones.length) return;
    const voeux = mesSouhaits();
    if (!voeux) return;
    for (const zone of zones) {
        let n = 0;
        for (const carte of $$(".card[data-cle]", zone)) {
            const cid = (carte.getAttribute("data-cle") || "").split("#")[0];
            const tuile = carte.closest(".lotc, .slot, [data-card]") || carte.parentElement;
            const oui = !!cid && voeux.has(cid);
            if (oui) n++;
            if (tuile.classList.contains("wpx-souhaitee") !== oui) tuile.classList.toggle("wpx-souhaitee", oui);
            const marque = $(":scope > .wpx-souhait-marque", tuile);
            const avecMarque = oui && !tuile.matches(".lotc");                 // dans l'éventail d'un lot : trop serré
            if (avecMarque && !marque) tuile.append(el("span", {class: "wpx-souhait-marque"}, T.souhaitee));
            else if (!avecMarque && marque) marque.remove();
        }
        /* un lot du marché : combien de ses cartes tu souhaites, sur la tuile du lot */
        const lot = zone.matches(".offer") ? $(":scope > .lotslot", zone) : null;
        if (lot) {
            const texte = "★ " + pluriel(n, "souhaitée", "souhaitées");
            const marque = $(":scope > .wpx-souhait-marque", lot);
            if (!n && marque) marque.remove();
            else if (n && !marque) lot.append(el("span", {class: "wpx-souhait-marque"}, texte));
            else if (n && marque.textContent !== texte) marque.textContent = texte;
            if (lot.classList.contains("wpx-lot-souhaite") !== n > 0) lot.classList.toggle("wpx-lot-souhaite", n > 0);
        }
    }
}

function effacerSouhaits() {
    $$(".wpx-souhait-marque").forEach(e => e.remove());
    $$(".wpx-souhaitee, .wpx-lot-souhaite").forEach(e => e.classList.remove("wpx-souhaitee", "wpx-lot-souhaite"));
}

/* ==========================================================================
   CHANCES
   Les chiffres sont ceux du site : la chance qu'une carte d'un paquet soit de tel rang (INFO.oddsCarte, la même
   source que sa fenêtre « À savoir »), lue dans la page par un petit relais ; le nombre de cartes de chaque rang
   vient du catalogue (/api/catalogue, une lecture au plus par jour).
   - Sur la fiche d'une carte : la chance de la tirer. Une estimation : la chance de son rang, partagée entre
     toutes les cartes de ce rang (le site ne dit pas si certaines sortent plus souvent que d'autres).
   - Dans le panneau des derniers paquets : tes cartes rares ou mieux, comparées à ce qu'on en attend en moyenne,
     et le détail par rang dans « Voir mes … dernières cartes ». Les paquets PRO n'y comptent pas.
   ========================================================================== */
const CHANCE = {infos: null, lecture: false, echec: 0};
const RANGS_RARES = ["M", "L", "UR", "SR", "R"];
const RANGS_TIRES = ["M", "L", "UR", "SR", "R", "PC", "C"];

/* Exécutée dans la page elle-même : les chances du site (INFO), en texte, à la demande du script */
function pontSite() {
    if (window.__wpxPontSite) return;
    window.__wpxPontSite = true;
    document.addEventListener("wpx-site-demande", () => {
        let donnees = null;
        try {
            if (typeof INFO !== "undefined" && INFO && INFO.oddsCarte) {
                donnees = {oddsCarte: INFO.oddsCarte, perPack: INFO.perPack || 5, rangFete: INFO.rangFete || null};
            }
        } catch (erreur) {
            donnees = null;
        }
        document.dispatchEvent(new CustomEvent("wpx-site-donnees", {detail: JSON.stringify(donnees)}));
    });
}

/* les chances du site, lues une fois par chargement (null tant que le site ne les a pas reçues) */
function infosSite() {
    if (CHANCE.infos) return CHANCE.infos;
    let donnees = null;
    const recevoir = e => {
        try { donnees = JSON.parse(e.detail); } catch (erreur) { donnees = null; }
    };
    D.addEventListener("wpx-site-donnees", recevoir);
    D.dispatchEvent(new CustomEvent("wpx-site-demande"));
    D.removeEventListener("wpx-site-donnees", recevoir);
    if (donnees && donnees.oddsCarte && typeof donnees.oddsCarte === "object") CHANCE.infos = donnees;
    return CHANCE.infos;
}

/* le nombre de cartes de chaque rang, gardé une journée ; une lecture à la fois, et dix minutes de pause après un échec */
async function lireComptes() {
    const garde = memoire.lire("chances.comptes", null);
    if (garde && garde.counts && Date.now() - garde.t < CONFIG.CHANCES.comptesH * 3600e3) return garde;
    if (CHANCE.lecture || Date.now() - CHANCE.echec < 10 * 60000) return garde;
    CHANCE.lecture = true;
    try {
        const r = await fetch("/api/catalogue?" + new URLSearchParams({page: 0, q: "", r: "", exact: "0"}),
                              {credentials: "same-origin", headers: {Accept: "application/json"}});
        const d = r.ok ? await r.json() : null;
        if (d && d.counts && typeof d.counts === "object") {
            const comptes = {t: Date.now(), counts: d.counts, total: d.total || 0};
            memoire.ecrire("chances.comptes", comptes);
            return comptes;
        }
        CHANCE.echec = Date.now();
    } catch (erreur) {
        CHANCE.echec = Date.now();                   // le serveur ne répond pas : la ligne attendra
    } finally {
        CHANCE.lecture = false;
    }
    return garde;
}

/* « Mythiques ×2 » et ses semblables : pendant l'événement, la chance du rang fêté est multipliée */
function feteDuRang(rang, infos) {
    const f = infos.rangFete;
    const maintenant = Date.now() / 1000;
    return f && f.rang === rang && maintenant >= f.debut && maintenant < f.fin ? f : null;
}

/* la chance (0 à 1) qu'un paquet contienne cette carte, si chaque carte d'un rang a la même chance */
function chanceDeLaCarte(rang, infos, comptes) {
    const fete = feteDuRang(rang, infos);
    const parCarte = (Number(infos.oddsCarte[rang]) || 0) / 100 * (fete ? Number(fete.fois) || 1 : 1);
    const n = Number(comptes.counts[rang]) || 0;
    if (!(parCarte > 0) || !(n > 0)) return null;
    return 1 - Math.pow(1 - Math.min(1, parCarte / n), Number(infos.perPack) || 5);
}

/* « environ 1 paquet sur 61 000 », comme la fenêtre « À savoir » du site (deux chiffres significatifs) */
function unSur(p) {
    if (!(p > 0)) return "";
    let x = 1 / p;
    if (x >= 100) {
        const e = Math.pow(10, Math.floor(Math.log10(x)) - 1);
        x = Math.round(x / e) * e;
    } else {
        x = Math.round(x);
    }
    return x <= 1 ? "quasiment chaque paquet" : "environ 1 paquet sur " + nombre(x);
}

const NOMS_RANGS = {M: "mythique", L: "légendaire", UR: "exceptionnelle", SR: "épique", R: "rare", PC: "inhabituelle", C: "commune"};

/* la ligne de la fiche d'une carte, sous « Dans le jeu : … » (onglet Détails) ; la fiche est redessinée souvent */
function installerChanceFiche() {
    if (!CONFIG.CHANCES.actif) return;
    const voile = $("#sheetVeil");
    const corps = $("#shDyn");
    const fiche = $("#sheet");
    if (!voile || !voile.classList.contains("on") || !corps || !fiche || fiche.classList.contains("marche")) return;
    if ($(":scope > .wpx-chance", corps) || $(":scope > .loading", corps)) return;
    const carte = $(":scope > .l .card[data-cle]", fiche);
    if (!carte || carte.classList.contains("pending")) return;
    const rang = ([...carte.classList].find(c => /^r-/.test(c)) || "").slice(2);
    if (!RANGS_TIRES.includes(rang)) return;                 // exclusive, carte de l'éditeur : elles ne sortent pas des paquets
    const infos = infosSite();
    const comptes = memoire.lire("chances.comptes", null);
    if (!infos) return;
    if (!comptes || Date.now() - comptes.t > CONFIG.CHANCES.comptesH * 3600e3) {
        lireComptes().then(c => { if (c) installerChanceFiche(); });
        if (!comptes) return;
    }
    const p = chanceDeLaCarte(rang, infos, comptes);
    if (p == null) return;
    const fete = feteDuRang(rang, infos);
    const version = carte.classList.contains("sh") ? " (version normale)" : carte.classList.contains("hw") ? " (version classique)" : "";
    const ligne = el("p", {class: "wpx-chance", "data-wpx": ""},
        el("span", null, "Chance de la tirer" + version + " : ", el("b", null, unSur(p)), fete ? " pendant « " + fete.nom + "s ×" + fete.fois + " »" : ""),
        el("small", null, "Estimation : la chance d'une carte " + (NOMS_RANGS[rang] || rang) + " (" + nombre(Number(infos.oddsCarte[rang]) * (fete ? fete.fois : 1)) +
            " % par carte tirée) partagée entre les " + nombre(Number(comptes.counts[rang])) + " cartes de ce rang."));
    const apres = $(":scope > .chezqui", corps) || $(":scope > .shbar", corps);
    if (apres) apres.after(ligne);
    else corps.prepend(ligne);
}

function effacerChances() {
    $$(".wpx-chance, .wpx-pq-chance, .wpx-dc-chance").forEach(e => e.remove());
}

/* tes cartes rares ou mieux, dans tes derniers paquets normaux, face à ce qu'on en attend en moyenne */
function bilanDeChance() {
    const infos = infosSite();
    if (!infos) return null;
    const cartes = PAQ.liste.filter(p => !p.pro).flatMap(p => p.cartes);
    if (cartes.length < 20) return null;
    const parRang = RANGS_RARES.map(r => ({r, vu: cartes.filter(c => c.r === r).length,
                                           attendu: cartes.length * (Number(infos.oddsCarte[r]) || 0) / 100}));
    const vu = parRang.reduce((s, x) => s + x.vu, 0);
    const attendu = parRang.reduce((s, x) => s + x.attendu, 0);
    return attendu > 0 ? {n: cartes.length, vu, attendu, ratio: vu / attendu, parRang} : null;
}

const dixieme = x => nombre(Math.round(x * 10) / 10);
/* une moyenne attendue : un chiffre après la virgule, ou deux chiffres significatifs sous 1 (0,023 mythique, pas 0) */
const enMoyenne = x => nombre(x >= 1 ? Math.round(x * 10) / 10 : Number(x.toPrecision(2)));

function ligneDeChance(b) {
    const humeur = b.ratio >= 1.2 ? "wpx-plus" : b.ratio <= 0.8 ? "wpx-moins" : "";
    return `<p class="wpx-pq-chance ${humeur}" title="Rare, épique, exceptionnelle, légendaire ou mythique, d'après les chances du site ; les paquets PRO ne comptent pas">` +
        `Ta chance : <b>${nombre(b.vu)}</b> ${b.vu > 1 ? "cartes rares ou mieux" : "carte rare ou mieux"} sur tes ${nombre(b.n)} dernières, ` +
        `pour ${enMoyenne(b.attendu)} en moyenne (× ${dixieme(b.ratio)})</p>`;
}

function detailDeChance(b) {
    return `<div class="wpx-dc-chance">${b.parRang.map(x => `<span style="--c:var(--r-${x.r},#aeb6c2)"><b>${nombre(x.vu)}</b> ` +
        `${echapper(RANGS[x.r] || x.r)} <small>${enMoyenne(x.attendu)} en moyenne</small></span>`).join("")}</div>`;
}

/* ==========================================================================
   GARDE-FOU
   Le site change sans prévenir (25/10/2026 : #tabs caché, profil rangé dans .pf-hero…). Quand une page est
   affichée mais que l'outil n'y retrouve plus ce dont il a besoin, ou qu'une de ses parties plante, un petit avis
   le dit, en bas à droite, une fois par version du site, au lieu d'une fonction qui cesse de marcher en silence.
   Une ancre ne compte comme absente qu'après trois passages de suite (la page peut être en train de se dessiner).
   ========================================================================== */
const GARDE = {manques: new Map(), erreurs: new Set(), avis: null};
const ANCRES = [
    {nom: "le menu fixe", pret: "body > header.top", sel: "body > header.top .row1"},
    {nom: "la barre compacte du profil", vue: "profile", pret: "#profile .pstats", sel: TETE_PROFIL},
    {nom: "la barre d'étiquettes du profil", vue: "profile", pret: "#profile .pstats", sel: "#profile > #pvbloc"},
    {nom: "la collection du profil", vue: "profile", pret: "#profile #pcg", sel: "#profile > .vhead"},
    {nom: "la barre « Mes étiquettes »", vue: "coll", pret: "#ctabs button", sel: '#ctabs button[data-c="album"]'},
    {nom: "les filtres fixes de la collection", vue: "coll", pret: "#ctabs button", test: () => !!$("#v-coll > #ctabs") && !!$("#v-coll > #cTools")},
    {nom: "les filtres fixes de Toutes les cartes", vue: "explore", pret: "#eres", test: () => !!$("#v-explore > .tools") && !!$("#v-explore > #er")},
    {nom: "la rangée des albums du profil", vue: "profile", pret: "#pfAlbums .pfa:not(.pfa-vide)", sel: "#pfAlbums [data-pfaouvre]"},
    {nom: "l'ancien menu", pret: "body.menu-neuf", test: () => !CONFIG.ENTETE.ancienMenu || !!$("#tabs button[data-v]")},
    {nom: "la taille de l'ancien site", pret: "#tabs", test: () => !CONFIG.ENTETE.ancienSite || (!D.body.classList.contains("menu-neuf") && !!$("#tabs button[data-v]"))},
    {nom: "les derniers paquets", vue: "packs", pret: "#v-packs.on", test: () => !!$("#stage") && !!$("#row5") && !!$("#reveal")},
    {nom: "les boutons du livre", vue: "album", pret: "#album .alb2-livre", sel: "#album .alb2-livre > .livre-barre"},
    {nom: "l'aperçu des pages du livre", vue: "album", pret: "#album .alb2-livre", test: () => !!lireLivre()},
    {nom: "les doublons de l'échange", pret: "#composer .ccol", sel: "#tcRar-give"},
    {nom: "tes souhaits au marché", vue: "market", pret: "#v-market .offer", sel: "#v-market .offer .card[data-cle]"},
    {nom: "les chances", pret: "#sheetVeil.on #shDyn .shbar", test: () => !CONFIG.CHANCES.actif || !!infosSite()}
];

/* la version du site : celle de son script principal (main.js?v=…), qui change à chaque mise en ligne */
function versionDuSite() {
    const script = $('script[src*="/js/main.js"]');
    return script ? (script.getAttribute("src").split("v=")[1] || "") : "";
}

function surveiller() {
    if (!CONFIG.GARDE_FOU.actif) return;
    const vue = vueCourante();
    for (const a of ANCRES) {
        if ((a.vue && a.vue !== vue) || !$(a.pret)) continue;            // pas sur sa page, ou page pas encore dessinée
        const present = a.test ? a.test() : !!$(a.sel);
        if (present) GARDE.manques.delete(a.nom);
        else GARDE.manques.set(a.nom, (GARDE.manques.get(a.nom) || 0) + 1);
    }
    const problemes = [...GARDE.manques].filter(([, n]) => n >= 3).map(([nom]) => nom)
        .concat([...GARDE.erreurs].map(nom => "une erreur dans " + nom));
    if (problemes.length) montrerGardeFou(problemes);
}

function montrerGardeFou(problemes) {
    const signe = versionDuSite() + "|" + problemes.slice().sort().join("|");
    if (memoire.lire("garde.vu", "") === signe) return;
    if (!GARDE.avis) {
        GARDE.avis = el("aside", {id: "wpx-garde", "data-wpx": "", role: "status", hidden: true});
        D.body.append(GARDE.avis);
        GARDE.avis.addEventListener("click", e => {
            if (!e.target.closest("[data-wpx-garde-ok]")) return;
            memoire.ecrire("garde.vu", GARDE.avis.dataset.signe);
            fermerGardeFou();
        });
    }
    if (GARDE.avis.dataset.signe === signe) return;
    GARDE.avis.dataset.signe = signe;
    GARDE.avis.replaceChildren(
        el("b", null, "Album+cleaner : le site a changé"),
        el("p", null, "Ne marche peut-être plus : " + problemes.join(", ") + "."),
        el("p", {class: "wpx-garde-aide"}, "Le site, lui, fonctionne normalement. Une mise à jour de l'outil suivra."),
        el("button", {type: "button", class: "wpx-btn", "data-wpx-garde-ok": ""}, "Compris"));
    GARDE.avis.hidden = false;
    console.warn("Album+cleaner+Maximisation v" + CONFIG.VERSION + " : le site a changé (version " + versionDuSite() + ") :", problemes);
}

function fermerGardeFou() {
    if (GARDE.avis) GARDE.avis.hidden = true;
}

/* une partie de l'outil qui plante n'emporte pas les autres : elle est notée, et le garde-fou le dit */
function essayer(nom, fn) {
    try {
        fn();
    } catch (erreur) {
        if (!GARDE.erreurs.has(nom)) console.error("Album+cleaner+Maximisation (" + nom + ") :", erreur);
        GARDE.erreurs.add(nom);
    }
}

/* ==========================================================================
   IMAGES DE CARTES MANQUANTES
   Le site affiche l'image d'une carte en lien direct vers Wikimedia (upload/thumb.wikimedia.org), figée à
   la création de la carte, sans repli si l'URL casse. Quand une image de carte ne charge pas, on retombe
   sur le fichier ORIGINAL du même fichier (on retire la vignette de l'URL), toujours sur
   upload.wikimedia.org — donc autorisé par la CSP du site (img-src). Ça couvre une vignette régénérée, une
   taille changée ou un raté passager ; pas un fichier supprimé/renommé sur Commons (il faudrait interroger
   Wikipédia, ce que la CSP connect-src 'self' interdit depuis la page).
   ========================================================================== */
const IMG_ACTIF = CONFIG.IMAGES_CARTES.actif;

/* l'URL du fichier original Wikimedia à partir d'une URL de vignette, ou "" si ce n'en est pas une */
function urlOriginale(src) {
    const m = /^https:\/\/(?:upload|thumb)\.wikimedia\.org\/(.+)\/thumb\/(.+\/[^/]+)\/[^/]+$/.exec(src || "");
    return m ? "https://upload.wikimedia.org/" + m[1] + "/" + m[2] : "";
}

/* une image de carte n'a pas chargé : on tente le fichier original (une seule fois), sinon on abandonne */
function reparerImageCarte(img) {
    if (!IMG_ACTIF || !img || img.dataset.wpxImg === "fini" || !img.closest(".card .pic")) return;
    const actuel = img.currentSrc || img.src;
    const orig = urlOriginale(actuel);
    if (img.dataset.wpxImg !== "orig" && orig && orig !== actuel) {
        img.dataset.wpxImg = "orig";
        img.src = orig;                                  // sur upload.wikimedia.org : autorisé par img-src
    } else {
        img.dataset.wpxImg = "fini";                     // plus rien à tenter
    }
}

/* balaie les images de carte déjà cassées (chargées avant qu'on écoute les erreurs) */
function balayerImages() {
    if (!IMG_ACTIF) return;
    for (const img of $$(".card .pic img")) {
        if (img.complete && img.naturalWidth === 0 && img.dataset.wpxImg !== "fini" && img.dataset.wpxImg !== "orig")
            reparerImageCarte(img);
    }
}

/* ==========================================================================
   CYCLE DE VIE
   ========================================================================== */
function vueCourante() {
    const vue = $("main section.view.on");
    return vue ? vue.id.replace(/^v-/, "") : "";
}

/* chaque partie à part (essayer) : une partie qui plante n'empêche pas les suivantes */
function rafraichir() {
    const vue = vueCourante();
    HTML.classList.toggle("wpx-sans-taille", CONFIG.TAILLE_CARTES.vuesExclues.includes(vue));
    essayer("Clean et Largeur", installerBascules);
    essayer("le menu fixe", mesurerEntete);
    essayer("le profil", () => rafraichirProfil(vue === "profile"));
    essayer("la barre « Mes étiquettes »", () => rafraichirCollection(vue === "coll"));
    essayer("l'échange", installerEchange);
    essayer("les derniers paquets", () => {
        if (vue === "packs") rendrePanneauPaquets();
        else fermerDernieres();
    });
    essayer("l'export", suivreExport);
    essayer("les livres", () => installerLivre(vue === "album"));
    essayer("tes souhaits", marquerSouhaits);
    essayer("l'historique des échanges", () => { installerBoutonsHisto(); relireHistoriqueSiVieux(); });
    essayer("les chances", installerChanceFiche);
    essayer("le défilement", apresDefilement);
    essayer("le garde-fou", surveiller);
}
const rafraichirBientot = regrouper(rafraichir, 90);

let imageDemandee = 0;
function apresDefilement() {
    imageDemandee = 0;
    suivreEntete();
    suivreProfil();
    essayer("les en-têtes collés", suivreCollection);
    if (COLL.zone && !COLL.zone.hidden) COLL.barre.suivre();
}

/* L'en-tête « Étiquettes » du profil vient d'être redessiné : la barre d'étiquettes y est reposée tout
   de suite (l'observateur passe avant l'affichage), sans attendre le rafraîchissement groupé. */
function reparerProfil() {
    if (!HTML.classList.contains("wpx-profil-fixe")) return;
    const p = lireProfil();
    if (!p) return;
    installerAlbumsProfil(p);
    installerLiensProfil(p);
    suivreProfil();
}

function observer() {
    new MutationObserver(changements => {
        let utile = false;
        let profil = false;
        let echange = false;
        let livre = false;
        let fiche = false;
        for (const c of changements) {
            const cible = c.target;
            if (cible.nodeType === 1 && cible.closest("[data-wpx]")) continue;
            /* un bouton « Historique » posé ou retiré par l'outil : rien à refaire (la fenêtre d'échange garde son état) */
            if ([...c.addedNodes, ...c.removedNodes].every(n => n.nodeType === 1 && n.classList.contains("wpx-histo-btn"))) continue;
            utile = true;
            if (cible.id === "pvbloc" || cible.id === "profile") profil = true;
            if (cible.id === "composer") echange = true;
            if (cible.id === "album") livre = true;
            if (cible.id === "shDyn") fiche = true;
        }
        if (profil) essayer("le profil", reparerProfil);
        if (echange) essayer("l'échange", reinitialiserEchange);      // une nouvelle fenêtre d'échange : boutons posés avant l'affichage
        if (livre) essayer("les livres", () => installerLivre(vueCourante() === "album"));     // un livre redessiné : ses boutons, avant l'affichage
        if (fiche) essayer("les chances", installerChanceFiche);       // la fiche d'une carte redessinée : sa ligne de chance
        if (utile) rafraichirBientot();
    }).observe(D.body, {childList: true, subtree: true});

    /* changement de page ou d'onglet de la collection (les onglets eux-mêmes : la rangée collée porte les classes du
       script, wpx-colle et wpx-amarre, qui ne demandent rien) */
    const classes = new MutationObserver(rafraichirBientot);
    $$("main section.view").forEach(vue => classes.observe(vue, {attributes: true, attributeFilter: ["class"]}));
    const sousOnglets = $("#ctabs");
    if (sousOnglets) new MutationObserver(changements => {
        if (changements.some(c => c.target !== sousOnglets)) rafraichirBientot();
    }).observe(sousOnglets, {attributes: true, attributeFilter: ["class"], subtree: true});

    const entete = $("body > header.top");
    if (entete) new ResizeObserver(mesurerEntete).observe(entete);
    new MutationObserver(appliquerAncienSite).observe(D.body, {attributes: true, attributeFilter: ["class"]});      // menu-neuf posée par menu.js

    addEventListener("scroll", () => {
        if (!imageDemandee) imageDemandee = requestAnimationFrame(apresDefilement);
    }, {passive: true});
    addEventListener("resize", rafraichirBientot, {passive: true});

    /* une image de carte qui ne charge pas : repli sur l'original Wikimedia (error ne remonte pas → capture) */
    if (IMG_ACTIF) {
        D.addEventListener("error", e => {
            const img = e.target;
            if (img && img.tagName === "IMG" && img.closest(".card .pic")) reparerImageCarte(img);
        }, true);
        setTimeout(balayerImages, 1500);                 // les images déjà cassées au chargement
        setTimeout(balayerImages, 5000);
    }

    D.addEventListener("pointerdown", e => {
        const menu = e.target.closest && e.target.closest(".wpx-menu");
        fermerMenus(menu);
    }, true);
    /* les relais déposés dans la page (le livre, les chances), les touches des livres (avant celles du site), et les
       liens vers une page d'un livre (au chargement, ou collés dans la barre d'adresse sur le site) */
    installerRelais();
    D.addEventListener("keydown", toucheLivre, true);
    addEventListener("hashchange", ouvrirLienDeLivre);
    ouvrirLienDeLivre();
    D.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        if (PANNEAU.vue && !PANNEAU.vue.hidden) fermerReglages();
        else if ($(".wpx-menu[open]")) fermerMenus();
        else if (EXP.ouvert && !$(".veil.on")) fermerExport();
        else if (DSC.vue && !DSC.vue.hidden) fermerDiscord();
        else if (HIS.vue && !HIS.vue.hidden && !$(".veil.on")) fermerHistorique();
        else if (PAQ.vue && !PAQ.vue.hidden && !$(".veil.on")) fermerDernieres();
    });

    /* (12.22) un onglet qui redevient visible reprend les envois Discord en attente (un onglet caché lâche la main) */
    D.addEventListener("visibilitychange", () => {
        if (!D.hidden) pousserDiscord();
    });

    /* derniers paquets : chaque paquet est noté à la réponse du serveur, l'écran de révélation suit la relance ;
       « Voir mes … dernières cartes » ouvre la grille */
    if (CONFIG.DERNIERS_PAQUETS.actif) installerEspionPaquets();
    const rangee = $("#row5");
    const revelation = $("#reveal");
    if (rangee && revelation) {
        new MutationObserver(noterRevelation).observe(rangee, {childList: true});
        new MutationObserver(() => {
            if (!revelation.classList.contains("on")) PAQ.courant = null;     // le paquet suivant sera un nouveau paquet
        }).observe(revelation, {attributes: true, attributeFilter: ["class"]});
    }
    D.addEventListener("click", e => {
        if (e.target.closest && e.target.closest("[data-wpx-dernieres]")) ouvrirDernieres();
        if (e.target.closest && e.target.closest("[data-wpx-pq-bascule]")) basculerPanneauPaquets();
        if (e.target.closest && e.target.closest("[data-wpx-discord]")) ouvrirDiscord();
        const histo = e.target.closest && e.target.closest("[data-wpx-histo]");
        if (histo) ouvrirHistorique(histo.dataset.wpxHisto);
        /* un nom de joueur dans l'historique : le site ouvre son profil, le panneau s'efface */
        if (HIS.vue && !HIS.vue.hidden && e.target.closest && e.target.closest("#wpx-histo [data-profile]")) fermerHistorique();
        /* un échange accepté : le site le range dans son historique, on le relit un peu après */
        if (e.target.closest && e.target.closest("[data-taccept]")) setTimeout(() => { HIS.lecture = 0; lireEchanges(); }, 3000);
    });
    setInterval(() => {
        if (vueCourante() === "packs") rendrePanneauPaquets();             // « il y a 3 min » avance
    }, 60000);

    /* fenêtre d'échange : le filtre Doublons, « Chercher plus loin », et les filtres du site */
    D.addEventListener("click", e => {
        if (!e.target.closest) return;
        const dup = e.target.closest("[data-wpx-dup]");
        if (dup) {
            e.preventDefault();
            basculerDoublonsEchange(dup.dataset.wpxDup);
            return;
        }
        const plus = e.target.closest("[data-wpx-tcplus]");
        if (plus) {
            chargerDoublonsEchange(plus.dataset.wpxTcplus);
            return;
        }
        const filtre = e.target.closest('[id^="tcRar-"] button[data-r]');
        if (!filtre) return;
        const cle = filtre.closest('[id^="tcRar-"]').id.slice(6);
        if (!ECH.actif[cle]) return;
        if (filtre.dataset.r === "*") {
            /* « Toutes » retire tous les filtres, Doublons compris */
            ECH.actif[cle] = false;
            ECH.jeton[cle]++;
            ECH.enCours[cle] = false;
            installerEchange();
        } else {
            /* une rareté en plus ou en moins : le site recharge la première page, puis on cherche les doublons */
            ECH.jeton[cle]++;
            attendreColonne(cle).then(() => chargerDoublonsEchange(cle));
        }
    }, true);
    /* une recherche dans une colonne : le site attend 250 ms après la dernière touche puis recharge la
       première page. On arrête de charger, et on ne reprend qu'une fois sa réponse dessinée. */
    D.addEventListener("input", e => {
        const champ = e.target && e.target.closest && e.target.closest("#composer [data-tq]");
        if (!champ) return;
        const cle = champ.dataset.tq;
        if (!ECH.actif[cle]) return;
        ECH.jeton[cle]++;
        ECH.enCours[cle] = false;
        const depuis = Date.now();
        clearTimeout(ECH.saisie[cle]);
        ECH.saisie[cle] = setTimeout(async () => {
            if (ECH.rendu[cle] < depuis + 250) await attendreColonne(cle);
            if (ECH.actif[cle]) chargerDoublonsEchange(cle);
        }, 700);
    }, true);

    /* Pages de la collection d'un profil : le site remonte au début des cartes en laissant 140 px au-dessus,
       ce qui les glisse sous la partie fixe. Une fois son défilement fini, on les ramène juste dessous. */
    D.addEventListener("click", e => {
        if (!HTML.classList.contains("wpx-profil-fixe") || !e.target.closest || !e.target.closest("[data-pcpage]")) return;
        setTimeout(() => quandDefilementFini(() => {
            const ecart = ecartCollection();
            if (ecart < -2) scrollTo({top: Math.max(0, scrollY + ecart), behavior: "smooth"});
        }), 60);
    }, true);

    if (CONFIG.CLIC_DROIT.actif) {
        /* le menu natif du clic droit, même si le site venait à l'empêcher */
        D.addEventListener("contextmenu", e => e.stopImmediatePropagation(), true);
    }
}

function demarrer() {
    installerStyles();
    if (CONFIG.ENTETE.fixe) HTML.classList.add("wpx-entete");
    appliquerAncienSite();
    HTML.classList.toggle("wpx-clean", memoire.lire("clean", false) === true);
    HTML.classList.toggle("wpx-large", memoire.lire("large", false) === true);
    chargerPaquets();
    observer();
    demarrerDiscord();
    rafraichir();
    console.info("Album+cleaner+Maximisation v" + CONFIG.VERSION + " : script actif.");
}

if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", demarrer, {once: true});
else demarrer();

})();
