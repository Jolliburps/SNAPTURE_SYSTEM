import React from 'react';
import Renderer from 'react-test-renderer';
import FinalProductPanel from '../src/FinalProductPanel';
import PhotoProjectGuide from '../src/PhotoProjectGuide';
import * as api from '../src/upcyclingApi';
import {launchCamera} from 'react-native-image-picker';
import {Alert} from 'react-native';
jest.mock('../src/upcyclingApi',()=>({getPhotoProject:jest.fn(),listInventory:jest.fn(),upcyclingRequest:jest.fn()}));
jest.mock('react-native-image-picker',()=>({launchCamera:jest.fn()}));
const project:any={id:4,title:'Cardboard craft',material:'Cardboard',steps:['Prepare','Assemble'],completed_steps:[0,1],completed_count:2,total_steps:2,progress_percent:100,status:'active',photo_workflow:true,reference:{},verification_capabilities:{step_available:true,final_available:true,reason:''},step_photos:[],final_assessments:[]};
const button=(tree:Renderer.ReactTestRenderer,label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.onPress)!;
beforeEach(()=>{jest.clearAllMocks();(api.getPhotoProject as jest.Mock).mockResolvedValue({project});(api.listInventory as jest.Mock).mockResolvedValue({lots:[]});});
test('all verified steps alone do not unlock completion; final photo is submitted separately',async()=>{
 let tree!:Renderer.ReactTestRenderer;(launchCamera as jest.Mock).mockResolvedValue({assets:[{uri:'file:///whole.jpg'}]});(api.upcyclingRequest as jest.Mock).mockResolvedValue({project});
 await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={project} onDone={jest.fn()}/>);});
 expect(button(tree,'Save finished project to My Projects').props.disabled).toBe(true);
 await Renderer.act(async()=>button(tree,'Photograph the whole finished product').props.onPress());
 expect(api.upcyclingRequest).toHaveBeenCalledWith('projects/4/final/','POST',undefined,{uri:'file:///whole.jpg'});
 expect(button(tree,'Save finished project to My Projects').props.disabled).toBe(true);
 await Renderer.act(()=>tree.unmount());
});
test('failed final assessment displays criteria and stays In Progress',async()=>{
 let tree!:Renderer.ReactTestRenderer;
 const p={...project,final_assessments:[{id:1,image_url:'/final/1',verdict:'needs_improvement',title:'Needs Improvement',feedback:'Divider missing',criteria:[{id:'final_0',status:'unmet',evidence:'Required divider is absent.'}],validated:true,status:'available'}]};
 await Renderer.act(()=>{tree=Renderer.create(<FinalProductPanel project={p} busy={false} onRequest={fn=>{fn();}} onChange={jest.fn()}/>);});
 const text=JSON.stringify(tree.toJSON());expect(text).toContain('Required divider is absent.');expect(text).toContain('This project stays In Progress.');expect(text).not.toContain('accuracy');
 await Renderer.act(()=>tree.unmount());
});
test('only approved final result unlocks save; unavailable checker does not',async()=>{
 let tree!:Renderer.ReactTestRenderer;const pending={...project,final_assessments:[{id:1,verdict:'unable_to_assess',title:'Unable to Assess',criteria:[],feedback:'Unavailable',validated:false,status:'unavailable'}]};
 (api.getPhotoProject as jest.Mock).mockResolvedValue({project:pending});
 await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={pending} onDone={jest.fn()}/>);});
 expect(button(tree,'Save finished project to My Projects').props.disabled).toBe(true);
 await Renderer.act(()=>tree.unmount());
 const passed={...pending,final_assessments:[{...pending.final_assessments[0],verdict:'meets_requirements',validated:true,status:'available'}]};
 (api.getPhotoProject as jest.Mock).mockResolvedValue({project:passed});
 await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={passed} onDone={jest.fn()}/>);});
 expect(button(tree,'Save finished project to My Projects').props.disabled).toBe(false);
 await Renderer.act(()=>tree.unmount());
});

test('human-assisted final submission needs confirmation and is not labeled AI-verified',async()=>{
 const assisted={...project,verification_capabilities:{human_assisted:true,step_available:false,final_available:false,reason:''}};
 (launchCamera as jest.Mock).mockResolvedValue({assets:[{uri:'file:///manual-whole.jpg'}]});
 const confirmed={...assisted,final_assessments:[{id:3,image_url:'/whole/3',verdict:'user_confirmed',title:'Photo documented - user confirmed',feedback:'User-confirmed completion',criteria:[],validated:false,status:'documented'}]};
 (api.upcyclingRequest as jest.Mock).mockResolvedValue({project:confirmed});
 let tree!:Renderer.ReactTestRenderer;let confirm:(()=>void)|undefined;const changed=jest.fn();
 const alert=jest.spyOn(Alert,'alert').mockImplementation((_title,_text,buttons)=>{const chosen=buttons?.find(b=>b.text==='I confirm - take photo');confirm=chosen?()=>{chosen.onPress?.();}:undefined;});
 await Renderer.act(()=>{tree=Renderer.create(<FinalProductPanel project={assisted} busy={false} onRequest={fn=>{fn();}} onChange={changed}/>);});
 await Renderer.act(()=>button(tree,'Photograph the whole finished product').props.onPress());
 expect(launchCamera).not.toHaveBeenCalled();expect(confirm).toBeDefined();
 await Renderer.act(async()=>{confirm?.();});
 expect(api.upcyclingRequest).toHaveBeenCalledWith('projects/4/final/','POST',undefined,{uri:'file:///manual-whole.jpg',fields:{final_confirmed:'true'}});
 expect(changed).toHaveBeenCalledWith(confirmed);
 await Renderer.act(()=>tree.update(<FinalProductPanel project={confirmed} busy={false} onRequest={fn=>{fn();}} onChange={changed}/>));
 const text=JSON.stringify(tree.toJSON());expect(text).toContain('User-confirmed documentation; not AI-verified.');expect(text).not.toContain('after all steps are verified.');expect(text).not.toContain('This project stays In Progress.');
 alert.mockRestore();await Renderer.act(()=>tree.unmount());
});

test('user-confirmed verdict unlocks completion only for an explicit human-assisted project',async()=>{
 const confirmed={...project,final_assessments:[{id:3,verdict:'user_confirmed',title:'Photo documented',criteria:[],feedback:'Confirmed',validated:false,status:'documented'}]};
 let tree!:Renderer.ReactTestRenderer;(api.getPhotoProject as jest.Mock).mockResolvedValue({project:confirmed});
 await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={confirmed} onDone={jest.fn()}/>);});
 expect(button(tree,'Save finished project to My Projects').props.disabled).toBe(true);await Renderer.act(()=>tree.unmount());
 const assisted={...confirmed,verification_capabilities:{human_assisted:true,step_available:false,final_available:false,reason:''}};(api.getPhotoProject as jest.Mock).mockResolvedValue({project:assisted});
 await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={assisted} onDone={jest.fn()}/>);});
 expect(button(tree,'Save finished project to My Projects').props.disabled).toBe(false);await Renderer.act(()=>tree.unmount());
});
