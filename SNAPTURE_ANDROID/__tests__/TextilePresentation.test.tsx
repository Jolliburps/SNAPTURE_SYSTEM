import React from 'react';
import Renderer from 'react-test-renderer';
import DisposalObjectRow from '../src/DisposalObjectRow';
import SceneResults from '../src/SceneResults';
import {getScene,type SceneItem,type ScanScene} from '../src/api';
import {sceneItemTitle} from '../src/detectionPresentation';

jest.mock('../src/api',()=>({getScene:jest.fn(),imageUrl:(value:string)=>value}));
const item={id:1,name:'towel',display_name:'Possible fabric item',name_confirmation_required:true,score:.302,box:[.004,.258,.765,1],display_box:false,detection_status:'review',review_reason:'Possible fabric item—exact object needs confirmation.',prediction:{id:189,recommendation_choices:[]},route:{reason:'Confirm item'}} as unknown as SceneItem;
const button=(tree:Renderer.ReactTestRenderer,label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function');

test('borderline towel uses a generic title; raw guess is shown only in name-correction details',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  const props={item,number:1,color:'#176b45',checked:false,name:'',onToggle:jest.fn(),onName:jest.fn(),onDetails:jest.fn()};
  await Renderer.act(()=>{tree=Renderer.create(<DisposalObjectRow {...props}/>);});
  expect(button(tree,'Select item 1: Possible fabric item')).toBeDefined();
  expect(button(tree,'Select item 1: towel')).toBeUndefined();
  expect(JSON.stringify(tree.toJSON())).not.toContain('Original model guess');
  await Renderer.act(()=>button(tree,'Correct name item 1')!.props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Original model guess (not confirmed): ');
  await Renderer.act(()=>tree.update(<DisposalObjectRow {...props} name="blanket"/>));
  expect(button(tree,'Select item 1: blanket')).toBeDefined();
  expect(item.name).toBe('towel');
  await Renderer.act(()=>tree.unmount());
});

test('towel regression has no match box even when its review card is opened',async()=>{
  const scene={id:40,image_url:'/photo.jpg',width:100,height:100,status:'complete',quality:{flags:[]},items:[item]} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('No reliable object match');
  await Renderer.act(()=>button(tree,'Show uncertain suggestions (1)')!.props.onPress());
  expect(button(tree,'Select item 1: Possible fabric item')).toBeDefined();
  expect(button(tree,'Select box 1')).toBeUndefined();
  await Renderer.act(()=>tree.unmount());
});

test('reported names take priority while legacy non-textile display remains compatible',()=>{
  expect(sceneItemTitle(item,'pillow')).toBe('pillow');
  expect(sceneItemTitle({...item,identification:{user_object_name:'bed sheet'} as SceneItem['identification']})).toBe('bed sheet');
  expect(sceneItemTitle({...item,name:'metal can',display_name:undefined})).toBe('metal can');
});

test('handling confirmation opens the object-name field instead of an unrelated material-only form',async()=>{
  const pending={...item,action_advice:{chosen_action:'recover',status:'needs_information',title:'Check the object first',steps:[],projects:[],sources:[],waste_group:'unconfirmed'}} as unknown as SceneItem;
  const scene={id:40,image_url:'/photo.jpg',width:100,height:100,status:'complete',quality:{flags:[]},items:[pending],disposal_selection:{confirmed:true,item_ids:[1]}} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  const review=jest.fn();let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()} onReview={review}/>);});
  await Renderer.act(()=>button(tree,'Check details for item 1')!.props.onPress());
  expect(review).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({accessibilityLabel:'Correct object name 1'}).some(node=>typeof node.props.onChangeText==='function')).toBe(true);
  expect(button(tree,'Select box 1')).toBeUndefined();
  await Renderer.act(()=>tree.unmount());
});
