import React from 'react';
import Renderer from 'react-test-renderer';
import DisposalObjectRow from '../src/DisposalObjectRow';
import SceneResults from '../src/SceneResults';
import ScanResult from '../src/ScanResult';
import {upcyclingRequest} from '../src/upcyclingApi';
import {confirmDisposalSelection,getScene,type SceneItem,type ScanScene} from '../src/api';
import {sceneItemTitle} from '../src/detectionPresentation';

jest.mock('../src/upcyclingApi',()=>({upcyclingRequest:jest.fn().mockResolvedValue({snapshot:null}),getSuggestions:jest.fn().mockResolvedValue({items:[],message:'Assessment pending',facts:{}}),getVisual:jest.fn().mockResolvedValue({assessment:{primary:{status:'unavailable'},observations:[],conflicts:[],views:[],facts:{}}})}));
jest.mock('../src/api',()=>({getScene:jest.fn(),confirmDisposalSelection:jest.fn(),imageUrl:(value:string)=>value}));
const item={id:1,name:'towel',display_name:'Possible fabric item',name_confirmation_required:true,
  score:.302,box:[.004,.258,.765,1],display_box:false,detection_status:'review',
  prediction:{id:189,decision:'fabric_scraps',recommendation_choices:[]},route:{reason:'Confirm item'}} as unknown as SceneItem;
const button=(tree:Renderer.ReactTestRenderer,label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function');

test('a textile suggestion shows the supported category and no exact object name',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<DisposalObjectRow item={item} number={1} color="#176b45" checked={false} onToggle={jest.fn()} onDetails={jest.fn()}/>);});
  expect(button(tree,'Select item 1: Fabric Scraps')).toBeDefined();
  expect(JSON.stringify(tree.toJSON())).not.toContain('towel');
  expect(button(tree,'Correct name item 1')).toBeUndefined();
  await Renderer.act(()=>tree.unmount());
});

test('a weak framed result shows the category without drawing the weak box',async()=>{
  const scene={id:40,image_url:'/photo.jpg',width:100,height:100,status:'complete',quality:{flags:[]},items:[item],single_item:{enabled:true}} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()} onReview={jest.fn()}/>);});
  expect(button(tree,'Select item 1: Fabric Scraps')).toBeUndefined();
  expect(tree.root.findAllByProps({accessibilityRole:'checkbox'})).toHaveLength(0);
  expect(tree.root.findByType(ScanResult).props.prediction).toEqual(item.prediction);
  expect(button(tree,'Check material')).toBeUndefined();
  expect(confirmDisposalSelection).not.toHaveBeenCalled();
  expect(button(tree,'Select box 1')).toBeUndefined();
  await Renderer.act(()=>tree.unmount());
});

test('an identified out-of-scope comb shows Out of Scope',async()=>{
  const comb={...item,name:'comb',display_name:'comb',prediction:{...item.prediction,decision:'unknown_unsupported',recognition:{status:'unsupported'}}};
  const scene={id:41,image_url:'/comb.jpg',width:100,height:100,status:'complete',quality:{flags:[]},items:[comb]} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  const screen=JSON.stringify(tree.toJSON());
  expect(screen).toContain('Out of Scope');
  expect(screen).not.toContain('"comb"');
  expect(screen).not.toContain('Did you know?');
  expect(screen).not.toContain('Browse general reuse ideas');
  expect(button(tree,'Scan another photo')).toBeDefined();
  await Renderer.act(()=>tree.unmount());
});

test('object names never override the classifier category',()=>{
  expect(sceneItemTitle({...item, name:'water bottle', prediction:{...item.prediction,decision:'pete_bottles'}})).toBe('PETE Bottles (Polyethylene Terephthalate)');
  expect(sceneItemTitle({...item, name:'water bottle', prediction:{...item.prediction,decision:'hdpe_containers'}})).toBe('HDPE Containers (High-Density Polyethylene)');
});

test('single-item material assessment preserves source metadata without detector overlays',async()=>{
  const focused={...item,prediction:{...item.prediction,image_url:'/item-crop.jpg',focus_box:[.2,.1,.8,.9]}};
  const scene={id:45,image_url:'/original.jpg',width:100,height:100,status:'complete',quality:{flags:[]},items:[focused],single_item:{enabled:true}} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(tree.root.findByType(ScanResult).props.prediction).toEqual(focused.prediction);
  expect(tree.root.findAllByProps({accessibilityLabel:'Object focus boundary'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Enlarged object used for classification'})).toHaveLength(0);
  expect(button(tree,'Select box 1')).toBeUndefined();
  await Renderer.act(()=>tree.unmount());
});

test('uncertain category can reach assessment without promoting it or drawing a box',async()=>{
  const uncertain={...item, prediction:{...item.prediction,decision:'unknown_unsupported',
    recognition:{status:'needs_review',suggested_label:'paper',reason:'Below threshold'}}};
  const scene={id:42,image_url:'/paper.jpg',width:100,height:100,status:'complete',quality:{flags:[]},
    items:[uncertain],single_item:{enabled:true}} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  (confirmDisposalSelection as jest.Mock).mockResolvedValue({scene});
  const review=jest.fn();
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()} onReview={review}/>);});
  expect(tree.root.findByType(ScanResult).props.prediction.recognition.suggested_label).toBe('paper');
  expect(button(tree,'Select box 1')).toBeUndefined();
  expect(button(tree,'Check category')).toBeUndefined();
  expect(review).not.toHaveBeenCalled();
  expect(uncertain.prediction.decision).toBe('unknown_unsupported');
  await Renderer.act(()=>tree.unmount());
});

test('a failed assessment request retains the scan and supports retry',async()=>{
  (upcyclingRequest as jest.Mock).mockRejectedValueOnce(new Error('Connection unavailable')).mockResolvedValue({snapshot:null});
  const uncertain={...item,prediction:{...item.prediction,decision:'unknown_unsupported',recognition:{status:'needs_review',suggested_label:null,reason:'Conflict'}}};
  const scene={id:43,width:100,height:100,status:'complete',quality:{flags:[]},items:[uncertain],single_item:{enabled:true}} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Connection unavailable');
  expect(tree.root.findByType(ScanResult).props.prediction.id).toBe(uncertain.prediction.id);
  await Renderer.act(async()=>{await button(tree,'Retry scan result')!.props.onPress();});
  expect(button(tree,'Retry scan result')).toBeUndefined();
  await Renderer.act(()=>tree.unmount());
});

test('history uses its saved uncertain category without requesting a newer scan',async()=>{
  (getScene as jest.Mock).mockClear();
  const uncertain={...item,prediction:{...item.prediction,decision:'unknown_unsupported',
    recognition:{status:'needs_review',suggested_label:'paper',reason:'Below threshold'}}};
  const scene={id:44,width:100,height:100,status:'complete',quality:{flags:[]},items:[uncertain],single_item:{enabled:true}} as unknown as ScanScene;
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} historical onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Possible Paper. This is not a confirmed result.');
  expect(getScene).not.toHaveBeenCalled();
  expect(button(tree,'Check category')).toBeUndefined();
  await Renderer.act(()=>tree.unmount());
});
