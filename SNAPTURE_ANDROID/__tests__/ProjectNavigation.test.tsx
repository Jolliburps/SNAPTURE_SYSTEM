import React, { useState } from 'react';
import Renderer from 'react-test-renderer';
import { MainExperience, type MainRoute } from '../src/MainExperience';
import ProjectPanels from '../src/ProjectPanels';

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

test('Waste has no separate photo history shortcut and Profile keeps the unified scan history', async () => {
  const navigate = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<MainExperience screen="waste" navigate={navigate} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()} />); });
  expect(JSON.stringify(tree.toJSON())).not.toContain('Photo scan history');
  await Renderer.act(async () => { tree.update(<MainExperience screen="profile" navigate={navigate} user={null} onUserChange={jest.fn()} onCategory={jest.fn()} onLogout={jest.fn()} />); });
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
  ['home', 'HomePage', 'ProfilePage', 'active'],
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
