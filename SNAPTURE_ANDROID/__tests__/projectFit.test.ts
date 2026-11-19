import {projectFit} from '../src/projectFit';
const idea=(id:string,title='One item',summary='')=>({id,title,summary,materials:['Glue'],steps:['Make it']});
test.each(['paper_craft','cardboard_craft','fabric_bag','pete_planter','hdpe_storage','coconut_bowl','wood_craft'])('%s gives size and quantity checks without tool availability',id=>{
  const checks=projectFit(idea(id));expect(checks).toHaveLength(2);expect(checks.join(' ')).not.toContain('Glue');
});
test('paper scraps and intact wrapping sheets have different fit requirements',()=>{
  expect(projectFit(idea('paper_craft'))[0]).toContain('pieces');
  expect(projectFit(idea('paper_gift_wrap'))[0]).toContain('covers your gift');
});
test('sets require enough items rather than assuming one item is enough',()=>{
  expect(projectFit(idea('pete_seed_set','Seed starter set'))[1]).toContain('whole set');
});
