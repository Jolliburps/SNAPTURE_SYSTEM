import React from 'react';
import Renderer from 'react-test-renderer';
import { Text } from 'react-native';
import AdminScorecards from '../src/AdminScorecards';
import { getEvaluationReport, getEvaluationRuns, type EvaluationReport } from '../src/api';

jest.mock('../src/api', () => ({ getEvaluationRuns: jest.fn(), getEvaluationReport: jest.fn() }));
const emptyRate = { numerator: 0, denominator: 0, value: null, ci95: null };
const run = { id: 1, name: 'Controlled fixture', split: 'test', dataset_version: 'fixture-v1', frozen: false };
const fixture = { run, counts: { total: 2, adjudicated: 0, unreviewed: 2, manual_excluded_from_camera: 0 },
  identification: { macro_f1: null, all_scope_classes_tested: false, per_material: [{ label: 'paper', support: 0, precision: null, recall: null, f1: null }], accepted_correctness: emptyRate, acceptance_coverage: emptyRate, review_rate: emptyRate, unsupported_false_acceptance: emptyRate },
  segregation: { correct_route: emptyRate, unsafe_guidance: emptyRate, appropriate_review: emptyRate, unnecessary_review: emptyRate },
  recommendations: { shown: 0, judged: 0, unjudged: 0, acceptable: emptyRate, unsafe: emptyRate, eligible_cases_with_acceptable_idea: emptyRate, appropriate_withholding: emptyRate },
  warnings: ['No adjudicated cases yet. No accuracy claim can be made.'],
} as EvaluationReport;
async function press(tree: Renderer.ReactTestRenderer, label: string) {
  const button = tree.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === 'function')!;
  expect(button).toBeDefined();
  await Renderer.act(async () => { await button.props.onPress(); });
  await Renderer.act(async () => { await Promise.resolve(); });
}
const textContent = (tree: Renderer.ReactTestRenderer) => tree.root.findAllByType(Text).map(node => JSON.stringify(node.props.children)).join(' ');
beforeEach(() => jest.clearAllMocks());

test('scorecards load only when explicitly opened and never invent empty accuracy', async () => {
  (getEvaluationRuns as jest.Mock).mockResolvedValue({ runs: [] });
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<AdminScorecards />); });
  expect(getEvaluationRuns).not.toHaveBeenCalled();
  await press(tree, 'Open evaluation scorecards');
  expect(textContent(tree)).toContain('No evaluation runs yet');
  expect(textContent(tree)).not.toContain('100%');
  await press(tree, 'Close scorecards');
  expect(getEvaluationRuns).toHaveBeenCalledTimes(1);
  await Renderer.act(async () => { tree.unmount(); });
});

test('unreviewed report displays denominators, Not measured and draft status separately', async () => {
  (getEvaluationRuns as jest.Mock).mockResolvedValue({ runs: [run] });
  (getEvaluationReport as jest.Mock).mockResolvedValue(fixture);
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<AdminScorecards />); });
  await press(tree, 'Open evaluation scorecards');
  await press(tree, 'Controlled fixture · test · Draft');
  expect(getEvaluationReport).toHaveBeenCalledWith(1);
  const text = textContent(tree);
  expect(text).toContain('Not measured');
  expect(text).toContain('Draft — not a final thesis result');
  expect(text).toContain('Segregation guidance');
  expect(text).toContain('Safety failures cannot be averaged away');
  expect(text).toContain('No adjudicated cases yet');
  await press(tree, 'Back to evaluation runs');
  expect(getEvaluationRuns).toHaveBeenCalledTimes(2);
  await Renderer.act(async () => { tree.unmount(); });
});

test('zero safety failures is shown as zero, not silently converted to no data', async () => {
  (getEvaluationRuns as jest.Mock).mockResolvedValue({ runs: [run] });
  (getEvaluationReport as jest.Mock).mockResolvedValue({ ...fixture, segregation: { ...fixture.segregation, unsafe_guidance: { numerator: 0, denominator: 10, value: 0, ci95: [0, .2775] } } });
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<AdminScorecards />); });
  await press(tree, 'Open evaluation scorecards'); await press(tree, 'Controlled fixture · test · Draft');
  expect(textContent(tree)).toContain('0.0%');
  expect(textContent(tree)).toContain('27.8');
  await Renderer.act(async () => { tree.unmount(); });
});

test('failed requests preserve error feedback and allow retry without fictional results', async () => {
  (getEvaluationRuns as jest.Mock).mockRejectedValueOnce(new Error('Administrator access required')).mockResolvedValue({ runs: [] });
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<AdminScorecards />); });
  await press(tree, 'Open evaluation scorecards');
  expect(textContent(tree)).toContain('Administrator access required');
  expect(textContent(tree)).not.toContain('Raw classification macro-F1');
  await press(tree, 'Retry scorecards');
  expect(textContent(tree)).toContain('No evaluation runs yet');
  await Renderer.act(async () => { tree.unmount(); });
});
