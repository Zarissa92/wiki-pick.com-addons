// ==UserScript==
// @name         [test]Album+cleaner — vendeurs bloqués (addon)
// @namespace    local
// @version      2.1
// @description  Addon de Album+cleaner+Maximisation : masque au marché les annonces des vendeurs que tu as bloqués sur wiki-pick.com, avec un bouton à côté de Messages pour les afficher ou les masquer
// @match        https://wiki-pick.com/*
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
"use strict";

/* Le code tourne dans la page elle-même : il doit voir passer les réponses du site (fetch et XMLHttpRequest) avant que
   le site ne les lise. Le gestionnaire de scripts n'y a pas accès directement : on y dépose le code, dès le début. */
function principal() {
    /* Une seule instance, même si le gestionnaire injecte le script deux fois */
    if (window.__wpxBloquesActif) return;
    window.__wpxBloquesActif = true;

    /* ======================================================================
       CONFIGURATION
       ====================================================================== */
    const CONFIG = {
        VERSION: "2.1",
        /* la liste des pseudos bloqués, lue sur le site */
        urlBlocages: "/api/blocages",
        /* (2.0) la liste est gardée N minutes ; elle est relue tout de suite quand tu bloques ou débloques quelqu'un */
        cacheMin: 5,
        /* les réponses qui contiennent les annonces du marché */
        motifAnnonces: /^\/api\/auctions\/?$/,
        /* une requête qui change tes blocages (tout ce qui n'est pas une lecture, sur une adresse qui parle de blocage) */
        motifBlocage: /bloc/i,
        /* le bouton Messages : le nôtre se place juste après, au même format */
        boutonMessages: 'button[data-dock="ouvrir"]',
        /* "1" : masquage actif, "0" : désactivé (la clé de la v1.5, reprise telle quelle) */
        cleEtat: "wpx.bloques.actif"
    };

    const D = document;
    const fetchPrecedent = window.fetch;

    /* ---- l'état du bouton, gardé dans le navigateur ---- */
    function actif() {
        try {
            return localStorage.getItem(CONFIG.cleEtat) !== "0";
        } catch (erreur) {
            return true;
        }
    }
    function definirActif(oui) {
        try {
            localStorage.setItem(CONFIG.cleEtat, oui ? "1" : "0");
        } catch (erreur) { /* stockage indisponible : le choix vaut pour cette page seulement */ }
    }

    /* (2.0) les pseudos sont comparés sans accents, sans casse et sans espaces superflus, comme le disait la v1.5 */
    const normaliser = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "")
        .replace(/\s+/g, " ").trim().toLowerCase();

    /* (2.0) l'adresse d'une requête, qu'elle soit un texte, un objet URL ou un objet Request */
    function chemin(entree) {
        try {
            const brut = typeof entree === "string" ? entree : entree instanceof URL ? entree.href : (entree && entree.url) || "";
            const u = new URL(brut, location.href);
            return u.origin === location.origin ? u.pathname : "";
        } catch (erreur) {
            return "";
        }
    }
    const estAnnonces = entree => CONFIG.motifAnnonces.test(chemin(entree));
    /* (2.1) une enchère seule (ouverte par un lien direct) : toute adresse /api/auction… qui n'est pas la liste */
    const estEnchere = entree => {
        const c = chemin(entree);
        return /^\/api\/auctions?(\/|$)/.test(c) && !CONFIG.motifAnnonces.test(c);
    };
    const changeBlocages = (entree, methode) => String(methode || "GET").toUpperCase() !== "GET" && CONFIG.motifBlocage.test(chemin(entree));

    /* ======================================================================
       LA LISTE DES VENDEURS BLOQUÉS
       ====================================================================== */
    const BLOQUES = {noms: null, date: 0, attente: null, masquees: 0};
    const frais = () => !!BLOQUES.noms && Date.now() - BLOQUES.date < CONFIG.cacheMin * 60000;

    function chargerBloques() {
        if (frais()) return Promise.resolve(BLOQUES.noms);
        if (BLOQUES.attente) return BLOQUES.attente;
        BLOQUES.attente = Reflect.apply(fetchPrecedent, window, [CONFIG.urlBlocages, {credentials: "same-origin"}])
            .then(r => {
                if (!r.ok) throw new Error("HTTP " + r.status);
                return r.json();
            })
            .then(d => {
                const liste = d && Array.isArray(d.bloques) ? d.bloques : [];
                BLOQUES.noms = new Set(liste.map(b => normaliser(b && typeof b === "object" ? b.name : b)).filter(Boolean));
                BLOQUES.date = Date.now();
            })
            .catch(() => {
                /* en cas d'échec : la dernière liste connue (ou aucune), et un nouvel essai au prochain chargement */
                if (!BLOQUES.noms) BLOQUES.noms = new Set();
            })
            .then(() => {
                BLOQUES.attente = null;
                majBouton();
                return BLOQUES.noms;
            });
        return BLOQUES.attente;
    }

    /* tu viens de bloquer ou débloquer quelqu'un : la liste sera relue au prochain chargement d'annonces */
    function oublierBloques() {
        BLOQUES.date = 0;
    }

    /* ======================================================================
       LE FILTRE : les annonces des vendeurs bloqués sont retirées de la réponse, avant que le site ne la lise
       ====================================================================== */
    function retirerDansObjet(d) {
        if (!actif() || !d || typeof d !== "object" || !Array.isArray(d.items) || !BLOQUES.noms || !BLOQUES.noms.size) return 0;
        const gardees = d.items.filter(a => !BLOQUES.noms.has(normaliser(a && a.seller)));
        const retirees = d.items.length - gardees.length;
        if (retirees) {
            d.items = gardees;
            BLOQUES.masquees += retirees;
            console.info("[vendeurs bloqués] " + retirees + " annonce(s) masquée(s)");
            majBouton();
        }
        return retirees;
    }

    /* un texte de réponse donne toujours le même résultat (gardé : il n'est ni relu ni recompté à chaque lecture) */
    const TEXTES = new Map();
    function filtrerTexte(brut) {
        if (typeof brut !== "string" || !actif() || !BLOQUES.noms || !BLOQUES.noms.size) return brut;
        if (TEXTES.has(brut)) return TEXTES.get(brut);
        let filtre = brut;
        try {
            const d = JSON.parse(brut);
            if (retirerDansObjet(d)) filtre = JSON.stringify(d);
        } catch (erreur) { /* pas du JSON : la réponse reste telle quelle */ }
        if (TEXTES.size > 20) TEXTES.clear();
        TEXTES.set(brut, filtre);
        return filtre;
    }

    const OBJETS = new WeakSet();
    function filtrerObjet(o) {
        if (!o || typeof o !== "object" || OBJETS.has(o)) return o;
        OBJETS.add(o);
        retirerDansObjet(o);
        return o;
    }

    /* ---- fetch (le site l'utilise pour le marché et ses filtres) ----
       (2.0) on appelle le fetch qui était là avant nous : un autre script (le script principal) peut se poser
       par-dessus ou dessous, chacun passe la main au suivant, dans n'importe quel ordre */
    window.fetch = function (entree, options) {
        const methode = (options && options.method) || (entree && typeof entree === "object" && entree.method) || "GET";
        if (changeBlocages(entree, methode)) {
            const promesse = Reflect.apply(fetchPrecedent, this, arguments);
            promesse.then(oublierBloques, oublierBloques);
            return promesse;
        }
        if (estEnchere(entree)) {
            /* (2.1) une enchère seule : la réponse n'est pas touchée, on y lit seulement le vendeur */
            const promesse = Reflect.apply(fetchPrecedent, this, arguments);
            promesse.then(r => (r.ok ? r.clone().json() : null)).then(noterEnchere).catch(() => {});
            return promesse;
        }
        if (!actif() || !estAnnonces(entree)) return Reflect.apply(fetchPrecedent, this, arguments);
        const args = arguments;
        return chargerBloques()
            .then(() => Reflect.apply(fetchPrecedent, this, args))
            .then(async reponse => {
                if (!reponse.ok) return reponse;
                let texte;
                try {
                    texte = await reponse.clone().text();
                } catch (erreur) {
                    return reponse;
                }
                const filtre = filtrerTexte(texte);
                if (filtre === texte) return reponse;
                /* la réponse refaite garde l'état et les en-têtes de l'originale */
                const entetes = new Headers(reponse.headers);
                entetes.delete("content-length");
                entetes.delete("content-encoding");
                entetes.set("content-type", "application/json; charset=utf-8");
                return new Response(filtre, {status: reponse.status, statusText: reponse.statusText, headers: entetes});
            });
    };

    /* ---- XMLHttpRequest (le site l'utilise pour certaines annonces) ---- */
    const proto = XMLHttpRequest.prototype;
    const descTexte = Object.getOwnPropertyDescriptor(proto, "responseText");
    const descReponse = Object.getOwnPropertyDescriptor(proto, "response");
    const ouvrirPrecedent = proto.open;
    const envoyerPrecedent = proto.send;

    proto.open = function (methode, url) {
        this.__wpxUrl = url;
        this.__wpxMethode = methode;
        return Reflect.apply(ouvrirPrecedent, this, arguments);
    };

    proto.send = function () {
        const xhr = this;
        const args = arguments;
        if (changeBlocages(xhr.__wpxUrl, xhr.__wpxMethode)) {
            xhr.addEventListener("loadend", oublierBloques, {once: true});
            return Reflect.apply(envoyerPrecedent, xhr, args);
        }
        if (estEnchere(xhr.__wpxUrl)) {
            xhr.addEventListener("load", () => {
                try {
                    const v = descReponse.get.call(xhr);
                    noterEnchere(typeof v === "string" ? JSON.parse(v) : v);
                } catch (erreur) { /* réponse illisible : pas d'avertissement */ }
            }, {once: true});
            return Reflect.apply(envoyerPrecedent, xhr, args);
        }
        if (!actif() || !estAnnonces(xhr.__wpxUrl)) return Reflect.apply(envoyerPrecedent, xhr, args);
        Object.defineProperty(xhr, "responseText", {configurable: true, get() { return filtrerTexte(descTexte.get.call(xhr)); }});
        Object.defineProperty(xhr, "response", {
            configurable: true,
            get() {
                const v = descReponse.get.call(xhr);
                return typeof v === "string" ? filtrerTexte(v) : filtrerObjet(v);
            }
        });
        /* (2.0) liste à jour : la requête part tout de suite ; sinon, une fois la liste lue */
        if (frais()) return Reflect.apply(envoyerPrecedent, xhr, args);
        chargerBloques().then(() => Reflect.apply(envoyerPrecedent, xhr, args));
        return undefined;
    };

    /* ======================================================================
       (2.1) UNE ENCHÈRE OUVERTE PAR UN LIEN DIRECT
       Le filtre ne touche que la liste du marché : une enchère ouverte par un lien (Discord, un profil, une
       notification) s'affiche quand même. Son vendeur est lu dans la réponse du site ; s'il est bloqué, un bandeau
       le dit en haut de l'enchère, que le masquage soit actif ou non. L'enchère reste utilisable.
       ====================================================================== */
    const ENCHERE = {vendeur: ""};

    /* le vendeur, où que le site le range dans la réponse */
    function vendeurDe(d) {
        if (!d || typeof d !== "object") return "";
        for (const o of [d, d.item, d.auction, d.a, d.enchere, d.lot]) {
            if (o && typeof o === "object") {
                const v = o.seller || o.vendeur;
                if (typeof v === "string" && v) return v;
                if (v && typeof v === "object" && typeof v.name === "string") return v.name;
            }
        }
        return "";
    }

    function noterEnchere(d) {
        const vendeur = vendeurDe(d);
        if (!vendeur) return;
        chargerBloques().then(noms => {
            ENCHERE.vendeur = noms && noms.has(normaliser(vendeur)) ? vendeur : "";
            majBandeau();
        });
    }

    function majBandeau() {
        const zone = D.querySelector("#auction");
        const vue = D.querySelector("main section.view.on");
        const montrer = !!zone && !!ENCHERE.vendeur && !!vue && vue.id === "v-auction";
        let bandeau = D.getElementById("wpx-bloque-bandeau");
        if (!montrer) {
            if (bandeau) bandeau.remove();
            return;
        }
        if (!bandeau) {
            bandeau = D.createElement("div");
            bandeau.id = "wpx-bloque-bandeau";
            bandeau.setAttribute("data-wpx", "");
            bandeau.setAttribute("role", "status");
            bandeau.style.cssText = "display:flex;align-items:center;gap:8px;margin:0 0 14px;padding:10px 14px;border-radius:12px;"
                + "background:rgba(248,113,113,.12);border:1px solid rgba(248,113,113,.5);color:#fecaca;font:600 13.5px/1.4 Inter,system-ui,sans-serif";
        }
        const texte = "⛔ Vendeur bloqué : " + ENCHERE.vendeur + ". Cette enchère est cachée de ton marché.";
        if (bandeau.textContent !== texte) bandeau.textContent = texte;
        if (zone.firstChild !== bandeau) zone.prepend(bandeau);
    }

    /* ======================================================================
       LE BOUTON, juste après Messages, au même format. Marqué data-wpx : le script principal l'ignore.
       ====================================================================== */
    const OEIL = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>';
    const ICONES = {
        on: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">${OEIL}</svg>`,
        off: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">${OEIL}<path d="M3 3l18 18"></path></svg>`
    };
    let bouton = null;

    function majBouton() {
        if (!bouton) return;
        const on = actif();
        const n = BLOQUES.noms ? BLOQUES.noms.size : 0;
        bouton.innerHTML = (on ? ICONES.on : ICONES.off) + "<span></span>";
        bouton.querySelector("span").textContent = on ? "Vendeurs bloqués : masqués" : "Vendeurs bloqués : affichés";
        bouton.title = (on ? "Cliquer pour afficher" : "Cliquer pour masquer") + " les annonces des vendeurs bloqués"
            + (n ? " (" + n + " vendeur(s) bloqué(s)" + (on && BLOQUES.masquees ? ", " + BLOQUES.masquees + " annonce(s) masquée(s) depuis le chargement" : "") + ")" : "");
        bouton.setAttribute("aria-pressed", String(on));
    }

    /* Le masquage se fait sur les réponses du site : les annonces déjà à l'écran ne changent qu'en les redemandant.
       (2.0) La page ne se recharge que sur le marché ; ailleurs, le choix vaut pour les prochaines annonces. */
    function basculer() {
        definirActif(!actif());
        TEXTES.clear();
        majBouton();
        const vue = D.querySelector("main section.view.on");
        if (vue && vue.id === "v-market") location.reload();
    }

    function placerBouton() {
        if (bouton && bouton.isConnected) return;
        const messages = D.querySelector(CONFIG.boutonMessages);
        if (!messages) return;
        if (!bouton) {
            bouton = D.createElement("button");
            bouton.id = "wpx-bloques-bascule";
            bouton.type = "button";
            bouton.className = "mdock-pli";
            bouton.setAttribute("data-wpx", "");
            bouton.addEventListener("click", basculer);
        }
        majBouton();
        messages.after(bouton);
    }

    /* (2.0) le site peut redessiner la barre des messages : le bouton est reposé, au plus une fois par image */
    function surveiller() {
        placerBouton();
        let prevu = 0;
        /* (2.1) et le bandeau d'une enchère est reposé si le site la redessine, ou retiré quand on la quitte */
        new MutationObserver(() => {
            if (prevu) return;
            const bandeau = D.getElementById("wpx-bloque-bandeau");
            const bandeauAJour = ENCHERE.vendeur ? !!bandeau && bandeau.isConnected && bandeau.parentNode.firstChild === bandeau : !bandeau;
            if (bouton && bouton.isConnected && bandeauAJour) return;
            prevu = requestAnimationFrame(() => {
                prevu = 0;
                placerBouton();
                majBandeau();
            });
        }).observe(D.body || D.documentElement, {childList: true, subtree: true, attributes: true, attributeFilter: ["class"]});
        if (actif()) chargerBloques();
        console.info("[vendeurs bloqués] addon v" + CONFIG.VERSION + " actif.");
    }
    if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", surveiller, {once: true});
    else surveiller();
}

/* Dépôt dans la page, dès le début (le gestionnaire de scripts n'a pas le droit de remplacer fetch pour la page) */
const script = document.createElement("script");
script.textContent = "(" + principal.toString() + ")();";
(document.documentElement || document.head).appendChild(script);
script.remove();
})();