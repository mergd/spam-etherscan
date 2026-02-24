# spam-etherscan (Chrome extension)

Chrome extension that filters spam-like transfers on Etherscan-family explorers.

## Behavior

- Runs in address views and address-tab iframe endpoints (like `#tokentxns` / `#tokentx`)
- Hides token transfers unless token contract address is in chain-specific allowlist
- Hides inbound ETH transfers below `0.000001 ETH`
- No user configuration

## Supported explorer families

- `etherscan.io` (includes `*.etherscan.io` like `optimistic.etherscan.io`)
- `arbiscan.io`
- `basescan.org`
- `bscscan.com`
- `polygonscan.com`
- `snowtrace.io`
- `ftmscan.com`
- `blastscan.io`
- `scrollscan.com`
- `lineascan.build`

## Install locally

1. Open Chrome and go to `chrome://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `/Users/william/dev/spam-etherscan`
5. Click refresh on the extension after code changes
