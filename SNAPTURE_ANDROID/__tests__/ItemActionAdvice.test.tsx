import React from 'react';
import Renderer from 'react-test-renderer';
import ItemActionAdvice from '../src/ItemActionAdvice';
import type {SceneItem} from '../src/api';

const item={id:8,prediction:{title:'Paper'},action_advice:{chosen_action:'recover',title:'Recycle / upcycle',waste_group:'recyclable',steps:['Keep dry.','Remove tape.','Check acceptance.'],status:'needs_information',caution:'Do not burn.',sources:[{title:'Reference',url:'https://example.test/source'}],projects:[{id:'paper-wrap',title:'Wrap a non-food gift',basis:'educational_catalog'}]}} as unknown as SceneItem;
function button(tree:Renderer.ReactTestRenderer,label:string){return tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!;}
test('short steps, source disclosure, item check and matching project work without automatic navigation',async()=>{
  const review=jest.fn(),guide=jest.fn();let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<ItemActionAdvice item={item} onReview={review} onOpenGuide={guide}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Keep dry.');
  expect(JSON.stringify(tree.toJSON())).toContain('not CESD approval');
  expect(JSON.stringify(tree.toJSON())).not.toContain('https://example.test/source');
  expect(guide).not.toHaveBeenCalled();
  await Renderer.act(()=>button(tree,'Action sources item 8').props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('https://example.test/source');
  await Renderer.act(()=>button(tree,'Check details for item 8').props.onPress());expect(review).toHaveBeenCalledTimes(1);
  await Renderer.act(()=>button(tree,'Choose task: Wrap a non-food gift').props.onPress());expect(guide).toHaveBeenCalledWith('paper-wrap');
  await Renderer.act(()=>tree.unmount());
});
test('no chosen action does not display disposal instructions',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<ItemActionAdvice item={{...item,action_advice:{...item.action_advice!,chosen_action:null}}}/>);});
  expect(tree.toJSON()).toBeNull();await Renderer.act(()=>tree.unmount());
});

test('automatic recovery keeps ideas hidden until confirmation and opens the existing check',async()=>{
  const review=jest.fn();let tree!:Renderer.ReactTestRenderer;
  const pending={...item,automatic_route:{enabled:true,action:'recover',confirmation_required:true,needs_review:false,label:'Confirm material',note:''}} as SceneItem;
  await Renderer.act(()=>{tree=Renderer.create(<ItemActionAdvice item={pending} onReview={review}/>);});
  expect(button(tree,'Choose task: Wrap a non-food gift')).toBeUndefined();
  expect(JSON.stringify(tree.toJSON())).toContain('Confirm item details');
  await Renderer.act(()=>button(tree,'Check details for item 8').props.onPress());
  expect(review).toHaveBeenCalledTimes(1);
  await Renderer.act(()=>tree.update(<ItemActionAdvice item={{...pending,automatic_route:{...pending.automatic_route!,confirmation_required:false}}} onOpenGuide={jest.fn()}/>));
  expect(button(tree,'Choose task: Wrap a non-food gift')).toBeDefined();
  await Renderer.act(()=>tree.unmount());
});
