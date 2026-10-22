import React from 'react';
import { Alert } from 'react-native';
import Renderer from 'react-test-renderer';
import MarkObjectModal from '../src/MarkObjectModal';
import SceneResults from '../src/SceneResults';
import AssessmentScreen from '../src/AssessmentScreen';
import { contributeIdentification, getScene, type ScanScene, type Prediction } from '../src/api';

jest.mock('../src/api', () => ({ imageUrl:(uri:string)=>uri, getScene:jest.fn(), contributeIdentification:jest.fn() }));

test('manual box ignores letterbox taps, requires two corners and saves normalized coordinates', async () => {
  const onSave = jest.fn().mockResolvedValue(undefined); const onClose = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(() => { tree = Renderer.create(<MarkObjectModal image="/scene.jpg" width={100} height={100} onSave={onSave} onClose={onClose} />); });
  const tap = async (x:number,y:number) => Renderer.act(() => { tree.root.findAllByProps({accessibilityLabel:'Mark two corners on the photo'}).find(node=>node.props.onPress)?.props.onPress({nativeEvent:{locationX:x,locationY:y}}); });
  await tap(28,0); expect(JSON.stringify(tree.toJSON())).toContain('0 of 2 corners');
  await tap(28,53); await tap(140,165);
  await Renderer.act(async () => { await tree.root.findAllByProps({accessibilityLabel:'Save unidentified region'}).find(node=>node.props.onPress)?.props.onPress(); });
  expect(onSave).toHaveBeenCalledWith([.1,.1,.5,.5],expect.stringMatching(/^region_/));
  expect(onClose).toHaveBeenCalledTimes(1);
  await Renderer.act(() => tree.unmount());
});

test('failed manual box save retains the region and retry id', async () => {
  const onSave = jest.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined);
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(() => { tree = Renderer.create(<MarkObjectModal image="/scene.jpg" width={100} height={100} onSave={onSave} onClose={jest.fn()} />); });
  for (const [x,y] of [[28,53],[140,165]]) await Renderer.act(() => { tree.root.findAllByProps({accessibilityLabel:'Mark two corners on the photo'}).find(node=>node.props.onPress)?.props.onPress({nativeEvent:{locationX:x,locationY:y}}); });
  const save = async () => Renderer.act(async () => { await tree.root.findAllByProps({accessibilityLabel:'Save unidentified region'}).find(node=>node.props.onPress)?.props.onPress(); });
  await save(); expect(JSON.stringify(tree.toJSON())).toContain('Offline');
  await save(); expect(onSave.mock.calls[0][1]).toBe(onSave.mock.calls[1][1]);
  await Renderer.act(() => tree.unmount());
});

test('all valid unidentified regions keep boxes and selectable object rows', async () => {
  const prediction = { id:1, assessment:{material:{status:'needs_confirmation'},missing_information:['condition'],segregation:{instructions:[]}},recommendation_choices:[] };
  const scene = { id:8,image_url:'/scene.jpg',width:200,height:100,status:'complete',quality:{flags:[]},items:[1,2,3,4,5,6,7].map(id=>({id,box:[.1,.1,.3,.4],name:'Unidentified object',score:.1,display_box:false,display_group:'review',prediction,route:{key:'review',label:'Needs review',reason:'Unknown'}})) } as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()} onReview={jest.fn()} />); });
  expect(tree.root.findAllByProps({accessibilityLabel:'Select box 7'}).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Discard item 7: Unidentified object'}).length).toBeGreaterThan(0);
  await Renderer.act(() => { tree.root.findAllByProps({accessibilityLabel:'Select box 7'}).find(node=>node.props.onPress)?.props.onPress(); });
  expect(tree.root.findAllByProps({accessibilityLabel:'Select box 7'})[0].props.accessibilityState.checked).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Continue with 1 selected item');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Hide review items');
  await Renderer.act(() => tree.unmount());
});

test('research sharing never happens before explicit consent', async () => {
  const alert = jest.spyOn(Alert,'alert').mockImplementation(() => undefined);
  const prediction = { id:5,image_url:'/crop.jpg',quantity:1,confidence:.3,recommendation_choices:[],assessment:{material:{title:'Unknown',status:'needs_confirmation'},questions:[],segregation:{status:'needs_information',instructions:[],sources:[]},upcycling:{status:'needs_information'}} } as unknown as Prediction;
  (contributeIdentification as jest.Mock).mockResolvedValue({status:'pending'});
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(() => { tree = Renderer.create(<AssessmentScreen prediction={prediction} onBack={jest.fn()} onRetry={jest.fn()} onChange={jest.fn()} onSaved={jest.fn()} />); });
  await Renderer.act(() => { tree.root.findAllByProps({accessibilityLabel:'Skip check for now'}).find(node=>node.props.onPress)?.props.onPress(); });
  // Find the native pressable through its child text without depending on RN host names.
  const text = tree.root.findAll(node=>node.props.children === 'Optional: contribute this image for human research review')[0];
  await Renderer.act(() => { let parent = text.parent; while(parent && !parent.props.onPress) parent = parent.parent; parent?.props.onPress(); });
  expect(contributeIdentification).not.toHaveBeenCalled();
  await Renderer.act(async () => { await alert.mock.calls[0][2]?.find(row=>row.text==='I agree')?.onPress?.(); });
  expect(contributeIdentification).toHaveBeenCalledWith(5,false);
  expect(JSON.stringify(tree.toJSON())).toContain('Research review: ');
  alert.mockRestore(); await Renderer.act(() => tree.unmount());
});
