// ==UserScript==
// @name         [test]Album pont Discord
// @namespace    local
// @version      1.6
// @description  Petit relais qui transmet vers Discord les messages préparés par l'outil Album. À installer à côté du script Album.
// @match        https://wiki-pick.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      discord.com
// @connect      discordapp.com
// @run-at       document-idle
// @noframes
// ==/UserScript==

/*
 * Ce que fait ce script
 * ---------------------
 * Il relaie vers Discord les messages préparés par le script Album. Il tourne à côté de la page, avec la permission
 * GM_xmlhttpRequest, et ne touche à rien d'autre : il attend qu'Album dépose une demande d'envoi dans la mémoire
 * partagée (localStorage, clé wpx.pont.req), l'envoie au webhook Discord indiqué, et range le résultat au même endroit
 * (wpx.pont.res). Aucune donnée ne part ailleurs que vers un webhook Discord. Attention : le pont ne connaît pas le
 * webhook réglé dans Album, il accepte donc n'importe quel webhook Discord que la demande indique.
 *
 * Réveil (1.6) : Album le réveille par un événement (wpx-pont-demande) dès qu'il dépose une demande, et le pont
 * le réveille à son tour (wpx-pont-reponse) dès que la réponse est rangée : plus d'attente d'un tour de minuterie,
 * même dans un onglet caché. La minuterie (toutes les 200 ms) reste en secours, pour un Album plus ancien.
 *
 * Ce qu'il refuse (la mémoire partagée est lisible par la page : une demande n'est donc jamais crue sur parole)
 * ---------------------------------------------------------------------------------------------------------------
 * - une adresse qui n'est pas un webhook Discord (https, discord.com ou discordapp.com) ;
 * - un message qui n'est pas un message de l'outil (il porte toujours un bloc ```wpx), ou de plus de 2 000 signes ;
 * - une pièce jointe qui n'est pas un petit fichier JSON au nom simple ;
 * - toute mention : le pont impose allowed_mentions = aucune, quoi que la demande ait écrit ;
 * - les cookies de discord.com (requêtes anonymes) et les redirections.
 * Pour essayer avec un serveur local, ajoute à la main « // @connect 127.0.0.1 » et l'adresse locale à WEBHOOK, le temps de l'essai.
 */
(function () {
    "use strict";
    const GMX = (typeof GM_xmlhttpRequest !== "undefined") ? GM_xmlhttpRequest
              : (typeof GM !== "undefined" && GM.xmlHttpRequest) ? GM.xmlHttpRequest.bind(GM) : null;
    if (!GMX) return;                                   // gestionnaire sans GM_xmlhttpRequest : rien à faire

    const REQ = "wpx.pont.req", RES = "wpx.pont.res";
    const WEBHOOK = /^https:\/\/discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+$/;
    const BLOC_OUTIL = /```wpx\n/;                       // tout message de l'outil porte ce bloc : le bot ne lit que lui
    const NOM_FICHIER = /^[\w.-]{1,40}$/;
    const TAILLE_MAX = {message: 2000, fichier: 100000, demande: 120000};
    const PAUSE_MAX_429 = 60000;                         // ne jamais garder le verrou plus d'une minute sur un 429

    const lire = cle => { try { return JSON.parse(localStorage.getItem(cle) || "null"); } catch (e) { return null; } };
    // renvoie false si l'écriture a échoué (mémoire pleine) : l'appelant doit le savoir
    const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); return true; } catch (e) { return false; } };
    const attendre = ms => new Promise(r => setTimeout(r, ms));
    // tout en ASCII (\uXXXX pour le reste) : les accents et émojis traversent GM_xmlhttpRequest sans être abîmés
    const ascii = s => String(s).replace(/[\u0080-\uffff]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

    /* Ce que le pont est prêt à envoyer, reconstruit champ par champ : rien de la demande n'est transmis tel quel.
       null si la demande n'est pas celle de l'outil. */
    function verifier(spec) {
        if (!spec || typeof spec !== "object" || Array.isArray(spec)) return null;
        if (typeof spec.id !== "string" || spec.id.length > 64) return null;
        if (typeof spec.url !== "string" || !WEBHOOK.test(spec.url)) return null;
        if (spec.lire === true) return {id: spec.id, url: spec.url, lire: true};
        const p = spec.payload;
        if (!p || typeof p.content !== "string" || p.content.length > TAILLE_MAX.message || !BLOC_OUTIL.test(p.content)) return null;
        const propre = {id: spec.id, url: spec.url, payload: {content: p.content, allowed_mentions: {parse: []}}};
        if (spec.fichier) {
            const f = spec.fichier;
            if (!NOM_FICHIER.test(f.nom || "") || f.type !== "application/json" || typeof f.texte !== "string"
                || f.texte.length > TAILLE_MAX.fichier) return null;
            propre.payload.attachments = [{id: 0, filename: f.nom}];
            propre.fichier = {nom: f.nom, type: f.type, texte: f.texte};
        }
        return propre;
    }

    function corps(spec) {
        const payload = ascii(JSON.stringify(spec.payload));
        if (!spec.fichier) return {headers: {"Content-Type": "application/json"}, data: payload};
        const b = "----wpxpont" + Math.random().toString(16).slice(2);
        const data =
            `--${b}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${payload}\r\n` +
            `--${b}\r\nContent-Disposition: form-data; name="files[0]"; filename="${spec.fichier.nom}"\r\n` +
            `Content-Type: ${spec.fichier.type}\r\n\r\n${ascii(spec.fichier.texte)}\r\n--${b}--\r\n`;
        return {headers: {"Content-Type": `multipart/form-data; boundary=${b}`}, data};
    }

    function retrait(r) {
        try { return Math.ceil((Number(JSON.parse(r.responseText || "{}").retry_after) || 2) * 1000) + 250; }
        catch (e) { return 2250; }
    }

    const nomDuWebhook = texte => { try { return String(JSON.parse(texte || "{}").name || "").slice(0, 100); } catch (e) { return ""; } };

    function envoyer(spec) {
        return new Promise(resolve => {
            const base = {timeout: 15000, anonymous: true, redirect: "error"};     // ni cookies de discord.com, ni redirection
            if (spec.lire) {                             // simple lecture du webhook (pour connaître son nom = le nom du serveur)
                GMX(Object.assign({
                    method: "GET", url: spec.url,
                    onload: r => resolve({status: r.status, corps: JSON.stringify({name: nomDuWebhook(r.responseText)})}),  // le nom seul : ni jeton ni salon
                    onerror: () => resolve({status: 0}),
                    ontimeout: () => resolve({status: 0}),
                }, base));
                return;
            }
            const {headers, data} = corps(spec);
            GMX(Object.assign({
                method: "POST", url: spec.url + "?wait=true", headers, data,
                onload: r => resolve({status: r.status, retryAfter: r.status === 429 ? retrait(r) : 0}),
                onerror: () => resolve({status: 0}),
                ontimeout: () => resolve({status: 0}),
            }, base));
        });
    }

    /* Demandes déjà traitées par cet onglet mais qu'on n'a pas pu retirer de la file (mémoire pleine) :
       on garde leur résultat pour ne jamais les renvoyer à Discord une deuxième fois. */
    const dejaTraitees = new Map();

    function rangerReponse(id, res) {
        const lu = lire(RES);
        const reps = lu && typeof lu === "object" && !Array.isArray(lu) ? lu : {};
        reps[id] = res;
        const ids = Object.keys(reps);                   // borne la table des réponses (si « Album » n'est pas là pour les lire)
        if (ids.length > 50) for (const k of ids.slice(0, ids.length - 50)) delete reps[k];
        ecrire(RES, reps);
        // réveille Album dans cet onglet (les autres onglets le sont par l'événement « storage »)
        try { document.dispatchEvent(new CustomEvent("wpx-pont-reponse")); } catch (e) { /* Album relira de lui-même */ }
    }

    /* La file : seules les demandes bien formées sont traitées ; les autres sont retirées sans bruit, jamais laissées en
       tête (une demande mal formée ne doit pas bloquer les suivantes, ni faire tourner la boucle à vide). */
    async function boucle() {
        for (;;) {
            const file = lire(REQ);
            if (!Array.isArray(file) || !file.length) return;
            const brut = file[0];
            const signature = JSON.stringify(brut);      // identifie cette demande-là, quelle que soit sa forme
            const id = brut && typeof brut === "object" && !Array.isArray(brut) && typeof brut.id === "string" ? brut.id : null;

            let res = dejaTraitees.get(signature);
            if (!res) {
                const spec = signature.length > TAILLE_MAX.demande ? null : verifier(brut);
                if (!spec) res = {status: 400};
                else {
                    try { res = await envoyer(spec); }
                    catch (e) { res = {status: 0}; }
                }
            }

            // retirer cette demande-là, et elle seule (même si d'autres sont arrivées entre-temps)
            const actuelle = lire(REQ);
            const reste = Array.isArray(actuelle) ? actuelle : [];
            const i = reste.findIndex(x => JSON.stringify(x) === signature);
            if (i >= 0) {
                reste.splice(i, 1);
                if (!ecrire(REQ, reste)) {               // impossible de la retirer : la noter pour ne pas la renvoyer, et s'arrêter
                    dejaTraitees.set(signature, res);
                    if (dejaTraitees.size > 50) dejaTraitees.delete(dejaTraitees.keys().next().value);
                    return;
                }
            }
            dejaTraitees.delete(signature);

            if (id !== null) rangerReponse(id, res);

            // Discord demande d'attendre : on attend avant la demande suivante, sinon elle prend aussi un 429
            if (res.status === 429) await attendre(Math.min(res.retryAfter || 2250, PAUSE_MAX_429));
        }
    }

    /* un seul pont à la fois sur tous les onglets : sinon deux onglets envoient la même demande et consomment deux fois le quota */
    let occupe = false;
    async function tourner() {
        if (occupe) return;
        occupe = true;
        try {
            if (navigator.locks) await navigator.locks.request("wpx-pont", {ifAvailable: true}, verrou => (verrou ? boucle() : null));
            else await boucle();
        } catch (e) { /* une erreur du pont ne doit jamais remonter dans la page */ }
        finally { occupe = false; }
    }

    document.addEventListener("wpx-pont-demande", tourner);                // Album vient de déposer une demande : tout de suite
    addEventListener("storage", e => { if (e.key === REQ) tourner(); });   // autres onglets : réveil immédiat
    setInterval(tourner, 200);                           // en secours (un Album sans l'événement) : un coup d'œil, rien de plus
    tourner();
})();
