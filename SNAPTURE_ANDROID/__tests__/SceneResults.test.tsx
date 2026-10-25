import React from 'react';
import Renderer from 'react-test-renderer';
import SceneResults, { containRect, QualityFeedback } from '../src/SceneResults';
import { getScene, type ScanScene } from '../src/api';

jest.mock('../src/api', () => ({ getScene: jest.fn(), imageUrl: (uri: string) => uri }));

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
  const prediction = { id: 9, title: 'Paper', assessment: { material: { status: 'needs_confirmation' }, missing_information: ['condition'], segregation: { instructions: [] } }, recommendation_choices: [] };
  const scene = { id: 3, image_url: '/scene.jpg', width: 200, height: 100, frame: [0, 0, 1, 1], status: 'complete', quality: { flags: [] }, limitations: 'May miss objects.', items: [{ id: 1, box: [.1, .2, .4, .6], name: 'paper scrap', score: .22, prediction, route: { key: 'review', label: 'Needs review', reason: 'Confirm material.' }, suggested_group: 'recyclable' }] } as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({ scene });
  scene.disposal_selection={confirmed:true,item_ids:[1]};
  const onReview = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onReview={onReview} onRetry={jest.fn()} />); });
  expect(JSON.stringify(tree.toJSON())).toContain('a box is not a confirmed waste category');
  expect(tree.root.findAllByProps({ accessibilityLabel: 'Select box 1' })).toHaveLength(0);
  const button = tree.root.findAllByProps({ accessibilityLabel: 'Review item 1' }).find(node => typeof node.props.onPress === 'function');
  await Renderer.act(() => { button?.props.onPress(); });
  expect(onReview).toHaveBeenCalledWith(prediction);
});

test('contain geometry preserves box alignment in a letterboxed preview', () => {
  expect(containRect(100,200,300,300)).toEqual({ x:75,y:0,width:150,height:300 });
});

test('server-rejected guesses never become boxes even when the review list is opened',async()=>{
  const prediction={id:1,title:'Paper',recommendation_choices:[]};
  const scene={id:88,image_url:'/photo.jpg',width:100,height:100,status:'complete',quality:{flags:[]},items:[
    {id:1,name:'towel',score:.8,box:[.1,.1,.8,.8],detection_status:'review',display_box:false,prediction,route:{reason:'Conflicting object queries'}},
    {id:2,name:'human leg',score:.99,box:[0,0,1,1],detection_status:'excluded',display_box:false,prediction,route:{}},
    {id:3,name:'towel',score:.75,box:[.1,.1,.8,.8],detection_status:'duplicate',display_box:false,prediction,route:{}},
  ]} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('No reliable object match');
  const review=tree.root.findAllByProps({accessibilityLabel:'Show uncertain suggestions (1)'}).find(node=>node.props.onPress)!;
  await Renderer.act(()=>review.props.onPress());
  expect(tree.root.findAllByProps({accessibilityLabel:'Select item 1: towel'}).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Select item 2: human leg'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Select item 3: towel'})).toHaveLength(0);
  expect(tree.root.findAll(node=>/^Select box /.test(node.props.accessibilityLabel || ''))).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});

test('high-confidence numbered boxes and cards highlight each other without navigating', async () => {
  const prediction = { id: 8, title: 'Paper', assessment: { material: { status: 'needs_confirmation' }, missing_information: ['condition'], segregation: { instructions: [] } }, recommendation_choices: [] };
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
