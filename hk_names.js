/* hk_names.js - show company names instead of HK stock codes (2026-11-16)
   ---------------------------------------------------------------------
   Lookahead / Tracker render tickers like "0700.HK". This swaps every such
   code in the page TEXT for the company's short name (from public_data.json,
   Yahoo's name), e.g. "0700.HK" -> "TENCENT". The code is kept as a hover
   tooltip so you can still find it in your broker.
   Display only: sorting, links, uploads and data files are untouched.
   Set window.HK_SHOW_CODES = true (or add ?codes=1 to the URL) to switch off. */
(function () {
  if (window.HK_SHOW_CODES || /[?&]codes=1\b/.test(location.search)) return;
  const RX = /\b\d{4,5}\.HK\b/g;
  const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "SELECT", "OPTION", "CODE"]);
  let NAMES = null;

  function clean(n, code) {
    if (!n) return null;
    n = String(n).trim()
      .replace(/-(W|SW|S|B|R|H|P|WR|SWR)$/i, "")   // HKEX share-class suffixes
      .replace(/\s+(HOLDINGS?|GROUP|COMPANY|CO\.?|LIMITED|LTD\.?|INC\.?)$/i, "")
      .replace(/\s+/g, " ");
    if (!n || n.toUpperCase() === code.toUpperCase()) return null;
    return n.length > 22 ? n.slice(0, 21) + "…" : n;
  }

  function swapIn(root) {
    if (!NAMES || !root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const p = n.parentNode;
        if (!p || SKIP.has(p.nodeName) || p.closest && p.closest("[data-hk-name]")) return NodeFilter.FILTER_REJECT;
        RX.lastIndex = 0;
        return RX.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const txt = node.nodeValue, frag = document.createDocumentFragment();
      let last = 0, m, changed = false;
      RX.lastIndex = 0;
      while ((m = RX.exec(txt))) {
        const code = m[0], name = NAMES[code];
        if (!name) continue;
        frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
        const s = document.createElement("span");
        s.textContent = name;
        s.title = code;
        s.dataset.hkName = code;
        frag.appendChild(s);
        last = m.index + code.length;
        changed = true;
      }
      if (!changed) continue;
      frag.appendChild(document.createTextNode(txt.slice(last)));
      node.parentNode.replaceChild(frag, node);
    }
  }

  let pending = false;
  const obs = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; obs.disconnect(); swapIn(document.body); watch(); });
  });
  const watch = () => obs.observe(document.body, { childList: true, subtree: true, characterData: true });

  fetch("public_data.json?v=" + Date.now(), { cache: "no-store" })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d) return;
      NAMES = {};
      for (const t of d.all_tickers || []) {
        const n = clean(t.company, String(t.ticker || ""));
        if (t.ticker && n) NAMES[t.ticker] = n;
      }
      const go = () => { swapIn(document.body); watch(); };
      document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", go) : go();
    })
    .catch(e => console.warn("hk_names.js: names not loaded", e));
})();
