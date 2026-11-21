import type {Prediction, SceneItem} from './api';

export const MATERIAL_NAMES: Record<string, string> = {
  pete_bottles: 'PETE Bottles (Polyethylene Terephthalate)',
  hdpe_containers: 'HDPE Containers (High-Density Polyethylene)',
  cardboard: 'Cardboard',
  paper: 'Paper',
  fabric_scraps: 'Fabric Scraps',
  coconut_shells: 'Coconut Shells',
  dry_untreated_wood_scraps: 'Dry Untreated Wood Scraps',
};

export const SCAN_MATERIAL_NAMES: Record<string, string> = {
  pete_bottles: 'Water and soft drink bottles (#1)',
  hdpe_containers: 'Thick plastic jugs and bottles (#2)',
  cardboard: 'Cardboard boxes and sheets',
  paper: 'Paper sheets and scraps',
  fabric_scraps: 'Cloth scraps',
  coconut_shells: 'Coconut shells',
  dry_untreated_wood_scraps: 'Dry, unpainted and untreated wood',
};

export const SCAN_MATERIAL_ICONS: Record<string, number> = {
  pete_bottles: require('./assets/icons/pete-bottles.png'),
  hdpe_containers: require('./assets/icons/hdpe-containers.png'),
  cardboard: require('./assets/icons/cardboard.png'),
  paper: require('./assets/icons/paper.png'),
  fabric_scraps: require('./assets/icons/fabric-scraps.png'),
  coconut_shells: require('./assets/icons/coconut-shells.png'),
  dry_untreated_wood_scraps: require('./assets/icons/dry-wood-scraps.png'),
};

export function materialReview(prediction?: Prediction | null) {
  if (prediction?.recognition?.unavailable) {
    return {title:'Material Check Unavailable', message:'Material recognition is unavailable right now. Try again later.', retake:false};
  }
  if (prediction?.recognition?.status === 'unsupported') {
    return {title:'Out of Scope', message:'This item is outside SNAPTURE’s seven material categories. Scan a supported item to look for a project.', retake:false};
  }
  return {title:'Photo Needs Review', message:'We couldn’t confirm the material from this photo. Retake it in good light, step back if needed, and keep the whole item inside the guide.', retake:true};
}

export function hasUnidentifiedMaterial(prediction?: Prediction | null) {
  const label = prediction?.assessment?.material.label ?? prediction?.decision;
  const waste = prediction?.waste_identifier;
  return prediction?.recognition?.status !== 'needs_review' &&
    (prediction?.recognition?.status === 'unsupported' || !(label && Object.prototype.hasOwnProperty.call(MATERIAL_NAMES, label))) &&
    (!waste || waste.category === 'UNIDENTIFIED');
}

export function materialCategoryName(prediction?: Prediction | null) {
  const label = prediction?.assessment?.material.label ?? prediction?.decision;
  const waste = prediction?.waste_identifier;
  if (waste?.category === 'C') return 'Hazardous Waste';
  if (label && !MATERIAL_NAMES[label] && waste && waste.category !== 'UNIDENTIFIED') return waste.category_label;
  if (prediction?.recognition?.status === 'unsupported') return materialReview(prediction).title;
  return label && Object.prototype.hasOwnProperty.call(MATERIAL_NAMES, label) ? MATERIAL_NAMES[label] : materialReview(prediction).title;
}

export function isUpcyclingMaterial(prediction: Prediction) {
  const label = prediction.assessment?.material.label ?? prediction.decision;
  return Object.prototype.hasOwnProperty.call(MATERIAL_NAMES, label) && prediction.waste_identifier?.category !== 'C' && prediction.recognition?.status !== 'unsupported';
}

export function sceneItemTitle(item: SceneItem) {
  return materialCategoryName(item.prediction);
}
