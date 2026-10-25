import React from 'react';
import Renderer from 'react-test-renderer';
import {Text} from 'react-native';
import App from '../App';
import ProjectPanels from '../src/ProjectPanels';
import ProjectGuide from '../src/ProjectGuide';
import UpcyclingIdeaChoices from '../src/UpcyclingIdeaChoices';
import * as api from '../src/api';

jest.mock('react-native-safe-area-context',()=>({SafeAreaProvider:({children}:{children:React.ReactNode})=>children,SafeAreaView:jest.requireActual('react-native').View}));
jest.mock('../src/api',()=>({
  ...jest.requireActual('../src/api'),
  getCurrentUser:jest.fn().mockResolvedValue({id:1,role:'regular',display_name:'Test',barangay:''}),
  getMaterials:jest.fn().mockResolvedValue({materials:[]}),
  getPredictionOverview:jest.fn().mockResolvedValue({predictions:[],total_count:0}),
  listSavedPredictions:jest.fn().mockResolvedValue([]),listProjects:jest.fn(),
  createScene:jest.fn(),getScene:jest.fn(),confirmDisposalSelection:jest.fn(),startProject:jest.fn(),setProjectStep:jest.fn(),getProjectIdeas:jest.fn(),changeProjectIdea:jest.fn(),
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
  (api.confirmDisposalSelection as jest.Mock).mockResolvedValue({scene:{...scene,disposal_selection:{confirmed:true,item_ids:[1],item_actions:{1:'recover'}},items:[{...scene.items[0],action_advice:{
    chosen_action:'recover',title:'Recycle / upcycle',steps:['Check for residue.','Keep paper dry.','Reuse a clean sheet.'],waste_group:'recyclable',sources:[],projects:prediction.upcycling_ideas,
  }}]}});
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
    await Renderer.act(()=>tree.root.findAllByProps({accessibilityLabel:'Camera framing area'}).find(node=>node.props.onLayout)!.props.onLayout({nativeEvent:{layout:{width:400,height:600}}}));
    await press('Take photo');
    const analyze=tree.root.findAll(node=>typeof node.props.onPress==='function' && node.findAllByType(Text).some(child=>child.props.children==='Analyze image'))[0];
    await Renderer.act(async()=>{await analyze.props.onPress();});
    await press('Show uncertain suggestions (1)');
    await press('Select item 1: Paper');
    await press('Clean & dry condition item 1');
    await press('Continue with 1 selected item');
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

test('fabric Change idea returns directly to the original blanket choices and reopens its saved cloth project',async()=>{
  jest.clearAllMocks();
  const ideas=[{id:'fabric_cleaning_cloth',title:'Cleaning cloth',summary:'Reuse clean fabric.',steps:['Check the blanket.','Prepare the cloth.','Store dry.']},
    {id:'fabric_pouch',title:'Fabric pouch',summary:'Make a small pouch.',steps:['Choose fabric.','Fold it.','Secure it.']}];
  const project={id:8,source_prediction_id:247,recommendation_id:'fabric_pouch',title:'Fabric pouch',material:'Fabric scraps',summary:'',materials:['Fabric'],steps:ideas[1].steps,safety_note:'Use suitable fabric.',completed_steps:[],completed_count:0,total_steps:3,progress_percent:0,status:'active',can_change_idea:true} as unknown as api.UserProject;
  const cloth={...project,id:7,recommendation_id:'fabric_cleaning_cloth',title:'Cleaning cloth',steps:ideas[0].steps,completed_steps:[0],completed_count:1,progress_percent:33,can_change_idea:false};
  const prediction={id:247,title:'Fabric scraps',condition:'Clean and dry',recommendation_choices:[],assessment:{material:{title:'Fabric scraps',status:'needs_confirmation'},segregation:{instructions:[]}}} as unknown as api.Prediction;
  const scene={id:34,width:100,height:100,image_url:'/blanket-original.jpg',status:'complete',quality:{flags:[]},disposal_selection:{confirmed:true,item_ids:[1]},items:[{id:1,name:'blanket',score:.8,box:[.1,.1,.9,.9],prediction,route:{key:'review',label:'Review',reason:'Check material.'},action_advice:{chosen_action:'recover',title:'Recycle / upcycle',waste_group:'diversion',steps:['Use suitable fabric.'],sources:[],projects:ideas}}]} as unknown as api.ScanScene;
  (api.listProjects as jest.Mock).mockResolvedValue([]);
  (api.createScene as jest.Mock).mockResolvedValue({scene});(api.getScene as jest.Mock).mockResolvedValue({scene});
  (api.startProject as jest.Mock).mockResolvedValue({project});
  (api.getProjectIdeas as jest.Mock).mockResolvedValue({source:{prediction_id:247,material:'Fabric scraps',object_name:'blanket',image_url:'/blanket-crop.jpg'},ideas:[{...ideas[0],existing_project_id:7,existing_project_status:'active'},ideas[1]]});
  (api.changeProjectIdea as jest.Mock).mockResolvedValue({project:cloth,reused_existing:true,replaced_project_id:8});
  let tree!:Renderer.ReactTestRenderer;
  const press=async(label:string)=>{const node=tree.root.findAllByProps({accessibilityLabel:label}).find(value=>typeof value.props.onPress==='function');expect(node).toBeDefined();await Renderer.act(async()=>{await node!.props.onPress();});};
  try{
    await Renderer.act(async()=>{tree=Renderer.create(<App/>);});
    await press('Camera');await Renderer.act(()=>tree.root.findAll(node=>typeof node.props.onStarted==='function')[0].props.onStarted());
    await Renderer.act(()=>tree.root.findAllByProps({accessibilityLabel:'Camera framing area'}).find(node=>node.props.onLayout)!.props.onLayout({nativeEvent:{layout:{width:400,height:600}}}));
    await press('Take photo');
    const analyze=tree.root.findAll(node=>typeof node.props.onPress==='function' && node.findAllByType(Text).some(child=>child.props.children==='Analyze image'))[0];
    await Renderer.act(async()=>{await analyze.props.onPress();});
    expect(tree.root.findByType(UpcyclingIdeaChoices).props.material).toBe('Fabric scraps');
    await press('Choose task: Fabric pouch');await press('Change idea');
    expect(tree.root.findAllByType(ProjectGuide)).toHaveLength(0);
    expect(api.getProjectIdeas).toHaveBeenCalledWith(8);
    expect(tree.root.findByType(UpcyclingIdeaChoices).props.material).toBe('Fabric scraps');
    expect(tree.root.findAllByProps({accessibilityLabel:'Original item for upcycling ideas'})[0].props.source.uri).toContain('/blanket-crop.jpg');
    await press('Back to current idea');
    expect(tree.root.findByType(ProjectGuide).props.project.id).toBe(8);
    expect(api.changeProjectIdea).not.toHaveBeenCalled();
    await press('Change idea');
    await press('Choose task: Cleaning cloth');
    expect(api.changeProjectIdea).toHaveBeenCalledWith(8,'fabric_cleaning_cloth');
    expect(api.startProject).toHaveBeenCalledTimes(1);
    expect(tree.root.findByType(ProjectGuide).props.project.id).toBe(7);
    expect(tree.root.findByType(ProjectGuide).props.project.completed_steps).toEqual([0]);
    await press('Close upcycling flow');
    expect(tree.root.findAllByType(ProjectGuide)).toHaveLength(0);
    expect(tree.root.findByType(UpcyclingIdeaChoices).props.material).toBe('Fabric scraps');
    expect(api.setProjectStep).not.toHaveBeenCalled();
  }finally{if(tree)await Renderer.act(()=>tree.unmount());}
});
