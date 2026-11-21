import React,{useState} from 'react';
import Renderer from 'react-test-renderer';
import ProjectPanels from '../src/ProjectPanels';
import PhotoProjectGuide from '../src/PhotoProjectGuide';
import {getPhotoProject} from '../src/upcyclingApi';
import type {UserProject} from '../src/api';

jest.mock('../src/upcyclingApi',()=>({getPhotoProject:jest.fn(),listInventory:jest.fn().mockResolvedValue({lots:[]})}));
const initial={id:44,title:'Bottle planter',material:'PETE',materials:['Bottle'],steps:['Prepare bottle','Finish planter'],completed_steps:[0],completed_count:1,total_steps:2,progress_percent:50,status:'active',photo_workflow:true,step_photos:[],reference:{},updated_at:'2026-11-20T00:00:00Z'} as unknown as UserProject;
function Harness(){
  const [projects,setProjects]=useState([initial]);
  return <ProjectPanels section="projects" projects={projects} projectsLoading={false} projectsError="" saved={[]} savedLoading={false} savedError="" onClose={jest.fn()} onStart={jest.fn()} onStep={jest.fn()} onRestart={jest.fn()} onShowProjects={jest.fn()} onProjectChange={p=>setProjects([p])}/>;
}
test('My Projects resumes saved photo steps and leaving unfinished work keeps it in progress',async()=>{
  (getPhotoProject as jest.Mock).mockResolvedValue({project:initial});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<Harness/>);});
  const press=async(label:string)=>Renderer.act(async()=>{await tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.onPress)!.props.onPress();});
  await press('Open Bottle planter');
  expect(tree.root.findAllByType(PhotoProjectGuide)).toHaveLength(1);
  expect(getPhotoProject).toHaveBeenCalledWith(44);
  expect(JSON.stringify(tree.toJSON())).toContain('Finish planter');
  await press('Back to My Projects');
  expect(tree.root.findAllByType(PhotoProjectGuide)).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Open Bottle planter'}).length).toBeGreaterThan(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('No completed projects yet');
  await Renderer.act(()=>tree.unmount());
});
