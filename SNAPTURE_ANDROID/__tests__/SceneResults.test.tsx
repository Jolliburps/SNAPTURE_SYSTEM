import React from 'react';
import Renderer from 'react-test-renderer';
import SceneResults, { containRect, QualityFeedback } from '../src/SceneResults';
import { getScene, confirmDisposalSelection, type ScanScene } from '../src/api';
import {getSuggestions,getVisual} from '../src/upcyclingApi';

jest.mock('../src/api', () => ({ getScene: jest.fn(), confirmDisposalSelection: jest.fn(), imageUrl: (uri: string) => uri }));
jest.mock('../src/upcyclingApi',()=>({upcyclingRequest:jest.fn().mockResolvedValue({snapshot:null}),getSuggestions:jest.fn().mockResolvedValue({items:[],outcome:'needs_information',message:'Preliminary suggestions are available after identification.',facts:{}}),getVisual:jest.fn().mockResolvedValue({assessment:{primary:{status:'unavailable'},observations:[],conflicts:[],views:[],facts:{}}})}));

test('does not show tips when quality checks flag nothing', async () => {
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(() => { tree = Renderer.create(<QualityFeedback quality={{ flags: [], limitations: 'Approximate' }} />); });
  expect(tree.toJSON()).toBeNull();
});

test('only displays the image issues actually reported', async () => {
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(() => { tree = Renderer.create(<QualityFeedback quality={{ flags: [{ code: 'dark', message: 'This image is dark.' }], limitations: 'Approximate' }} />); });
  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain('This image is dark.'); expect(text).not.toContain('blurry');
});

test('weak selected historical guesses stay reviewable without restoring model boxes', async () => {
  const prediction = { id: 9, decision:'paper', title: 'Paper', assessment: { material: { status: 'needs_confirmation' }, missing_information: ['condition'], segregation: { instructions: [] } }, recommendation_choices: [] };
  const scene = { id: 3, image_url: '/scene.jpg', width: 200, height: 100, frame: [0, 0, 1, 1], status: 'complete', quality: { flags: [] }, limitations: 'May miss objects.', items: [{ id: 1, box: [.1, .2, .4, .6], name: 'paper scrap', score: .22, prediction, route: { key: 'review', label: 'Needs review', reason: 'Confirm material.' }, suggested_group: 'recyclable' }] } as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({ scene });
  scene.disposal_selection={confirmed:true,item_ids:[1]};
  const onReview = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onReview={onReview} onRetry={jest.fn()} />); });
  expect(JSON.stringify(tree.toJSON())).toContain('Material not confirmed');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Select box 1' })).toHaveLength(0);
  const button = tree.root.findAllByProps({ accessibilityLabel: 'Review item 1' }).find(node => typeof node.props.onPress === 'function');
  await Renderer.act(() => { button?.props.onPress(); });
  expect(onReview).toHaveBeenCalledWith(prediction);
});

test('contain geometry preserves box alignment in a letterboxed preview', () => {
  expect(containRect(100,200,300,300)).toEqual({ x:75,y:0,width:150,height:300 });
});

test('server-rejected single guesses remain reviewable without restoring boxes or exact names',async()=>{
  const prediction={id:1,decision:'fabric_scraps',title:'Fabric Scraps',recommendation_choices:[]};
  const scene={id:88,image_url:'/photo.jpg',width:100,height:100,status:'complete',quality:{flags:[]},items:[
    {id:1,name:'towel',score:.8,box:[.1,.1,.8,.8],detection_status:'review',display_box:false,prediction,route:{reason:'Conflicting object queries'}},
    {id:2,name:'human leg',score:.99,box:[0,0,1,1],detection_status:'excluded',display_box:false,prediction,route:{}},
    {id:3,name:'towel',score:.75,box:[.1,.1,.8,.8],detection_status:'duplicate',display_box:false,prediction,route:{}},
  ]} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Suggested category. Check the material to continue.');
  expect(tree.root.findAllByProps({accessibilityLabel:'Select item 1: Fabric Scraps'}).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Select item 2: human leg'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Select item 3: towel'})).toHaveLength(0);
  expect(tree.root.findAll(node=>/^Select box /.test(node.props.accessibilityLabel || ''))).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});

test('high-confidence numbered boxes and cards highlight each other without navigating', async () => {
  const prediction = { id: 8, decision:'paper', title: 'Paper', assessment: { material: { status: 'needs_confirmation' }, missing_information: ['condition'], segregation: { instructions: [] } }, recommendation_choices: [] };
  const scene = { id: 2, image_url: '/scene.jpg', width: 200, height: 100, status: 'complete', quality: { flags: [] }, items: [1,2].map(id=>({ id,box: [id*.1,.1,id*.1+.1,.4],name: 'paper scrap',score:.8,prediction,route:{key:'review',label:'Needs review',reason:'Confirm material.'},suggested_group:'recyclable',display_box:true,display_group:'recyclable' })) } as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({ scene });
  scene.disposal_selection={confirmed:true,item_ids:[1,2]};
  const onReview = jest.fn(); let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onReview={onReview} onRetry={jest.fn()} />); });
  const press = async (label: string) => { await Renderer.act(async () => { tree.root.findAllByProps({ accessibilityLabel:label }).find(node=>typeof node.props.onPress==='function')?.props.onPress(); }); };
  await press('Select box 2');
  expect(onReview).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ accessibilityLabel:'Select item 2 card' })[0].props.accessibilityState.selected).toBe(true);
  await press('Select item 1 card');
  expect(tree.root.findAllByProps({ accessibilityLabel:'Select box 1' })[0].props.accessibilityState.selected).toBe(true);
});


test('draws accepted object bounds in green and rejects invalid coordinates', async () => {
  const prediction = {id:99,decision:'paper',title:'Paper',focus_box:[.2,.3,.7,.8],recognition:{status:'supported'},assessment:{material:{status:'needs_confirmation'},missing_information:[],segregation:{instructions:[]}},recommendation_choices:[]};
  const scene = {id:99,image_url:'/image.jpg',width:200,height:200,frame:[0,0,1,1],status:'complete',single_item:{enabled:true},quality:{flags:[]},items:[{id:99,box:[.2,.3,.7,.8],name:'paper scrap',score:.9,prediction,route:{key:'review',label:'Review'},suggested_group:'recyclable'}]} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => {tree=Renderer.create(<SceneResults historical initial={scene} onBack={jest.fn()} onRetry={jest.fn()} />);});
  const boundary=tree.root.findAllByProps({accessibilityLabel:'Object focus boundary'}).find(node=>node.props.style?.borderColor);
  expect(boundary?.props.style.borderColor).toBe('#176b45');
  await Renderer.act(()=>{tree.unmount();});
  prediction.focus_box=[0,0,2,1];
  await Renderer.act(async () => {tree=Renderer.create(<SceneResults historical initial={scene} onBack={jest.fn()} onRetry={jest.fn()} />);});
  expect(tree.root.findAllByProps({accessibilityLabel:'Object focus boundary'})).toHaveLength(0);
  await Renderer.act(()=>{tree.unmount();});
});


test.each(['paper','cardboard','fabric_scraps','pete_bottles','hdpe_containers','coconut_shells','dry_untreated_wood_scraps'])('single %s opens preliminary projects without the old mandatory material-check screen', async label => {
  const prediction={id:41,decision:label,title:label,recognition:{status:'supported'},assessment:{material:{status:'needs_confirmation'},missing_information:[],segregation:{instructions:[]}},recommendation_choices:[]};
  const scene={id:41,image_url:'/photo.jpg',width:200,height:200,frame:[0,0,1,1],status:'complete',single_item:{enabled:true},quality:{flags:[]},items:[{id:41,box:[.1,.1,.9,.9],name:label,score:.9,prediction,route:{key:'review',label:'Review'}}]} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  (confirmDisposalSelection as jest.Mock).mockResolvedValue({scene});
  const review=jest.fn();let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()} onReview={review}/>);});
  expect(JSON.stringify(tree.toJSON())).not.toContain('Tap to include this item');
  expect(tree.root.findAllByProps({accessibilityRole:'checkbox'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Check material'})).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Projects for this item');
  expect(getSuggestions).toHaveBeenCalledWith(prediction.id,'',false);
  expect(getVisual).toHaveBeenCalledWith(prediction.id);
  expect(review).not.toHaveBeenCalled();
  await Renderer.act(()=>tree.unmount());
});
