import React from 'react';
import Renderer from 'react-test-renderer';
import AssessmentScreen from '../src/AssessmentScreen';
import UpcyclingIdeaChoices from '../src/UpcyclingIdeaChoices';
import TutorialPhoto, {PhotoCredits} from '../src/TutorialPhoto';
import {updatePrediction, type Prediction, type Recommendation} from '../src/api';

jest.mock('../src/api',()=>({...jest.requireActual('../src/api'),updatePrediction:jest.fn()}));
const idea:Recommendation={id:'hdpe_scoop',title:'Garden scoop',summary:'Keep the local description.',
  materials:['Clean container','Sandpaper'],steps:['Keep the local first step.','Smooth the edge.'],
  photos:{version:'local-v1',source_id:'HDPE-004',source_url:'https://example.test/reference',credit:'Local source credit',
    photo_rights:'Not verified for app reuse',finished:{url:'/api/tutorial-assets/local.jpg',source_stage:'finished',photo_status:'Reference'},steps:[]}};
let tree:Renderer.ReactTestRenderer;
const button=(label:string)=>tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function');
async function press(label:string){expect(button(label)).toBeDefined();await Renderer.act(async()=>{await button(label)!.props.onPress();});}
afterEach(async()=>{await Renderer.act(()=>tree?.unmount());jest.clearAllMocks();});

test('fit review preserves local text, finished photo and credits and can cancel without saving',async()=>{
  const choose=jest.fn();
  await Renderer.act(()=>{tree=Renderer.create(<UpcyclingIdeaChoices material="HDPE" ideas={[idea]} onChoose={choose}/>);});
  await press('Choose task: Garden scoop');
  expect(choose).not.toHaveBeenCalled();
  expect(tree.root.findByType(TutorialPhoto).props.photo).toBe(idea.photos!.finished);
  expect(tree.root.findByType(PhotoCredits).props.photos).toBe(idea.photos);
  expect(JSON.stringify(tree.toJSON())).toContain(idea.summary);
  await press('Choose a different idea');
  expect(button('Confirm project fit')).toBeUndefined();expect(choose).not.toHaveBeenCalled();
  await press('Choose task: Garden scoop');await press('Confirm project fit');
  expect(choose).toHaveBeenCalledWith('hdpe_scoop');
  await Renderer.act(()=>tree.update(<UpcyclingIdeaChoices material="HDPE" ideas={[idea]} onChoose={choose} busyId={idea.id}/>));
  expect(button('Confirm project fit')!.props.disabled).toBe(true);
  expect(button('Choose a different idea')!.props.disabled).toBe(true);
});

test('returning to an existing saved idea resumes directly without a new fit confirmation',async()=>{
  const choose=jest.fn();
  await Renderer.act(()=>{tree=Renderer.create(<UpcyclingIdeaChoices material="HDPE" changing ideas={[{...idea,existing_project_id:47,existing_project_status:'active'}]} onChoose={choose}/>);});
  await press('Choose task: Garden scoop');
  expect(choose).toHaveBeenCalledWith('hdpe_scoop');
  expect(button('Confirm project fit')).toBeUndefined();
});

test('a late preparation response cannot replace another scan after navigation',async()=>{
  const wet={id:622,decision:'paper',title:'Paper',condition:'Needs cleaning',previous_contents:'No chemical contact known',
    answers:{contamination:'None known',moisture:'Wet'},recommendation_choices:[],
    assessment:{material:{label:'paper',status:'user_selected'},questions:[],segregation:{status:'needs_information',instructions:[]}}} as unknown as Prediction;
  const other={...wet,id:623,title:'Another scan'};
  let resolve!:(result:{prediction:Prediction})=>void;
  (updatePrediction as jest.Mock).mockImplementation(()=>new Promise(done=>{resolve=done;}));
  const change=jest.fn(),back=jest.fn(),retry=jest.fn(),saved=jest.fn();
  await Renderer.act(()=>{tree=Renderer.create(<AssessmentScreen prediction={wet} onChange={change} onBack={back} onSaved={saved} onRetry={retry}/>);});
  await press('Preparation finished');
  await Renderer.act(()=>{button('Confirm preparation readiness')!.props.onPress();});
  expect(updatePrediction).toHaveBeenCalledWith(622,{condition:'Clean and dry',answers:{contamination:'None known',moisture:'Dry'}});
  await Renderer.act(()=>tree.update(<AssessmentScreen prediction={other} onChange={change} onBack={back} onSaved={saved} onRetry={retry}/>));
  await Renderer.act(async()=>resolve({prediction:{...wet,condition:'Clean and dry'}}));
  expect(change).not.toHaveBeenCalled();
  expect(tree.root.findByType(AssessmentScreen).props.prediction.id).toBe(623);
  expect(button('Preparation finished')).toBeDefined();
});
