import React from 'react';
import Renderer from 'react-test-renderer';
import {Image, Linking} from 'react-native';
import TutorialPhoto, {PhotoCredits} from '../src/TutorialPhoto';
import UpcyclingIdeaChoices from '../src/UpcyclingIdeaChoices';
import IdeaDetails from '../src/IdeaDetails';
import ProjectGuide from '../src/ProjectGuide';
import {API_BASE_URL, type TutorialPhotos, type UserProject} from '../src/api';

const photos:TutorialPhotos={version:'2026-11-18-v1',source_id:'HDPE-004',credit:'Jeff Johnson / Playvolution HQ',
  source_url:'https://playvolutionhq.com/diy-milk-jug-sensory-play-scoops/',photo_rights:'Not verified for app reuse',
  finished:{url:'/api/tutorial-assets/v1/finished.jpg',source_stage:'finished',photo_status:'Downloaded source reference'},
  steps:[{url:'/api/tutorial-assets/v1/cut.jpg',source_stage:3,step_index:0,photo_status:'Downloaded source reference',visual_note:'The cutting action is not shown.'},
    {url:null,source_stage:4,step_index:1,photo_status:'Dedicated process photo needed',visual_note:'No dedicated process photo.'}]};
const idea={id:'hdpe_scoop',title:'Garden scoop',summary:'Use for soil.',materials:['Clean container'],steps:['Cut the scoop.','Smooth the edge.','Use in the garden.'],photos};
const project={...idea,id:9,recommendation_id:idea.id,material:'HDPE container',reference:{photos},completed_steps:[],completed_count:0,total_steps:3,progress_percent:0,status:'active'} as unknown as UserProject;
let tree:Renderer.ReactTestRenderer;
afterEach(async()=>{await Renderer.act(()=>tree?.unmount());jest.restoreAllMocks();});

test('uses the configured API origin and handles loading and failed photos without hiding text',async()=>{
  await Renderer.act(()=>{tree=Renderer.create(<TutorialPhoto photo={photos.steps[0]} label="Cut scoop reference"/>);});
  const image=tree.root.findByType(Image);
  expect(image.props.source.uri).toBe(`${API_BASE_URL.replace(/\/api\/?$/,'')}${photos.steps[0].url}`);
  expect(JSON.stringify(tree.toJSON())).toContain('Loading reference photo');
  await Renderer.act(()=>image.props.onLoad());
  expect(JSON.stringify(tree.toJSON())).not.toContain('Loading reference photo');
  await Renderer.act(()=>image.props.onError());
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Follow the text instruction');
  expect(JSON.stringify(tree.toJSON())).toContain('The cutting action is not shown');
});

test('missing process images show a note and changing steps clears an earlier failure',async()=>{
  await Renderer.act(()=>{tree=Renderer.create(<TutorialPhoto photo={photos.steps[1]} label="Smooth edge reference"/>);});
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('No dedicated process photo');
  await Renderer.act(()=>tree.update(<TutorialPhoto photo={photos.steps[0]} label="Cut reference"/>));
  await Renderer.act(()=>tree.root.findByType(Image).props.onError());
  await Renderer.act(()=>tree.update(<TutorialPhoto photo={photos.finished} label="Finished reference"/>));
  expect(tree.root.findByType(Image).props.source.uri).toContain('finished.jpg');
});

test('preview and details show the finished image, exact process mapping and original source',async()=>{
  const open=jest.spyOn(Linking,'openURL').mockResolvedValue(undefined);
  await Renderer.act(()=>{tree=Renderer.create(<UpcyclingIdeaChoices material="HDPE" ideas={[idea]}/>);});
  expect(tree.root.findByType(Image).props.source.uri).toContain('finished.jpg');
  expect(JSON.stringify(tree.toJSON())).toContain(photos.photo_rights);
  await Renderer.act(async()=>{tree.root.findAllByProps({accessibilityRole:'link'})[0].props.onPress();await Promise.resolve();});
  expect(open).toHaveBeenCalledWith(photos.source_url);
  await Renderer.act(()=>tree.update(<IdeaDetails idea={{...idea,material:'HDPE',guideLabel:'hdpe_containers'}}/>));
  expect(tree.root.findAllByType(Image)).toHaveLength(2);
  expect(JSON.stringify(tree.toJSON())).toContain('No dedicated process photo');
});

test('saved guide uses snapshot photos at zero-based indices and can save progress with a missing image',async()=>{
  const onStep=jest.fn().mockResolvedValue({...project,completed_steps:[1],completed_count:1});
  await Renderer.act(()=>{tree=Renderer.create(<ProjectGuide project={project} onStep={onStep} onRestart={jest.fn()} onDone={jest.fn()}/>);});
  expect(tree.root.findByType(Image).props.source.uri).toContain('cut.jpg');
  const button=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>typeof n.props.onPress==='function')!;
  await Renderer.act(()=>button('Next').props.onPress());
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Smooth the edge.');
  await Renderer.act(async()=>{button('Mark as done').props.onPress();await Promise.resolve();});
  expect(onStep).toHaveBeenCalledWith(9,1,true);
  await Renderer.act(()=>button('Project information and source').props.onPress());
  expect(tree.root.findByType(Image).props.source.uri).toContain('finished.jpg');
  expect(JSON.stringify(tree.toJSON())).toContain(photos.credit);
});

test('legacy guides and pending references remain text-only; source-open failures leave copyable links',async()=>{
  await Renderer.act(()=>{tree=Renderer.create(<ProjectGuide project={{...project,reference:{}}} onStep={jest.fn()} onRestart={jest.fn()} onDone={jest.fn()}/>);});
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Cut the scoop.');
  await Renderer.act(()=>tree.update(<IdeaDetails idea={{...idea,status:'awaiting_review',material:'HDPE',guideLabel:'hdpe_containers'}}/>));
  expect(tree.root.findAllByType(Image)).toHaveLength(0);
  jest.spyOn(Linking,'openURL').mockRejectedValue(new Error('Offline'));
  await Renderer.act(()=>tree.update(<PhotoCredits photos={photos}/>));
  await Renderer.act(async()=>{tree.root.findAllByProps({accessibilityRole:'link'})[0].props.onPress();await Promise.resolve();});
  expect(JSON.stringify(tree.toJSON())).toContain('You can copy the link above');
});
