import { getBrandInitials } from './branding.js';

export const A2HS_STORAGE_KEY = 'carboyz:a2hsDismissed';

const IOS_UA_PATTERN = /iphone|ipad|ipod/i;
const IOS_SAFARI_UA_PATTERN = /safari/i;
const IOS_OTHER_BROWSER_UA_PATTERN = /crios|fxios|edgios/i;
const ANDROID_UA_PATTERN = /android/i;
const CHROME_UA_PATTERN = /chrome/i;

export function detectA2hsPlatform({ userAgent = '', standalone = false } = {}) {
  if (standalone) {
    return 'unsupported';
  }
  if (
    IOS_UA_PATTERN.test(userAgent) &&
    IOS_SAFARI_UA_PATTERN.test(userAgent) &&
    !IOS_OTHER_BROWSER_UA_PATTERN.test(userAgent)
  ) {
    return 'ios-safari';
  }
  if (ANDROID_UA_PATTERN.test(userAgent) && CHROME_UA_PATTERN.test(userAgent)) {
    return 'android-chrome';
  }
  return 'unsupported';
}

export function buildA2hsCopy(platform, tenantConfig) {
  if (platform === 'ios-safari') {
    return {
      title: `Add ${tenantConfig.name} to your Home Screen`,
      steps: ["Tap the Share icon", "Scroll down and tap 'Add to Home Screen'", "Tap 'Add' to confirm"],
    };
  }
  if (platform === 'android-chrome') {
    return {
      title: `Add ${tenantConfig.name} to your Home Screen`,
      steps: ["Tap the menu (⋮)", "Tap 'Add to Home screen' / 'Install app'", "Tap 'Add' to confirm"],
    };
  }
  return null;
}

export function shouldShowA2hsPrompt({ platform, dismissed }) {
  return platform !== 'unsupported' && !dismissed;
}

export function readA2hsDismissed(storage) {
  try {
    return storage?.getItem?.(A2HS_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeA2hsDismissed(storage) {
  try {
    storage?.setItem?.(A2HS_STORAGE_KEY, 'true');
  } catch {
    // Storage may be unavailable (private browsing, quota exceeded) — the drawer just
    // reappears next session instead of staying dismissed, which is an acceptable fallback.
  }
}

export function renderPwaInstallPromptView({ tenantConfig, window = globalThis, storage = window?.localStorage } = {}) {
  const userAgent = window?.navigator?.userAgent ?? '';
  const standalone =
    Boolean(window?.matchMedia?.('(display-mode: standalone)')?.matches) ||
    Boolean(window?.navigator?.standalone);

  const platform = detectA2hsPlatform({ userAgent, standalone });
  const dismissed = readA2hsDismissed(storage);

  if (!shouldShowA2hsPrompt({ platform, dismissed })) {
    return null;
  }

  const copy = buildA2hsCopy(platform, tenantConfig);

  const logo = tenantConfig.logoUrl
    ? (() => {
        const img = document.createElement('img');
        img.className = 'a2hs-drawer__logo';
        img.src = tenantConfig.logoUrl;
        img.alt = `${tenantConfig.name} logo`;
        return img;
      })()
    : (() => {
        const span = document.createElement('span');
        span.className = 'a2hs-drawer__logo a2hs-drawer__logo--fallback';
        span.textContent = getBrandInitials(tenantConfig.name);
        return span;
      })();

  const title = document.createElement('p');
  title.className = 'a2hs-drawer__title';
  title.textContent = copy.title;

  const list = document.createElement('ol');
  list.className = 'a2hs-drawer__steps';
  copy.steps.forEach((step) => {
    const item = document.createElement('li');
    item.textContent = step;
    list.appendChild(item);
  });

  const dismissBtn = document.createElement('button');
  dismissBtn.type = 'button';
  dismissBtn.className = 'a2hs-drawer__dismiss';
  dismissBtn.textContent = 'Dismiss';

  const el = document.createElement('div');
  el.className = 'a2hs-drawer';
  el.setAttribute('role', 'complementary');
  el.append(logo, title, list, dismissBtn);

  function dismiss() {
    writeA2hsDismissed(storage);
    el.remove();
  }
  dismissBtn.addEventListener('click', dismiss);

  return { el, dismiss };
}
