// ==UserScript==
// @name         [test]Wiki-Pick verrouillage (tiroir d'export)
// @namespace    local.wikipick.lock
// @version      2.14
// @description  Verrouille ou déverrouille les cartes d'étiquettes, ou une à une, depuis le tiroir d'export d'Album+cleaner
// @match        https://wiki-pick.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// @homepageURL  https://github.com/Zarissa92/wiki-pick.com-addons
// @updateURL    https://raw.githubusercontent.com/Zarissa92/wiki-pick.com-addons/main/album.verrouillage.js
// @downloadURL  https://raw.githubusercontent.com/Zarissa92/wiki-pick.com-addons/main/album.verrouillage.js
// ==/UserScript==

(function () {
  "use strict";

  // ===== PARAMÈTRES MODIFIABLES =====
  // (2.8) verrouillages : un seul à la fois, et ce délai entre la fin de l'un et le départ du suivant.
  // Les lectures des copies, elles, restent rapides (LECTURES_SIMULTANEES en parallèle, sans délai).
  const DELAI_ENTRE_VERROUILLAGES_MS = 900;
  // (2.14) les exemplaires partent en un seul envoi groupé, comme le fait le site, jusqu'à ce nombre par envoi
  const EXEMPLAIRES_PAR_ENVOI = 25;
  const CONFIRMATION_A_PARTIR_DE = 10;       // demande confirmation au-delà de ce nombre de cartes
  const TAILLE_LOT = 100;                    // cartes traitées par lot
  const LECTURES_SIMULTANEES = 4;            // lectures de la collection en parallèle, dans un bloc
  const LECTURES_PAR_BLOC = 50;              // (2.9) les copies sont lues par blocs de 50 cartes…
  const PAUSE_ENTRE_BLOCS_LECTURE_MS = 1500; // … avec cette pause entre deux blocs
  // (2.10) quand le site répond 429 (« trop de requêtes ») : toutes les requêtes de l'outil s'arrêtent le temps demandé
  // par le site (en-tête Retry-After), sinon ATTENTE_429_MS, doublée à chaque nouveau refus, puis la même requête repart
  const REESSAIS_429 = 5;                    // nouveaux essais au plus pour une même requête
  const ATTENTE_429_MS = 5000;               // première attente si le site ne dit pas combien
  const ATTENTE_429_MAX_MS = 120000;         // jamais plus de 2 min d'un coup
  const PAUSE_ENTRE_LOTS_MS = 2000;          // pause entre deux lots
  const URL_SITE = "https://wiki-pick.com";
  const LIGNES_AFFICHEES_MAX = 300;          // lignes du journal affichées à l'écran (tout reste dans l'export)
  const LIGNES_GARDEES_MAX = 20000;          // lignes gardées en mémoire pour l'export
  // caches de l'outil Album+cleaner que « Vider la mémoire » peut retirer (jamais ses réglages, paquets ni serveurs)
  const PREFIXES_CACHE_OUTIL = ["wpx.aDeja.", "wpx.chances.comptes", "wpx.discord.achats"];
  // (2.6) en quittant le panneau de verrouillage (autre mode du tiroir, tiroir fermé, autre page), tout est vidé :
  // journal, liste des cartes, proposition « inverse », progression, fenêtre du journal, et ces caches de l'outil.
  // wpx.discord.achats n'y est pas : l'effacer à chaque sortie ferait repartir vers Discord les achats des 2 dernières heures.
  const VIDER_EN_QUITTANT = true;
  const CACHES_VIDES_EN_QUITTANT = ["wpx.aDeja.", "wpx.chances.comptes"];
  // ===== FIN DES PARAMÈTRES =====

  if (window.__wpxVerrouActif) return;
  window.__wpxVerrouActif = true;

  const RUN = { en: false, stop: false };
  const DERNIER = { cartes: null, on: null };   // dernier traitement terminé, pour proposer l'inverse
  const LOG = [];                                // tout le journal de la session : affiché et exporté
  const JRN = { vue: null, corps: null, compte: null };
  const ETAT = { panneau: null, journal: null, resume: null, corps: null, signature: "", planifie: 0, mode: null,
                 statut: null, compte: null, fill: null, detail: null, apres: null, bouton: null, groupes: [],
                 dedans: false, aVider: false };   // dedans : le panneau est affiché ; aVider : à vider à la fin du traitement

  const SVG_FERME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
  const SVG_OUVERT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.7-1.5"/></svg>';

  const FORMAT_NOMBRE = new Intl.NumberFormat("fr-FR");
  const pause = ms => new Promise(r => setTimeout(r, ms));
  const propre = t => String(t == null ? "" : t).replace(/\s+/g, " ").trim();
  const nombre = n => FORMAT_NOMBRE.format(n);
  const pluriel = (n, un, plusieurs) => nombre(n) + " " + (n > 1 ? (plusieurs || un + "s") : un);
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const p2 = n => String(n).padStart(2, "0");

  // Les icônes SVG sont analysées une seule fois, puis clonées
  const CACHE_SVG = new Map();
  function svg(code) {
    let modele = CACHE_SVG.get(code);
    if (!modele) {
      modele = document.createElement("template");
      modele.innerHTML = code.trim();
      CACHE_SVG.set(code, modele);
    }
    return modele.content.cloneNode(true);
  }

  function h(tag, attrs, ...enfants) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of enfants.flat(Infinity)) {
      if (c == null || c === false) continue;
      if (typeof c === "string" && c.trim().startsWith("<svg")) { e.append(svg(c)); continue; }
      e.append(typeof c === "object" ? c : String(c));
    }
    return e;
  }

  // Même nom d'étiquette que le script d'export (titre sans pastille, compteur ni flèches).
  // Lu sans cloner le titre, et mis en cache tant que le texte du titre ne change pas.
  const EXCLUS_TITRE = "small, .albpastille, .albfleches, .pdico, button";
  const CACHE_NOMS = new WeakMap();
  function nomDuTitre(titre) {
    const brut = titre.textContent;
    const memo = CACHE_NOMS.get(titre);
    if (memo && memo.brut === brut) return memo.nom;
    let texte = "";
    const w = document.createTreeWalker(titre, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const exclu = n.parentElement && n.parentElement.closest(EXCLUS_TITRE);
      if (exclu && titre.contains(exclu)) continue;
      texte += n.data;
    }
    const nom = propre(texte);
    CACHE_NOMS.set(titre, { brut, nom });
    return nom;
  }

  function sectionsParNom() {
    const map = new Map();
    for (const s of $$("section.album")) {
      const t = $("h2.albtitre", s);
      if (!t) continue;
      const nom = nomDuTitre(t);
      if (!map.has(nom)) map.set(nom, s);
    }
    return map;
  }

  // Cartes d'une étiquette, sans doublon. cle = cid + "#sh" / "#hw" selon la version
  function cartesDeSection(section) {
    const vues = new Set();
    const liste = [];
    for (const carte of section.querySelectorAll(".card[data-cle]")) {
      const nom = propre(($(".hd .nm", carte) || {}).textContent);
      const cle = carte.getAttribute("data-cle") || "";
      if (!nom || !cle || vues.has(cle)) continue;
      vues.add(cle);
      liste.push({ nom, cle, cid: cle.split("#")[0], sh: cle.includes("#sh"), hw: cle.includes("#hw") });
    }
    return liste;
  }

  // Étiquettes cochées dans le tiroir, dans l'ordre affiché
  function etiquettesChoisies() {
    const tiroir = $("#wpx-tiroir");
    if (!tiroir) return [];
    const lignes = $$('.wpx-t-ligne[aria-selected="true"]', tiroir);
    if (!lignes.length) return [];
    const sections = sectionsParNom();
    return lignes.map(l => {
      const nom = propre(($(":scope > span", l) || {}).textContent);
      return { nom, section: sections.get(nom) || null };
    });
  }

  // Étiquettes cochées avec leurs cartes, calculées en une seule passe
  function groupesChoisis() {
    return etiquettesChoisies().map(e => ({ nom: e.nom, cartes: e.section ? cartesDeSection(e.section) : null }));
  }

  function fusionner(groupes) {
    const vues = new Set();
    const liste = [];
    for (const g of groupes) {
      for (const c of g.cartes || []) {
        if (!vues.has(c.cle)) { vues.add(c.cle); liste.push(c); }
      }
    }
    return liste;
  }

  function cartesChoisies() {
    return fusionner(groupesChoisis());
  }

  // Signature légère pour détecter un changement de sélection ou de cartes chargées
  function signatureSelection() {
    return etiquettesChoisies()
      .map(e => e.nom + ":" + (e.section ? e.section.querySelectorAll(".card[data-cle]").length : "x"))
      .join("|");
  }

  // ---------- API ----------
  // Une requête au site qui sait attendre : si le site répond 429, tout l'outil (lectures et verrouillages) fait une
  // pause commune, puis la même requête repart. Après REESSAIS_429 refus, la réponse 429 est rendue telle quelle.
  const FREIN = { jusqua: 0 };
  function attente429(res, essai) {
    const brut = res.headers.get("Retry-After");
    let ms = Number(brut) * 1000;                                    // en secondes…
    if (!(ms > 0) && brut) ms = Date.parse(brut) - Date.now();       // … ou une date
    if (!(ms > 0)) ms = ATTENTE_429_MS * 2 ** essai;
    return Math.min(Math.max(ms, 1000) + 250, ATTENTE_429_MAX_MS);
  }
  async function fetchPatient(url, options, quoi) {
    for (let essai = 0; ; essai++) {
      const reste = FREIN.jusqua - Date.now();
      if (reste > 0) await pause(reste);
      const res = await fetch(url, options);
      if (res.status !== 429 || essai >= REESSAIS_429) return res;
      const ms = attente429(res, essai);
      FREIN.jusqua = Math.max(FREIN.jusqua, Date.now() + ms);
      journal(`429 (trop de requêtes) sur ${quoi} : pause de ${Math.round(ms / 1000)} s, puis nouvel essai (${essai + 1}/${REESSAIS_429})`);
      if (ETAT.detail && RUN.en) ETAT.detail.textContent = `Le site demande de ralentir : pause de ${Math.round(ms / 1000)} s…`;
    }
  }

  // Les verrouillages passent par ici : un à la fois, DELAI_ENTRE_VERROUILLAGES_MS après la fin du précédent
  // (réussi ou non). Les lectures n'y passent pas.
  const PORTE = { file: Promise.resolve(), finie: 0 };
  function requeteVerrou(url, options) {
    const tour = PORTE.file.then(async () => {
      const attente = PORTE.finie + DELAI_ENTRE_VERROUILLAGES_MS - Date.now();
      if (attente > 0) await pause(attente);
      try {
        return await fetchPatient(url, options, "un verrouillage");
      } finally {
        PORTE.finie = Date.now();
      }
    });
    PORTE.file = tour.catch(() => {});      // une requête ratée ne bloque pas les suivantes
    return tour;
  }

  async function exemplairesDe(cid) {
    const res = await fetchPatient(URL_SITE + "/api/card?cid=" + encodeURIComponent(cid), { credentials: "include" }, "la lecture de " + cid);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const mine = data.mine ?? (data.card && data.card.mine) ?? [];
    return mine.filter(m => Number.isInteger(m.id));
  }

  // Ne touche que l'exemplaire de la même version (normale, chromatique, Halloween)
  const MEME_VERSION = (m, c) => !!m.sh === c.sh && !!m.hw === c.hw;

  // Une copie est verrouillée quand son état vaut "locked" (champ state de /api/card)
  const EST_VERROUILLEE = m => m.state === "locked";

  async function setVerrou(card_id, on) {
    const res = await requeteVerrou(URL_SITE + "/api/card/lock", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id, on }),
    });
    return res.status;
  }

  // (2.14) Plusieurs exemplaires d'un coup, comme le site : POST /api/card/lock/bulk {on, ids:[…]}.
  // Si le site ne connaît pas cette adresse (404, 405), l'outil revient au verrouillage carte par carte pour la session.
  const GROUPE = { possible: true };
  async function setVerrouGroupe(ids, on) {
    const res = await requeteVerrou(URL_SITE + "/api/card/lock/bulk", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on, ids }),
    });
    if (res.status === 404 || res.status === 405) GROUPE.possible = false;
    return res.status;
  }

  // Lit les copies de toutes les cartes d'un lot, par blocs de LECTURES_PAR_BLOC cartes (LECTURES_SIMULTANEES à la
  // fois dans un bloc), avec PAUSE_ENTRE_BLOCS_LECTURE_MS entre deux blocs.
  // Chaque cid n'est lu qu'une fois par lot ; le résultat va dans `copies` : {copies} ou {erreur}.
  async function lireLot(lot, copies, progres) {
    const cids = [...new Set(lot.map(c => c.cid))];
    let lus = 0;
    for (let debut = 0; debut < cids.length && !RUN.stop; debut += LECTURES_PAR_BLOC) {
      if (debut > 0) {
        progres(lus, cids.length, `pause de ${PAUSE_ENTRE_BLOCS_LECTURE_MS / 1000} s avant le bloc suivant`);
        await pause(PAUSE_ENTRE_BLOCS_LECTURE_MS);
        if (RUN.stop) break;
      }
      const bloc = cids.slice(debut, debut + LECTURES_PAR_BLOC);
      let suivant = 0;
      const travailleur = async () => {
        while (suivant < bloc.length && !RUN.stop) {
          const cid = bloc[suivant++];
          try {
            copies.set(cid, { copies: await exemplairesDe(cid) });
          } catch (erreur) {
            copies.set(cid, { erreur });
          }
          lus++;
          progres(lus, cids.length);
        }
      };
      await Promise.all(Array.from({ length: Math.min(LECTURES_SIMULTANEES, bloc.length) }, travailleur));
    }
  }

  // ---------- Journal ----------
  const heure = d => p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds());
  const texteJournal = () => LOG.map(l => `[${heure(l.t)}] ${l.msg}`).join("\n");

  // texte affiché : seulement les dernières lignes, pour ne pas alourdir la page
  function texteAffiche() {
    const debut = Math.max(0, LOG.length - LIGNES_AFFICHEES_MAX);
    const entete = debut ? `… ${nombre(debut)} ligne(s) plus anciennes, présentes dans l'export .txt\n` : "";
    return entete + LOG.slice(debut).map(l => `[${heure(l.t)}] ${l.msg}`).join("\n") + "\n";
  }

  // ne garde à l'écran que les derniers nœuds de texte d'une zone
  function limiterAffichage(zone) {
    while (zone.childNodes.length > LIGNES_AFFICHEES_MAX) zone.removeChild(zone.firstChild);
  }

  function journal(msg) {
    const ligne = { t: new Date(), msg };
    LOG.push(ligne);
    if (LOG.length > LIGNES_GARDEES_MAX) LOG.splice(0, LOG.length - LIGNES_GARDEES_MAX);
    const texte = `[${heure(ligne.t)}] ${msg}\n`;
    if (ETAT.journal) {
      ETAT.journal.append(document.createTextNode(texte));   // ajout sans réécrire tout le texte
      limiterAffichage(ETAT.journal);
      ETAT.journal.scrollTop = ETAT.journal.scrollHeight;
    }
    if (JRN.vue && !JRN.vue.hidden) {
      JRN.corps.append(document.createTextNode(texte));
      limiterAffichage(JRN.corps);
      JRN.corps.scrollTop = JRN.corps.scrollHeight;
    }
    majCompteJournal();
  }

  function majCompteJournal() {
    if (JRN.compte) JRN.compte.textContent = pluriel(LOG.length, "ligne");
  }

  function construireJournal() {
    if (JRN.vue) return;
    JRN.compte = h("small", { class: "wpx-jr-compte" });
    JRN.corps = h("div", { class: "wpx-jr-corps", "aria-live": "polite" });
    JRN.vue = h("aside", { id: "wpx-vr-journal-panel", role: "dialog", "aria-label": "Journal du verrouillage", hidden: true },
      h("header", { class: "wpx-jr-tete" },
        h("b", null, "Journal du verrouillage"),
        JRN.compte,
        h("button", { type: "button", class: "wpx-btn", title: "Télécharger le journal en fichier .txt", onclick: exporterJournal }, "Exporter .txt"),
        h("button", { type: "button", class: "wpx-btn", title: "Copier le journal dans le presse-papiers", onclick: copierJournal }, "Copier"),
        h("button", { type: "button", class: "wpx-btn", title: "Effacer le journal", onclick: viderJournal }, "Vider"),
        h("button", { type: "button", class: "wpx-btn", title: "Effacer le journal et le cache de l'outil pour alléger la page", onclick: viderMemoire }, "Vider la mémoire"),
        h("button", { type: "button", class: "wpx-btn", title: "Fermer le journal", "aria-label": "Fermer le journal", onclick: fermerJournal }, "✕")),
      JRN.corps);
    document.body.append(JRN.vue);
  }

  function remplirJournal() {
    JRN.corps.textContent = LOG.length ? texteAffiche() : "Le journal est vide.";
    JRN.corps.scrollTop = JRN.corps.scrollHeight;
    majCompteJournal();
  }

  function ouvrirJournal() {
    construireJournal();
    remplirJournal();
    JRN.vue.hidden = false;
    majBoutonsJournal();
  }

  function fermerJournal() {
    if (JRN.vue) JRN.vue.hidden = true;
    majBoutonsJournal();
  }

  function basculerJournal() {
    if (JRN.vue && !JRN.vue.hidden) fermerJournal();
    else ouvrirJournal();
  }

  function majBoutonsJournal() {
    const ouvert = !!JRN.vue && !JRN.vue.hidden;
    $$(".wpx-vr-jbtn").forEach(b => b.setAttribute("aria-pressed", String(ouvert)));
  }

  function exporterJournal() {
    if (!LOG.length) return toast("Le journal est vide.");
    const d = new Date();
    const entete = `Journal Wiki-Pick : verrouillage\nExporté le ${d.toLocaleString("fr-FR")}\n${"-".repeat(50)}\n`;
    const blob = new Blob([entete + texteJournal() + "\n"], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const nom = `wikipick_journal_${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.txt`;
    const lien = h("a", { href: url, download: nom });
    lien.style.display = "none";
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function copierJournal() {
    if (!LOG.length) return toast("Le journal est vide.");
    try {
      await navigator.clipboard.writeText(texteJournal());
      toast("Journal copié dans le presse-papiers.");
    } catch (e) {
      toast("Copie impossible : utilise « Exporter .txt ».");
    }
  }

  function viderJournal() {
    if (RUN.en) return toast("Attends la fin du traitement pour vider le journal.");
    LOG.length = 0;
    if (ETAT.journal) ETAT.journal.textContent = "";
    if (JRN.vue) remplirJournal();
  }

  // Caches de l'outil Album+cleaner présents dans ce navigateur
  function cachesOutil() {
    const cles = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (PREFIXES_CACHE_OUTIL.some(p => k.startsWith(p))) cles.push(k);
      }
    } catch (e) { /* stockage indisponible */ }
    return cles;
  }

  // Efface le journal (affiché et gardé en mémoire) et les caches de l'outil Album+cleaner.
  // Rien d'autre : réglages, derniers paquets, serveurs Discord et file d'envoi sont conservés.
  function viderMemoire() {
    if (RUN.en) return toast("Attends la fin du traitement pour vider la mémoire.");
    const cles = cachesOutil();
    let octets = 0;
    for (const k of cles) {
      try { octets += (localStorage.getItem(k) || "").length; } catch (e) { /* illisible : compté comme rien */ }
    }
    const ko = Math.max(1, Math.round(octets / 1024));
    if (!confirm(
      "Vider la mémoire ?\n\n" +
      `• Journal : ${nombre(LOG.length)} ligne(s) effacée(s). Exporte-le avant si tu veux le garder.\n` +
      `• Cache de l'outil Album+cleaner : ${nombre(cles.length)} entrée(s), environ ${nombre(ko)} Ko\n` +
      "  (collections des partenaires d'échange déjà lues, comptes des chances, achats Discord déjà lus).\n\n" +
      "Ne sont pas touchés : tes réglages, tes derniers paquets, tes serveurs Discord, la file d'envoi.")) return;
    LOG.length = 0;
    if (ETAT.journal) ETAT.journal.textContent = "";
    if (JRN.vue) remplirJournal();
    let retirees = 0;
    for (const k of cles) {
      try { localStorage.removeItem(k); retirees++; } catch (e) { /* on passe à la suivante */ }
    }
    majCompteJournal();
    toast(`Mémoire vidée : journal effacé, ${nombre(retirees)} entrée(s) de cache retirée(s).`);
  }

  // En quittant le panneau : tout est vidé, sans confirmation (exporte le journal avant de sortir si tu veux le garder).
  // Un traitement en cours continue : le vidage se fait à sa fin, si tu n'es pas revenu dans le panneau entre-temps.
  function viderEnQuittant() {
    if (!VIDER_EN_QUITTANT) return;
    if (RUN.en) { ETAT.aVider = true; return; }
    ETAT.aVider = false;
    LOG.length = 0;
    DERNIER.cartes = null;
    DERNIER.on = null;
    ETAT.groupes = [];
    ETAT.signature = "";
    if (ETAT.corps) ETAT.corps.replaceChildren();          // les milliers de lignes de cartes quittent la page
    if (ETAT.journal) ETAT.journal.textContent = "";
    if (ETAT.resume) ETAT.resume.textContent = "";
    rafraichirApres();
    setProgres({});
    if (JRN.vue) {
      JRN.vue.hidden = true;
      JRN.corps.textContent = "";
    }
    majBoutonsJournal();
    majCompteJournal();
    try {
      const cles = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (CACHES_VIDES_EN_QUITTANT.some(p => k.startsWith(p))) cles.push(k);
      }
      cles.forEach(k => localStorage.removeItem(k));
    } catch (e) { /* stockage indisponible : rien à retirer */ }
  }

  // ---------- Progression ----------
  // etat : "" (neutre), "en" (en cours), "ok" (fini), "stop" (arrêté), "err" (fini avec erreurs)
  function setProgres({ fait = 0, total = 0, statut = "Prêt", etat = "", detail = "" }) {
    if (!ETAT.fill) return;
    const pct = total ? Math.round((fait / total) * 100) : 0;
    ETAT.fill.style.width = pct + "%";
    ETAT.fill.className = "wpx-vr-fill" + (etat ? " wpx-vr-s-" + etat : "");
    ETAT.statut.textContent = statut;
    ETAT.statut.className = "wpx-vr-statut" + (etat ? " wpx-vr-s-" + etat : "");
    ETAT.compte.textContent = total ? `${nombre(fait)} / ${nombre(total)} carte(s) · ${pct} %` : "";
    ETAT.detail.textContent = detail;
  }

  // Active ou désactive les boutons selon qu'un traitement tourne, sans reconstruire la liste
  function majEtatTraitement() {
    const p = ETAT.panneau;
    if (!p) return;
    p.classList.toggle("wpx-vr-en", RUN.en);
    $$(".wpx-vr-act", p).forEach(b => { b.disabled = RUN.en; });
    rafraichirApres();
  }

  async function traiter(cartes, on) {
    if (RUN.en) return journal("Une opération est déjà en cours.");
    RUN.en = true;
    RUN.stop = false;
    const total = cartes.length;
    const fait_mot = on ? "verrouillée(s)" : "déverrouillée(s)";
    const deja_mot = on ? "déjà verrouillée(s)" : "déjà déverrouillée(s)";
    let fait = 0;              // cartes traitées (pour la barre)
    let cartesModifiees = 0;   // cartes dont au moins un exemplaire a changé d'état
    let cartesDeja = 0;        // cartes déjà dans l'état demandé
    let cartesAbsentes = 0;    // cartes qui ne sont pas dans ta collection
    let exemplaires = 0;       // exemplaires modifiés
    let erreurs = 0;

    // découpage en lots de TAILLE_LOT cartes
    const lots = [];
    for (let i = 0; i < cartes.length; i += TAILLE_LOT) lots.push(cartes.slice(i, i + TAILLE_LOT));

    setProgres({ fait: 0, total, statut: "En cours", etat: "en", detail: "Démarrage…" });
    majEtatTraitement();
    journal(`--- ${on ? "Verrouillage" : "Déverrouillage"} de ${pluriel(total, "carte")} en ${pluriel(lots.length, "lot")} (${TAILLE_LOT} cartes max par lot) ---`);
    try {
      for (let li = 0; li < lots.length; li++) {
        if (RUN.stop) break;
        const lot = lots[li];
        const libelleLot = `Lot ${li + 1}/${lots.length}`;
        journal(`--- ${libelleLot} : ${pluriel(lot.length, "carte")} ---`);

        // 1) lecture des copies du lot, en parallèle
        const copies = new Map();
        await lireLot(lot, copies, (lus, nb, note) => {
          setProgres({ fait, total, statut: "En cours", etat: "en", detail: `${libelleLot} · lecture des copies ${lus} / ${nb}` + (note ? ` · ${note}` : "") });
        });

        // 2) tri : ce qui est absent ou déjà dans l'état demandé ne part pas au site
        const aEnvoyer = [];            // {c, etiquette, ids} : les exemplaires à changer, carte par carte
        for (const c of lot) {
          if (RUN.stop) break;
          const etiquette = c.sh ? " (chromatique)" : c.hw ? " (Halloween)" : "";
          try {
            const lecture = copies.get(c.cid);
            if (!lecture || lecture.erreur) throw (lecture && lecture.erreur) || new Error("lecture impossible");
            const liste = lecture.copies.filter(m => MEME_VERSION(m, c));
            if (!liste.length) {
              cartesAbsentes++;
              journal("Pas dans ta collection : " + c.nom + etiquette);
              fait++;
              continue;
            }
            const cibles = liste.filter(m => m.state === undefined || (on ? !EST_VERROUILLEE(m) : EST_VERROUILLEE(m)));
            if (!cibles.length) {
              cartesDeja++;
              journal(`Déjà ${on ? "verrouillée" : "déverrouillée"} : ${c.nom}${etiquette}`);
              fait++;
              continue;
            }
            aEnvoyer.push({ c, etiquette, ids: cibles.map(m => m.id) });
          } catch (e) {
            erreurs++;
            journal("Erreur  " + c.nom + " : " + e.message);
            fait++;
          }
        }
        setProgres({ fait, total, statut: "En cours", etat: "en", detail: `${libelleLot} · ${pluriel(aEnvoyer.length, "carte")} à ${on ? "verrouiller" : "déverrouiller"}` });

        // 3) envoi par groupes de EXEMPLAIRES_PAR_ENVOI exemplaires (une carte n'est jamais coupée en deux, sauf si elle
        //    a à elle seule plus d'exemplaires que la taille d'un groupe), DELAI_ENTRE_VERROUILLAGES_MS entre deux envois
        const groupes = [];
        let courant = [];
        let taille = 0;
        for (const x of aEnvoyer) {
          if (courant.length && taille + x.ids.length > EXEMPLAIRES_PAR_ENVOI) {
            groupes.push(courant);
            courant = [];
            taille = 0;
          }
          courant.push(x);
          taille += x.ids.length;
        }
        if (courant.length) groupes.push(courant);

        for (let gi = 0; gi < groupes.length && !RUN.stop; gi++) {
          const groupe = groupes[gi];
          const ids = groupe.flatMap(x => x.ids);
          setProgres({ fait, total, statut: "En cours", etat: "en",
            detail: `${libelleLot} · envoi ${gi + 1}/${groupes.length} : ${pluriel(groupe.length, "carte")}, ${pluriel(ids.length, "exemplaire")}` });
          let reussi = false;
          if (GROUPE.possible && ids.length > 1) {
            try {
              const statut = await setVerrouGroupe(ids, on);
              reussi = statut >= 200 && statut < 300;
              journal(`${statut}  envoi groupé de ${pluriel(ids.length, "exemplaire")} (${pluriel(groupe.length, "carte")})`);
              if (reussi) {
                for (const x of groupe) journal(`   ${on ? "verrouillée" : "déverrouillée"} : ${x.c.nom}${x.etiquette}  (id ${x.ids.join(", ")})`);
                cartesModifiees += groupe.length;
                exemplaires += ids.length;
              } else if (!GROUPE.possible) {
                journal("Le site ne connaît pas l'envoi groupé : retour au verrouillage carte par carte.");
              } else {
                erreurs++;
              }
            } catch (e) {
              erreurs++;
              journal("Erreur sur l'envoi groupé : " + e.message);
            }
            if (reussi || GROUPE.possible) {
              fait += groupe.length;
              continue;
            }
          }
          // carte par carte : un seul exemplaire à changer, ou le site refuse l'envoi groupé
          for (const x of groupe) {
            if (RUN.stop) break;
            let modifiees = 0;
            for (const id of x.ids) {
              if (RUN.stop) break;
              try {
                const statut = await setVerrou(id, on);
                if (statut >= 200 && statut < 300) { modifiees++; exemplaires++; }
                else erreurs++;
                journal(`${statut}  ${x.c.nom}${x.etiquette}  (id ${id})`);
              } catch (e) {
                erreurs++;
                journal("Erreur  " + x.c.nom + " : " + e.message);
              }
            }
            if (modifiees) cartesModifiees++;
            fait++;
            setProgres({ fait, total, statut: "En cours", etat: "en", detail: `${libelleLot} · dernière carte traitée : ${x.c.nom}` });
          }
        }

        if (!RUN.stop && li < lots.length - 1) {
          setProgres({ fait, total, statut: "En cours", etat: "en", detail: `Pause de ${PAUSE_ENTRE_LOTS_MS / 1000} s avant le lot suivant` });
          await pause(PAUSE_ENTRE_LOTS_MS);
        }
      }
    } finally {
      RUN.en = false;
      const morceaux = [
        `${nombre(cartesModifiees)} carte(s) réellement ${fait_mot}`,
        `${nombre(cartesDeja)} carte(s) ${deja_mot}`
      ];
      if (cartesAbsentes) morceaux.push(`${nombre(cartesAbsentes)} hors de ta collection`);
      if (erreurs) morceaux.push(`${nombre(erreurs)} erreur(s)`);
      const bilan = morceaux.join(" · ") + ` (${nombre(exemplaires)} exemplaire(s) modifié(s))`;

      let statut, etat, detail;
      if (RUN.stop) {
        statut = "Arrêté"; etat = "stop";
        detail = `Arrêté après ${nombre(fait)} carte(s) sur ${nombre(total)} · ${bilan}`;
      } else if (erreurs) {
        statut = "Terminé avec erreurs"; etat = "err";
        detail = bilan;
      } else {
        statut = "Terminé"; etat = "ok";
        detail = bilan;
      }
      setProgres({ fait, total, statut, etat, detail });
      journal("Bilan : " + bilan);
      journal("Terminé : " + statut.toLowerCase() + ".");
      DERNIER.cartes = cartes;
      DERNIER.on = on;
      majEtatTraitement();
      if (ETAT.aVider && !ETAT.dedans) viderEnQuittant();   // on avait quitté le panneau pendant le traitement
    }
  }

  // Lance un traitement, après confirmation au-delà du seuil
  function lancer(cartes, on) {
    if (!cartes.length) return journal("Aucune carte : coche une étiquette chargée sur la page.");
    if (cartes.length > CONFIRMATION_A_PARTIR_DE && !confirm(
      `${on ? "Verrouiller" : "Déverrouiller"} ${pluriel(cartes.length, "carte")} ?\n` +
      `Les exemplaires partent par ${EXEMPLAIRES_PAR_ENVOI} en un seul envoi, ${DELAI_ENTRE_VERROUILLAGES_MS / 1000} s entre deux envois ; ` +
      `les cartes déjà dans l'état demandé sont ignorées.`)) return;
    traiter(cartes, on);
  }

  function lancerSelection(on) {
    lancer(cartesChoisies(), on);
  }

  // ---------- Panneau dans le tiroir ----------
  function rafraichirPanneau() {
    const p = ETAT.panneau;
    if (!p) return;
    p.classList.toggle("wpx-vr-en", RUN.en);
    const groupes = groupesChoisis();
    const tous = fusionner(groupes);
    ETAT.groupes = groupes;
    ETAT.signature = signatureSelection();
    ETAT.resume.textContent = pluriel(groupes.length, "étiquette") + " · " + pluriel(tous.length, "carte") + " à traiter";

    const corps = ETAT.corps;
    const frag = document.createDocumentFragment();
    if (!groupes.length) frag.append(h("p", { class: "wpx-vr-vide" }, "Coche des étiquettes dans la liste ci-dessus : leurs cartes apparaissent ici."));
    groupes.forEach((g, gi) => {
      const bloc = h("div", { class: "wpx-vr-cat" });
      const tete = h("div", { class: "wpx-vr-cat-tete" }, h("span", { class: "wpx-vr-nom", title: g.nom }, g.nom),
        h("small", null, g.cartes ? pluriel(g.cartes.length, "carte") : "cartes non chargées"));
      if (g.cartes && g.cartes.length) {
        tete.append(
          h("button", { type: "button", class: "wpx-btn wpx-vr-act", title: "Verrouiller toutes les cartes de cette étiquette",
            "data-act": "on", "data-g": gi }, SVG_FERME, "Tout verrouiller"),
          h("button", { type: "button", class: "wpx-btn wpx-vr-act", title: "Déverrouiller toutes les cartes de cette étiquette",
            "data-act": "off", "data-g": gi }, SVG_OUVERT, "Tout déverrouiller"));
      }
      bloc.append(tete);
      (g.cartes || []).forEach((c, ci) => {
        const suffixe = c.sh ? "chromatique" : c.hw ? "Halloween" : "";
        bloc.append(h("div", { class: "wpx-vr-ligne" },
          h("span", { title: c.nom }, c.nom),
          suffixe ? h("small", null, suffixe) : null,
          h("button", { type: "button", class: "wpx-vr-ico wpx-vr-act", title: "Verrouiller cette carte", "aria-label": "Verrouiller " + c.nom,
            "data-act": "on", "data-g": gi, "data-i": ci }, SVG_FERME),
          h("button", { type: "button", class: "wpx-vr-ico wpx-vr-act", title: "Déverrouiller cette carte", "aria-label": "Déverrouiller " + c.nom,
            "data-act": "off", "data-g": gi, "data-i": ci }, SVG_OUVERT)));
      });
      frag.append(bloc);
    });
    corps.replaceChildren(frag);
    $$(".wpx-vr-act", p).forEach(b => { b.disabled = RUN.en; });
    rafraichirApres();
  }

  // Un seul écouteur pour tous les boutons des étiquettes et des cartes
  function clicListe(e) {
    const b = e.target.closest("button[data-act]");
    if (!b || b.disabled || !ETAT.corps.contains(b)) return;
    const g = ETAT.groupes[Number(b.dataset.g)];
    if (!g || !g.cartes) return;
    const on = b.dataset.act === "on";
    if ("i" in b.dataset) {
      const c = g.cartes[Number(b.dataset.i)];
      if (c) traiter([c], on);
    } else {
      traiter(g.cartes, on);
    }
  }

  // Bandeau de fin de traitement : propose l'action inverse sur les mêmes cartes
  function rafraichirApres() {
    const a = ETAT.apres;
    if (!a) return;
    if (RUN.en || !DERNIER.cartes || !DERNIER.cartes.length) {
      a.hidden = true;
      a.replaceChildren();
      return;
    }
    const inverse = !DERNIER.on;
    const nombreCartes = pluriel(DERNIER.cartes.length, "carte");
    a.hidden = false;
    a.replaceChildren(
      h("span", null, `Traitement terminé. Tu veux ${inverse ? "verrouiller" : "déverrouiller"} ces ${nombreCartes} maintenant ?`),
      h("button", { type: "button", class: "wpx-btn wpx-vr-act", onclick: () => lancer(DERNIER.cartes, inverse) },
        inverse ? SVG_FERME : SVG_OUVERT, inverse ? "Verrouiller ces cartes" : "Déverrouiller ces cartes"),
      h("button", { type: "button", class: "wpx-lien", onclick: () => { DERNIER.cartes = null; rafraichirApres(); } }, "Non, merci"));
  }

  function installerDansTiroir(t) {
    if (ETAT.panneau && t.contains(ETAT.panneau)) return;
    if (t.querySelector(".wpx-vr-panel")) return;
    const seg = $(".wpx-seg", t);
    const res = $(".wpx-t-res", t);
    if (!seg || !res) return;

    // (2.12) pas de bouton « Verrouiller » dans le tiroir : on y entre par le cadenas du haut du site. Un clic sur
    // « Exporter les étiquettes » ou « Extraire les cartes » ramène le tiroir à l'export.
    seg.addEventListener("click", e => {
      if (e.target.closest("[data-mode]")) basculerMode(false);
    });

    ETAT.journal = h("div", { class: "wpx-vr-journal", "aria-live": "polite" });
    ETAT.resume = h("span", { class: "wpx-vr-resume" });
    ETAT.corps = h("div", { onclick: clicListe });
    ETAT.statut = h("b", { class: "wpx-vr-statut" }, "Prêt");
    ETAT.compte = h("small", { class: "wpx-vr-compte" });
    ETAT.fill = h("div", { class: "wpx-vr-fill" });
    ETAT.detail = h("small", { class: "wpx-vr-detail" });
    ETAT.apres = h("div", { class: "wpx-vr-apres", hidden: true });
    const stop = h("button", { type: "button", class: "wpx-btn wpx-vr-stop", onclick: () => { RUN.stop = true; journal("Arrêt demandé après la carte en cours…"); ETAT.detail.textContent = "Arrêt demandé, après la carte en cours…"; } }, "Arrêter");
    const bJournal = h("button", { type: "button", class: "wpx-btn wpx-vr-jbtn", "aria-pressed": "false", title: "Afficher ou masquer le journal dans une fenêtre à part", onclick: basculerJournal }, "Journal");
    const bMemoire = h("button", { type: "button", class: "wpx-btn", title: "Effacer le journal et le cache de l'outil pour alléger la page", onclick: viderMemoire }, "Vider la mémoire");

    ETAT.panneau = h("section", { class: "wpx-vr-panel" },
      h("div", { class: "wpx-vr-tete" }, ETAT.resume,
        h("button", { type: "button", class: "wpx-btn wpx-vr-act", onclick: () => lancerSelection(true) }, SVG_FERME, "Verrouiller la sélection"),
        h("button", { type: "button", class: "wpx-btn wpx-vr-act", onclick: () => lancerSelection(false) }, SVG_OUVERT, "Déverrouiller la sélection"),
        stop, bJournal, bMemoire),
      h("div", { class: "wpx-vr-progres" },
        h("div", { class: "wpx-vr-progres-tete" }, ETAT.statut, ETAT.compte),
        h("div", { class: "wpx-vr-barre" }, ETAT.fill),
        ETAT.detail),
      ETAT.apres,
      ETAT.corps,
      ETAT.journal);
    res.before(ETAT.panneau);
    // le journal déjà écrit pendant la session reste visible
    ETAT.journal.textContent = LOG.length ? texteAffiche() : "";
    setProgres({});
    rafraichirPanneau();
    majBoutonsJournal();
  }

  // le mode d'export qu'Album avait (« liste » ou « cartes »), pour rallumer son bouton en sortant du verrouillage
  function modeAlbum() {
    try { return JSON.parse(localStorage.getItem("wpx.export.mode")) === "cartes" ? "cartes" : "liste"; }
    catch (e) { return "liste"; }
  }

  function basculerMode(on) {
    const t = $("#wpx-tiroir");
    if (!t) return;
    if (on && !t.querySelector(".wpx-vr-panel")) installerDansTiroir(t);
    t.classList.toggle("wpx-vr-on", on);
    if (ETAT.bouton) ETAT.bouton.setAttribute("aria-pressed", String(on));
    const seg = $(".wpx-seg", t);
    if (seg) {
      const garder = on ? null : modeAlbum();
      $$("[data-mode]", seg).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === garder)));
    }
    if (on) rafraichirPanneau();
  }

  // ---------- Le cadenas, en haut du site (à côté de Clean et Largeur) : seul accès au verrouillage ----------
  // Un clic ouvre le tiroir directement en mode verrouillage ; un second clic le referme.
  function ouvrirVerrou() {
    let t = $("#wpx-tiroir");
    if (t && t.classList.contains("wpx-ouvert")) {
      if (t.classList.contains("wpx-vr-on")) {
        const fermer = $(".wpx-t-tete .wpx-x", t);
        if (fermer) fermer.click();
        else basculerMode(false);
      } else {
        basculerMode(true);
      }
      return;
    }
    const exp = $$(".wpx-exports button").find(b => b.getClientRects().length);
    if (!exp) return toast("Va sur une page d'étiquettes (un profil, ou Ma collection > Étiquettes) : le verrouillage part des étiquettes affichées.");
    exp.click();
    t = $("#wpx-tiroir");
    if (t) basculerMode(true);
  }

  function installerBouton() {
    if (ETAT.bouton && ETAT.bouton.isConnected) return;   // déjà en place : rien à chercher
    const rangee = $("body > header.top .row1");
    if (!rangee) return;
    const existant = rangee.querySelector(".wpx-vr-crane");
    if (existant) { ETAT.bouton = existant; return; }
    const repere = rangee.querySelector(":scope > [data-wpx-reglages]") || rangee.querySelector(":scope > [data-wpx-bascule]");
    const bouton = h("button", { type: "button", class: "wpx-crane wpx-vr-crane", "aria-pressed": "false",
      title: "Verrouiller ou déverrouiller les cartes des étiquettes affichées", "aria-label": "Verrouiller les cartes", onclick: ouvrirVerrou }, SVG_FERME);
    if (repere) repere.after(bouton);
    else rangee.append(bouton);
    ETAT.bouton = bouton;
  }

  function toast(texte) {
    const d = h("div", { class: "wpx-vr-toast", style: "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483646;max-width:min(92vw,560px);" +
      "padding:12px 16px;border-radius:10px;background:#1e1f22;color:#f2f3f5;border:1px solid #8b5cf6;" +
      "font:600 13.5px/1.45 system-ui,sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.45)" }, texte);
    document.body.append(d);
    setTimeout(() => d.remove(), 5000);
  }

  // ---------- Styles ----------
  function installerStyles() {
    if (document.getElementById("wpx-vr-styles")) return;
    const s = h("style", { id: "wpx-vr-styles" }, `
#wpx-tiroir.wpx-vr-on .wpx-t-res,#wpx-tiroir.wpx-vr-on .wpx-t-options{display:none!important}
#wpx-tiroir:not(.wpx-vr-on) .wpx-vr-panel{display:none!important}
.wpx-vr-mode{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 12px;border:1px solid var(--wpx-bord,rgba(167,139,250,.16));border-radius:9px;background:none;color:inherit;font:600 12.5px Inter,system-ui,sans-serif;cursor:pointer}
.wpx-vr-mode svg{width:14px;height:14px}
.wpx-vr-mode[aria-pressed="true"],.wpx-vr-jbtn[aria-pressed="true"]{background:var(--wpx-degrade,#7c3aed);border-color:transparent;color:#fff}
.wpx-vr-panel{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:10px 14px 14px;font:500 13px/1.4 Inter,system-ui,sans-serif;color:var(--wpx-encre,#ece9f6)}
.wpx-vr-tete{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.wpx-vr-tete .wpx-vr-resume{margin-right:auto;color:var(--wpx-doux,#9a93b3);font-size:12.5px}
.wpx-vr-tete .wpx-btn,.wpx-vr-cat-tete .wpx-btn{height:28px;padding:0 10px;font-size:12px}
.wpx-vr-tete .wpx-btn svg,.wpx-vr-cat-tete .wpx-btn svg{width:13px;height:13px}
.wpx-vr-stop{display:none!important}
.wpx-vr-en .wpx-vr-stop{display:inline-flex!important}
.wpx-vr-progres{margin:4px 0 10px;padding:9px 10px;border:1px solid var(--wpx-bord,rgba(167,139,250,.16));border-radius:10px;background:rgba(255,255,255,.03)}
.wpx-vr-progres-tete{display:flex;align-items:center;gap:8px;margin-bottom:7px}
.wpx-vr-statut{font:800 13px Sora,Inter,sans-serif}
.wpx-vr-compte{margin-left:auto;color:var(--wpx-doux,#9a93b3);font-size:11.5px;font-variant-numeric:tabular-nums}
.wpx-vr-barre{height:8px;border-radius:99px;background:rgba(255,255,255,.08);overflow:hidden}
.wpx-vr-fill{height:100%;width:0;border-radius:99px;background:var(--wpx-degrade,#7c3aed);transition:width .3s ease}
.wpx-vr-detail{display:block;margin-top:6px;color:var(--wpx-doux,#9a93b3);font-size:11.5px;line-height:1.4;white-space:normal}
.wpx-vr-s-en{color:#c4b5fd}
.wpx-vr-s-ok{color:#86efac}
.wpx-vr-s-stop{color:#fde68a}
.wpx-vr-s-err{color:#fca5a5}
.wpx-vr-fill.wpx-vr-s-en{background:linear-gradient(90deg,#7c3aed,#c026d3)}
.wpx-vr-fill.wpx-vr-s-ok{background:#22c55e}
.wpx-vr-fill.wpx-vr-s-stop{background:#f59e0b}
.wpx-vr-fill.wpx-vr-s-err{background:#ef4444}
.wpx-vr-apres{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px;padding:9px 10px;border:1px solid rgba(139,92,246,.45);border-radius:10px;background:rgba(139,92,246,.08)}
.wpx-vr-apres[hidden]{display:none}
.wpx-vr-apres>span{margin-right:auto}
.wpx-vr-apres .wpx-btn{height:28px;padding:0 10px;font-size:12px}
.wpx-vr-apres .wpx-btn svg{width:13px;height:13px}
.wpx-vr-cat{margin:12px 0 6px;padding-top:8px;border-top:1px solid var(--wpx-bord,rgba(167,139,250,.16))}
.wpx-vr-cat-tete{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px;font:700 13px Sora,Inter,sans-serif}
.wpx-vr-cat-tete small{font:500 11.5px Inter,sans-serif;color:var(--wpx-pale,#6b6485)}
.wpx-vr-cat-tete .wpx-vr-nom{margin-right:auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wpx-vr-ligne{display:flex;align-items:center;gap:8px;padding:4px 6px;border-radius:8px}
.wpx-vr-ligne:hover{background:rgba(255,255,255,.05)}
.wpx-vr-ligne>span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wpx-vr-ligne>small{flex:0 0 auto;color:var(--wpx-pale,#6b6485);font-size:11px}
.wpx-vr-ico{display:grid;place-items:center;width:30px;height:26px;padding:0;border:1px solid var(--wpx-bord,rgba(167,139,250,.16));border-radius:8px;background:rgba(255,255,255,.03);color:inherit;cursor:pointer}
.wpx-vr-ico:hover{background:rgba(255,255,255,.09)}
.wpx-vr-ico svg{width:14px;height:14px}
.wpx-vr-act:disabled,.wpx-vr-ico:disabled{opacity:.45;cursor:default}
.wpx-vr-journal{max-height:150px;overflow:auto;margin-top:10px;padding:8px;border-radius:8px;background:rgba(0,0,0,.28);font:11px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap}
.wpx-vr-journal:empty{display:none}
.wpx-vr-vide{color:var(--wpx-pale,#6b6485);padding:12px 4px;margin:0}
#wpx-vr-journal-panel{position:fixed;left:12px;bottom:12px;z-index:2147483000;width:min(460px,calc(100vw - 24px));max-height:min(60vh,520px);display:flex;flex-direction:column;
  background:var(--wpx-plein,#110b1e);color:var(--wpx-encre,#ece9f6);border:1px solid var(--wpx-bord2,rgba(167,139,250,.32));border-radius:14px;
  box-shadow:0 22px 50px -18px #000;font:500 12.5px/1.4 Inter,system-ui,sans-serif}
#wpx-vr-journal-panel[hidden]{display:none}
.wpx-jr-tete{display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 12px;border-bottom:1px solid var(--wpx-bord,rgba(167,139,250,.16))}
.wpx-jr-tete>b{font:800 14px Sora,Inter,sans-serif;margin-right:auto}
.wpx-jr-compte{color:var(--wpx-doux,#9a93b3);font-size:11.5px}
.wpx-jr-tete .wpx-btn{height:28px;padding:0 10px;font-size:12px}
.wpx-jr-corps{flex:1;min-height:0;overflow:auto;padding:10px 12px;font:11px/1.5 ui-monospace,Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere;background:rgba(0,0,0,.2);border-radius:0 0 14px 14px}
`);
    document.head.append(s);
  }

  // ---------- Suivi de la page ----------
  function verifier() {
    ETAT.planifie = 0;
    installerBouton();
    const t = $("#wpx-tiroir");
    if (!t) return;
    installerDansTiroir(t);
    // (2.6) sortie du panneau : autre mode du tiroir, tiroir fermé (bouton ✕, Échap, autre page) → mode coupé et mémoire vidée
    const dedans = t.classList.contains("wpx-ouvert") && t.classList.contains("wpx-vr-on");
    if (ETAT.dedans && !dedans) {
      if (t.classList.contains("wpx-vr-on")) {               // tiroir fermé en mode verrouillage : il rouvrira sur l'export
        t.classList.remove("wpx-vr-on");
        if (ETAT.bouton) ETAT.bouton.setAttribute("aria-pressed", "false");
      }
      ETAT.dedans = false;
      viderEnQuittant();
      return;
    }
    if (dedans && !ETAT.dedans) ETAT.aVider = false;         // revenu avant la fin du traitement : on garde tout
    ETAT.dedans = dedans;
    // la liste n'est recalculée que si le mode verrouillage est affiché et que la sélection a changé
    if (t.classList.contains("wpx-vr-on") && ETAT.panneau) {
      const signature = signatureSelection();
      if (signature !== ETAT.signature) rafraichirPanneau();
    }
  }

  function planifier() {
    if (!ETAT.planifie) ETAT.planifie = requestAnimationFrame(verifier);
  }

  // Une mutation est utile si elle ne vient pas du script lui-même.
  // Les changements d'attributs ne comptent que dans le tiroir (cases cochées, ouverture, mode).
  function mutationUtile(m) {
    const cible = m.target;
    if (cible.nodeType !== 1) return true;
    if (cible.closest(".wpx-vr-panel, #wpx-vr-journal-panel")) return false;
    if (m.type === "attributes") return !!cible.closest("#wpx-tiroir");
    if (cible === document.body) {
      // ajout ou retrait d'une notification du script seulement : rien à revérifier
      const noeuds = [...m.addedNodes, ...m.removedNodes];
      if (noeuds.length && noeuds.every(n => n.nodeType === 1 && n.classList.contains("wpx-vr-toast"))) return false;
    }
    return true;
  }

  installerStyles();
  new MutationObserver(mutations => {
    if (ETAT.planifie) return;   // une vérification est déjà prévue pour la prochaine image
    for (const m of mutations) {
      if (mutationUtile(m)) { planifier(); return; }
    }
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-selected"] });
  setTimeout(planifier, 1500);
})();