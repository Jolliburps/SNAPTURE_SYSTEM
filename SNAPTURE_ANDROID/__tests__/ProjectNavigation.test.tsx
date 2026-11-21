import React, { useState } from 'react';
import Renderer from 'react-test-renderer';
import { MainExperience, type MainRoute } from '../src/MainExperience';
import ProjectPanels from '../src/ProjectPanels';
import {getMaterials} from '../src/api';

jest.mock('../src/ProjectPanels', () => jest.fn(() => null));
jest.mock('../src/localUpdates', () => ({ getLocalUpdates: jest.fn().mockResolvedValue([]) }));
jest.mock('../src/api', () => ({
  getMaterials: jest.fn().mockResolvedValue({ materials: [] }),
  getPredictionOverview: jest.fn().mockResolvedValue({ predictions: [], total_count: 0 }),
  listSavedPredictions: jest.fn().mockResolvedValue([]),
  listProjects: jest.fn().mockResolvedValue([]),
}));

function Harness({ initial }: { initial: MainRoute }) {
  const [screen, navigate] = useState(initial);
  return <MainExperience screen={screen} navigate={navigate} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()} />;
}

test('the completed-project route opens the Completed filter immediately',async()=>{
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<Harness initial="projects-completed"/>);});
  expect(tree.root.findByType(ProjectPanels).props.section).toBe('projects');
  expect(tree.root.findByType(ProjectPanels).props.initialFilter).toBe('completed');
  await Renderer.act(()=>tree.unmount());
});

test('Waste has no separate photo history shortcut and Home keeps the unified scan history', async () => {
  const navigate = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<MainExperience screen="waste" navigate={navigate} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()} />); });
  expect(JSON.stringify(tree.toJSON())).not.toContain('Photo scan history');
  await Renderer.act(async () => { tree.update(<MainExperience screen="home" navigate={navigate} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()} />); });
  const label = tree.root.findAll(node => node.props.children === 'My scans')[0];
  let parent = label.parent;
  let action: Renderer.ReactTestInstance | null = null;
  while (parent) {
    if (typeof parent.props.onPress === 'function') action = parent;
    parent = parent.parent;
  }
  expect(action).not.toBeNull();
  await Renderer.act(async () => { action!.props.onPress(); });
  expect(navigate).toHaveBeenCalledWith('history');
  await Renderer.act(async () => { tree.unmount(); });
});

test.each([
  ['home', 'HomePage', 'ProfilePage', 'all'],
  ['profile', 'ProfilePage', 'HomePage', 'all'],
] as const)('projects opened from %s keep their origin and return there', async (initial, page, otherPage, filter) => {
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<Harness initial={initial} />); });
  const findPage = (name: string) => tree.root.findAll(node => typeof node.type === 'function' && node.type.name === name);
  await Renderer.act(async () => { findPage(page)[0].props.navigate('projects'); });
  expect(findPage(page)).toHaveLength(1);
  expect(findPage(otherPage)).toHaveLength(0);
  expect(tree.root.findByType(ProjectPanels).props.initialFilter).toBe(filter);
  await Renderer.act(async () => { tree.root.findByType(ProjectPanels).props.onClose(); });
  expect(tree.root.findAllByType(ProjectPanels)).toHaveLength(0);
  expect(findPage(page)).toHaveLength(1);
});

test('Home owns the project shortcuts and Recommendations searches every catalog source',async()=>{
  const idea=(id:string,title:string)=>({id,title,summary:title,materials:[],steps:[],safety_note:''});
  (getMaterials as jest.Mock).mockResolvedValue({materials:[{label:'paper',title:'Paper',short_title:'Paper',description:'Paper',examples:[],preparation:[],upcycling:[idea('published','Published craft')],photo_ideas:[idea('photo','Photo craft')],home_tutorials:[idea('tutorial','Tutorial craft')],idea_references:[idea('reference','Reference craft')]}]});
  let tree!:Renderer.ReactTestRenderer;
  const props={navigate:jest.fn(),user:null,onUserChange:jest.fn(),onCategory:jest.fn(),onLogout:jest.fn()};
  await Renderer.act(async()=>{tree=Renderer.create(<MainExperience {...props} screen="home"/>);});
  let json=JSON.stringify(tree.toJSON());
  expect(json).toContain('My scans');expect(json).toContain('Saved / favorite projects');
  expect(json).not.toContain('Ideas for a greener tomorrow');expect(json).not.toContain('Search ideas and materials');
  await Renderer.act(async()=>tree.update(<MainExperience {...props} screen="profile"/>));
  json=JSON.stringify(tree.toJSON());expect(json).not.toContain('My scans');expect(json).not.toContain('Saved / favorite projects');expect(json).toContain('Barangay Residence');
  await Renderer.act(async()=>tree.update(<MainExperience {...props} screen="learn"/>));
  json=JSON.stringify(tree.toJSON());
  for(const title of ['Published craft','Photo craft','Tutorial craft','Reference craft'])expect(json).toContain(title);
  const search=tree.root.findAllByProps({placeholder:'Search projects or materials'}).find(node=>node.props.onChangeText)!;
  await Renderer.act(async()=>search.props.onChangeText('tutorial'));
  json=JSON.stringify(tree.toJSON());expect(json).toContain('Tutorial craft');expect(json).not.toContain('Published craft');
  await Renderer.act(()=>tree.unmount());
});
