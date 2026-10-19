import React from 'react';
import Renderer from 'react-test-renderer';
import CESDLearning from '../src/CESDLearning';
import { getLearningInformation } from '../src/api';

jest.mock('../src/api', () => ({ getLearningInformation: jest.fn() }));

test('expands a reference with its source, restrictions and approval disclaimer', async () => {
  (getLearningInformation as jest.Mock).mockResolvedValue({ entries: [{ key: 'hazard', version: 1, title: 'Household precautions', category: 'Safety', summary: 'Check history', instructions: ['Do not mix chemicals.'], warnings: 'No confirmed collection date.', source: 'CESD brochure, household panel', review_note: 'Not expert validation.', review_level: 'source_checked' }] });
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<CESDLearning />); });
  expect(JSON.stringify(tree.toJSON())).toContain('not live announcements or CESD approval');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Do not mix chemicals.');
  const button = tree.root.findAllByProps({ accessibilityLabel: 'Household precautions' }).find(node => typeof node.props.onPress === 'function');
  await Renderer.act(async () => { button?.props.onPress(); });
  expect(JSON.stringify(tree.toJSON())).toContain('Do not mix chemicals.');
  expect(JSON.stringify(tree.toJSON())).toContain('CESD brochure, household panel');
  expect(JSON.stringify(tree.toJSON())).toContain('No confirmed collection date.');
});

test('reports unavailable sources honestly and supports retry', async () => {
  (getLearningInformation as jest.Mock).mockRejectedValueOnce(new Error('Backend unavailable')).mockResolvedValueOnce({ entries: [] });
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<CESDLearning />); });
  expect(JSON.stringify(tree.toJSON())).toContain('Backend unavailable');
  const button = tree.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')[0];
  await Renderer.act(async () => { button.props.onPress(); });
  expect(JSON.stringify(tree.toJSON())).toContain('No published reference information is available yet.');
});
