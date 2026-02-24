# Spam Etherscan Extension - Status Plan

## Goal
Filter explorer spam by:
- Whitelisting token transfers by token contract address
- Hiding inbound ETH dust transfers below `0.000001 ETH`
- Supporting Etherscan-family explorers and address transaction tabs (`#tokentx*`)

## What has been done so far

### 1) Initial extension scaffold
- Created MV3 extension with:
  - `manifest.json`
  - `content.js`
  - popup UI files (`popup.html`, `popup.css`, `popup.js`)
- Early version supported configurable filters (value threshold + token allowlist by symbol).

### 2) Shifted to non-configurable whitelist-only behavior
- Removed user-config logic as requested.
- Changed filtering to token contract whitelist only.
- Scoped to address pages (`/address/*`).
- Added baseline whitelist:
  - Ethereum USDT and USDC.

### 3) Expanded explorer-family support
- Added matches for multiple scanner families:
  - `etherscan.io`, `arbiscan.io`, `basescan.org`, `bscscan.com`, `polygonscan.com`, `snowtrace.io`, `ftmscan.com`, `blastscan.io`, `scrollscan.com`, `lineascan.build`
- Added chain-specific token allowlists in `content.js`.

### 4) Attempted fix for `#tokentx*` tabs
- Enabled `all_frames: true` in `manifest.json`.
- Added support for iframe tab endpoints (e.g. `/tokentxns`, `/tokentx`, etc. with `?a=0x...`).

### 5) Added ETH dust filter
- Added rule to hide inbound rows where parsed ETH value `< 0.000001`.
- Direction is identified from IN badge/text.

### 6) Hardening pass after user-provided table HTML
- Improved token address extraction from links shaped like:
  - `/token/<tokenAddress>?a=<walletAddress>`
- Strengthened row hiding using both:
  - `row.hidden = true`
  - `display: none !important`
- Relaxed page-context checks for iframe tab routes.

## Current issue
Filtering is still not reliably hiding rows on the user’s `#tokentx*` flow, despite rows containing non-whitelisted token contracts.

## Known evidence from user HTML
- Rows include token links in the form:
  - `/token/0xe75ae445601fcb52fb8c167b6a4131d54d37e377?a=...`
- Those rows should be hidden by whitelist logic but are still visible.

## Most likely causes
1. Extension runtime cache / stale content script not refreshed in browser.
2. Script executing in a different frame than the table that renders rows.
3. Row table is re-rendered after filtering, and observer misses a specific mutation pattern.
4. Endpoint/path context differs from assumptions in current route checks.

## Next debug plan (concrete)
1. Add temporary runtime diagnostics in `content.js`:
   - `console.info` for hostname/path/frame status
   - number of candidate rows seen
   - token address extracted per first N rows
   - hide decision reason per row
2. Verify exact frame URL containing the rendered `tbody` and ensure script runs there.
3. Add fallback selector path specifically for Etherscan token-transfer table containers if generic `table tbody tr` is not sufficient in some states.
4. Force re-apply filter on a small interval (short-lived, debug mode only) to confirm race/re-render issue.
5. Once validated, remove debug noise and keep only robust logic.

## User action needed before next debug pass
- In `chrome://extensions`, refresh this extension.
- Reload the target page with hard refresh.
- If still failing, capture:
  - Console logs from frame containing the token table
  - Exact frame URL and one visible row token link value

## Relevant files
- `manifest.json`
- `content.js`
- `README.md`
- `plan.md` (this file)
