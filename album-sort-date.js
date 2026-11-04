// ==UserScript==
// @name         Wiki-Pick tri par date d'ajout
// @namespace    local.wikipick.tridate
// @version      0.8
// @description  Trie les cartes affichées de « Ma collection » par date d'obtention uniquement, dans la grille d'origine (lecture par blocs de 99, avec cache)
// @match        https://wiki-pick.com/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  // ===== PARAMÈTRES MODIFIABLES =====
  const N_PAR_DEFAUT = 99;                 // nombre de cartes de la page à trier (modifiable à côté du bouton)
  const N_MIN = 1;
  const N_MAX = 99;                        // la grille ne peut trier que les cartes de la page affichée
  const LECTURES_PAR_BLOC = 99;            // fiches lues en même temps dans un bloc
  const PAUSE_ENTRE_BLOCS_MS = 1500;       // pause entre deux blocs
  const PAUSE_SI_429_MS = 5000;            // pause si le site répond « trop de requêtes »
  const ESSAIS_SI_429 = 3;                 // nombre de nouvelles tentatives pour une carte
  const DELAI_AVANT_TRI_MS = 400;          // attente après un redessin de la grille avant de trier
  const CLE_CACHE = "wpx.tri.dates2";      // dates déjà lues, gardées dans le navigateur
  const CLE_MODE = "wpx.tri.mode";         // mode choisi, gardé d'une page à l'autre
  const CLE_N = "wpx.tri.n";               // nombre de cartes choisi, gardé d'une page à l'autre
  const ID_BOUTON = "wpx-tri-date";
  const ID_CHAMP = "wpx-tri-n";
  // ===== FIN DES PARAMÈTRES =====

  if (window.__wpxTriDate) return;
  window.__wpxTriDate = true;
  console.log("[tri par date] script chargé");

  const MODES = ["site", "recent", "ancien"];
  const LIBELLES = {
    site: "Tri par date : désactivé",
    recent: "Date : plus récent d'abord",
    ancien: "Date : plus ancien d'abord",
  };

  const pause = ms => new Promise(r => setTimeout(r, ms));

  let mode = "site";
  try {
    const m = localStorage.getItem(CLE_MODE);
    if (MODES.includes(m)) mode = m;
  } catch (e) { /* stockage indisponible : mode par défaut */ }

  let nCartes = N_PAR_DEFAUT;
  try {
    const v = parseInt(localStorage.getItem(CLE_N), 10);
    if (v >= N_MIN && v <= N_MAX) nCartes = v;
  } catch (e) { /* valeur par défaut */ }

  // { cartes: { cid: { ex: {idExemplaire: ts}, max: ts } } }
  function lireCache() {
    try {
      const c = JSON.parse(localStorage.getItem(CLE_CACHE));
      if (c && c.cartes) return c;
    } catch (e) { /* illisible : on repart de zéro */ }
    return { cartes: {} };
  }
  function ecrireCache(c) {
    try { localStorage.setItem(CLE_CACHE, JSON.stringify(c)); }
    catch (e) { /* stockage plein : on continue sans mémoire */ }
  }
  function ecrireMode() {
    try { localStorage.setItem(CLE_MODE, mode); } catch (e) { /* ignoré */ }
  }
  function ecrireN() {
    try { localStorage.setItem(CLE_N, String(nCartes)); } catch (e) { /* ignoré */ }
  }

  // Les cartes de la grille, chacune dans son conteneur .cw
  function elements() {
    return Array.from(document.querySelectorAll(".cw")).filter(w => w.querySelector(":scope > .card[data-cle]"));
  }
  const cidDe = w => w.querySelector(":scope > .card[data-cle]").getAttribute("data-cle").split("#")[0];
  const exemplaireDe = w => {
    const b = w.querySelector("button[data-lock]");
    return b ? b.dataset.lock : null;
  };

  // Date d'une carte affichée : celle de l'exemplaire exact si on la trouve, sinon la plus récente de la carte
  function dateDe(w, cache) {
    const e = cache.cartes[cidDe(w)];
    if (!e) return 0;
    const id = exemplaireDe(w);
    if (id && e.ex[id] !== undefined) return e.ex[id];
    return e.max || 0;
  }

  // Adresse complète (pas relative) : certains scripts de la page analysent l'adresse avec new URL()
  function adresseFiche(cid) {
    return "https://wiki-pick.com/api/card?cid=" + encodeURIComponent(cid);
  }

  // Lit la fiche d'une carte ; en cas de 429, attend puis réessaie
  async function lireFiche(cid) {
    for (let essai = 0; essai <= ESSAIS_SI_429; essai++) {
      const res = await fetch(adresseFiche(cid), { credentials: "include" });
      if (res.status === 429) {
        await pause(PAUSE_SI_429_MS * (essai + 1));
        continue;
      }
      if (!res.ok) throw new Error("HTTP " + res.status + " sur " + cid);
      return res.json();
    }
    throw new Error("trop de requêtes persistantes sur " + cid);
  }

  // Lit les cartes absentes du cache, par blocs de 99 lus en même temps
  async function lireDates(liste, progres) {
    const cache = lireCache();
    const aLire = [...new Set(liste.map(cidDe))].filter(cid => !cache.cartes[cid]);
    if (!aLire.length) return;

    for (let i = 0; i < aLire.length; i += LECTURES_PAR_BLOC) {
      const bloc = aLire.slice(i, i + LECTURES_PAR_BLOC);
      const fiches = await Promise.all(bloc.map(lireFiche));

      fiches.forEach((data, k) => {
        const ex = {};
        let max = 0;
        for (const m of data.mine || []) {
          if (!Number.isInteger(m.id)) continue;
          const t = (m.prov && m.prov.ts) || 0;
          ex[m.id] = t;
          if (t > max) max = t;
        }
        cache.cartes[bloc[k]] = { ex, max };
      });

      ecrireCache(cache);
      progres(Math.min(i + bloc.length, aLire.length), aLire.length);

      if (i + LECTURES_PAR_BLOC < aLire.length) await pause(PAUSE_ENTRE_BLOCS_MS);
    }
  }

  // Le conteneur réellement déplacé : le « slot » qui entoure la carte, ou la carte elle-même
  const porteur = w => (w.parentElement && w.parentElement.classList.contains("slot") ? w.parentElement : w);

  // Remet les cartes dans l'ordre donné
  function appliquer(ordre) {
    const liste = elements();
    if (!liste.length) return;
    const g = porteur(liste[0]).parentElement;
    for (const w of ordre) {
      const p = porteur(w);
      if (p.isConnected && p.parentElement === g) g.appendChild(p);
    }
  }

  // L'ordre actuel de la grille est-il déjà celui qu'on veut ?
  function memeOrdre(cible) {
    const actuel = elements();
    return actuel.length === cible.length && actuel.every((w, i) => w === cible[i]);
  }

  // Tri par date seule. Pas de date, ou même date : départage par identifiant de carte,
  // jamais par la rareté (l'ordre du site). Les cartes sans date vont à la fin.
  function comparerParDate(cache) {
    return (x, y) => {
      const dx = dateDe(x, cache), dy = dateDe(y, cache);
      const cx = cidDe(x), cy = cidDe(y);
      if (dx === 0 || dy === 0) {
        if (dx === dy) return cx < cy ? -1 : (cx > cy ? 1 : 0);
        return dx === 0 ? 1 : -1;
      }
      if (dx === dy) return cx < cy ? -1 : (cx > cy ? 1 : 0);
      return mode === "recent" ? dy - dx : dx - dy;
    };
  }

  function texte(b, t) {
    if (b && b.textContent !== t) b.textContent = t;
  }
  const bouton = () => document.getElementById(ID_BOUTON);
  const champ = () => document.getElementById(ID_CHAMP);

  let ordreInitial = null;   // ordre tel que le site l'affiche (mode « site »), pour y revenir
  let occupe = false;
  let enAttente = false;
  let minuterie = null;

  // Lit ce qui manque pour les N premières cartes, puis les range en tête de grille
  async function appliquerAuto() {
    if (mode === "site") return;
    if (occupe) { enAttente = true; return; }
    const toutes = elements();
    if (!toutes.length) return;
    const aTrier = toutes.slice(0, nCartes);
    const reste = toutes.slice(nCartes);

    const b = bouton();
    occupe = true;
    if (b) b.disabled = true;
    try {
      await lireDates(aTrier, (fait, total) => texte(b, `Lecture des dates ${fait} / ${total}…`));
      const cache = lireCache();
      const sans = aTrier.filter(w => dateDe(w, cache) === 0).length;
      if (sans) console.log(`[tri par date] ${sans} carte(s) sans date, placées à la fin`);
      const cible = aTrier.slice().sort(comparerParDate(cache)).concat(reste);
      if (!memeOrdre(cible)) appliquer(cible);
      texte(b, LIBELLES[mode]);
    } catch (e) {
      console.error("[tri par date]", e);
      texte(b, "Erreur : voir la console");
    } finally {
      occupe = false;
      if (b) b.disabled = false;
      if (enAttente) { enAttente = false; planifier(); }
    }
  }

  function planifier() {
    clearTimeout(minuterie);
    minuterie = setTimeout(appliquerAuto, DELAI_AVANT_TRI_MS);
  }

  function cliquer() {
    if (occupe) return;
    const i = MODES.indexOf(mode);
    mode = MODES[(i + 1) % MODES.length];
    ecrireMode();
    const b = bouton();
    if (mode === "site") {
      if (ordreInitial && ordreInitial.length && ordreInitial.every(w => w.isConnected)) appliquer(ordreInitial);
      texte(b, LIBELLES.site);
      return;
    }
    appliquerAuto();
  }

  // Changement du nombre de cartes : on garde la valeur, et on retrie si un tri est actif
  function changerN() {
    const c = champ();
    const v = Math.min(N_MAX, Math.max(N_MIN, parseInt(c.value, 10) || N_PAR_DEFAUT));
    nCartes = v;
    c.value = String(v);
    ecrireN();
    if (mode !== "site") planifier();
  }

  // Le bouton se place après « Sélectionner » ; sans cette option, en bas à gauche de l'écran
  function installer() {
    if (bouton()) return;
    const repere = document.getElementById("selBtn");
    if (!repere && !elements().length) return;   // pas de grille de cartes sur cette page

    const b = document.createElement("button");
    b.id = ID_BOUTON;
    b.type = "button";
    b.className = "btn ghost";
    b.textContent = LIBELLES[mode];
    b.addEventListener("click", cliquer);

    const c = document.createElement("input");
    c.id = ID_CHAMP;
    c.type = "number";
    c.min = String(N_MIN);
    c.max = String(N_MAX);
    c.value = String(nCartes);
    c.title = "Nombre de cartes de la page à trier (99 au maximum)";
    c.style.cssText = "width:70px;margin-left:6px;";
    c.addEventListener("change", changerN);

    if (repere) {
      repere.insertAdjacentElement("afterend", b);
      b.insertAdjacentElement("afterend", c);
    } else {
      b.style.cssText = "position:fixed;left:16px;bottom:16px;z-index:9999;";
      c.style.cssText = "position:fixed;left:170px;bottom:16px;z-index:9999;width:70px;";
      document.body.appendChild(b);
      document.body.appendChild(c);
    }
    console.log("[tri par date] bouton ajouté");
  }

  // Ignore les changements faits par le bouton et le champ (sinon boucle sans fin)
  const dansBouton = n => {
    const el = n.nodeType === 1 ? n : n.parentElement;
    return !!(el && el.closest && el.closest("#" + ID_BOUTON + ", #" + ID_CHAMP));
  };

  installer();
  new MutationObserver(muts => {
    if (muts.every(m => dansBouton(m.target))) return;
    installer();
    if (mode === "site") {
      ordreInitial = elements();
      return;
    }
    planifier();
  }).observe(document.body, { childList: true, subtree: true });
})();