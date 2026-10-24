import React from 'react';
import Renderer from 'react-test-renderer';
import ScanUpcyclingIdeas from '../src/ScanUpcyclingIdeas';
import SceneResults from '../src/SceneResults';
import {getScene,startProject,type Prediction,type ScanScene} from '../src/api';
import {ProjectFlowContext} from '../src/ProjectFlowContext';

jest.mock('../src/api',()=>({getScene:jest.fn(),startProject:jest.fn(),imageUrl:(uri:string)=>uri}));
const prediction={id:12,title:'Paper',recommendation_choices:[],upcycling_ideas:[
  {id:'paper_wrap',title:'Gift wrapping',summary:'Reuse a clean sheet.',materials:['Paper','String'],safety_note:'Use clean, dry paper.',steps:['Flatten the paper.','Wrap the gift.','Tie with string.']},
]} as unknown as Prediction;
function action(tree:Renderer.ReactTestRenderer,label:string){return tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!;}
async function press(tree:Renderer.ReactTestRenderer,label:string){await Renderer.act(()=>action(tree,label).props.onPress());}

test('choosing a task saves a project and opens its persistent guide',async()=>{
  const project={id:8,title:'Gift wrapping',steps:['Flatten the paper.']};
  const open=jest.fn();
  (startProject as jest.Mock).mockResolvedValue({project});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<ProjectFlowContext.Provider value={open}><ScanUpcyclingIdeas prediction={prediction}/></ProjectFlowContext.Provider>);});
  await press(tree,'Choose task: Gift wrapping');
  expect(startProject).toHaveBeenCalledWith(12,'paper_wrap');
  expect(open).toHaveBeenCalledWith(project);
  await Renderer.act(()=>tree.unmount());
});

test('scan result shows ideas before disposal selection or any review questionnaire',async()=>{
  const scene={id:8,image_url:'',width:200,height:200,status:'complete',quality:{flags:[]},items:[
    {id:1,name:'Paper',box:[0,0,1,1],score:0,display_box:false,prediction,route:{reason:'Review the item.'}},
  ]} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(action(tree,'Continue with 0 selected items').props.disabled).toBe(true);
  expect(action(tree,'Choose task: Gift wrapping')).toBeDefined();
  await Renderer.act(()=>tree.unmount());
});

test('a failed project save keeps the task choices and does not navigate',async()=>{
  const open=jest.fn();
  (startProject as jest.Mock).mockRejectedValue(new Error('Connection lost'));
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<ProjectFlowContext.Provider value={open}><ScanUpcyclingIdeas prediction={prediction}/></ProjectFlowContext.Provider>);});
  await press(tree,'Choose task: Gift wrapping');
  expect(open).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Connection lost');
  expect(action(tree,'Choose task: Gift wrapping').props.disabled).toBe(false);
  await Renderer.act(()=>tree.unmount());
});

test('unidentified material with no ideas does not display a made-up guide',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<ScanUpcyclingIdeas prediction={{...prediction,upcycling_ideas:[]}}/>);});
  expect(tree.toJSON()).toBeNull();
  await Renderer.act(()=>tree.unmount());
});
