import React from 'react';
import Renderer from 'react-test-renderer';
import App from '../App';
import ScanResult from '../src/ScanResult';
import {launchImageLibrary} from 'react-native-image-picker';
import * as api from '../src/api';
import * as suitability from '../src/upcyclingApi';

jest.mock('react-native-safe-area-context',()=>({SafeAreaProvider:({children}:{children:React.ReactNode})=>children,SafeAreaView:jest.requireActual('react-native').View}));
jest.mock('../src/api',()=>({...jest.requireActual('../src/api'),
 getCurrentUser:jest.fn().mockResolvedValue({id:1,role:'regular',display_name:'Test',barangay:''}),
 getMaterials:jest.fn().mockResolvedValue({materials:[]}),getPredictionOverview:jest.fn().mockResolvedValue({predictions:[],total_count:0}),
 listSavedPredictions:jest.fn().mockResolvedValue([]),listProjects:jest.fn().mockResolvedValue([]),
 createScene:jest.fn(),getScene:jest.fn(),startProject:jest.fn(),confirmDisposalSelection:jest.fn(),
 previewScanMaterial:jest.fn().mockResolvedValue({status:'supported',label:'cardboard',reason:'Matches a supported material.'}),
}));
jest.mock('../src/upcyclingApi',()=>({upcyclingRequest:jest.fn(),getSuggestions:jest.fn(),getVisual:jest.fn(),saveFacts:jest.fn(),startSuitable:jest.fn()}));
const verdict={code:'assessment_pending',title:'Assessment Pending',reason:'Validated condition assessment is unavailable.',next_action:'Do not start yet.',can_start:false,blocking_reasons:['Missing condition assessment']};
const details={mode:'batch',quantity:25,approximate_size:'20 x 10 cm',inspection_report:'none_seen',previous_contents:'No chemical contact known',condition_policy:'inspection-first-v1'};
const prediction={id:12,decision:'cardboard',title:'Cardboard',input_method:'camera',recognition:{status:'supported'},image_quality:{workflow_version:'camera-assessment-v2',scan_details:details},recommendation_choices:[]} as unknown as api.Prediction;
const scene={id:8,width:200,height:200,image_url:'',single_item:{enabled:true},status:'complete',quality:{flags:[]},items:[{id:1,name:'Cardboard',score:0,box:[0,0,1,1],display_box:false,prediction,route:{key:'review',label:'Review',reason:'Condition needs assessment.'}}]} as unknown as api.ScanScene;
const button=(tree:Renderer.ReactTestRenderer,label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>typeof n.props.onPress==='function')!;
async function press(tree:Renderer.ReactTestRenderer,label:string){const node=button(tree,label);expect(node).toBeDefined();await Renderer.act(async()=>{await node.props.onPress();});}
async function enterDetailsAndCapture(tree:Renderer.ReactTestRenderer){
 await press(tree,'Camera');
 expect(tree.root.findAll(n=>typeof n.props.onStarted==='function')).toHaveLength(0);
 await press(tree,'Open camera');await press(tree,'Open gallery');
 await press(tree,'Continue to item details');
 expect(button(tree,'Review scan').props.disabled).toBe(true);
 await Renderer.act(()=>{tree.root.findAllByProps({accessibilityLabel:'Physical-item quantity'}).find(n=>n.props.onChangeText)!.props.onChangeText('25');tree.root.findAllByProps({accessibilityLabel:'Approximate size'}).find(n=>n.props.onChangeText)!.props.onChangeText('20 x 10 cm');});
 await press(tree,'None');
 await press(tree,'No chemical contact known');
}
beforeEach(()=>{
 jest.clearAllMocks();
 (launchImageLibrary as jest.Mock).mockImplementation((_options,callback)=>callback({assets:[{uri:'file:///batch.jpg'}]}));
 (api.createScene as jest.Mock).mockResolvedValue({scene});(api.getScene as jest.Mock).mockResolvedValue({scene});
 (suitability.upcyclingRequest as jest.Mock).mockResolvedValue({snapshot:null});
 (suitability.getVisual as jest.Mock).mockResolvedValue({assessment:{primary:{status:'unavailable'},observations:[],conflicts:[],views:[],facts:{},scan_details:details,workflow:{},capability:{condition_assessment:'unavailable'},verdict}});
 (suitability.getSuggestions as jest.Mock).mockResolvedValue({items:[],outcome:'assessment_pending',message:verdict.reason,facts:{},verdict});
});
test('details and representative capture lead to pending shared assessment without a project-start bypass',async()=>{
 let tree!:Renderer.ReactTestRenderer;
 try{
  await Renderer.act(async()=>{tree=Renderer.create(<App/>);});
  await enterDetailsAndCapture(tree);await press(tree,'Review scan');
  expect(api.createScene).toHaveBeenCalledWith('file:///batch.jpg',expect.any(String),expect.any(Object),true,{primaryView:'front',views:[],details});
  expect(tree.root.findByType(ScanResult).props.prediction.id).toBe(12);
  expect(JSON.stringify(tree.toJSON())).toContain('Assessment Pending');
  expect(JSON.stringify(tree.toJSON())).toContain('20 x 10 cm');
  expect(api.confirmDisposalSelection).not.toHaveBeenCalled();
  expect(api.startProject).not.toHaveBeenCalled();expect(suitability.startSuitable).not.toHaveBeenCalled();
  expect(button(tree,'Check project eligibility')).toBeUndefined();
  expect(button(tree,'Photograph a suspicious area')).toBeUndefined();
  expect(JSON.stringify(tree.toJSON())).not.toContain('Known contents or exposure');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Projects for this item');
 }finally{if(tree)await Renderer.act(()=>tree.unmount());}
});
test('review scan opens the verdict and loads matching ideas automatically',async()=>{
 const suitable={...verdict,code:'suitable',title:'Suitable for Upcycling',reason:'The item passed the assessment.',can_start:true,blocking_reasons:[]};
 (suitability.getVisual as jest.Mock).mockResolvedValue({assessment:{
  primary:{status:'complete'},observations:[],conflicts:[],views:[],facts:{},scan_details:details,
  workflow:{inspection_confirmed:true},capability:{condition_assessment:'available'},verdict:suitable,
 }});
 (suitability.getSuggestions as jest.Mock).mockResolvedValue({
  items:[{id:'cardboard-organizer',title:'Cardboard Desk Organizer',summary:'Make a desk organizer.',status:'needs_information',
   requires_project_review:true,missing_information:['published project-specific suitability requirements'],
   requirements:{minimum_quantity:1,dimensions:{length:{minimum:200},width:{minimum:100}}}}],
  outcome:'suitable',facts:{},verdict:suitable,
 });
 let tree!:Renderer.ReactTestRenderer;
 try{
  await Renderer.act(async()=>{tree=Renderer.create(<App/>);});
  await enterDetailsAndCapture(tree);await press(tree,'Review scan');
  expect(suitability.getSuggestions).toHaveBeenCalledWith(prediction.id,'',false);
  expect(JSON.stringify(tree.toJSON())).toContain('Suitable for Upcycling');
  expect(button(tree,'View requirements: Cardboard Desk Organizer')).toBeDefined();
  await press(tree,'View requirements: Cardboard Desk Organizer');
  expect(JSON.stringify(tree.toJSON())).toContain('Its requirements still need to be published.');
  expect(tree.root.findAllByProps({accessibilityLabel:'length in mm'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Usable quantity'})).toHaveLength(0);
  expect(button(tree,'Edit confirmed item details')).toBeUndefined();
  expect(button(tree,'Choose a goal')).toBeUndefined();
  expect(api.startProject).not.toHaveBeenCalled();
 }finally{if(tree)await Renderer.act(()=>tree.unmount());}
});
test('assessment errors keep batch photos and metadata for retry',async()=>{
 (api.createScene as jest.Mock).mockRejectedValueOnce(new Error('Service temporarily unavailable.')).mockResolvedValue({scene});
 let tree!:Renderer.ReactTestRenderer;
 try{
  await Renderer.act(async()=>{tree=Renderer.create(<App/>);});
  await enterDetailsAndCapture(tree);await press(tree,'Review scan');
  expect(JSON.stringify(tree.toJSON())).toContain('Service temporarily unavailable.');
  expect(JSON.stringify(tree.toJSON())).toContain('Item details');
  expect(button(tree,'Review scan').props.disabled).toBe(false);
  await press(tree,'Review scan');
  const calls=(api.createScene as jest.Mock).mock.calls;
  expect(calls).toHaveLength(2);expect(calls[1]).toEqual(calls[0]);expect(calls[1][4].details).toEqual(details);
  expect(tree.root.findByType(ScanResult).props.prediction.id).toBe(12);
 }finally{if(tree)await Renderer.act(()=>tree.unmount());}
});
