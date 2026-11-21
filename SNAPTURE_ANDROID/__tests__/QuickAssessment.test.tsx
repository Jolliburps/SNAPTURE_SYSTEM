import React from 'react';
import Renderer from 'react-test-renderer';
import { TextInput } from 'react-native';
import AssessmentScreen from '../src/AssessmentScreen';
import {materialConditions} from '../src/materialConditions';
import {MATERIAL_NAMES} from '../src/detectionPresentation';
import { getAssessmentQuestions,updatePrediction,type Prediction } from '../src/api';
jest.mock('../src/api',()=>({imageUrl:(uri:string)=>uri,getAssessmentQuestions:jest.fn(),updatePrediction:jest.fn()}));

const eligible={status:'eligible',eligible:true,reasons:['Passed screening'],missing_information:[]} as import('../src/api').ScreeningResult;
const paperCheck={has_sorting_rule:true,has_reviewed_projects:false,sorting_question_ids:['condition','contamination','moisture','previous_contents','paper_surface'],project_question_ids:[],sorting_complete:false};
const questions=[{id:'condition',label:'Condition',options:['Clean and dry'],required:true},{id:'contamination',label:'Residue',options:['None known'],required:true},{id:'moisture',label:'Moisture',options:['Dry'],required:true},{id:'previous_contents',label:'Chemical contact?',options:['No chemical contact known','Other / unknown'],required:true},{id:'paper_surface',label:'Plain paper?',options:['Plain uncoated material without personal details','Not sure'],required:true}];
const paper={id:2,label:'paper',title:'Paper',confidence:.8,answers:{},recommendation_choices:[],assessment:{material:{label:'paper',title:'Paper',status:'needs_confirmation'},context:{},questions,quick_check:paperCheck,segregation:{status:'needs_information',instructions:[],sources:[]},upcycling:{status:'awaiting_review'}}} as unknown as Prediction;
const press=async(tree:Renderer.ReactTestRenderer,label:string)=>{const target=tree.root.findAllByProps({accessibilityLabel:label}).find(node=>node.props.onPress);expect(target).toBeDefined();await Renderer.act(async()=>{await target?.props.onPress();});};
const render=async(prediction:Prediction,onBack=jest.fn())=>{let tree!:Renderer.ReactTestRenderer;await Renderer.act(()=>{tree=Renderer.create(<AssessmentScreen prediction={prediction} onBack={onBack} onRetry={jest.fn()} onSaved={jest.fn()} onChange={jest.fn()} onProceed={jest.fn()}/>);});return tree;};
beforeEach(()=>jest.clearAllMocks());

test('Confirm saves screening and exposes Proceed without inline projects',async()=>{
  const checked={...paper,decision:'paper',condition:'Clean and dry',assessment:{...paper.assessment,material:{label:'paper',status:'user_selected'}}} as Prediction;
  const gift={id:'paper_gift_wrap',title:'Gift wrapping',summary:'Reuse a sheet.',materials:['Paper'],steps:['Flatten.']};
  (updatePrediction as jest.Mock).mockResolvedValue({prediction:{...checked,screening:eligible,upcycling_ideas:[gift]}});
  const tree=await render(paper);
  await press(tree,'Yes, this is Paper');await press(tree,'Clean and dry paper');
  await press(tree,'Confirm');
  expect(updatePrediction).toHaveBeenCalledWith(2,expect.objectContaining({condition:'Clean and dry'}));
  expect(tree.root.findAllByProps({accessibilityLabel:'Choose task: Gift wrapping'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Proceed to Upcycling Recommendation'}).length).toBeGreaterThan(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Hide extra details');
  await Renderer.act(()=>tree.unmount());
});

test.each(Object.entries(MATERIAL_NAMES))('uncertain %s confirms that category explicitly without defaulting to PETE',async(label,name)=>{
  const unknown={...paper,label:'unknown_unsupported',decision:'unknown_unsupported',
    recognition:{status:'needs_review',suggested_label:label,reason:'Below threshold'},
    assessment:{...paper.assessment,material:{label:'unknown_unsupported',status:'needs_confirmation'},questions:[]},
  } as unknown as Prediction;
  (getAssessmentQuestions as jest.Mock).mockResolvedValue({questions:[],quick_check:{...paperCheck,has_sorting_rule:false}});
  (updatePrediction as jest.Mock).mockResolvedValue({prediction:{...paper,label,decision:label,
    assessment:{...paper.assessment,material:{label,status:'user_selected'}}}});
  const tree=await render(unknown);
  expect(updatePrediction).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({accessibilityLabel:'Confirm'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityRole:'radio'})).toHaveLength(0);
  await press(tree,`Yes, this is ${name}`);
  expect(getAssessmentQuestions).toHaveBeenCalledWith(label);
  expect(tree.root.findAllByProps({accessibilityLabel:'Confirm'})).toHaveLength(0);
  await press(tree,materialConditions(label)!.choices[0].label);
  await press(tree,'Confirm');
  expect(updatePrediction).toHaveBeenCalledWith(2,{condition:'Clean and dry',previous_contents:'No chemical contact known',answers:{material_confirmation:label,contamination:'None known',moisture:'Dry'}});
  expect(unknown.decision).toBe('unknown_unsupported');
  await Renderer.act(()=>tree.unmount());
});

test('automatic route opens the material confirmation even when a condition was already selected',async()=>{
  const routed={...paper,condition:'Clean and dry',image_quality:{flags:[],limitations:'',automatic_routing:true}} as Prediction;
  const tree=await render(routed);
  expect(tree.root.findAllByProps({accessibilityLabel:'Yes, this is Paper'}).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Confirm'}).length).toBeGreaterThan(0);
  expect(updatePrediction).not.toHaveBeenCalled();
  await Renderer.act(()=>tree.unmount());
});

test('saving a framed fabric confirmation shows screening before its own recommendations',async()=>{
  const fabric={...paper,id:277,label:'fabric_scraps',title:'Fabric scraps',condition:'',
    image_quality:{flags:[],limitations:'',automatic_routing:true,object_source:'whole_image_classifier'},
    assessment:{...paper.assessment,material:{label:'fabric_scraps',title:'Fabric scraps',status:'needs_confirmation'},questions:questions.slice(0,3)},
  } as unknown as Prediction;
  const updated={...fabric,screening:eligible,condition:'Clean and dry',upcycling_ideas:[
    {id:'fabric_cleaning_cloth',title:'Cleaning cloth',summary:'Reuse suitable clean fabric.',steps:['Inspect fabric.','Prepare cloth.','Store dry.']},
    {id:'fabric_pouch',title:'Fabric pouch',summary:'Fold suitable fabric.',steps:['Select fabric.','Fold.','Secure.']},
  ],assessment:{...fabric.assessment,material:{label:'fabric_scraps',title:'Fabric scraps',status:'user_selected'}}} as Prediction;
  (updatePrediction as jest.Mock).mockResolvedValue({prediction:updated});
  const tree=await render(fabric);
  await press(tree,'Yes, this is Fabric Scraps');
  await press(tree,'Clean and dry fabric');
  await press(tree,'Confirm');
  expect(updatePrediction).toHaveBeenCalledWith(277,expect.objectContaining({condition:'Clean and dry',answers:expect.objectContaining({material_confirmation:'fabric_scraps'})}));
  expect(tree.root.findAllByProps({accessibilityLabel:'Choose task: Cleaning cloth'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Proceed to Upcycling Recommendation'}).length).toBeGreaterThan(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Choose task: Fabric pouch'})).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Gift wrapping');
  await Renderer.act(()=>tree.unmount());
});

test('one explicit condition choice replaces three questions; sorting never requires quantity',async()=>{
  const tree=await render(paper);expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Clean and dry paper'})[0].props.accessibilityState.checked).toBe(false);
  await press(tree,'Yes, this is Paper');await press(tree,'Clean and dry paper');expect(tree.root.findAllByProps({accessibilityLabel:'previous_contents: No chemical contact known'}).length).toBeGreaterThan(0);
  (updatePrediction as jest.Mock).mockResolvedValue({prediction:{...paper,assessment:{...paper.assessment,segregation:{status:'available',category:'Potentially recyclable',instructions:['Keep clean paper separate.'],sources:[]}}}});
  const onBack=jest.fn();await Renderer.act(()=>tree.update(<AssessmentScreen prediction={paper} onBack={onBack} onRetry={jest.fn()} onSaved={jest.fn()} onChange={jest.fn()}/>));
  await press(tree,'Confirm');
  expect(updatePrediction).toHaveBeenCalledWith(2,{condition:'Clean and dry',previous_contents:'No chemical contact known',answers:{material_confirmation:'paper',contamination:'None known',moisture:'Dry'}});
  const output=JSON.stringify(tree.toJSON());expect(output).toContain('What to do next');expect(output).toContain('Keep clean paper separate.');expect(output).not.toContain('Confirm');expect(output).not.toContain('Check reuse options');
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
  const tree=await render(paper);await press(tree,'Confirm');
  expect(JSON.stringify(tree.toJSON())).toContain('We could not confirm this item');
  expect(JSON.stringify(tree.toJSON())).toContain('Done');expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  await press(tree,'Change my answers');expect(JSON.stringify(tree.toJSON())).toContain('Check this item');await Renderer.act(()=>tree.unmount());
});

test('special-handling results bypass the routine form',async()=>{
  const tree=await render({...paper,waste_identifier:{category:'C'}} as Prediction);
  expect(JSON.stringify(tree.toJSON())).toContain('Keep this item separate');expect(JSON.stringify(tree.toJSON())).not.toContain('Confirm');
  expect(updatePrediction).not.toHaveBeenCalled();await Renderer.act(()=>tree.unmount());
});

test('screening never asks for project quantity or exposes legacy reuse options',async()=>{
  const reusable={...paper,screening:eligible,assessment:{...paper.assessment,material:{label:'paper',status:'user_selected'},quick_check:{...paperCheck,has_reviewed_projects:true},segregation:{status:'available',instructions:[]}}} as unknown as Prediction;
  const tree=await render(reusable);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Check reuse options'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Proceed to Upcycling Recommendation'}).length).toBeGreaterThan(0);
  expect(updatePrediction).not.toHaveBeenCalled();await Renderer.act(()=>tree.unmount());
});

test.each(Object.keys(require('../src/detectionPresentation').MATERIAL_NAMES))(
  'all supported categories use one condition question and retain the explicit chemical-contact question: %s',
  async label=>{
    const prediction={...paper,label,assessment:{...paper.assessment,
      material:{label,title:label,status:'needs_confirmation'},
      questions,quick_check:paperCheck}} as unknown as Prediction;
    const tree=await render(prediction);
    expect(tree.root.findAllByProps({accessibilityLabel:'previous_contents: No chemical contact known'}).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({accessibilityLabel:materialConditions(label)!.choices[0].label}).length).toBeGreaterThan(0);
    await press(tree,'Known contact with a chemical or cleaning product');
    (updatePrediction as jest.Mock).mockResolvedValue({prediction});
    await press(tree,'Confirm');
    expect(updatePrediction).toHaveBeenCalledWith(prediction.id,expect.objectContaining({
      previous_contents:'Chemical or cleaning product',
      answers:expect.objectContaining({contamination:'Chemical contamination'}),
    }));
    await Renderer.act(()=>tree.unmount());
  },
);


test.each([false,true])('wet paper preparation saves the same scan, handles failure=%s and allows Proceed only after success',async fail=>{
  const wet={...paper,id:622,condition:'Needs cleaning',answers:{contamination:'None known',moisture:'Wet'},assessment:{...paper.assessment,material:{label:'paper',title:'Paper',status:'user_selected'}}} as unknown as Prediction;
  const prepared={...wet,screening:eligible,condition:'Clean and dry',answers:{contamination:'None known',moisture:'Dry'},upcycling_ideas:[{id:'paper_gift',title:'Gift wrapping',summary:'Reuse dry paper.',materials:['Paper'],steps:['Inspect.','Fold.']}]} as Prediction;
  if(fail)(updatePrediction as jest.Mock).mockRejectedValue(new Error('Connection interrupted'));
  else (updatePrediction as jest.Mock).mockResolvedValue({prediction:prepared});
  const tree=await render(wet);
  const button=()=>tree.root.findAllByProps({accessibilityLabel:'Confirm preparation readiness'}).find(node=>typeof node.props.onPress==='function')!;
  expect(JSON.stringify(tree.toJSON())).not.toContain('Choose task: Gift wrapping');
  expect(button()).toBeUndefined();
  await press(tree,'Preparation finished');
  expect(button().props.disabled).toBe(false);
  expect(updatePrediction).not.toHaveBeenCalled();
  await Renderer.act(async()=>{await button().props.onPress();});
  expect(updatePrediction).toHaveBeenCalledWith(622,{condition:'Clean and dry',answers:{contamination:'None known',moisture:'Dry'}});
  const output=JSON.stringify(tree.toJSON());
  if(fail){expect(output).toContain('Connection interrupted');expect(button().props.disabled).toBe(false);}
  else{expect(output).not.toContain('Choose task: Gift wrapping');expect(output).toContain('Proceed to Upcycling Recommendation');expect(output).not.toContain('PETE Bottles');expect(tree.root.findAllByProps({accessibilityLabel:'Preparation finished \u2014 check upcycling ideas'})).toHaveLength(0);}
  await Renderer.act(()=>tree.unmount());
});
