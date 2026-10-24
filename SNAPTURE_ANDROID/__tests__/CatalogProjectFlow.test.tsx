import React from 'react';
import Renderer from 'react-test-renderer';
import {Text} from 'react-native';
import App from '../App';
import ProjectPanels from '../src/ProjectPanels';
import * as api from '../src/api';

jest.mock('react-native-safe-area-context',()=>({SafeAreaProvider:({children}:{children:React.ReactNode})=>children,SafeAreaView:jest.requireActual('react-native').View}));
jest.mock('../src/api',()=>({
  ...jest.requireActual('../src/api'),
  getCurrentUser:jest.fn().mockResolvedValue({id:1,role:'regular',display_name:'Test',barangay:''}),
  getMaterials:jest.fn().mockResolvedValue({materials:[]}),
  getPredictionOverview:jest.fn().mockResolvedValue({predictions:[],total_count:0}),
  listSavedPredictions:jest.fn().mockResolvedValue([]),listProjects:jest.fn(),
  createScene:jest.fn(),getScene:jest.fn(),startProject:jest.fn(),setProjectStep:jest.fn(),
}));

test('capture, analyze, choose task, finish steps and land in Projects completed',async()=>{
  jest.useFakeTimers();
  let tree!:Renderer.ReactTestRenderer;
  let saved:api.UserProject|null=null;
  const project={id:90,source_prediction_id:12,recommendation_id:'paper_gift_wrap',title:'Gift wrapping',material:'Paper',summary:'Reuse a sheet.',
    materials:['Paper'],steps:['Flatten the paper.','Wrap the gift.','Tie with string.'],safety_note:'Use clean paper.',reference:{review_level:'educational'},
    completed_steps:[],completed_count:0,total_steps:3,progress_percent:0,status:'active',created_at:'2026-10-22T00:00:00Z',updated_at:'2026-10-22T00:00:00Z'} as api.UserProject;
  const prediction={id:12,title:'Paper',recommendation_choices:[],upcycling_ideas:[{id:'paper_gift_wrap',title:'Gift wrapping',summary:'Reuse a sheet.',materials:project.materials,steps:project.steps,safety_note:'Use clean paper.'}],
    assessment:{material:{status:'needs_confirmation',title:'Paper'},missing_information:[],segregation:{status:'needs_information',instructions:[]}}} as unknown as api.Prediction;
  const scene={id:8,width:200,height:200,image_url:'',status:'complete',quality:{flags:[]},items:[{id:1,name:'Paper',score:0,box:[0,0,1,1],display_box:false,prediction,route:{key:'review',label:'Review',reason:'Check material.'}}]} as unknown as api.ScanScene;
  (api.listProjects as jest.Mock).mockImplementation(async()=>saved?[saved]:[]);
  (api.createScene as jest.Mock).mockResolvedValue({scene});(api.getScene as jest.Mock).mockResolvedValue({scene});
  (api.startProject as jest.Mock).mockImplementation(async()=>{saved=project;return {project:saved};});
  (api.setProjectStep as jest.Mock).mockImplementation(async(_id:number,index:number,completed:boolean)=>{
    const steps=completed?[...new Set([...saved!.completed_steps,index])]:saved!.completed_steps.filter(value=>value!==index);
    saved={...saved!,completed_steps:steps,completed_count:steps.length,progress_percent:Math.round(steps.length/3*100),status:steps.length===3?'completed':'active'};
    return {project:saved};
  });
  const press=async(label:string)=>{
    const node=tree.root.findAllByProps({accessibilityLabel:label}).find(value=>typeof value.props.onPress==='function');
    expect(node).toBeDefined();
    await Renderer.act(async()=>{await node!.props.onPress();});
  };
  try{
    await Renderer.act(async()=>{tree=Renderer.create(<App/>);});
    await press('Camera');
    await Renderer.act(()=>tree.root.findAll(node=>typeof node.props.onStarted==='function')[0].props.onStarted());
    await press('Take photo');
    const analyze=tree.root.findAll(node=>typeof node.props.onPress==='function' && node.findAllByType(Text).some(child=>child.props.children==='Analyze image'))[0];
    await Renderer.act(async()=>{await analyze.props.onPress();});
    await press('Choose task: Gift wrapping');
    expect(api.startProject).toHaveBeenCalledWith(12,'paper_gift_wrap');
    expect(JSON.stringify(tree.toJSON())).toContain('Flatten the paper.');
    await press('Mark as done');await Renderer.act(async()=>{jest.advanceTimersByTime(500);});
    await press('Mark as done');await Renderer.act(async()=>{jest.advanceTimersByTime(500);});
    await press('Completed');
    expect(api.setProjectStep).toHaveBeenLastCalledWith(90,2,true);
    expect(tree.root.findByType(ProjectPanels).props.initialFilter).toBe('completed');
    expect(JSON.stringify(tree.toJSON())).toContain('Projects completed');
    expect(JSON.stringify(tree.toJSON())).toContain('Gift wrapping');
    expect(saved!.status).toBe('completed');
  }finally{
    if(tree)await Renderer.act(()=>tree.unmount());
    jest.useRealTimers();
  }
});
