import React, { useState } from 'react';
import { BackHandler } from 'react-native';
import Renderer from 'react-test-renderer';
import { MainExperience, type MainRoute } from '../src/MainExperience';
import SettingsPage from '../src/SettingsPage';
import useProfileSettingsNavigation from '../src/useProfileSettingsNavigation';

jest.mock('../src/localUpdates', () => ({ getLocalUpdates: jest.fn().mockResolvedValue([]) }));
jest.mock('../src/api', () => ({
  getMaterials: jest.fn().mockResolvedValue({ materials: [] }),
  getPredictionOverview: jest.fn().mockResolvedValue({ predictions: [], total_count: 0 }),
  listSavedPredictions: jest.fn().mockResolvedValue([]),
  listProjects: jest.fn().mockResolvedValue([]),
}));

function Harness() {
  const [screen, navigate] = useState<MainRoute>('profile');
  return <MainExperience screen={screen} navigate={navigate} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()} />;
}

function action(tree:Renderer.ReactTestRenderer,label:string) {
  return tree.root.findAllByProps({accessibilityLabel:label}).find(node=>typeof node.props.onPress==='function')!;
}

test('only the upper-right settings shortcut remains and duplicate taps are ignored', async () => {
  const navigate=jest.fn(); let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<MainExperience screen="profile" navigate={navigate} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()}/>);});
  const button=action(tree,'Open settings');
  expect(tree.root.findAllByProps({accessibilityLabel:'Open profile settings'})).toHaveLength(0);
  expect(tree.root.findAllByProps({accessibilityLabel:'Open account settings'})).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Name, profile picture, and account information');
  expect(JSON.stringify(tree.toJSON())).toContain('SNAPTURE user');
  await Renderer.act(()=>{button.props.onPress();button.props.onPress();});
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith('settings');
  await Renderer.act(()=>tree.unmount());
});

test('the settings icon opens settings and Back returns to Profile', async () => {
  const label='Open settings';
  let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(async()=>{tree=Renderer.create(<Harness/>);});
  await Renderer.act(async()=>{action(tree,label).props.onPress();});
  expect(tree.root.findAllByType(SettingsPage)).toHaveLength(1);
  await Renderer.act(async()=>{action(tree,'Back to Profile').props.onPress();});
  expect(tree.root.findAllByType(SettingsPage)).toHaveLength(0);
  expect(action(tree,label)).toBeDefined();
  await Renderer.act(()=>tree.unmount());
});

type Controls=ReturnType<typeof useProfileSettingsNavigation>;
function HookHarness({screen,navigate,expose}:{screen:MainRoute;navigate:(route:MainRoute)=>void;expose:(controls:Controls)=>void}) {
  expose(useProfileSettingsNavigation(screen,navigate));
  return null;
}

test('settings keeps its original route, ignores same-screen entry and handles Android Back once', async () => {
  const navigate=jest.fn(),remove=jest.fn();
  let hardwareBack:()=>boolean=()=>false;
  const listener=jest.spyOn(BackHandler,'addEventListener').mockImplementation((_event,callback)=>{hardwareBack=()=>Boolean(callback({type:'hardwareBackPress',timeStamp:0}));return {remove};});
  let controls!:Controls; const expose=(value:Controls)=>{controls=value;}; let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<HookHarness screen="home" navigate={navigate} expose={expose}/>);});
  expect(navigate).not.toHaveBeenCalled();
  await Renderer.act(()=>{controls.openProfileSettings();controls.openProfileSettings();});
  expect(navigate.mock.calls).toEqual([['settings']]);
  await Renderer.act(()=>tree.update(<HookHarness screen="settings" navigate={navigate} expose={expose}/>));
  expect(controls.backLabel).toBe('Home');
  await Renderer.act(()=>{controls.openProfileSettings();expect(hardwareBack()).toBe(true);controls.closeProfileSettings();});
  expect(navigate.mock.calls).toEqual([['settings'],['home']]);
  await Renderer.act(()=>tree.update(<HookHarness screen="home" navigate={navigate} expose={expose}/>));
  expect(remove).toHaveBeenCalledTimes(1);
  await Renderer.act(()=>controls.closeProfileSettings());
  expect(navigate).toHaveBeenCalledTimes(2);
  // A later visit is allowed; the protection is not a permanent debounce.
  await Renderer.act(()=>controls.openProfileSettings());
  expect(navigate.mock.calls).toEqual([['settings'],['home'],['settings']]);
  await Renderer.act(()=>tree.unmount()); listener.mockRestore();
});

test('opening directly on settings has a safe Profile fallback without redirecting on render', async () => {
  const navigate=jest.fn(); let controls!:Controls; let tree!:Renderer.ReactTestRenderer;
  await Renderer.act(()=>{tree=Renderer.create(<HookHarness screen="settings" navigate={navigate} expose={value=>{controls=value;}}/>);});
  expect(controls.backLabel).toBe('Profile');
  await Renderer.act(()=>controls.openProfileSettings());
  expect(navigate).not.toHaveBeenCalled();
  await Renderer.act(()=>{controls.closeProfileSettings();controls.closeProfileSettings();});
  expect(navigate.mock.calls).toEqual([['profile']]);
  await Renderer.act(()=>tree.unmount());
});
