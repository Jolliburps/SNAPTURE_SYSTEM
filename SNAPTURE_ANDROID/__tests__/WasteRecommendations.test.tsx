import React from 'react';
import Renderer from 'react-test-renderer';
import SceneResults from '../src/SceneResults';
import SavedScanReview from '../src/SavedScanReview';
import { getScene, getSavedScan, type Prediction, type ScanScene } from '../src/api';

jest.mock('../src/api',()=>({getScene:jest.fn(),getSavedScan:jest.fn(),imageUrl:(uri:string)=>uri}));

function record(id:number, material:string):Prediction {
  const label=material==='Paper'?'paper':'hdpe_containers';
  return {id,title:material,decision:label,created_at:'2026-10-21T00:00:00Z',confidence:.9,input_method:'camera',recommendation_choices:[],assessment:{
    material:{label,status:'model_suggested'},segregation:{status:'available',category:null,instructions:[`${material}: saved sorting advice`],explanation:'Confirm material.'},
    management_guidance:{version:'management-reference-v1',material_label:material,status:'general_reference',notice:'General reference, not CESD approval.',source_checked_on:'2026-10-21',
      sections:[{key:'disposal',title:'Disposal Instructions',instructions:[`${material}: saved disposal advice`]},
        {key:'recovery',title:'Recycling and Reuse',instructions:[`${material}: saved reuse advice`]},
        {key:'safety',title:'Safety Tips',instructions:['Do not burn or melt.']}],
      sources:[{title:'Public reference',url:'https://www.epa.gov/recycle/how-do-i-recycle-common-recyclables'}]},
  }} as unknown as Prediction;
}
function scene(predictions:Prediction[]):ScanScene {
  return {id:50,image_url:'/saved.jpg',width:100,height:100,status:'complete',quality:{flags:[]},disposal_selection:{confirmed:true,item_ids:predictions.map(prediction=>prediction.id)},items:predictions.map(prediction=>({id:prediction.id,score:.9,name:prediction.title,box:[.1,.1,.4,.4],prediction,route:{key:'review',label:'Needs review',reason:'Confirm item.'}}))} as unknown as ScanScene;
}
function button(tree:Renderer.ReactTestRenderer,label:string){return tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!;}
async function press(tree:Renderer.ReactTestRenderer,label:string){await Renderer.act(async()=>button(tree,label).props.onPress());}
beforeEach(()=>jest.clearAllMocks());

test('expanded scan results keep item-specific sorting advice and omit the reference block',async()=>{
  const result=scene([record(1,'Paper'),record(2,'HDPE')]);
  (getScene as jest.Mock).mockResolvedValue({scene:result});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={result} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  await press(tree,'Select item 1 card');
  const screen=JSON.stringify(tree.toJSON());
  expect(screen).toContain('Paper: saved sorting advice');
  expect(screen).not.toContain('HDPE: saved sorting advice');
  expect(screen).not.toContain('Detailed recommendations');
  expect(screen).not.toContain('Paper: saved reuse advice');
  await Renderer.act(()=>tree.unmount());
});

test.each([false,true])('history uses selected saved item, never latest scan; scene=%s',async grouped=>{
  (getSavedScan as jest.Mock).mockImplementation(async(id:number)=>{
    const prediction=record(id,id===1?'Paper':'HDPE');
    return {prediction,scene:grouped?scene([prediction]):null};
  });
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SavedScanReview id={1} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  if(!grouped)await press(tree,'Expand saved item details');
  expect(JSON.stringify(tree.toJSON())).toContain('Paper: saved sorting advice');
  await Renderer.act(async()=>tree.update(<SavedScanReview id={2} onBack={jest.fn()} onRetry={jest.fn()}/>));
  if(!grouped)await press(tree,'Expand saved item details');
  expect(JSON.stringify(tree.toJSON())).toContain('HDPE: saved sorting advice');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Paper: saved sorting advice');
  expect(getScene).not.toHaveBeenCalled();
  await Renderer.act(()=>tree.unmount());
});
