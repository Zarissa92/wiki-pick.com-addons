// ==UserScript==
// @name         [test]Wiki-Pick verrouillage (tiroir d'export)
// @namespace    local.wikipick.lock
// @version      3.6
// @description  Verrouille ou déverrouille les cartes d'étiquettes depuis le tiroir d'export d'Album+cleaner (bouton Verrouiller à côté d'Exporter) : dans ta collection, exactement les exemplaires qui portent l'étiquette, lus dans la base de la collection de l'addon de tri quand elle existe
// @match        https://wiki-pick.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  // ===== PARAMÈTRES =====
  const DELAI_ENTRE_VERROUILLAGES_MS = 900;
  const CONFIRMATION_A_PARTIR_DE = 10;
  const TAILLE_LOT = 50;
  const LECTURES_SIMULTANEES = 4;          // (3.0) 4 fiches à la fois, comme les autres outils (25 avant)
  const PAUSE_ENTRE_PAGES_MS = 400;        // (3.0) entre deux pages de la collection lues pour une étiquette
  const PAUSE_ENTRE_LOTS_MS = 2000;
  const REESSAIS_429 = 5;
  const ATTENTE_429_MS = 5000;
  const ATTENTE_429_MAX_MS = 120000;
  const URL_SITE = "https://wiki-pick.com";
  const LIGNES_AFFICHEES_MAX = 300;
  const LIGNES_GARDEES_MAX = 20000;
  // (3.0) plus aucune clé du script principal n'est effacée ici : ses caches (aDeja, chances, achats Discord) sont à lui
  // ===== FIN DES PARAMÈTRES =====

  if (window.__wpxVerrouActif) return;
  window.__wpxVerrouActif = true;

  const RUN = { en: false, stop: false };
  const DERNIER = { cartes: null, on: null };
  const LOG = [];
  const JRN = { vue: null, corps: null, compte: null };
  const ETAT = { panneau: null, journal: null, resume: null, corps: null, signature: "", planifie: 0,
                 statut: null, compte: null, fill: null, detail: null, apres: null, groupes: [],
                 dedans: false };

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

  function h(tag, attrs, ...enfants) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : String(v));
    }
    for (const c of enfants.flat(Infinity)) {
      if (c == null || c === false) continue;
      if (typeof c === "string" && c.trim().startsWith("<svg")) {
        const t = document.createElement("template");
        t.innerHTML = c.trim();
        e.append(t.content.cloneNode(true));
        continue;
      }
      e.append(typeof c === "object" ? c : String(c));
    }
    return e;
  }

  // le pseudo du joueur connecté, comme le script principal
  const pseudoJoueur = () => ["#meBtn > span:not(.av):last-of-type", "#menuName", "#tiroirNom"]
    .map(choix => propre(($(choix) || {}).textContent)).find(nom => nom && nom !== "—" && nom !== "Wiki-Pick") || "";

  // (3.0) les étiquettes affichées sont-elles les tiennes ? (Ma collection, ou ton propre profil)
  function contextePropre() {
    const vue = $("main section.view.on");
    if (!vue) return false;
    if (vue.id === "v-coll") return true;
    if (vue.id === "v-profile") {
      const av = $("#profile .avwrap .av");
      const nom = propre(av && av.dataset.n);
      const moi = pseudoJoueur();
      return !!nom && !!moi && nom.toLowerCase() === moi.toLowerCase();
    }
    return false;
  }

  // ---------- Lecture de la sélection dans le tiroir ----------
  const EXCLUS_TITRE = "small, .albpastille, .albfleches, .pdico, button";
  function nomDuTitre(titre) {
    let texte = "";
    const w = document.createTreeWalker(titre, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const exclu = n.parentElement && n.parentElement.closest(EXCLUS_TITRE);
      if (exclu && titre.contains(exclu)) continue;
      texte += n.data;
    }
    return propre(texte);
  }

  // (3.0) chaque nom garde toutes ses sections : deux étiquettes au même nom ne se confondent plus
  function sectionsParNom() {
    const map = new Map();
    for (const s of $$("section.album")) {
      const t = $("h2.albtitre", s);
      if (!t) continue;
      const nom = nomDuTitre(t);
      if (!map.has(nom)) map.set(nom, []);
      map.get(nom).push(s);
    }
    return map;
  }

  // Ailleurs que chez toi : les cartes affichées de l'étiquette (tes exemplaires de ces cartes, lus sur leurs fiches)
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

  function etiquettesChoisies() {
    const tiroir = $("#wpx-tiroir");
    if (!tiroir) return [];
    const lignes = $$('.wpx-t-ligne[aria-selected="true"]', tiroir);
    if (!lignes.length) return [];
    const sections = sectionsParNom();
    const rang = new Map();                               // la n-ième ligne d'un nom va à la n-ième section de ce nom
    return lignes.map(l => {
      const nom = propre(($(":scope > span", l) || {}).textContent);
      const i = rang.get(nom) || 0;
      rang.set(nom, i + 1);
      const liste = sections.get(nom) || [];
      return { nom, section: liste[Math.min(i, liste.length - 1)] || null, rang: i };
    });
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

  // (3.2) chez toi, la liste vient de la collection : seules comptent les lignes cochées du tiroir (rien à parcourir
  // dans la page) ; ailleurs, les cartes affichées de chaque étiquette cochée
  function signatureSelection() {
    const tiroir = $("#wpx-tiroir");
    const cochees = tiroir ? $$('.wpx-t-ligne[aria-selected="true"] > span', tiroir).map(s => propre(s.textContent)) : [];
    if (contextePropre()) return "moi|" + cochees.join("|");
    if (!cochees.length) return "autre|";
    return "autre|" + etiquettesChoisies()
      .map(e => e.nom + ":" + (e.section ? e.section.querySelectorAll(".card[data-cle]").length : "x"))
      .join("|");
  }

  // ---------- Requêtes au site ----------
  const FREIN = { jusqua: 0 };
  function attente429(res, essai) {
    const brut = res.headers.get("Retry-After");
    let ms = Number(brut) * 1000;
    if (!(ms > 0) && brut) ms = Date.parse(brut) - Date.now();
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
    PORTE.file = tour.catch(() => {});
    return tour;
  }

  async function exemplairesDe(cid) {
    const res = await fetchPatient(URL_SITE + "/api/card?cid=" + encodeURIComponent(cid), { credentials: "include" }, "la lecture de " + cid);
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = JSON.parse(await res.text());       // (3.4) décodé ici : voir lireCollection
    const mine = data.mine ?? (data.card && data.card.mine) ?? [];
    return mine.filter(m => Number.isInteger(m.id));
  }

  const MEME_VERSION = (m, c) => !!m.sh === c.sh && !!m.hw === c.hw;
  const EST_VERROUILLEE = m => m.state === "locked";

  async function setVerrou(card_id, on) {
    const res = await requeteVerrou(URL_SITE + "/api/card/lock", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_id, on }),
    });
    return res.status;
  }

  const GROUPE = { possible: true };
  async function setVerrouGroupe(ids, on) {
    const res = await requeteVerrou(URL_SITE + "/api/card/lock/bulk", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on, ids }),
    });
    if (res.status === 404 || res.status === 405) GROUPE.possible = false;
    return res.status;
  }

  async function lireLot(lot, copies, progres) {
    const cids = [...new Set(lot.map(c => c.cid))];
    let suivant = 0;
    let lus = 0;
    const travailleur = async () => {
      while (suivant < cids.length && !RUN.stop) {
        const cid = cids[suivant++];
        try {
          copies.set(cid, { copies: await exemplairesDe(cid) });
        } catch (erreur) {
          copies.set(cid, { erreur });
        }
        lus++;
        progres(lus, cids.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(LECTURES_SIMULTANEES, cids.length) }, travailleur));
  }

  // ---------- (3.0) Les exemplaires d'une étiquette, lus dans ta collection ----------
  // La collection (/api/collection/page) se filtre par étiquette (tag=<id>) et donne, pour chaque exemplaire, son
  // identifiant, ses étiquettes et son cadenas : on sait exactement quels exemplaires portent l'étiquette, y compris
  // ceux que la page n'a pas encore affichés, sans lire une seule fiche.
  const TAGS = { liste: null, parCle: new Map(), file: Promise.resolve(), enCours: new Set() };

  async function lireCollection(tag, page) {
    const res = await fetchPatient(URL_SITE + "/api/collection/page?" + new URLSearchParams({ vue: "cartes", q: "", rar: "", tag, excl: "1", page }),
      { credentials: "include", headers: { Accept: "application/json" } }, "la lecture de ta collection");
    if (!res.ok) throw new Error("HTTP " + res.status);
    // (3.4) le texte, décodé ici : sous Firefox, les objets de .json() appartiennent à la page et ne peuvent pas être
    // rangés dans ceux du script (« XrayWrapper »)
    return JSON.parse(await res.text());
  }

  const estListeEtiquettes = v => Array.isArray(v) && v.length > 0 && v.every(t => t && t.id != null && typeof t.name === "string");

  // ---------- (3.3) La base de la collection, tenue par l'addon de tri par date ----------
  // Quand elle existe, les exemplaires d'une étiquette y sont lus directement (aucune requête au site). Si elle a plus de
  // 10 minutes, l'addon la met d'abord à jour (quelques requêtes). Sans base (ou sans l'addon), on lit le site, comme avant.
  const BASE_FRAICHE_MS = 10 * 60000;
  const BASEL = { db: null, absente: false };

  // ouvre la base sans jamais la créer : si elle n'existe pas, l'ouverture est annulée
  function ouvrirBase() {
    if (BASEL.db) return Promise.resolve(BASEL.db);
    if (BASEL.absente || !window.indexedDB) return Promise.resolve(null);
    return new Promise(ok => {
      const req = indexedDB.open("wpx-collection");
      req.onupgradeneeded = () => { BASEL.absente = true; req.transaction.abort(); };
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("ex") || !db.objectStoreNames.contains("meta")) { db.close(); BASEL.absente = true; return ok(null); }
        db.onversionchange = () => { db.close(); BASEL.db = null; };
        ok(BASEL.db = db);
      };
      req.onerror = () => ok(null);
    });
  }
  // (3.5) sous Firefox, ce que la base renvoie appartient à la page : recopié côté script avant d'être utilisé ou modifié
  const cloner = v => (v && typeof v === "object" ? JSON.parse(JSON.stringify(v)) : v);
  const attendreReq = req => new Promise((ok, ko) => { req.onsuccess = () => ok(cloner(req.result)); req.onerror = () => ko(req.error); });

  async function etatBase() {
    const db = await ouvrirBase();
    if (!db) return null;
    const etat = await attendreReq(db.transaction("meta").objectStore("meta").get("etat"));
    return etat && etat.init && etat.init.fini ? etat : null;
  }

  // demande à l'addon une base à jour, et attend qu'il ait fini (60 s au plus)
  function demanderMiseAJour() {
    return new Promise(ok => {
      const fin = () => { clearTimeout(minuterie); document.removeEventListener("wpx-base-a-jour", fin); ok(); };
      const minuterie = setTimeout(fin, 60000);
      document.addEventListener("wpx-base-a-jour", fin);
      document.dispatchEvent(new CustomEvent("wpx-base-demande-maj"));
    });
  }

  // la base, à jour ; null si elle n'existe pas ou n'a pas pu être mise à jour
  let baseVerifiee = 0;
  async function baseAJour() {
    let etat = await etatBase();
    if (!etat) return null;
    if (Date.now() - (etat.maj || 0) > BASE_FRAICHE_MS && Date.now() - baseVerifiee > 30000) {
      if (ETAT.detail) ETAT.detail.textContent = "Mise à jour de la base de ta collection…";
      journal("Base de la collection : mise à jour demandée à l'addon de tri.");
      await demanderMiseAJour();
      baseVerifiee = Date.now();
      etat = await etatBase();
    }
    return etat && Date.now() - (etat.maj || 0) <= BASE_FRAICHE_MS ? etat : null;
  }

  async function exemplairesEtiquetteDansBase(tagId) {
    const db = await ouvrirBase();
    const liste = await attendreReq(db.transaction("ex").objectStore("ex").index("tags").getAll(IDBKeyRange.only(Number(tagId))));
    return liste.map(r => ({ nom: r.n || r.cid, cle: "ex:" + r.id, id: r.id, locked: !!r.locked, tag: true }));
  }

  // les cadenas posés ou retirés sont notés dans la base (l'addon le fait aussi s'il les voit passer)
  async function noterCadenas(ids, on) {
    const db = await ouvrirBase();
    if (!db || !ids.length) return;
    const tx = db.transaction("ex", "readwrite");
    const s = tx.objectStore("ex");
    for (const id of ids) {
      const lecture = s.get(id);
      lecture.onsuccess = () => { if (lecture.result) { const e = cloner(lecture.result); e.locked = on; s.put(e); } };
    }
  }

  // la liste de tes étiquettes (identifiant, nom) : celle de la base, sinon celle du site, sinon celle d'une page de la collection
  async function listeEtiquettes() {
    if (TAGS.liste) return TAGS.liste;
    try {
      const etat = await etatBase();
      if (etat && estListeEtiquettes(etat.tags)) return (TAGS.liste = etat.tags);
    } catch (e) { /* pas de base : on demande au site */ }
    try {
      const res = await fetchPatient(URL_SITE + "/api/collection/etiquettes", { credentials: "include", headers: { Accept: "application/json" } }, "tes étiquettes");
      if (res.ok) {
        const d = JSON.parse(await res.text());
        const liste = [d, d && d.tags, d && d.etiquettes].find(estListeEtiquettes);
        if (liste) return (TAGS.liste = liste);
      }
    } catch (e) { /* on passe par la collection */ }
    const d = await lireCollection("", 0);
    if (!estListeEtiquettes(d && d.tags)) throw new Error("liste des étiquettes introuvable");
    return (TAGS.liste = d.tags);
  }

  // l'identifiant d'une étiquette : celui de sa section (data-albid) s'il existe, sinon son nom, s'il est unique
  async function idEtiquette(e) {
    const liste = await listeEtiquettes();
    const albid = e.section && e.section.dataset.albid;
    if (albid && liste.some(t => String(t.id) === String(albid))) return String(albid);
    const memeNom = liste.filter(t => propre(t.name) === e.nom);
    if (memeNom.length === 1) return String(memeNom[0].id);
    if (memeNom.length > 1 && memeNom[e.rang]) return String(memeNom[e.rang].id);
    return null;
  }

  async function exemplairesEtiquette(tagId) {
    try {
      if (await baseAJour()) return await exemplairesEtiquetteDansBase(tagId);
    } catch (e) {
      journal("Base de la collection illisible (" + e.message + ") : lecture sur le site.");
    }
    const cartes = [];
    let page = 0, pages = 1;
    while (page < pages) {
      const d = await lireCollection(tagId, page);
      if (!d || !Array.isArray(d.lignes)) throw new Error("réponse inattendue du site");
      if (estListeEtiquettes(d.tags)) TAGS.liste = d.tags;
      pages = d.pages || 1;
      for (const l of d.lignes) {
        if (!Array.isArray(l) || !Array.isArray(l[9])) continue;
        // par sécurité : seulement les exemplaires qui portent vraiment cette étiquette
        if (Array.isArray(l[10]) && !l[10].map(String).includes(String(tagId))) continue;
        for (const id of l[9]) {
          if (!Number.isInteger(id)) continue;
          cartes.push({ nom: propre(l[1] || l[0]), cle: "ex:" + id, id, locked: !!l[8], tag: true });
        }
      }
      page++;
      if (page < pages) await pause(PAUSE_ENTRE_PAGES_MS);
    }
    return cartes;
  }

  const cleTag = e => e.nom + "#" + e.rang;

  // une étiquette à la fois (pas de rafale), puis le panneau se redessine
  function chargerEtiquette(e) {
    const cle = cleTag(e);
    if (TAGS.parCle.has(cle) || TAGS.enCours.has(cle)) return;
    TAGS.enCours.add(cle);
    TAGS.file = TAGS.file.then(async () => {
      let resultat;
      try {
        const id = await idEtiquette(e);
        if (!id) resultat = { cartes: null, erreur: "étiquette introuvable dans ta collection" };
        else resultat = { cartes: await exemplairesEtiquette(id), id };
      } catch (erreur) {
        resultat = { cartes: null, erreur: "lecture impossible (" + erreur.message + ")" };
        journal("Étiquette « " + e.nom + " » : " + resultat.erreur);
      }
      TAGS.enCours.delete(cle);
      TAGS.parCle.set(cle, Object.assign(resultat, { t: Date.now() }));
      if (ETAT.dedans) rafraichirPanneau();
    });
  }

  function oublierEtiquettes() {
    TAGS.parCle.clear();
    TAGS.enCours.clear();
    TAGS.liste = null;
  }

  // les groupes à afficher : chez toi, les exemplaires lus par étiquette ; ailleurs, les cartes affichées
  function groupesChoisis() {
    const moi = contextePropre();
    return etiquettesChoisies().map(e => {
      if (!moi) return { nom: e.nom, cartes: e.section ? cartesDeSection(e.section) : null, mode: "fiche" };
      let lu = TAGS.parCle.get(cleTag(e));
      // (3.2) une étiquette lue il y a plus de 5 minutes (tu as pu changer ses cartes entre-temps) est relue
      if (lu && !RUN.en && Date.now() - (lu.t || 0) > 5 * 60000) { TAGS.parCle.delete(cleTag(e)); lu = null; }
      if (lu) return { nom: e.nom, cartes: lu.cartes, erreur: lu.erreur, mode: "tag" };
      chargerEtiquette(e);
      return { nom: e.nom, cartes: null, charge: true, mode: "tag" };
    });
  }

  // ---------- Journal ----------
  const heure = d => p2(d.getHours()) + ":" + p2(d.getMinutes()) + ":" + p2(d.getSeconds());
  const texteJournal = () => LOG.map(l => `[${heure(l.t)}] ${l.msg}`).join("\n");

  function texteAffiche() {
    const debut = Math.max(0, LOG.length - LIGNES_AFFICHEES_MAX);
    const entete = debut ? `… ${nombre(debut)} ligne(s) plus anciennes, présentes dans l'export .txt\n` : "";
    return entete + LOG.slice(debut).map(l => `[${heure(l.t)}] ${l.msg}`).join("\n") + "\n";
  }

  function limiterAffichage(zone) {
    while (zone.childNodes.length > LIGNES_AFFICHEES_MAX) zone.removeChild(zone.firstChild);
  }

  function journal(msg) {
    const ligne = { t: new Date(), msg };
    LOG.push(ligne);
    if (LOG.length > LIGNES_GARDEES_MAX) LOG.splice(0, LOG.length - LIGNES_GARDEES_MAX);
    const texte = `[${heure(ligne.t)}] ${msg}\n`;
    if (ETAT.journal) {
      ETAT.journal.append(document.createTextNode(texte));
      limiterAffichage(ETAT.journal);
      ETAT.journal.scrollTop = ETAT.journal.scrollHeight;
    }
    if (JRN.vue && !JRN.vue.hidden) {
      JRN.corps.append(document.createTextNode(texte));
      limiterAffichage(JRN.corps);
      JRN.corps.scrollTop = JRN.corps.scrollHeight;
    }
    majCompteJournal();
    sauverSession();
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
        h("button", { type: "button", class: "wpx-btn", title: "Télécharger le journal en .txt", onclick: exporterJournal }, "Exporter .txt"),
        h("button", { type: "button", class: "wpx-btn", title: "Copier le journal", onclick: copierJournal }, "Copier"),
        h("button", { type: "button", class: "wpx-btn", title: "Effacer le journal", onclick: viderJournal }, "Vider"),
        h("button", { type: "button", class: "wpx-btn", title: "Effacer le journal et les étiquettes déjà lues", onclick: viderMemoire }, "Vider la mémoire"),
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

  // (3.0) le journal et les étiquettes déjà lues (relues à la prochaine sélection) ; rien d'autre
  function viderMemoire() {
    if (RUN.en) return toast("Attends la fin du traitement pour vider la mémoire.");
    if (!confirm(
      "Vider la mémoire ?\n\n" +
      `• Journal : ${nombre(LOG.length)} ligne(s) effacée(s). Exporte-le avant si tu veux le garder.\n` +
      `• Étiquettes déjà lues : ${nombre(TAGS.parCle.size)}, relues à la prochaine sélection.\n\n` +
      "Rien d'autre n'est touché (réglages et caches du script principal compris).")) return;
    LOG.length = 0;
    if (ETAT.journal) ETAT.journal.textContent = "";
    if (JRN.vue) remplirJournal();
    oublierEtiquettes();
    majCompteJournal();
    rafraichirPanneau();
    toast("Mémoire vidée : journal effacé, étiquettes à relire.");
  }

  // (3.2) En quittant le panneau (ou la page d'étiquettes), rien n'est effacé : le journal, le dernier traitement et
  // les étiquettes déjà lues restent. Ce qui faisait ramer, c'était le travail fait à chaque changement de la page ;
  // panneau fermé, l'outil ne fait plus rien d'autre que reposer son bouton. Un traitement en cours continue.
  function quitterPanneau() {
    ETAT.groupes = [];
    ETAT.signature = "";
    if (ETAT.corps) ETAT.corps.replaceChildren();       // la liste (parfois des milliers de lignes) est refaite au retour
  }

  // ---------- (3.2) La session : le journal et le dernier traitement survivent à un rechargement de l'onglet ----------
  const CLE_SESSION = "wpx.vr.session";
  const LIGNES_SESSION_MAX = 2000;
  let sauvegardePrevue = 0;

  function sauverSession() {
    if (sauvegardePrevue) return;
    sauvegardePrevue = setTimeout(() => {
      sauvegardePrevue = 0;
      try {
        sessionStorage.setItem(CLE_SESSION, JSON.stringify({
          log: LOG.slice(-LIGNES_SESSION_MAX).map(l => [l.t.getTime(), l.msg]),
          dernier: DERNIER.cartes ? { on: DERNIER.on, cartes: DERNIER.cartes } : null
        }));
      } catch (e) { /* stockage plein ou indisponible : la session vaut pour cette page seulement */ }
    }, 1000);
  }

  function restaurerSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(CLE_SESSION) || "null");
      if (!s) return;
      if (Array.isArray(s.log)) for (const [t, msg] of s.log) LOG.push({ t: new Date(t), msg: String(msg) });
      if (s.dernier && Array.isArray(s.dernier.cartes) && s.dernier.cartes.length) {
        DERNIER.cartes = s.dernier.cartes;
        DERNIER.on = !!s.dernier.on;
      }
    } catch (e) { /* session illisible : on repart de zéro */ }
  }

  // un traitement en cours ne survit pas à un rechargement : le navigateur demande d'abord confirmation
  addEventListener("beforeunload", e => {
    if (!RUN.en) return;
    journal("Page quittée pendant un traitement : il s'arrête ici.");
    e.preventDefault();
    e.returnValue = "";
  });

  // ---------- Progression ----------
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
    let fait = 0, cartesModifiees = 0, cartesDeja = 0, cartesAbsentes = 0, exemplaires = 0, erreurs = 0;

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

        // (3.0) seules les cartes vues ailleurs que chez toi ont besoin de leur fiche : les exemplaires d'une
        // étiquette sont déjà connus, avec leur cadenas
        const copies = new Map();
        const aLire = lot.filter(c => !c.tag);
        if (aLire.length) {
          await lireLot(aLire, copies, (lus, nb) => {
            setProgres({ fait, total, statut: "En cours", etat: "en", detail: `${libelleLot} · lecture des copies ${lus} / ${nb}` });
          });
        }

        const aEnvoyer = [];
        for (const c of lot) {
          if (RUN.stop) break;
          const etiquette = c.sh ? " (chromatique)" : c.hw ? " (Halloween)" : "";
          if (c.tag) {
            if (c.locked === on) {
              cartesDeja++;
              journal(`Déjà ${on ? "verrouillée" : "déverrouillée"} : ${c.nom}  (id ${c.id})`);
              fait++;
            } else {
              aEnvoyer.push({ c, etiquette: "", ids: [c.id] });
            }
            continue;
          }
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

        if (aEnvoyer.length && !RUN.stop) {
          const groupe = aEnvoyer;
          const ids = groupe.flatMap(x => x.ids);
          setProgres({ fait, total, statut: "En cours", etat: "en",
            detail: `${libelleLot} · envoi : ${pluriel(groupe.length, "carte")}, ${pluriel(ids.length, "exemplaire")}` });
          let traite = false;
          if (GROUPE.possible && ids.length > 1) {
            try {
              const statut = await setVerrouGroupe(ids, on);
              journal(`${statut}  envoi groupé de ${pluriel(ids.length, "exemplaire")} (${pluriel(groupe.length, "carte")})`);
              if (statut >= 200 && statut < 300) {
                traite = true;
                for (const x of groupe) {
                  journal(`   ${on ? "verrouillée" : "déverrouillée"} : ${x.c.nom}${x.etiquette}  (id ${x.ids.join(", ")})`);
                  if (x.c.tag) x.c.locked = on;
                }
                cartesModifiees += groupe.length;
                exemplaires += ids.length;
                fait += groupe.length;
                noterCadenas(ids, on).catch(() => {});
              } else if (!GROUPE.possible) {
                journal("Le site ne connaît pas l'envoi groupé : retour au verrouillage carte par carte.");
              } else {
                // (3.0) un refus de l'envoi groupé n'est plus compté comme fait : on reprend carte par carte
                journal(`Envoi groupé refusé (${statut}) : nouvel essai carte par carte.`);
              }
            } catch (e) {
              journal("Erreur sur l'envoi groupé : " + e.message + " : nouvel essai carte par carte.");
            }
          }
          if (!traite) {
            for (const x of groupe) {
              if (RUN.stop) break;
              let modifiees = 0;
              for (const id of x.ids) {
                if (RUN.stop) break;
                try {
                  const statut = await setVerrou(id, on);
                  if (statut >= 200 && statut < 300) { modifiees++; exemplaires++; noterCadenas([id], on).catch(() => {}); }
                  else erreurs++;
                  journal(`${statut}  ${x.c.nom}${x.etiquette}  (id ${id})`);
                } catch (e) {
                  erreurs++;
                  journal("Erreur  " + x.c.nom + " : " + e.message);
                }
              }
              if (modifiees) {
                cartesModifiees++;
                if (x.c.tag) x.c.locked = on;
              }
              fait++;
              setProgres({ fait, total, statut: "En cours", etat: "en", detail: `${libelleLot} · dernière carte traitée : ${x.c.nom}` });
            }
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
        statut = "Terminé avec erreurs"; etat = "err"; detail = bilan;
      } else {
        statut = "Terminé"; etat = "ok"; detail = bilan;
      }
      setProgres({ fait, total, statut, etat, detail });
      journal("Bilan : " + bilan);
      journal("Terminé : " + statut.toLowerCase() + ".");
      DERNIER.cartes = cartes;
      DERNIER.on = on;
      sauverSession();
      majEtatTraitement();
      if (ETAT.panneau && ETAT.dedans) rafraichirPanneau();          // les cadenas de la liste suivent (panneau ouvert)
    }
  }

  function lancer(cartes, on) {
    if (!cartes.length) return journal("Aucune carte : coche une étiquette chargée sur la page.");
    if (cartes.length > CONFIRMATION_A_PARTIR_DE && !confirm(
      `${on ? "Verrouiller" : "Déverrouiller"} ${pluriel(cartes.length, "carte")} ?\n` +
      `Traitées par lots de ${TAILLE_LOT} : chaque lot part en un seul envoi, ${PAUSE_ENTRE_LOTS_MS / 1000} s entre deux lots ; ` +
      `les cartes déjà dans l'état demandé sont ignorées.`)) return;
    traiter(cartes, on);
  }

  function lancerSelection(on) {
    const groupes = groupesChoisis();
    if (groupes.some(g => g.charge)) return toast("Les étiquettes sont encore en lecture : attends qu'elles s'affichent dans la liste.");
    lancer(fusionner(groupes), on);
  }

  // ---------- Panneau dans le tiroir ----------
  function rafraichirPanneau() {
    const p = ETAT.panneau;
    if (!p) return;
    p.classList.toggle("wpx-vr-en", RUN.en);
    const groupes = groupesChoisis();
    const tous = fusionner(groupes);
    const moi = groupes.some(g => g.mode === "tag");
    ETAT.groupes = groupes;
    ETAT.signature = signatureSelection();
    const enLecture = groupes.filter(g => g.charge).length;
    ETAT.resume.textContent = pluriel(groupes.length, "étiquette") + " · " + pluriel(tous.length, moi ? "exemplaire" : "carte") + " à traiter"
      + (enLecture ? " · " + enLecture + " en lecture…" : "");

    const frag = document.createDocumentFragment();
    if (!groupes.length) frag.append(h("p", { class: "wpx-vr-vide" }, "Coche des étiquettes dans la liste ci-dessus : leurs cartes apparaissent ici."));
    groupes.forEach((g, gi) => {
      const bloc = h("div", { class: "wpx-vr-cat" });
      const verrouillees = g.cartes && g.mode === "tag" ? g.cartes.filter(c => c.locked).length : 0;
      const detail = g.charge ? "lecture de ta collection…"
        : g.erreur ? g.erreur
        : !g.cartes ? "cartes non chargées"
        : g.mode === "tag" ? pluriel(g.cartes.length, "exemplaire") + " · " + nombre(verrouillees) + " verrouillé(s)"
        : pluriel(g.cartes.length, "carte");
      const tete = h("div", { class: "wpx-vr-cat-tete" }, h("span", { class: "wpx-vr-nom", title: g.nom }, g.nom), h("small", null, detail));
      if (g.cartes && g.cartes.length) {
        tete.append(
          h("button", { type: "button", class: "wpx-btn wpx-vr-act", title: "Verrouiller toutes les cartes de cette étiquette", "data-act": "on", "data-g": gi }, SVG_FERME, "Tout verrouiller"),
          h("button", { type: "button", class: "wpx-btn wpx-vr-act", title: "Déverrouiller toutes les cartes de cette étiquette", "data-act": "off", "data-g": gi }, SVG_OUVERT, "Tout déverrouiller"));
      }
      bloc.append(tete);
      (g.cartes || []).forEach((c, ci) => {
        const suffixe = c.tag ? (c.locked ? "verrouillée" : "") : c.sh ? "chromatique" : c.hw ? "Halloween" : "";
        bloc.append(h("div", { class: "wpx-vr-ligne" + (c.tag && c.locked ? " wpx-vr-fermee" : "") },
          h("span", { title: c.tag ? c.nom + " · exemplaire " + c.id : c.nom }, c.nom),
          suffixe ? h("small", null, suffixe) : null,
          h("button", { type: "button", class: "wpx-vr-ico wpx-vr-act", title: "Verrouiller cette carte", "aria-label": "Verrouiller " + c.nom, "data-act": "on", "data-g": gi, "data-i": ci }, SVG_FERME),
          h("button", { type: "button", class: "wpx-vr-ico wpx-vr-act", title: "Déverrouiller cette carte", "aria-label": "Déverrouiller " + c.nom, "data-act": "off", "data-g": gi, "data-i": ci }, SVG_OUVERT)));
      });
      frag.append(bloc);
    });
    ETAT.corps.replaceChildren(frag);
    $$(".wpx-vr-act", p).forEach(b => { b.disabled = RUN.en; });
    rafraichirApres();
  }

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

  function rafraichirApres() {
    const a = ETAT.apres;
    if (!a) return;
    if (RUN.en || !DERNIER.cartes || !DERNIER.cartes.length) {
      a.hidden = true;
      a.replaceChildren();
      return;
    }
    const inverse = !DERNIER.on;
    a.hidden = false;
    a.replaceChildren(
      h("span", null, `Traitement terminé. Tu veux ${inverse ? "verrouiller" : "déverrouiller"} ces ${pluriel(DERNIER.cartes.length, "carte")} maintenant ?`),
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
    const bJournal = h("button", { type: "button", class: "wpx-btn wpx-vr-jbtn", "aria-pressed": "false", title: "Afficher ou masquer le journal", onclick: basculerJournal }, "Journal");
    const bMemoire = h("button", { type: "button", class: "wpx-btn", title: "Effacer le journal et les étiquettes déjà lues", onclick: viderMemoire }, "Vider la mémoire");

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
    ETAT.journal.textContent = LOG.length ? texteAffiche() : "";
    setProgres({});
    rafraichirPanneau();
    majBoutonsJournal();
  }

  function modeAlbum() {
    try { return JSON.parse(localStorage.getItem("wpx.export.mode")) === "cartes" ? "cartes" : "liste"; }
    catch (e) { return "liste"; }
  }

  function basculerMode(on) {
    const t = $("#wpx-tiroir");
    if (!t) return;
    if (on && !t.querySelector(".wpx-vr-panel")) installerDansTiroir(t);
    t.classList.toggle("wpx-vr-on", on);
    majBoutons(on);
    const seg = $(".wpx-seg", t);
    if (seg) {
      const garder = on ? null : modeAlbum();
      $$("[data-mode]", seg).forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === garder)));
    }
    if (on) rafraichirPanneau();
  }

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
    const exp = $$(".wpx-exports > button:not(.wpx-vr-btn)").find(b => b.getClientRects().length);
    if (!exp) return toast("Va sur une page d'étiquettes (Ma collection > Étiquettes, ou ton profil) : le verrouillage part des étiquettes affichées.");
    exp.click();
    t = $("#wpx-tiroir");
    if (t) basculerMode(true);
  }

  // (3.1) le bouton est dans la barre des étiquettes, entre le trait et « Exporter » (une barre sur un profil, une
  // dans Ma collection) ; il n'est plus dans l'en-tête, à côté de Clean et Largeur
  function installerBouton() {
    $$("body > header.top .row1 > .wpx-vr-crane").forEach(b => b.remove());
    for (const zone of $$(".wpx-exports")) {
      if (zone.querySelector(":scope > .wpx-vr-btn")) continue;
      const exporter = zone.querySelector(":scope > button");
      const bouton = h("button", { type: "button", class: "wpx-btn wpx-vr-btn", "aria-pressed": "false",
        title: "Verrouiller ou déverrouiller les cartes des étiquettes cochées", onclick: ouvrirVerrou }, SVG_FERME, h("span", null, "Verrouiller"));
      if (exporter) exporter.before(bouton);
      else zone.append(bouton);
    }
  }

  function majBoutons(on) {
    $$(".wpx-vr-btn").forEach(b => b.setAttribute("aria-pressed", String(on)));
  }

  function toast(texte) {
    const d = h("div", { class: "wpx-vr-toast", style: "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483646;max-width:min(92vw,560px);" +
      "padding:12px 16px;border-radius:10px;background:#1e1f22;color:#f2f3f5;border:1px solid #8b5cf6;" +
      "font:600 13.5px/1.45 system-ui,sans-serif;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.45)" }, texte);
    document.body.append(d);
    setTimeout(() => d.remove(), 5000);
  }

  function installerStyles() {
    if (document.getElementById("wpx-vr-styles")) return;
    const s = h("style", { id: "wpx-vr-styles" }, `
#wpx-tiroir.wpx-vr-on .wpx-t-res,#wpx-tiroir.wpx-vr-on .wpx-t-options{display:none!important}
#wpx-tiroir:not(.wpx-vr-on) .wpx-vr-panel{display:none!important}
.wpx-vr-panel{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:10px 14px 14px;font:500 13px/1.4 Inter,system-ui,sans-serif;color:var(--wpx-encre,#ece9f6)}
.wpx-vr-tete{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px}
.wpx-vr-tete .wpx-vr-resume{margin-right:auto;color:var(--wpx-doux,#9a93b3);font-size:12.5px}
.wpx-vr-tete .wpx-btn,.wpx-vr-cat-tete .wpx-btn{height:28px;padding:0 10px;font-size:12px}
.wpx-vr-tete .wpx-btn svg,.wpx-vr-cat-tete .wpx-btn svg{width:13px;height:13px}
.wpx-vr-stop{display:none!important}
.wpx-vr-en .wpx-vr-stop{display:inline-flex!important}
.wpx-vr-btn svg{width:15px;height:15px}
.wpx-vr-btn[aria-pressed="true"],.wpx-vr-jbtn[aria-pressed="true"]{background:var(--wpx-degrade,#7c3aed);border-color:transparent;color:#fff}
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
.wpx-vr-ligne.wpx-vr-fermee>small{color:#fde68a}
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

  function verifier() {
    ETAT.planifie = 0;
    installerBouton();
    const t = $("#wpx-tiroir");
    if (!t) return;
    suivreTiroir(t);
    installerDansTiroir(t);
    const dedans = t.classList.contains("wpx-ouvert") && t.classList.contains("wpx-vr-on");
    if (ETAT.dedans && !dedans) {
      if (t.classList.contains("wpx-vr-on")) {
        t.classList.remove("wpx-vr-on");
        majBoutons(false);
      }
      ETAT.dedans = false;
      quitterPanneau();
      return;
    }
    const retour = dedans && !ETAT.dedans;
    ETAT.dedans = dedans;
    if (!dedans || !ETAT.panneau) return;
    if (retour) {
      // de retour dans le panneau : le journal et la liste reprennent où ils en étaient
      ETAT.journal.textContent = LOG.length ? texteAffiche() : "";
      rafraichirApres();
    }
    const signature = signatureSelection();
    if (retour || signature !== ETAT.signature) rafraichirPanneau();
  }

  function planifier() {
    if (!ETAT.planifie) ETAT.planifie = requestAnimationFrame(verifier);
  }

  /* (3.2) Ce qui faisait ramer le site : l'outil regardait chaque changement de toute la page (et chaque classe qui
     change en défilant), et relisait alors toutes les étiquettes affichées. Maintenant :
     - le tiroir a son propre observateur (sélection, ouverture, changement de mode) ;
     - dans le reste de la page, seuls comptent un tiroir ou une barre d'export qui apparaît sans son bouton, et,
       panneau ouvert, les étiquettes qui changent ;
     - panneau fermé, plus rien d'autre. */
  let tiroirSuivi = null;
  const observateurTiroir = new MutationObserver(planifier);
  function suivreTiroir(t) {
    if (tiroirSuivi === t) return;
    observateurTiroir.disconnect();
    observateurTiroir.observe(t, { attributes: true, attributeFilter: ["class", "aria-selected"], subtree: true });
    tiroirSuivi = t;
  }

  const DANS_OUTIL = ".wpx-vr-panel, #wpx-vr-journal-panel, .wpx-vr-toast, .wpx-vr-btn";
  function mutationUtile(m) {
    const cible = m.target;
    if (cible.nodeType !== 1 || cible.closest(DANS_OUTIL)) return false;
    // un bouton à reposer : une barre d'export sans le sien, ou le tiroir qui arrive
    for (const n of m.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.id === "wpx-tiroir" || n.matches(".wpx-exports, .wpx-barre") || n.querySelector(".wpx-exports")) return true;
    }
    if (cible.matches(".wpx-exports, .wpx-barre")) return true;
    // panneau ouvert : les étiquettes de la page (une section chargée, ajoutée ou retirée)
    if (ETAT.dedans && (cible.closest("section.album") || [...m.addedNodes, ...m.removedNodes].some(n => n.nodeType === 1 && n.matches("section.album")))) return true;
    return false;
  }

  restaurerSession();
  installerStyles();
  new MutationObserver(mutations => {
    if (ETAT.planifie) return;
    for (const m of mutations) {
      if (mutationUtile(m)) { planifier(); return; }
    }
  }).observe(document.body, { childList: true, subtree: true });
  setTimeout(planifier, 1500);
  // (3.6) le bouton Verrouiller, reposé à côté d'Exporter si la barre a été redessinée sans que l'observateur le voie
  setInterval(installerBouton, 2000);
})();