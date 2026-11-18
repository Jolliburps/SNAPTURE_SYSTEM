import {materialConditions} from '../src/materialConditions';
import {MATERIAL_NAMES} from '../src/detectionPresentation';

test.each(Object.keys(MATERIAL_NAMES))('%s has its own condition choices with stable backend codes',label=>{
  const profile=materialConditions(label)!;
  expect(profile).not.toBeNull();
  expect(new Set(profile.choices.map(choice=>choice.label)).size).toBe(profile.choices.length);
  expect(profile.choices.every(choice=>['Clean dry usable scraps','Torn or crumpled, clean and dry','Clean and dry','Needs cleaning','Damaged or cracked','Moldy or contaminated','Not sure'].includes(choice.values.condition))).toBe(true);
  expect(profile.choices.find(choice=>choice.values.condition===(label==='paper'?'Torn or crumpled, clean and dry':['cardboard','fabric_scraps'].includes(label)?'Clean dry usable scraps':'Damaged or cracked'))).toBeDefined();
  expect(profile.choices.find(choice=>choice.label==='Not sure about its condition')?.values.condition).toBe('Not sure');
  expect(profile.choices.find(choice=>choice.values.contamination==='Chemical contamination')?.values.previous_contents).toBe('Chemical or cleaning product');
});

test('paper contamination does not invite washing and damage is not uncertainty',()=>{
  const paper=materialConditions('paper')!;
  expect(paper.choices.map(choice=>choice.label).join(' ')).not.toMatch(/needs cleaning|rinse|wash/i);
  expect(paper.choices.find(choice=>choice.label.includes('food or grease'))?.values.condition).toBe('Moldy or contaminated');
  expect(paper.choices.find(choice=>choice.label.startsWith('Torn'))?.values.condition).toBe('Torn or crumpled, clean and dry');
});

test('wood and fabric do not get the food-container residue question',()=>{
  for(const label of ['dry_untreated_wood_scraps','fabric_scraps']){
    expect(materialConditions(label)!.choices.some(choice=>choice.values.contamination==='Food residue that can be removed')).toBe(false);
  }
  expect(materialConditions('unsupported')).toBeNull();
});
