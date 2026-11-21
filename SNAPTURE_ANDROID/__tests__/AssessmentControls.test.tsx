import React from 'react';
import Renderer from 'react-test-renderer';
import AssessmentControls from '../src/AssessmentControls';
const evidence:any={primary:{status:'unavailable'},facts:{},observations:[],views:[],conflicts:[],limits:'',scan_details:{mode:'batch',quantity:25,approximate_size:'20 cm'},workflow:{},verdict:{code:'assessment_pending',title:'Assessment Pending',reason:'Condition checking unavailable.',next_action:'Do not start.',can_start:false,blocking_reasons:[]},capability:{condition_assessment:'unavailable'}};
const button=(tree:Renderer.ReactTestRenderer,label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(n=>n.props.onPress)!;
test('guided scans ask only for the clarification in the verdict',async()=>{
 const save=jest.fn().mockResolvedValue(undefined);
 const photo=jest.fn();
 const guided={...evidence,scan_details:{...evidence.scan_details,inspection_report:'concern_photo'},
  verdict:{...evidence.verdict,required_input:'moisture_and_closeup'}};
 let tree!:Renderer.ReactTestRenderer;
 await Renderer.act(()=>{tree=Renderer.create(<AssessmentControls assessment={guided} material="paper" busy={false} onSave={save} onPhoto={photo}/>);});
 expect(button(tree,'Check project eligibility')).toBeUndefined();
 expect(button(tree,'Chemical or cleaning product')).toBeUndefined();
 await Renderer.act(async()=>button(tree,'Water').props.onPress());
 expect(save).toHaveBeenCalledWith({moisture_cause:'Water'});
 await Renderer.act(()=>button(tree,'Photograph a suspicious area').props.onPress());
 expect(photo).toHaveBeenCalledWith('closeup');
 await Renderer.act(()=>tree.unmount());
});
test('acknowledgment does not confirm inspection or safe quantity',async()=>{
 const save=jest.fn().mockResolvedValue(undefined);let tree!:Renderer.ReactTestRenderer;
 await Renderer.act(()=>{tree=Renderer.create(<AssessmentControls assessment={evidence} busy={false} onSave={save} onPhoto={jest.fn()}/>);});
 expect(button(tree,'Check project eligibility').props.disabled).toBe(true);
 await Renderer.act(()=>button(tree,'Review material inspection guidance').props.onPress());
 await Renderer.act(async()=>button(tree,'OK, I understand').props.onPress());
 expect(save).toHaveBeenCalledWith({safety_acknowledged:true});
 expect(save).not.toHaveBeenCalledWith(expect.objectContaining({inspection_confirmed:true}));
 await Renderer.act(()=>tree.unmount());
});
test('inspection quantity cannot exceed original batch and changing it resets confirmation',async()=>{
 let tree!:Renderer.ReactTestRenderer;const save=jest.fn().mockResolvedValue(undefined);
 await Renderer.act(()=>{tree=Renderer.create(<AssessmentControls assessment={{...evidence,workflow:{safety_acknowledged:true}}} busy={false} onSave={save} onPhoto={jest.fn()}/>);});
 const input=tree.root.findAllByProps({accessibilityLabel:'Usable pieces after inspection'}).find(n=>n.props.onChangeText)!;
 await Renderer.act(()=>input.props.onChangeText('26'));
 await Renderer.act(()=>button(tree,'I checked all sides and found no signs of contamination on the pieces I marked usable').props.onPress());
 expect(button(tree,'Check project eligibility').props.disabled).toBe(true);
 await Renderer.act(()=>input.props.onChangeText('18'));
 expect(button(tree,'Check project eligibility').props.disabled).toBe(true);
 await Renderer.act(()=>button(tree,'I checked all sides and found no signs of contamination on the pieces I marked usable').props.onPress());
 await Renderer.act(async()=>button(tree,'Check project eligibility').props.onPress());
 expect(save).toHaveBeenCalledWith({inspection_confirmed:true,usable_quantity:18});
 await Renderer.act(()=>tree.unmount());
});

test('human-assisted condition confirmation is explicit and separate from inspection quantity',async()=>{
 let tree!:Renderer.ReactTestRenderer;const save=jest.fn().mockResolvedValue(undefined);
 await Renderer.act(()=>{tree=Renderer.create(<AssessmentControls assessment={{...evidence,scan_details:{...evidence.scan_details,assessment_mode:'human_assisted'}}} busy={false} onSave={save} onPhoto={jest.fn()}/>);});
 const text=JSON.stringify(tree.toJSON());
 expect(text).toContain('Human-assisted inspection');expect(text).not.toContain('Automatic condition assessment is unavailable.');
 await Renderer.act(async()=>button(tree,'I inspected the material and confirm my condition report').props.onPress());
 expect(save).toHaveBeenCalledWith({human_condition_confirmed:true});
 expect(save).not.toHaveBeenCalledWith(expect.objectContaining({inspection_confirmed:true}));
 expect(button(tree,'Check project eligibility').props.disabled).toBe(true);
 await Renderer.act(()=>tree.unmount());
});

test('reported metal uses the separate handling input and the eligibility action stays locked',async()=>{
 let tree!:Renderer.ReactTestRenderer;
 const save=jest.fn().mockResolvedValue(undefined);
 const modalProps={busy:false,onSave:save,onPhoto:jest.fn()};
 const inspected={...evidence,workflow:{safety_acknowledged:true,inspection_confirmed:true,usable_quantity:1}};
 await Renderer.act(()=>{tree=Renderer.create(<AssessmentControls assessment={inspected} {...modalProps}/>);});
 await Renderer.act(async()=>button(tree,'Report metal').props.onPress());
 expect(save).toHaveBeenLastCalledWith({material_scope_report:'metal'});
 await Renderer.act(()=>tree.update(<AssessmentControls {...modalProps} assessment={{...inspected,verdict:{...evidence.verdict,code:'for_disposal',title:'For Disposal / Special Handling'}}}/>));
 expect(button(tree,'Check project eligibility').props.disabled).toBe(true);
 await Renderer.act(()=>tree.unmount());
});
