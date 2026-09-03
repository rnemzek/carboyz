import { generateVin } from '../vin/generator.js';

/** One deterministic preset per common test-bed body style, each with an ISO 3779-valid VIN. */
export const VEHICLE_SEEDS = [
  {
    key: 'sedan',
    label: '2021 Toyota Camry LE (Sedan)',
    vin: generateVin({ seed: 100101 }),
    year: 2021,
    make: 'Toyota',
    model: 'Camry',
    trim: 'LE',
    bodyClass: 'Sedan',
    mileage: 32000,
  },
  {
    key: 'truck',
    label: '2020 Ford F-150 XLT (Truck)',
    vin: generateVin({ seed: 100102 }),
    year: 2020,
    make: 'Ford',
    model: 'F-150',
    trim: 'XLT',
    bodyClass: 'Pickup',
    mileage: 48000,
  },
  {
    key: 'ev',
    label: '2023 Tesla Model 3 Long Range (EV)',
    vin: generateVin({ seed: 100103 }),
    year: 2023,
    make: 'Tesla',
    model: 'Model 3',
    trim: 'Long Range',
    bodyClass: 'Sedan',
    mileage: 12000,
  },
  {
    key: 'suv',
    label: '2022 Honda CR-V EX (SUV)',
    vin: generateVin({ seed: 100104 }),
    year: 2022,
    make: 'Honda',
    model: 'CR-V',
    trim: 'EX',
    bodyClass: 'SUV',
    mileage: 21000,
  },
];

export function findVehicleSeed(key) {
  return VEHICLE_SEEDS.find((seed) => seed.key === key) ?? null;
}
