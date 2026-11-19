import {materialPreparation} from '../src/materialPreparation';
import {type Prediction} from '../src/api';
import {MATERIAL_NAMES} from '../src/detectionPresentation';

const item=(label:string,extra:Partial<Prediction>={})=>({id:3,condition:'Needs cleaning',previous_contents:'Water or beverage',
  answers:{contamination:'None known',moisture:'Wet',wetness_cause:'Clean water'},assessment:{material:{label,status:'user_selected'}},...extra} as Prediction);

test.each(Object.keys(MATERIAL_NAMES))('confirmed %s has applicable preparation steps',label=>{
  const plan=materialPreparation(item(label));expect(plan?.blocked).toBeUndefined();expect(plan?.steps.length).toBeGreaterThan(1);
});
test('wet paper gets drying instructions, never washing',()=>{
  const plan=materialPreparation(item('paper'))!;
  expect(plan.title).toBe('Dry the paper first');expect(plan.steps.join(' ')).toContain('Do not wash or soak');
  expect(materialPreparation(item('paper',{answers:{contamination:'Food residue that can be removed',moisture:'Wet'}}))?.blocked).toBeTruthy();
});
test.each(['pete_bottles','hdpe_containers'])('%s never gets rinsing instructions for unknown or chemical contents',label=>{
  for(const previous_contents of ['', 'Other / unknown','No chemical contact known','Chemical or cleaning product']){
    expect(materialPreparation(item(label,{previous_contents}))?.blocked).toBeTruthy();
  }
});
test.each(['Chemical contamination','Oil or grease','Mold or biological waste','Not sure'])('does not clear %s through the preparation shortcut',contamination=>{
  expect(materialPreparation(item('fabric_scraps',{answers:{contamination,moisture:'Wet'}}))?.blocked).toBeTruthy();
});
test('does not turn an uncertain category into a confirmed one or repeat preparation for clean items',()=>{
  const p=item('paper');p.assessment!.material.status='needs_confirmation';
  expect(materialPreparation(p)?.blocked).toContain('Confirm');
  expect(materialPreparation(item('paper',{condition:'Clean and dry',answers:{moisture:'Dry'}}))).toBeNull();
});
