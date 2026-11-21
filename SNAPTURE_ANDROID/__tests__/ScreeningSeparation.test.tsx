import React from 'react';
import Renderer from 'react-test-renderer';
import ScreeningOutcome, { PROCEED_LABEL } from '../src/ScreeningOutcome';
import UpcyclingRecommendations from '../src/UpcyclingRecommendations';
import AssessmentScreen from '../src/AssessmentScreen';
import ScanUpcyclingIdeas from '../src/ScanUpcyclingIdeas';
import { requestUpcyclingRecommendations, type Prediction } from '../src/api';
jest.mock('../src/api', () => ({
  ...jest.requireActual('../src/api'),
  requestUpcyclingRecommendations: jest.fn(),
}));
jest.mock('../src/ScanUpcyclingIdeas', () => jest.fn(() => null));
const eligible = {
  status: 'eligible',
  eligible: true,
  reasons: ['Passed'],
  missing_information: [],
};
const prediction = {
  id: 72,
  scene_id: 9,
  decision: 'paper',
  confidence: 0.9,
  answers: {},
  recommendation_choices: [],
  condition: 'Clean and dry',
  screening: eligible,
  assessment: {
    material: { label: 'paper', status: 'user_selected' },
    quick_check: { user_reviewed: true },
    segregation: { status: 'available', instructions: [] },
    questions: [],
    context: {},
  },
} as unknown as Prediction;
let intent = 0;
const render = async (node: React.ReactElement) => {
  let tree!: Renderer.ReactTestRenderer;
  await Renderer.act(() => {
    tree = Renderer.create(node);
  });
  return tree;
};
const press = async (tree: Renderer.ReactTestRenderer, label: string) => {
  const button = tree.root
    .findAllByProps({ accessibilityLabel: label })
    .find(node => node.props.onPress)!;
  expect(button).toBeDefined();
  await Renderer.act(() => button.props.onPress());
};
const response = (id = 72) => ({
  prediction_id: id,
  scene_id: 9,
  revision: 'test',
  screening: eligible,
  recommendations: [],
  status: 'no_matching_project',
});
beforeEach(() => jest.clearAllMocks());
test.each([
  'needs_information',
  'needs_preparation',
  'ineligible',
  'unsupported',
  undefined,
])(
  'Proceed is absent for %s despite legacy projects and available segregation',
  async status => {
    const p = {
      ...prediction,
      screening: status ? { ...eligible, status, eligible: false } : undefined,
      recommendation_choices: [{ id: 'old', title: 'Legacy project' }],
    } as unknown as Prediction;
    const tree = await render(
      <ScreeningOutcome prediction={p} onProceed={jest.fn()} />,
    );
    expect(
      tree.root.findAllByProps({ accessibilityLabel: PROCEED_LABEL }),
    ).toHaveLength(0);
    expect(requestUpcyclingRecommendations).not.toHaveBeenCalled();
    await Renderer.act(() => tree.unmount());
  },
);
test('Proceed opens exactly this prediction once without fetching on screening', async () => {
  const proceed = jest.fn();
  const tree = await render(
    <ScreeningOutcome prediction={prediction} onProceed={proceed} />,
  );
  expect(requestUpcyclingRecommendations).not.toHaveBeenCalled();
  await press(tree, PROCEED_LABEL);
  await press(tree, PROCEED_LABEL);
  expect(proceed).toHaveBeenCalledTimes(1);
  expect(proceed).toHaveBeenCalledWith(prediction);
  await Renderer.act(() => tree.unmount());
});
test('skipping cannot expose Proceed even if a previous snapshot was eligible', async () => {
  const tree = await render(
    <AssessmentScreen
      startInCheck
      prediction={prediction}
      onChange={jest.fn()}
      onBack={jest.fn()}
      onSaved={jest.fn()}
      onRetry={jest.fn()}
      onProceed={jest.fn()}
    />,
  );
  await press(tree, 'Skip check for now');
  expect(
    tree.root.findAllByProps({ accessibilityLabel: PROCEED_LABEL }),
  ).toHaveLength(0);
  expect(requestUpcyclingRecommendations).not.toHaveBeenCalled();
  await Renderer.act(() => tree.unmount());
});
test('dedicated screen requests the right ID and explains an eligible no-match', async () => {
  (requestUpcyclingRecommendations as jest.Mock).mockResolvedValue(response());
  const tree = await render(
    <UpcyclingRecommendations
      prediction={prediction}
      intent={++intent}
      onBack={jest.fn()}
    />,
  );
  expect(requestUpcyclingRecommendations).toHaveBeenCalledTimes(1);
  expect(requestUpcyclingRecommendations).toHaveBeenCalledWith(72);
  expect(JSON.stringify(tree.toJSON())).toContain(
    'does not mean the item is unsafe',
  );
  expect(tree.root.findAllByType(ScanUpcyclingIdeas)).toHaveLength(0);
  await Renderer.act(() => tree.unmount());
});
test('failed request retries explicitly and preserves the existing display format', async () => {
  (requestUpcyclingRecommendations as jest.Mock)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce({
      ...response(),
      recommendations: [
        {
          id: 'wrap',
          title: 'Gift wrap',
          photos: { credit: 'Original credit' },
        },
      ],
    });
  const tree = await render(
    <UpcyclingRecommendations
      prediction={prediction}
      intent={++intent}
      onBack={jest.fn()}
    />,
  );
  expect(JSON.stringify(tree.toJSON())).toContain('Offline');
  await press(tree, 'Retry recommendations');
  expect(requestUpcyclingRecommendations).toHaveBeenCalledTimes(2);
  expect(
    tree.root.findByType(ScanUpcyclingIdeas).props.prediction.upcycling_ideas[0]
      .photos.credit,
  ).toBe('Original credit');
  await Renderer.act(() => tree.unmount());
});
test('changing item invalidates in-flight results and requires a new Proceed intent', async () => {
  let resolve!: (value: unknown) => void;
  (requestUpcyclingRecommendations as jest.Mock).mockImplementationOnce(
    () =>
      new Promise(done => {
        resolve = done;
      }),
  );
  const action = ++intent;
  const tree = await render(
    <UpcyclingRecommendations
      prediction={prediction}
      intent={action}
      onBack={jest.fn()}
    />,
  );
  await Renderer.act(() =>
    tree.update(
      <UpcyclingRecommendations
        prediction={{ ...prediction, id: 73, condition: 'Not sure' }}
        intent={action}
        onBack={jest.fn()}
      />,
    ),
  );
  await Renderer.act(() => {
    resolve({
      ...response(),
      recommendations: [{ id: 'old', title: 'Outdated project' }],
    });
  });
  expect(requestUpcyclingRecommendations).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType(ScanUpcyclingIdeas)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('details changed');
  await Renderer.act(() =>
    tree.update(
      <UpcyclingRecommendations
        prediction={prediction}
        intent={action}
        onBack={jest.fn()}
      />,
    ),
  );
  expect(requestUpcyclingRecommendations).toHaveBeenCalledTimes(1);
  expect(tree.root.findAllByType(ScanUpcyclingIdeas)).toHaveLength(0);
  await Renderer.act(() => tree.unmount());
});
test('back and guide remount reuse the same intent without duplicate requests', async () => {
  (requestUpcyclingRecommendations as jest.Mock).mockResolvedValue(response());
  const back = jest.fn(),
    action = ++intent;
  const tree = await render(
    <UpcyclingRecommendations
      prediction={prediction}
      intent={action}
      onBack={back}
    />,
  );
  await press(tree, 'Back to screening');
  expect(back).toHaveBeenCalledTimes(1);
  await Renderer.act(() => tree.unmount());
  const reopened = await render(
    <UpcyclingRecommendations
      prediction={prediction}
      intent={action}
      onBack={back}
    />,
  );
  expect(requestUpcyclingRecommendations).toHaveBeenCalledTimes(1);
  await Renderer.act(() => reopened.unmount());
});

test('a successful retry remains available when returning from its guide', async () => {
  (requestUpcyclingRecommendations as jest.Mock)
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce({
      ...response(),
      recommendations: [{ id: 'wrap', title: 'Gift wrap', steps: ['Fold'] }],
    });
  const action = ++intent;
  const tree = await render(
    <UpcyclingRecommendations
      prediction={prediction}
      intent={action}
      onBack={jest.fn()}
    />,
  );
  await press(tree, 'Retry recommendations');
  expect(tree.root.findAllByType(ScanUpcyclingIdeas)).toHaveLength(1);
  await Renderer.act(() => tree.unmount());
  const returned = await render(
    <UpcyclingRecommendations
      prediction={prediction}
      intent={action}
      onBack={jest.fn()}
    />,
  );
  expect(requestUpcyclingRecommendations).toHaveBeenCalledTimes(2);
  expect(returned.root.findAllByType(ScanUpcyclingIdeas)).toHaveLength(1);
  await Renderer.act(() => returned.unmount());
});
