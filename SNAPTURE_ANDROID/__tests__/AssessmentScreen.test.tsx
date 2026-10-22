import React from 'react';
import Renderer from 'react-test-renderer';
import { TextInput } from 'react-native';
import AssessmentScreen, { MATERIAL_NAMES } from '../src/AssessmentScreen';
import { createManualPrediction, selectRecommendation, updatePrediction, type Prediction } from '../src/api';
import SuccessAlertDialog from '../src/SuccessAlertDialog';

jest.mock('../src/api', () => ({ createManualPrediction: jest.fn(), updatePrediction: jest.fn(), selectRecommendation: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test('offers seven manual materials including restored coconut shells', async () => {
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(() => { tree = Renderer.create(<AssessmentScreen prediction={null} onChange={jest.fn()} onBack={jest.fn()} onSaved={jest.fn()} onRetry={jest.fn()} />); });
  expect(Object.keys(MATERIAL_NAMES)).toHaveLength(7);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain('Use camera instead');
  expect(JSON.stringify(tree.toJSON())).not.toContain('CESD references');
  expect(MATERIAL_NAMES.coconut_shells).toBe('Coconut shells');
  expect(JSON.stringify(tree.toJSON())).toContain('Manual selection does not count as an AI prediction');
});

test('manual material selection uses its own endpoint', async () => {
  const onChange = jest.fn();
  (createManualPrediction as jest.Mock).mockResolvedValue({ prediction: { id: 12, input_method: 'manual', confidence: 0 } });
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(() => { tree = Renderer.create(<AssessmentScreen prediction={null} onChange={onChange} onBack={jest.fn()} onSaved={jest.fn()} onRetry={jest.fn()} />); });
  const button = tree.root.findAllByProps({ accessibilityLabel: 'Paper' }).find(node => typeof node.props.onPress === 'function');
  expect(button).toBeDefined();
  await Renderer.act(async () => { button?.props.onPress(); });
  expect(createManualPrediction).toHaveBeenCalledWith('paper');
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ confidence: 0, input_method: 'manual' }));
});

test('does not fill in clean condition or safe history by default', async () => {
  const prediction = { id: 2, quantity: null, confidence: 0.9, title: 'Paper', recommendation_choices: [], assessment: {
    material: { title: 'Paper', status: 'model_suggested' }, questions: [], context: {},
    segregation: { status: 'awaiting_review', instructions: [], sources: [], explanation: 'Unavailable' },
    upcycling: { status: 'needs_information', explanation: 'More details required' },
  } } as unknown as Prediction;
  (updatePrediction as jest.Mock).mockResolvedValue({ prediction });
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(() => { tree = Renderer.create(<AssessmentScreen prediction={prediction} onChange={jest.fn()} onBack={jest.fn()} onSaved={jest.fn()} onRetry={jest.fn()} />); });
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
  const button = tree.root.findAllByProps({ accessibilityLabel: 'Show sorting advice' }).find(node => typeof node.props.onPress === 'function');
  expect(button).toBeDefined();
  await Renderer.act(async () => { button?.props.onPress(); });
  expect(updatePrediction).toHaveBeenCalledWith(2, { answers: {} });
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('Your answers are saved. Here is what to do next.');
  expect(JSON.stringify(tree.toJSON())).toContain('What to do next');
});

test.each([true, false])('saving a recommendation success=%s navigates only after OK', async success => {
  const prediction = { id: 4, title: 'Paper', confidence: .5, quantity: 1, recommendation_choices: [{ id: 'wrap', title: 'Gift wrapping', materials: ['Paper'], steps: ['Fold paper'] }] } as unknown as Prediction;
  if (success) (selectRecommendation as jest.Mock).mockResolvedValue({ prediction });
  else (selectRecommendation as jest.Mock).mockRejectedValue(new Error('Could not save project'));
  const onSaved = jest.fn(), onChange = jest.fn();
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<AssessmentScreen prediction={prediction} onChange={onChange} onBack={jest.fn()} onSaved={onSaved} onRetry={jest.fn()} />); });
  const save = tree.root.findAllByProps({ accessibilityLabel: 'Save this project' }).find(node => typeof node.props.onPress === 'function')!;
  await Renderer.act(async () => { await save.props.onPress(); });
  expect(onSaved).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(success ? 1 : 0);
  if (success) {
    expect(onChange).toHaveBeenCalledWith(prediction);
    expect(tree.root.findByType(SuccessAlertDialog).props.message).toContain('Gift wrapping');
    await Renderer.act(async () => { tree.root.findByType(SuccessAlertDialog).props.onConfirm(); });
    expect(onSaved).toHaveBeenCalledTimes(1);
  } else expect(JSON.stringify(tree.toJSON())).toContain('Could not save project');
  await Renderer.act(async () => { tree.unmount(); });
});

test('failed assessment update leaves its inputs and shows no success confirmation', async () => {
  (updatePrediction as jest.Mock).mockRejectedValue(new Error('Assessment save failed'));
  const prediction = { id: 5, quantity: 2, confidence: .5, recommendation_choices: [], assessment:{material:{label:'paper'},questions:[{id:'condition',label:'Condition',options:['Clean and dry']}]} } as unknown as Prediction;
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(async () => { tree = Renderer.create(<AssessmentScreen prediction={prediction} onChange={jest.fn()} onBack={jest.fn()} onSaved={jest.fn()} onRetry={jest.fn()} />); });
  const condition = () => tree.root.findAllByProps({ accessibilityLabel:'Clean, dry and no residue' }).find(node=>node.props.onPress)!;
  await Renderer.act(async () => { condition().props.onPress(); });
  const save = tree.root.findAllByProps({ accessibilityLabel: 'Show sorting advice' }).find(node => typeof node.props.onPress === 'function')!;
  await Renderer.act(async () => { await save.props.onPress(); });
  expect(tree.root.findAllByType(SuccessAlertDialog)).toHaveLength(0);
  expect(condition().props.accessibilityState.checked).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Assessment save failed');
  await Renderer.act(async () => { tree.unmount(); });
});
