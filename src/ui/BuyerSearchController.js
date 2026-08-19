import { buildVehicleCardViewModel } from './vehicleCard.js';

export class BuyerSearchController {
  constructor({ searchService, shareService } = {}) {
    if (!searchService) {
      throw new Error('BuyerSearchController requires a searchService');
    }

    this.searchService = searchService;
    this.shareService = shareService ?? null;
  }

  runSearch(vehicles, criteria) {
    const entries = this.searchService.search(vehicles, criteria);
    return entries.map(({ vehicle, distanceMiles }) =>
      buildVehicleCardViewModel({ vehicle, distanceMiles }),
    );
  }

  async shareVehicle(cardViewModel) {
    if (!this.shareService) {
      return { shared: false, reason: 'unsupported' };
    }
    return this.shareService.share(cardViewModel.shareData);
  }
}
