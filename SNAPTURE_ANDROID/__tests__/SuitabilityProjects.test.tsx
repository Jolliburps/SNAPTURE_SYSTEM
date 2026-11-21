import React from 'react';
import Renderer from 'react-test-renderer';
import {Alert} from 'react-native';
import SuitabilityProjects from '../src/SuitabilityProjects';
import * as api from '../src/upcyclingApi';
import type {Prediction} from '../src/api';

jest.mock('react-native-safe-area-context',()=>({SafeAreaProvider:require('react-native').View,SafeAreaView:require('react-native').View}));
jest.mock('../src/upcyclingApi',()=>({getSuggestions:jest.fn(),getVisual:jest.fn(),saveFacts:jest.fn(),startSuitable:jest.fn(),upcyclingRequest:jest.fn()}));
jest.mock('../src/UpcyclingUI',()=>{const {Text,Pressable}=require('react-native');return {...jest.requireActual('../src/UpcyclingUI'),Action:({title,onPress,disabled}:any)=><Pressable accessibilityLabel={title} onPress={onPress} disabled={disabled}><Text>{title}</Text></Pressable>,Field:()=>null,PrivatePhoto:()=>null};});
test('preliminary suggestions appear without a mandatory assessment and cannot start as confirmed matches',async()=>{
  (api.getSuggestions as jest.Mock).mockResolvedValue({items:[{id:'test',title:'Paper craft',summary:'Use paper',status:'needs_information',preliminary:true,can_start:false,missing_information:['width in mm'],reasons:['Confirm dimensions.'],materials:['Paper'],requirements:{},additional_quantity:null}],outcome:'needs_information',message:'Confirm missing details.',facts:{}});
  (api.getVisual as jest.Mock).mockResolvedValue({assessment:{primary:{status:'unavailable'},observations:[],conflicts:[],views:[],facts:{}}});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SuitabilityProjects prediction={{id:1,decision:'paper'} as Prediction}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Paper craft');
  expect(api.getSuggestions).toHaveBeenCalledWith(1,'',false);
  expect(api.saveFacts).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({accessibilityLabel:'Grow plants'})).toHaveLength(0);
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Choose a goal'}).find(n=>n.props.onPress)!.props.onPress());
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Grow plants'}).find(n=>n.props.onPress)!.props.onPress());
  expect(api.getSuggestions).not.toHaveBeenCalledWith(1,'Grow plants',false);
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Apply goal'}).find(n=>n.props.onPress)!.props.onPress());
  expect(api.getSuggestions).toHaveBeenCalledWith(1,'Grow plants',false);
  const requestCount=(api.getSuggestions as jest.Mock).mock.calls.length;
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Choose a goal'}).find(n=>n.props.onPress)!.props.onPress());
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Decorate my home'}).find(n=>n.props.onPress)!.props.onPress());
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Cancel goal selection'}).find(n=>n.props.onPress)!.props.onPress());
  expect((api.getSuggestions as jest.Mock).mock.calls).toHaveLength(requestCount);
  expect(JSON.stringify(tree.toJSON())).toContain('Goal: Grow plants');
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'View requirements: Paper craft'}).find(n=>n.props.onPress)!.props.onPress());
  expect(tree.root.findAllByProps({accessibilityLabel:'Start Paper craft'}).find(n=>n.props.onPress)!.props.disabled).toBe(true);
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Photos & item details'}).find(n=>n.props.onPress)!.props.onPress());
  expect(tree.root.findAllByProps({testID:'project-flow-page'}).length).toBeGreaterThan(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Supported materials');
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Back to project suggestions'}).find(n=>n.props.onPress)!.props.onPress());
  expect(tree.root.findAllByProps({testID:'project-flow-page'})).toHaveLength(0);
  await Renderer.act(async()=>tree.unmount());
});

test.each([true,false])('primary view is labeled and top warnings stay with the top photo (structured=%s)',async structured=>{
  const warning='Top view has a different or uncertain material suggestion.';
  (api.getSuggestions as jest.Mock).mockResolvedValue({items:[],facts:{},message:'No project'});
  (api.getVisual as jest.Mock).mockResolvedValue({assessment:{primary_view:'front',primary:{status:'unavailable'},observations:[],conflicts:[warning,'Conflicting shape observations.'],views:[{id:2,view:'back',image_url:'/back/',...(structured?{warnings:[]}: {})},{id:3,view:'top',image_url:'/top/',...(structured?{warnings:[warning]}:{})}],facts:{}}});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SuitabilityProjects prediction={{id:1,decision:'paper',image_url:'/front.jpg'} as Prediction}/>);});
  await Renderer.act(async()=>tree.root.findAllByProps({accessibilityLabel:'Photos & item details'}).find(n=>n.props.onPress)!.props.onPress());
  const group=(id:string)=>tree.root.findByProps({testID:id});
  const words=(id:string)=>group(id).findAll(n=>typeof n.props.children==='string').map(n=>n.props.children).join(' ');
  expect(words('primary-photo-group')).toContain('Front view');
  expect(words('primary-photo-group')).not.toContain(warning);
  expect(words('view-photo-group-2')).not.toContain(warning);
  expect(words('view-photo-group-3')).toContain(warning);
  expect(JSON.stringify(tree.toJSON()).split(warning)).toHaveLength(2);
  expect(JSON.stringify(tree.toJSON())).toContain('Across-view observations');
  await Renderer.act(async()=>tree.unmount());
});

test.each(['Clean and dry','Needs cleaning','Damaged or cracked','Moldy or contaminated','Not sure'])('saving %s shows updated feedback and does not invent project readiness',async condition=>{
  const item={id:'desk',title:'Desk organizer',summary:'A possible craft',status:'needs_information',can_start:false,missing_information:['published project-specific suitability requirements','clean and dry usable material'],reasons:[],materials:[],requirements:{},additional_quantity:null};
  const initial={items:[item],facts:{condition:'Needs cleaning',quantity:1},outcome:'needs_information'};
  const feedback={code:'condition',title:'Reported condition',message:`You reported ${condition}. This is not AI verification.`};
  const updated={...initial,items:condition==='Moldy or contaminated'?[]:[item],assessment_feedback:[feedback],outcome:condition==='Moldy or contaminated'?'no_suitable_project':'needs_information',message:'No cleared project.'};
  (api.getSuggestions as jest.Mock).mockResolvedValueOnce(initial).mockResolvedValue(updated);
  (api.getVisual as jest.Mock).mockResolvedValue({assessment:{primary:{status:'unavailable'},observations:[],conflicts:[],views:[],facts:{}}});
  (api.saveFacts as jest.Mock).mockResolvedValue({});
  const alert=jest.spyOn(Alert,'alert').mockImplementation(()=>undefined);
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<SuitabilityProjects prediction={{id:1,decision:'paper'} as Prediction}/>);});
  const press=async(label:string)=>Renderer.act(async()=>{await tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.onPress)!.props.onPress();});
  await press('View requirements: Desk organizer');
  // The unresolved clean/dry requirement must keep condition choices visible without Edit.
  await press(condition);
  await press('Save relevant details');
  expect(api.saveFacts).toHaveBeenLastCalledWith(1,{condition});
  expect(alert).toHaveBeenLastCalledWith('Item assessment updated',expect.stringContaining(feedback.message));
  const message=String(alert.mock.calls[alert.mock.calls.length-1][1]);
  expect(message).not.toContain('now meets its listed checks');
  if(condition==='Moldy or contaminated'){
    expect(message).toContain('No current project is cleared');
    await press('Photos & item details');
    expect(JSON.stringify(tree.toJSON())).toContain('Review your answers');
    expect(tree.root.findAllByProps({accessibilityLabel:'Save relevant details'}).some(n=>n.props.onPress)).toBe(true);
  }else expect(message).toContain('still under review');
  alert.mockRestore();await Renderer.act(async()=>tree.unmount());
});
