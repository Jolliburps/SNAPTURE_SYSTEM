import React from 'react';
import Renderer from 'react-test-renderer';
import ScanResult from '../src/ScanResult';
import {upcyclingRequest,getSuggestions,getVisual,startSuitable} from '../src/upcyclingApi';
import {ProjectFlowContext} from '../src/ProjectFlowContext';
import type {Prediction} from '../src/api';
jest.mock('../src/upcyclingApi',()=>({upcyclingRequest:jest.fn(),getSuggestions:jest.fn(),getVisual:jest.fn(),startSuitable:jest.fn()}));
test.each(['hazardous','unsupported','supported'])('saved %s result does not regenerate recommendations',async kind=>{
  (upcyclingRequest as jest.Mock).mockResolvedValue({snapshot:{classification:{kind,reason:'Saved classification'},prediction:{id:1,decision:kind==='supported'?'paper':'unknown_unsupported',title:'Saved material',created_at:'2026-11-20T00:00:00Z'},object:'Saved object',photos:[],visual:{observations:[],views:[],facts:{}},suggestions:{items:[],message:'Saved message',facts:{}}}});
  let tree!:Renderer.ReactTestRenderer;await Renderer.act(async()=>{tree=Renderer.create(<ScanResult prediction={{id:1} as Prediction} historical onBack={jest.fn()} onRetry={jest.fn()}/>);});
  const output=JSON.stringify(tree.toJSON());
  if(kind==='hazardous'){expect(output).toContain('HAZARDOUS WASTE');expect(output).toContain('not eligible for upcycling');expect(output).not.toContain('Projects for this item');}
  if(kind==='unsupported'){expect(output).toContain('Photo Needs Review');expect(output).not.toContain('Projects for this item');}
  if(kind==='supported')expect(output).toContain('Projects for this item');
  expect(getSuggestions).not.toHaveBeenCalled();await Renderer.act(async()=>tree.unmount());
});

test('a saved inspection can check the current catalog and start a ready project',async()=>{
  const prediction={id:58,decision:'pete_bottles',created_at:'2026-11-20T00:00:00Z'} as Prediction;
  const visual={scan_details:{condition_policy:'inspection-first-v1',inspection_report:'none_seen',quantity:1,approximate_size:'7 L'},
    workflow:{inspection_confirmed:true,usable_quantity:1},primary:{status:'not_assessed'},observations:[],conflicts:[],views:[],facts:{}};
  const ready={id:'pete_planter',title:'Self-watering planter',status:'suitable',can_start:true,missing_information:[],requirements:{}};
  const pending={...ready,id:'pete_organizer',title:'Desk organizer',status:'needs_information',can_start:false,requires_project_review:true};
  (upcyclingRequest as jest.Mock).mockResolvedValue({snapshot:{classification:{kind:'supported'},prediction,photos:[],visual,suggestions:{items:[],facts:{}}}});
  (getSuggestions as jest.Mock).mockClear().mockResolvedValue({items:[ready,pending],facts:{},verdict:{code:'suitable'}});
  (getVisual as jest.Mock).mockResolvedValue({assessment:visual});
  const project={id:12};
  (startSuitable as jest.Mock).mockResolvedValue({project});
  const openProject=jest.fn();
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<ProjectFlowContext.Provider value={openProject}>
    <ScanResult prediction={prediction} historical onBack={jest.fn()} onRetry={jest.fn()}/>
  </ProjectFlowContext.Provider>);});
  const action=(name:string)=>tree.root.findAllByProps({accessibilityLabel:name}).find(node=>node.props.onPress);
  expect(getSuggestions).not.toHaveBeenCalled();
  await Renderer.act(async()=>action('Check current project matches')!.props.onPress());
  expect(getSuggestions).toHaveBeenCalledWith(58,'',false);
  expect(action('Start Desk organizer')).toBeUndefined();
  expect(action('Start Self-watering planter')?.props.disabled).toBe(false);
  await Renderer.act(async()=>action('Start Self-watering planter')!.props.onPress());
  expect(startSuitable).toHaveBeenCalledWith(58,'pete_planter',false);
  expect(openProject).toHaveBeenCalledWith(project);
  await Renderer.act(async()=>tree.unmount());
});

test('the six-side verdict distinguishes disposal guidance from a material retake',async()=>{
  const prediction={id:58,decision:'unknown_unsupported',recognition:{status:'unsupported'}} as Prediction;
  (upcyclingRequest as jest.Mock).mockResolvedValue({snapshot:{
    classification:{kind:'disposal',reason:'Outside the catalog.',next_action:'Ask your barangay how to sort it.'},
    prediction,photos:[],visual:{scan_details:{capture_mode:'all-sides-v1'}},suggestions:{items:[]},
  }});
  (getSuggestions as jest.Mock).mockClear();
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<ScanResult prediction={prediction} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('For disposal or recycling');
  expect(JSON.stringify(tree.toJSON())).toContain('Ask your barangay how to sort it.');
  expect(getSuggestions).not.toHaveBeenCalled();
  await Renderer.act(async()=>tree.unmount());
});

test.each([
  [{status:'needs_review'}, 'Photo Needs Review','Retake scan'],
  [{status:'unsupported'}, 'Out of Scope','Scan another item'],
  [{status:'needs_review',unavailable:true}, 'Material Check Unavailable','Scan another item'],
] as const)('unconfirmed scan results show the matching heading and next action (%s)',async (recognition,title,action)=>{
  (upcyclingRequest as jest.Mock).mockResolvedValue({snapshot:null});
  (getSuggestions as jest.Mock).mockResolvedValue({items:[],facts:{},message:'No matching project.'});
  (getVisual as jest.Mock).mockResolvedValue({assessment:{primary:{status:'unavailable'},observations:[],conflicts:[],views:[],facts:{}}});
  const retry=jest.fn();
  let tree!:Renderer.ReactTestRenderer;
  const prediction={id:1,decision:'unknown_unsupported',recognition:{...recognition,suggested_label:null,reason:''}} as Prediction;
  await Renderer.act(async()=>{tree=Renderer.create(<ScanResult prediction={prediction} onBack={jest.fn()} onRetry={retry}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain(title);
  await Renderer.act(()=>tree.root.findAllByProps({accessibilityLabel:action}).find(node=>node.props.onPress)!.props.onPress());
  expect(retry).toHaveBeenCalledTimes(1);
  await Renderer.act(()=>tree.unmount());
});
