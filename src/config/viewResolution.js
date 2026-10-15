const VIEW_QUERY_PARAM = 'view';

export const VIEWS = Object.freeze({
  SELLER: 'seller',
  DEALER: 'dealer',
});

export function readViewFromUrl(search = '') {
  const value = new URLSearchParams(search).get(VIEW_QUERY_PARAM);
  return value === VIEWS.DEALER || value === VIEWS.SELLER ? value : null;
}

export function readViewFromPath(pathname = '') {
  return pathname.replace(/\/+$/, '') === '/dealer' ? VIEWS.DEALER : null;
}

export function resolveActiveView({ search = '', pathname = '' } = {}) {
  return readViewFromUrl(search) ?? readViewFromPath(pathname) ?? VIEWS.SELLER;
}
