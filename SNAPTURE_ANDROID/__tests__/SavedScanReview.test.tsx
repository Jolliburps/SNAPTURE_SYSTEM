import React from 'react';
import Renderer from 'react-test-renderer';
import { Alert } from 'react-native';
import App from '../App';
import SavedScanReview from '../src/SavedScanReview';
import SceneResults from '../src/SceneResults';
import { deleteScene, getSavedScan, getScene, listPredictions, getCurrentUser, type Prediction, type ScanScene } from '../src/api';

jest.mock('react-native-safe-area-context',()=>({SafeAreaProvider:({children}:{children:React.ReactNode})=>children,SafeAreaView:jest.requireActual('react-native').View}));
jest.mock('../src/api',()=>({
  ...jest.requireActual('../src/api'),deleteScene:jest.fn().mockResolvedValue({deleted:true}),getSavedScan:jest.fn(),getScene:jest.fn(),listPredictions:jest.fn(),getCurrentUser:jest.fn().mockResolvedValue(null),
  getMaterials:jest.fn().mockResolvedValue({materials:[]}),getPredictionOverview:jest.fn().mockResolvedValue({predictions:[],total_count:0}),listProjects:jest.fn().mockResolvedValue([]),listSavedPredictions:jest.fn().mockResolvedValue([]),
}));
function record(id:number):Prediction {return {id,title:`Saved paper ${id}`,created_at:'2026-10-20T10:00:00Z',image_url:`/saved-${id}.jpg`,confidence:.81,input_method:'camera',recommendation_choices:[],assessment:{material:{status:'needs_confirmation'},segregation:{category:'Saved category',explanation:'Saved explanation.',instructions:['Saved preparation.']}}} as unknown as Prediction;}
function action(tree:Renderer.ReactTestRenderer,label:string){return tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!;}
async function press(tree:Renderer.ReactTestRenderer,label:string){await Renderer.act(async()=>action(tree,label).props.onPress());}
beforeEach(()=>jest.clearAllMocks());

test('a grouped photo entry shows the item count and deletes the whole scan only after confirmation',async()=>{
  const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>undefined);
  (getCurrentUser as jest.Mock).mockResolvedValue({id:1,role:'regular'});
  (listPredictions as jest.Mock).mockResolvedValue([{...record(30),title:'Photo scan',scene_id:6,item_count:14,original_image_url:'/original-6.jpg'}]);
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<App/>);});
  await Renderer.act(async()=>tree.root.find(node=>typeof node.type==='function' && node.type.name==='MainShell').props.navigate('history'));
  expect(JSON.stringify(tree.toJSON())).toContain('14 detected items');
  expect(tree.root.findAllByProps({accessibilityLabel:'Photo preview for scan 30'})[0].props.source.uri).toContain('/original-6.jpg');
  await press(tree,'Delete saved scan 30');
  expect(deleteScene).not.toHaveBeenCalled();
  expect(alert.mock.calls[0][1]).toContain('all detected item results');
  await Renderer.act(async()=>{await alert.mock.calls[0][2]?.find(button=>button.text==='Delete')?.onPress?.();});
  expect(deleteScene).toHaveBeenCalledWith(6);
  expect(JSON.stringify(tree.toJSON())).toContain('No saved scans yet');
  await Renderer.act(()=>tree.unmount());alert.mockRestore();
});

test('each legacy history row opens its own ID, photo and saved result; Back restores history',async()=>{
  (getCurrentUser as jest.Mock).mockResolvedValue({id:1,role:'regular'});
  (listPredictions as jest.Mock).mockResolvedValue([record(11),record(22)]);
  (getSavedScan as jest.Mock).mockImplementation(async id=>({prediction:record(id),scene:null}));
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<App/>);});
  const shell=tree.root.find(node=>typeof node.type==='function' && node.type.name==='MainShell');
  await Renderer.act(async()=>shell.props.navigate('history'));
  expect(tree.root.findAllByProps({accessibilityLabel:'Photo preview for scan 11'})[0].props.source.uri).toContain('/saved-11.jpg');
  expect(tree.root.findAllByProps({accessibilityLabel:'Photo preview for scan 22'})[0].props.source.uri).toContain('/saved-22.jpg');
  await press(tree,'Open saved scan 11');
  expect(getSavedScan).toHaveBeenLastCalledWith(11);
  expect(tree.root.findAllByProps({accessibilityLabel:'Original scanned photo'})[0].props.source.uri).toContain('/saved-11.jpg');
  await press(tree,'Back to scan history');
  await press(tree,'Open saved scan 22');
  expect(getSavedScan).toHaveBeenLastCalledWith(22);
  expect(tree.root.findAllByProps({accessibilityLabel:'Original scanned photo'})[0].props.source.uri).toContain('/saved-22.jpg');
  await press(tree,'Expand saved item details');
  expect(JSON.stringify(tree.toJSON())).toContain('Saved preparation.');
  await Renderer.act(()=>tree.unmount());
});

test('history handles missing preview files and no-photo assessments without blocking saved results',async()=>{
  (getCurrentUser as jest.Mock).mockResolvedValue({id:1,role:'regular'});
  (listPredictions as jest.Mock).mockResolvedValue([record(11),{...record(12),input_method:'manual',image_url:null}]);
  (getSavedScan as jest.Mock).mockResolvedValue({prediction:record(11),scene:null});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<App/>);});
  await Renderer.act(async()=>tree.root.find(node=>typeof node.type==='function' && node.type.name==='MainShell').props.navigate('history'));
  expect(JSON.stringify(tree.toJSON())).toContain('No photo · manual assessment');
  await Renderer.act(()=>tree.root.findAllByProps({accessibilityLabel:'Photo preview for scan 11'})[0].props.onError());
  expect(JSON.stringify(tree.toJSON())).toContain('Photo unavailable · tap to view saved results');
  await press(tree,'Open saved scan 11');
  expect(getSavedScan).toHaveBeenCalledWith(11);
  await Renderer.act(()=>tree.unmount());
});

test('a scene-linked record shows its original photo and all saved item accordions without refetching live results',async()=>{
  const prediction=record(8);
  const scene={id:4,image_url:'/original-4.jpg',created_at:prediction.created_at,width:100,height:100,status:'complete',quality:{flags:[]},items:[{id:9,name:'saved paper scrap',score:.81,box:[.1,.1,.4,.4],prediction,display_group:'review',route:{label:'Saved route',reason:'Saved reason.'}}]} as unknown as ScanScene;
  (getSavedScan as jest.Mock).mockResolvedValue({prediction,scene});
  scene.disposal_selection={confirmed:true,item_ids:[9]};
  const onBack=jest.fn();let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SavedScanReview id={8} onBack={onBack} onRetry={jest.fn()}/>);});
  expect(tree.root.findByType(SceneResults).props.historical).toBe(true);
  expect(getScene).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({accessibilityLabel:'Original scanned photo'})[0].props.source.uri).toContain('/original-4.jpg');
  expect(action(tree,'Select item 1 card').props.accessibilityState.expanded).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Saved preparation.');
  expect(tree.root.findAllByProps({accessibilityLabel:'Review item 1'})).toHaveLength(0);
  await press(tree,'Back');expect(onBack).toHaveBeenCalledTimes(1);
  // Simulate reopening the app: re-fetch the selected ID, not camera memory.
  await Renderer.act(()=>tree.unmount());
  await Renderer.act(async()=>{tree=Renderer.create(<SavedScanReview id={8} onBack={onBack} onRetry={jest.fn()}/>);});
  expect(getSavedScan).toHaveBeenCalledTimes(2);
  expect(tree.root.findAllByProps({accessibilityLabel:'Original scanned photo'})[0].props.source.uri).toContain('/original-4.jpg');
  await Renderer.act(()=>tree.unmount());
});

test('a missing file keeps saved results readable and a failed request offers retry',async()=>{
  (getSavedScan as jest.Mock).mockRejectedValueOnce(new Error('Saved scan not found.')).mockResolvedValue({prediction:record(5),scene:null});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SavedScanReview id={5} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Saved scan not found.');
  await press(tree,'Retry saved scan');
  await Renderer.act(()=>tree.root.findAllByProps({accessibilityLabel:'Original scanned photo'})[0].props.onError());
  expect(JSON.stringify(tree.toJSON())).toContain('The original photo is unavailable.');
  expect(JSON.stringify(tree.toJSON())).toContain('Saved paper 5');
  await Renderer.act(()=>tree.unmount());
});

test('no-photo entries do not substitute the latest camera image',async()=>{
  (getSavedScan as jest.Mock).mockResolvedValue({prediction:{...record(7),image_url:null,input_method:'manual',assessment:null},scene:null});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SavedScanReview id={7} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(tree.root.findAllByProps({accessibilityLabel:'Original scanned photo'})).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('No photo was saved.');
  await press(tree,'Expand saved item details');
  expect(JSON.stringify(tree.toJSON())).toContain('No assessment snapshot was saved');
  await Renderer.act(()=>tree.unmount());
});
