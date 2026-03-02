(() => {
  const HIDDEN_ATTR = "data-spam-filter-hidden";
  // Only intended to hide "dust" ETH transfers (not 0 ETH contract calls).
  const INBOUND_ETH_DUST_THRESHOLD = 0.000001;
  const MIN_USD_TX_VALUE = 0.1;
  const BANNER_ID = "spam-etherscan-banner";
  const DEBUG = (() => {
    try {
      return localStorage.getItem("spam-etherscan-debug") === "1";
    } catch {
      return false;
    }
  })();

  const DOMAIN_ALLOWLISTS = [
    {
      hostPattern: /(^|\.)etherscan\.io$/i,
      tokens: [
        "0xdac17f958d2ee523a2206206994597c13d831ec7", // Ethereum USDT
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // Ethereum USDC
      ],
    },
    {
      hostPattern: /(^|\.)arbiscan\.io$/i,
      tokens: [
        "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // Arbitrum USDT
        "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // Arbitrum USDC
        "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // Arbitrum USDC.e
      ],
    },
    {
      hostPattern: /(^|\.)basescan\.org$/i,
      tokens: [
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Base USDC
        "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", // Base USDT
      ],
    },
    {
      hostPattern: /(^|\.)bscscan\.com$/i,
      tokens: [
        "0x55d398326f99059ff775485246999027b3197955", // BSC USDT
        "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // BSC USDC
      ],
    },
    {
      hostPattern: /(^|\.)polygonscan\.com$/i,
      tokens: [
        "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // Polygon USDT
        "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // Polygon USDC
      ],
    },
    {
      hostPattern: /(^|\.)optimistic\.etherscan\.io$/i,
      tokens: [
        "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // OP Mainnet USDT
        "0x0b2c639c533813f4aa9d7837caf62653d097ff85", // OP Mainnet USDC
      ],
    },
    {
      hostPattern: /(^|\.)snowtrace\.io$/i,
      tokens: [
        "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", // Avalanche USDT
        "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", // Avalanche USDC
      ],
    },
    {
      hostPattern: /(^|\.)ftmscan\.com$/i,
      tokens: [
        "0x049d68029688eabf473097a2fc38ef61633a3c7a", // Fantom USDT
        "0x04068da6c83afcfa0e13ba15a6696662335d5b75", // Fantom USDC
      ],
    },
    {
      hostPattern: /(^|\.)blastscan\.io$/i,
      tokens: [
        "0x4300000000000000000000000000000000000003", // Blast USDB (stable)
      ],
    },
    {
      hostPattern: /(^|\.)lineascan\.build$/i,
      tokens: [
        "0x176211869ca2b568f2a7d4ee941e073a821ee1ff", // Linea USDC
        "0xa219439258ca9da29e9cc4ce5596924745e12b93", // Linea USDT
      ],
    },
    {
      hostPattern: /(^|\.)scrollscan\.com$/i,
      tokens: [
        "0xf55bec9cafdbe8730f096aa55dad6d22d44099df", // Scroll USDT
        "0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4", // Scroll USDC
      ],
    },
  ];

  function normalizeAddress(address) {
    return String(address || "").trim().toLowerCase();
  }

  function getAllowlistForHost(hostname) {
    for (const entry of DOMAIN_ALLOWLISTS) {
      if (entry.hostPattern.test(hostname)) {
        return new Set(entry.tokens.map(normalizeAddress));
      }
    }

    return new Set();
  }

  function isAddressLikeParam(value) {
    return /^0x[a-fA-F0-9]{40}$/.test(String(value || ""));
  }

  function isSupportedHost(hostname) {
    return DOMAIN_ALLOWLISTS.some((entry) => entry.hostPattern.test(hostname));
  }

  function isSupportedPageContext() {
    if (location.pathname.startsWith("/address/")) return true;

    const params = new URLSearchParams(location.search);
    const a = params.get("a") || "";
    const hasAddressParam = isAddressLikeParam(a);
    const isTxnLikePath = /^\/(tokentxns|tokentx|txs|txlistinternal|tokennfttxns|token1155txns)/i.test(location.pathname);

    if (hasAddressParam && isTxnLikePath) return true;

    return false;
  }

  if (!isSupportedHost(location.hostname) || !isSupportedPageContext()) {
    return;
  }

  const tokenAddressAllowlist = getAllowlistForHost(location.hostname);
  let filteringEnabled = true;
  let bannerDismissed = false;

  function logDebug(...args) {
    if (!DEBUG) return;
    // eslint-disable-next-line no-console
    console.info("[spam-etherscan]", ...args);
  }

  function unhideAllRows() {
    const rows = Array.from(document.querySelectorAll(`tr[${HIDDEN_ATTR}="1"]`));
    for (const row of rows) {
      row.removeAttribute(HIDDEN_ATTR);
      row.hidden = false;
      row.style.removeProperty("display");
    }
  }

  function setFilteringEnabled(enabled) {
    filteringEnabled = Boolean(enabled);
    if (!filteringEnabled) {
      unhideAllRows();
    }

    const banner = document.getElementById(BANNER_ID);
    if (banner) {
      updateBannerContents(banner);
    }
  }

  function createIconElement() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 128 128");
    svg.setAttribute("width", "18");
    svg.setAttribute("height", "18");
    svg.style.flex = "0 0 auto";
    svg.style.marginTop = "2px";
    svg.innerHTML = '<g transform="translate(2.8, 0.6) scale(1.02)">'
      + '<path d="m25.79 58.415a5.157 5.157 0 0 1 5.181-5.156l8.59.028a5.164 5.164 0 0 1 5.164 5.164v32.48c.967-.287 2.209-.593 3.568-.913a4.3 4.3 0 0 0 3.317-4.187v-40.291a5.165 5.165 0 0 1 5.164-5.165h8.607a5.165 5.165 0 0 1 5.164 5.165v37.393s2.155-.872 4.254-1.758a4.311 4.311 0 0 0 2.632-3.967v-44.578a5.164 5.164 0 0 1 5.163-5.164h8.606a5.164 5.164 0 0 1 5.164 5.164v36.71c7.462-5.408 15.024-11.912 21.025-19.733a8.662 8.662 0 0 0 1.319-8.092 60.792 60.792 0 0 0-58.141-40.829 60.788 60.788 0 0 0-51.99 91.064 7.688 7.688 0 0 0 7.334 3.8c1.628-.143 3.655-.346 6.065-.63a4.3 4.3 0 0 0 3.815-4.268z" fill="#21325b"/>'
      + '<path d="m25.602 110.51a60.813 60.813 0 0 0 63.371 5.013 60.815 60.815 0 0 0 33.212-54.203c0-1.4-.065-2.785-.158-4.162-22.219 33.138-63.244 48.63-96.423 53.347" fill="#10B981"/>'
      + '</g>'
      + '<g>'
      + '<path d="M98 76 L120 86 V100 C120 112 110 120 98 126 C86 120 76 112 76 100 V86 Z" fill="#21325b"/>'
      + '<path d="M98 76 L76 86 V100 C76 112 86 120 98 126 V76Z" fill="#FFFFFF" opacity="0.08"/>'
      + '<polyline points="87,99 95,107 110,92" stroke="#10B981" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
      + '</g>';
    return svg;
  }

  function updateBannerContents(root) {
    const title = root.querySelector("[data-spam-banner-title]");
    const subtitle = root.querySelector("[data-spam-banner-subtitle]");
    const toggleBtn = root.querySelector("[data-spam-banner-toggle]");
    if (!(title instanceof HTMLElement) || !(subtitle instanceof HTMLElement) || !(toggleBtn instanceof HTMLButtonElement)) {
      return;
    }

    if (filteringEnabled) {
      root.classList.remove("alert-warning");
      root.classList.add("alert-info");
      title.textContent = "Spam Filter active";
      subtitle.textContent = "Hiding low-value + non-allowlisted transfers.";
      toggleBtn.textContent = "Disable for this page";
      toggleBtn.setAttribute("aria-label", "Disable filtering for this page load");
    } else {
      root.classList.remove("alert-info");
      root.classList.add("alert-warning");
      title.textContent = "Spam Filter disabled (this page)";
      subtitle.textContent = "Showing all transfers until you re-enable or refresh.";
      toggleBtn.textContent = "Re-enable filtering";
      toggleBtn.setAttribute("aria-label", "Re-enable filtering for this page load");
    }
  }

  function ensureBanner() {
    if (!document.body) return;
    if (bannerDismissed) return;
    if (document.getElementById(BANNER_ID)) return;

    const root = document.createElement("div");
    root.id = BANNER_ID;
    root.setAttribute("role", "status");
    root.className = "alert alert-info d-flex justify-content-between align-items-start gap-2";
    root.style.marginTop = "0.75rem";
    root.style.marginBottom = "1.25rem";

    const left = document.createElement("div");
    left.style.display = "flex";
    left.style.alignItems = "flex-start";
    left.style.gap = "10px";
    left.style.minWidth = "0";

    left.appendChild(createIconElement());

    const copy = document.createElement("div");
    copy.style.minWidth = "0";

    const title = document.createElement("div");
    title.style.fontWeight = "600";
    title.setAttribute("data-spam-banner-title", "1");

    const subtitle = document.createElement("div");
    subtitle.className = "small";
    subtitle.style.opacity = "0.85";
    subtitle.setAttribute("data-spam-banner-subtitle", "1");

    copy.append(title, subtitle);
    left.appendChild(copy);

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.alignItems = "center";
    actions.style.gap = "8px";
    actions.style.flex = "0 0 auto";

    const toggleBtn = document.createElement("button");
    toggleBtn.type = "button";
    toggleBtn.className = "btn btn-sm btn-outline-secondary";
    toggleBtn.setAttribute("data-spam-banner-toggle", "1");
    toggleBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      setFilteringEnabled(!filteringEnabled);
      if (filteringEnabled) {
        // Re-apply immediately when turning back on.
        applyFilter();
      }
    });

    const hideBtn = document.createElement("button");
    hideBtn.type = "button";
    hideBtn.className = "btn btn-sm btn-link text-decoration-none";
    hideBtn.textContent = "Hide banner";
    hideBtn.setAttribute("aria-label", "Hide this banner for this page load");
    hideBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      bannerDismissed = true;
      root.remove();
    });

    actions.append(toggleBtn, hideBtn);
    root.append(left, actions);

    const findInsertTarget = () => {
      const byId =
        document.getElementById("ContentPlaceHolder1_divSummary") ||
        document.getElementById("ContentPlaceHolder1_divmain") ||
        document.querySelector("#content") ||
        document.querySelector("main");
      if (byId) return byId;

      const h1 = document.querySelector("h1");
      if (h1?.parentElement) return h1.parentElement;

      return document.body;
    };

    updateBannerContents(root);

    const target = findInsertTarget();
    if (target === document.body) {
      document.body.insertBefore(root, document.body.firstChild);
    } else {
      target.insertBefore(root, target.firstChild);
    }
  }

  function extractTokenAddressFromRow(row) {
    const links = Array.from(row.querySelectorAll("a[href]"));

    for (const link of links) {
      const rawHref = link.getAttribute("href") || "";
      const href = rawHref.trim();
      const tokenPathMatch = href.match(/\/token\/(0x[a-fA-F0-9]{40})/i);
      if (tokenPathMatch) {
        return normalizeAddress(tokenPathMatch[1]);
      }

      try {
        const url = new URL(href, location.origin);
        const fromPath = url.pathname.match(/\/token\/(0x[a-fA-F0-9]{40})/i);
        if (fromPath) return normalizeAddress(fromPath[1]);

        const paramA = url.searchParams.get("a");
        if (paramA && isAddressLikeParam(paramA) && url.pathname.startsWith("/token/")) {
          const tokenInPath = url.pathname.match(/\/token\/(0x[a-fA-F0-9]{40})/i);
          if (tokenInPath) return normalizeAddress(tokenInPath[1]);
        }
      } catch {
        // ignore malformed URLs from javascript: links
      }
    }

    const html = row.innerHTML || "";
    const htmlTokenMatch = html.match(/\/token\/(0x[a-fA-F0-9]{40})/i);
    if (htmlTokenMatch) {
      return normalizeAddress(htmlTokenMatch[1]);
    }

    return null;
  }

  function isInboundRow(row) {
    const directionBadges = Array.from(row.querySelectorAll(".badge"));
    for (const badge of directionBadges) {
      const label = (badge.textContent || "").trim().toUpperCase();
      if (label === "IN") {
        return true;
      }
    }

    const text = (row.textContent || "").replace(/\s+/g, " ").toUpperCase();
    return /\bIN\b/.test(text);
  }

  function parseEthValueFromRow(row) {
    const cells = Array.from(row.querySelectorAll("td"));

    for (const cell of cells) {
      const text = (cell.textContent || "").replace(/,/g, "").trim();
      const ethMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*(ETH|ETHER)\b/i);
      if (ethMatch) {
        const value = Number(ethMatch[1]);
        if (Number.isFinite(value)) return value;
      }
    }

    return null;
  }

  function parseUsdValueFromRow(row) {
    const cells = Array.from(row.querySelectorAll("td"));
    const matches = [];

    for (const cell of cells) {
      const text = (cell.textContent || "").replace(/\s+/g, " ").trim();
      for (const match of text.matchAll(/\$\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]+)?|[0-9]+(?:\.[0-9]+)?)/g)) {
        const value = Number(String(match[1]).replace(/,/g, ""));
        if (Number.isFinite(value)) matches.push(value);
      }
    }

    if (matches.length === 0) return null;
    // Prefer the last $ value in the row; on Etherscan-family tables this is usually the tx value.
    return matches[matches.length - 1];
  }

  function shouldHideForTokenAllowlist(tokenAddress) {
    if (!tokenAddress) {
      return false;
    }

    if (tokenAddressAllowlist.size === 0) {
      return false;
    }

    return !tokenAddressAllowlist.has(tokenAddress);
  }

  function shouldHideForInboundEthDust(row) {
    const value = parseEthValueFromRow(row);
    if (value === null) {
      return false;
    }

    if (!isInboundRow(row)) {
      return false;
    }

    // Avoid hiding 0 ETH "contract call" rows; only hide non-zero dust.
    return value > 0 && value < INBOUND_ETH_DUST_THRESHOLD;
  }

  function shouldHideForMinUsdValue(row) {
    const usd = parseUsdValueFromRow(row);
    if (usd === null) return false;
    return usd < MIN_USD_TX_VALUE;
  }

  function shouldHideRow(row) {
    // Token-only rules (allowlist + min USD) should never affect the normal tx list.
    const tokenAddress = extractTokenAddressFromRow(row);
    if (tokenAddress) {
      if (shouldHideForTokenAllowlist(tokenAddress)) return true;
      if (shouldHideForMinUsdValue(row)) return true;
    }

    if (shouldHideForInboundEthDust(row)) {
      return true;
    }

    return false;
  }

  function updateRowVisibility(row) {
    const hide = shouldHideRow(row);

    if (hide) {
      row.setAttribute(HIDDEN_ATTR, "1");
      row.hidden = true;
      row.style.setProperty("display", "none", "important");
      return;
    }

    if (row.getAttribute(HIDDEN_ATTR) === "1") {
      row.removeAttribute(HIDDEN_ATTR);
      row.hidden = false;
      row.style.removeProperty("display");
    }
  }

  function getCandidateRows() {
    // Etherscan-family pages often contain multiple tables (headers, ads, widgets).
    // Only consider rows that look like token-transfer rows (i.e. contain a /token/0x… link).
    const seen = new Set();
    const candidates = [];

    const tables = Array.from(document.querySelectorAll("table"));
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll("tbody tr"));
      for (const row of rows) {
        if (seen.has(row)) continue;
        seen.add(row);

        if (row.querySelectorAll("td").length < 3) continue;

        // Fast-path: most token-transfer rows include at least one token link.
        const hasTokenLink = Boolean(row.querySelector("a[href*=\"/token/0x\"]"));
        if (!hasTokenLink) continue;

        candidates.push(row);
      }
    }

    if (candidates.length > 0) {
      return candidates;
    }

    // Fallback (older layouts / unexpected markup).
    const rows = Array.from(document.querySelectorAll("table tbody tr"));
    return rows.filter((row) => row.querySelectorAll("td").length >= 3);
  }

  function getRowsFromSameOriginIframes() {
    // Some tabs on /address/* (e.g. #tokentxns) lazy-load their table into a same-origin iframe.
    const rows = [];
    const iframes = Array.from(document.querySelectorAll("iframe"));

    for (const iframe of iframes) {
      let doc;
      try {
        doc = iframe.contentDocument;
      } catch {
        continue;
      }
      if (!doc) continue;

      try {
        const frameRows = Array.from(doc.querySelectorAll("table tbody tr"));
        for (const row of frameRows) rows.push(row);
      } catch {
        // ignore frames with strange documents
      }
    }

    return rows;
  }

  function applyFilter() {
    if (!filteringEnabled) return;
    const rows = getCandidateRows();
    const iframeRows = getRowsFromSameOriginIframes();

    // Prefer filtering within the iframe if it contains token-transfer style rows.
    const iframeTokenRows = iframeRows.filter((row) => row.querySelectorAll("td").length >= 3 && row.querySelector("a[href*=\"/token/0x\"]"));
    const mainTokenRows = rows.filter((row) => row.querySelector("a[href*=\"/token/0x\"]"));
    const targetRows = iframeTokenRows.length > 0 ? iframeTokenRows : mainTokenRows.length > 0 ? mainTokenRows : rows;

    logDebug("applyFilter", {
      url: location.href,
      frame: window === window.top ? "top" : "subframe",
      candidates: targetRows.length,
      iframeCandidates: iframeTokenRows.length,
    });

    for (const row of targetRows) {
      updateRowVisibility(row);
    }
  }

  function setupObserver() {
    if (!document.body) return;

    let rafId = 0;
    const observer = new MutationObserver(() => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        try {
          applyFilter();
        } catch (err) {
          // Never let an unexpected DOM edge-case permanently stop filtering.
          // eslint-disable-next-line no-console
          console.warn("[spam-etherscan] applyFilter error", err);
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function init() {
    if (!document.body) {
      // Some frames can momentarily have no <body>; retry shortly.
      setTimeout(init, 50);
      return;
    }

    const safeApply = () => {
      try {
        if (window === window.top) {
          ensureBanner();
        }
        applyFilter();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[spam-etherscan] applyFilter error", err);
      }
    };

    window.addEventListener("hashchange", safeApply);
    window.addEventListener("load", safeApply);

    // Initial pass + a couple of retries for late-rendered tables.
    safeApply();
    setTimeout(safeApply, 500);
    setTimeout(safeApply, 1500);

    setupObserver();
  }

  init();
})();
