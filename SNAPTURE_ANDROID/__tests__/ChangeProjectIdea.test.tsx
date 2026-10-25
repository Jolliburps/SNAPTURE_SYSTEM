import React,{useState} from 'react';
import Renderer from 'react-test-renderer';
import ProjectGuide from '../src/ProjectGuide';
import ProjectIdeaPicker from '../src/ProjectIdeaPicker';
import UpcyclingIdeaChoices from '../src/UpcyclingIdeaChoices';
import {getProjectIdeas,changeProjectIdea,type UserProject} from '../src/api';

jest.mock('../src/api',()=>({getProjectIdeas:jest.fn(),changeProjectIdea:jest.fn(),imageUrl:(uri:string)=>uri}));
const base={id:31,source_prediction_id:12,recommendation_id:'paper-wrap',title:'Gift wrapping',material:'Paper',summary:'Wrap a gift.',materials:['Paper'],steps:['Choose a sheet.','Wrap a gift.'],safety_note:'Use clean paper.',completed_steps:[],completed_count:0,total_steps:2,progress_percent:0,status:'active',can_change_idea:true} as unknown as UserProject;
const next={...base,recommendation_id:'paper-organizer',title:'Paper organizer',steps:['Choose dry sheets.','Fold the tray.']};
let tree:Renderer.ReactTestRenderer;
function button(label:string){return tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function');}
async function press(label:string){expect(button(label)).toBeDefined();await Renderer.act(async()=>{await button(label)!.props.onPress();});}
function Harness({initial=base}:{initial?:UserProject}){
  const [project,setProject]=useState(initial);
  const [choosing,setChoosing]=useState(false);
  if(choosing)return <ProjectIdeaPicker project={project} onCancel={()=>setChoosing(false)} onChanged={value=>{setProject(value);setChoosing(false);}}/>;
  return <ProjectGuide project={project} onChangeIdea={()=>setChoosing(true)} onDone={jest.fn()} onRestart={jest.fn()} onStep={async(_id,index,done)=>{
    const completed_steps=done?[index]:[];
    const updated={...project,completed_steps,completed_count:completed_steps.length,can_change_idea:false};setProject(updated);return updated;
  }}/>;
}
beforeEach(()=>{
  jest.clearAllMocks();
  (getProjectIdeas as jest.Mock).mockResolvedValue({ideas:[{id:'paper-organizer',title:'Paper organizer',summary:'Fold a tray.',steps:next.steps}]});
  (changeProjectIdea as jest.Mock).mockResolvedValue({project:next});
});
afterEach(async()=>{if(tree)await Renderer.act(()=>tree.unmount());});

test('can cancel without altering the choice, or replace the same project and return to its first step',async()=>{
  await Renderer.act(async()=>{tree=Renderer.create(<Harness/>);});
  await press('Change idea');expect(getProjectIdeas).toHaveBeenCalledWith(31);
  await press('Keep current idea');expect(changeProjectIdea).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain('Gift wrapping');
  await press('Change idea');await press('Choose task: Paper organizer');
  expect(changeProjectIdea).toHaveBeenCalledWith(31,'paper-organizer');
  expect(JSON.stringify(tree.toJSON())).toContain('Choose dry sheets.');
  expect(tree.root.findAllByProps({accessibilityRole:'header'}).map(node=>node.children.join(''))).toContain('Step 1 of 2');
  expect(button('Change idea')).toBeDefined();
});

test('save failure retains old project and lets the user retry or cancel',async()=>{
  (changeProjectIdea as jest.Mock).mockRejectedValueOnce(new Error('Connection lost.'));
  await Renderer.act(async()=>{tree=Renderer.create(<Harness/>);});
  await press('Change idea');await press('Choose task: Paper organizer');
  expect(JSON.stringify(tree.toJSON())).toContain('Connection lost.');
  expect(tree.root.findByType(ProjectIdeaPicker).props.project.recommendation_id).toBe('paper-wrap');
  await press('Choose task: Paper organizer');
  expect(JSON.stringify(tree.toJSON())).toContain('Choose dry sheets.');
});

test('completed or previously started projects never offer the change option',async()=>{
  await Renderer.act(async()=>{tree=Renderer.create(<Harness initial={{...base,can_change_idea:false}}/>);});
  expect(button('Change idea')).toBeUndefined();expect(getProjectIdeas).not.toHaveBeenCalled();
});

test('marking the first step locks idea changes even after undoing it',async()=>{
  jest.useFakeTimers();
  try{
    await Renderer.act(async()=>{tree=Renderer.create(<Harness/>);});
    await press('Mark as done');
    expect(button('Change idea')).toBeUndefined();
    await press('Review step 1');await press('Undo this step');
    expect(button('Change idea')).toBeUndefined();
    expect(button('Mark as done')).toBeDefined();
  }finally{jest.useRealTimers();}
});

test('loading errors can be retried and empty choices do not create a non-working action',async()=>{
  (getProjectIdeas as jest.Mock).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ideas:[]});
  await Renderer.act(async()=>{tree=Renderer.create(<Harness/>);});await press('Change idea');
  expect(JSON.stringify(tree.toJSON())).toContain('Offline');
  await press('Reload matching ideas');
  expect(JSON.stringify(tree.toJSON())).toContain('No matching ideas');
  expect(button('Keep current idea')).toBeDefined();expect(changeProjectIdea).not.toHaveBeenCalled();
});

test('double taps submit only one replacement request while saving',async()=>{
  let resolve!:(value:{project:UserProject})=>void;
  (changeProjectIdea as jest.Mock).mockImplementation(()=>new Promise(done=>{resolve=done;}));
  await Renderer.act(async()=>{tree=Renderer.create(<Harness/>);});await press('Change idea');
  await Renderer.act(()=>{const node=button('Choose task: Paper organizer')!;node.props.onPress();node.props.onPress();});
  expect(changeProjectIdea).toHaveBeenCalledTimes(1);
  expect(button('Keep current idea')!.props.disabled).toBe(true);
  await Renderer.act(async()=>resolve({project:next}));
});

test('Change idea navigates directly to the original fabric chooser with the blanket preview',async()=>{
  const fabric={...base,material:'Fabric scraps',source_prediction_id:247,title:'Fabric pouch'};
  (getProjectIdeas as jest.Mock).mockResolvedValue({source:{prediction_id:247,material:'Fabric scraps',object_name:'blanket',image_url:'/original-blanket.jpg'},ideas:[
    {id:'fabric_cloth',title:'Cleaning cloth',summary:'Reuse fabric.',steps:['Check the cloth.']},
  ]});
  await Renderer.act(async()=>{tree=Renderer.create(<Harness initial={fabric}/>);});
  await press('Change idea');
  expect(tree.root.findAllByType(ProjectGuide)).toHaveLength(0);
  expect(tree.root.findByType(UpcyclingIdeaChoices).props.material).toBe('Fabric scraps');
  expect(JSON.stringify(tree.toJSON())).toContain('blanket');
  expect(tree.root.findAllByProps({accessibilityLabel:'Original item for upcycling ideas'})[0].props.source.uri).toBe('/original-blanket.jpg');
  expect(button('Choose task: Cleaning cloth')).toBeDefined();
  expect(changeProjectIdea).not.toHaveBeenCalled();
});
