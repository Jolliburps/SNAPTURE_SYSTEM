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

test('Learn opens its existing educational topics immediately without rendering/loading the CESD library',async()=>{
  (getLearningInformation as jest.Mock).mockClear();
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<Harness initial="learn"/>);});
  expect(tree.root.findAllByType(CESDLearning)).toHaveLength(0);
  expect(getLearningInformation).not.toHaveBeenCalled();
  for(const title of ['Waste segregation','Disposal guidelines','Prohibited waste','Local policies','Recycling facilities'])expect(JSON.stringify(tree.toJSON())).toContain(title);
  for(const removed of ['Everyday practices','Published policies and materials','General learning tips are not item-specific'])expect(JSON.stringify(tree.toJSON())).not.toContain(removed);
  const title=tree.root.findAll(node=>node.props.children==='Waste segregation')[0];
  let parent=title.parent;while(parent && !parent.props.onPress)parent=parent.parent;
  await Renderer.act(()=>parent?.props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Open Waste materials');
  await Renderer.act(()=>tree.unmount());
});

test('Home omits recent scans, resources and collection schedule while retaining projects and ideas',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<Harness initial="home"/>);});
  expect(tree.root.findAllByType(CESDLearning)).toHaveLength(0);
  const content=JSON.stringify(tree.toJSON());
  for(const removed of ['Recent scan','Resources','CESD reference library','Collection schedule','View calendar'])expect(content).not.toContain(removed);
  expect(content).toContain('Ongoing projects');
  expect(content).toContain('Ideas for a greener tomorrow');
  await Renderer.act(()=>tree.unmount());
});
