import type {Prediction} from './api';
import {MATERIAL_NAMES} from './detectionPresentation';

/** Use saved content only; opening history never rewrites an assessment. */
export function savedScanIdeas(prediction:Prediction) {
  const label=prediction.assessment?.material.label || prediction.decision || '';
  const answers=prediction.answers || {};
  const action=(prediction.image_quality as {item_action?:string}|undefined)?.item_action;
  if(['keep','discard'].includes(String(action)) ||
    ['A','B2','C'].includes(String(answers.reported_category)) || answers.other_material==='Battery / electronic item' ||
    label==='dry_untreated_wood_scraps' && ['Paint, treatment, nails, or mold','Yes'].includes(String(answers.wood_treatment)))return [];
  const scraps=prediction.condition==='Torn or crumpled, clean and dry' && label==='paper' ||
    prediction.condition==='Clean dry usable scraps' && ['cardboard','fabric_scraps'].includes(label);
  if(!Object.prototype.hasOwnProperty.call(MATERIAL_NAMES,label) ||
    !['user_selected','model_high_confidence'].includes(String(prediction.assessment?.material.status)) ||
    !(prediction.condition==='Clean and dry' || scraps) || answers.moisture==='Wet' ||
    prediction.previous_contents==='Chemical or cleaning product' || prediction.waste_identifier?.category==='C' ||
    answers.contamination && answers.contamination!=='None known')return [];
  if(scraps && (answers.moisture!=='Dry' || answers.contamination!=='None known'))return [];
  const allowed=label==='paper' && scraps?['paper_craft']:label==='cardboard' && scraps?['cardboard_craft']:
    label==='fabric_scraps' && scraps?['fabric_cleaning_cloth','fabric_patchwork']:null;
  const seen=new Set<string>();
  return [...(prediction.upcycling_ideas || []),...(prediction.recommendation_choices || [])].filter(idea=>{
    if(!idea.steps?.length || seen.has(idea.id) || allowed && !allowed.includes(idea.id))return false;
    seen.add(idea.id);return true;
  });
}
