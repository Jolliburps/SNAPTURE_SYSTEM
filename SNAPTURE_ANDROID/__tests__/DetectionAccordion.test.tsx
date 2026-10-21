import React from 'react';
import { StyleSheet, Text } from 'react-native';
import Renderer from 'react-test-renderer';
import SceneResults from '../src/SceneResults';
import DetectionItemCard from '../src/DetectionItemCard';
import { getScene, type ScanScene } from '../src/api';

jest.mock('../src/api',()=>({getScene:jest.fn(),imageUrl:(uri:string)=>uri}));

function sampleScene():ScanScene {
  return {id:41,image_url:'/original.jpg',width:800,height:600,status:'complete',quality:{flags:[]},items:[
    {id:10,name:'A long cardboard item name that should remain fully readable on a narrow phone',score:.9,box:[.1,.1,.4,.4],display_group:'recyclable',route:{key:'recyclable',label:'Accepted by a collector',reason:'Exact material checked.'},prediction:{id:100,title:'Cardboard',image_url:'/crop10.jpg',assessment:{material:{status:'user_selected'},segregation:{instructions:['Keep this cardboard dry.']}},recommendation_choices:[{id:'paper-wrap',title:'Reuse as wrapping'}]}},
    {id:20,name:'Unidentified object',score:.1,box:[.5,.2,.8,.5],display_group:'review',low_confidence:true,background:true,route:{key:'review',label:'Needs review',reason:'Confirm the object.'},prediction:{id:200,title:'Unknown',assessment:{material:{status:'needs_confirmation'},segregation:{instructions:[]}},recommendation_choices:[]}},
  ]} as unknown as ScanScene;
}
function action(tree:Renderer.ReactTestRenderer,label:string) {
  return tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!;
}
async function press(tree:Renderer.ReactTestRenderer,label:string) {
  await Renderer.act(async()=>{action(tree,label).props.onPress();});
}
async function render(scene:ScanScene=sampleScene(),onOpenGuide?:jest.Mock) {
  (getScene as jest.Mock).mockResolvedValue({scene});
  const onReview=jest.fn(),onBack=jest.fn(),onRetry=jest.fn();let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onReview={onReview} onBack={onBack} onRetry={onRetry} onOpenGuide={onOpenGuide}/>);});
  return {tree,onReview,onBack,onRetry,scene};
}

test('every item starts compact with its full name and group visible, then expands independently', async()=>{
  const {tree,scene}=await render();
  expect(tree.root.findAllByType(DetectionItemCard)).toHaveLength(2);
  expect(JSON.stringify(tree.toJSON())).toContain(scene.items[0].name);
  expect(JSON.stringify(tree.toJSON())).toContain('Recyclable / reusable');
  expect(JSON.stringify(tree.toJSON())).toContain('Possible background object');
  expect(action(tree,'Select item 1 card').props.accessibilityState.expanded).toBe(false);
  expect(tree.root.findAllByProps({accessibilityLabel:'Review item 1'})).toHaveLength(0);
  await press(tree,'Select item 1 card');
  expect(action(tree,'Select item 1 card').props.accessibilityState.expanded).toBe(true);
  expect(action(tree,'Select item 2 card').props.accessibilityState.expanded).toBe(false);
  expect(JSON.stringify(tree.toJSON())).toContain('Keep this cardboard dry.');
  await press(tree,'Select item 2 card');
  expect(action(tree,'Select item 1 card').props.accessibilityState.expanded).toBe(true);
  expect(action(tree,'Select item 2 card').props.accessibilityState.expanded).toBe(true);
  await press(tree,'Select item 1 card');
  expect(action(tree,'Select item 1 card').props.accessibilityState.expanded).toBe(false);
  expect(action(tree,'Select item 2 card').props.accessibilityState.expanded).toBe(true);
  await Renderer.act(()=>tree.unmount());
});

test('numbered boxes expand the correct item and all existing actions retain their data', async()=>{
  const openGuide=jest.fn().mockResolvedValue(undefined);
  const {tree,scene,onReview,onBack,onRetry}=await render(sampleScene(),openGuide);
  await press(tree,'Select box 2');
  expect(action(tree,'Select item 2 card').props.accessibilityState).toMatchObject({expanded:true,selected:true});
  await press(tree,'Review item 2');
  expect(onReview).toHaveBeenCalledWith(scene.items[1].prediction);
  await press(tree,'Select item 1 card');
  await press(tree,'Open guide: Reuse as wrapping');
  expect(openGuide).toHaveBeenCalledWith(scene.items[0].prediction,'paper-wrap');
  await press(tree,'Show item 1 in photo');
  expect(action(tree,'Select box 1').props.accessibilityState.selected).toBe(true);
  expect(action(tree,'Select item 1 card').props.accessibilityState.expanded).toBe(true);
  await press(tree,'Back');await press(tree,'Scan another photo');
  expect(onBack).toHaveBeenCalledTimes(1);expect(onRetry).toHaveBeenCalledTimes(1);
  expect(action(tree,'Mark a missed item')).toBeDefined();
  await Renderer.act(()=>tree.unmount());
});

test('a guide error keeps item details available and uses the existing error message',async()=>{
  const {tree}=await render(sampleScene(),jest.fn().mockRejectedValue(new Error('Unable to load guide.')));
  await press(tree,'Select item 1 card');await press(tree,'Open guide: Reuse as wrapping');
  expect(JSON.stringify(tree.toJSON())).toContain('Unable to load guide.');
  expect(action(tree,'Select item 1 card').props.accessibilityState.expanded).toBe(true);
  expect(action(tree,'Open guide: Reuse as wrapping').props.disabled).toBe(false);
  await Renderer.act(()=>tree.unmount());
});

test('names wrap without truncation, classification text is readable, and item actions have large targets',async()=>{
  const {tree,scene}=await render();
  const name=tree.root.findAllByType(Text).find(node=>node.props.children===scene.items[0].name)!;
  expect(name.props.numberOfLines).toBeUndefined();expect(name.props.allowFontScaling).not.toBe(false);
  expect(StyleSheet.flatten(name.props.style).fontSize).toBeGreaterThanOrEqual(18);
  const category=tree.root.findAllByType(Text).find(node=>node.props.children==='Recyclable / reusable')!;
  expect(StyleSheet.flatten(category.props.style).fontSize).toBeGreaterThanOrEqual(16);
  expect(StyleSheet.flatten(action(tree,'Select item 1 card').props.style).minHeight).toBeGreaterThanOrEqual(44);
  await press(tree,'Select item 1 card');
  expect(StyleSheet.flatten(action(tree,'Review item 1').props.style).minHeight).toBeGreaterThanOrEqual(44);
  await Renderer.act(()=>tree.unmount());
});

test('empty and processing results keep their existing feedback without empty accordion cards',async()=>{
  const empty={...sampleScene(),items:[]};
  const {tree}=await render(empty);
  expect(tree.root.findAllByType(DetectionItemCard)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('No clear waste items found');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Detected items');
  await Renderer.act(()=>tree.unmount());
  const processing={...empty,status:'processing'} as ScanScene;
  const next=await render(processing);
  expect(JSON.stringify(next.tree.toJSON())).toContain('Analyzing this photo...');
  await Renderer.act(()=>next.tree.unmount());
});
