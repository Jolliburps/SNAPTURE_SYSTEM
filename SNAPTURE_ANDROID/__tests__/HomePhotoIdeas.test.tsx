import React from 'react';
import Renderer from 'react-test-renderer';
import {Image} from 'react-native';
import {MainExperience} from '../src/MainExperience';
import IdeaDetails from '../src/IdeaDetails';
import {getMaterials,type IdeaReference} from '../src/api';

jest.mock('../src/localUpdates',()=>({getLocalUpdates:jest.fn().mockResolvedValue([])}));
jest.mock('../src/api',()=>({
  ...jest.requireActual('../src/api'),
  getMaterials:jest.fn(),getPredictionOverview:jest.fn().mockResolvedValue({predictions:[],total_count:0}),
  listSavedPredictions:jest.fn().mockResolvedValue([]),listProjects:jest.fn().mockResolvedValue([]),
}));
const bowl:IdeaReference={id:'coconut_bowl',title:'Decorative bowl',summary:'Use a prepared shell.',materials:['Shell'],steps:['Clean.','Smooth.','Use.'],status:'educational',can_start:false,source:'https://example.com/bowl',review_note:'Not expert approved.',conditions:[],
  photos:{version:'v1',source_id:'COCO-004',source_url:'https://example.com/bowl',credit:'Creator',photo_rights:'Not verified for app reuse',finished:{url:'/api/tutorial-assets/bowl.jpg',source_stage:'finished',photo_status:'reference'},steps:[{url:null,source_stage:4,step_index:0,photo_status:'Dedicated process photo needed'}]}};
const scoop:IdeaReference={...bowl,id:'hdpe_scoop',title:'Garden scoop',photos:{...bowl.photos!,finished:{...bowl.photos!.finished,url:'/api/tutorial-assets/scoop.jpg'},steps:[{url:'/api/tutorial-assets/cut.jpg',source_stage:3,step_index:0,photo_status:'reference'}]}};
test('Home puts exact photo matches first, renders thumbnails, and opens saved reference text/photos',async()=>{
  (getMaterials as jest.Mock).mockResolvedValue({materials:[
    {label:'pete_bottles',title:'PETE bottle',upcycling:[],idea_references:[{...bowl,id:'pending:pete',title:'PET concept',status:'awaiting_review',steps:[],photos:undefined}]},
    {label:'coconut_shells',title:'Coconut shells',upcycling:[],photo_ideas:[bowl]},
    {label:'hdpe_containers',title:'HDPE container',upcycling:[],photo_ideas:[scoop]},
  ]});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<MainExperience screen="home" navigate={jest.fn()} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()}/>);});
  const cards=tree.root.findAll(node=>typeof node.type==='function' && node.type.name==='IdeaCard');
  expect(cards.map(card=>card.props.idea.id)).toEqual(['hdpe_scoop','coconut_bowl','pending:pete']);
  expect(tree.root.findAllByType(Image).map(img=>img.props.source.uri)).toEqual(expect.arrayContaining([
    'http://127.0.0.1:8000/api/tutorial-assets/scoop.jpg','http://127.0.0.1:8000/api/tutorial-assets/bowl.jpg',
  ]));
  await Renderer.act(()=>cards[0].props.onPress());
  expect(tree.root.findByType(IdeaDetails).props.idea.steps).toEqual(scoop.steps);
  expect(JSON.stringify(tree.toJSON())).toContain('Educational idea');
  expect(JSON.stringify(tree.toJSON())).toContain('Not verified for app reuse');
  await Renderer.act(()=>tree.unmount());
});

test('separate Home tutorials take priority without offering a tracked Start action',async()=>{
  const tutorial={...scoop,id:'tutorial:PET-003:v1',title:'Self-watering bottle planter'};
  (getMaterials as jest.Mock).mockResolvedValue({materials:[
    {label:'pete_bottles',title:'PETE bottles',upcycling:[],home_tutorials:[tutorial]},
    {label:'hdpe_containers',title:'HDPE',upcycling:[],photo_ideas:[scoop]},
  ]});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<MainExperience screen="home" navigate={jest.fn()} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()}/>);});
  const cards=tree.root.findAll(node=>typeof node.type==='function' && node.type.name==='IdeaCard');
  expect(cards.map(card=>card.props.idea.id)).toEqual([tutorial.id]);
  await Renderer.act(()=>cards[0].props.onPress());
  expect(tree.root.findByType(IdeaDetails).props.idea.id).toBe(tutorial.id);
  expect(tree.root.findAllByProps({accessibilityLabel:'Start project'})).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});
