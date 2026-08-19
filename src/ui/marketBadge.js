import { MarketPosition } from '../services/TelemetryService.js';

const BADGES_BY_POSITION = {
  [MarketPosition.UNDERPRICED]: { label: 'Underpriced', className: 'badge badge--underpriced' },
  [MarketPosition.FAIR]: { label: 'Fair Price', className: 'badge badge--fair' },
  [MarketPosition.OVERPRICED]: { label: 'Overpriced', className: 'badge badge--overpriced' },
};

const UNRATED_BADGE = { label: 'Unrated', className: 'badge badge--unrated' };

export function marketPositionBadge(position) {
  return BADGES_BY_POSITION[position] ?? UNRATED_BADGE;
}
