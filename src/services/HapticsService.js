function detectVibrate() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

export class HapticsService {
  constructor() {
    this.isSupported = detectVibrate();
  }

  vibrate(pattern = 10) {
    if (!this.isSupported) {
      return false;
    }
    return navigator.vibrate(pattern);
  }
}
