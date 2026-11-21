import React from 'react';
import Renderer from 'react-test-renderer';
import MaterialConditionGuide from '../src/MaterialConditionGuide';
import type {MaterialGuide} from '../src/api';

test.each(['pete_bottles','hdpe_containers','cardboard','paper','fabric_scraps','coconut_shells','dry_untreated_wood_scraps'])('%s has a bundled example photo and condition guidance without disposal sections',async(label)=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<MaterialConditionGuide guide={{label,title:label,examples:['Example']} as MaterialGuide}/>);});
  const json=JSON.stringify(tree.toJSON());
  expect(tree.root.findAllByProps({accessibilityLabel:`${label}: common example reference`}).length).toBeGreaterThan(0);
  for(const text of ['Common examples','Condition requirements','Preparation','AI confidence is not an upcycling eligibility percentage'])expect(json).toContain(text);
  expect(json).not.toContain('Recycling guidance');expect(json).not.toContain('Disposal guidance');
  await Renderer.act(()=>tree.unmount());
});
