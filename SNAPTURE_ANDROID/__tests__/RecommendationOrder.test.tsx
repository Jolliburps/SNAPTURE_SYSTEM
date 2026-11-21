import React from 'react';
import Renderer from 'react-test-renderer';
import type {Recommendation} from '../src/api';
import {photoFirstRecommendations} from '../src/recommendationOrder';
import UpcyclingIdeaChoices from '../src/UpcyclingIdeaChoices';

const text=(id:string):Recommendation=>({id,title:id,summary:'Example',steps:['Prepare.','Use.'],materials:[]});
const finished:Recommendation={...text('bowl'),photos:{version:'v1',source_id:'COCO-004',source_url:'https://example.com',credit:'Source',photo_rights:'Not verified for app reuse',finished:{url:'/api/tutorial-assets/bowl.jpg',source_stage:'finished',photo_status:'reference'},steps:[{url:null,step_index:0,source_stage:4,photo_status:'missing'}]}};
const process:Recommendation={...text('scoop'),photos:{...finished.photos!,steps:[{url:'/api/tutorial-assets/cut.jpg',step_index:0,source_stage:3,photo_status:'reference'}]}};

test('prefers usable process photos then finished photos, keeps ties and input unchanged',()=>{
  const original=[text('first'),finished,text('second'),process];
  expect(photoFirstRecommendations(original).map(idea=>idea.id)).toEqual(['scoop','bowl','first','second']);
  expect(original.map(idea=>idea.id)).toEqual(['first','bowl','second','scoop']);
  expect(photoFirstRecommendations([text('PET planter'),text('PET organizer')]).map(idea=>idea.id)).toEqual(['PET planter','PET organizer']);
});

test('missing photos, out-of-range step mapping and absent instructions do not get process priority',()=>{
  const invalid={...process,id:'invalid',photos:{...process.photos!,steps:[{...process.photos!.steps[0],step_index:9}]}};
  expect(photoFirstRecommendations([{...process,id:'no-steps',steps:[]},finished,invalid,process]).map(idea=>idea.id)).toEqual(['scoop','bowl','invalid','no-steps']);
});

test('shared task chooser renders photo choices first without changing chosen IDs',async()=>{
  const choose=jest.fn();let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<UpcyclingIdeaChoices material="Test fixture" ideas={[text('plain'),process,finished]} onChoose={choose}/>);});
  const content=JSON.stringify(tree.toJSON());
  expect(content.indexOf('Choose task: scoop')).toBeGreaterThan(-1);
  expect(content.indexOf('Choose task: scoop')).toBeLessThan(content.indexOf('Choose task: bowl'));
  expect(content.indexOf('Choose task: bowl')).toBeLessThan(content.indexOf('Choose task: plain'));
  const button=tree.root.findAllByProps({accessibilityLabel:'Choose task: scoop'}).find(node=>typeof node.props.onPress==='function')!;
  await Renderer.act(()=>button.props.onPress());
  expect(choose).not.toHaveBeenCalled();
  const confirm=tree.root.findAllByProps({accessibilityLabel:'Confirm project fit'}).find(node=>typeof node.props.onPress==='function')!;
  await Renderer.act(()=>confirm.props.onPress());
  expect(choose).toHaveBeenCalledWith('scoop');
  await Renderer.act(()=>tree.unmount());
});
