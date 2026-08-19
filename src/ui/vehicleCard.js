import { marketPositionBadge } from './marketBadge.js';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const mileageFormatter = new Intl.NumberFormat('en-US');

export function buildVehicleCardViewModel({ vehicle, distanceMiles = null, marketPosition = null }) {
  const title = [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const mileageLabel =
    vehicle.mileage !== null ? `${mileageFormatter.format(vehicle.mileage)} mi` : 'Mileage unavailable';
  const priceLabel = currencyFormatter.format(vehicle.price);

  return {
    vehicleId: vehicle.vehicleId,
    title,
    priceLabel,
    mileageLabel,
    distanceLabel: distanceMiles !== null ? `${distanceMiles.toFixed(1)} mi away` : null,
    bodyStyle: vehicle.bodyStyle,
    badge: marketPosition !== null ? marketPositionBadge(marketPosition) : null,
    shareData: {
      title,
      text: `${title} — ${priceLabel} · ${mileageLabel}`,
    },
  };
}
