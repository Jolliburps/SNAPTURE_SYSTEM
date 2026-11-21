import React from 'react';
import Renderer from 'react-test-renderer';
import SceneResults from '../src/SceneResults';
import AssessmentAdvice, {adviceSummary} from '../src/AssessmentAdvice';
import ScreeningOutcome from '../src/ScreeningOutcome';
import {getScene, type Prediction, type ScanScene} from '../src/api';
import {materialCategoryName} from '../src/detectionPresentation';

jest.mock('../src/api',()=>({getScene:jest.fn(),imageUrl:(uri:string)=>uri}));
jest.mock('../src/upcyclingApi',()=>({upcyclingRequest:jest.fn().mockResolvedValue({snapshot:null})}));
jest.mock('../src/SuitabilityProjects',()=>()=>null);
const glass = {
  id:1,decision:'unknown_unsupported',condition:'Clean and dry',answers:{},confidence:0,
  recognition:{status:'unsupported'},
  waste_identifier:{category:'C',category_label:'Hazardous Waste'},
  screening:{status:'ineligible',eligible:false,reasons:['Glass is excluded from upcycling.'],missing_information:[]},
  assessment:{material:{label:'unknown_unsupported'},segregation:{status:'unavailable',instructions:[]}},
} as unknown as Prediction;

test('glass shows its waste category and explicit upcycling exclusion in scan results',async()=>{
  const scene={id:1,status:'complete',image_url:'/glass.jpg',width:100,height:100,quality:{flags:[]},
    single_item:{enabled:true},items:[{id:1,name:'glass bottle or glass jar',box:[.1,.1,.9,.9],score:.8,
      detection_status:'accepted',prediction:glass}]} as unknown as ScanScene;
  (getScene as jest.Mock).mockResolvedValue({scene});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<SceneResults initial={scene} onBack={jest.fn()} onRetry={jest.fn()} onReview={jest.fn()} onProceed={jest.fn()}/>);});
  const output=JSON.stringify(tree.toJSON());
  expect(output).toContain('HAZARDOUS WASTE');
  expect(output).toContain('not eligible for upcycling');
  expect(output).not.toContain('Unsupported');
  expect(tree.root.findAllByProps({accessibilityLabel:'Proceed to Upcycling Recommendation'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Check material'})).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});

test('hazardous waste never exposes Proceed even with a legacy eligible result',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<ScreeningOutcome prediction={{...glass,screening:{status:'eligible',eligible:true,reasons:[],missing_information:[]}}} onProceed={jest.fn()}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Not Eligible for Upcycling');
  expect(tree.root.findAllByProps({accessibilityRole:'button'})).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});

test('recognized non-upcycling material uses its waste category',()=>{
  expect(materialCategoryName({...glass,waste_identifier:{...glass.waste_identifier!,category:'B1',category_label:'Recyclable / reusable'}})).toBe('Recyclable / reusable');
});

test('missing local rule hides the fallback card while sources remain accessible',async()=>{
  const p={...glass,decision:'fabric_scraps',waste_identifier:null,condition:'Clean and dry',
    assessment:{...glass.assessment,material:{label:'fabric_scraps',status:'user_selected'},
      quick_check:{has_sorting_rule:false},segregation:{status:'unavailable',instructions:[],explanation:'No published local sorting rule.'}}} as unknown as Prediction;
  expect(adviceSummary(p)).toBeNull();
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<AssessmentAdvice prediction={p} saved={false} busy={false} onEdit={jest.fn()} onDone={jest.fn()} onRetry={jest.fn()}/>);});
  const output=JSON.stringify(tree.toJSON());
  expect(output).not.toContain('No checked local rule yet');
  expect(output).toContain('Sources and details');
  expect(adviceSummary({...p,previous_contents:'Chemical or cleaning product'})?.title).toBe('Keep this item separate');
  await Renderer.act(()=>tree.unmount());
});
