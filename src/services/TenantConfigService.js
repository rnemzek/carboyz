import { applyTenantTheme } from '../ui/theme.js';

const DEFAULT_THEME_COLOR = '#0057d9';
const DEFAULT_BACKGROUND_COLOR = '#ffffff';

export function buildManifestObject(tenantConfig) {
  const icons = [];
  if (tenantConfig.iconSet?.manifestIcon192) {
    icons.push({ src: tenantConfig.iconSet.manifestIcon192, sizes: '192x192', type: 'image/png' });
  }
  if (tenantConfig.iconSet?.manifestIcon512) {
    icons.push({ src: tenantConfig.iconSet.manifestIcon512, sizes: '512x512', type: 'image/png' });
  }

  return {
    name: tenantConfig.name,
    short_name: tenantConfig.name,
    description: tenantConfig.tagline || '',
    start_url: '/',
    display: 'standalone',
    background_color: tenantConfig.themeColors?.background || DEFAULT_BACKGROUND_COLOR,
    theme_color: tenantConfig.themeColors?.primary || DEFAULT_THEME_COLOR,
    icons,
  };
}

function defaultCreateManifestUrl(manifestObject) {
  const blob = new Blob([JSON.stringify(manifestObject)], { type: 'application/manifest+json' });
  return URL.createObjectURL(blob);
}

function defaultRevokeManifestUrl(url) {
  URL.revokeObjectURL(url);
}

function upsertMetaTag(doc, name, content) {
  let tag = doc.head.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = doc.createElement('meta');
    tag.setAttribute('name', name);
    doc.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertLinkTag(doc, { rel, sizes, href }) {
  const selector = sizes ? `link[rel="${rel}"][sizes="${sizes}"]` : `link[rel="${rel}"]`;
  let tag = doc.head.querySelector(selector);
  if (!tag) {
    tag = doc.createElement('link');
    tag.setAttribute('rel', rel);
    if (sizes) {
      tag.setAttribute('sizes', sizes);
    }
    doc.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
}

function defaultDocument() {
  return typeof document !== 'undefined' ? document : null;
}

function defaultNavigator() {
  return typeof navigator !== 'undefined' ? navigator : null;
}

export class TenantConfigService {
  constructor({
    document = defaultDocument(),
    navigator = defaultNavigator(),
    createManifestUrl = defaultCreateManifestUrl,
    revokeManifestUrl = defaultRevokeManifestUrl,
  } = {}) {
    this.document = document;
    this.navigator = navigator;
    this.createManifestUrl = createManifestUrl;
    this.revokeManifestUrl = revokeManifestUrl;
    this.lastManifestUrl = null;
  }

  /**
   * Registers the offline-caching / background-sync service worker. Swallows registration
   * failures (unsupported browser, disallowed scope on the host) so PWA install/offline support
   * degrades gracefully instead of breaking the rest of the app — same precedent as
   * PwaInstallPromptView's feature detection.
   */
  registerServiceWorker(swUrl = '/src/sw.js') {
    const register = this.navigator?.serviceWorker?.register;
    if (typeof register !== 'function') {
      return null;
    }
    return register.call(this.navigator.serviceWorker, swUrl, { type: 'module', scope: '/' }).catch(() => null);
  }

  applyTenant(tenantConfig) {
    if (!this.document) {
      return;
    }

    applyTenantTheme(tenantConfig, this.document.documentElement);
    this.document.title = tenantConfig.name;

    upsertMetaTag(this.document, 'theme-color', tenantConfig.themeColors?.primary || DEFAULT_THEME_COLOR);

    if (tenantConfig.iconSet?.appleTouchIcon) {
      upsertLinkTag(this.document, { rel: 'apple-touch-icon', href: tenantConfig.iconSet.appleTouchIcon });
    }
    if (tenantConfig.iconSet?.manifestIcon192) {
      upsertLinkTag(this.document, { rel: 'icon', sizes: '192x192', href: tenantConfig.iconSet.manifestIcon192 });
    }
    if (tenantConfig.iconSet?.manifestIcon512) {
      upsertLinkTag(this.document, { rel: 'icon', sizes: '512x512', href: tenantConfig.iconSet.manifestIcon512 });
    }

    this.applyManifest(tenantConfig);
  }

  applyManifest(tenantConfig) {
    const manifestObject = buildManifestObject(tenantConfig);
    const url = this.createManifestUrl(manifestObject);
    upsertLinkTag(this.document, { rel: 'manifest', href: url });
    if (this.lastManifestUrl) {
      this.revokeManifestUrl(this.lastManifestUrl);
    }
    this.lastManifestUrl = url;
  }
}
