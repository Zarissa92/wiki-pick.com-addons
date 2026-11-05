// ==UserScript==
// @name         [test]Wiki-Pick vendeurs bloqués
// @namespace    local.wikipick.bloques
// @version      1.5
// @description  Masque les annonces des vendeurs que tu as bloqués sur wiki-pick.com, avec un bouton pour activer ou désactiver
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
    const CLE_ETAT = "wpx.bloques.actif";            // "1" : masquage actif, "0" : désactivé (retenu dans le navigateur)
    const ID_BOUTON = "wpx-bloques-bascule";
    const BOUTON_MESSAGES = 'button[data-dock="ouvrir"]';   // le bouton Messages : le nôtre se place juste après
    // ===== FIN DES PARAMÈTRES =====

    if (window.__wpxBloquesActif) return;
    window.__wpxBloquesActif = true;

    const fetchOriginal = window.fetch.bind(window);

    // ---- état du bouton (retenu dans le navigateur) ----
    function actif() {
      try { return localStorage.getItem(CLE_ETAT) !== "0"; }
      catch (e) { return true; }
    }
    function definirActif(v) {
      try { localStorage.setItem(CLE_ETAT, v ? "1" : "0"); }
      catch (e) { /* stockage indisponible : le choix vaudra pour cette page seulement */ }
    }

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
      if (!actif() || !d || typeof d !== "object" || !Array.isArray(d.items) || !BLOQUES.noms || !BLOQUES.noms.size) return 0;
      const gardees = d.items.filter(a => !BLOQUES.noms.has(normaliser(a && a.seller)));
      const retirees = d.items.length - gardees.length;
      if (retirees) d.items = gardees;
      return retirees;
    }

    // Texte de réponse : même résultat à chaque lecture (mis en cache pour ne pas reparser)
    const memoTexte = { brut: null, filtre: null };
    function filtrerTexte(brut) {
      if (typeof brut !== "string" || !actif() || !BLOQUES.noms || !BLOQUES.noms.size) return brut;
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
      if (!actif() || !MOTIF_ANNONCES.test(adresse(entree))) return fetchOriginal(entree, options);
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
      if (!actif() || !MOTIF_ANNONCES.test(xhr.__wpxUrl || "")) return envoyerOriginal.apply(xhr, args);
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

    // ---- bouton de bascule, juste après le bouton Messages, au même format ----
    const ICONE_OEIL = '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"></path><circle cx="12" cy="12" r="3"></circle>';
    const ICONES = {
      on: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">${ICONE_OEIL}</svg>`,
      off: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">${ICONE_OEIL}<path d="M3 3l18 18"></path></svg>`,
    };

    function placerBouton() {
      if (document.getElementById(ID_BOUTON)) return;
      const messages = document.querySelector(BOUTON_MESSAGES);
      if (!messages) return;
      const b = document.createElement("button");
      b.id = ID_BOUTON;
      b.type = "button";
      b.className = "mdock-pli";
      const majBouton = () => {
        const on = actif();
        b.innerHTML = (on ? ICONES.on : ICONES.off) + "<span></span>";
        b.querySelector("span").textContent = on ? "Vendeurs bloqués : masqués" : "Vendeurs bloqués : affichés";
        b.title = on ? "Cliquer pour afficher les annonces des vendeurs bloqués" : "Cliquer pour masquer les annonces des vendeurs bloqués";
        b.setAttribute("aria-pressed", String(on));
      };
      b.addEventListener("click", () => {
        definirActif(!actif());
        location.reload();          // les annonces déjà affichées ne peuvent pas être réécrites : on recharge
      });
      majBouton();
      messages.insertAdjacentElement("afterend", b);
    }

    // Le bouton peut être redessiné par le site : on le remet à sa place si besoin
    function surveiller() {
      placerBouton();
      new MutationObserver(placerBouton).observe(document.documentElement, { childList: true, subtree: true });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", surveiller, { once: true });
    else surveiller();
  }

  // Injection dans la page (le script lui-même n'a pas le droit de modifier fetch ni XMLHttpRequest)
  const s = document.createElement("script");
  s.textContent = "(" + principal.toString() + ")();";
  (document.documentElement || document.head).appendChild(s);
  s.remove();
})();