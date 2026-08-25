export const SEED_ZIP_CODE = '28451';
// Approximate centroid of ZIP 28451 (Rocky Point, NC). No live geocoding is
// wired up, so this is a reasonable fixed estimate for demo/seed purposes.
export const SEED_ANCHOR = Object.freeze({ lat: 34.35, lng: -77.8 });

export const CARBOYZ_HQ_DEALER_ID = 'carboyz-hq';

// 30% (6/20): seeded straight into the CarBoyZ Motors (carboyz tenant) lot via
// IngestService, as three same-model pairs so TelemetryService produces a
// realistic +/-1 sigma UNDERPRICED/OVERPRICED spread within each pair.
export const DIRECT_INVENTORY = Object.freeze([
  { dealerId: CARBOYZ_HQ_DEALER_ID, make: 'Pontiac', model: 'Trans Am', year: 1978, price: 24500, mileage: 68000, bodyStyle: 'coupe' },
  { dealerId: CARBOYZ_HQ_DEALER_ID, make: 'Pontiac', model: 'Trans Am', year: 1978, price: 31000, mileage: 41000, bodyStyle: 'coupe' },
  { dealerId: CARBOYZ_HQ_DEALER_ID, make: 'Jeep', model: 'Wrangler', year: 2021, price: 27500, mileage: 32000, bodyStyle: 'suv' },
  { dealerId: CARBOYZ_HQ_DEALER_ID, make: 'Jeep', model: 'Wrangler', year: 2021, price: 33500, mileage: 15000, bodyStyle: 'suv' },
  { dealerId: CARBOYZ_HQ_DEALER_ID, make: 'Chevrolet', model: 'Corvette C3', year: 1976, price: 18500, mileage: 89000, bodyStyle: 'coupe' },
  { dealerId: CARBOYZ_HQ_DEALER_ID, make: 'Chevrolet', model: 'Corvette C3', year: 1976, price: 26500, mileage: 52000, bodyStyle: 'coupe' },
]);

// 70% (14/20): distributed across three simulated vendor lots, all within a
// 50-mile radius of SEED_ANCHOR, discoverable via DiscoveryService's
// "Scan 50-mile Radius" flow. Raw field names intentionally mismatch the
// domain model to exercise VendorAdapter's normalization.
export const VENDOR_FEEDS = Object.freeze([
  {
    dealer: {
      dealer_id: 'vendor-jacksonville-trucks',
      dealer_name: 'Jacksonville Truck Exchange (Vendor)',
      latitude: 34.75,
      longitude: -77.43,
    },
    vehicles: [
      { id: 'jt-1', dealer_id: 'vendor-jacksonville-trucks', make: 'Ford', model: 'F-150', year: 2020, asking_price: 32000, odometer: 45000, body_type: 'truck' },
      { id: 'jt-2', dealer_id: 'vendor-jacksonville-trucks', make: 'Chevrolet', model: 'Silverado 1500', year: 2019, asking_price: 29500, odometer: 58000, body_type: 'truck' },
      { id: 'jt-3', dealer_id: 'vendor-jacksonville-trucks', make: 'Ram', model: '1500', year: 2021, asking_price: 35500, odometer: 22000, body_type: 'truck' },
      { id: 'jt-4', dealer_id: 'vendor-jacksonville-trucks', make: 'Ford', model: 'Bronco', year: 2022, asking_price: 42000, odometer: 9000, body_type: 'suv' },
      { id: 'jt-5', dealer_id: 'vendor-jacksonville-trucks', make: 'GMC', model: 'Sierra 1500', year: 2018, asking_price: 27500, odometer: 71000, body_type: 'truck' },
    ],
  },
  {
    dealer: {
      dealer_id: 'vendor-wilmington-classics',
      dealer_name: 'Wilmington Classic Muscle (Vendor)',
      latitude: 34.23,
      longitude: -77.94,
    },
    vehicles: [
      { id: 'wc-1', dealer_id: 'vendor-wilmington-classics', make: 'Chevrolet', model: 'Camaro', year: 1969, asking_price: 38500, odometer: 61000, body_type: 'coupe' },
      { id: 'wc-2', dealer_id: 'vendor-wilmington-classics', make: 'Ford', model: 'Mustang', year: 1970, asking_price: 41500, odometer: 54000, body_type: 'coupe' },
      { id: 'wc-3', dealer_id: 'vendor-wilmington-classics', make: 'Dodge', model: 'Charger', year: 1971, asking_price: 44500, odometer: 47000, body_type: 'coupe' },
      { id: 'wc-4', dealer_id: 'vendor-wilmington-classics', make: 'Chevrolet', model: 'Chevelle', year: 1970, asking_price: 39500, odometer: 58000, body_type: 'coupe' },
      { id: 'wc-5', dealer_id: 'vendor-wilmington-classics', make: 'Plymouth', model: 'Barracuda', year: 1972, asking_price: 46500, odometer: 39000, body_type: 'coupe' },
    ],
  },
  {
    dealer: {
      dealer_id: 'vendor-burgaw-project-cars',
      dealer_name: 'Burgaw Project Cars (Vendor)',
      latitude: 34.55,
      longitude: -77.92,
    },
    vehicles: [
      { id: 'bp-1', dealer_id: 'vendor-burgaw-project-cars', make: 'Ford', model: 'Mustang', year: 1965, asking_price: 12500, odometer: 118000, body_type: 'coupe' },
      { id: 'bp-2', dealer_id: 'vendor-burgaw-project-cars', make: 'Chevrolet', model: 'Nova', year: 1972, asking_price: 15500, odometer: 97000, body_type: 'coupe' },
      { id: 'bp-3', dealer_id: 'vendor-burgaw-project-cars', make: 'Datsun', model: '240Z', year: 1973, asking_price: 21500, odometer: 82000, body_type: 'coupe' },
      { id: 'bp-4', dealer_id: 'vendor-burgaw-project-cars', make: 'Volkswagen', model: 'Beetle', year: 1971, asking_price: 9500, odometer: 103000, body_type: 'hatchback' },
    ],
  },
]);

export function seedDirectInventory(ingestService) {
  return DIRECT_INVENTORY.map((vehicleData) => ingestService.intake(vehicleData));
}

// Default local nodes for the CarBoyZ domain overlay: dealers that render on the map immediately,
// without requiring a DiscoveryService scan, covering the Leland/Wilmington NC local market around
// SEED_ANCHOR. Kept separate from DIRECT_INVENTORY/CARBOYZ_HQ_DEALER_ID so the fixed 30/70 direct-vs-
// vendor seed-set ratio asserted elsewhere is untouched.
export const LELAND_DEALER_ID = 'leland-motors';
export const WILMINGTON_DEALER_ID = 'wilmington-auto-plaza';
export const CASTLE_HAYNE_DEALER_ID = 'castle-hayne-motor-works';
export const HAMPSTEAD_DEALER_ID = 'hampstead-coastal-auto';
export const CAROLINA_BEACH_DEALER_ID = 'carolina-beach-auto-outlet';
export const WRIGHTSVILLE_DEALER_ID = 'wrightsville-shores-motors';
export const PORTERS_NECK_DEALER_ID = 'porters-neck-auto-gallery';
export const DOWNTOWN_WILMINGTON_DEALER_ID = 'downtown-wilmington-motor-co';
export const LELAND_RIVERSIDE_DEALER_ID = 'leland-riverside-imports';
export const OGDEN_DEALER_ID = 'ogden-crossroads-autos';
export const MONKEY_JUNCTION_DEALER_ID = 'monkey-junction-auto-mart';
export const BRUNSWICK_FOREST_DEALER_ID = 'brunswick-forest-motor-club';

// Dense local layer: real Leland/Wilmington-area towns within the ~25mi radius
// MapView.js queries by default (NEARBY_RADIUS_MILES around FALLBACK_LOCATION),
// so the map reads as a real regional market instead of two isolated pins.
export const LOCAL_DEALERS = Object.freeze([
  { dealerId: LELAND_DEALER_ID, name: 'Leland Motors', lat: 34.2388, lng: -78.0145 },
  { dealerId: WILMINGTON_DEALER_ID, name: 'Wilmington Auto Plaza', lat: 34.2104, lng: -77.8868 },
  { dealerId: CASTLE_HAYNE_DEALER_ID, name: 'Castle Hayne Motor Works', lat: 34.332, lng: -77.908 },
  { dealerId: HAMPSTEAD_DEALER_ID, name: 'Hampstead Coastal Auto', lat: 34.3707, lng: -77.7113 },
  { dealerId: CAROLINA_BEACH_DEALER_ID, name: 'Carolina Beach Auto Outlet', lat: 34.0352, lng: -77.8936 },
  { dealerId: WRIGHTSVILLE_DEALER_ID, name: 'Wrightsville Shores Motors', lat: 34.2085, lng: -77.7963 },
  { dealerId: PORTERS_NECK_DEALER_ID, name: 'Porters Neck Auto Gallery', lat: 34.279, lng: -77.784 },
  { dealerId: DOWNTOWN_WILMINGTON_DEALER_ID, name: 'Downtown Wilmington Motor Co.', lat: 34.2257, lng: -77.9447 },
  { dealerId: LELAND_RIVERSIDE_DEALER_ID, name: 'Leland Riverside Imports', lat: 34.2565, lng: -78.043 },
  { dealerId: OGDEN_DEALER_ID, name: 'Ogden Crossroads Autos', lat: 34.247, lng: -77.81 },
  { dealerId: MONKEY_JUNCTION_DEALER_ID, name: 'Monkey Junction Auto Mart', lat: 34.155, lng: -77.893 },
  { dealerId: BRUNSWICK_FOREST_DEALER_ID, name: 'Brunswick Forest Motor Club', lat: 34.142, lng: -78.057 },
]);

export const LOCAL_DEALER_INVENTORY = Object.freeze([
  { dealerId: LELAND_DEALER_ID, make: 'Honda', model: 'CR-V', year: 2021, price: 26500, mileage: 34000, bodyStyle: 'suv' },
  { dealerId: LELAND_DEALER_ID, make: 'Toyota', model: 'Camry', year: 2020, price: 21500, mileage: 41000, bodyStyle: 'sedan' },
  { dealerId: WILMINGTON_DEALER_ID, make: 'Ford', model: 'Escape', year: 2022, price: 25500, mileage: 19000, bodyStyle: 'suv' },
  { dealerId: WILMINGTON_DEALER_ID, make: 'Nissan', model: 'Altima', year: 2021, price: 19500, mileage: 28000, bodyStyle: 'sedan' },
  { dealerId: CASTLE_HAYNE_DEALER_ID, make: 'GMC', model: 'Terrain', year: 2020, price: 23500, mileage: 37000, bodyStyle: 'suv' },
  { dealerId: HAMPSTEAD_DEALER_ID, make: 'Subaru', model: 'Outback', year: 2021, price: 27500, mileage: 29000, bodyStyle: 'suv' },
  { dealerId: CAROLINA_BEACH_DEALER_ID, make: 'Jeep', model: 'Renegade', year: 2019, price: 18500, mileage: 46000, bodyStyle: 'suv' },
  { dealerId: WRIGHTSVILLE_DEALER_ID, make: 'Mazda', model: 'CX-5', year: 2022, price: 28500, mileage: 15000, bodyStyle: 'suv' },
  { dealerId: PORTERS_NECK_DEALER_ID, make: 'Hyundai', model: 'Tucson', year: 2021, price: 24500, mileage: 25000, bodyStyle: 'suv' },
  { dealerId: DOWNTOWN_WILMINGTON_DEALER_ID, make: 'Volkswagen', model: 'Jetta', year: 2020, price: 17500, mileage: 39000, bodyStyle: 'sedan' },
  { dealerId: LELAND_RIVERSIDE_DEALER_ID, make: 'Kia', model: 'Sportage', year: 2022, price: 25500, mileage: 12000, bodyStyle: 'suv' },
  { dealerId: OGDEN_DEALER_ID, make: 'Chevrolet', model: 'Equinox', year: 2020, price: 21500, mileage: 33000, bodyStyle: 'suv' },
  { dealerId: MONKEY_JUNCTION_DEALER_ID, make: 'Toyota', model: 'RAV4', year: 2021, price: 27500, mileage: 22000, bodyStyle: 'suv' },
  { dealerId: BRUNSWICK_FOREST_DEALER_ID, make: 'Ford', model: 'Edge', year: 2019, price: 20500, mileage: 44000, bodyStyle: 'suv' },
]);

export function seedLocalDealers(ingestService) {
  return LOCAL_DEALER_INVENTORY.map((vehicleData) => ingestService.intake(vehicleData));
}
