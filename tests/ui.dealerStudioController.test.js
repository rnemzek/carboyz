import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TelemetryService } from '../src/services/TelemetryService.js';
import { IngestService } from '../src/services/IngestService.js';
import { DealerStudioController } from '../src/ui/DealerStudioController.js';

function makeHapticsSpy() {
  const calls = [];
  return { calls, vibrate: (pattern) => calls.push(pattern ?? 'default') };
}

test('DealerStudioController requires an ingestService and a telemetryService', () => {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 't1' });

  assert.throws(() => new DealerStudioController({ telemetryService }), /ingestService/);
  assert.throws(() => new DealerStudioController({ ingestService }), /telemetryService/);
});

test('submitIntake ingests the vehicle, triggers haptics, and returns a ready-to-render card', () => {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 't1' });
  const haptics = makeHapticsSpy();
  const controller = new DealerStudioController({
    ingestService,
    telemetryService,
    hapticsService: haptics,
  });

  const result = controller.submitIntake({
    dealerId: 'dA',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    price: 20000,
    mileage: 15000,
    bodyStyle: 'sedan',
  });

  assert.equal(result.vehicle.tenantId, 't1');
  assert.equal(haptics.calls.length, 1);
  assert.equal(result.cardViewModel.title, '2022 Toyota Camry');
  assert.equal(result.cardViewModel.badge, null);
});

test('submitIntake works without a hapticsService configured', () => {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 't1' });
  const controller = new DealerStudioController({ ingestService, telemetryService });

  assert.doesNotThrow(() =>
    controller.submitIntake({ dealerId: 'dA', make: 'Honda', model: 'Civic', year: 2021, price: 18000 }),
  );
});

test('notifyPriceChange triggers a haptic pulse for live price update feedback', () => {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 't1' });
  const haptics = makeHapticsSpy();
  const controller = new DealerStudioController({
    ingestService,
    telemetryService,
    hapticsService: haptics,
  });

  controller.notifyPriceChange();
  assert.equal(haptics.calls.length, 1);
});

test('notifyPriceChange is a safe no-op without a hapticsService configured', () => {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 't1' });
  const controller = new DealerStudioController({ ingestService, telemetryService });

  assert.doesNotThrow(() => controller.notifyPriceChange());
});

test('buildInventoryViewModels recomputes live market badges against the current full inventory', () => {
  const telemetryService = new TelemetryService();
  const ingestService = new IngestService({ telemetryService, tenantId: 't1' });
  const controller = new DealerStudioController({ ingestService, telemetryService });

  controller.submitIntake({ dealerId: 'dA', make: 'Toyota', model: 'Camry', year: 2022, price: 20000 });
  controller.submitIntake({ dealerId: 'dA', make: 'Toyota', model: 'Camry', year: 2022, price: 30000 });

  const cards = controller.buildInventoryViewModels();
  assert.equal(cards.length, 2);
  assert.equal(cards[0].badge.label, 'Underpriced');
  assert.equal(cards[1].badge.label, 'Overpriced');
});
