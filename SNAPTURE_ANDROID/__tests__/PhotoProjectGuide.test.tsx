import React from 'react';
import Renderer from 'react-test-renderer';
import {Alert} from 'react-native';
import {launchCamera} from 'react-native-image-picker';
import PhotoProjectGuide from '../src/PhotoProjectGuide';
import * as api from '../src/upcyclingApi';
import type {UserProject} from '../src/api';

jest.mock('react-native-image-picker',()=>({launchCamera:jest.fn()}));
jest.mock('../src/upcyclingApi',()=>({getPhotoProject:jest.fn(),listInventory:jest.fn(),upcyclingRequest:jest.fn()}));
jest.mock('../src/UpcyclingUI',()=>{const React=require('react');const {Text,Pressable,View,TextInput}=require('react-native');return {...jest.requireActual('../src/UpcyclingUI'),Action:({title,onPress,disabled}:any)=><Pressable accessibilityLabel={title} onPress={onPress} disabled={disabled}><Text>{title}</Text></Pressable>,Field:({label,value,onChange}:any)=><TextInput accessibilityLabel={label} value={value} onChangeText={onChange}/>,PrivatePhoto:({label,path}:any)=><View accessibilityLabel={label}><Text>{path}</Text></View>};});
const initial={id:1,title:'Test craft',material:'Paper',materials:['Paper'],steps:['Prepare the paper','Make the finished craft'],completed_steps:[],completed_count:0,total_steps:2,progress_percent:0,status:'active',photo_workflow:true,step_photos:[],reference:{}} as unknown as UserProject;
beforeEach(()=>{jest.clearAllMocks();(api.getPhotoProject as jest.Mock).mockResolvedValue({project:initial});(api.listInventory as jest.Mock).mockResolvedValue({lots:[]});(launchCamera as jest.Mock).mockResolvedValue({assets:[{uri:'file:///step.jpg'}]});});

test('guide and live scanner show the reference photo for the current step only',async()=>{
  const first={url:'/api/tutorial-assets/first.jpg',step_index:0,source_stage:1,photo_status:'Reference'};
  const second={...first,url:'/api/tutorial-assets/second.jpg',step_index:1,source_stage:2};
  const project={...initial,reference:{photos:{version:'test',source_id:'fixture',source_url:'https://example.com',
    credit:'Fixture',photo_rights:'Fixture',finished:{...first,source_stage:'finished' as const},steps:[first,second]}},
    verification_capabilities:{human_assisted:false,step_available:true,final_available:false,reason:''}};
  (api.getPhotoProject as jest.Mock).mockResolvedValue({project});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={project} onDone={jest.fn()}/>);});
  const photo=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.source);
  const press=async(label:string)=>Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.onPress)!.props.onPress());
  expect(photo('Step 1 reference photo')?.props.source.uri).toContain('/first.jpg');
  expect(photo('Step 2 reference photo')).toBeUndefined();
  await press('Scan current step');
  expect(photo('Current step reference photo')?.props.source.uri).toContain('/first.jpg');
  await press('View step reference');
  expect(photo('Enlarged step reference photo 1')?.props.source.uri).toContain('/first.jpg');
  await Renderer.act(()=>tree.unmount());
});

test('next is locked until a step photo is saved and the final photo becomes My Projects output',async()=>{
  let tree!:Renderer.ReactTestRenderer;const changed=jest.fn();
  await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={initial} onDone={jest.fn()} onChange={changed}/>);});
  const button=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>typeof n.props.onPress==='function')!;
  const press=async(label:string)=>{await Renderer.act(async()=>{await button(label).props.onPress();});};
  expect(button('Next step').props.disabled).toBe(true);
  const first={...initial,completed_steps:[0],completed_count:1,progress_percent:50,step_photos:[{id:1,step_index:0,image_url:'/photo/1',status:'ai_matches',assessment:{status:'available',feedback:'Required step matches.'}}]};
  (api.upcyclingRequest as jest.Mock).mockResolvedValue({project:first});
  await press('Take step photo');
  expect(api.upcyclingRequest).toHaveBeenCalledWith('projects/1/steps/0/','POST',undefined,{uri:'file:///step.jpg'});
  expect(JSON.stringify(tree.toJSON())).toContain('Make the finished craft');
  expect(button('Next step').props.disabled).toBe(true);
  const finished={...first,completed_steps:[0,1],completed_count:2,progress_percent:100};
  (api.upcyclingRequest as jest.Mock).mockResolvedValue({project:finished});
  await press('Take step photo');
  await Renderer.act(async()=>{tree.root.findAllByProps({accessibilityLabel:'Quantity for material 1'}).find(n=>n.props.onChangeText)!.props.onChangeText('2');});
  await press('Add another material');
  await Renderer.act(async()=>{
    tree.root.findAllByProps({accessibilityLabel:'Material 2'}).find(n=>n.props.onChangeText)!.props.onChangeText('Glue');
    tree.root.findAllByProps({accessibilityLabel:'Quantity for material 2'}).find(n=>n.props.onChangeText)!.props.onChangeText('1');
  });
  const completion={id:7,project_id:1,name:'Test craft',image_url:'/final/photo/',verification_status:'ai_checked',completed_at:'2026-11-20T01:00:00+08:00',description:'',materials:[{name:'Paper',quantity:1}],usage:[]};
  (api.upcyclingRequest as jest.Mock).mockResolvedValue({project:{...finished,completion_record:completion}});
  const alert=jest.spyOn(Alert,'alert').mockImplementation((_title,_text,buttons)=>{buttons?.find(b=>b.text==='Save project')?.onPress?.();});
  await press('Save finished project to My Projects');
  expect(api.upcyclingRequest).toHaveBeenLastCalledWith('completions/','POST',expect.objectContaining({materials:[{name:'Paper',quantity:2},{name:'Glue',quantity:1}]}));
  expect(JSON.stringify(tree.toJSON())).toContain('Saved in My Projects');
  expect(tree.root.findAllByProps({accessibilityLabel:'Finished project'}).length).toBeGreaterThan(0);
  expect(changed).toHaveBeenCalled();alert.mockRestore();await Renderer.act(async()=>tree.unmount());
});

test('AI rejection keeps the next step locked and preserves correction feedback',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={initial} onDone={jest.fn()}/>);});
  (api.upcyclingRequest as jest.Mock).mockResolvedValue({project:{...initial,step_photos:[{id:1,step_index:0,image_url:'/photo/',status:'needs_correction',assessment:{feedback:'The required cut is not visible.'}}]}});
  await Renderer.act(async()=>{await tree.root.findAllByProps({accessibilityLabel:'Take step photo'}).find(n=>n.props.onPress)!.props.onPress();});
  expect(JSON.stringify(tree.toJSON())).toContain('The required cut is not visible.');
  expect(tree.root.findAllByProps({accessibilityLabel:'Next step'}).find(n=>n.props.onPress)!.props.disabled).toBe(true);
  await Renderer.act(async()=>tree.unmount());
});


test('unavailable AI checking keeps progress locked and rechecks the saved photo without recapturing',async()=>{
  const documentary={...initial,step_photos:[{id:9,step_index:0,image_url:'/saved-photo/',status:'retake',assessment:{status:'unavailable',message:'Checker unavailable.'}}]};
  (api.getPhotoProject as jest.Mock).mockResolvedValue({project:documentary});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={{...initial,completed_steps:[0],completed_count:1,progress_percent:50}} onDone={jest.fn()}/>);});
  const button=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>typeof n.props.onPress==='function')!;
  expect(button('Next step').props.disabled).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Prepare the paper');
  (api.upcyclingRequest as jest.Mock).mockResolvedValue({project:documentary});
  await Renderer.act(async()=>{await button('Recheck step photo').props.onPress();});
  expect(button('Next step').props.disabled).toBe(true);
  expect(launchCamera).not.toHaveBeenCalled();
  const checked={...documentary,completed_steps:[0],completed_count:1,progress_percent:50};
  (api.upcyclingRequest as jest.Mock).mockResolvedValue({project:checked});
  await Renderer.act(async()=>{await button('Recheck step photo').props.onPress();});
  expect(api.upcyclingRequest).toHaveBeenLastCalledWith('projects/1/steps/0/','POST',{recheck_photo_id:9});
  expect(JSON.stringify(tree.toJSON())).toContain('Make the finished craft');
  await Renderer.act(async()=>tree.unmount());
});

test('an unavailable step checker offers photo confirmation with explicit consent',async()=>{
  const blocked={...initial,verification_capabilities:{step_available:false,final_available:false,reason:'Unavailable',manual_confirmation_available:true}};
  const assisted={...initial,verification_capabilities:{step_available:false,final_available:false,reason:'',human_assisted:true}};
  (api.getPhotoProject as jest.Mock).mockResolvedValue({project:blocked});
  (api.upcyclingRequest as jest.Mock).mockResolvedValue({project:assisted});
  const alert=jest.spyOn(Alert,'alert').mockImplementation((_title,_message,buttons)=>{buttons?.find(b=>b.text==='Continue')?.onPress?.();});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={blocked} onDone={jest.fn()}/>);});
  const button=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.onPress);
  expect(button('Scan current step')).toBeUndefined();
  await Renderer.act(async()=>button('Continue with photo confirmation')!.props.onPress());
  expect(api.upcyclingRequest).toHaveBeenCalledWith('projects/1/manual-confirmation/','POST',{acknowledged:true});
  expect(button('Confirm and photograph this step')).toBeDefined();
  expect(launchCamera).not.toHaveBeenCalled();
  alert.mockRestore();
  await Renderer.act(()=>tree.unmount());
});

test('human-assisted steps require confirmation before photographing and remain labeled user-confirmed',async()=>{
 const assisted={...initial,verification_capabilities:{human_assisted:true,step_available:false,final_available:false,reason:''}};
 (api.getPhotoProject as jest.Mock).mockResolvedValue({project:assisted});
 const first={...assisted,completed_steps:[0],completed_count:1,progress_percent:50,step_photos:[{id:10,step_index:0,image_url:'/step/10',status:'submitted',assessment:{status:'documented',validated:false,verdict:'user_confirmed',feedback:'Your confirmation was saved.'}}]};
 (api.upcyclingRequest as jest.Mock).mockResolvedValue({project:first});
 let tree!:Renderer.ReactTestRenderer;let confirm:(()=>void)|undefined;
 const alert=jest.spyOn(Alert,'alert').mockImplementation((_title,_text,buttons)=>{const chosen=buttons?.find(b=>b.text==='I completed it - take photo');confirm=chosen?()=>{chosen.onPress?.();}:undefined;});
 await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={assisted} onDone={jest.fn()}/>);});
 const button=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.onPress)!;
 expect(tree.root.findAllByProps({accessibilityLabel:'Scan current step'})).toHaveLength(0);
 await Renderer.act(()=>button('Confirm and photograph this step').props.onPress());
 expect(launchCamera).not.toHaveBeenCalled();expect(api.upcyclingRequest).not.toHaveBeenCalled();expect(confirm).toBeDefined();
 await Renderer.act(async()=>{confirm?.();});
 expect(api.upcyclingRequest).toHaveBeenCalledWith('projects/1/steps/0/','POST',undefined,{uri:'file:///step.jpg',fields:{step_confirmed:'true'}});
 expect(JSON.stringify(tree.toJSON())).toContain('steps complete');
 await Renderer.act(()=>button('About photo checks').props.onPress());
 const text=JSON.stringify(tree.toJSON());expect(text).toContain('have not passed AI verification');expect(text).not.toContain('Progress counts verified steps.');
 alert.mockRestore();await Renderer.act(()=>tree.unmount());
});

test('human-assisted saved evidence is confirmed without sending an AI recheck',async()=>{
 const assisted={...initial,verification_capabilities:{human_assisted:true,step_available:false,final_available:false,reason:''},step_photos:[{id:11,step_index:0,image_url:'/step/11',status:'submitted',assessment:{status:'documented',verdict:'awaiting_user_confirmation',feedback:'Confirm your work.'}}]};
 (api.getPhotoProject as jest.Mock).mockResolvedValue({project:assisted});(api.upcyclingRequest as jest.Mock).mockResolvedValue({project:assisted});
 const alert=jest.spyOn(Alert,'alert').mockImplementation((_title,_text,buttons)=>{buttons?.find(b=>b.text==='I confirm this step')?.onPress?.();});
 let tree!:Renderer.ReactTestRenderer;
 await Renderer.act(async()=>{tree=Renderer.create(<PhotoProjectGuide initial={assisted} onDone={jest.fn()}/>);});
 expect(tree.root.findAllByProps({accessibilityLabel:'Recheck step photo'})).toHaveLength(0);
 await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Confirm saved step photo'}).find(n=>n.props.onPress)!.props.onPress());
 expect(api.upcyclingRequest).toHaveBeenCalledWith('projects/1/steps/0/','POST',{confirm_photo_id:11});expect(launchCamera).not.toHaveBeenCalled();
 alert.mockRestore();await Renderer.act(()=>tree.unmount());
});
