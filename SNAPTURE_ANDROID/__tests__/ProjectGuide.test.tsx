import React, { useState } from 'react';
import Renderer from 'react-test-renderer';
import { Alert } from 'react-native';
import ProjectGuide from '../src/ProjectGuide';
import type { UserProject } from '../src/api';

const base = { id: 1, title: 'Use paper as non-food gift wrapping', material: 'Paper', steps: ['Choose a clean sheet.', 'Wrap a non-food item.', 'Keep the sheet for another use.'], completed_steps: [], completed_count: 0, total_steps: 3, progress_percent: 0, status: 'active', safety_note: 'Non-food use only. Check suitability.' } as unknown as UserProject;
const spyStep = jest.fn();
const spyRestart = jest.fn();
function Harness({ initial = base, onDone = jest.fn() }: { initial?: UserProject; onDone?: () => void }) {
  const [project, setProject] = useState(initial);
  const update = (completed_steps: number[]) => {
    const updated = { ...project, completed_steps, completed_count: completed_steps.length, progress_percent: Math.round(completed_steps.length / 3 * 100), status: completed_steps.length === 3 ? 'completed' as const : 'active' as const };
    setProject(updated); return updated;
  };
  return <ProjectGuide project={project} onDone={onDone} onStep={async (id, index, completed) => { spyStep(id, index, completed); return update(completed ? [...new Set([...project.completed_steps, index])] : project.completed_steps.filter(i => i !== index)); }} onRestart={async id => { spyRestart(id); return update([]); }} />;
}
let tree: Renderer.ReactTestRenderer;
const button = (label: string) => tree.root.findAllByProps({ accessibilityLabel: label }).find(node => typeof node.props.onPress === 'function');
const press = async (label: string) => { const node = button(label); expect(node).toBeDefined(); await Renderer.act(async () => { node?.props.onPress(); }); };
const advance = async () => { await Renderer.act(async () => { jest.advanceTimersByTime(500); }); };
const headings = () => tree.root.findAllByProps({ accessibilityRole: 'header' }).map(node => node.children.join(''));
beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); });
afterEach(() => { if (tree) Renderer.act(() => { tree.unmount(); }); jest.useRealTimers(); });

test('advances after saving and finishes with a real completion summary', async () => {
  const onDone = jest.fn();
  await Renderer.act(async () => { tree = Renderer.create(<Harness onDone={onDone} />); });
  await press('Mark as done'); expect(JSON.stringify(tree.toJSON())).toContain('Moving on');
  await advance(); expect(headings()).toContain('Step 2 of 3');
  await press('Mark as done'); await advance();
  expect(button('Finish')).toBeDefined(); expect(button('Next')).toBeUndefined();
  await press('Finish'); await advance();
  expect(JSON.stringify(tree.toJSON())).toContain('Project completed!');
  expect(JSON.stringify(tree.toJSON())).toContain('Use paper as non-food gift wrapping');
  expect(JSON.stringify(tree.toJSON())).not.toContain('Mark as not done');
  await press('Done'); expect(onDone).toHaveBeenCalledTimes(1);
});

test('previous and undo remain available without making undo primary', async () => {
  await Renderer.act(async () => { tree = Renderer.create(<Harness />); });
  await press('Mark as done'); await advance(); await press('Previous');
  expect(button('Undo this step')).toBeDefined();
  await press('Undo this step');
  expect(spyStep).toHaveBeenLastCalledWith(1,0,false);
  expect(button('Mark as done')).toBeDefined();
});

test('reopening completed projects shows summary and supports review and confirmed reset', async () => {
  const initial = { ...base, completed_steps: [0,1,2], completed_count: 3, progress_percent: 100, status: 'completed' as const };
  await Renderer.act(async () => { tree = Renderer.create(<Harness initial={initial} />); });
  expect(JSON.stringify(tree.toJSON())).toContain('Project completed!');
  await press('Review steps'); expect(button('Undo this step')).toBeDefined();
  await press('View completed summary');
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await press('Do it again'); expect(spyRestart).not.toHaveBeenCalled();
  const reset = alert.mock.calls[0][2]?.find(item => item.text === 'Reset progress');
  await Renderer.act(async () => { reset?.onPress?.(); });
  expect(spyRestart).toHaveBeenCalledWith(1); expect(button('Mark as done')).toBeDefined();
  expect(headings()).toContain('Step 1 of 3'); alert.mockRestore();
});

test('finishing a skipped-to last step does not fabricate earlier completions', async () => {
  await Renderer.act(async () => { tree = Renderer.create(<Harness />); });
  await press('Review step 3'); await press('Finish'); await advance();
  expect(JSON.stringify(tree.toJSON())).not.toContain('Project completed!');
  expect(JSON.stringify(tree.toJSON())).toContain('remaining earlier steps');
});

test('a failed save stays on the current step and permits retry', async () => {
  await Renderer.act(async () => { tree = Renderer.create(<ProjectGuide project={base} onStep={jest.fn().mockRejectedValue(new Error('Connection lost'))} onRestart={jest.fn()} onDone={jest.fn()} />); });
  await press('Mark as done'); await advance();
  expect(headings()).toContain('Step 1 of 3');
  expect(JSON.stringify(tree.toJSON())).toContain('Connection lost');
  expect(button('Mark as done')?.props.disabled).toBe(false);
});

test('review navigation cancels a pending auto-advance', async () => {
  await Renderer.act(async () => { tree = Renderer.create(<Harness />); });
  await press('Mark as done'); await press('Review step 1'); await advance();
  expect(headings()).toContain('Step 1 of 3');
  expect(button('Undo this step')).toBeDefined();
});
