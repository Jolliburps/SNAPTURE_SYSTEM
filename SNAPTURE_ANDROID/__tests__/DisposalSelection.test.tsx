import React from 'react';
import Renderer from 'react-test-renderer';
import SceneResults from '../src/SceneResults';
import {confirmDisposalSelection,getScene,type ScanScene} from '../src/api';

jest.mock('../src/api',()=>({getScene:jest.fn(),confirmDisposalSelection:jest.fn(),imageUrl:(uri:string)=>uri}));
const makeScene=()=>({id:80,image_url:'/original80.jpg',width:200,height:100,status:'complete',quality:{flags:[]},disposal_selection:{confirmed:false,item_ids:[]},items:[
  {id:1,name:'mobile phone',score:.7,background:true,box:[.1,.1,.4,.4],prediction:{id:101,input_method:'camera',recommendation_choices:[]},route:{label:'Needs review',reason:'Unconfirmed'}},
  {id:2,name:'towel',score:.6,box:[.1,.1,.8,.8],prediction:{id:102,input_method:'camera',recommendation_choices:[]},route:{label:'Needs review',reason:'Unconfirmed'}},
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

test('nothing is waste by default, including a phone; box and list selection agree',async()=>{
  const tree=await render();
  expect(action(tree,'Continue with 0 selected items').props.disabled).toBe(true);
  expect(action(tree,'Select box 1').props.accessibilityState.checked).toBe(false);
  await press(tree,'Select box 1');
  expect(action(tree,'Discard item 1: mobile phone').props.accessibilityState.checked).toBe(true);
  await press(tree,'Discard item 1: mobile phone');
  expect(action(tree,'Select box 1').props.accessibilityState.checked).toBe(false);
  expect(confirmDisposalSelection).not.toHaveBeenCalled();
  await Renderer.act(()=>tree.unmount());
});

test('only confirmed selections are submitted; corrections stay separate from original names',async()=>{
  const tree=await render();
  await press(tree,'Discard item 1: mobile phone');await press(tree,'Discard item 2: towel');
  await press(tree,'Correct name item 2');
  await Renderer.act(()=>{tree.root.findAllByProps({accessibilityLabel:'Correct object name 2'}).find(node=>node.props.onChangeText)?.props.onChangeText('bath towel');});
  const result=makeScene();result.disposal_selection={confirmed:true,item_ids:[1,2]};
  (confirmDisposalSelection as jest.Mock).mockResolvedValue({scene:result});
  await press(tree,'Continue with 2 selected items');
  expect(confirmDisposalSelection).toHaveBeenCalledWith(80,[1,2],{1:'',2:'bath towel'});
  expect(result.items[1].name).toBe('towel');
  expect(action(tree,'Change selected items')).toBeDefined();
  await press(tree,'Change selected items');
  expect(action(tree,'Discard item 2: bath towel').props.accessibilityState.checked).toBe(true);
  await press(tree,'Discard item 2: bath towel');
  expect(action(tree,'Continue with 1 selected item').props.disabled).toBe(false);
  await Renderer.act(()=>tree.unmount());
});

test('failure keeps selection and corrections, without showing success or navigating',async()=>{
  const tree=await render();await press(tree,'Select box 1');
  (confirmDisposalSelection as jest.Mock).mockRejectedValue(new Error('Connection lost. Try again.'));
  await press(tree,'Continue with 1 selected item');
  expect(JSON.stringify(tree.toJSON())).toContain('Connection lost. Try again.');
  expect(action(tree,'Discard item 1: mobile phone').props.accessibilityState.checked).toBe(true);
  expect(action(tree,'Continue with 1 selected item').props.disabled).toBe(false);
  expect(tree.root.findAllByProps({accessibilityLabel:'Change selected items'})).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});

test('double confirmation sends one request while busy',async()=>{
  const tree=await render();await press(tree,'Select box 1');
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
  expect(JSON.stringify(tree.toJSON())).toContain('Ask CESD about an accepting electronics service.');
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
