import React from 'react';
import Renderer from 'react-test-renderer';
import { MainExperience } from '../src/MainExperience';
import IdeaDetails from '../src/IdeaDetails';
import MaterialIdeaReferences from '../src/MaterialIdeaReferences';
import { getMaterials, type IdeaReference } from '../src/api';

jest.mock('../src/localUpdates',()=>({getLocalUpdates:jest.fn().mockResolvedValue([])}));
jest.mock('../src/api',()=>({getMaterials:jest.fn(),getPredictionOverview:jest.fn().mockResolvedValue({predictions:[],total_count:0}),listProjects:jest.fn().mockResolvedValue([]),listSavedPredictions:jest.fn().mockResolvedValue([])}));
const reference:IdeaReference={id:'reference:paper:v1',title:'Paper gift wrapping',summary:'Reuse a sheet for a non-food gift.',materials:['Clean paper'],steps:['Fold the paper.'],safety_note:'No contaminated material or food contact.',status:'source_checked',can_start:false,source:'Named public source',review_note:'Not CESD approval.',conditions:['Condition: Clean and dry']};
const pending:IdeaReference={...reference,id:'pending:wood',title:'Wood reuse ideas',status:'awaiting_review',materials:[],steps:[],source:'',conditions:[],summary:'Construction methods await review.'};
function button(tree:Renderer.ReactTestRenderer,label:string){return tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!;}

test('read-only source references display steps and provenance without a Start action',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<MaterialIdeaReferences ideas={[reference]} material="Paper" label="paper"/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('General reference · not expert-approved');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Fold the paper.');
  await Renderer.act(()=>button(tree,'Read idea: Paper gift wrapping').props.onPress());
  const text=JSON.stringify(tree.toJSON());
  expect(text).toContain('Fold the paper.');expect(text).toContain('Named public source');expect(text).toContain('No contaminated material');
  expect(tree.root.findAll(node=>node.props.accessibilityLabel==='Start project')).toHaveLength(0);
  await Renderer.act(()=>tree.unmount());
});

test('pending concepts never show supplied steps even if a malformed response contains them',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<IdeaDetails idea={{...pending,steps:['UNREVIEWED CUTTING STEP'],material:'Wood',guideLabel:'dry_untreated_wood_scraps'}}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Awaiting review');
  expect(JSON.stringify(tree.toJSON())).not.toContain('UNREVIEWED CUTTING STEP');
  expect(JSON.stringify(tree.toJSON())).toContain('Do not begin this concept');
  await Renderer.act(()=>tree.unmount());
});

test('existing Ideas page includes references and pending materials, supports filters and opens read-only details',async()=>{
  (getMaterials as jest.Mock).mockResolvedValue({materials:[
    {label:'paper',title:'Paper',upcycling:[],idea_references:[reference]},
    {label:'dry_untreated_wood_scraps',title:'Wood',upcycling:[],idea_references:[pending]},
  ]});
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<MainExperience screen="ideas" navigate={jest.fn()} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()}/>);});
  expect(JSON.stringify(tree.toJSON())).toContain('Paper gift wrapping');
  expect(JSON.stringify(tree.toJSON())).toContain('Wood reuse ideas');
  await Renderer.act(()=>button(tree,'Filter ideas: Wood').props.onPress());
  expect(JSON.stringify(tree.toJSON())).not.toContain('Paper gift wrapping');
  const card=tree.root.findAll(node=>typeof node.type==='function' && node.type.name==='IdeaCard')[0];
  await Renderer.act(()=>card.props.onPress());
  expect(tree.root.findByType(IdeaDetails).props.idea.status).toBe('awaiting_review');
  await Renderer.act(()=>tree.unmount());
});
