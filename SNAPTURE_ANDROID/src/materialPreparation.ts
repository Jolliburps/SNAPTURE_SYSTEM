import {type Prediction} from './api';

export type PreparationPlan={title:string;steps:string[];blocked?:string};
const drying=['Place it on a clean, dry surface with good airflow.',
  'Let it air-dry completely. Do not use a flame or strong heat.',
  'Check again. Stop if you notice mold, stains, damage or an unusual smell.'];

export function materialPreparation(p:Prediction):PreparationPlan|null{
  if(p.condition!=='Needs cleaning' && p.answers?.moisture!=='Wet')return null;
  const label=p.assessment?.material.label;
  const contamination=p.answers?.contamination;
  const block=(reason:string):PreparationPlan=>({title:'Check before preparing',steps:[],blocked:reason});
  if(p.waste_identifier?.category==='C' || p.previous_contents==='Chemical or cleaning product' ||
    ['Chemical contamination','Oil or grease','Mold or biological waste'].includes(String(contamination))){
    return block('Keep this item separate. Cleaning does not make chemical, mold or grease contamination safe for these projects. Ask your barangay or CESD about handling.');
  }
  if(!['user_selected','model_high_confidence'].includes(String(p.assessment?.material.status))){
    return block('Confirm the material before following preparation instructions.');
  }
  if(!['None known','Food residue that can be removed'].includes(String(contamination)) || p.previous_contents==='Other / unknown'){
    return block('Choose whether this is only wet or has food residue. If its contents or contamination are unknown, do not wash or reuse it yet.');
  }
  if(label==='paper' || label==='cardboard'){
    if(contamination!=='None known' || p.answers?.moisture!=='Wet')return block('Do not wash paper or cardboard with food or grease stains. Keep it separate from clean paper and check local collection instructions.');
    return {title:label==='paper'?'Dry the paper first':'Dry the cardboard first',steps:[
      'Separate the sheets or open the cardboard gently. Do not wash or soak it.',...drying]};
  }
  if(label==='pete_bottles' || label==='hdpe_containers'){
    if(!['Water or beverage','Food or oil'].includes(p.previous_contents || '')){
      return block('Check what the container originally held. Choose its previous contents in your item details; only a known food or drink container gets rinsing instructions.');
    }
    return {title:'Prepare the container',steps:[
      'Empty the remaining food or drink. Stop if the container is cracked or leaking.',
      'Remove food residue and rinse with clean water. Do not mix cleaning chemicals.',
      'Let it drain and air-dry completely. Check that no residue remains.']};
  }
  if(label==='fabric_scraps')return {title:'Prepare the fabric',steps:[
    'Check its care label. If washing is needed, follow those instructions; stop if the cleaning method is unknown.',
    'For fabric that is only wet and otherwise clean, hang or lay it out to air-dry.',
    'Check that it is fully dry, clean and free of mold before continuing.']};
  if(label==='coconut_shells')return {title:'Prepare the coconut shell',steps:[
    'Check for sharp broken edges or mold. Stop if either is present.',
    'Gently remove loose coconut flesh with a soft brush and rinse with clean water. Do not cut or force it.',
    'Air-dry completely and check that no flesh or residue remains.']};
  if(label==='dry_untreated_wood_scraps'){
    if(contamination!=='None known')return block('Do not wash or sand wood with unknown stains or treatment. Check its history before preparing it.');
    return {title:'Dry the wood first',steps:[
      'Check for nails, sharp splinters, mold and rot. Stop if any are present.',
      'Place the wood in a sheltered, well-ventilated area and allow it to air-dry.',
      'Check that it is dry. Treatment history must still be checked before a project is offered.']};
  }
  return block('This material has no preparation guide. Check the category before continuing.');
}

export const PREPARATION_SOURCES=[
  {name:'US EPA: preparing common recyclables',url:'https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables'},
  {name:'US EPA: recycling questions (clean, dry paper)',url:'https://www.epa.gov/recycle/frequent-questions-recycling'},
  {name:'US EPA: mold and porous materials',url:'https://www.epa.gov/mold/brief-guide-mold-moisture-and-your-home'},
];
