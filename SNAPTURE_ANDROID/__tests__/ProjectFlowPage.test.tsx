import React from 'react';
import Renderer from 'react-test-renderer';
import {ScrollView,StyleSheet,Text} from 'react-native';
import ProjectFlowPage from '../src/ProjectFlowPage';
import ProjectGuide from '../src/ProjectGuide';
import type {UserProject} from '../src/api';

test('idea chooser has a bounded viewport, growing scroll content and fixed back/close buttons',async()=>{
  const back=jest.fn(),close=jest.fn();let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<ProjectFlowPage title="Upcycling ideas" backLabel="Back to current idea" onBack={back} onClose={close} scroll>{Array.from({length:30},(_,index)=><Text key={index}>Idea {index}</Text>)}</ProjectFlowPage>);});
  const viewport=tree.root.findAllByType(ScrollView)[0];
  expect(StyleSheet.flatten(viewport.props.style).flex).toBe(1);
  expect(StyleSheet.flatten(viewport.props.contentContainerStyle).flexGrow).toBe(1);
  expect(StyleSheet.flatten(viewport.props.contentContainerStyle).flex).toBeUndefined();
  expect(tree.root.findAllByProps({testID:'project-flow-header'})[0].findAllByType(ScrollView)).toHaveLength(0);
  const button=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!;
  await Renderer.act(()=>button('Back to current idea').props.onPress());expect(back).toHaveBeenCalledTimes(1);
  await Renderer.act(()=>button('Close upcycling flow').props.onPress());expect(close).toHaveBeenCalledTimes(1);
  await Renderer.act(()=>{tree.update(<ProjectFlowPage title="Upcycling ideas" backLabel="Back to current idea" onBack={back} onClose={close} disabled scroll><Text>Saving</Text></ProjectFlowPage>);});
  expect(button('Back to current idea').props.disabled).toBe(true);
  expect(button('Close upcycling flow').props.disabled).toBe(true);
  await Renderer.act(()=>tree.unmount());
});

test('the guide also uses a bounded scrolling viewport rather than clipping long step lists',async()=>{
  const project={id:1,title:'Long guide',material:'Paper',steps:Array.from({length:15},(_,index)=>`Step ${index}`),materials:[],completed_steps:[],completed_count:0,total_steps:15,progress_percent:0,status:'active'} as unknown as UserProject;
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<ProjectGuide project={project} onStep={jest.fn()} onRestart={jest.fn()} onDone={jest.fn()}/>);});
  const viewport=tree.root.findAllByType(ScrollView)[0];
  expect(StyleSheet.flatten(viewport.props.style).flex).toBe(1);
  expect(StyleSheet.flatten(viewport.props.contentContainerStyle).flexGrow).toBe(1);
  expect(tree.root.findAllByProps({accessibilityLabel:'Review step 15'}).length).toBeGreaterThan(0);
  await Renderer.act(()=>tree.unmount());
});
