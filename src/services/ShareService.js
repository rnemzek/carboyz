function detectShare() {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

export class ShareService {
  constructor() {
    this.isSupported = detectShare();
  }

  async share(data = {}) {
    if (!this.isSupported) {
      return { shared: false, reason: 'unsupported' };
    }
    await navigator.share(data);
    return { shared: true };
  }
}
