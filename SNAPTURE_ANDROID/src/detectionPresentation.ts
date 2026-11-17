import type {Prediction, SceneItem} from './api';

export const MATERIAL_NAMES: Record<string, string> = {
  pete_bottles: 'PETE Bottles',
  hdpe_containers: 'HDPE Containers',
  cardboard: 'Cardboard',
  paper: 'Paper',
  fabric_scraps: 'Fabric Scraps',
  coconut_shells: 'Coconut Shells',
  dry_untreated_wood_scraps: 'Dry Untreated Wood Scraps',
};

export function materialCategoryName(prediction?: Prediction | null) {
  const label = prediction?.assessment?.material.label ?? prediction?.decision;
  return label && Object.prototype.hasOwnProperty.call(MATERIAL_NAMES, label) ? MATERIAL_NAMES[label] : prediction?.recognition?.status==='needs_review' ? 'Needs review' : 'Unsupported';
}

export function sceneItemTitle(item: SceneItem) {
  return materialCategoryName(item.prediction);
}
