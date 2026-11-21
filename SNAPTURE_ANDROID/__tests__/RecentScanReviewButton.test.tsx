import React from 'react';
import Renderer from 'react-test-renderer';
import SavedScanReview from '../src/SavedScanReview';
import AssessmentScreen from '../src/AssessmentScreen';
import {getSavedScan,type Prediction,type ScanScene} from '../src/api';

jest.mock('../src/AssessmentScreen',()=>jest.fn(()=>null));
jest.mock('../src/api',()=>({...jest.requireActual('../src/api'),getSavedScan:jest.fn()}));
const prediction={id:72,decision:'paper',title:'Paper',created_at:'2026-11-18T00:00:00Z',condition:'Not sure',
  recommendation_choices:[],answers:{},assessment:{material:{label:'paper',status:'needs_confirmation'},
  segregation:{status:'needs_information',instructions:[]},missing_information:[]}} as unknown as Prediction;
const scene={id:12,width:200,height:200,status:'complete',image_url:'',quality:{flags:[]},
  items:[{id:4,name:'paper scrap',score:.8,box:[.1,.1,.9,.9],prediction,route:{key:'review',label:'Review',reason:'Confirm material'}}]} as unknown as ScanScene;

test.each([false,true])('recent scan exposes an assessment action and refreshes the same saved ID (grouped=%s)',async grouped=>{
  jest.clearAllMocks();
  (getSavedScan as jest.Mock).mockResolvedValue({prediction,scene:grouped?scene:null});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<SavedScanReview id={72} onBack={jest.fn()} onRetry={jest.fn()}/>);});
  const label=grouped?'Check item 1 details and recommendations':'Review saved item for recommendations';
  const button=tree.root.findAllByProps({accessibilityLabel:label}).find(node=>node.props.onPress);
  expect(button).toBeDefined();
  await Renderer.act(()=>button!.props.onPress());
  expect(tree.root.findByType(AssessmentScreen).props.prediction.id).toBe(72);
  expect(tree.root.findByType(AssessmentScreen).props.startInCheck).toBe(true);
  const updated={...prediction,condition:'Clean and dry'};
  await Renderer.act(()=>tree.root.findByType(AssessmentScreen).props.onChange(updated));
  expect(tree.root.findByType(AssessmentScreen).props.prediction.condition).toBe('Clean and dry');
  (getSavedScan as jest.Mock).mockResolvedValue({prediction:updated,scene:grouped?scene:null});
  await Renderer.act(async()=>tree.root.findByType(AssessmentScreen).props.onBack());
  expect(getSavedScan).toHaveBeenLastCalledWith(72);
  expect(getSavedScan).toHaveBeenCalledTimes(2);
  expect(tree.root.findAllByType(AssessmentScreen)).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});
