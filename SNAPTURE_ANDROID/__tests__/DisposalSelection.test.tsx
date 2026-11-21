import React from 'react';
import Renderer from 'react-test-renderer';
import SceneResults from '../src/SceneResults';
import ScanResult from '../src/ScanResult';
import {upcyclingRequest} from '../src/upcyclingApi';
import {confirmDisposalSelection,getScene,type ScanScene} from '../src/api';

jest.mock('../src/upcyclingApi',()=>({upcyclingRequest:jest.fn().mockResolvedValue({snapshot:null}),getSuggestions:jest.fn().mockResolvedValue({items:[],message:'Assessment pending',facts:{}}),getVisual:jest.fn().mockResolvedValue({assessment:{primary:{status:'unavailable'},observations:[],conflicts:[],views:[],facts:{}}})}));
jest.mock('../src/api',()=>({getScene:jest.fn(),confirmDisposalSelection:jest.fn(),imageUrl:(uri:string)=>uri}));
const makeScene=()=>({id:80,image_url:'/original80.jpg',width:200,height:100,status:'complete',quality:{flags:[]},disposal_selection:{confirmed:false,item_ids:[]},items:[
  {id:1,name:'plastic bottle',score:.7,box:[.1,.1,.4,.4],prediction:{id:101,decision:'pete_bottles',input_method:'camera',recommendation_choices:[]},route:{label:'Needs review',reason:'Unconfirmed'}},
  {id:2,name:'towel',score:.6,box:[.1,.1,.8,.8],prediction:{id:102,decision:'fabric_scraps',input_method:'camera',recommendation_choices:[]},route:{label:'Needs review',reason:'Unconfirmed'}},
]} as unknown as ScanScene);
function action(tree:Renderer.ReactTestRenderer,label:string){return tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!;}
async function press(tree:Renderer.ReactTestRenderer,label:string){await Renderer.act(async()=>{await action(tree,label).props.onPress();});}
async function render(initial=makeScene()){
  (getScene as jest.Mock).mockResolvedValue({scene:initial});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={initial} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  return tree;
}
beforeEach(()=>jest.clearAllMocks());

test('single framed material goes directly to shared assessment rather than detector confirmation',async()=>{
  const initial=makeScene();initial.items=initial.items.slice(1);initial.single_item={enabled:true};
  const review=jest.fn();const tree=await render(initial);
  expect(tree.root.findByType(ScanResult).props.prediction).toEqual(initial.items[0].prediction);
  expect(action(tree,'Check material')).toBeUndefined();
  expect(action(tree,'Continue with 0 selected items')).toBeUndefined();
  expect(confirmDisposalSelection).not.toHaveBeenCalled();
  expect(review).not.toHaveBeenCalled();
  await Renderer.act(()=>tree.unmount());
});

test('failed shared assessment keeps the framed item available for retry',async()=>{
  const initial=makeScene();initial.items=initial.items.slice(1);initial.single_item={enabled:true};
  (upcyclingRequest as jest.Mock).mockRejectedValueOnce(new Error('Connection lost. Try again.')).mockResolvedValue({snapshot:null});
  const tree=await render(initial);
  expect(JSON.stringify(tree.toJSON())).toContain('Connection lost. Try again.');
  expect(tree.root.findByType(ScanResult).props.prediction.id).toBe(initial.items[0].prediction.id);
  await press(tree,'Retry scan result');
  expect(action(tree,'Retry scan result')).toBeUndefined();
  expect(confirmDisposalSelection).not.toHaveBeenCalled();
  await Renderer.act(()=>tree.unmount());
});

test('items are included for automatic guidance without action choices; box and list agree',async()=>{
  const tree=await render();
  expect(action(tree,'Continue with 0 selected items').props.disabled).toBe(true);
  expect(action(tree,'Select box 1').props.accessibilityState.checked).toBe(false);
  await press(tree,'Select box 1');
  expect(action(tree,'Select item 1: PETE Bottles (Polyethylene Terephthalate)').props.accessibilityState.checked).toBe(true);
  expect(action(tree,'Keep item 1')).toBeUndefined();
  expect(action(tree,'Discard item 1')).toBeUndefined();
  expect(action(tree,'Recycle / upcycle item 1')).toBeUndefined();
  await press(tree,'Select item 1: PETE Bottles (Polyethylene Terephthalate)');
  expect(action(tree,'Select box 1').props.accessibilityState.checked).toBe(false);
  expect(confirmDisposalSelection).not.toHaveBeenCalled();
  await Renderer.act(()=>tree.unmount());
});

test('only selected categories and reported conditions are submitted without rewriting object names',async()=>{
  const tree=await render();
  await press(tree,'Select item 1: PETE Bottles (Polyethylene Terephthalate)');await press(tree,'Select item 2: Fabric Scraps');
  await press(tree,'Clean & dry condition item 2');
  expect(action(tree,'Correct name item 2')).toBeUndefined();
  const result=makeScene();result.disposal_selection={confirmed:true,item_ids:[1,2]};
  (confirmDisposalSelection as jest.Mock).mockResolvedValue({scene:result});
  await press(tree,'Continue with 2 selected items');
  expect(confirmDisposalSelection).toHaveBeenCalledWith(80,[1,2],{},undefined,{1:'Not sure',2:'Clean and dry'},true);
  expect(result.items[1].name).toBe('towel');
  expect(action(tree,'Change selected items')).toBeDefined();
  await press(tree,'Change selected items');
  expect(action(tree,'Select item 2: Fabric Scraps').props.accessibilityState.checked).toBe(true);
  await press(tree,'Select item 2: Fabric Scraps');
  expect(action(tree,'Continue with 1 selected item').props.disabled).toBe(false);
  await Renderer.act(()=>tree.unmount());
});

test('failure keeps selection and corrections, without showing success or navigating',async()=>{
  const tree=await render();await press(tree,'Select item 1: PETE Bottles (Polyethylene Terephthalate)');
  (confirmDisposalSelection as jest.Mock).mockRejectedValue(new Error('Connection lost. Try again.'));
  await press(tree,'Continue with 1 selected item');
  expect(JSON.stringify(tree.toJSON())).toContain('Connection lost. Try again.');
  expect(action(tree,'Select item 1: PETE Bottles (Polyethylene Terephthalate)').props.accessibilityState.checked).toBe(true);
  expect(action(tree,'Continue with 1 selected item').props.disabled).toBe(false);
  expect(tree.root.findAllByProps({accessibilityLabel:'Change selected items'})).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});

test('double confirmation sends one request while busy',async()=>{
  const tree=await render();await press(tree,'Select item 1: PETE Bottles (Polyethylene Terephthalate)');
  let finish!:(result:{scene:ScanScene})=>void;
  (confirmDisposalSelection as jest.Mock).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  await Renderer.act(()=>{const node=action(tree,'Continue with 1 selected item');node.props.onPress();node.props.onPress();});
  expect(confirmDisposalSelection).toHaveBeenCalledTimes(1);
  const result=makeScene();result.disposal_selection={confirmed:true,item_ids:[1]};
  await Renderer.act(async()=>finish({scene:result}));
  expect(action(tree,'Change selected items')).toBeDefined();
  await Renderer.act(()=>tree.unmount());
});

test('special handling does not expose material reuse or an unrelated guide',async()=>{
  const initial=makeScene();initial.disposal_selection={confirmed:true,item_ids:[1]};
  initial.items[0].handling={route:'special_handling',title:'Requires special handling',explanation:'Possible electronics',instructions:['Ask CESD about an accepting electronics service.'],sources:[],recommendations:[],verification_status:'no_project_approval'} as unknown as NonNullable<typeof initial.items[0]['handling']>;
  initial.items[0].prediction.recommendation_choices=[{id:'wrong',title:'Paper craft',summary:'',materials:[],steps:['Wrong project']}];
  const tree=await render(initial);
  expect(JSON.stringify(tree.toJSON())).toContain('Ask local waste service about an accepting electronics service.');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Paper craft');
  expect(tree.root.findAllByProps({accessibilityLabel:'Review item 1'})).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});

test('opening saved intent does not write selections or run detection',async()=>{
  const initial=makeScene();initial.disposal_selection={confirmed:true,item_ids:[2]};
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={initial} historical onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(getScene).not.toHaveBeenCalled();expect(confirmDisposalSelection).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({accessibilityLabel:'Select item 1 card'})).toHaveLength(0);
  expect(action(tree,'Select item 2 card')).toBeDefined();
  await Renderer.act(()=>tree.unmount());
});
