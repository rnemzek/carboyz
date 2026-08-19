import { DiscoveryStage } from '../services/DiscoveryService.js';

const LABELS_BY_STAGE = {
  [DiscoveryStage.SCANNING]: 'Finding Local Lots',
  [DiscoveryStage.PARSING]: 'Parsing Inventory',
  [DiscoveryStage.CALCULATING]: 'Calculating Telemetry',
  [DiscoveryStage.COMPLETE]: 'Complete',
};

export function discoveryStageLabel(stage) {
  return LABELS_BY_STAGE[stage] ?? 'Working...';
}
