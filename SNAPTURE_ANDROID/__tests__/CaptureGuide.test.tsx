import React from 'react';
import Renderer from 'react-test-renderer';
import {StyleSheet,View} from 'react-native';
import CaptureGuide,{cameraGuideFrame,FramedPhotoPreview,GALLERY_FRAME} from '../src/CaptureGuide';
import SceneResults from '../src/SceneResults';
import {getScene,type ScanScene} from '../src/api';

jest.mock('../src/api',()=>({getScene:jest.fn(),imageUrl:(value:string)=>value}));

test.each([[400,600],[600,400],[320,320]])('guide is a centered square on a %sx%s preview', (width,height)=>{
  const frame=cameraGuideFrame(width,height)!;
  expect(frame.width*width).toBeCloseTo(frame.height*height);
  expect(frame.x+frame.width/2).toBeCloseTo(.5);
  expect(frame.y+frame.height/2).toBeCloseTo(.5);
  expect(frame.aspect).toBe(width/height);
});

test('capture waits for a valid layout; gallery uses the reviewed center square',()=>{
  expect(cameraGuideFrame(0,600)).toBeUndefined();
  expect(cameraGuideFrame(400,NaN)).toBeUndefined();
  expect(GALLERY_FRAME).toEqual({aspect:1,x:0,y:0,width:1,height:1});
});

test('review keeps the capture aspect even in a narrower screen',async()=>{
  const frame=cameraGuideFrame(600,400)!;
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<FramedPhotoPreview uri="file:///photo.jpg" frame={frame}/>);});
  const outer=tree.root.findAllByType(View).find(node=>node.props.onLayout)!;
  await Renderer.act(()=>outer.props.onLayout({nativeEvent:{layout:{width:240}}}));
  const inner=tree.root.findAllByType(View).find(node=>{const style=StyleSheet.flatten(node.props.style);return style?.backgroundColor==='#000';})!;
  const style=StyleSheet.flatten(inner.props.style);
  expect(style.width/style.height).toBeCloseTo(frame.aspect);
  expect(style.width).toBeLessThanOrEqual(240);
  expect(tree.root.findByType(CaptureGuide).props.frame).toEqual(frame);
  await Renderer.act(()=>tree.unmount());
});

test('single-item results cannot add more regions or select multiple items',async()=>{
  const scene={id:7,image_url:'/frame.jpg',width:200,height:200,status:'complete',quality:{flags:[]},single_item:{enabled:true},items:[1,2].map(id=>({id,name:'paper scrap',score:.8,box:[.1,.1,.9,.9],prediction:{id,recommendation_choices:[]},route:{reason:'Check material'}}))} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  const button=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(node=>node.props.onPress);
  expect(button('Mark a missed item')).toBeUndefined();
  await Renderer.act(()=>button('Select item 1: paper scrap')!.props.onPress());
  await Renderer.act(()=>button('Select item 2: paper scrap')!.props.onPress());
  expect(button('Select item 1: paper scrap')!.props.accessibilityState.checked).toBe(false);
  expect(button('Select item 2: paper scrap')!.props.accessibilityState.checked).toBe(true);
  await Renderer.act(()=>tree.unmount());
});
