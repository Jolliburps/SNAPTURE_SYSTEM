import React from 'react';
import Renderer from 'react-test-renderer';
import {Pressable,Text} from 'react-native';
import ScanSession from '../src/ScanSession';
import {createScene,previewScanMaterial} from '../src/api';
jest.mock('../src/api',()=>({...jest.requireActual('../src/api'),createScene:jest.fn(),previewScanMaterial:jest.fn()}));
beforeEach(()=>{
  jest.clearAllMocks();
  (previewScanMaterial as jest.Mock).mockResolvedValue({status:'supported',label:'cardboard',reason:'Matches a supported material.',token:'signed-test-preview',box:[.2,.25,.8,.75],image_width:100,image_height:200,capture_plan:{views:['back','side'],inside:true}});
});
const sides=['back','left side','right side','top','bottom'];

test('the guided scan submits each side and the completed inspection form',async()=>{
  let tree!:Renderer.ReactTestRenderer;let count=0;const complete=jest.fn();
  await Renderer.act(async()=>{tree=Renderer.create(<ScanSession onBack={jest.fn()} onManual={jest.fn()} onComplete={complete} renderCamera={(capture,back,hint)=><><Text>{hint}</Text><Pressable accessibilityLabel="Test shutter" onPress={()=>capture(`file:///photo-${++count}.jpg`)}><Text>Capture</Text></Pressable><Pressable accessibilityLabel="Camera back" onPress={back}/></>}/>);});
  const press=async(label:string)=>Renderer.act(async()=>{const n=tree.root.findAllByProps({accessibilityLabel:label}).find(x=>x.props.onPress)!;expect(n).toBeDefined();await n.props.onPress();});
  expect(tree.root.findAllByProps({accessibilityLabel:'Approximate size'})).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Take your main photo');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Photograph your item');
  expect(tree.root.findAllByProps({accessibilityLabel:'Test shutter'})).toHaveLength(0);
  await press('Open camera');
  await press('Test shutter');
  await Renderer.act(()=>tree.root.findAll(n=>typeof n.props.onLayout==='function')[0].props.onLayout({nativeEvent:{layout:{width:300,height:220}}}));
  expect(tree.root.findAllByProps({accessibilityLabel:'Detected object outline'})[0].props.style.left).toBe(117);
  expect(tree.root.findAllByProps({accessibilityLabel:'Approximate size'})).toHaveLength(0);
  expect(previewScanMaterial).toHaveBeenCalledWith('file:///photo-1.jpg',expect.any(Object));
  expect(createScene).not.toHaveBeenCalled();
  await press('Photograph the other sides');
  expect(tree.root.findAllByProps({accessibilityLabel:'Continue to item details'}).find(n=>n.props.onPress)?.props.disabled).toBe(true);
  for(const view of ['back','edge']){await press(`Take ${view} photo`);await press('Test shutter');}
  expect(JSON.stringify(tree.toJSON())).toContain('Inside the item (optional)');
  await press('Continue to item details');
  const size=tree.root.findAllByProps({accessibilityLabel:'Approximate size'}).find(n=>n.props.onChangeText)!;
  expect(tree.root.findAllByProps({accessibilityLabel:'Check my item'}).find(n=>n.props.onPress)?.props.disabled).toBe(true);
  await Renderer.act(()=>size.props.onChangeText('20 x 10 cm'));
  await Renderer.act(()=>tree.root.findAllByProps({accessibilityLabel:'How many pieces?'}).find(n=>n.props.onChangeText)!.props.onChangeText('1'));
  await press('None');
  await press('No chemical contact known');
  expect(createScene).not.toHaveBeenCalled();
  (createScene as jest.Mock).mockResolvedValue({scene:{id:7}});
  await press('Check my item');
  expect(createScene).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Review your scan');
  const call=(createScene as jest.Mock).mock.calls[0];expect(call[0]).toBe('file:///photo-1.jpg');expect(call[3]).toBe(true);expect(call[4].details).toEqual({mode:'single',quantity:1,approximate_size:'20 x 10 cm',inspection_report:'none_seen',previous_contents:'No chemical contact known',condition_policy:'inspection-first-v1',capture_mode:'material-guided-v1'});expect(call[4].primaryView).toBe('front');
  expect(call[4].views.map(({view,uri}:{view:string;uri:string})=>[view,uri])).toEqual(
    ['back','side'].map((view,index)=>[view,`file:///photo-${index+2}.jpg`]));
  expect(call[4].previewToken).toBe('signed-test-preview');
  expect(complete).toHaveBeenCalledWith({id:7});await Renderer.act(async()=>tree.unmount());
});

test('PETE submits all retained close-ups and the inspected batch count',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  const complete=jest.fn();
  let captures=0;
  (previewScanMaterial as jest.Mock).mockResolvedValueOnce({status:'photo_review',reason:'Check the base.',resin_review_token:'signed-resin',crop_scores:[{label:'pete_bottles',score:.52}],capture_plan:{views:['back','left','right','top','bottom'],inside:true}});
  await Renderer.act(()=>{tree=Renderer.create(<ScanSession onBack={jest.fn()} onManual={jest.fn()} onComplete={complete} renderCamera={capture=><Pressable accessibilityLabel="Test shutter" onPress={()=>capture(`file:///capture-${++captures}.jpg`)}><Text>Capture</Text></Pressable>}/>);});
  const button=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.onPress)!;
  const press=async(label:string)=>Renderer.act(async()=>{await button(label).props.onPress();});
  await press('Open camera'); await press('Test shutter');
  expect(button('Retake scan')).toBeDefined();
  expect(tree.root.findAllByProps({accessibilityLabel:'Example plastic code 1 for Water and soft drink bottles'}).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Example plastic code 2 for Thick plastic jugs and bottles'}).length).toBeGreaterThan(0);
  await press('My item has code #1');
  await press('Photograph the other sides');
  for(const view of sides){await press(`Take ${view} photo`);await press('Test shutter');}
  await press('Take inside photo');await press('Test shutter');
  await press('Continue to item details');
  expect(button('Human-assisted activity')).toBeUndefined();
  expect(button('Single item')).toBeUndefined();
  await Renderer.act(()=>tree.root.findAllByProps({accessibilityLabel:'How many pieces?'}).find(n=>n.props.onChangeText)!.props.onChangeText('2'));
  expect(button('500 mL')).toBeUndefined();
  const capacity=tree.root.findAllByProps({accessibilityLabel:'Bottle capacity'}).find(n=>n.props.onChangeText)!;
  expect(capacity.props.placeholder).toBe('e.g. 500 mL');
  await Renderer.act(()=>capacity.props.onChangeText('500 mL'));
  expect(button('Check my item').props.disabled).toBe(true);
  const closeUp=(number:number)=>tree.root.findAllByProps({accessibilityLabel:`Inspection close-up ${number}`}).find(node=>node.props.source);
  expect(closeUp(1)).toBeUndefined();
  await press('Scan');await press('Test shutter');
  await press('Scan');await press('Test shutter');
  await press('Scan');await press('Test shutter');
  expect(closeUp(1)?.props.source).toEqual({uri:'file:///capture-8.jpg'});
  expect(closeUp(2)?.props.source).toEqual({uri:'file:///capture-9.jpg'});
  await press('Remove close-up 2');
  expect(closeUp(2)?.props.source).toEqual({uri:'file:///capture-10.jpg'});
  await press('Water or beverage');
  await press('Slightly torn or creased, clean and dry');
  const count=tree.root.findAllByProps({accessibilityLabel:'Usable pieces after inspection'}).find(n=>n.props.onChangeText)!;
  await Renderer.act(()=>count.props.onChangeText('3'));
  expect(button('Check my item').props.disabled).toBe(true);
  await Renderer.act(()=>count.props.onChangeText('1'));
  expect(button('Check my item').props.disabled).toBe(false);
  (createScene as jest.Mock).mockResolvedValue({scene:{id:8}});
  await press('Check my item');
  expect(createScene).toHaveBeenCalledWith('file:///capture-1.jpg',expect.any(String),expect.any(Object),true,expect.objectContaining({
    details:{mode:'batch',quantity:2,approximate_size:'500 mL',inspection_report:'concern_photo',previous_contents:'Water or beverage',usable_quantity:1,condition_policy:'inspection-first-v1',reported_concern:'minor_damage',capture_mode:'material-guided-v1'},
    views:expect.arrayContaining([{view:'inside',uri:'file:///capture-7.jpg',frame:expect.any(Object)}]),
    previewToken:'signed-resin',resinCode:'1',concernPhotos:[
      {uri:'file:///capture-8.jpg',frame:expect.any(Object)},{uri:'file:///capture-10.jpg',frame:expect.any(Object)}],
  }));
  expect(complete).toHaveBeenCalledWith({id:8});
  await Renderer.act(()=>tree.unmount());
});

test.each([
  ['photo_review','Photo Needs Review','Retake scan'],
  ['out_of_scope','Out of Scope','Scan another item'],
  ['special_handling','Hazardous Waste','Scan another item'],
] as const)('material screening blocks details when necessary (%s)',async(status,title,next)=>{
  (previewScanMaterial as jest.Mock).mockResolvedValueOnce({status,label:'cardboard',reason:'Material check result.',...(status==='photo_review'?{crop_scores:[{label:'paper',score:.82}],guide_scores:[{label:'fabric_scraps',score:.57}]}:{})});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<ScanSession onBack={jest.fn()} onManual={jest.fn()} onComplete={jest.fn()} renderCamera={capture=><Pressable accessibilityLabel="Test shutter" onPress={()=>capture('file:///main.jpg')}><Text>Capture</Text></Pressable>}/>);});
  const button=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.onPress);
  const press=async(label:string)=>Renderer.act(async()=>{await button(label)!.props.onPress();});
  await press('Open camera');await press('Test shutter');
  expect(JSON.stringify(tree.toJSON())).toContain(title);
  expect(button(next)).toBeDefined();
  expect(button('Continue to item details')).toBeUndefined();
  if(status==='photo_review'){
    expect(JSON.stringify(tree.toJSON())).toContain('82.0%');
    expect(JSON.stringify(tree.toJSON())).not.toContain('57.0%');
    expect(JSON.stringify(tree.toJSON())).not.toContain('Full camera guide');
  }
  expect(button('Report glass or metal')).toBeUndefined();
  expect(button('Report another out-of-scope item')).toBeUndefined();
  expect(tree.root.findAllByProps({accessibilityLabel:'Approximate size'})).toHaveLength(0);
  expect(createScene).not.toHaveBeenCalled();
  await Renderer.act(()=>tree.unmount());
});
