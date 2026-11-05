// ==UserScript==
// @name         [test]Album+cleaner — tri par date d'obtention (addon)
// @namespace    local
// @version      1.7
// @description  Addon de Album+cleaner+Maximisation : dans « Ma collection », trie les cartes de la page par date d'obtention, et ouvre « Mes dernières cartes » (les N dernières obtenues, toute la collection) pour les étiqueter, les verrouiller ou les mettre de côté pour la vente, une par une ou en lot, par les fiches du site.
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
    VERSION: "1.7",

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
        min: 10,
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
    lecturesSimultanees: 50,
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
        nombreAide: "Nombre de cartes : jusqu'à 100, les premières de la page sont triées ; au-delà, « Mes dernières cartes » s'ouvre sur toute la collection",
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
        return r.json();
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
    DER.vue = el("aside", {id: "wpx-dn", "data-wpx": "", role: "dialog", "aria-label": T.dernieres, hidden: true},
        el("header", {class: "wpx-dn-tete"}, el("b", null, T.dernieres), z.nombre, z.charger, z.etat, z.images, z.fermer),
        z.actions, z.corps, z.lien);
    DER.z = z;
    D.body.append(DER.vue);

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
        etat("Lecture de la collection…");
        const {tous, infos} = await candidatsParIdentifiant(n, continuer, lues => etat("Lecture de la collection… " + lues + " page(s)"));
        if (!continuer()) return;
        DER.infos = infos;
        etat("Lecture de tes échanges et achats…");
        const historique = await candidatsHistorique(n);
        if (!continuer()) return;
        /* une carte sans image dans la liste du site (et celles de l'historique) : l'image vient de sa fiche */
        const demandes = tous.map(x => ({cid: x.cid, id: x.id, infos: !x.img}))
            .concat(historique.map(h => ({cid: h.cid, frais: DN.histoFrais, infos: true})));
        const rates = await lireFiches(demandes, continuer, (fait, total) => etat("Dates : " + fait + " / " + total + "…"));
        if (!continuer()) return;

        /* chaque exemplaire, daté par sa fiche ; ceux de l'historique ne sont gardés que s'ils sont encore à toi */
        const cache = lireCache();
        const elements = new Map(tous.map(x => [x.id, x]));
        for (const h of historique) {
            const e = cache.cartes[h.cid];
            if (!e || !e.ex) continue;
            const ids = Object.keys(e.ex);
            for (const id of ids) {
                if (elements.has(+id)) continue;
                const fl = e.fl && e.fl[id] != null ? e.fl[id] : ids.length === 1 ? (h.sh ? 1 : 0) + (h.hw ? 2 : 0) : null;
                if (fl != null && (!!(fl & 1) !== h.sh || !!(fl & 2) !== h.hw)) continue;     // une autre version de la carte
                elements.set(+id, {id: +id, cid: h.cid, n: h.n, d: "", img: h.img || "", r: h.r, locked: false, tags: [],
                    sh: h.sh, hw: h.hw, partiel: true});
            }
        }
        const date = x => {
            const e = cache.cartes[x.cid];
            return (e && e.ex && e.ex[String(x.id)]) || 0;
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
    nombreTri.value = String(nCartes);
    nombreTri.title = T.nombreAide;
    nombreTri.setAttribute("aria-label", T.nombreAide);
    /* (1.2) la valeur ne compte qu'une fois validée : OK ou Entrée */
    const valider = el("button", {type: "button", class: "wpx-dn-btn", title: T.validerAide}, "OK");
    const validerNombre = () => {
        const n = parseInt(nombreTri.value, 10);
        if (!(n >= 1)) {
            nombreTri.value = String(nCartes);
            return;
        }
        /* plus de cartes qu'une page du site n'en montre : la fenêtre des dernières cartes, sur toute la collection */
        if (n > CONFIG.cartesMax) {
            nombreTri.value = String(Math.min(n, DN.max));
            ouvrirDernieres(Math.min(n, DN.max));
            return;
        }
        nCartes = n;
        memoire.ecrire("tri.n", nCartes);
        if (mode === "site") {
            mode = "recent";
            memoire.ecrire("tri.mode", mode);
            majInterface(TRI.grille);
        }
        TRI.jeton++;
        if (TRI.occupe) TRI.encore = true;
        else trier();
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

/* posée, reposée si le site redessine ses outils, cachée hors de la grille des cartes */
function majInterface(g) {
    if (!TRI.ui) {
        if (!g) return;
        construireInterface();
    }
    const {racine, choix, etiquette} = TRI.ui;
    if (!racine.isConnected || (g && racine.closest("#v-coll") === null)) {
        const repere = $("#v-coll #selBtn");
        const outils = $("#v-coll #cTools");
        if (repere) repere.after(racine);
        else if (outils) outils.append(racine);
        else if (!g) return;
    }
    racine.hidden = !g;
    if (choix.value !== mode) choix.value = mode;
    etiquette.hidden = false;
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
        if (e.key === "Escape" && DER.vue && !DER.vue.hidden && !ficheOuverte() && !$(".veil.on")) fermerDernieres();
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