import React from 'react';
import Renderer from 'react-test-renderer';
import { TextInput } from 'react-native';
import AssessmentScreen from '../src/AssessmentScreen';
import { getAssessmentQuestions,updatePrediction,type Prediction } from '../src/api';
jest.mock('../src/api',()=>({imageUrl:(uri:string)=>uri,getAssessmentQuestions:jest.fn(),updatePrediction:jest.fn()}));

const paperCheck={has_sorting_rule:true,has_reviewed_projects:false,sorting_question_ids:['condition','contamination','moisture','previous_contents','paper_surface'],project_question_ids:[],sorting_complete:false};
const questions=[{id:'condition',label:'Condition',options:['Clean and dry'],required:true},{id:'contamination',label:'Residue',options:['None known'],required:true},{id:'moisture',label:'Moisture',options:['Dry'],required:true},{id:'previous_contents',label:'Chemical contact?',options:['No chemical contact known','Other / unknown'],required:true},{id:'paper_surface',label:'Plain paper?',options:['Plain uncoated material without personal details','Not sure'],required:true}];
const paper={id:2,label:'paper',title:'Paper',confidence:.8,answers:{},recommendation_choices:[],assessment:{material:{label:'paper',title:'Paper',status:'needs_confirmation'},context:{},questions,quick_check:paperCheck,segregation:{status:'needs_information',instructions:[],sources:[]},upcycling:{status:'awaiting_review'}}} as unknown as Prediction;
const press=async(tree:Renderer.ReactTestRenderer,label:string)=>{const target=tree.root.findAllByProps({accessibilityLabel:label}).find(node=>node.props.onPress);expect(target).toBeDefined();await Renderer.act(async()=>{await target?.props.onPress();});};
const render=async(prediction:Prediction,onBack=jest.fn())=>{let tree!:Renderer.ReactTestRenderer;await Renderer.act(()=>{tree=Renderer.create(<AssessmentScreen prediction={prediction} onBack={onBack} onRetry={jest.fn()} onSaved={jest.fn()} onChange={jest.fn()}/>);});return tree;};
beforeEach(()=>jest.clearAllMocks());

test('one explicit condition choice replaces three questions; sorting never requires quantity',async()=>{
  const tree=await render(paper);expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Clean, dry and no residue'})[0].props.accessibilityState.checked).toBe(false);
  await press(tree,'Yes, this is Paper');await press(tree,'Clean, dry and no residue');await press(tree,'previous_contents: No chemical contact known');await press(tree,'paper_surface: Plain uncoated material without personal details');
  (updatePrediction as jest.Mock).mockResolvedValue({prediction:{...paper,assessment:{...paper.assessment,segregation:{status:'available',category:'Potentially recyclable',instructions:['Keep clean paper separate.'],sources:[]}}}});
  const onBack=jest.fn();await Renderer.act(()=>tree.update(<AssessmentScreen prediction={paper} onBack={onBack} onRetry={jest.fn()} onSaved={jest.fn()} onChange={jest.fn()}/>));
  await press(tree,'Show sorting advice');
  expect(updatePrediction).toHaveBeenCalledWith(2,{condition:'Clean and dry',previous_contents:'No chemical contact known',answers:{material_confirmation:'paper',contamination:'None known',moisture:'Dry',paper_surface:'Plain uncoated material without personal details'}});
  const output=JSON.stringify(tree.toJSON());expect(output).toContain('What to do next');expect(output).toContain('Keep clean paper separate.');expect(output).not.toContain('Show sorting advice');expect(output).not.toContain('Check reuse options');
  await press(tree,'Done with this item');expect(onBack).toHaveBeenCalledTimes(1);await Renderer.act(()=>tree.unmount());
});

test('material-specific questions load before saving a newly selected material',async()=>{
  const unknown={...paper,label:'unknown_unsupported',assessment:{...paper.assessment,material:{label:'unknown_unsupported',status:'needs_confirmation'},questions:[],quick_check:{...paperCheck,has_sorting_rule:false}}} as unknown as Prediction;
  (getAssessmentQuestions as jest.Mock).mockResolvedValue({label:'paper',questions,quick_check:paperCheck});
  const tree=await render(unknown);await press(tree,'Paper');
  expect(getAssessmentQuestions).toHaveBeenCalledWith('paper');
  expect(tree.root.findAllByProps({accessibilityLabel:'paper_surface: Plain uncoated material without personal details'}).length).toBeGreaterThan(0);
  expect(updatePrediction).not.toHaveBeenCalled();await Renderer.act(()=>tree.unmount());
});

test('unknown answers produce a safe ending, not another mandatory form',async()=>{
  (updatePrediction as jest.Mock).mockResolvedValue({prediction:paper});
  const tree=await render(paper);await press(tree,'Show sorting advice');
  expect(JSON.stringify(tree.toJSON())).toContain('We could not confirm this item');
  expect(JSON.stringify(tree.toJSON())).toContain('Done');expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  await press(tree,'Change my answers');expect(JSON.stringify(tree.toJSON())).toContain('Check this item');await Renderer.act(()=>tree.unmount());
});

test('special-handling results bypass the routine form',async()=>{
  const tree=await render({...paper,waste_identifier:{category:'C'}} as Prediction);
  expect(JSON.stringify(tree.toJSON())).toContain('Keep this item separate');expect(JSON.stringify(tree.toJSON())).not.toContain('Show sorting advice');
  expect(updatePrediction).not.toHaveBeenCalled();await Renderer.act(()=>tree.unmount());
});

test('quantity is only requested after choosing an available optional reuse check',async()=>{
  const reusable={...paper,assessment:{...paper.assessment,material:{label:'paper',title:'Paper',status:'user_selected'},quick_check:{...paperCheck,has_reviewed_projects:true},segregation:{status:'available',category:'Potentially recyclable',instructions:[],sources:[]}}} as unknown as Prediction;
  const tree=await render(reusable);expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  await press(tree,'Check reuse options');
  const quantity=tree.root.findByType(TextInput);expect(quantity.props.value).toBe('');
  expect(tree.root.findAllByProps({accessibilityLabel:'Show suitable ideas'})[0].props.disabled).toBe(true);
  await Renderer.act(()=>quantity.props.onChangeText('2'));
  expect(tree.root.findAllByProps({accessibilityLabel:'Show suitable ideas'})[0].props.disabled).toBe(false);
  (updatePrediction as jest.Mock).mockResolvedValue({prediction:reusable});
  await press(tree,'Show suitable ideas');expect(updatePrediction).toHaveBeenCalledWith(2,{answers:{},quantity:'2'});
  expect(JSON.stringify(tree.toJSON())).toContain('What to do next');await Renderer.act(()=>tree.unmount());
});
