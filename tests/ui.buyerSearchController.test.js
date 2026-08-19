import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dealer } from '../src/models/Dealer.js';
import { Vehicle } from '../src/models/Vehicle.js';
import { SearchService } from '../src/services/SearchService.js';
import { BuyerSearchController } from '../src/ui/BuyerSearchController.js';

const dealerA = new Dealer({ tenantId: 't1', dealerId: 'dA', name: 'A', lat: 0, lng: 0 });
const dealerB = new Dealer({ tenantId: 't1', dealerId: 'dB', name: 'B', lat: 0, lng: 0.5 });

function buildVehicles() {
  return [
    new Vehicle({
      tenantId: 't1',
      vehicleId: 'v1',
      dealerId: 'dA',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      price: 20000,
      mileage: 15000,
      bodyStyle: 'sedan',
    }),
    new Vehicle({
      tenantId: 't1',
      vehicleId: 'v2',
      dealerId: 'dB',
      make: 'Toyota',
      model: 'Camry',
      year: 2022,
      price: 25000,
      mileage: 5000,
      bodyStyle: 'sedan',
    }),
  ];
}

test('BuyerSearchController requires a searchService', () => {
  assert.throws(() => new BuyerSearchController({}), /searchService/);
});

test('runSearch returns filtered, sorted vehicle cards including a distance label when an origin is used', () => {
  const searchService = new SearchService({ dealers: [dealerA, dealerB] });
  const controller = new BuyerSearchController({ searchService });

  const cards = controller.runSearch(buildVehicles(), {
    tenantId: 't1',
    originDealerId: 'dA',
    radiusMiles: 50,
    sortBy: 'price_asc',
  });

  assert.deepEqual(
    cards.map((c) => c.vehicleId),
    ['v1', 'v2'],
  );
  assert.equal(cards[0].distanceLabel, '0.0 mi away');
  assert.ok(cards[1].distanceLabel.endsWith('mi away'));
});

test('shareVehicle delegates to the configured shareService with the card share data', async () => {
  const searchService = new SearchService({ dealers: [dealerA, dealerB] });
  const shareCalls = [];
  const shareService = {
    share: async (data) => {
      shareCalls.push(data);
      return { shared: true };
    },
  };
  const controller = new BuyerSearchController({ searchService, shareService });

  const [card] = controller.runSearch(buildVehicles(), { tenantId: 't1', maxPrice: 21000 });
  const result = await controller.shareVehicle(card);

  assert.deepEqual(result, { shared: true });
  assert.equal(shareCalls[0].title, card.title);
});

test('shareVehicle reports unsupported when no shareService is configured', async () => {
  const searchService = new SearchService({ dealers: [dealerA, dealerB] });
  const controller = new BuyerSearchController({ searchService });

  const [card] = controller.runSearch(buildVehicles(), { tenantId: 't1' });
  const result = await controller.shareVehicle(card);

  assert.deepEqual(result, { shared: false, reason: 'unsupported' });
});
