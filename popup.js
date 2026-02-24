const STORAGE_KEY = "spamEtherscanFilterSettings";

const DEFAULT_SETTINGS = {
  minUsdEnabled: true,
  minUsdValue: 0.5,
  allowlistOnlyEnabled: false,
  allowlist: ["USDT", "USDC"],
};

const minUsdEnabledEl = document.getElementById("minUsdEnabled");
const minUsdValueEl = document.getElementById("minUsdValue");
const allowlistOnlyEnabledEl = document.getElementById("allowlistOnlyEnabled");
const allowlistInputEl = document.getElementById("allowlistInput");
const saveButtonEl = document.getElementById("saveButton");
const statusEl = document.getElementById("status");

function normalizeToken(token) {
  return String(token || "")
    .trim()
    .toUpperCase();
}

function parseAllowlistInput(input) {
  const parsed = input
    .split(",")
    .map(normalizeToken)
    .filter(Boolean);

  return [...new Set(parsed)];
}

function showStatus(message) {
  statusEl.textContent = message;
  setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = "";
    }
  }, 1500);
}

async function load() {
  const stored = await chrome.storage.sync.get([STORAGE_KEY]);
  const settings = { ...DEFAULT_SETTINGS, ...(stored[STORAGE_KEY] || {}) };

  minUsdEnabledEl.checked = settings.minUsdEnabled !== false;
  minUsdValueEl.value = String(Number(settings.minUsdValue) || DEFAULT_SETTINGS.minUsdValue);
  allowlistOnlyEnabledEl.checked = settings.allowlistOnlyEnabled === true;
  allowlistInputEl.value = (Array.isArray(settings.allowlist) && settings.allowlist.length > 0
    ? settings.allowlist
    : DEFAULT_SETTINGS.allowlist
  ).join(",");
}

async function save() {
  const minUsdValue = Number(minUsdValueEl.value);

  const settings = {
    minUsdEnabled: minUsdEnabledEl.checked,
    minUsdValue: Number.isFinite(minUsdValue) && minUsdValue >= 0 ? minUsdValue : DEFAULT_SETTINGS.minUsdValue,
    allowlistOnlyEnabled: allowlistOnlyEnabledEl.checked,
    allowlist: (() => {
      const list = parseAllowlistInput(allowlistInputEl.value);
      return list.length > 0 ? list : DEFAULT_SETTINGS.allowlist;
    })(),
  };

  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
  showStatus("Saved");
}

saveButtonEl.addEventListener("click", save);
load();
