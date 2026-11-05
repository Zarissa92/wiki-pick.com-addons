// ==UserScript==
// @name         [test]Album+cleaner — tri par date d'obtention (addon)
// @namespace    local
// @version      2.5
// @description  Addon de Album+cleaner+Maximisation : garde toute ta collection dans le navigateur (mise à jour par différences), trie les cartes de la page par date d'obtention, et ouvre « Mes dernières cartes » (les N dernières obtenues, toute la collection) pour les étiqueter, les verrouiller ou les mettre de côté pour la vente, une par une ou en lot, par les fiches du site.
// @match        https://wiki-pick.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
"use strict";

/* Une seule instance, même si le gestionnaire injecte le script deux fois */
if (window.__wpxTriDate) return;
window.__wpxTriDate = true;

/* ==========================================================================
   CONFIGURATION
   ========================================================================== */
const CONFIG = {
    VERSION: "2.5",

    /*
     * TRI DE LA PAGE : les N premières cartes de la page, dans l'ordre du site ; les suivantes gardent leur place
     * après elles. Le site n'affiche qu'une page à la fois : le tri ne porte que sur elle.
     */
    cartesParDefaut: 100,
    cartesMax: 100,

    /*
     * MES DERNIÈRES CARTES : les N dernières cartes obtenues, dans toute la collection.
     *   marge     : candidats lus en plus des N (par identifiant d'exemplaire), pour ne pas en manquer
     *   histoFrais : une carte reçue par échange ou achetée est relue si sa fiche date de plus de N minutes
     *   pauseLot  : pause entre deux cartes d'une action en lot (ms)
     *   attenteMs : attente au plus d'une fiche ou d'une réponse du site pendant une action (ms)
     */
    DERNIERES: {
        parDefaut: 200,
        min: 1,
        max: 1000,
        marge: 100,
        histoFrais: 60,
        pauseLot: 500,
        attenteMs: 8000
    },

    /*
     * LECTURES AU SITE (fiches /api/card, pages de la collection) : quelques-unes à la fois, une pause entre deux
     * lots, comme les lectures du script principal (CGU).
     *   relireMin : une carte dont l'exemplaire affiché n'est pas encore connu est relue, au plus toutes les N minutes ;
     *               une fiche illisible n'est pas redemandée avant
     */
    lecturesSimultanees: 4,
    pauseMs: 400,
    pause429Ms: 5000,
    essais429: 3,
    relireMin: 10,

    /* attente après un redessin de la grille, avant de trier (ms) */
    delaiMs: 300,

    TEXTES: {
        site: "Ordre du site",
        recent: "Date : plus récentes d'abord",
        ancien: "Date : plus anciennes d'abord",
        aide: "Trier les cartes de la page par date d'obtention",
        nombreAide: "Nombre de cartes : OK (ou Entrée) ouvre « Mes dernières cartes » sur toute la collection ; le tri de la page en prend au plus 100",
        validerAide: "Valider le nombre (ou Entrée)",
        premieres: "cartes",
        lecture: "Dates : ",
        illisibles: " illisible(s), placée(s) à la fin",
        dernieres: "Mes dernières cartes",
        dernieresAide: "Tes N dernières cartes obtenues, dans toute la collection, pour les étiqueter, les verrouiller ou les vendre"
    }
};
const T = CONFIG.TEXTES;
const DN = CONFIG.DERNIERES;
const MODES = ["site", "recent", "ancien"];

/* ==========================================================================
   OUTILS (les mêmes que le script principal)
   ========================================================================== */
const D = document;
const $ = (selecteur, racine) => (racine || D).querySelector(selecteur);
const $$ = (selecteur, racine) => Array.from((racine || D).querySelectorAll(selecteur));
const pause = ms => new Promise(r => setTimeout(r, ms));
const FORMAT = new Intl.NumberFormat("fr-FR");
const nombre = n => FORMAT.format(n);
const pluriel = (n, un, plusieurs) => nombre(n) + " " + (n > 1 ? plusieurs || un + "s" : un);
const propre = texte => String(texte == null ? "" : texte).replace(/\s+/g, " ").trim();
const echapper = t => String(t == null ? "" : t).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
const RANGS = {C: "Commune", PC: "Inhabituelle", R: "Rare", SR: "Épique", UR: "Exceptionnelle", L: "Légendaire", M: "Mythique",
    WBC: "Exclusive", SIXSEVEN: "Exclusive", EXC: "Exclusive"};

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

/* Mémoire du navigateur (préfixe « wpx. », comme le script principal) */
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
            return false;
        }
    }
};

/* (1.0) l'ancien script gardait le mode en texte brut (« recent ») : il passe au format de la mémoire commune */
(function migrer() {
    try {
        const brut = localStorage.getItem("wpx.tri.mode");
        if (brut !== null) JSON.parse(brut);
    } catch (erreur) {
        memoire.ecrire("tri.mode", localStorage.getItem("wpx.tri.mode"));
    }
})();

let mode = MODES.includes(memoire.lire("tri.mode", "site")) ? memoire.lire("tri.mode", "site") : "site";
let nCartes = (() => {
    const n = parseInt(memoire.lire("tri.n", CONFIG.cartesParDefaut), 10);
    return n >= 1 && n <= CONFIG.cartesMax ? n : CONFIG.cartesParDefaut;
})();

/* le pseudo du joueur connecté, comme le script principal (pseudoJoueur) */
const pseudoJoueur = () => ["#meBtn > span:not(.av):last-of-type", "#menuName", "#tiroirNom"]
    .map(choix => propre(($(choix) || {}).textContent)).find(nom => nom && nom !== "—" && nom !== "Wiki-Pick") || "";

/* une date du site (secondes ou millisecondes) en millisecondes */
const enMs = ts => (ts && ts < 1e12 ? ts * 1000 : ts || 0);
const dateCourte = ts => {
    if (!ts) return "date inconnue";
    const d = new Date(enMs(ts));
    return d.toLocaleDateString("fr-FR", {day: "2-digit", month: "2-digit", year: "2-digit"}) + " "
        + d.toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit"});
};

/* une lecture au site, avec nouvel essai si le site répond « trop de requêtes » */
async function lireJSON(chemin) {
    for (let essai = 0; essai <= CONFIG.essais429; essai++) {
        const r = await fetch(location.origin + chemin, {credentials: "same-origin", headers: {Accept: "application/json"}});
        if (r.status === 429) {
            await pause(CONFIG.pause429Ms * (essai + 1));
            continue;
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        /* (2.2) le texte, décodé ici : sous Firefox, les objets de .json() appartiennent à la page et ne peuvent pas
           être rangés dans ceux du script (« XrayWrapper ») */
        return JSON.parse(await r.text());
    }
    throw new Error("trop de requêtes");
}

/* ==========================================================================
   LE CACHE DES DATES
   wpx.tri.dates2 : {cartes: {cid: {ex: {idExemplaire: ts}, fl: {idExemplaire: 1 chromatique + 2 Halloween}, max, t}}}
   ========================================================================== */
function lireCache() {
    const c = memoire.lire("tri.dates2", null);
    return c && c.cartes && typeof c.cartes === "object" ? c : {cartes: {}};
}

function ecrireCache(cache) {
    if (memoire.ecrire("tri.dates2", cache)) return;
    /* mémoire pleine : on oublie la moitié la plus ancienne et on réessaie */
    const entrees = Object.entries(cache.cartes).sort((a, b) => (b[1].t || 0) - (a[1].t || 0));
    cache.cartes = Object.fromEntries(entrees.slice(0, Math.floor(entrees.length / 2)));
    memoire.ecrire("tri.dates2", cache);
}

/* (1.3) ce que la fiche dit de la carte elle-même (image, nom, description, rang), où que le site le range */
function infosDeFiche(fiche) {
    const sources = [fiche, fiche && fiche.card, fiche && fiche.carte, fiche && fiche.c].filter(o => o && typeof o === "object");
    const champ = (...noms) => {
        for (const o of sources) for (const nom of noms) if (typeof o[nom] === "string" && o[nom]) return o[nom];
        return "";
    };
    return {img: champ("img", "image", "thumb"), n: champ("n", "title", "titre", "nom"), d: champ("d", "desc", "description"),
            r: champ("r", "rarity", "rang")};
}

function entreeDe(fiche) {
    const ex = {}, fl = {};
    let max = 0;
    for (const m of (fiche && fiche.mine) || []) {
        if (!m || m.id == null) continue;
        const t = Number(m.prov && m.prov.ts) || 0;
        ex[String(m.id)] = t;
        const f = (m.sh || m.shiny ? 1 : 0) + (m.hw ? 2 : 0);
        if (f) fl[String(m.id)] = f;
        if (t > max) max = t;
    }
    return {ex, fl, max, t: Date.now(), i: infosDeFiche(fiche)};
}

/* ==========================================================================
   LECTURE DES FICHES (commune au tri de la page et aux dernières cartes)
   demandes : [{cid, id (exemplaire, facultatif), frais (minutes, facultatif)}]
   ========================================================================== */
const RATES = new Map();

function aLireFiche(dem, cache, maintenant) {
    if (!dem.cid) return false;
    if (maintenant - (RATES.get(dem.cid) || 0) < CONFIG.relireMin * 60000) return false;
    const e = cache.cartes[dem.cid];
    if (!e) return true;
    if (dem.infos && !e.i) return true;                    // (1.3) une fiche lue avant que l'image n'y soit gardée
    const age = maintenant - (e.t || 0);
    if (dem.frais != null && age > dem.frais * 60000) return true;
    return dem.id != null && !(e.ex && String(dem.id) in e.ex) && age > CONFIG.relireMin * 60000;
}

/* lit ce qui manque, par petits lots ; continuer() faux : on s'arrête. Renvoie le nombre de fiches ratées. */
async function lireFiches(demandes, continuer, progres) {
    const cache = lireCache();
    const maintenant = Date.now();
    const cids = [...new Set(demandes.filter(d => aLireFiche(d, cache, maintenant)).map(d => d.cid))];
    let rates = 0;
    for (let i = 0; i < cids.length; i += CONFIG.lecturesSimultanees) {
        if (!continuer()) break;
        const lot = cids.slice(i, i + CONFIG.lecturesSimultanees);
        const reponses = await Promise.allSettled(lot.map(cid => lireJSON("/api/card?cid=" + encodeURIComponent(cid))));
        reponses.forEach((r, k) => {
            if (r.status === "fulfilled") {
                cache.cartes[lot[k]] = entreeDe(r.value);
                RATES.delete(lot[k]);
            } else {
                rates++;
                RATES.set(lot[k], Date.now());
                console.warn("[tri par date] fiche illisible :", lot[k], r.reason);
            }
        });
        ecrireCache(cache);
        /* (2.0) les dates lues vont aussi dans la base de la collection (si elle existe) */
        const dates = [];
        for (const cid of lot) for (const [id, t] of Object.entries((cache.cartes[cid] || {}).ex || {})) if (t) dates.push([+id, {t}]);
        if (BASE.etat && baseInitialisee(BASE.etat)) await modifierExemplaires(dates).catch(() => {});
        progres(Math.min(i + lot.length, cids.length), cids.length);
        if (i + lot.length < cids.length) await pause(CONFIG.pauseMs);
    }
    return rates;
}

/* ==========================================================================
   TRI DE LA PAGE : LA GRILLE DE « MA COLLECTION »
   Seulement sur la page Ma collection, hors de l'onglet Étiquettes ; la grille est celle qui porte le plus de
   cartes (pas celles des panneaux du script principal, marqués data-wpx). Une tuile = un enfant direct de la grille
   qui contient une carte : c'est elle qu'on déplace.
   ========================================================================== */
function grille() {
    const vue = $("#v-coll");
    if (!vue || !vue.classList.contains("on")) return null;
    const onglet = $("#ctabs button.on");
    if (onglet && onglet.dataset.c === "album") return null;
    let meilleure = null, plus = 0;
    for (const g of $$(".grid", vue)) {
        if (g.closest("section.album, [data-wpx]") || !g.getClientRects().length) continue;
        const n = tuiles(g).length;
        if (n > plus) {
            meilleure = g;
            plus = n;
        }
    }
    return meilleure;
}

const tuiles = g => Array.from(g.children).filter(e => e.querySelector(".card[data-cle]"));
const cidDe = t => ($(".card[data-cle]", t).getAttribute("data-cle") || "").split("#")[0];
const exemplaireDe = t => {
    const b = $("button[data-lock]", t);
    return b ? b.dataset.lock : null;
};

/* la date de l'exemplaire affiché si on la connaît, sinon la plus récente de la carte (0 : inconnue) */
function dateDe(t, cache) {
    const e = cache.cartes[cidDe(t)];
    if (!e) return 0;
    const id = exemplaireDe(t);
    if (id && e.ex && e.ex[id] !== undefined) return e.ex[id];
    return e.max || 0;
}

const TRI = {grille: null, ordreSite: [], jeton: 0, occupe: false, encore: false, minuterie: 0, ui: null};

/* L'ordre du site est suivi à chaque redessin : les tuiles déjà connues gardent leur rang, les nouvelles s'ajoutent
   dans l'ordre où le site les pose. « Ordre du site » le remet tel quel, même après un changement de page. */
function suivreOrdreSite(g, actuelles) {
    if (TRI.grille !== g) {
        TRI.grille = g;
        TRI.ordreSite = actuelles.slice();
        return;
    }
    const presentes = new Set(actuelles);
    const connues = TRI.ordreSite.filter(t => presentes.has(t));
    const vues = new Set(connues);
    TRI.ordreSite = connues.concat(actuelles.filter(t => !vues.has(t)));
}

/* date seule ; même date ou aucune : départage par identifiant (jamais par la rareté) ; sans date : à la fin */
function comparer(cache) {
    const parCid = (x, y) => {
        const a = cidDe(x), b = cidDe(y);
        return a < b ? -1 : a > b ? 1 : 0;
    };
    return (x, y) => {
        const dx = dateDe(x, cache), dy = dateDe(y, cache);
        if (!dx || !dy) return dx === dy ? parCid(x, y) : dx ? -1 : 1;
        if (dx === dy) return parCid(x, y);
        return mode === "recent" ? dy - dx : dx - dy;
    };
}

/* remet les tuiles dans l'ordre voulu, seulement s'il diffère (sinon rien ne bouge) */
function placer(g, ordre) {
    const actuel = tuiles(g);
    const cible = ordre.filter(t => t.parentElement === g);
    if (!actuel.length || (actuel.length === cible.length && actuel.every((t, i) => t === cible[i]))) return;
    /* les tuiles reprennent la place de la première, sans passer derrière ce que le site pose après elles */
    const avant = actuel[0].previousSibling;
    const fragment = D.createDocumentFragment();
    cible.forEach(t => fragment.append(t));
    g.insertBefore(fragment, avant ? avant.nextSibling : g.firstChild);
}

async function trier() {
    majVisibiliteBouton();
    const g = grille();
    majInterface(g);
    if (!g) return;
    suivreOrdreSite(g, tuiles(g));
    if (TRI.occupe) {
        TRI.encore = true;
        return;
    }
    if (mode === "site") {
        placer(g, TRI.ordreSite);
        statut("");
        return;
    }
    const aTrier = TRI.ordreSite.slice(0, nCartes);
    const reste = TRI.ordreSite.slice(nCartes);
    const jeton = ++TRI.jeton;
    TRI.occupe = true;
    try {
        const demandes = aTrier.map(t => ({cid: cidDe(t), id: exemplaireDe(t)}));
        const rates = await lireFiches(demandes, () => jeton === TRI.jeton,
            (fait, total) => statut(T.lecture + fait + " / " + total + "…"));
        if (jeton !== TRI.jeton || mode === "site" || !g.isConnected) return;
        const cache = lireCache();
        placer(g, aTrier.slice().sort(comparer(cache)).concat(reste));
        statut(rates ? rates + T.illisibles : "");
    } catch (erreur) {
        console.error("[tri par date]", erreur);
        statut("Erreur : voir la console");
    } finally {
        TRI.occupe = false;
        if (TRI.encore) {
            TRI.encore = false;
            planifier();
        }
    }
}

function planifier() {
    clearTimeout(TRI.minuterie);
    TRI.minuterie = setTimeout(trier, CONFIG.delaiMs);
}

/* ==========================================================================
   MES DERNIÈRES CARTES : LES CANDIDATS
   La collection (/api/collection/page) est rangée par rang, puis par identifiant d'exemplaire, du plus grand au
   plus petit. Un identifiant suit l'ordre de création de l'exemplaire : les cartes des paquets sont donc en tête de
   chaque rang. On lit la première page de chaque rang (et des chromatiques, rar=SH), puis la suivante d'un rang
   tant qu'elle peut encore contenir l'un des N + marge plus grands identifiants.
   Une carte reçue par échange ou achetée garde un ancien identifiant : elle vient de l'historique d'échanges et
   d'achats du site, et de celui que le script principal garde dans ce navigateur.
   Puis la vraie date d'obtention de chaque exemplaire est lue sur sa fiche (avec le cache), et c'est elle qui classe.
   ========================================================================== */
const RANGS_COLLECTION = ["M", "L", "UR", "SR", "R", "PC", "C", "SH"];

/* le chemin d'image d'une ligne : complet, sur le site (/perso/…), ou relatif à l'un des préfixes Wikimedia (imgp) */
/* (1.7) Le site abrège ses chemins : « 0a/a8/Fichier.jpg/960px-… ». Le premier caractère est le préfixe à prendre dans
   imgp (0 : vignettes, 1 : originaux), le second est le vrai début du chemin Wikimedia : « a/a8/Fichier.jpg/… ». */
function urlImage(chemin, imgp) {
    if (!chemin) return "";
    if (/^(https:|data:image\/)/.test(chemin) || chemin.startsWith("/")) return chemin;
    const abrege = /^([0-9])([0-9a-f])\/([0-9a-f]{2}\/.+)$/.exec(chemin);
    if (abrege && abrege[3][0] === abrege[2] && imgp[+abrege[1]]) return imgp[+abrege[1]] + abrege[2] + "/" + abrege[3];
    const vignette = /\/\d+px-[^/]*$/.test(chemin.split("?")[0]);
    return ((vignette ? imgp[0] : imgp[1]) || "") + chemin;
}

/* l'URL du fichier original Wikimedia à partir d'une URL de vignette, ou "" (comme le script principal) */
function urlOriginale(src) {
    const m = /^https:\/\/(?:upload|thumb)\.wikimedia\.org\/(.+)\/thumb\/(.+\/[^/]+)\/[^/]+$/.exec(String(src || "").split("?")[0]);
    return m ? "https://upload.wikimedia.org/" + m[1] + "/" + m[2] : "";
}

async function candidatsParIdentifiant(n, continuer, progres) {
    const garder = n + DN.marge;
    const exemplaires = new Map();             // identifiant -> élément
    const infos = {tags: [], aVendre: new Set(), imgp: []};
    let aFaire = RANGS_COLLECTION.map(rar => ({rar, page: 0}));
    let lues = 0;
    while (aFaire.length && continuer()) {
        const vus = [];
        for (const t of aFaire) {
            if (!continuer()) break;
            const d = await lireJSON("/api/collection/page?" + new URLSearchParams({vue: "cartes", q: "", rar: t.rar, tag: "", excl: "1", page: t.page}));
            progres(++lues);
            if (!d || !Array.isArray(d.lignes)) continue;
            if (Array.isArray(d.imgp)) infos.imgp = d.imgp;
            if (Array.isArray(d.tags)) infos.tags = d.tags;
            if (Array.isArray(d.aVendre)) infos.aVendre = new Set(d.aVendre.map(String));
            let dernier = Infinity;
            for (const l of d.lignes) {
                if (!Array.isArray(l) || !Array.isArray(l[9])) continue;
                for (const id of l[9]) {
                    dernier = Math.min(dernier, id);
                    const deja = exemplaires.get(id);
                    if (deja) {
                        if (t.rar === "SH") deja.sh = true;
                        continue;
                    }
                    exemplaires.set(id, {id, cid: String(l[0]), n: String(l[1] || l[0]), d: String(l[2] || ""),
                        img: urlImage(l[3], infos.imgp), r: String(l[4] || "C"), locked: !!l[8],
                        tags: Array.isArray(l[10]) ? l[10].slice() : [], sh: t.rar === "SH", hw: false});
                }
            }
            if (t.page + 1 < (d.pages || 1) && dernier !== Infinity) vus.push({rar: t.rar, page: t.page + 1, dernier});
            await pause(CONFIG.pauseMs);
        }
        /* le seuil : le garder-ième plus grand identifiant ; une page suivante n'est lue que si elle peut faire mieux */
        const ids = [...exemplaires.keys()].sort((a, b) => b - a);
        const seuil = ids.length >= garder ? ids[garder - 1] : -Infinity;
        aFaire = vus.filter(v => v.dernier > seuil);
    }
    const tous = [...exemplaires.values()].sort((a, b) => b.id - a.id).slice(0, garder);
    return {tous, infos};
}

/* les cartes reçues par échange ou achetées : le site (ses derniers) et le script principal (tout ce qu'il a vu) */
async function candidatsHistorique(n) {
    const recues = [];
    const ajouter = (c, t) => {
        const cid = String((c && (c.cid || c[0])) || "");
        if (!cid) return;
        recues.push(Array.isArray(c)
            ? {cid, n: String(c[1] || cid), r: String(c[2] || "C"), sh: !!(c[3] & 1), hw: !!(c[3] & 2), t: enMs(t)}
            : {cid, n: String(c.title || c.n || cid), r: String(c.rarity || c.r || "C"), sh: !!(c.shiny || c.sh), hw: !!c.hw,
               img: String(c.img || ""), t: enMs(t)});
    };
    try {
        const d = await lireJSON("/api/trades?box=history");
        for (const e of (d && d.trades) || []) {
            if (!e || e.status !== "accepted") continue;
            for (const c of (e.incoming ? e.give : e.take) || []) ajouter(c, Number(e.closed || e.created) || 0);
        }
    } catch (erreur) { /* l'historique du site manque : on garde celui du navigateur */ }
    try {
        const d = await lireJSON("/api/purchases?page=0");
        for (const a of (d && d.items) || []) {
            if (!a || a.vente) continue;
            for (const c of (a.lot && Array.isArray(a.lot.cartes) ? a.lot.cartes : [a])) ajouter(c, Number(a.ts) || 0);
        }
    } catch (erreur) { /* idem */ }
    /* l'historique gardé par le script principal (wpx.histo.<moi>, puis wpx.histo.<moi>.<partenaire>) */
    const moi = pseudoJoueur().toLowerCase();
    const index = moi ? memoire.lire("histo." + moi, null) : null;
    if (index && index.p && typeof index.p === "object") {
        for (const cle of Object.keys(index.p)) {
            const liste = memoire.lire("histo." + moi + "." + cle, null);
            for (const e of (liste && Array.isArray(liste.l) ? liste.l : [])) {
                if (e && e.s === "a") (e.r || []).forEach(c => ajouter(c, e.t));
            }
        }
    }
    const vus = new Set();
    return recues.sort((a, b) => b.t - a.t).filter(c => {
        const cle = c.cid + (c.sh ? "#sh" : "") + (c.hw ? "#hw" : "");
        if (vus.has(cle)) return false;
        vus.add(cle);
        return true;
    }).slice(0, n);
}

/* ==========================================================================
   (2.0) LA BASE DE LA COLLECTION
   Toute ta collection, gardée dans le navigateur (IndexedDB « wpx-collection », partagée avec tes autres outils sur
   wiki-pick.com) : un enregistrement par exemplaire {id, cid, n, d, img, r, sh, locked, tags, t (date d'obtention)}.
   - Initialisation, une fois : toutes les pages de chaque rang (M … C), puis des chromatiques (SH). Reprenable :
     la page atteinte est notée après chaque page.
   - Ensuite, seulement les différences avec la dernière fois (T-1) :
       * chaque liste (un rang, ou les chromatiques) est rangée par identifiant décroissant : les nouveaux exemplaires
         sont en tête, on lit jusqu'à retomber sur un identifiant connu ;
       * le site donne le nombre d'exemplaires de la liste : s'il ne colle pas, une recherche par dichotomie trouve la
         page qui a bougé (une carte vendue, ou reçue avec un ancien identifiant), on la relit, et ainsi de suite ;
       * le site donne aussi le nombre d'exemplaires de chaque étiquette : seule une étiquette dont le compte a changé
         est relue ;
       * les cadenas posés (par le site ou tes outils) sont notés au passage.
   - Deux changements qui se compensent dans une même liste passent inaperçus : « Tout vérifier » relit tout.
   ========================================================================== */
const BASE = {nom: "wpx-collection", db: null, occupe: false, etat: null};
const LISTES_RANGS = ["M", "L", "UR", "SR", "R", "PC", "C"];
const LISTES_BASE = LISTES_RANGS.concat("SH");
const BUDGET_LISTE = 60;            // pages lues au plus par liste pour une mise à jour, avant de la relire en entier

/* (2.1) le nom d'une liste dans le journal ; les pages faites et prévues de la construction */
const nomListe = rar => (rar === "SH" ? "Chromatiques" : (RANGS[rar] || rar) + "s");
const pagesFaites = etat => Object.values((etat.init && etat.init.listes) || {}).reduce((s, l) => s + (l.page || 0), 0);
function pagesPrevues(etat) {
    const listes = (etat.init && etat.init.listes) || {};
    const parRang = (etat.resume && etat.resume.parRang) || {};
    /* pour chaque liste : son nombre de pages s'il est connu, sinon une estimation d'après le résumé de la collection */
    return LISTES_BASE.reduce((s, rar) => s + ((listes[rar] && listes[rar].pages > 1) ? listes[rar].pages
        : rar === "SH" ? ((listes.SH && listes.SH.pages) || 1) : Math.max(1, Math.ceil((parRang[rar] || 0) / 100))), 0);
}

/* (2.1) le journal de la base : gardé pour la session de l'onglet (500 lignes), affiché dans le tableau de bord */
const JB = {lignes: [], prevu: 0};
try {
    const garde = JSON.parse(sessionStorage.getItem("wpx.base.journal") || "null");
    if (Array.isArray(garde)) JB.lignes = garde;
} catch (erreur) { /* rien */ }
function journalBase(texte, niveau) {
    JB.lignes.push([Date.now(), String(texte), niveau || ""]);
    if (JB.lignes.length > 500) JB.lignes.splice(0, JB.lignes.length - 500);
    if (niveau === "erreur" || niveau === "alerte") console.warn("[base]", texte);
    if (!JB.prevu) {
        JB.prevu = setTimeout(() => {
            JB.prevu = 0;
            try { sessionStorage.setItem("wpx.base.journal", JSON.stringify(JB.lignes)); } catch (erreur) { /* rien */ }
        }, 1000);
    }
    ajouterAuJournal(JB.lignes[JB.lignes.length - 1]);
}

/* (2.1) la progression du travail en cours : la barre du tableau de bord la suit */
function avancer(fait, total, texte) {
    BASE.progres = {fait, total, texte};
    majBarreBase();
}

function ouvrirBase() {
    if (BASE.db) return Promise.resolve(BASE.db);
    return new Promise((ok, ko) => {
        const req = indexedDB.open(BASE.nom, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            const ex = db.createObjectStore("ex", {keyPath: "id"});
            ex.createIndex("tags", "tags", {multiEntry: true});
            ex.createIndex("cid", "cid");
            ex.createIndex("r", "r");
            ex.createIndex("shk", "shk");           // 1 pour une chromatique, absent sinon
            db.createObjectStore("meta");
        };
        req.onsuccess = () => {
            BASE.db = req.result;
            BASE.db.onversionchange = () => { BASE.db.close(); BASE.db = null; };
            ok(BASE.db);
        };
        req.onerror = () => ko(req.error);
        req.onblocked = () => ko(new Error("base bloquée par un autre onglet"));
    });
}
/* (2.3) Sous Firefox, ce que la base renvoie appartient à la page : le script ne peut pas y ranger ses propres objets
   (« XrayWrapper »). Tout ce qui est lu dans la base est donc recopié côté script avant d'être utilisé ou modifié. */
const cloner = v => (v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v);
const attendreReq = req => new Promise((ok, ko) => { req.onsuccess = () => ok(cloner(req.result)); req.onerror = () => ko(req.error); });
const attendreTx = tx => new Promise((ok, ko) => { tx.oncomplete = () => ok(); tx.onerror = tx.onabort = () => ko(tx.error || new Error("transaction annulée")); });

async function lireEtatBase() {
    const db = await ouvrirBase();
    BASE.etat = (await attendreReq(db.transaction("meta").objectStore("meta").get("etat"))) || {};
    return BASE.etat;
}
async function ecrireEtatBase(etat) {
    const db = await ouvrirBase();
    const tx = db.transaction("meta", "readwrite");
    tx.objectStore("meta").put(etat, "etat");
    await attendreTx(tx);
    BASE.etat = etat;
}
const baseInitialisee = etat => !!(etat && etat.init && etat.init.fini);

/* les lignes d'une page (rang ou chromatiques) dans la base ; un exemplaire garde sa date et sa marque chromatique */
async function ecrireLignes(lignes, chromatiques) {
    const db = await ouvrirBase();
    const tx = db.transaction("ex", "readwrite");
    const s = tx.objectStore("ex");
    for (const l of lignes) {
        if (!Array.isArray(l) || !Array.isArray(l[9])) continue;
        for (const id of l[9]) {
            if (!Number.isInteger(id)) continue;
            const lecture = s.get(id);
            lecture.onsuccess = () => {
                const a = cloner(lecture.result);
                const sh = chromatiques || !!(a && a.sh);
                const e = {id, cid: String(l[0]), n: String(l[1] || l[0]), d: String(l[2] || ""), img: String(l[3] || ""),
                    r: chromatiques && a ? a.r : String(l[4] || "C"), locked: !!l[8],
                    tags: (Array.isArray(l[10]) ? l[10] : []).map(Number), sh, t: (a && a.t) || 0};
                if (sh) e.shk = 1;
                s.put(e);
            };
        }
    }
    await attendreTx(tx);
}

/* un exemplaire qui a quitté la liste : retiré de la base (un rang), ou seulement de ses chromatiques (SH) */
async function retirerDeListe(rar, ids) {
    if (!ids.length) return;
    const db = await ouvrirBase();
    const tx = db.transaction("ex", "readwrite");
    const s = tx.objectStore("ex");
    for (const id of ids) {
        if (rar !== "SH") {
            s.delete(id);
            continue;
        }
        const lecture = s.get(id);
        lecture.onsuccess = () => {
            const a = cloner(lecture.result);
            if (!a) return;
            a.sh = false;
            delete a.shk;
            s.put(a);
        };
    }
    await attendreTx(tx);
}

/* les identifiants d'une liste dans la base, du plus grand au plus petit */
async function idsDeListe(rar) {
    const db = await ouvrirBase();
    const index = db.transaction("ex").objectStore("ex").index(rar === "SH" ? "shk" : "r");
    const ids = await attendreReq(index.getAllKeys(IDBKeyRange.only(rar === "SH" ? 1 : rar)));
    return ids.sort((a, b) => b - a);
}

/* modifie des exemplaires de la base (dates, cadenas…) : modifs = [[id, {champ: valeur}]] */
async function modifierExemplaires(modifs) {
    if (!modifs.length) return;
    const db = await ouvrirBase();
    const tx = db.transaction("ex", "readwrite");
    const s = tx.objectStore("ex");
    for (const [id, champs] of modifs) {
        const lecture = s.get(id);
        lecture.onsuccess = () => {
            if (lecture.result) s.put(Object.assign(cloner(lecture.result), champs));
        };
    }
    await attendreTx(tx);
}

async function lirePageListe(rar, page, tag) {
    return lireJSON("/api/collection/page?" + new URLSearchParams({vue: "cartes", q: "", rar: rar || "", tag: tag || "", excl: "1", page}));
}

/* ce que chaque page apprend en plus des cartes : préfixes d'images, étiquettes, résumé de la collection */
function noterInfos(etat, d) {
    if (Array.isArray(d.imgp)) etat.imgp = d.imgp;
    if (Array.isArray(d.tags)) etat.tags = d.tags.map(t => ({id: t.id, name: t.name, color: t.color}));
    if (d.resume && typeof d.resume === "object") etat.resume = d.resume;
}

const idsDePage = d => (d && Array.isArray(d.lignes) ? d.lignes.flatMap(l => (Array.isArray(l) && Array.isArray(l[9]) ? l[9].filter(Number.isInteger) : [])) : []);

/* --------------------------------------------------------------------------
   LES DIFFÉRENCES D'UNE LISTE (sans la base : testable à part)
   local : les identifiants connus, décroissants ; lirePage(p) : la page p du site, telle qu'elle est maintenant.
   Renvoie {liste (l'état du site), retraits (identifiants partis), pages (les pages lues : leurs lignes sont à écrire)}.
   Lève une erreur si le budget de pages est dépassé ou si le site n'est pas rangé comme prévu (on relira tout).
   -------------------------------------------------------------------------- */
async function differencesListe(local, lirePage, budget) {
    let liste = local.slice();
    const pages = new Map();
    const retraits = new Set();
    let lues = 0, limite = budget;
    const lire = async p => {
        if (pages.has(p)) return pages.get(p);
        if (++lues > limite) throw new Error("trop de changements");
        const d = await lirePage(p);
        if (!d || !Array.isArray(d.lignes)) throw new Error("réponse inattendue");
        const ids = idsDePage(d);
        if (ids.some((id, i) => i && ids[i - 1] <= id)) throw new Error("liste pas rangée par identifiant décroissant");
        pages.set(p, d);
        return d;
    };
    const d0 = await lire(0);
    const total = Number(d0.total) || 0;
    const nbPages = Math.max(1, Number(d0.pages) || 1);
    const parPage = Math.max(1, idsDePage(d0).length);
    /* une longue liste (les communes : plus de 460 pages) a droit à plus de lectures avant d'être relue en entier */
    limite = Math.max(budget, Math.floor(nbPages / 3));
    const ajustees = new Set();
    /* La page p répond pour tout ce qui est sous le dernier identifiant de la page d'avant et jusqu'à son propre
       dernier : les pages se suivent sans trou (une carte partie juste entre deux pages est vue). On s'aligne dessus. */
    const ajuster = async p => {
        const ids = idsDePage(await lire(p));
        const avant = p > 0 ? idsDePage(await lire(p - 1)) : [];
        const haut = p === 0 ? Infinity : avant.length ? avant[avant.length - 1] : Infinity;      // exclu
        const bas = p >= nbPages - 1 ? -Infinity : ids.length ? ids[ids.length - 1] : haut;      // inclus
        const presents = new Set(ids);
        const connus = new Set(liste);
        liste = liste.filter(id => {
            if (id < haut && id >= bas && !presents.has(id)) {
                retraits.add(id);
                return false;
            }
            return true;
        });
        for (const id of ids) if (!connus.has(id)) liste.push(id);
        liste.sort((a, b) => b - a);
        for (const id of ids) retraits.delete(id);
        ajustees.add(p);
    };
    await ajuster(0);
    /* la tête : tant que la page lue ne contient que du neuf, la suivante aussi */
    const plusGrandConnu = local.length ? local[0] : -Infinity;
    for (let p = 0; p + 1 < nbPages; p++) {
        const ids = idsDePage(pages.get(p));
        if (!ids.length || ids[ids.length - 1] <= plusGrandConnu) break;
        await ajuster(p + 1);
    }
    /* le milieu : le nombre ne colle pas. On cherche la première page dont le premier identifiant n'est plus à sa
       place (dichotomie) : le changement est dans cette page ou celle d'avant ; on s'aligne sur les deux, et on recommence. */
    while (liste.length !== total) {
        let a = 1, b = nbPages - 1, premiere = nbPages;
        while (a <= b) {
            const m = (a + b) >> 1;
            const id0 = idsDePage(await lire(m))[0];
            if (id0 !== liste[m * parPage]) {
                premiere = m;
                b = m - 1;
            } else {
                a = m + 1;
            }
        }
        let cibles = (premiere === nbPages ? [nbPages - 1] : [premiere - 1, premiere]).filter(p => p >= 0 && !ajustees.has(p));
        if (!cibles.length) {
            /* déjà alignées sans que le compte colle : on avance page par page dans ce qui n'a pas été vu */
            const reste = [...Array(nbPages).keys()].find(p => !ajustees.has(p));
            if (reste === undefined) break;
            cibles = [reste];
        }
        for (const p of cibles) await ajuster(p);
    }
    if (liste.length !== total) throw new Error("écart persistant");
    return {liste, retraits: [...retraits], pages, lues};
}

/* une liste relue en entier (initialisation, ou quand les différences ne suffisent pas) */
async function relireListe(rar, etat, progres, continuer) {
    const vus = new Set();
    let page = 0, nbPages = 1;
    while (page < nbPages) {
        if (!continuer()) return false;
        const d = await lirePageListe(rar, page);
        noterInfos(etat, d);
        await ecrireLignes(d.lignes || [], rar === "SH");
        idsDePage(d).forEach(id => vus.add(id));
        nbPages = Math.max(1, Number(d.pages) || 1);
        page++;
        progres(rar, page, nbPages);
        await pause(CONFIG.pauseMs);
    }
    const partis = (await idsDeListe(rar)).filter(id => !vus.has(id));
    await retirerDeListe(rar, partis);
    journalBase(nomListe(rar) + " relue en entier : " + nombre(vus.size) + " exemplaire(s), " + nombre(partis.length) + " retiré(s)");
    return true;
}

/* L'initialisation, reprenable : etat.init.listes[rar] = {page, pages} ; la page atteinte est notée après chaque page */
async function initialiserBase(progres, continuer) {
    const etat = await lireEtatBase();
    if (!etat.init) etat.init = {debut: Date.now(), listes: {}};
    const dejaLues = pagesFaites(etat);
    journalBase(dejaLues ? "Construction : reprise après " + nombre(dejaLues) + " page(s)" : "Construction de la base : début");
    for (const rar of LISTES_BASE) {
        const st = etat.init.listes[rar] || (etat.init.listes[rar] = {page: 0, pages: 1, fini: false});
        while (!st.fini) {
            if (!continuer()) {
                etat.init.enCours = false;                 // en pause : elle ne reprendra pas seule au chargement
                await ecrireEtatBase(etat);
                journalBase("Construction en pause (" + nomListe(rar) + ", page " + (st.page + 1) + ")");
                return false;
            }
            const d = await lirePageListe(rar, st.page);
            noterInfos(etat, d);
            await ecrireLignes(d.lignes || [], rar === "SH");
            st.pages = Math.max(1, Number(d.pages) || 1);
            st.page++;
            st.fini = st.page >= st.pages;
            await ecrireEtatBase(etat);
            avancer(pagesFaites(etat), pagesPrevues(etat), "Construction : " + nomListe(rar) + ", page " + st.page + " / " + st.pages);
            progres(etat);
            if (st.fini) journalBase(nomListe(rar) + " : " + pluriel(st.pages, "page lue", "pages lues"));
            await pause(CONFIG.pauseMs);
        }
    }
    etat.init.fini = Date.now();
    etat.complet = Date.now();
    await ecrireEtatBase(etat);
    journalBase("Construction terminée : " + pluriel(await compterBase(), "exemplaire") + ". Une mise à jour rattrape ce qui a bougé pendant la lecture.", "ok");
    /* la collection a pu bouger pendant la lecture : une mise à jour rattrape */
    await majBaseDifferences(() => {}, continuer, true);
    await reprendreDatesDuCache();
    return true;
}

/* La mise à jour par différences. etat.majListes garde le nombre de pages lues, pour l'affichage. */
async function majBaseDifferences(progres, continuer, sansVerrou) {
    const etat = await lireEtatBase();
    if (!baseInitialisee(etat)) return {lues: 0};
    let lues = 0;
    const relues = [];
    const etapes = LISTES_BASE.length + 2;
    let ajoutsTotal = 0, retraitsTotal = 0;
    journalBase("Mise à jour : début");
    for (const [i, rar] of LISTES_BASE.entries()) {
        if (!continuer()) return {lues, relues};
        progres("Mise à jour : " + rar + "…");
        avancer(i, etapes, "Mise à jour : " + nomListe(rar) + "…");
        const local = await idsDeListe(rar);
        try {
            const r = await differencesListe(local, async p => {
                const d = await lirePageListe(rar, p);
                noterInfos(etat, d);
                await pause(CONFIG.pauseMs);
                return d;
            }, BUDGET_LISTE);
            lues += r.lues;
            for (const d of r.pages.values()) await ecrireLignes(d.lignes || [], rar === "SH");
            await retirerDeListe(rar, r.retraits);
            const ajouts = r.liste.length - local.length + r.retraits.length;
            ajoutsTotal += ajouts;
            retraitsTotal += r.retraits.length;
            if (ajouts || r.retraits.length) journalBase(nomListe(rar) + " : +" + nombre(ajouts) + " / −" + nombre(r.retraits.length) + " (" + pluriel(r.lues, "page lue", "pages lues") + ")");
        } catch (erreur) {
            /* trop de changements, ou une liste rangée autrement : on la relit en entier */
            console.warn("[base] liste " + rar + " relue en entier :", erreur.message);
            journalBase(nomListe(rar) + " : " + erreur.message + ", relecture complète", "alerte");
            relues.push(rar);
            progres("Mise à jour : " + rar + " relue en entier…");
            await relireListe(rar, etat, (l, p, n) => progres("Mise à jour : " + l + " relue en entier, " + p + " / " + n + "…"), continuer);
        }
    }
    avancer(etapes - 2, etapes, "Mise à jour : échanges, achats et ventes…");
    lues += await rapprocherDepuisHistorique(etat, progres, continuer);
    avancer(etapes - 1, etapes, "Mise à jour : étiquettes…");
    lues += await majEtiquettes(etat, progres, continuer);
    etat.maj = Date.now();
    await ecrireEtatBase(etat);
    avancer(etapes, etapes, "");
    journalBase("Mise à jour terminée : +" + nombre(ajoutsTotal) + " / −" + nombre(retraitsTotal) + " exemplaire(s), "
        + pluriel(lues, "requête") + (relues.length ? ", relue(s) en entier : " + relues.map(nomListe).join(", ") : ""), "ok");
    return {lues, relues};
}

/* Un échange 1 contre 1 dans le même rang ne change pas les comptes : il passerait inaperçu. Chaque carte échangée,
   achetée ou vendue depuis la dernière mise à jour est donc vérifiée sur sa fiche (tes exemplaires de cette carte,
   avec leur date et leur cadenas). Deux lectures d'historique, puis une fiche par carte concernée. */
async function rapprocherDepuisHistorique(etat, progres, continuer) {
    const depuis = (etat.majHisto || etat.maj || 0) - 120000;
    const cids = new Set();
    let lues = 0;
    try {
        const d = await lireJSON("/api/trades?box=history");
        lues++;
        for (const e of (d && d.trades) || []) {
            if (!e || e.status !== "accepted" || enMs(Number(e.closed || e.created) || 0) < depuis) continue;
            for (const c of [...(e.give || []), ...(e.take || [])]) if (c && c.cid) cids.add(String(c.cid));
        }
    } catch (erreur) { /* historique illisible : la vérification complète rattrapera */ }
    try {
        const d = await lireJSON("/api/purchases?page=0");
        lues++;
        for (const a of (d && d.items) || []) {
            if (!a || enMs(Number(a.ts) || 0) < depuis) continue;
            for (const c of (a.lot && Array.isArray(a.lot.cartes) ? a.lot.cartes : [a])) if (c && c.cid) cids.add(String(c.cid));
        }
    } catch (erreur) { /* idem */ }
    let n = 0;
    if (cids.size) journalBase(pluriel(cids.size, "carte échangée, achetée ou vendue", "cartes échangées, achetées ou vendues") + " depuis la dernière fois : vérifiée(s) sur leur fiche");
    for (const cid of cids) {
        if (!continuer()) return lues;
        progres("Mise à jour : cartes échangées ou vendues, " + (++n) + " / " + cids.size + "…");
        try {
            await rapprocherCarte(cid, await lireJSON("/api/card?cid=" + encodeURIComponent(cid)));
            lues++;
        } catch (erreur) { /* fiche illisible : la vérification complète rattrapera */ }
        await pause(CONFIG.pauseMs);
    }
    etat.majHisto = Date.now();
    return lues;
}

/* aligne la base sur la fiche d'une carte : ses exemplaires partis sont retirés, les nouveaux ajoutés, les dates et
   cadenas mis à jour */
async function rapprocherCarte(cid, fiche) {
    const mine = ((fiche && fiche.mine) || []).filter(m => m && Number.isInteger(m.id));
    const cache = lireCache();
    cache.cartes[cid] = entreeDe(fiche);
    ecrireCache(cache);
    const infos = infosDeFiche(fiche);
    const db = await ouvrirBase();
    const tx = db.transaction("ex", "readwrite");
    const s = tx.objectStore("ex");
    const avant = await attendreReq(s.index("cid").getAll(IDBKeyRange.only(cid)));
    const modele = avant[0] || {cid, n: infos.n || cid, d: infos.d || "", img: infos.img || "", r: infos.r || "C", tags: []};
    const gardes = new Set(mine.map(m => m.id));
    for (const a of avant) if (!gardes.has(a.id)) s.delete(a.id);
    for (const m of mine) {
        const a = avant.find(x => x.id === m.id);
        const sh = !!(m.sh || m.shiny);
        const e = Object.assign({}, a || modele, {id: m.id, cid, sh, t: Number(m.prov && m.prov.ts) || (a && a.t) || 0});
        if (m.state !== undefined) e.locked = m.state === "locked";
        if (!a) e.tags = [];
        if (sh) e.shk = 1;
        else delete e.shk;
        s.put(e);
    }
    await attendreTx(tx);
}

/* les étiquettes dont le nombre d'exemplaires a changé sont relues (le résumé du site donne le nombre de chacune) */
async function majEtiquettes(etat, progres, continuer) {
    const comptes = etat.resume && etat.resume.etiquettes;
    if (!comptes || typeof comptes !== "object") return 0;
    const db = await ouvrirBase();
    const tagsLocaux = await toutesLesEtiquettesLocales();
    const aRelire = [];
    for (const id of new Set([...Object.keys(comptes), ...tagsLocaux].map(String))) {
        const site = Number(comptes[id]) || 0;
        const ici = await attendreReq(db.transaction("ex").objectStore("ex").index("tags").count(IDBKeyRange.only(Number(id))));
        if (site !== ici) {
            aRelire.push(id);
            journalBase("Étiquette « " + ((etat.tags || []).find(t => String(t.id) === id) || {name: id}).name + " » : " + nombre(site)
                + " sur le site, " + nombre(ici) + " dans la base : relue");
        }
    }
    let lues = 0;
    for (const id of aRelire) {
        if (!continuer()) break;
        progres("Mise à jour : étiquette " + ((etat.tags || []).find(t => String(t.id) === id) || {name: id}).name + "…");
        const vus = new Set();
        let page = 0, nbPages = 1;
        while (page < nbPages) {
            const d = await lirePageListe("", page, id);
            lues++;
            await ecrireLignes(d.lignes || [], false);
            idsDePage(d).forEach(x => vus.add(x));
            nbPages = Math.max(1, Number(d.pages) || 1);
            page++;
            await pause(CONFIG.pauseMs);
        }
        /* ceux qui portaient l'étiquette et ne la portent plus */
        const avant = await attendreReq(db.transaction("ex").objectStore("ex").index("tags").getAllKeys(IDBKeyRange.only(Number(id))));
        await modifierEtiquetteRetiree(avant.filter(x => !vus.has(x)), Number(id));
    }
    return lues;
}

async function toutesLesEtiquettesLocales() {
    const db = await ouvrirBase();
    const index = db.transaction("ex").objectStore("ex").index("tags");
    const tags = new Set();
    await new Promise((ok, ko) => {
        const c = index.openKeyCursor(null, "nextunique");
        c.onsuccess = () => {
            const curseur = c.result;
            if (!curseur) return ok();
            tags.add(curseur.key);
            curseur.continue();
        };
        c.onerror = () => ko(c.error);
    });
    return [...tags];
}

async function modifierEtiquetteRetiree(ids, tag) {
    if (!ids.length) return;
    const db = await ouvrirBase();
    const tx = db.transaction("ex", "readwrite");
    const s = tx.objectStore("ex");
    for (const id of ids) {
        const lecture = s.get(id);
        lecture.onsuccess = () => {
            const a = cloner(lecture.result);
            if (!a) return;
            a.tags = (a.tags || []).filter(t => t !== tag);
            s.put(a);
        };
    }
    await attendreTx(tx);
}

/* « Tout vérifier » : chaque liste relue en entier, puis les étiquettes */
async function verifierToutBase(progres, continuer) {
    const etat = await lireEtatBase();
    journalBase("Vérification complète : début");
    const prevues = pagesPrevues(etat);
    let faites = 0;
    for (const rar of LISTES_BASE) {
        const ok = await relireListe(rar, etat, (l, p, n) => {
            avancer(++faites, Math.max(prevues, faites), "Vérification : " + nomListe(l) + ", page " + p + " / " + n);
            progres("Vérification : " + l + " " + p + " / " + n + "…");
        }, continuer);
        if (!ok) {
            journalBase("Vérification interrompue", "alerte");
            return false;
        }
    }
    await majEtiquettes(etat, progres, continuer);
    etat.maj = etat.complet = Date.now();
    await ecrireEtatBase(etat);
    journalBase("Vérification complète terminée : " + pluriel(await compterBase(), "exemplaire"), "ok");
    avancer(1, 1, "");
    return true;
}

/* les dates déjà lues par le tri (cache wpx.tri.dates2) passent dans la base */
async function reprendreDatesDuCache() {
    const cache = lireCache();
    const modifs = [];
    for (const e of Object.values(cache.cartes)) {
        for (const [id, t] of Object.entries((e && e.ex) || {})) if (t) modifs.push([+id, {t}]);
    }
    for (let i = 0; i < modifs.length; i += 2000) await modifierExemplaires(modifs.slice(i, i + 2000));
}

/* un seul onglet travaille sur la base à la fois ; null si un autre s'en occupe */
async function avecBase(travail) {
    if (BASE.occupe) return null;
    const faire = async () => {
        BASE.occupe = true;
        BASE.erreur = "";
        majPanneauBase();
        try {
            return await travail();
        } catch (erreur) {
            BASE.erreur = erreur.message;
            journalBase("Erreur : " + erreur.message, "erreur");
            throw erreur;
        } finally {
            avancer(0, 0, "");
            BASE.occupe = false;
            majPanneauBase();
        }
    };
    if (!navigator.locks) return faire();
    return navigator.locks.request("wpx-base", {ifAvailable: true}, verrou => (verrou ? faire() : null));
}

/* les plus grands identifiants de la base (les exemplaires les plus récemment créés) */
async function plusGrandsIdentifiants(n) {
    const db = await ouvrirBase();
    const s = db.transaction("ex").objectStore("ex");
    const liste = [];
    await new Promise((ok, ko) => {
        const c = s.openCursor(null, "prev");
        c.onsuccess = () => {
            const curseur = c.result;
            if (!curseur || liste.length >= n) return ok();
            liste.push(cloner(curseur.value));
            curseur.continue();
        };
        c.onerror = () => ko(c.error);
    });
    return liste;
}

async function exemplairesDeCartes(cids) {
    const db = await ouvrirBase();
    const index = db.transaction("ex").objectStore("ex").index("cid");
    const parCid = new Map();
    for (const cid of new Set(cids)) parCid.set(cid, await attendreReq(index.getAll(IDBKeyRange.only(cid))));
    return parCid;
}

async function compterBase() {
    const db = await ouvrirBase();
    return attendreReq(db.transaction("ex").objectStore("ex").count());
}

/* export et import d'une copie de la base, en fichier JSON */
async function exporterBase() {
    const db = await ouvrirBase();
    const ex = await attendreReq(db.transaction("ex").objectStore("ex").getAll());
    const etat = await lireEtatBase();
    const blob = new Blob([JSON.stringify({v: 1, quand: Date.now(), joueur: pseudoJoueur(), etat, ex})], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const d = new Date();
    const lien = el("a", {href: url, download: "wikipick_base_" + d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-"
        + String(d.getDate()).padStart(2, "0") + ".json"});
    D.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return ex.length;
}

async function importerBase(fichier) {
    const donnees = JSON.parse(await fichier.text());
    if (!donnees || !Array.isArray(donnees.ex) || !donnees.etat) throw new Error("ce fichier n'est pas une base exportée");
    const db = await ouvrirBase();
    const vide = db.transaction("ex", "readwrite");
    vide.objectStore("ex").clear();
    await attendreTx(vide);
    for (let i = 0; i < donnees.ex.length; i += 2000) {
        const tx = db.transaction("ex", "readwrite");
        const s = tx.objectStore("ex");
        for (const e of donnees.ex.slice(i, i + 2000)) if (e && Number.isInteger(e.id)) s.put(e);
        await attendreTx(tx);
    }
    await ecrireEtatBase(donnees.etat);
    return donnees.ex.length;
}

/* Les cadenas posés depuis le site (sa fiche) ou depuis tes outils : un petit relais dans la page voit passer les
   demandes de verrouillage réussies, et la base les note (aucune requête de plus). */
function relaisCadenas() {
    if (window.__wpxRelaisCadenas) return;
    window.__wpxRelaisCadenas = true;
    const precedent = window.fetch;
    window.fetch = function (entree, options) {
        const promesse = Reflect.apply(precedent, this, arguments);
        try {
            const adresse = new URL(typeof entree === "string" ? entree : entree && entree.url ? entree.url : String(entree), location.href);
            if (adresse.origin === location.origin && /^\/api\/card\/lock(\/bulk)?$/.test(adresse.pathname) && options && typeof options.body === "string") {
                const corps = JSON.parse(options.body);
                const ids = Array.isArray(corps.ids) ? corps.ids : corps.card_id != null ? [corps.card_id] : [];
                promesse.then(r => {
                    if (r.ok && ids.length) document.dispatchEvent(new CustomEvent("wpx-base-cadenas", {detail: JSON.stringify({ids, on: !!corps.on})}));
                }).catch(() => {});
            }
        } catch (erreur) { /* demande illisible : la requête part quand même */ }
        return promesse;
    };
}

function installerRelaisCadenas() {
    D.addEventListener("wpx-base-cadenas", e => {
        try {
            const {ids, on} = JSON.parse(e.detail);
            modifierExemplaires(ids.filter(Number.isInteger).map(id => [id, {locked: on}])).catch(() => {});
            for (const x of DER.elements) if (ids.includes(x.id)) x.locked = on;
        } catch (erreur) { /* rien */ }
    });
    const script = D.createElement("script");
    script.textContent = "(" + relaisCadenas + ")();";
    (D.head || D.documentElement).append(script);
    script.remove();
}

/* ==========================================================================
   MES DERNIÈRES CARTES : LA FENÊTRE
   ========================================================================== */
const DER = {vue: null, z: null, elements: [], infos: {tags: [], aVendre: new Set(), imgp: []}, choix: new Set(),
             dernier: -1, jeton: 0, lot: false, stop: false};

function carteHTML(c, tags) {
    const nom = c.n;
    const description = c.d || "";
    const taille = nom.length > 42 ? " t4" : nom.length > 32 ? " t3" : nom.length > 24 ? " t2" : "";
    const tailleDe = description.length > 118 ? " d4" : description.length > 86 ? " d3" : description.length > 56 ? " d2" : "";
    const rang = c.hw ? "Halloween" : c.sh ? "Chromatique" : RANGS[c.r] || c.r;
    /* l'image n'a pas de src : elle arrive par surveillerImages, quelques-unes à la fois */
    const image = c.img ? `<img data-wpx-src="${echapper(c.img)}" alt="" decoding="async" referrerpolicy="no-referrer">` : "";
    const cadenas = c.locked ? `<span class="lock on" title="Verrouillée"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg></span>` : "";
    const etiquettes = (c.tags || []).map(id => tags.get(String(id))).filter(Boolean)
        .map(t => `<span class="ctag" style="--tc:${echapper(t.color)}">${echapper(t.name)}</span>`).join("");
    return `<div class="card r-${echapper(c.r)}${c.sh ? " sh chr" : ""}${c.hw ? " hw" : ""} nopos" title="${echapper(rang)}">${cadenas}` +
        `<div class="hd${taille}"><h3 class="nm">${echapper(nom)}</h3></div>` +
        `<div class="picw"><div class="pic${image ? "" : " none"}">${image}</div></div>` +
        (etiquettes ? `<div class="ctags">${etiquettes}</div>` : "") +
        `<div class="txt"><div class="de${tailleDe}">${echapper(description)}</div></div><div class="ft">${echapper(rang)}</div></div>`;
}

function construireDernieres() {
    const z = {
        nombre: el("input", {type: "number", min: DN.min, max: DN.max, value: memoire.lire("tri.dernieres.n", DN.parDefaut),
            title: "Nombre de cartes", "aria-label": "Nombre de cartes"}),
        charger: el("button", {type: "button", class: "wpx-dn-btn wpx-dn-plein"}, "Charger"),
        etat: el("span", {class: "wpx-dn-etat", "aria-live": "polite"}),
        images: el("span", {class: "wpx-dn-etat wpx-dn-images"}),
        fermer: el("button", {type: "button", class: "wpx-dn-x", title: "Fermer (Échap)", "aria-label": "Fermer"}, "✕"),
        tous: el("button", {type: "button", class: "wpx-dn-lien"}, "Tout cocher"),
        aucun: el("button", {type: "button", class: "wpx-dn-lien"}, "Tout décocher"),
        compte: el("span", {class: "wpx-dn-compte"}),
        etiquette: el("select", {title: "Étiquette à poser ou retirer"}),
        poser: el("button", {type: "button", class: "wpx-dn-btn", "data-action": "poser"}, "Poser"),
        retirer: el("button", {type: "button", class: "wpx-dn-btn", "data-action": "retirer"}, "Retirer"),
        verrouiller: el("button", {type: "button", class: "wpx-dn-btn", "data-action": "verrouiller"}, "Verrouiller"),
        deverrouiller: el("button", {type: "button", class: "wpx-dn-btn", "data-action": "deverrouiller"}, "Déverrouiller"),
        vendre: el("button", {type: "button", class: "wpx-dn-btn", "data-action": "vendre", title: "Mettre de côté pour la vente (les cartes verrouillées sont sautées)"}, "Mettre de côté pour la vente"),
        arreter: el("button", {type: "button", class: "wpx-dn-btn wpx-dn-stop", hidden: true}, "Arrêter"),
        corps: el("div", {class: "wpx-dn-corps"}),
        lien: el("a", {href: "#", hidden: true, "aria-hidden": "true", tabindex: "-1"})
    };
    z.actions = el("div", {class: "wpx-dn-actions"},
        el("span", {class: "wpx-dn-groupe"}, z.tous, z.aucun, z.compte),
        el("span", {class: "wpx-dn-groupe"}, "Étiquette ", z.etiquette, z.poser, z.retirer),
        el("span", {class: "wpx-dn-groupe"}, z.verrouiller, z.deverrouiller),
        el("span", {class: "wpx-dn-groupe"}, z.vendre, z.arreter));
    /* (2.0) la base de la collection : son état et ses boutons */
    z.base = el("div", {class: "wpx-dn-base"});
    z.baseTexte = el("span", {class: "wpx-dn-base-texte", "aria-live": "polite"});
    z.bConstruire = el("button", {type: "button", class: "wpx-dn-btn", title: "Lire toute ta collection une fois (30 à 40 minutes, reprenable) ; ensuite seules les différences sont lues"}, "Construire la base");
    z.bPause = el("button", {type: "button", class: "wpx-dn-btn", hidden: true, title: "Mettre en pause : la lecture reprend où elle s'est arrêtée"}, "Pause");
    z.bMaj = el("button", {type: "button", class: "wpx-dn-btn", title: "Lire seulement ce qui a changé depuis la dernière fois"}, "Mettre à jour");
    z.bVerifier = el("button", {type: "button", class: "wpx-dn-btn", title: "Tout relire (30 à 40 minutes) : rattrape les changements qui se compensent"}, "Tout vérifier");
    z.bExporter = el("button", {type: "button", class: "wpx-dn-lien", title: "Télécharger une copie de la base (fichier JSON)"}, "Exporter");
    z.bImporter = el("button", {type: "button", class: "wpx-dn-lien", title: "Remplacer la base par une copie exportée"}, "Importer");
    z.fichier = el("input", {type: "file", accept: ".json,application/json", hidden: true});
    z.base.append(el("b", null, "Base"), z.baseTexte, z.bConstruire, z.bPause, z.bMaj, z.bVerifier, z.bExporter, z.bImporter, z.fichier);
    z.bConstruire.addEventListener("click", () => lancerConstruction());
    z.bPause.addEventListener("click", () => {
        BASE.pause = true;
        lireEtatBase().then(e => { if (e.init) { e.init.enCours = false; return ecrireEtatBase(e); } }).catch(() => {});
    });
    z.bMaj.addEventListener("click", () => {
        avecBase(() => majBaseDifferences(texte => majPanneauBase(texte), () => !BASE.pause))
            .then(r => majPanneauBase(r ? "À jour (" + pluriel(r.lues, "page lue", "pages lues") + (r.relues && r.relues.length ? ", relue(s) en entier : " + r.relues.join(", ") : "") + ")" : "Un autre onglet travaille déjà sur la base."))
            .catch(e => majPanneauBase("Erreur : " + e.message));
    });
    z.bVerifier.addEventListener("click", () => {
        if (!confirm("Tout relire ? Toute la collection est relue (30 à 40 minutes), par petits lots. Tu peux continuer à jouer pendant ce temps.")) return;
        BASE.pause = false;
        avecBase(() => verifierToutBase(texte => majPanneauBase(texte), () => !BASE.pause))
            .then(() => majPanneauBase()).catch(e => majPanneauBase("Erreur : " + e.message));
    });
    z.bExporter.addEventListener("click", () => exporterBase().then(n => majPanneauBase(pluriel(n, "exemplaire") + " exporté(s).")).catch(e => majPanneauBase("Erreur : " + e.message)));
    z.bImporter.addEventListener("click", () => z.fichier.click());
    z.fichier.addEventListener("change", () => {
        const f = z.fichier.files && z.fichier.files[0];
        z.fichier.value = "";
        if (!f || !confirm("Remplacer ta base par « " + f.name + " » ?")) return;
        avecBase(() => importerBase(f)).then(n => majPanneauBase(n != null ? pluriel(n, "exemplaire") + " importé(s)." : "Un autre onglet travaille déjà sur la base."))
            .catch(e => majPanneauBase("Erreur : " + e.message));
    });

    DER.vue = el("aside", {id: "wpx-dn", "data-wpx": "", role: "dialog", "aria-label": T.dernieres, hidden: true},
        el("header", {class: "wpx-dn-tete"}, el("b", null, T.dernieres), z.nombre, z.charger, z.etat, z.images, z.fermer),
        z.base, z.actions, z.corps, z.lien);
    DER.z = z;
    D.body.append(DER.vue);
    majPanneauBase();

    z.fermer.addEventListener("click", fermerDernieres);
    z.charger.addEventListener("click", chargerDernieres);
    z.nombre.addEventListener("keydown", e => { if (e.key === "Enter") chargerDernieres(); });
    z.tous.addEventListener("click", () => { DER.elements.forEach(x => DER.choix.add(x.id)); majChoix(); });
    z.aucun.addEventListener("click", () => { DER.choix.clear(); majChoix(); });
    z.arreter.addEventListener("click", () => { DER.stop = true; });
    z.actions.addEventListener("click", e => {
        const b = e.target.closest("[data-action]");
        if (b && !b.disabled) executerLot(b.dataset.action);
    });
    z.corps.addEventListener("click", clicDernieres);
    /* Une image qui ne charge pas : le fichier original Wikimedia, sinon elle s'efface. (1.4) Le script principal s'en
       charge déjà (il passe avant et tient le même repère, data-wpx-img) : l'addon ne fait rien de plus. Sans lui,
       l'addon le fait, sans jamais retirer l'image de la page (le site garde la main sur ses images en erreur). */
    z.corps.addEventListener("error", e => {
        const img = e.target;
        if (window.__wpxActif || !img || img.tagName !== "IMG" || !img.isConnected) return;
        const original = urlOriginale(img.currentSrc || img.src);
        if (original && img.dataset.wpxTriImg !== "orig") {
            img.dataset.wpxTriImg = "orig";
            img.src = original;
        } else {
            img.style.visibility = "hidden";
            const pic = img.closest(".pic");
            if (pic) pic.classList.add("none");
        }
    }, true);
    /* le lien qui ouvre une fiche : si le site ne l'ouvre pas lui-même, la page ne part pas ailleurs */
    addEventListener("click", e => {
        if (e.target === z.lien && !e.defaultPrevented) {
            e.preventDefault();
            z.lien.dataset.rate = "1";
        }
    });
    /* une fiche ouverte à la main passe devant la fenêtre ; elle revient à la fermeture de la fiche */
    setInterval(() => {
        if (!DER.vue.hidden) DER.vue.classList.toggle("wpx-dn-derriere", ficheOuverte() && !DER.lot);
    }, 250);
}

/* n : le nombre validé à côté du tri (plus de 100) ; sans n, le bouton « Mes dernières cartes » */
function ouvrirDernieres(n) {
    if (!DER.vue) construireDernieres();
    DER.vue.hidden = false;
    if (typeof n === "number") {
        DER.z.nombre.value = String(n);
        chargerDernieres();
    } else if (!DER.elements.length) {
        chargerDernieres();
    }
}

function fermerDernieres() {
    if (DER.lot) return;                      // une action en lot se termine (ou s'arrête) d'abord
    DER.jeton++;
    if (DER.vue) DER.vue.hidden = true;
}

function etat(texte) {
    if (DER.z && DER.z.etat.textContent !== texte) DER.z.etat.textContent = texte;
}

/* L'état de la base, dans la fenêtre des dernières cartes et dans le tableau de bord de l'en-tête ; texte : un message
   du moment (progression, résultat). Statut : vert (prête), orange (travail en cours), rouge (pas construite, en
   pause, ou une erreur). */
const ilYaMin = t => {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? "à l'instant" : m < 60 ? "il y a " + m + " min" : m < 1440 ? "il y a " + Math.round(m / 60) + " h" : "il y a " + Math.round(m / 1440) + " j";
};

async function infosBase() {
    const e = await lireEtatBase();
    const n = await compterBase();
    const prete = baseInitialisee(e);
    const enConstruction = !!(e.init && !e.init.fini);
    let texte, statut;
    if (BASE.erreur) {
        statut = "rouge";
        texte = "erreur : " + BASE.erreur;
    } else if (prete) {
        statut = BASE.occupe ? "orange" : "vert";
        texte = pluriel(n, "exemplaire") + " · à jour " + ilYaMin(e.maj || e.init.fini)
            + (e.complet && Date.now() - e.complet > 7 * 86400e3 ? " · dernière vérification complète " + ilYaMin(e.complet) + " : pense à « Tout vérifier »" : "");
    } else if (enConstruction) {
        statut = BASE.occupe ? "orange" : "rouge";
        texte = "construction : " + nombre(pagesFaites(e)) + " / ~" + nombre(pagesPrevues(e)) + " pages, " + pluriel(n, "exemplaire") + (BASE.occupe ? "" : " (en pause)");
    } else {
        statut = "rouge";
        texte = "pas encore construite";
    }
    return {e, n, prete, enConstruction, texte, statut};
}

async function majPanneauBase(texte) {
    if (!DER.z && !TB.vue && !TB.bouton) return;
    let i;
    try {
        i = await infosBase();
    } catch (erreur) {
        i = {e: {}, n: 0, prete: false, enConstruction: false, statut: "rouge", texte: "indisponible dans ce navigateur (" + erreur.message + ")"};
    }
    const z = DER.z;
    if (z) {
        z.baseTexte.textContent = (i.prete || i.enConstruction || BASE.erreur ? i.texte : "pas encore construite : « Mes dernières cartes » lit le site à chaque fois")
            + (texte ? " · " + texte : "");
        z.bConstruire.hidden = i.prete || (i.enConstruction && BASE.occupe);
        z.bConstruire.textContent = i.enConstruction ? "Reprendre la construction" : "Construire la base";
        z.bPause.hidden = !(i.enConstruction && BASE.occupe);
        z.bMaj.hidden = z.bVerifier.hidden = !i.prete;
        z.bExporter.hidden = !i.n;
        [z.bConstruire, z.bMaj, z.bVerifier, z.bImporter].forEach(b => { b.disabled = BASE.occupe; });
    }
    majTableauBord(i, texte);
}

/* la construction (ou sa reprise), en tâche de fond ; elle reprendra seule au prochain chargement tant qu'elle n'est
   pas mise en pause */
function lancerConstruction() {
    BASE.pause = false;
    return avecBase(async () => {
        const e = await lireEtatBase();
        if (!e.init) e.init = {debut: Date.now(), listes: {}};
        e.init.enCours = true;
        await ecrireEtatBase(e);
        majPanneauBase();
        const fini = await initialiserBase(() => majPanneauBase(), () => !BASE.pause);
        if (fini) majPanneauBase("construite.");
    }).catch(erreur => majPanneauBase("Erreur : " + erreur.message + " (la construction reprendra où elle s'est arrêtée)"));
}

/* ==========================================================================
   (2.1) LE TABLEAU DE BORD DE LA BASE, DANS L'EN-TÊTE
   Un bouton à côté de Clean, Largeur et des réglages du script principal (avec une pastille verte, orange ou rouge),
   qui ouvre un panneau : le statut, la barre de progression, les boutons (construire, pause, mettre à jour, tout
   vérifier, exporter, importer) et le journal.
   ========================================================================== */
const TB = {bouton: null, vue: null, z: null};
const ICONE_BASE = `<svg class="wpx-ico" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="5.5" rx="8" ry="3"/>`
    + `<path d="M4 8.2c1.5 1.6 4.6 2.5 8 2.5s6.5-.9 8-2.5v3.6c0 1.7-3.6 3-8 3s-8-1.3-8-3z"/><path d="M4 14.4c1.5 1.6 4.6 2.5 8 2.5s6.5-.9 8-2.5v3.6c0 1.7-3.6 3-8 3s-8-1.3-8-3z"/></svg>`;

/* (2.4) le bouton n'apparaît que dans Collection > Mes étiquettes (le travail en cours, lui, continue ailleurs) */
function majVisibiliteBouton() {
    if (!TB.bouton) return;
    const ici = !!$("#v-coll.on") && !!$('#ctabs button[data-c="album"].on');
    if (TB.bouton.hidden === !ici) return;
    TB.bouton.hidden = !ici;
    if (!ici) fermerTableauBord();
}

function installerBoutonBase() {
    majVisibiliteBouton();
    if (TB.bouton && TB.bouton.isConnected) return;
    const rangee = $("body > header.top .row1");
    if (!rangee) return;
    const repere = rangee.querySelector(":scope > [data-wpx-reglages]") || rangee.querySelector(":scope > [data-wpx-bascule]")
        || rangee.querySelector(":scope > [data-nuit-bascule]") || rangee.querySelector(":scope > [data-theme-bascule]");
    if (!TB.bouton) {
        TB.bouton = el("button", {type: "button", class: "wpx-crane wpx-tb-bouton", "data-wpx": "", "aria-haspopup": "dialog",
            "aria-label": "Base de la collection", title: "Base de la collection : construction, mise à jour, journal"});
        TB.bouton.innerHTML = ICONE_BASE + '<i class="wpx-tb-pastille" aria-hidden="true"></i>';
        TB.bouton.addEventListener("click", () => (TB.vue && !TB.vue.hidden ? fermerTableauBord() : ouvrirTableauBord()));
    }
    if (repere) repere.after(TB.bouton);
    else rangee.append(TB.bouton);
    majVisibiliteBouton();
    majPanneauBase();
}

function construireTableauBord() {
    const z = {
        pastille: el("i", {class: "wpx-tb-pastille"}),
        statut: el("b", {class: "wpx-tb-statut"}),
        detail: el("span", {class: "wpx-tb-detail"}),
        barre: el("div", {class: "wpx-tb-barre"}),
        progres: el("small", {class: "wpx-tb-progres"}),
        fermer: el("button", {type: "button", class: "wpx-dn-x", title: "Fermer (Échap)", "aria-label": "Fermer"}, "✕"),
        construire: el("button", {type: "button", class: "wpx-dn-btn wpx-dn-plein"}, "Construire la base"),
        pause: el("button", {type: "button", class: "wpx-dn-btn"}, "Pause"),
        maj: el("button", {type: "button", class: "wpx-dn-btn"}, "Mettre à jour"),
        verifier: el("button", {type: "button", class: "wpx-dn-btn"}, "Tout vérifier"),
        exporter: el("button", {type: "button", class: "wpx-dn-lien"}, "Exporter"),
        importer: el("button", {type: "button", class: "wpx-dn-lien"}, "Importer"),
        journal: el("div", {class: "wpx-tb-journal", "aria-live": "polite"}),
        copier: el("button", {type: "button", class: "wpx-dn-lien"}, "Copier le journal"),
        vider: el("button", {type: "button", class: "wpx-dn-lien"}, "Vider le journal")
    };
    z.remplissage = el("i");
    z.barre.append(z.remplissage);
    TB.vue = el("aside", {id: "wpx-tb", "data-wpx": "", role: "dialog", "aria-label": "Base de la collection", hidden: true},
        el("header", {class: "wpx-tb-tete"}, el("b", null, "Base de la collection"), z.fermer),
        el("div", {class: "wpx-tb-etat"}, z.pastille, z.statut, z.detail),
        z.barre, z.progres,
        el("div", {class: "wpx-tb-boutons"}, z.construire, z.pause, z.maj, z.verifier, z.exporter, z.importer),
        el("div", {class: "wpx-tb-jtete"}, el("b", null, "Journal"), z.copier, z.vider),
        z.journal);
    TB.z = z;
    D.body.append(TB.vue);
    z.fermer.addEventListener("click", fermerTableauBord);
    /* les boutons font la même chose que ceux de la fenêtre des dernières cartes */
    const fenetre = () => {
        if (!DER.vue) construireDernieres();
        return DER.z;
    };
    z.construire.addEventListener("click", () => lancerConstruction());
    z.pause.addEventListener("click", () => fenetre().bPause.click());
    z.maj.addEventListener("click", () => fenetre().bMaj.click());
    z.verifier.addEventListener("click", () => fenetre().bVerifier.click());
    z.exporter.addEventListener("click", () => fenetre().bExporter.click());
    z.importer.addEventListener("click", () => fenetre().bImporter.click());
    z.copier.addEventListener("click", async () => {
        const texte = JB.lignes.map(l => "[" + new Date(l[0]).toLocaleString("fr-FR") + "] " + l[1]).join("\n");
        try {
            await navigator.clipboard.writeText(texte);
            z.copier.textContent = "Copié ✓";
        } catch (erreur) {
            z.copier.textContent = "Copie impossible";
        }
        setTimeout(() => { z.copier.textContent = "Copier le journal"; }, 2000);
    });
    z.vider.addEventListener("click", () => {
        JB.lignes.length = 0;
        try { sessionStorage.removeItem("wpx.base.journal"); } catch (erreur) { /* rien */ }
        remplirJournalBase();
    });
    D.addEventListener("pointerdown", e => {
        if (!TB.vue.hidden && !TB.vue.contains(e.target) && !TB.bouton.contains(e.target)) fermerTableauBord();
    }, true);
    remplirJournalBase();
}

function ouvrirTableauBord() {
    if (!TB.vue) construireTableauBord();
    TB.vue.hidden = false;
    TB.bouton.setAttribute("aria-expanded", "true");
    majPanneauBase();
    majBarreBase();
    TB.z.journal.scrollTop = TB.z.journal.scrollHeight;
}

function fermerTableauBord() {
    if (!TB.vue || TB.vue.hidden) return;
    TB.vue.hidden = true;
    TB.bouton.setAttribute("aria-expanded", "false");
}

const ligneJournal = l => el("div", {class: "wpx-tb-l" + (l[2] ? " wpx-tb-" + l[2] : "")},
    el("time", null, new Date(l[0]).toLocaleTimeString("fr-FR", {hour: "2-digit", minute: "2-digit", second: "2-digit"})), " ", l[1]);

function remplirJournalBase() {
    if (!TB.z) return;
    TB.z.journal.replaceChildren(...(JB.lignes.length ? JB.lignes.map(ligneJournal) : [el("div", {class: "wpx-tb-l wpx-tb-vide"}, "Rien pour l'instant.")]));
    TB.z.journal.scrollTop = TB.z.journal.scrollHeight;
}

function ajouterAuJournal(l) {
    if (!TB.z) return;
    const vide = $(".wpx-tb-vide", TB.z.journal);
    if (vide) vide.remove();
    const enBas = TB.z.journal.scrollHeight - TB.z.journal.scrollTop - TB.z.journal.clientHeight < 30;
    TB.z.journal.append(ligneJournal(l));
    while (TB.z.journal.childElementCount > 500) TB.z.journal.firstChild.remove();
    if (enBas) TB.z.journal.scrollTop = TB.z.journal.scrollHeight;
}

/* la barre : la progression du travail en cours (pleine et immobile quand rien ne tourne) */
function majBarreBase() {
    if (!TB.z) return;
    const p = BASE.progres || {};
    const pct = p.total ? Math.min(100, Math.round(p.fait / p.total * 100)) : BASE.occupe ? 0 : 100;
    TB.z.remplissage.style.width = pct + "%";
    TB.z.barre.classList.toggle("wpx-tb-actif", !!BASE.occupe);
    TB.z.progres.textContent = BASE.occupe ? (p.texte || "En cours…") + (p.total ? " · " + pct + " %" : "") : "";
}

function majTableauBord(i, texte) {
    const statut = BASE.occupe ? "orange" : i.statut;
    if (TB.bouton) {
        TB.bouton.dataset.statut = statut;
        TB.bouton.title = "Base de la collection : " + i.texte;
    }
    if (!TB.z) return;
    const z = TB.z;
    z.pastille.dataset.statut = statut;
    z.statut.textContent = statut === "vert" ? "Prête" : statut === "orange" ? "En cours" : BASE.erreur ? "Erreur" : i.enConstruction ? "En pause" : "Pas construite";
    z.detail.textContent = i.texte + (texte ? " · " + texte : "");
    z.construire.hidden = i.prete || (i.enConstruction && BASE.occupe);
    z.construire.textContent = i.enConstruction ? "Reprendre la construction" : "Construire la base";
    z.pause.hidden = !(i.enConstruction && BASE.occupe);
    z.maj.hidden = z.verifier.hidden = !i.prete;
    z.exporter.hidden = !i.n;
    [z.construire, z.maj, z.verifier, z.importer].forEach(b => { b.disabled = BASE.occupe; });
    majBarreBase();
}

/* au chargement : une construction commencée (et pas en pause) reprend, sans attendre l'ouverture de la fenêtre */
async function reprendreConstruction() {
    try {
        const e = await lireEtatBase();
        if (e.init && !e.init.fini && e.init.enCours) lancerConstruction();
    } catch (erreur) { /* base indisponible : rien */ }
}

/* un exemplaire de la base, au format de la fenêtre */
const elementDeBase = (r, imgp) => ({id: r.id, cid: r.cid, n: r.n, d: r.d, img: urlImage(r.img, imgp || []), r: r.r,
    locked: !!r.locked, tags: (r.tags || []).slice(), sh: !!r.sh, hw: false, tBase: r.t || 0});

/* (2.0) Les candidats : dans la base si elle est prête (mise à jour d'abord si elle date de plus de 2 minutes, en
   quelques requêtes), sinon sur le site, comme avant */
async function candidatsDernieres(n, continuer) {
    const etatBase = await lireEtatBase().catch(() => null);
    if (baseInitialisee(etatBase)) {
        if (Date.now() - (etatBase.maj || 0) > 2 * 60000) {
            etat("Mise à jour de la base…");
            await avecBase(() => majBaseDifferences(texte => etat(texte), continuer));      // un autre onglet s'en occupe : on lit la base telle quelle
        }
        const e = BASE.etat || etatBase;
        const imgp = e.imgp || [];
        const tous = (await plusGrandsIdentifiants(n + DN.marge)).map(r => elementDeBase(r, imgp));
        return {tous, infos: {tags: e.tags || [], aVendre: new Set(), imgp}, base: true};
    }
    etat("Lecture de la collection…");
    const r = await candidatsParIdentifiant(n, continuer, lues => etat("Lecture de la collection… " + lues + " page(s)"));
    return Object.assign(r, {base: false});
}

async function chargerDernieres() {
    if (DER.lot) return;
    const z = DER.z;
    const n = Math.min(DN.max, Math.max(DN.min, parseInt(z.nombre.value, 10) || DN.parDefaut));
    z.nombre.value = String(n);
    memoire.ecrire("tri.dernieres.n", n);
    const jeton = ++DER.jeton;
    const continuer = () => jeton === DER.jeton;
    z.charger.disabled = true;
    try {
        const {tous, infos, base} = await candidatsDernieres(n, continuer);
        if (!continuer()) return;
        DER.infos = infos;
        etat("Lecture de tes échanges et achats…");
        const historique = await candidatsHistorique(n);
        if (!continuer()) return;
        /* une carte déjà datée dans la base n'a pas besoin de sa fiche ; une carte sans image (et celles de
           l'historique) prend la sienne sur sa fiche */
        const demandes = tous.filter(x => !x.tBase).map(x => ({cid: x.cid, id: x.id, infos: !x.img}))
            .concat(historique.map(h => ({cid: h.cid, frais: DN.histoFrais, infos: true})));
        const rates = await lireFiches(demandes, continuer, (fait, total) => etat("Dates : " + fait + " / " + total + "…"));
        if (!continuer()) return;

        /* chaque exemplaire, daté par sa fiche ; ceux de l'historique ne sont gardés que s'ils sont encore à toi */
        const cache = lireCache();
        const elements = new Map(tous.map(x => [x.id, x]));
        const dansBase = base ? await exemplairesDeCartes(historique.map(h => h.cid)) : new Map();
        for (const h of historique) {
            const e = cache.cartes[h.cid];
            if (!e || !e.ex) continue;
            const ids = Object.keys(e.ex);
            for (const id of ids) {
                if (elements.has(+id)) continue;
                const fl = e.fl && e.fl[id] != null ? e.fl[id] : ids.length === 1 ? (h.sh ? 1 : 0) + (h.hw ? 2 : 0) : null;
                if (fl != null && (!!(fl & 1) !== h.sh || !!(fl & 2) !== h.hw)) continue;     // une autre version de la carte
                const r = (dansBase.get(h.cid) || []).find(x => x.id === +id);
                elements.set(+id, r ? elementDeBase(r, infos.imgp)
                    : {id: +id, cid: h.cid, n: h.n, d: "", img: h.img || "", r: h.r, locked: false, tags: [], sh: h.sh, hw: h.hw, partiel: true});
            }
        }
        const date = x => {
            const e = cache.cartes[x.cid];
            return (e && e.ex && e.ex[String(x.id)]) || x.tBase || 0;
        };
        /* ce qui manque à une carte (image, description, nom) est repris de sa fiche */
        const completer = x => {
            const i = (cache.cartes[x.cid] || {}).i || {};
            if (!x.img && i.img) x.img = urlImage(i.img, DER.infos.imgp);
            if (!x.d && i.d) x.d = i.d;
            if ((!x.n || x.n === x.cid) && i.n) x.n = i.n;
            return x;
        };
        DER.elements = [...elements.values()].map(x => Object.assign(completer(x), {t: date(x)}))
            .sort((a, b) => (b.t || 0) - (a.t || 0) || b.id - a.id).slice(0, n);
        DER.choix = new Set([...DER.choix].filter(id => DER.elements.some(x => x.id === id)));
        DER.dernier = -1;
        rendreDernieres();
        const sans = DER.elements.filter(x => !x.t).length;
        etat(pluriel(DER.elements.length, "carte") + (sans ? " · " + sans + " sans date, à la fin" : "") + (rates ? " · " + rates + " fiche(s) illisible(s)" : ""));
    } catch (erreur) {
        console.error("[dernières cartes]", erreur);
        if (continuer()) etat("Erreur : " + erreur.message);
    } finally {
        if (continuer()) z.charger.disabled = false;
    }
}

function rendreDernieres() {
    const z = DER.z;
    const tags = new Map(DER.infos.tags.map(t => [String(t.id), t]));
    /* le menu des étiquettes, dans l'ordre du site (leur nom) */
    const valeur = z.etiquette.value;
    z.etiquette.replaceChildren(...DER.infos.tags.slice().sort((a, b) => String(a.name).localeCompare(String(b.name), "fr"))
        .map(t => new Option(t.name, String(t.id))));
    if (valeur) z.etiquette.value = valeur;
    z.corps.innerHTML = DER.elements.length ? `<div class="grid">` + DER.elements.map((x, i) =>
        `<div class="slot wpx-dn-tuile${DER.choix.has(x.id) ? " wpx-dn-on" : ""}" data-i="${i}">` +
        `<div class="cw">${carteHTML(x, tags)}<span class="wpx-dn-coche" aria-hidden="true">✓</span></div>` +
        `<div class="wpx-dn-info"><span title="Exemplaire ${x.id}">${echapper(dateCourte(x.t))}</span>` +
        `<button type="button" class="wpx-dn-lien" data-fiche="${i}" title="Ouvrir la fiche du site">Fiche</button></div></div>`).join("") + `</div>`
        : `<p class="wpx-dn-vide">Aucune carte.</p>`;
    surveillerImages();
    majChoix();
}

/* ==========================================================================
   (1.5) LES IMAGES, AU COMPTE-GOUTTES
   Deux cents images demandées d'un coup à Wikimedia, c'est une rafale qu'il refuse (erreurs réseau en série). Une
   image n'est demandée qu'à l'approche de l'écran, quelques-unes à la fois, d'abord dans une image à part (hors de
   la page : ni le site ni le script principal ne voient ses ratés) ; une fois chargée, elle passe sur la carte.
   (1.6) Un raté est un 404 de Wikimedia : la vignette de 960 px n'existe pas (l'image d'origine est plus petite).
   On essaie alors des vignettes plus petites (500, puis 250 px), puis le fichier original, puis l'emplacement reste vide.
   ========================================================================== */
const IMG = {file: [], actives: 0, max: 4, observateur: null};

/* les adresses de repli d'une vignette Wikimedia, dans l'ordre : plus petites, puis l'original */
function urlsDeRepli(url) {
    const [chemin, requete] = String(url || "").split("?");
    const m = /^(https:\/\/(?:upload|thumb)\.wikimedia\.org\/.+\/thumb\/.+\/)(\d+)px-([^/]+)$/.exec(chemin);
    const liste = [];
    if (m) for (const largeur of [500, 250]) if (largeur < +m[2]) liste.push(m[1] + largeur + "px-" + m[3] + (requete ? "?" + requete : ""));
    const original = urlOriginale(url);
    if (original) liste.push(original);
    return liste;
}

/* (1.7) on surveille la tuile, pas l'image : une image sans src n'a pas de taille, et le site peut la masquer */
function surveillerImages() {
    if (IMG.observateur) IMG.observateur.disconnect();
    IMG.file = [];
    IMG.bilan = {ok: 0, repli: 0, rate: 0, sans: DER.elements.filter(x => !x.img).length};
    IMG.observateur = new IntersectionObserver(entrees => {
        for (const e of entrees) {
            if (!e.isIntersecting) continue;
            IMG.observateur.unobserve(e.target);
            const img = $("img[data-wpx-src]", e.target);
            if (img) IMG.file.push({img, url: img.dataset.wpxSrc, replis: urlsDeRepli(img.dataset.wpxSrc), repli: false});
        }
        pomperImages();
    }, {root: DER.z.corps, rootMargin: "300px 0px"});
    $$(".wpx-dn-tuile", DER.z.corps).forEach(t => IMG.observateur.observe(t));
}

/* le bilan des images, à côté de l'état de la fenêtre (et dans la console) */
function majBilanImages() {
    const b = IMG.bilan;
    if (!b || !DER.z) return;
    DER.z.images.textContent = "Images : " + b.ok + " chargée(s)" + (b.repli ? " dont " + b.repli + " par repli" : "")
        + (b.rate ? " · " + b.rate + " introuvable(s)" : "") + (b.sans ? " · " + b.sans + " sans adresse" : "");
}

function pomperImages() {
    while (IMG.actives < IMG.max && IMG.file.length) {
        const tache = IMG.file.shift();
        if (!tache.img.isConnected) continue;
        IMG.actives++;
        const essai = new Image();
        essai.referrerPolicy = "no-referrer";
        essai.decoding = "async";
        const fini = () => {
            IMG.actives--;
            pomperImages();
        };
        essai.onload = () => {
            tache.img.src = tache.url;
            tache.img.removeAttribute("data-wpx-src");
            IMG.bilan.ok++;
            if (tache.repli) IMG.bilan.repli++;
            majBilanImages();
            fini();
        };
        essai.onerror = () => {
            const suivante = tache.replis.shift();
            if (suivante) {
                tache.url = suivante;
                tache.repli = true;
                IMG.file.unshift(tache);                    // la même carte d'abord : son image arrive sans attendre la file
            } else {
                const pic = tache.img.closest(".pic");
                if (pic) pic.classList.add("none");
                tache.img.style.visibility = "hidden";
                IMG.bilan.rate++;
                majBilanImages();
                console.warn("[dernières cartes] image introuvable :", tache.img.dataset.wpxSrc);
            }
            fini();
        };
        essai.src = tache.url;
    }
}

function majChoix() {
    const z = DER.z;
    $$(".wpx-dn-tuile", z.corps).forEach(t => {
        const x = DER.elements[+t.dataset.i];
        t.classList.toggle("wpx-dn-on", !!x && DER.choix.has(x.id));
    });
    const n = DER.choix.size;
    z.compte.textContent = pluriel(n, "cochée", "cochées");
    $$("[data-action]", z.actions).forEach(b => { b.disabled = DER.lot || !n; });
    z.etiquette.disabled = DER.lot;
}

/* clic sur une carte : la cocher (Maj : toute la plage depuis la dernière) ; « Fiche » : ouvrir la fiche du site */
function clicDernieres(e) {
    if (DER.lot) return;
    const fiche = e.target.closest("[data-fiche]");
    if (fiche) {
        const x = DER.elements[+fiche.dataset.fiche];
        if (x) ouvrirFicheDe(x).then(ok => { if (!ok) etat("La fiche ne s'est pas ouverte."); });
        return;
    }
    const tuile = e.target.closest(".wpx-dn-tuile");
    if (!tuile) return;
    const i = +tuile.dataset.i;
    const x = DER.elements[i];
    if (!x) return;
    const cocher = !DER.choix.has(x.id);
    const debut = e.shiftKey && DER.dernier >= 0 ? Math.min(DER.dernier, i) : i;
    const fin = e.shiftKey && DER.dernier >= 0 ? Math.max(DER.dernier, i) : i;
    for (let k = debut; k <= fin; k++) {
        if (cocher) DER.choix.add(DER.elements[k].id);
        else DER.choix.delete(DER.elements[k].id);
    }
    DER.dernier = i;
    majChoix();
}

/* ==========================================================================
   MES DERNIÈRES CARTES : LES ACTIONS, PAR LA FICHE DU SITE
   Pour chaque carte cochée : sa fiche s'ouvre, la bonne version (normale ou chromatique) est choisie, l'exemplaire
   affiché est vérifié, puis le bouton du site est actionné seulement si l'état n'est pas déjà le bon (une étiquette
   déjà posée n'est jamais retirée par « Poser »), et l'outil attend que la fiche montre le nouvel état.
   ========================================================================== */
const ficheOuverte = () => {
    const voile = $("#sheetVeil");
    return !!voile && voile.classList.contains("on");
};
const ficheCle = () => {
    const c = $("#sheet .l .card[data-cle]");
    return c ? c.getAttribute("data-cle") : "";
};
const ficheChargee = () => !!$("#shDyn .shbar");
const cleVoulue = x => x.cid + (x.sh ? "#sh" : "") + (x.hw ? "#hw" : "");

async function attendre(condition, ms) {
    const fin = Date.now() + (ms || DN.attenteMs);
    while (Date.now() < fin) {
        try {
            if (condition()) return true;
        } catch (erreur) { /* la fiche se redessine */ }
        await pause(100);
    }
    return false;
}

async function fermerFiche() {
    if (!ficheOuverte()) return;
    const bouton = $("#sheet [data-close-sheet]") || $("[data-close-sheet]");
    if (bouton) bouton.click();
    await attendre(() => !ficheOuverte(), 3000);
}

/* ouvre la fiche de la carte, dans sa version ; vrai si elle est prête */
async function ouvrirFicheDe(x) {
    const z = DER.z;
    if (ficheOuverte() && ficheCle().split("#")[0] !== x.cid) await fermerFiche();
    if (!ficheOuverte() || ficheCle().split("#")[0] !== x.cid) {
        const chemin = "/carte/" + encodeURIComponent(x.cid);
        z.lien.setAttribute("href", chemin);
        z.lien.setAttribute("data-interne", chemin);
        delete z.lien.dataset.rate;
        z.lien.hidden = false;
        z.lien.click();
        z.lien.hidden = true;
        if (z.lien.dataset.rate) return false;            // le site n'a pas pris le lien
        if (!await attendre(() => ficheOuverte() && ficheCle().split("#")[0] === x.cid && ficheChargee())) return false;
    }
    if (ficheCle() !== cleVoulue(x)) {
        const version = $(`#shDia button[data-dia="${x.sh ? 1 : 0}"]`);
        if (!version || x.hw) return false;
        version.click();
        if (!await attendre(() => ficheCle() === cleVoulue(x) && ficheChargee())) return false;
    }
    return true;
}

/* l'exemplaire que montre la fiche */
function exemplaireFiche() {
    const b = $("#shDyn [data-lockid]") || $("#sheet [data-avendre]");
    return b ? String(b.dataset.lockid || b.dataset.avendre) : "";
}

/* une action sur la fiche ouverte : "fait", "deja", ou une raison d'échec */
async function agirSurFiche(action, x, etiquette) {
    if (action === "poser" || action === "retirer") {
        const sel = `#shTagPose [data-tagflip="${CSS.escape(etiquette)}"]`;
        const b = $(sel);
        if (!b) return "étiquette introuvable sur la fiche";
        const voulu = action === "poser";
        if (b.classList.contains("on") === voulu) return "deja";
        b.click();
        return await attendre(() => { const n = $(sel); return !!n && n.classList.contains("on") === voulu; }, 5000) ? "fait" : "pas de réponse du site";
    }
    if (action === "verrouiller" || action === "deverrouiller") {
        const sel = `#shDyn [data-lockfiche][data-lockid="${x.id}"]`;
        const b = $(sel);
        if (!b) return "cadenas introuvable";
        const voulu = action === "verrouiller";
        if (b.classList.contains("on") === voulu) return "deja";
        b.click();
        return await attendre(() => { const n = $(sel); return !!n && n.classList.contains("on") === voulu; }, 5000) ? "fait" : "pas de réponse du site";
    }
    if (action === "vendre") {
        const cadenas = $(`#shDyn [data-lockfiche][data-lockid="${x.id}"]`);
        if (cadenas && cadenas.classList.contains("on")) return "verrouillée";
        const sel = `#sheet [data-avendre="${x.id}"]`;
        const b = $(sel);
        if (!b) return "bouton de vente introuvable";
        if (b.dataset.on === "0") return "deja";            // déjà de côté : le bouton la retirerait
        const avant = b.outerHTML;
        b.click();
        return await attendre(() => { const n = $(sel); return !n || n.outerHTML !== avant; }, 5000) ? "fait" : "pas de réponse du site";
    }
    return "action inconnue";
}

const NOMS_ACTIONS = {poser: "Poser l'étiquette", retirer: "Retirer l'étiquette", verrouiller: "Verrouiller",
    deverrouiller: "Déverrouiller", vendre: "Mettre de côté pour la vente"};

async function executerLot(action) {
    if (DER.lot || !DER.choix.size) return;
    const z = DER.z;
    const etiquette = z.etiquette.value;
    if ((action === "poser" || action === "retirer") && !etiquette) return etat("Choisis une étiquette.");
    const liste = DER.elements.filter(x => DER.choix.has(x.id));
    const tag = DER.infos.tags.find(t => String(t.id) === etiquette);
    const libelle = NOMS_ACTIONS[action] + (tag ? " « " + tag.name + " »" : "");
    if (!confirm(libelle + " sur " + pluriel(liste.length, "carte") + " ?")) return;
    DER.lot = true;
    DER.stop = false;
    z.arreter.hidden = false;
    z.charger.disabled = true;
    majChoix();
    const bilan = {fait: 0, deja: 0, rates: []};
    try {
        await fermerFiche();
        for (let k = 0; k < liste.length && !DER.stop; k++) {
            const x = liste[k];
            etat(libelle + " : " + (k + 1) + " / " + liste.length + "…");
            let resultat;
            if (!await ouvrirFicheDe(x)) resultat = "fiche pas ouverte";
            else if (exemplaireFiche() && exemplaireFiche() !== String(x.id)) resultat = "la fiche montre un autre exemplaire";
            else resultat = await agirSurFiche(action, x, etiquette);
            if (resultat === "fait" || resultat === "deja") {
                bilan[resultat]++;
                /* la carte suit, dans la fenêtre */
                if (action === "poser" && !x.tags.map(String).includes(etiquette)) x.tags.push(+etiquette);
                if (action === "retirer") x.tags = x.tags.filter(t => String(t) !== etiquette);
                if (action === "verrouiller") x.locked = true;
                if (action === "deverrouiller") x.locked = false;
            } else {
                bilan.rates.push(x.n + " : " + resultat);
            }
            await pause(DN.pauseLot);
        }
        await fermerFiche();
    } finally {
        DER.lot = false;
        z.arreter.hidden = true;
        z.charger.disabled = false;
        rendreDernieres();
    }
    if (bilan.rates.length) console.warn("[dernières cartes] non faites :", bilan.rates);
    etat((DER.stop ? "Arrêté · " : "") + pluriel(bilan.fait, "faite") + (bilan.deja ? " · " + bilan.deja + " déjà bonne(s)" : "")
        + (bilan.rates.length ? " · " + bilan.rates.length + " non faite(s) (détail dans la console)" : ""));
}

/* ==========================================================================
   L'INTERFACE : un menu et un nombre après « Sélectionner » (ou au bout des outils de la collection), et le bouton
   « Mes dernières cartes ». Marquée data-wpx : le script principal l'ignore, et la garde dans ses filtres collés.
   ========================================================================== */
function installerStyles() {
    if ($("#wpx-tri-styles")) return;
    const style = D.createElement("style");
    style.id = "wpx-tri-styles";
    style.textContent = `
#wpx-tri{display:inline-flex;align-items:center;gap:6px;margin-left:6px;vertical-align:middle;font:600 12.5px Inter,system-ui,sans-serif;color:var(--wpx-doux,var(--mute,#9a93b3))}
#wpx-tri[hidden]{display:none}
#wpx-tri select,#wpx-tri input,#wpx-dn select,#wpx-dn input{height:34px;padding:0 10px;border:1px solid var(--wpx-bord2,rgba(167,139,250,.32));border-radius:9px;
  background:rgba(0,0,0,.28);color:var(--wpx-encre,var(--ink,#ece9f6));font:500 13px Inter,system-ui,sans-serif;outline:none}
#wpx-tri select,#wpx-dn select{cursor:pointer}
#wpx-tri select option,#wpx-dn select option{background:var(--wpx-plein,#110b1e);color:var(--wpx-encre,#ece9f6)}
#wpx-tri input,#wpx-dn input{width:72px;padding:0 6px}
#wpx-tri select:focus,#wpx-tri input:focus,#wpx-dn select:focus,#wpx-dn input:focus{border-color:var(--wpx-accent,#c4b5fd)}
#wpx-tri.wpx-tri-actif select{border-color:transparent;background:var(--wpx-degrade,linear-gradient(135deg,#7c3aed,#c026d3));color:#fff}
#wpx-tri .wpx-tri-n[hidden]{display:none}
#wpx-tri .wpx-tri-statut{white-space:nowrap}
.wpx-dn-btn{display:inline-flex;align-items:center;height:32px;padding:0 12px;border:1px solid var(--wpx-bord,rgba(167,139,250,.16));border-radius:9px;
  background:rgba(255,255,255,.04);color:var(--wpx-encre,#ece9f6);font:600 12.5px Inter,system-ui,sans-serif;white-space:nowrap;cursor:pointer}
.wpx-dn-btn:hover:not(:disabled){background:rgba(255,255,255,.09);border-color:var(--wpx-bord2,rgba(167,139,250,.32))}
.wpx-dn-btn:disabled{opacity:.45;cursor:default}
.wpx-dn-plein{border-color:transparent;background:var(--wpx-degrade,linear-gradient(135deg,#7c3aed,#c026d3));color:#fff}
.wpx-dn-stop{border-color:rgba(248,113,113,.5);color:#fca5a5}
.wpx-dn-lien{padding:2px 6px;border:0;border-radius:6px;background:none;color:var(--wpx-accent,#c4b5fd);font:600 12px Inter,sans-serif;cursor:pointer}
.wpx-dn-lien:hover{background:rgba(255,255,255,.07)}
#wpx-dn{position:fixed;z-index:88;top:calc(var(--wpx-entete-bas,64px) + 10px);left:24px;right:24px;bottom:20px;display:flex;flex-direction:column;
  background:var(--wpx-plein,#110b1e);color:var(--wpx-encre,#ece9f6);border:1px solid var(--wpx-bord2,rgba(167,139,250,.32));border-radius:16px;
  box-shadow:0 30px 90px -20px #000;font:500 13.5px/1.45 Inter,system-ui,sans-serif}
#wpx-dn[hidden]{display:none}
#wpx-dn.wpx-dn-derriere{visibility:hidden}
.wpx-dn-tete{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--wpx-bord,rgba(167,139,250,.16))}
.wpx-dn-tete b{font:800 18px Sora,Inter,sans-serif;margin-right:6px}
.wpx-dn-etat{flex:1 1 200px;color:var(--wpx-doux,#9a93b3);font-size:12.5px}
.wpx-dn-x{width:32px;height:32px;border:1px solid var(--wpx-bord,rgba(167,139,250,.16));border-radius:9px;background:none;color:var(--wpx-doux,#9a93b3);cursor:pointer}
.wpx-dn-x:hover{color:#fff;background:rgba(255,255,255,.06)}
.wpx-dn-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px 18px;padding:10px 16px;border-bottom:1px solid var(--wpx-bord,rgba(167,139,250,.16));font-size:12.5px;color:var(--wpx-doux,#9a93b3)}
.wpx-dn-groupe{display:inline-flex;align-items:center;gap:6px}
#wpx-dn .wpx-dn-actions select{width:190px}
.wpx-dn-base{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:8px 16px;border-bottom:1px solid var(--wpx-bord,rgba(167,139,250,.16));
  font-size:12.5px;color:var(--wpx-doux,#9a93b3)}
.wpx-dn-base>b{font:800 12.5px Sora,Inter,sans-serif;color:var(--wpx-encre,#ece9f6)}
.wpx-dn-base-texte{flex:1 1 260px}
.wpx-dn-base .wpx-dn-btn{height:28px;padding:0 10px;font-size:12px}
.wpx-dn-base [hidden]{display:none}
.wpx-tb-bouton{position:relative;flex:0 0 auto;width:32px;height:40px;display:grid;place-items:center;padding:0;background:none;border:0;color:#cfc8e2;cursor:pointer}
.wpx-tb-bouton .wpx-ico{display:block;width:21px;height:21px}
.wpx-tb-bouton:hover{color:#fff}
.wpx-tb-bouton[hidden]{display:none!important}
.wpx-tb-bouton[aria-expanded="true"]{color:var(--wpx-accent,#c4b5fd)}
.wpx-tb-pastille{display:inline-block;flex:0 0 auto;width:10px;height:10px;border-radius:50%;background:#ef4444;box-shadow:0 0 8px rgba(239,68,68,.7)}
.wpx-tb-bouton .wpx-tb-pastille{position:absolute;right:1px;top:8px;width:8px;height:8px;border:1.5px solid var(--bg,#06040b)}
.wpx-tb-bouton[data-statut="vert"] .wpx-tb-pastille,.wpx-tb-pastille[data-statut="vert"]{background:#22c55e;box-shadow:0 0 8px rgba(34,197,94,.7)}
.wpx-tb-bouton[data-statut="orange"] .wpx-tb-pastille,.wpx-tb-pastille[data-statut="orange"]{background:#f59e0b;box-shadow:0 0 8px rgba(245,158,11,.7);animation:wpxTbPouls 1.2s ease-in-out infinite}
@keyframes wpxTbPouls{50%{opacity:.35}}
@media (max-width:700px){.row1>.wpx-tb-bouton{display:none}}
#wpx-tb{position:fixed;z-index:94;top:calc(var(--wpx-entete-bas,64px) + 8px);right:12px;width:min(470px,calc(100vw - 24px));
  max-height:calc(100vh - var(--wpx-entete-bas,64px) - 24px);display:flex;flex-direction:column;gap:9px;padding:14px 16px;
  background:var(--wpx-plein,#110b1e);color:var(--wpx-encre,#ece9f6);border:1px solid var(--wpx-bord2,rgba(167,139,250,.32));border-radius:16px;
  box-shadow:0 30px 90px -20px #000;font:500 13px/1.45 Inter,system-ui,sans-serif}
#wpx-tb[hidden]{display:none}
.wpx-tb-tete{display:flex;align-items:center;gap:10px}
.wpx-tb-tete>b{font:800 16px Sora,Inter,sans-serif}
.wpx-tb-tete .wpx-dn-x{margin-left:auto}
.wpx-tb-etat{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.wpx-tb-statut{font:800 13.5px Sora,Inter,sans-serif}
.wpx-tb-detail{flex:1 1 100%;color:var(--wpx-doux,#9a93b3);font-size:12.5px}
.wpx-tb-barre{height:9px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.wpx-tb-barre>i{display:block;height:100%;width:0;border-radius:99px;background:var(--wpx-degrade,linear-gradient(135deg,#7c3aed,#c026d3));transition:width .3s ease}
.wpx-tb-barre:not(.wpx-tb-actif)>i{background:#22c55e;opacity:.55}
.wpx-tb-barre.wpx-tb-actif>i{background-image:repeating-linear-gradient(45deg,rgba(255,255,255,.18) 0 8px,transparent 8px 16px),var(--wpx-degrade,linear-gradient(135deg,#7c3aed,#c026d3));
  background-size:22px 22px,100% 100%;animation:wpxTbRayures .8s linear infinite}
@keyframes wpxTbRayures{to{background-position:22px 0,0 0}}
.wpx-tb-progres{min-height:1.3em;margin-top:-4px;color:var(--wpx-doux,#9a93b3);font-size:11.5px}
.wpx-tb-boutons{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.wpx-tb-boutons [hidden]{display:none}
.wpx-tb-jtete{display:flex;align-items:center;gap:6px;margin-top:2px}
.wpx-tb-jtete>b{margin-right:auto;font:800 12.5px Sora,Inter,sans-serif}
.wpx-tb-journal{flex:1 1 auto;min-height:120px;max-height:280px;overflow:auto;overscroll-behavior:contain;padding:8px 10px;border-radius:10px;
  background:rgba(0,0,0,.28);font:11px/1.55 ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
.wpx-tb-l time{color:var(--wpx-pale,#6b6485)}
.wpx-tb-ok{color:#86efac}
.wpx-tb-alerte{color:#fde68a}
.wpx-tb-erreur{color:#fca5a5}
.wpx-tb-vide{color:var(--wpx-pale,#6b6485)}
@media (prefers-reduced-motion:reduce){.wpx-tb-pastille,.wpx-tb-barre>i{animation:none!important}}
.wpx-dn-compte{min-width:80px}
.wpx-dn-corps{flex:1;min-height:0;overflow:auto;padding:14px 16px 20px;overscroll-behavior:contain}
.wpx-dn-vide{color:var(--wpx-pale,#6b6485);text-align:center}
.wpx-dn-tuile{position:relative;cursor:pointer;user-select:none}
.wpx-dn-tuile .cw{position:relative;border-radius:12px;transition:box-shadow .12s}
.wpx-dn-tuile.wpx-dn-on .cw{box-shadow:0 0 0 3px var(--wpx-accent,#c4b5fd)}
.wpx-dn-coche{position:absolute;top:-7px;left:-7px;z-index:14;display:none;width:22px;height:22px;place-items:center;border-radius:50%;
  background:var(--wpx-degrade,linear-gradient(135deg,#7c3aed,#c026d3));color:#fff;font:800 12px/1 Inter,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.6)}
.wpx-dn-tuile.wpx-dn-on .wpx-dn-coche{display:grid}
.wpx-dn-info{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:5px;font-size:11.5px;color:var(--wpx-doux,#9a93b3)}
@media (max-width:700px){#wpx-dn{left:8px;right:8px;bottom:calc(var(--navbas-h,78px) + 8px)}}`;
    (D.head || D.documentElement).append(style);
}

function construireInterface() {
    const choix = D.createElement("select");
    choix.title = T.aide;
    choix.setAttribute("aria-label", T.aide);
    for (const m of MODES) choix.append(new Option(T[m], m));
    choix.value = mode;
    choix.addEventListener("change", () => {
        mode = choix.value;
        memoire.ecrire("tri.mode", mode);
        TRI.jeton++;                                   // une lecture en cours pour l'ancien mode s'arrête
        majInterface(TRI.grille);
        if (TRI.occupe) TRI.encore = true;
        else trier();
    });

    const nombreTri = D.createElement("input");
    nombreTri.type = "number";
    nombreTri.min = "1";
    nombreTri.max = String(DN.max);
    nombreTri.value = String(memoire.lire("tri.dernieres.n", DN.parDefaut));
    nombreTri.title = T.nombreAide;
    nombreTri.setAttribute("aria-label", T.nombreAide);
    /* (1.2) la valeur ne compte qu'une fois validée : OK ou Entrée */
    const valider = el("button", {type: "button", class: "wpx-dn-btn", title: T.validerAide}, "OK");
    /* (1.8) OK ouvre toujours la fenêtre des dernières cartes, sur toute la collection, quel que soit le nombre.
       Le tri de la page (le menu) suit le même nombre, borné à une page du site. */
    const validerNombre = () => {
        const n = parseInt(nombreTri.value, 10);
        if (!(n >= 1)) {
            nombreTri.value = String(memoire.lire("tri.dernieres.n", DN.parDefaut));
            return;
        }
        const total = Math.min(n, DN.max);
        nombreTri.value = String(total);
        ouvrirDernieres(total);
        const page = Math.min(n, CONFIG.cartesMax);
        if (page !== nCartes) {
            nCartes = page;
            memoire.ecrire("tri.n", nCartes);
            if (mode !== "site") planifier();
        }
    };
    valider.addEventListener("click", validerNombre);
    nombreTri.addEventListener("keydown", e => {
        if (e.key === "Enter") {
            e.preventDefault();
            validerNombre();
        }
    });

    const etiquette = D.createElement("span");
    etiquette.className = "wpx-tri-n";
    etiquette.append(nombreTri, " " + T.premieres + " ", valider);

    const zoneStatut = D.createElement("span");
    zoneStatut.className = "wpx-tri-statut";
    zoneStatut.setAttribute("aria-live", "polite");

    const dernieres = el("button", {type: "button", class: "wpx-dn-btn", title: T.dernieresAide}, T.dernieres);
    dernieres.addEventListener("click", ouvrirDernieres);

    const ui = D.createElement("span");
    ui.id = "wpx-tri";
    ui.setAttribute("data-wpx", "");
    ui.append(choix, etiquette, zoneStatut, dernieres);
    TRI.ui = {racine: ui, choix, etiquette, statut: zoneStatut};
}

/* (2.5) Posée à côté de « Sélectionner », reposée dès qu'elle n'y est plus (le site redessine ses outils quand on
   revient dans Ma collection), et affichée sur Ma collection hors de l'onglet Étiquettes, que la grille soit déjà
   dessinée ou non. Aussi vérifié chaque seconde : un redessin qui passerait inaperçu ne la fait plus disparaître. */
function majInterface() {
    const vue = $("#v-coll");
    const onglet = $("#ctabs button.on");
    const ici = !!vue && vue.classList.contains("on") && !(onglet && onglet.dataset.c === "album");
    if (!TRI.ui) {
        if (!ici) return;
        construireInterface();
    }
    const {racine, choix, etiquette} = TRI.ui;
    if (ici) {
        const repere = $("#v-coll #selBtn");
        const outils = $("#v-coll #cTools");
        const malPlacee = !racine.isConnected || (repere ? racine.previousElementSibling !== repere : !!outils && racine.parentNode !== outils);
        if (malPlacee) {
            if (repere) repere.after(racine);
            else if (outils) outils.append(racine);
        }
    }
    const cache = !ici || !racine.isConnected;
    if (racine.hidden !== cache) racine.hidden = cache;
    if (choix.value !== mode) choix.value = mode;
    if (etiquette.hidden) etiquette.hidden = false;
    racine.classList.toggle("wpx-tri-actif", mode !== "site");
}

function statut(texte) {
    if (TRI.ui && TRI.ui.statut.textContent !== texte) TRI.ui.statut.textContent = texte;
}

/* ==========================================================================
   DÉMARRAGE
   ========================================================================== */
function demarrer() {
    installerStyles();
    /* (2.0) la base : son état (pour y noter les dates lues), les cadenas captés au passage, une construction à reprendre */
    try {
        installerRelaisCadenas();
        lireEtatBase().catch(() => {});
        /* (2.1) le bouton de la base dans l'en-tête, reposé si le site redessine sa rangée */
        installerBoutonBase();
        setInterval(installerBoutonBase, 2000);
        /* (2.5) le tri et « Mes dernières cartes », reposés à côté de « Sélectionner » */
        setInterval(majInterface, 1000);
        reprendreConstruction();
        /* un autre outil (le verrouillage) demande une base à jour : on la met à jour, puis on le prévient */
        D.addEventListener("wpx-base-demande-maj", () => {
            avecBase(() => majBaseDifferences(texte => majPanneauBase(texte), () => true))
                .catch(erreur => console.warn("[base] mise à jour demandée impossible :", erreur))
                .finally(() => D.dispatchEvent(new CustomEvent("wpx-base-a-jour")));
        });
    } catch (erreur) {
        console.warn("[tri par date] base de la collection indisponible :", erreur);
    }
    new MutationObserver(changements => {
        for (const c of changements) {
            const cible = c.target.nodeType === 1 ? c.target : c.target.parentElement;
            if (!cible || cible.closest("[data-wpx]")) continue;
            /* une classe qui change : seulement le changement de page ou d'onglet de la collection */
            if (c.type === "attributes" && !cible.matches("section.view, #ctabs button")) continue;
            planifier();
            return;
        }
    }).observe(D.body, {childList: true, subtree: true, attributes: true, attributeFilter: ["class"]});
    D.addEventListener("keydown", e => {
        if (e.key === "Escape" && TB.vue && !TB.vue.hidden) fermerTableauBord();
        else if (e.key === "Escape" && DER.vue && !DER.vue.hidden && !ficheOuverte() && !$(".veil.on")) fermerDernieres();
    });
    planifier();
    setTimeout(() => {
        if (!window.__wpxActif) console.warn("[tri par date] Album+cleaner+Maximisation n'est pas actif : l'addon marche seul, sans le style du script principal.");
    }, 3000);
    console.info("[tri par date] addon v" + CONFIG.VERSION + " actif.");
}

if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", demarrer, {once: true});
else demarrer();

})();