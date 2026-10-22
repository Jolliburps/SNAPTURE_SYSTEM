import React from 'react';
import Renderer from 'react-test-renderer';
import { Text } from 'react-native';
import App from '../App';
import { createScene, createPrediction, getScene, type ScanScene } from '../src/api';
import * as api from '../src/api';
import * as cameraApi from 'react-native-vision-camera';

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
  preparePrivatePreview:jest.fn().mockResolvedValue({preview_uri:'data:image/jpeg;base64,cHJvdGVjdGVk',faces_blurred:0,version:'face-v1'}),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (api.getCurrentUser as jest.Mock).mockResolvedValue({ id:1,role:'regular',email:'test@example.com',display_name:'Test user',barangay:'' });
  (api.getMaterials as jest.Mock).mockResolvedValue({materials:[]});
  (api.getPredictionOverview as jest.Mock).mockResolvedValue({predictions:[],total_count:0});
  (api.listProjects as jest.Mock).mockResolvedValue([]);
  (api.listSavedPredictions as jest.Mock).mockResolvedValue([]);
});

test.each([1,2])('camera automatically presents %i detections for disposal selection without a mode selector', async count => {
  const scene = { id: 5, width: 200, height: 200, image_url: '/test-scene.jpg', status: 'complete', quality: { flags: [] }, items: Array.from({ length: Number(count) }, (_, index) => ({ id: index+1, name: 'paper scrap', score: .7, box: [.1+index*.3,.1,.3+index*.3,.4], suggested_group: 'recyclable', route: { key: 'review', label: 'Needs review', reason: 'Confirm the material.' }, prediction: { id: index+1, image_url: null, title: 'Paper', recommendation_choices: [], assessment: { material: { status: 'needs_confirmation' }, missing_information: [], segregation: { status: 'needs_information', instructions: [] } } } })) } as unknown as ScanScene;
  (createScene as jest.Mock).mockResolvedValue({ scene }); (getScene as jest.Mock).mockResolvedValue({ scene });
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<App />); });
  const press = async (label: string) => { const node = tree.root.findAllByProps({ accessibilityLabel: label }).find(item=>typeof item.props.onPress==='function'); expect(node).toBeDefined(); await Renderer.act(async () => { await node?.props.onPress(); }); };
  await press('Camera');
  let json = JSON.stringify(tree.toJSON());
  expect(json).not.toContain('Single item'); expect(json).not.toContain('Mixed items');
  expect(json).not.toContain('Only the guide area is analyzed');
  const camera = tree.root.findAll(node=>typeof node.props.onStarted==='function')[0];
  await Renderer.act(async () => { camera.props.onStarted(); });
  await press('Take photo');
  // PrimaryButton exposes its visible label rather than a separate accessibility label.
  const analyze = tree.root.findAll(node=>typeof node.props.onPress==='function' && node.findAllByType(Text).some(child=>child.props.children==='Analyze image'))[0];
  expect(analyze).toBeDefined();
  await Renderer.act(async () => { await analyze.props.onPress(); });
  json = JSON.stringify(tree.toJSON()); expect(json).toContain('Which items do you want to discard?');
  expect(tree.root.findAllByProps({accessibilityLabel:'Select box 1'})[0].props.accessibilityState.checked).toBe(false);
  await press('Select box 1');
  expect(tree.root.findAllByProps({accessibilityLabel:'Select box 1'})[0].props.accessibilityState.checked).toBe(true);
  expect(tree.root.findAllByProps({accessibilityLabel:'Review item 1'})).toHaveLength(0);
  expect(createScene).toHaveBeenCalled(); expect(createPrediction).not.toHaveBeenCalled();
  expect((createScene as jest.Mock).mock.calls[0][2]).toBeUndefined();
  await Renderer.act(async () => { tree.unmount(); });
});

test('flash status is hidden initially, lasts 2.5 seconds after taps and resets its timer', async () => {
  jest.useFakeTimers();
  const device = jest.spyOn(cameraApi, 'useCameraDevice').mockImplementation(position => ({ id: `mock-${position}`, position, hasFlash: true, hasTorch: false } as unknown as ReturnType<typeof cameraApi.useCameraDevice>));
  let tree!: Renderer.ReactTestRenderer;
  try {
    await Renderer.act(async () => { tree = Renderer.create(<App />); });
    const press = async (label: string) => {
      const button = tree.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === 'function')!;
      expect(button).toBeDefined();
      await Renderer.act(async () => { button.props.onPress(); });
    };
    const status = () => tree.root.findAllByType(Text).filter(node => node.props.accessibilityLiveRegion === 'polite');
    await press('Camera');
    expect(status()).toHaveLength(0);
    await press('Flash: Off');
    expect(status()[0].props.children.join('')).toBe('Flash: On');
    await Renderer.act(async () => { jest.advanceTimersByTime(2000); });
    await press('Flash: On');
    expect(status()[0].props.children.join('')).toBe('Flash: Auto');
    await Renderer.act(async () => { jest.advanceTimersByTime(2499); });
    expect(status()).toHaveLength(1);
    await Renderer.act(async () => { jest.advanceTimersByTime(1); });
    expect(status()).toHaveLength(0);
    await press('Flash: Auto');
    expect(status()[0].props.children.join('')).toBe('Flash: Off');
    await press('Switch to front camera');
    expect(status()).toHaveLength(0);
    await press('Switch to rear camera');
    await press('Flash: Off');
    await Renderer.act(async () => { tree.unmount(); jest.advanceTimersByTime(3000); });
  } finally { device.mockRestore(); jest.useRealTimers(); }
});
