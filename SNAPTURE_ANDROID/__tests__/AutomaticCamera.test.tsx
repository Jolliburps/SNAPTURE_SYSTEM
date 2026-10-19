import React from 'react';
import Renderer from 'react-test-renderer';
import { Text } from 'react-native';
import App from '../App';
import { createScene, createPrediction, getScene, type ScanScene } from '../src/api';
import * as api from '../src/api';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
  SafeAreaView: jest.requireActual('react-native').View,
}));

jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  getCurrentUser: jest.fn().mockResolvedValue({ id: 1, role: 'regular', display_name: 'Test user', barangay: '' }),
  getMaterials: jest.fn().mockResolvedValue({ materials: [] }),
  getPredictionOverview: jest.fn().mockResolvedValue({ predictions: [], total_count: 0 }),
  listProjects: jest.fn().mockResolvedValue([]), listSavedPredictions: jest.fn().mockResolvedValue([]),
  createScene: jest.fn(), createPrediction: jest.fn(), getScene: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (api.getCurrentUser as jest.Mock).mockResolvedValue({ id:1,role:'regular',email:'test@example.com',display_name:'Test user',barangay:'' });
  (api.getMaterials as jest.Mock).mockResolvedValue({materials:[]});
  (api.getPredictionOverview as jest.Mock).mockResolvedValue({predictions:[],total_count:0});
  (api.listProjects as jest.Mock).mockResolvedValue([]);
  (api.listSavedPredictions as jest.Mock).mockResolvedValue([]);
});

test.each([[1,'Item result'],[2,'Sort this scan']])('camera automatically presents %i detections without a mode selector', async (count, title) => {
  const scene = { id: 5, width: 200, height: 200, image_url: '/test-scene.jpg', status: 'complete', quality: { flags: [] }, items: Array.from({ length: Number(count) }, (_, index) => ({ id: index+1, name: 'paper scrap', score: .7, box: [.1+index*.3,.1,.3+index*.3,.4], suggested_group: 'recyclable', route: { key: 'review', label: 'Needs review', reason: 'Confirm the material.' }, prediction: { id: index+1, image_url: null, title: 'Paper', recommendation_choices: [], assessment: { material: { status: 'needs_confirmation' }, missing_information: [], segregation: { status: 'needs_information', instructions: [] } } } })) } as unknown as ScanScene;
  (createScene as jest.Mock).mockResolvedValue({ scene }); (getScene as jest.Mock).mockResolvedValue({ scene });
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<App />); });
  const press = async (label: string) => { const node = tree.root.findAllByProps({ accessibilityLabel: label }).find(item=>typeof item.props.onPress==='function'); expect(node).toBeDefined(); await Renderer.act(async () => { await node?.props.onPress(); }); };
  await press('Camera');
  let json = JSON.stringify(tree.toJSON());
  expect(json).not.toContain('Single item'); expect(json).not.toContain('Mixed items');
  const camera = tree.root.findAll(node=>typeof node.props.onStarted==='function')[0];
  await Renderer.act(async () => { camera.props.onStarted(); });
  await press('Take photo');
  // PrimaryButton exposes its visible label rather than a separate accessibility label.
  const analyze = tree.root.findAll(node=>typeof node.props.onPress==='function' && node.findAllByType(Text).some(child=>child.props.children==='Analyze image'))[0];
  expect(analyze).toBeDefined();
  await Renderer.act(async () => { await analyze.props.onPress(); });
  json = JSON.stringify(tree.toJSON()); expect(json).toContain(title);
  expect(createScene).toHaveBeenCalled(); expect(createPrediction).not.toHaveBeenCalled();
  await Renderer.act(async () => { tree.unmount(); });
});
