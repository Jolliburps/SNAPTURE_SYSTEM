import React, { useState } from 'react';
import Renderer from 'react-test-renderer';
import { MainExperience, type MainRoute } from '../src/MainExperience';
import CESDLearning from '../src/CESDLearning';
import { getLearningInformation } from '../src/api';

jest.mock('../src/localUpdates',()=>({getLocalUpdates:jest.fn().mockResolvedValue([])}));
jest.mock('../src/api',()=>({getMaterials:jest.fn().mockResolvedValue({materials:[]}),getPredictionOverview:jest.fn().mockResolvedValue({predictions:[],total_count:0}),listSavedPredictions:jest.fn().mockResolvedValue([]),listProjects:jest.fn().mockResolvedValue([]),getLearningInformation:jest.fn().mockResolvedValue({entries:[]})}));
function Harness({initial}:{initial:MainRoute}){
  const [screen,navigate]=useState(initial);
  return <MainExperience screen={screen} navigate={navigate} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()}/>;
}
function action(tree:Renderer.ReactTestRenderer,label:string){return tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!;}

test('Learn opens its existing educational topics immediately without rendering/loading the CESD library',async()=>{
  (getLearningInformation as jest.Mock).mockClear();
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<Harness initial="learn"/>);});
  expect(tree.root.findAllByType(CESDLearning)).toHaveLength(0);
  expect(getLearningInformation).not.toHaveBeenCalled();
  for(const title of ['Waste segregation','Disposal guidelines','Prohibited waste','Local policies','Recycling facilities','Everyday practices'])expect(JSON.stringify(tree.toJSON())).toContain(title);
  const title=tree.root.findAll(node=>node.props.children==='Waste segregation')[0];
  let parent=title.parent;while(parent && !parent.props.onPress)parent=parent.parent;
  await Renderer.act(()=>parent?.props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Open Waste materials');
  await Renderer.act(()=>tree.unmount());
});

test('one dedicated Home card opens the existing CESD library and its Back action returns Home',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<Harness initial="home"/>);});
  expect(tree.root.findAllByType(CESDLearning)).toHaveLength(0);
  await Renderer.act(async()=>action(tree,'Open CESD reference library').props.onPress());
  expect(tree.root.findAllByType(CESDLearning)).toHaveLength(1);
  expect(JSON.stringify(tree.toJSON())).toContain('not live announcements or CESD approval');
  const back=tree.root.findAll(node=>typeof node.type==='function' && node.type.name==='BackHeader')[0];
  await Renderer.act(async()=>back.props.onBack());
  expect(action(tree,'Open CESD reference library')).toBeDefined();
  await Renderer.act(()=>tree.unmount());
});
