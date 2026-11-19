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

export const MATERIAL_EXPLANATIONS:Record<string,string>={
  pete_bottles:'PETE means polyethylene terephthalate, plastic code 1; commonly used for water and soft-drink bottles. Check the actual code.',
  hdpe_containers:'HDPE means high-density polyethylene, plastic code 2; commonly used for milk jugs and detergent containers. Check the actual code; previous contents still matter.',
  cardboard:'Thick paper-based packaging, such as boxes and corrugated board.',
  paper:'Thin paper sheets or pieces, such as writing paper and newspaper. Coatings and contamination can affect reuse.',
  fabric_scraps:'Leftover cloth or usable textile pieces, such as cotton offcuts or old clothing pieces.',
  coconut_shells:'The hard inner coconut shell, not the fibrous outer husk.',
  dry_untreated_wood_scraps:'Dry wood pieces known to be unpainted and chemically untreated. Appearance alone cannot confirm treatment history.',
};
export function materialExplanation(prediction?:Prediction|null){
  const label=prediction?.assessment?.material.label ?? prediction?.decision;
  return label?MATERIAL_EXPLANATIONS[label] || '':'';
}

export function materialCategoryName(prediction?: Prediction | null) {
  const label = prediction?.assessment?.material.label ?? prediction?.decision;
  return label && Object.prototype.hasOwnProperty.call(MATERIAL_NAMES, label) ? MATERIAL_NAMES[label] : prediction?.recognition?.status==='needs_review' ? 'Needs review' : 'Unsupported';
}

export function sceneItemTitle(item: SceneItem) {
  return materialCategoryName(item.prediction);
}
