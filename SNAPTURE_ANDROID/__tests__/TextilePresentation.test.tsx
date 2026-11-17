import React from 'react';
import Renderer from 'react-test-renderer';
import DisposalObjectRow from '../src/DisposalObjectRow';
import SceneResults from '../src/SceneResults';
import {confirmDisposalSelection,getScene,type SceneItem,type ScanScene} from '../src/api';
import {sceneItemTitle} from '../src/detectionPresentation';

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
  expect(button(tree,'Select item 1: Fabric Scraps')).toBeDefined();
  expect(button(tree,'Check material')).toBeDefined();
  expect(button(tree,'Select box 1')).toBeUndefined();
  await Renderer.act(()=>tree.unmount());
});

test('a comb shows Unsupported and the removed content stays hidden',async()=>{
  const comb={...item,name:'comb',display_name:'comb',prediction:{...item.prediction,decision:'unknown_unsupported'}};
  const scene={id:41,image_url:'/comb.jpg',width:100,height:100,status:'complete',quality:{flags:[]},items:[comb]} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  const screen=JSON.stringify(tree.toJSON());
  expect(screen).toContain('Unsupported');
  expect(screen).not.toContain('"comb"');
  expect(screen).not.toContain('Did you know?');
  expect(screen).not.toContain('Browse general reuse ideas');
  expect(button(tree,'Scan another photo')).toBeDefined();
  await Renderer.act(()=>tree.unmount());
});

test('object names never override the classifier category',()=>{
  expect(sceneItemTitle({...item, name:'water bottle', prediction:{...item.prediction,decision:'pete_bottles'}})).toBe('PETE Bottles');
  expect(sceneItemTitle({...item, name:'water bottle', prediction:{...item.prediction,decision:'hdpe_containers'}})).toBe('HDPE Containers');
});

test('single-item focus keeps the blue boundary without a separate zoom section',async()=>{
  const focused={...item,prediction:{...item.prediction,image_url:'/item-crop.jpg',focus_box:[.2,.1,.8,.9]}};
  const scene={id:45,image_url:'/original.jpg',width:100,height:100,status:'complete',quality:{flags:[]},items:[focused],single_item:{enabled:true}} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  const boundary=tree.root.findByProps({accessibilityLabel:'Object focus boundary'});
  expect(boundary.props.style.borderColor).toBe('#0088ff');
  expect(tree.root.findByProps({accessibilityLabel:'Scanned area inside border'}).props.source.uri).toBe('/original.jpg');
  expect(tree.root.findAllByProps({accessibilityLabel:'Enlarged object used for classification'})).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('This enlarged area');
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
  expect(JSON.stringify(tree.toJSON())).toContain('Possible Paper. This is not a confirmed result.');
  expect(button(tree,'Select box 1')).toBeUndefined();
  await Renderer.act(async()=>{await button(tree,'Check category')!.props.onPress();});
  expect(review).toHaveBeenCalledWith(uncertain.prediction);
  expect(uncertain.prediction.decision).toBe('unknown_unsupported');
  await Renderer.act(()=>tree.unmount());
});

test('a failed category check keeps the result available for retry',async()=>{
  const uncertain={...item,prediction:{...item.prediction,decision:'unknown_unsupported',
    recognition:{status:'needs_review',suggested_label:null,reason:'Conflict'}}};
  const scene={id:43,width:100,height:100,status:'complete',quality:{flags:[]},items:[uncertain],single_item:{enabled:true}} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  (confirmDisposalSelection as jest.Mock).mockRejectedValue(new Error('Connection unavailable'));
  const review=jest.fn();
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()} onReview={review}/>);});
  await Renderer.act(async()=>{await button(tree,'Check category')!.props.onPress();});
  expect(JSON.stringify(tree.toJSON())).toContain('Connection unavailable');
  expect(button(tree,'Check category')!.props.disabled).toBe(false);
  expect(review).not.toHaveBeenCalled();
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
