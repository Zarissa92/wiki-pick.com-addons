// ==UserScript==
// @name         [test]Wiki-Pick vendeurs bloqués
// @namespace    local.wikipick.bloques
// @version      1.3
// @description  Masque les annonces des vendeurs que tu as bloqués sur wiki-pick.com
// @match        https://wiki-pick.com/*
// @grant        none
// @run-at       document-start
// @noframes
// ==/UserScript==

(function () {
  "use strict";

  // Ce code est injecté dans la page : il partage les objets du site (XMLHttpRequest, fetch).
  function principal() {
    // ===== PARAMÈTRES MODIFIABLES =====
    const URL_BLOCAGES = "/api/blocages";            // liste des pseudos bloqués, lue sur le site
    // 0 : la liste est relue à chaque chargement d'annonces (une seule requête de plus par chargement, rien en continu)
    const DUREE_CACHE_MS = 0;
    const MOTIF_ANNONCES = /\/api\/auctions(\?|$)/;  // les réponses qui contiennent les annonces
    // ===== FIN DES PARAMÈTRES =====

    if (window.__wpxBloquesActif) return;
    window.__wpxBloquesActif = true;

    const fetchOriginal = window.fetch.bind(window);

    // Comparaison des pseudos : sans tenir compte des accents, des espaces ni de la casse
    const normaliser = s => String(s == null ? "" : s).normalize("NFC").trim().toLowerCase();

    const BLOQUES = { noms: null, date: 0, attente: null };

    function chargerBloques() {
      if (BLOQUES.noms && Date.now() - BLOQUES.date < DUREE_CACHE_MS) return Promise.resolve(BLOQUES.noms);
      if (BLOQUES.attente) return BLOQUES.attente;
      BLOQUES.attente = fetchOriginal(URL_BLOCAGES, { credentials: "include" })
        .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(d => {
          const liste = d && Array.isArray(d.bloques) ? d.bloques : [];
          BLOQUES.noms = new Set(liste.map(b => normaliser(b.name)).filter(Boolean));
        })
        .catch(() => { if (!BLOQUES.noms) BLOQUES.noms = new Set(); })   // en cas d'échec : dernière liste connue, ou aucune
        .then(() => { BLOQUES.date = Date.now(); BLOQUES.attente = null; return BLOQUES.noms; });
      return BLOQUES.attente;
    }

    // Retire les annonces des vendeurs bloqués d'un objet {items: [...]}. Renvoie le nombre retiré.
    function retirerDansObjet(d) {
      if (!d || typeof d !== "object" || !Array.isArray(d.items) || !BLOQUES.noms || !BLOQUES.noms.size) return 0;
      const gardees = d.items.filter(a => !BLOQUES.noms.has(normaliser(a && a.seller)));
      const retirees = d.items.length - gardees.length;
      if (retirees) d.items = gardees;
      return retirees;
    }

    // Texte de réponse : même résultat à chaque lecture (mis en cache pour ne pas reparser)
    const memoTexte = { brut: null, filtre: null };
    function filtrerTexte(brut) {
      if (typeof brut !== "string" || !BLOQUES.noms || !BLOQUES.noms.size) return brut;
      if (memoTexte.brut === brut) return memoTexte.filtre;
      let filtre = brut;
      try {
        const d = JSON.parse(brut);
        const n = retirerDansObjet(d);
        if (n) {
          filtre = JSON.stringify(d);
          console.info(`[vendeurs bloqués] ${n} annonce(s) masquée(s)`);
        }
      } catch (e) { /* pas du JSON : réponse laissée telle quelle */ }
      memoTexte.brut = brut;
      memoTexte.filtre = filtre;
      return filtre;
    }

    const objetsTraites = new WeakSet();
    function filtrerObjet(o) {
      if (!o || typeof o !== "object" || objetsTraites.has(o)) return o;
      objetsTraites.add(o);
      const n = retirerDansObjet(o);
      if (n) console.info(`[vendeurs bloqués] ${n} annonce(s) masquée(s)`);
      return o;
    }

    // ---- fetch (le site l'utilise pour les filtres : tri, chromatique, etc.) ----
    const adresse = entree => (typeof entree === "string" ? entree : (entree && entree.url) || "");

    window.fetch = function (entree, options) {
      if (!MOTIF_ANNONCES.test(adresse(entree))) return fetchOriginal(entree, options);
      return chargerBloques()
        .then(() => fetchOriginal(entree, options))
        .then(async reponse => {
          if (!reponse.ok) return reponse;
          let texte;
          try { texte = await reponse.clone().text(); }
          catch (e) { return reponse; }
          const filtre = filtrerTexte(texte);
          if (filtre === texte) return reponse;
          return new Response(filtre, {
            status: reponse.status,
            statusText: reponse.statusText,
            headers: { "Content-Type": "application/json" },
          });
        });
    };

    // ---- XMLHttpRequest (le site l'utilise pour certaines annonces) ----
    const descTexte = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "responseText");
    const descReponse = Object.getOwnPropertyDescriptor(XMLHttpRequest.prototype, "response");
    const ouvrirOriginal = XMLHttpRequest.prototype.open;
    const envoyerOriginal = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (method, url, ...reste) {
      this.__wpxUrl = String(url);
      return ouvrirOriginal.call(this, method, url, ...reste);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      const xhr = this;
      if (!MOTIF_ANNONCES.test(xhr.__wpxUrl || "")) return envoyerOriginal.apply(xhr, args);
      // la liste des blocages doit être à jour avant d'envoyer la requête des annonces
      chargerBloques().then(() => {
        Object.defineProperty(xhr, "responseText", {
          configurable: true,
          get() { return filtrerTexte(descTexte.get.call(xhr)); },
        });
        Object.defineProperty(xhr, "response", {
          configurable: true,
          get() {
            const v = descReponse.get.call(xhr);
            return typeof v === "string" ? filtrerTexte(v) : filtrerObjet(v);
          },
        });
        envoyerOriginal.apply(xhr, args);
      });
    };
  }

  // Injection dans la page (le script lui-même n'a pas le droit de modifier fetch ni XMLHttpRequest)
  const s = document.createElement("script");
  s.textContent = "(" + principal.toString() + ")();";
  (document.documentElement || document.head).appendChild(s);
  s.remove();
})();